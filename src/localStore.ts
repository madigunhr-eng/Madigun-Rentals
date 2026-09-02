import { InventoryItem, Transmittal, DeletedLog, Custodian, AuditLog, UserProfile, Warehouse } from './types';

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

// Initial Seed Data
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
    bio: 'Managing Director oversee of hotel inventory, banquet transmittals and revenue operations.',
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

const DEFAULT_WAREHOUSES: Warehouse[] = [
  {
    id: 'WH-001',
    name: 'Main Central Logistics Warehouse',
    createdAt: new Date().toISOString()
  },
  {
    id: 'WH-002',
    name: 'Banquet & Events Staging Depot',
    createdAt: new Date().toISOString()
  },
  {
    id: 'WH-003',
    name: 'Audio Visual & Tech Storage Hub',
    createdAt: new Date().toISOString()
  },
  {
    id: 'WH-004',
    name: 'Kitchen & Catering Fixtures Staging',
    createdAt: new Date().toISOString()
  }
];

const DEFAULT_CUSTODIANS: Custodian[] = [
  {
    id: 'CUST-001',
    name: 'Ricardo Santos',
    employeeId: 'EMP-2026-004',
    role: 'Head of Equipment Logistics',
    contact: '+63 917 888 1122',
    status: 'Active',
    createdAt: new Date().toISOString()
  },
  {
    id: 'CUST-002',
    name: 'Maria Elena Torres',
    employeeId: 'EMP-2026-005',
    role: 'Banquet Operations Custodian',
    contact: '+63 918 777 3344',
    status: 'Active',
    createdAt: new Date().toISOString()
  },
  {
    id: 'CUST-003',
    name: 'Juan Carlos Dela Cruz',
    employeeId: 'EMP-2026-006',
    role: 'Audio-Visual Lead Technician',
    contact: '+63 920 555 6677',
    status: 'Active',
    createdAt: new Date().toISOString()
  }
];

