import config from '../firebase-applet-config.json';
import { localStore } from './localStore';
import { restoreBackupToFirestore } from './firebaseSync';

export interface DriveUserProfile {
  email: string;
  name: string;
  picture?: string;
}

export interface DriveBackupFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
  modifiedTime: string;
  size?: string;
  itemCount?: number;
  version?: number;
}

const DRIVE_AUTH_TOKEN_KEY = 'madigun_gdrive_token';
const DRIVE_USER_KEY = 'madigun_gdrive_user';
const DRIVE_AUTO_BACKUP_KEY = 'madigun_gdrive_auto_backup';
const DRIVE_LAST_BACKUP_TIME_KEY = 'madigun_gdrive_last_backup_time';
const BACKUP_FOLDER_NAME = 'Madigun Rentals Backups';

// Listeners for Google Drive State
const driveStateListeners = new Set<(isConnected: boolean, user: DriveUserProfile | null) => void>();

function notifyDriveState(isConnected: boolean, user: DriveUserProfile | null) {
  driveStateListeners.forEach(cb => {
    try {
      cb(isConnected, user);
    } catch (e) {
      console.error('Error in Drive state callback:', e);
    }
  });
}

export function subscribeDriveState(callback: (isConnected: boolean, user: DriveUserProfile | null) => void): () => void {
  driveStateListeners.add(callback);
  callback(isDriveConnected(), getCachedDriveUser());
  return () => {
    driveStateListeners.delete(callback);
  };
}

export function getCachedDriveToken(): string | null {
  if (typeof window === 'undefined') return null;
  const tokenData = localStorage.getItem(DRIVE_AUTH_TOKEN_KEY);
  if (!tokenData) return null;
  try {
    const parsed = JSON.parse(tokenData);
    if (parsed.expires_at && parsed.expires_at < Date.now()) {
      localStorage.removeItem(DRIVE_AUTH_TOKEN_KEY);
      return null;
    }
    return parsed.access_token || null;
  } catch {
    return null;
  }
}

export function getCachedDriveUser(): DriveUserProfile | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(DRIVE_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isDriveConnected(): boolean {
  return !!getCachedDriveToken();
}

export function isAutoBackupEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(DRIVE_AUTO_BACKUP_KEY) === 'true';
}

export function setAutoBackupEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DRIVE_AUTO_BACKUP_KEY, enabled ? 'true' : 'false');
}

export function getLastDriveBackupTime(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(DRIVE_LAST_BACKUP_TIME_KEY);
}

/**
 * Connect and Request Google Drive OAuth Token via Google Identity Services
 */
export async function connectGoogleDrive(): Promise<{ token: string; user: DriveUserProfile | null }> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('Window not available'));
    }

    const clientId = (config as any).oAuthClientId;
    if (!clientId) {
      return reject(new Error('Google OAuth Client ID is not configured in firebase-applet-config.json.'));
    }

    const google = (window as any).google;
    if (!google || !google.accounts || !google.accounts.oauth2) {
      return reject(new Error('Google Identity Services script is loading. Please wait 2 seconds and try again.'));
    }

    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        callback: async (response: any) => {
          if (response.error) {
            console.error('Google OAuth error:', response);
            return reject(new Error(response.error_description || response.error || 'Failed to authenticate with Google'));
          }

          const accessToken = response.access_token;
          const expiresIn = response.expires_in ? parseInt(response.expires_in, 10) : 3500;
          const expiresAt = Date.now() + (expiresIn - 60) * 1000;

          localStorage.setItem(
            DRIVE_AUTH_TOKEN_KEY,
            JSON.stringify({
              access_token: accessToken,
              expires_at: expiresAt
            })
          );

          // Fetch user profile info
          let userProfile: DriveUserProfile | null = null;
          try {
            const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (userRes.ok) {
              const data = await userRes.json();
              userProfile = {
                name: data.name || data.email,
                email: data.email,
                picture: data.picture
              };
              localStorage.setItem(DRIVE_USER_KEY, JSON.stringify(userProfile));
            }
          } catch (err) {
            console.warn('Could not fetch user profile info:', err);
          }

          notifyDriveState(true, userProfile);
          resolve({ token: accessToken, user: userProfile });
        }
      });

      client.requestAccessToken({ prompt: 'consent' });
    } catch (err: any) {
      reject(err);
    }
  });
}

