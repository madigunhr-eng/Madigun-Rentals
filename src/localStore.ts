import { InventoryItem, Transmittal, DeletedLog, Custodian, AuditLog, UserProfile, Warehouse, ItemCategory } from './types';
import { DEFAULT_CATEGORIES } from './utils';

const STORAGE_PREFIX = 'madigun_db_';
const INITIALIZED_KEY = 'madigun_db_initialized_v2';

// Event bus for reactivity within the same window and across components
const listeners: Map<string, Set<(data: any[]) => void>> = new Map();
const docListeners: Map<string, Set<(data: any) => void>> = new Map();

function emitUpdate(collectionName: string) {
  const data = getCollectionRaw(collectionName);
  const set = listeners.get(collectionName);
  if (set) {
    set.forEach(cb => {
      try {
        cb(data);
      } catch (e) {
        console.error(`Error in subscriber callback for ${collectionName}:`, e);
      }
    });
  }

  // Dispatch custom window event so other instances / components react immediately
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('madigun_store_change', {
      detail: { collection: collectionName }
    }));
  }
}

function emitDocUpdate(collectionName: string, docId: string) {
  const key = `${collectionName}/${docId}`;
  const data = getDocRaw(collectionName, docId);
  const set = docListeners.get(key);
  if (set) {
    set.forEach(cb => {
      try {
        cb(data);
      } catch (e) {
        console.error(`Error in doc subscriber callback for ${key}:`, e);
      }
    });
  }
}

// Cross-tab synchronization
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith(STORAGE_PREFIX)) {
      const colName = e.key.replace(STORAGE_PREFIX, '');
      emitUpdate(colName);
    }
  });

  window.addEventListener('madigun_store_change', (e: any) => {
    if (e.detail && e.detail.collection) {
      // Re-trigger callbacks if needed
    }
  });
}

function getStorageKey(collectionName: string): string {
  return `${STORAGE_PREFIX}${collectionName}`;
}

function getCollectionRaw<T = any>(collectionName: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getStorageKey(collectionName));
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Failed to read collection ${collectionName} from localStorage:`, e);
    return [];
  }
}

function setCollectionRaw<T = any>(collectionName: string, items: T[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getStorageKey(collectionName), JSON.stringify(items));
    emitUpdate(collectionName);
  } catch (e) {
    console.error(`Failed to save collection ${collectionName} to localStorage:`, e);
  }
}

function getDocRaw<T = any>(collectionName: string, docId: string): T | null {
  if (collectionName === 'settings') {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}setting_${docId}`);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const col = getCollectionRaw<any>(collectionName);
  return col.find(item => item.id === docId) || null;
}

function setDocRaw<T = any>(collectionName: string, docId: string, data: T): void {
  if (collectionName === 'settings') {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`${STORAGE_PREFIX}setting_${docId}`, JSON.stringify(data));
      emitDocUpdate(collectionName, docId);
    } catch (e) {
      console.error(`Failed to save setting doc ${docId}:`, e);
    }
    return;
  }
  const col = getCollectionRaw<any>(collectionName);
  const index = col.findIndex(item => item.id === docId);
  if (index >= 0) {
    col[index] = { ...col[index], ...data, id: docId };
  } else {
    col.push({ ...data, id: docId });
  }
  setCollectionRaw(collectionName, col);
  emitDocUpdate(collectionName, docId);
}