const DEFAULT_INVENTORY: InventoryItem[] = [
  // Rental Halls & Event Venues
  {
    id: 'INV-HALL-001',
    name: 'Grand Imperial Ballroom',
    sku: 'VEN-GB01',
    category: 'Rental Halls & Event Venues',
    quantityTotal: 1,
    quantityAvailable: 1,
    status: 'In Stock',
    location: 'Level 2 - Grand Event Wing',
    rentalPrice: 25000,
    price: 25000,
    isHourlyCharged: true,
    isNoQuantity: true,
    chargeType: 'Hourly',
    warehouseId: 'WH-002',
    createdAt: new Date().toISOString()
  },
  {
    id: 'INV-HALL-002',
    name: 'Crystal Poolside Function Hall',
    sku: 'VEN-CH02',
    category: 'Rental Halls & Event Venues',
    quantityTotal: 1,
    quantityAvailable: 1,
    status: 'In Stock',
    location: 'Level 1 - Poolside Garden Terrace',
    rentalPrice: 15000,
    price: 15000,
    isHourlyCharged: true,
    isNoQuantity: true,
    chargeType: 'Hourly',
    warehouseId: 'WH-002',
    createdAt: new Date().toISOString()
  },
  {
    id: 'INV-HALL-003',
    name: 'Executive Boardroom & Conference Suite',
    sku: 'VEN-EB03',
    category: 'Rental Halls & Event Venues',
    quantityTotal: 1,
    quantityAvailable: 1,
    status: 'In Stock',
    location: 'Level 3 - Business Center',
    rentalPrice: 5000,
    price: 5000,
    isHourlyCharged: true,
    isNoQuantity: true,
    chargeType: 'Hourly',
    warehouseId: 'WH-003',
    createdAt: new Date().toISOString()
  },
  {
    id: 'INV-HALL-004',
    name: 'Outdoor Garden Pavilion & Lawn',
    sku: 'VEN-GP04',
    category: 'Rental Halls & Event Venues',
    quantityTotal: 1,
    quantityAvailable: 1,
    status: 'In Stock',
    location: 'Grounds - South Floral Garden',
    rentalPrice: 12000,
    price: 12000,
    isHourlyCharged: true,
    isNoQuantity: true,
    chargeType: 'Hourly',
    warehouseId: 'WH-002',
    createdAt: new Date().toISOString()
  },

  // Corkage & Service Permits
  {
    id: 'INV-CRK-001',
    name: 'Hard Liquor / Spirits Corkage Fee',
    sku: 'CRK-HQ01',
    category: 'Corkage & Service Permits',
    quantityTotal: 999,
    quantityAvailable: 999,
    status: 'In Stock',
    location: 'Front Desk / Banquet Bar',
    price: 1500,
    rentalPrice: 1500,
    isNoQuantity: true,
    chargeType: 'Flat Fee',
    createdAt: new Date().toISOString()
  },
  {
    id: 'INV-CRK-002',
    name: 'Wine & Champagne Corkage Fee',
    sku: 'CRK-WN02',
    category: 'Corkage & Service Permits',
    quantityTotal: 999,
    quantityAvailable: 999,
    status: 'In Stock',
    location: 'Front Desk / Banquet Bar',
    price: 800,
    rentalPrice: 800,
    isNoQuantity: true,
    chargeType: 'Flat Fee',
    createdAt: new Date().toISOString()
  },
  {
    id: 'INV-CRK-003',
    name: 'Outside Catering Utility & Power Service Permit',
    sku: 'CRK-OC03',
    category: 'Corkage & Service Permits',
    quantityTotal: 999,
    quantityAvailable: 999,
    status: 'In Stock',
    location: 'Banquet Kitchen Dock',
    price: 5000,
    rentalPrice: 5000,
    isNoQuantity: true,
    chargeType: 'Flat Fee',
    createdAt: new Date().toISOString()
  },
  {
    id: 'INV-CRK-004',
    name: 'Mobile Cocktail Bar Staging Fee',
    sku: 'CRK-MB04',
    category: 'Corkage & Service Permits',
    quantityTotal: 999,
    quantityAvailable: 999,
    status: 'In Stock',
    location: 'Event Foyer / Poolside',
    price: 3500,
    rentalPrice: 3500,
    isNoQuantity: true,
    chargeType: 'Flat Fee',
    createdAt: new Date().toISOString()
  },

  // Audio & Visual Systems
  {
    id: 'INV-AV-001',
    name: 'Line Array Active Sound System 5000W',
    sku: 'AV-LA01',
    category: 'Audio',
    quantityTotal: 4,
    quantityAvailable: 4,
    status: 'In Stock',
    location: 'WH-003 Section A-1',
    price: 45000,
    rentalPrice: 8500,
    warehouseId: 'WH-003',
    createdAt: new Date().toISOString()
  },
  {
    id: 'INV-AV-002',
    name: 'Wireless UHF Quad Microphone Set',
    sku: 'AV-WM02',
    category: 'Audio',
    quantityTotal: 8,
    quantityAvailable: 8,
    status: 'In Stock',
    location: 'WH-003 Section A-2',
    price: 18000,
    rentalPrice: 2500,
    warehouseId: 'WH-003',
    createdAt: new Date().toISOString()
  },
  {
    id: 'INV-AV-003',
    name: '4K Laser Projector 8000 Lumens',
    sku: 'AV-LP03',
    category: 'Lighting',
    quantityTotal: 5,
    quantityAvailable: 5,
    status: 'In Stock',
    location: 'WH-003 Section B-1',
    price: 65000,
    rentalPrice: 6000,
    warehouseId: 'WH-003',
    createdAt: new Date().toISOString()
  },
  {
    id: 'INV-AV-004',
    name: 'Motorized 150-inch Fast-Fold Screen',
    sku: 'AV-PS04',
    category: 'Accessories',
    quantityTotal: 6,
    quantityAvailable: 6,
    status: 'In Stock',
    location: 'WH-003 Section B-2',
    price: 22000,
    rentalPrice: 2000,
    warehouseId: 'WH-003',
    createdAt: new Date().toISOString()
  },

  // Furniture & Banqueting
  {
    id: 'INV-FUR-001',
    name: '60-inch Round Banquet Tables (10-Seater)',
    sku: 'FUR-BT01',
    category: 'Accessories',
    quantityTotal: 60,
    quantityAvailable: 60,
    status: 'In Stock',
    location: 'WH-002 Staging Bay 1',
    price: 4500,
    rentalPrice: 350,
    warehouseId: 'WH-002',
    createdAt: new Date().toISOString()
  },
  {
    id: 'INV-FUR-002',
    name: 'Chiavari Tiffany Gold Event Chairs',
    sku: 'FUR-CC02',
    category: 'Accessories',
    quantityTotal: 400,
    quantityAvailable: 400,
    status: 'In Stock',
    location: 'WH-002 Staging Bay 2',
    price: 1800,
    rentalPrice: 75,
    warehouseId: 'WH-002',
    createdAt: new Date().toISOString()
  },
  {
    id: 'INV-FUR-003',
    name: 'Cocktail High-Boy Standing Bar Tables',
    sku: 'FUR-CT03',
    category: 'Accessories',
    quantityTotal: 30,
    quantityAvailable: 30,
    status: 'In Stock',
    location: 'WH-002 Staging Bay 3',
    price: 2500,
    rentalPrice: 250,
    warehouseId: 'WH-002',
    createdAt: new Date().toISOString()
  },

  // Catering & Buffet Fixtures
  {
    id: 'INV-CAT-001',
    name: 'Roll-Top Stainless Steel Chafing Dish 9L',
    sku: 'CAT-CD01',
    category: 'Accessories',
    quantityTotal: 40,
    quantityAvailable: 40,
    status: 'In Stock',
    location: 'WH-004 Rack 1',
    price: 3200,
    rentalPrice: 400,
    warehouseId: 'WH-004',
    createdAt: new Date().toISOString()
  },
  {
    id: 'INV-CAT-002',
    name: 'Commercial 100-Cup Electric Coffee Urn',
    sku: 'CAT-CU02',
    category: 'Accessories',
    quantityTotal: 8,
    quantityAvailable: 8,
    status: 'In Stock',
    location: 'WH-004 Rack 2',
    price: 7500,
    rentalPrice: 850,
    warehouseId: 'WH-004',
    createdAt: new Date().toISOString()
  },
  {
    id: 'INV-CAT-003',
    name: '4-Tier Commercial Chocolate Fondue Fountain',
    sku: 'CAT-CF03',
    category: 'Accessories',
    quantityTotal: 4,
    quantityAvailable: 4,
    status: 'In Stock',
    location: 'WH-004 Rack 3',
    price: 16500,
    rentalPrice: 2500,
    warehouseId: 'WH-004',
    createdAt: new Date().toISOString()
  }
];

