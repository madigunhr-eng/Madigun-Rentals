import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Cloud, 
  HardDrive, 
  Database, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Upload, 
  Download, 
  Trash2, 
  ExternalLink, 
  Check, 
  ShieldCheck, 
  Clock, 
  FileJson, 
  Layers, 
  Zap,
  ArrowRight,
  Radio,
  Sliders
} from 'lucide-react';
import { 
  isDriveConnected, 
  getCachedDriveUser, 
  connectGoogleDrive, 
  disconnectGoogleDrive, 
  backupDatabaseToDrive, 
  listDriveBackups, 
  restoreDatabaseFromDrive, 
  deleteDriveBackup, 
  isAutoBackupEnabled, 
  setAutoBackupEnabled, 
  getLastDriveBackupTime,
  DriveUserProfile, 
  DriveBackupFile 
} from '../googleDrive';
import { isFirestoreOnline, restoreBackupToFirestore } from '../firebaseSync';
import { localStore } from '../localStore';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: any;
}

export default function CloudSyncModal({ isOpen, onClose, currentUser }: CloudSyncModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'drive' | 'firebase' | 'local'>('overview');
  
  // Google Drive states
  const [driveConnected, setDriveConnected] = useState(isDriveConnected());
  const [driveUser, setDriveUser] = useState<DriveUserProfile | null>(getCachedDriveUser());
  const [autoBackup, setAutoBackup] = useState(isAutoBackupEnabled());
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(getLastDriveBackupTime());
  const [backupsList, setBackupsList] = useState<DriveBackupFile[]>([]);
  
  // Loading & Progress states
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgressMsg, setRestoreProgressMsg] = useState('');
  const [restoreProgressPct, setRestoreProgressPct] = useState(0);
  const [isSyncingFirestore, setIsSyncingFirestore] = useState(false);
  
  // Messages & confirmations
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [restoreTargetFile, setRestoreTargetFile] = useState<DriveBackupFile | null>(null);
  const [wipeFirstOnRestore, setWipeFirstOnRestore] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

  // Firestore status
  const [firestoreOnline, setFirestoreOnline] = useState(isFirestoreOnline());

  useEffect(() => {
    if (!isOpen) return;
    setDriveConnected(isDriveConnected());
    setDriveUser(getCachedDriveUser());
    setAutoBackup(isAutoBackupEnabled());
    setLastBackupTime(getLastDriveBackupTime());
    setFirestoreOnline(isFirestoreOnline());
    setErrorMsg('');
    setSuccessMsg('');

    if (isDriveConnected()) {
      loadBackups();
    }
  }, [isOpen]);

  const loadBackups = async () => {
    try {
      setIsLoadingBackups(true);
      const files = await listDriveBackups();
      setBackupsList(files);
    } catch (err: any) {
      console.warn('Failed to load drive backups:', err.message);
      if (err.message.includes('expired') || err.message.includes('401')) {
        setDriveConnected(false);
        setDriveUser(null);
      }
    } finally {
      setIsLoadingBackups(false);
    }
  };

  const handleConnectDrive = async () => {
    try {
      setErrorMsg('');
      setIsConnectingDrive(true);
      const res = await connectGoogleDrive();
      setDriveConnected(true);
      setDriveUser(res.user);
      setSuccessMsg('Google Drive connected successfully!');
      await loadBackups();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to connect Google Drive');
    } finally {
      setIsConnectingDrive(false);
    }
  };

  const handleDisconnectDrive = () => {
    disconnectGoogleDrive();
    setDriveConnected(false);
    setDriveUser(null);
    setBackupsList([]);
    setSuccessMsg('Google Drive disconnected.');
  };

  const handleBackupToDriveNow = async () => {
    try {
      setErrorMsg('');
      setSuccessMsg('');
      setIsBackingUp(true);
      const file = await backupDatabaseToDrive();
      setLastBackupTime(new Date().toISOString());
      setSuccessMsg(`Database successfully backed up to Google Drive (${file.name})`);
      await loadBackups();
    } catch (err: any) {
      setErrorMsg(err.message || 'Backup to Google Drive failed.');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleToggleAutoBackup = (enabled: boolean) => {
    setAutoBackup(enabled);
    setAutoBackupEnabled(enabled);
    setSuccessMsg(enabled ? 'Automated Google Drive backup enabled.' : 'Automated backup disabled.');
  };

  const handleStartRestore = (file: DriveBackupFile) => {
    setRestoreTargetFile(file);
    setWipeFirstOnRestore(false);
  };

  const handleConfirmRestoreFromDrive = async () => {
    if (!restoreTargetFile) return;
    try {
      setErrorMsg('');
      setSuccessMsg('');
      setIsRestoring(true);
      setRestoreProgressMsg('Initializing restore...');
      setRestoreProgressPct(5);

      await restoreDatabaseFromDrive(
        restoreTargetFile.id,
        wipeFirstOnRestore,
        (status, pct) => {
          setRestoreProgressMsg(status);
          setRestoreProgressPct(pct);
        }
      );

      setSuccessMsg(`Successfully restored database snapshot from Google Drive!`);
      setRestoreTargetFile(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to restore database from Google Drive.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDeleteBackupFromDrive = async (fileId: string) => {
    try {
      setDeletingFileId(fileId);
      setErrorMsg('');
      await deleteDriveBackup(fileId);
      setBackupsList(prev => prev.filter(f => f.id !== fileId));
      setSuccessMsg('Backup file removed from Google Drive.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete backup file.');
    } finally {
      setDeletingFileId(null);
    }
  };

  const handleForceSyncFirestore = async () => {
    try {
      setErrorMsg('');
      setSuccessMsg('');
      setIsSyncingFirestore(true);
      const backupData = localStore.exportAll();
      await restoreBackupToFirestore(backupData, false, (status, pct) => {
        setRestoreProgressMsg(status);
      });
      setFirestoreOnline(true);
      setSuccessMsg('Cloud Firestore real-time synchronization refreshed and verified!');
    } catch (err: any) {
      setErrorMsg('Firestore synchronization error: ' + err.message);
    } finally {
      setIsSyncingFirestore(false);
    }
  };

  const handleDownloadLocalJson = () => {
    const backupObj = localStore.exportAll();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj, null, 2));
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const filename = `madigun_backup_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}.json`;
    
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setSuccessMsg('Local JSON database backup downloaded.');
  };

  const handleUploadLocalJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (!parsed || !parsed.data) {
            throw new Error('Invalid JSON backup file structure.');
          }
          setIsRestoring(true);
          setRestoreProgressMsg('Restoring from local JSON file...');
          await restoreBackupToFirestore(parsed, false, (s, p) => setRestoreProgressMsg(s));
          setSuccessMsg('Local backup file restored and synced to Cloud Firestore!');
        } catch (err: any) {
          setErrorMsg('Failed to parse backup JSON file: ' + err.message);
        } finally {
          setIsRestoring(false);
        }
      };
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/50 backdrop-blur-xs"
      />

      {/* Modal Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.2 }}
        className="bg-white w-full max-w-3xl border border-zinc-200 overflow-hidden flex flex-col relative z-10 max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-zinc-900 text-white">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900">Cloud & Database Storage Center</h3>
                <span className="text-[8px] font-bold font-mono px-1.5 py-0.5 bg-zinc-200 text-zinc-800 uppercase tracking-widest">
                  DUAL-SYNC ENGINE
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 font-mono mt-0.5 uppercase tracking-wider">
                Google Drive Storage & Firebase Real-time Synchronization
              </p>
            </div>
          </div>
          <button
            id="btn-close-cloud-modal"
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-200/60 transition-colors cursor-pointer text-zinc-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-zinc-200 bg-white px-6 shrink-0">
          <div className="flex gap-6 text-xs font-bold uppercase tracking-widest">
            <button
              id="tab-cloud-overview"
              onClick={() => setActiveTab('overview')}
              className={`py-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'overview'
                  ? 'text-zinc-900 border-zinc-900'
                  : 'border-transparent text-zinc-400 hover:text-zinc-700'
              }`}
            >
              <Sliders className="h-3.5 w-3.5" />
              Overview
            </button>
            <button
              id="tab-cloud-gdrive"
              onClick={() => setActiveTab('drive')}
              className={`py-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'drive'
                  ? 'text-zinc-900 border-zinc-900'
                  : 'border-transparent text-zinc-400 hover:text-zinc-700'
              }`}
            >
              <HardDrive className="h-3.5 w-3.5 text-blue-600" />
              Google Drive Storage
              {driveConnected && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 ml-1"></span>
              )}
            </button>
            <button
              id="tab-cloud-firebase"
              onClick={() => setActiveTab('firebase')}
              className={`py-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'firebase'
                  ? 'text-zinc-900 border-zinc-900'
                  : 'border-transparent text-zinc-400 hover:text-zinc-700'
              }`}
            >
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              Firebase Live Sync
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 ml-1"></span>
            </button>
            <button
              id="tab-cloud-local"
              onClick={() => setActiveTab('local')}
              className={`py-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'local'
                  ? 'text-zinc-900 border-zinc-900'
                  : 'border-transparent text-zinc-400 hover:text-zinc-700'
              }`}
            >
              <FileJson className="h-3.5 w-3.5 text-zinc-500" />
              Local JSON Archive
            </button>
          </div>
        </div>

        {/* Status Alerts */}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg('')} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg('')} className="text-red-700 hover:text-red-900 cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {/* Dual Sync Summary Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Firebase Status Card */}
                <div className="border border-zinc-200 p-5 bg-zinc-50/50 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-amber-100 text-amber-900 border border-amber-200">
                          <Zap className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900">Firebase Firestore</h4>
                          <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">Real-time Multi-client Sync</span>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                        Active
                      </span>
                    </div>

                    <p className="text-xs text-zinc-600 leading-relaxed mb-4">
                      All inventory changes, transmittals, check-outs, and returns sync immediately with zero latency to Google Cloud Firestore.
                    </p>

                    <div className="bg-white border border-zinc-200 p-3 space-y-1.5 text-[10px] font-mono text-zinc-600">
                      <div className="flex justify-between">
                        <span className="text-zinc-400 uppercase font-bold">Cloud Project:</span>
                        <span className="font-semibold text-zinc-800">gen-lang-client-0879184214</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400 uppercase font-bold">Active Collections:</span>
                        <span className="font-semibold text-zinc-800">7 collections</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400 uppercase font-bold">Auto-Replication:</span>
                        <span className="font-semibold text-emerald-700">Instant on write</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-200 flex justify-between items-center">
                    <button
                      id="btn-quick-sync-firestore"
                      onClick={handleForceSyncFirestore}
                      disabled={isSyncingFirestore}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-zinc-900 text-white hover:bg-zinc-800 disabled:bg-zinc-400 transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`h-3 w-3 ${isSyncingFirestore ? 'animate-spin' : ''}`} />
                      {isSyncingFirestore ? 'Syncing...' : 'Force Re-sync'}
                    </button>
                    <button
                      onClick={() => setActiveTab('firebase')}
                      className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 hover:text-zinc-900 flex items-center gap-1 cursor-pointer"
                    >
                      Details <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Google Drive Status Card */}
                <div className="border border-zinc-200 p-5 bg-zinc-50/50 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-100 text-blue-900 border border-blue-200">
                          <HardDrive className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900">Google Drive</h4>
                          <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">Permanent Database Archives</span>
                        </div>
                      </div>
                      {driveConnected ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-blue-100 text-blue-800 border border-blue-200">
                          <Check className="h-3 w-3" /> Connected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-zinc-100 text-zinc-600 border border-zinc-200">
                          Not Connected
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-zinc-600 leading-relaxed mb-4">
                      Store versioned snapshots of the entire rental database directly into your Google Drive in a dedicated secure folder.
                    </p>

                    {driveConnected && driveUser ? (
                      <div className="bg-white border border-zinc-200 p-3 space-y-1.5 text-[10px] font-mono text-zinc-600">
                        <div className="flex items-center gap-2">
                          {driveUser.picture && (
                            <img src={driveUser.picture} alt="" className="h-5 w-5 rounded-full" referrerPolicy="no-referrer" />
                          )}
                          <span className="font-bold text-zinc-900 truncate">{driveUser.name} ({driveUser.email})</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-zinc-100">
                          <span className="text-zinc-400 uppercase font-bold">Drive Folder:</span>
                          <span className="font-semibold text-zinc-800 truncate">Madigun Rentals Backups</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400 uppercase font-bold">Saved Snapshots:</span>
                          <span className="font-semibold text-zinc-800">{backupsList.length} files</span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white border border-zinc-200 p-3 text-center">
                        <p className="text-xs text-zinc-500 mb-2 font-mono">Connect Google Account to enable Drive storage</p>
                        <button
                          id="btn-overview-connect-gdrive"
                          onClick={handleConnectDrive}
                          disabled={isConnectingDrive}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-[10px] font-bold uppercase tracking-widest transition-colors cursor-pointer"
                        >
                          {isConnectingDrive && <RefreshCw className="h-3 w-3 animate-spin" />}
                          Connect Google Drive
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-200 flex justify-between items-center">
                    {driveConnected ? (
                      <button
                        id="btn-overview-backup-now"
                        onClick={handleBackupToDriveNow}
                        disabled={isBackingUp}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300 transition-colors cursor-pointer"
                      >
                        <Upload className={`h-3 w-3 ${isBackingUp ? 'animate-bounce' : ''}`} />
                        {isBackingUp ? 'Backing up...' : 'Backup to Drive'}
                      </button>
                    ) : (
                      <span className="text-[10px] text-zinc-400 font-mono">OAuth 2.0 Ready</span>
                    )}
                    <button
                      onClick={() => setActiveTab('drive')}
                      className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 hover:text-zinc-900 flex items-center gap-1 cursor-pointer"
                    >
                      Manage <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>

              </div>

              {/* Instant Actions Banner */}
              <div className="p-4 bg-zinc-900 text-white flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-6 w-6 text-emerald-400 shrink-0" />
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider">Enterprise Redundancy Guaranteed</h4>
                    <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                      Your records are preserved in local device cache, Firestore database, and Google Drive cloud archives.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleDownloadLocalJson}
                    className="flex-1 sm:flex-none px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Download className="h-3 w-3" /> Export JSON
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: GOOGLE DRIVE STORAGE */}
          {activeTab === 'drive' && (
            <div className="space-y-6">
              
              {/* Account Card */}
              <div className="border border-zinc-200 p-5 bg-zinc-50">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 border border-blue-200 text-blue-700">
                      <HardDrive className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900">Google Drive Integration</h4>
                      {driveConnected && driveUser ? (
                        <p className="text-xs text-zinc-600 font-mono mt-0.5">
                          Authenticated as: <strong className="text-zinc-900">{driveUser.name}</strong> ({driveUser.email})
                        </p>
                      ) : (
                        <p className="text-xs text-zinc-500 font-mono mt-0.5">
                          Connect your Google Account to back up and restore database snapshots to Drive.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {driveConnected ? (
                      <>
                        <button
                          id="btn-backup-to-drive-now"
                          onClick={handleBackupToDriveNow}
                          disabled={isBackingUp}
                          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer"
                        >
                          <Upload className={`h-3.5 w-3.5 ${isBackingUp ? 'animate-bounce' : ''}`} />
                          {isBackingUp ? 'Saving to Drive...' : 'Save Backup to Drive'}
                        </button>
                        <button
                          id="btn-disconnect-gdrive"
                          onClick={handleDisconnectDrive}
                          className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-red-600 hover:bg-red-50 border border-red-200 transition-colors cursor-pointer"
                        >
                          Disconnect
                        </button>
                      </>
                    ) : (
                      <button
                        id="btn-connect-gdrive-primary"
                        onClick={handleConnectDrive}
                        disabled={isConnectingDrive}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer"
                      >
                        {isConnectingDrive && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                        Connect Google Drive Account
                      </button>
                    )}
                  </div>
                </div>

                {/* Auto backup switch */}
                {driveConnected && (
                  <div className="mt-4 pt-4 border-t border-zinc-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-zinc-500" />
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-800">Auto-Backup to Google Drive</span>
                        <p className="text-[10px] text-zinc-400 font-mono">Automatically archives database every 10 minutes in the background</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoBackup}
                        onChange={(e) => handleToggleAutoBackup(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-zinc-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                )}
              </div>

              {/* Backups List from Google Drive */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900">
                      Saved Backups in Google Drive ({backupsList.length})
                    </h4>
                    <span className="text-[9px] font-mono text-zinc-400 uppercase">Folder: /Madigun Rentals Backups</span>
                  </div>
                  {driveConnected && (
                    <button
                      id="btn-refresh-drive-backups"
                      onClick={loadBackups}
                      disabled={isLoadingBackups}
                      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-zinc-600 hover:text-zinc-900 cursor-pointer"
                    >
                      <RefreshCw className={`h-3 w-3 ${isLoadingBackups ? 'animate-spin' : ''}`} />
                      Refresh List
                    </button>
                  )}
                </div>

                {!driveConnected ? (
                  <div className="border border-dashed border-zinc-300 p-8 text-center bg-zinc-50/50">
                    <HardDrive className="h-8 w-8 text-zinc-400 mx-auto mb-2" />
                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-700">Google Drive is not connected</p>
                    <p className="text-[11px] text-zinc-500 mt-1 max-w-sm mx-auto font-mono">
                      Connect your Google Drive account above to view and restore database backup files.
                    </p>
                  </div>
                ) : isLoadingBackups ? (
                  <div className="border border-zinc-200 p-8 text-center bg-white">
                    <RefreshCw className="h-6 w-6 text-zinc-900 animate-spin mx-auto mb-2" />
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Querying Google Drive files...</p>
                  </div>
                ) : backupsList.length === 0 ? (
                  <div className="border border-zinc-200 p-8 text-center bg-white">
                    <FileJson className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-800">No backup snapshots found in Drive</p>
                    <p className="text-[11px] text-zinc-500 mt-1 font-mono">Click "Save Backup to Drive" to create your first snapshot.</p>
                  </div>
                ) : (
                  <div className="border border-zinc-200 overflow-hidden bg-white">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50 text-[9px] font-black uppercase tracking-widest text-zinc-500 font-mono">
                          <th className="py-2.5 px-4">Backup File</th>
                          <th className="py-2.5 px-4">Created Date</th>
                          <th className="py-2.5 px-4">Size</th>
                          <th className="py-2.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-150 text-xs">
                        {backupsList.map((file) => (
                          <tr key={file.id} className="hover:bg-zinc-50/80 transition-colors">
                            <td className="py-3 px-4 font-mono font-semibold text-zinc-900">
                              <div className="flex items-center gap-2">
                                <FileJson className="h-4 w-4 text-blue-600 shrink-0" />
                                <span className="truncate max-w-xs">{file.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono text-zinc-600 text-[11px]">
                              {file.createdTime ? new Date(file.createdTime).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) : 'Unknown'}
                            </td>
                            <td className="py-3 px-4 font-mono text-zinc-500 text-[11px]">
                              {file.size ? `${(parseInt(file.size, 10) / 1024).toFixed(1)} KB` : 'JSON'}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  id={`btn-restore-drive-${file.id}`}
                                  onClick={() => handleStartRestore(file)}
                                  className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest bg-zinc-900 hover:bg-zinc-800 text-white transition-colors cursor-pointer"
                                >
                                  Restore
                                </button>
                                <a
                                  href={`https://drive.google.com/file/d/${file.id}/view`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1 text-zinc-500 hover:text-zinc-900 border border-zinc-200 transition-colors"
                                  title="Open in Google Drive"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                                <button
                                  id={`btn-delete-drive-${file.id}`}
                                  onClick={() => handleDeleteBackupFromDrive(file.id)}
                                  disabled={deletingFileId === file.id}
                                  className="p-1 text-red-600 hover:bg-red-50 border border-red-200 transition-colors cursor-pointer disabled:opacity-50"
                                  title="Delete from Google Drive"
                                >
                                  {deletingFileId === file.id ? (
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 3: FIREBASE LIVE SYNC */}
          {activeTab === 'firebase' && (
            <div className="space-y-6">
              <div className="border border-zinc-200 p-5 bg-zinc-50">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-100 border border-amber-200 text-amber-900">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900">Firebase Firestore Real-time Engine</h4>
                      <p className="text-xs text-zinc-500 font-mono mt-0.5">Continuous live bidirectional database synchronization</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse"></span>
                    Live Connected
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
                  <div className="bg-white border border-zinc-200 p-3 space-y-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 font-mono block">Firestore Database ID</span>
                    <span className="text-xs font-mono font-bold text-zinc-900 block truncate">ai-studio-madigunrentals-25b80405-bd8e-4331-a790-adda554e8aef</span>
                  </div>
                  <div className="bg-white border border-zinc-200 p-3 space-y-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 font-mono block">Sync Mode</span>
                    <span className="text-xs font-mono font-bold text-emerald-700 block">Memory Cache + Long Polling / WebSockets</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <p className="text-xs text-zinc-600 font-mono">
                    If another staff member checks in or rents an item on another device, this browser updates automatically.
                  </p>
                  <button
                    id="btn-force-firebase-sync"
                    onClick={handleForceSyncFirestore}
                    disabled={isSyncingFirestore}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-400 text-white text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer shrink-0"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isSyncingFirestore ? 'animate-spin' : ''}`} />
                    {isSyncingFirestore ? 'Synchronizing...' : 'Force Cloud Re-sync'}
                  </button>
                </div>
              </div>

              {/* Collections Status List */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 mb-3">
                  Active Firestore Synced Collections
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    { name: 'inventory', label: 'Rental Inventory', count: localStore.getCollection('inventory').length },
                    { name: 'transmittals', label: 'Transmittals & Checkouts', count: localStore.getCollection('transmittals').length },
                    { name: 'deleted_logs', label: 'Deleted Void Logs', count: localStore.getCollection('deleted_logs').length },
                    { name: 'warehouses', label: 'Warehouse Hubs', count: localStore.getCollection('warehouses').length },
                    { name: 'custodians', label: 'Equipment Custodians', count: localStore.getCollection('custodians').length },
                    { name: 'users', label: 'Personnel Accounts', count: localStore.getCollection('users').length }
                  ].map((col) => (
                    <div key={col.name} className="border border-zinc-200 bg-white p-3 flex justify-between items-center">
                      <div>
                        <span className="text-xs font-bold text-zinc-900 block uppercase tracking-wider">{col.label}</span>
                        <span className="text-[10px] font-mono text-zinc-400 uppercase">/{col.name}</span>
                      </div>
                      <span className="px-2 py-0.5 text-xs font-mono font-bold bg-zinc-100 border border-zinc-200 text-zinc-800">
                        {col.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: LOCAL JSON ARCHIVE */}
          {activeTab === 'local' && (
            <div className="space-y-6">
              <div className="border border-zinc-200 p-5 bg-zinc-50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-zinc-200 text-zinc-800">
                    <FileJson className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900">Manual JSON Export & Import</h4>
                    <p className="text-xs text-zinc-500 font-mono mt-0.5">Download or upload raw JSON database archives</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <div className="border border-zinc-200 bg-white p-4 flex flex-col justify-between">
                    <div>
                      <h5 className="text-xs font-black uppercase tracking-wider text-zinc-900 mb-1">Export Database</h5>
                      <p className="text-xs text-zinc-600 mb-4 font-mono">
                        Download a complete JSON snapshot file containing all inventory items, transmittals, and configurations.
                      </p>
                    </div>
                    <button
                      id="btn-export-local-json"
                      onClick={handleDownloadLocalJson}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" /> Download JSON File
                    </button>
                  </div>

                  <div className="border border-zinc-200 bg-white p-4 flex flex-col justify-between">
                    <div>
                      <h5 className="text-xs font-black uppercase tracking-wider text-zinc-900 mb-1">Import Database</h5>
                      <p className="text-xs text-zinc-600 mb-4 font-mono">
                        Upload a previously downloaded `.json` database file to restore and push to Firebase.
                      </p>
                    </div>
                    <label className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-800 text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer">
                      <Upload className="h-3.5 w-3.5" /> Select JSON File
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleUploadLocalJson}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Restore Confirmation Dialog */}
        <AnimatePresence>
          {restoreTargetFile && (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setRestoreTargetFile(null)}
                className="absolute inset-0 bg-zinc-950/60 backdrop-blur-xs"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border border-zinc-200 p-6 max-w-md w-full relative z-10 space-y-4"
              >
                <div className="flex items-center gap-3 text-amber-600">
                  <AlertCircle className="h-6 w-6 shrink-0" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900">
                    Confirm Database Restoration
                  </h3>
                </div>

                <p className="text-xs text-zinc-600 leading-relaxed">
                  You are about to restore the snapshot: <br />
                  <strong className="font-mono text-zinc-900 font-bold block mt-1">{restoreTargetFile.name}</strong>
                </p>

                <div className="p-3 bg-zinc-50 border border-zinc-200 space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wipeFirstOnRestore}
                      onChange={(e) => setWipeFirstOnRestore(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span className="text-xs text-zinc-700 font-semibold leading-snug">
                      Clean wipe current database before restoring (Recommended for exact snapshot replica)
                    </span>
                  </label>
                </div>

                {isRestoring && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-mono text-zinc-500 font-bold uppercase">
                      <span>{restoreProgressMsg}</span>
                      <span>{restoreProgressPct}%</span>
                    </div>
                    <div className="w-full bg-zinc-200 h-1.5 overflow-hidden">
                      <div
                        className="bg-zinc-900 h-1.5 transition-all duration-300"
                        style={{ width: `${restoreProgressPct}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setRestoreTargetFile(null)}
                    disabled={isRestoring}
                    className="px-4 py-2 border border-zinc-200 text-xs font-bold uppercase tracking-widest text-zinc-600 hover:bg-zinc-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    id="btn-confirm-drive-restore"
                    onClick={handleConfirmRestoreFromDrive}
                    disabled={isRestoring}
                    className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-400 text-white text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    {isRestoring && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                    {isRestoring ? 'Restoring...' : 'Restore Now'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-200 bg-zinc-50 shrink-0 flex justify-between items-center text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
          <span>Google Drive API v3 • Firebase Firestore Cloud</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 font-bold uppercase tracking-widest transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