// Generate unique ID generator
export function generateId(prefix: string = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Initial Seed Data: Default user accounts
const DEFAULT_USERS: UserProfile[] = [
  {
    id: 'EMP-2026-001',
    username: 'ADMIN',
    password: 'Password123!',
    role: 'Admin',
    employeeId: 'EMP-2026-001',
    fullName: 'Madigun System Administrator',
    phone: '+63 900 000 0000',
    email: 'madigunhotelevents@gmail.com',
    department: 'Executive Administration',
    bio: 'Primary root administrator account with unrestricted system control.',
    status: 'Approved',
    createdAt: new Date().toISOString()
  },
  {
    id: 'EMP-2026-002',
    username: 'MARC',
    password: 'Password123!',
    role: 'Managing Director',
    employeeId: 'EMP-2026-002',
    fullName: 'Marc Alexander (Managing Director)',
    phone: '+63 917 123 4567',
    email: 'marc@madigunhotel.com',
    department: 'Executive Management',
    bio: 'Managing Director overseeing hotel inventory, banquet transmittals and operations.',
    status: 'Approved',
    createdAt: new Date().toISOString()
  },
  {
    id: 'EMP-2026-003',
    username: 'STAFF',
    password: 'Password123!',
    role: 'Front Desk',
    employeeId: 'EMP-2026-003',
    fullName: 'Front Desk Operations',
    phone: '+63 918 765 4321',
    email: 'frontdesk@madigunhotel.com',
    department: 'Front Desk Operations',
    bio: 'Front desk reception and guest logistics personnel.',
    status: 'Approved',
    createdAt: new Date().toISOString()
  }
];
const DEFAULT_WAREHOUSES: Warehouse[] = [];
const DEFAULT_CUSTODIANS: Custodian[] = [];
const DEFAULT_INVENTORY: InventoryItem[] = [];
const DEFAULT_TRANSMITTALS: Transmittal[] = [];

// Initialize storage cleanly with default accounts
export function initLocalStore(): void {
  if (typeof window === 'undefined') return;

  const currentUsers = getCollectionRaw<UserProfile>('users');
  if (currentUsers.length === 0) {
    setCollectionRaw('users', DEFAULT_USERS);
  } else {
    // Ensure all default users exist
    let updated = false;
    DEFAULT_USERS.forEach(defUser => {
      if (!currentUsers.some(u => u.username?.toUpperCase() === defUser.username || u.employeeId === defUser.employeeId)) {
        currentUsers.push(defUser);
        updated = true;
      }
    });
    if (updated) {
      setCollectionRaw('users', currentUsers);
    }
  }

  if (!localStorage.getItem(getStorageKey('warehouses'))) {
    setCollectionRaw('warehouses', []);
  }

  if (!localStorage.getItem(getStorageKey('custodians'))) {
    setCollectionRaw('custodians', []);
  }

  if (!localStorage.getItem(getStorageKey('inventory'))) {
    setCollectionRaw('inventory', []);
  }

  if (!localStorage.getItem(getStorageKey('transmittals'))) {
    setCollectionRaw('transmittals', []);
  }

  if (!localStorage.getItem(getStorageKey('categories'))) {
    const defaultCats: ItemCategory[] = DEFAULT_CATEGORIES.map((catName, idx) => ({
      id: `cat_${idx + 1}_${catName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      name: catName,
      isSystem: catName === 'Corkage & Service Permits',
      createdAt: new Date().toISOString()
    }));
    setCollectionRaw('categories', defaultCats);
  } else {
    const currentCats = getCollectionRaw<ItemCategory>('categories');
    if (!currentCats || currentCats.length === 0) {
      const defaultCats: ItemCategory[] = DEFAULT_CATEGORIES.map((catName, idx) => ({
        id: `cat_${idx + 1}_${catName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        name: catName,
        isSystem: catName === 'Corkage & Service Permits',
        createdAt: new Date().toISOString()
      }));
      setCollectionRaw('categories', defaultCats);
    }
  }

  if (!localStorage.getItem(getStorageKey('deleted_logs'))) {
    localStorage.setItem(getStorageKey('deleted_logs'), JSON.stringify([]));
  }
  if (!localStorage.getItem(getStorageKey('audit_logs'))) {
    localStorage.setItem(getStorageKey('audit_logs'), JSON.stringify([]));
  }
  localStorage.setItem(INITIALIZED_KEY, 'true');
}

export function restoreDefaultSeedData(): void {
  const defaultCats: ItemCategory[] = DEFAULT_CATEGORIES.map((catName, idx) => ({
    id: `cat_${idx + 1}_${catName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    name: catName,
    isSystem: catName === 'Corkage & Service Permits',
    createdAt: new Date().toISOString()
  }));
  setCollectionRaw('users', DEFAULT_USERS);
  setCollectionRaw('warehouses', []);
  setCollectionRaw('custodians', []);
  setCollectionRaw('inventory', []);
  setCollectionRaw('transmittals', []);
  setCollectionRaw('categories', defaultCats);
  setCollectionRaw('deleted_logs', []);
  setCollectionRaw('audit_logs', []);
}

// Call initialization immediately on module load
if (typeof window !== 'undefined') {
  initLocalStore();
}

import { syncSetDoc, syncUpdateDoc, syncDeleteDoc } from './firebaseSync';

// LocalStore Public API
export const localStore = {
  // Read collection
  getCollection<T = any>(collectionName: string): T[] {
    return getCollectionRaw<T>(collectionName);
  },

  // Read single item
  getItem<T = any>(collectionName: string, id: string): T | null {
    return getDocRaw<T>(collectionName, id);
  },

  // Add item with auto-generated or custom ID
  async addItem<T = any>(collectionName: string, itemData: T): Promise<T & { id: string }> {
    const col = getCollectionRaw<any>(collectionName);
    const id = (itemData as any)?.id || generateId(collectionName.substring(0, 3));
    const newItem = { ...(itemData as any), id };
    col.push(newItem);
    setCollectionRaw(collectionName, col);
    syncSetDoc(collectionName, id, newItem).catch(err => console.warn('Firestore sync error:', err));
    return newItem as T & { id: string };
  },

  // Update item by ID
  async updateItem<T = any>(collectionName: string, id: string, updates: Partial<T>): Promise<void> {
    const col = getCollectionRaw<any>(collectionName);
    const index = col.findIndex(item => item.id === id);
    if (index >= 0) {
      col[index] = { ...col[index], ...updates };
      setCollectionRaw(collectionName, col);
      emitDocUpdate(collectionName, id);
      syncUpdateDoc(collectionName, id, updates).catch(err => console.warn('Firestore sync error:', err));
    }
  },

  // Set / Overwrite item by ID
  async setItem<T = any>(collectionName: string, id: string, data: T): Promise<void> {
    setDocRaw(collectionName, id, data);
    syncSetDoc(collectionName, id, data).catch(err => console.warn('Firestore sync error:', err));
  },

  // Delete item by ID
  async deleteItem(collectionName: string, id: string): Promise<void> {
    const col = getCollectionRaw<any>(collectionName);
    const filtered = col.filter(item => item.id !== id);
    setCollectionRaw(collectionName, filtered);
    syncDeleteDoc(collectionName, id).catch(err => console.warn('Firestore sync error:', err));
  },

  // Set whole collection
  async setCollection<T = any>(collectionName: string, items: T[]): Promise<void> {
    setCollectionRaw(collectionName, items);
  },

  // Subscribe to changes in a collection
  subscribe<T = any>(collectionName: string, callback: (items: T[]) => void): () => void {
    if (!listeners.has(collectionName)) {
      listeners.set(collectionName, new Set());
    }
    const set = listeners.get(collectionName)!;
    set.add(callback);

    // Immediate initial call
    callback(getCollectionRaw<T>(collectionName));

    return () => {
      set.delete(callback);
    };
  },

  // Subscribe to single document / setting
  subscribeDoc<T = any>(collectionName: string, docId: string, callback: (data: T | null) => void): () => void {
    const key = `${collectionName}/${docId}`;
    if (!docListeners.has(key)) {
      docListeners.set(key, new Set());
    }
    const set = docListeners.get(key)!;
    set.add(callback);

    // Immediate initial call
    callback(getDocRaw<T>(collectionName, docId));

    return () => {
      set.delete(callback);
    };
  },

  // Batch operations
  batch() {
    const ops: Array<() => void> = [];
    const cloudOps: Array<() => Promise<void>> = [];

    return {
      set(collectionName: string, id: string, data: any) {
        ops.push(() => {
          setDocRaw(collectionName, id, data);
        });
        cloudOps.push(async () => {
          await syncSetDoc(collectionName, id, data);
        });
      },
      update(collectionName: string, id: string, updates: any) {
        ops.push(() => {
          const col = getCollectionRaw<any>(collectionName);
          const index = col.findIndex(item => item.id === id);
          if (index >= 0) {
            col[index] = { ...col[index], ...updates };
            setCollectionRaw(collectionName, col);
          }
        });
        cloudOps.push(async () => {
          await syncUpdateDoc(collectionName, id, updates);
        });
      },
      delete(collectionName: string, id: string) {
        ops.push(() => {
          const col = getCollectionRaw<any>(collectionName);
          const filtered = col.filter(item => item.id !== id);
          setCollectionRaw(collectionName, filtered);
        });
        cloudOps.push(async () => {
          await syncDeleteDoc(collectionName, id);
        });
      },
      async commit() {
        ops.forEach(op => op());
        Promise.all(cloudOps.map(op => op().catch(e => console.warn('Cloud batch op notice:', e))));
      }
    };
  },

  // Export all data for backup
  exportAll() {
    const collections = ['inventory', 'transmittals', 'deleted_logs', 'warehouses', 'custodians', 'audit_logs', 'users'];
    const backupData: any = {};

    for (const col of collections) {
      backupData[col] = getCollectionRaw(col);
    }

    const customLogo = localStorage.getItem('madigun_custom_logo');
    backupData['settings'] = customLogo ? [{ id: 'logo', base64: customLogo }] : [];

    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      appName: "Madigun Hotel & Events Storage System",
      data: backupData
    };
  },

  // Import backup data
  async importAll(backupObj: any, wipeFirst: boolean = false) {
    if (!backupObj || !backupObj.data) {
      throw new Error("Invalid backup payload format");
    }

    const collections = ['inventory', 'transmittals', 'deleted_logs', 'warehouses', 'custodians', 'audit_logs', 'users'];

    if (wipeFirst) {
      for (const col of collections) {
        setCollectionRaw(col, []);
      }
    }

    for (const col of collections) {
      const incoming = backupObj.data[col] || [];
      if (wipeFirst) {
        setCollectionRaw(col, incoming);
      } else {
        const existing = getCollectionRaw<any>(col);
        const existingMap = new Map(existing.map(i => [i.id, i]));
        
        for (const item of incoming) {
          existingMap.set(item.id, item);
        }
        setCollectionRaw(col, Array.from(existingMap.values()));
      }
    }

    // Handle logo setting if present
    if (backupObj.data.settings && backupObj.data.settings.length > 0) {
      const logoSetting = backupObj.data.settings.find((s: any) => s.id === 'logo');
      if (logoSetting && logoSetting.base64) {
        localStorage.setItem('madigun_custom_logo', logoSetting.base64);
        window.dispatchEvent(new Event('madigun_logo_updated'));
      }
    }
  },

  // Reset database to initial factory defaults
  resetToDefaults() {
    localStorage.removeItem(INITIALIZED_KEY);
    const collections = ['inventory', 'transmittals', 'deleted_logs', 'warehouses', 'custodians', 'audit_logs', 'users'];
    collections.forEach(col => localStorage.removeItem(getStorageKey(col)));
    initLocalStore();
  }
};