const DEFAULT_TRANSMITTALS: Transmittal[] = [
  {
    id: 'TX-SAMPLE-001',
    transmittalNo: 'TX-2026-0825-01',
    handler: 'Ricardo Santos',
    rentee: 'Ayala Land Corporate Summit (c/o Ms. Karen Santos)',
    address: 'Grand Imperial Ballroom, Madigun Hotel',
    dateCheckout: '2026-08-25T09:00:00.000Z',
    dateCheckin: '2026-08-25T18:00:00.000Z',
    status: 'On Going',
    notes: 'HOURLY HALL RENTAL (9 Hours: 09:00 AM to 06:00 PM on 2026-08-25). 150 guests corporate conference.',
    items: [
      {
        itemId: 'INV-HALL-001',
        name: 'Grand Imperial Ballroom (9 hrs @ ₱25,000/hr: 09:00 AM - 06:00 PM)',
        sku: 'VEN-GB01',
        quantity: 1,
        returnedQuantity: 0
      },
      {
        itemId: 'INV-AV-001',
        name: 'Line Array Active Sound System 5000W',
        sku: 'AV-LA01',
        quantity: 1,
        returnedQuantity: 0
      },
      {
        itemId: 'INV-AV-002',
        name: 'Wireless UHF Quad Microphone Set',
        sku: 'AV-WM02',
        quantity: 2,
        returnedQuantity: 0
      }
    ],
    custodianSigned: true,
    custodianSignedBy: 'Ricardo Santos',
    custodianSignedAt: '2026-08-25',
    createdAt: '2026-08-25T08:30:00.000Z'
  }
];

// Initialize storage with defaults if not present or recover if empty
export function initLocalStore(): void {
  if (typeof window === 'undefined') return;

  const currentUsers = getCollectionRaw<UserProfile>('users');
  if (currentUsers.length === 0) {
    setCollectionRaw('users', DEFAULT_USERS);
  } else {
    const hasAdmin = currentUsers.some(u => u.employeeId === 'EMP-2026-001' || u.username.toUpperCase() === 'ADMIN');
    if (!hasAdmin) {
      currentUsers.unshift(DEFAULT_USERS[0]);
      setCollectionRaw('users', currentUsers);
    }
  }

  const currentWarehouses = getCollectionRaw<Warehouse>('warehouses');
  if (currentWarehouses.length === 0) {
    setCollectionRaw('warehouses', DEFAULT_WAREHOUSES);
  } else {
    // Strip description if present
    const cleaned = currentWarehouses.map(w => {
      const { description, ...rest } = w;
      return rest;
    });
    setCollectionRaw('warehouses', cleaned);
  }

  const currentCustodians = getCollectionRaw<Custodian>('custodians');
  if (currentCustodians.length === 0) {
    setCollectionRaw('custodians', DEFAULT_CUSTODIANS);
  }

  const currentInventory = getCollectionRaw<InventoryItem>('inventory');
  if (currentInventory.length === 0) {
    setCollectionRaw('inventory', DEFAULT_INVENTORY);
  } else {
    // Strip description if present
    const cleaned = currentInventory.map(i => {
      const { description, ...rest } = i;
      return rest;
    });
    setCollectionRaw('inventory', cleaned);
  }

  const currentTransmittals = getCollectionRaw<Transmittal>('transmittals');
  if (currentTransmittals.length === 0) {
    setCollectionRaw('transmittals', DEFAULT_TRANSMITTALS);
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
  setCollectionRaw('users', DEFAULT_USERS);
  setCollectionRaw('warehouses', DEFAULT_WAREHOUSES);
  setCollectionRaw('custodians', DEFAULT_CUSTODIANS);
  setCollectionRaw('inventory', DEFAULT_INVENTORY);
  setCollectionRaw('transmittals', DEFAULT_TRANSMITTALS);
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