/**
 * Disconnect Google Drive
 */
export function disconnectGoogleDrive(): void {
  if (typeof window === 'undefined') return;
  const token = getCachedDriveToken();
  if (token) {
    try {
      const google = (window as any).google;
      if (google?.accounts?.oauth2?.revoke) {
        google.accounts.oauth2.revoke(token, () => {
          console.log('Google Drive OAuth token revoked.');
        });
      }
    } catch (e) {
      // Ignore
    }
  }
  localStorage.removeItem(DRIVE_AUTH_TOKEN_KEY);
  localStorage.removeItem(DRIVE_USER_KEY);
  notifyDriveState(false, null);
}

/**
 * Find or Create the "Madigun Rentals Backups" folder in user's Drive
 */
async function getOrCreateBackupFolder(token: string): Promise<string> {
  // 1. Search for existing folder
  const query = encodeURIComponent(`name = '${BACKUP_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&spaces=drive`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!searchRes.ok) {
    throw new Error(`Failed to query Google Drive folder: ${searchRes.statusText}`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // 2. Create folder if not found
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: BACKUP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Automated database backups and storage archives for Madigun Hotel & Events Rental Management System'
    })
  });

  if (!createRes.ok) {
    throw new Error(`Failed to create Google Drive folder: ${createRes.statusText}`);
  }

  const createdData = await createRes.json();
  return createdData.id;
}

/**
 * Backup the entire Madigun Database to Google Drive as JSON
 */
export async function backupDatabaseToDrive(customDescription?: string): Promise<DriveBackupFile> {
  const token = getCachedDriveToken();
  if (!token) {
    throw new Error('Google Drive is not connected. Please connect your Google account first.');
  }

  const folderId = await getOrCreateBackupFolder(token);

  // Export current full database
  const fullBackupPayload = localStore.exportAll();
  
  // Calculate total entity items
  const inventoryCount = fullBackupPayload.data.inventory?.length || 0;
  const transmittalsCount = fullBackupPayload.data.transmittals?.length || 0;
  const usersCount = fullBackupPayload.data.users?.length || 0;
  const totalCount = inventoryCount + transmittalsCount + (fullBackupPayload.data.warehouses?.length || 0) + (fullBackupPayload.data.custodians?.length || 0);

  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const dateFormatted = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const filename = `madigun_database_backup_${dateFormatted}.json`;

  const metadata = {
    name: filename,
    parents: [folderId],
    mimeType: 'application/json',
    description: customDescription || `Madigun Rental System Snapshot (${totalCount} records: ${inventoryCount} inventory items, ${transmittalsCount} transmittals, ${usersCount} users)`
  };

  const fileContent = JSON.stringify(fullBackupPayload, null, 2);

  // Multipart upload to Google Drive
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    fileContent +
    closeDelimiter;

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,createdTime,modifiedTime,size',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    }
  );

  if (!uploadRes.ok) {
    const errBody = await uploadRes.text();
    throw new Error(`Google Drive upload failed (${uploadRes.status}): ${errBody}`);
  }

  const uploadedFile = await uploadRes.json();

  // Save last backup timestamp
  const backupTimeStr = new Date().toISOString();
  localStorage.setItem(DRIVE_LAST_BACKUP_TIME_KEY, backupTimeStr);

  return {
    id: uploadedFile.id,
    name: uploadedFile.name,
    mimeType: uploadedFile.mimeType,
    createdTime: uploadedFile.createdTime || backupTimeStr,
    modifiedTime: uploadedFile.modifiedTime || backupTimeStr,
    size: uploadedFile.size,
    itemCount: totalCount,
    version: fullBackupPayload.version
  };
}

/**
 * List all backup files in the Madigun Rentals Backups folder
 */
export async function listDriveBackups(): Promise<DriveBackupFile[]> {
  const token = getCachedDriveToken();
  if (!token) {
    throw new Error('Google Drive is not connected.');
  }

  let folderId: string;
  try {
    folderId = await getOrCreateBackupFolder(token);
  } catch (err: any) {
    throw new Error(`Could not access Google Drive backup folder: ${err.message}`);
  }

  const query = encodeURIComponent(`'${folderId}' in parents and name contains 'madigun_database_backup' and trashed = false`);
  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,createdTime,modifiedTime,size,description)&orderBy=createdTime desc`;

  const res = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    if (res.status === 401) {
      disconnectGoogleDrive();
      throw new Error('Google Drive session expired. Please reconnect.');
    }
    throw new Error(`Failed to list Google Drive files: ${res.statusText}`);
  }

  const data = await res.json();
  const files: DriveBackupFile[] = (data.files || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    createdTime: f.createdTime,
    modifiedTime: f.modifiedTime,
    size: f.size
  }));

  return files;
}

/**
 * Download and restore a database backup file from Google Drive
 */
export async function restoreDatabaseFromDrive(
  fileId: string,
  wipeFirst: boolean = false,
  onProgress?: (status: string, percent: number) => void
): Promise<void> {
  const token = getCachedDriveToken();
  if (!token) {
    throw new Error('Google Drive is not connected.');
  }

  onProgress?.('Downloading backup file from Google Drive...', 15);

  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    throw new Error(`Failed to download file from Google Drive: ${res.statusText}`);
  }

  onProgress?.('Parsing and validating backup data...', 35);
  const backupJson = await res.json();

  if (!backupJson || !backupJson.data) {
    throw new Error('Downloaded file does not match the Madigun database backup format.');
  }

  onProgress?.('Restoring to Cloud Firestore and local storage...', 50);

  // Sync into Firestore and LocalStorage
  await restoreBackupToFirestore(backupJson, wipeFirst, (msg, pct) => {
    // Map progress between 50% and 100%
    const mapped = Math.round(50 + (pct * 0.5));
    onProgress?.(msg, mapped);
  });
}

/**
 * Delete a backup file from Google Drive
 */
export async function deleteDriveBackup(fileId: string): Promise<void> {
  const token = getCachedDriveToken();
  if (!token) {
    throw new Error('Google Drive is not connected.');
  }

  const deleteUrl = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  const res = await fetch(deleteUrl, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok && res.status !== 204 && res.status !== 404) {
    throw new Error(`Failed to delete file from Google Drive: ${res.statusText}`);
  }
}

/**
 * Helper to initialize auto-backup interval listener if enabled
 */
let autoBackupInterval: any = null;

export function initAutoBackupScheduler(): () => void {
  if (typeof window === 'undefined') return () => {};

  if (autoBackupInterval) {
    clearInterval(autoBackupInterval);
  }

  // Check every 10 minutes if auto-backup is enabled and token is active
  autoBackupInterval = setInterval(async () => {
    if (isAutoBackupEnabled() && isDriveConnected()) {
      try {
        console.log('Running automated Google Drive database backup...');
        await backupDatabaseToDrive('Automated periodic background backup');
        console.log('Automated Google Drive backup completed.');
      } catch (err: any) {
        console.warn('Auto-backup to Google Drive skipped or failed:', err.message);
      }
    }
  }, 10 * 60 * 1000); // 10 minutes

  return () => {
    if (autoBackupInterval) {
      clearInterval(autoBackupInterval);
      autoBackupInterval = null;
    }
  };
}
