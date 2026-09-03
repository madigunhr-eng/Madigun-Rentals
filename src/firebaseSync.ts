import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  writeBatch, 
  getDocs,
  getDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { localStore } from './localStore';

const COLLECTIONS = [
  'inventory',
  'transmittals',
  'deleted_logs',
  'warehouses',
  'custodians',
  'audit_logs',
  'users'
];

let isSyncingFromFirestore = false;
let isConnectedToFirestore = false;
const connectionListeners = new Set<(connected: boolean) => void>();

export function isFirestoreOnline(): boolean {
  return isConnectedToFirestore;
}

export function subscribeFirestoreStatus(callback: (connected: boolean) => void): () => void {
  connectionListeners.add(callback);
  callback(isConnectedToFirestore);
  return () => connectionListeners.delete(callback);
}

function notifyStatus(connected: boolean) {
  isConnectedToFirestore = connected;
  connectionListeners.forEach(cb => cb(connected));
}

/**
 * Initialize real-time listeners on all Firestore collections.
 * Automatically mirrors remote Firestore data into local store and reactive UI.
 */
export function initFirestoreSync(): () => void {
  if (typeof window === 'undefined') return () => {};

  const unsubs: (() => void)[] = [];

  COLLECTIONS.forEach(colName => {
    try {
      const colRef = collection(db, colName);
      const unsub = onSnapshot(colRef, (snapshot) => {
        notifyStatus(true);
        if (snapshot.empty) {
          isSyncingFromFirestore = true;
          try {
            if (colName === 'users') {
              const localUsers = localStore.getCollection('users');
              if (localUsers.length > 0) {
                const batch = writeBatch(db);
                localUsers.forEach((u: any) => {
                  if (u && u.id) {
                    const { id, ...data } = u;
                    batch.set(doc(db, 'users', id), data, { merge: true });
                  }
                });
                batch.commit().catch(e => console.warn('Users sync error:', e));
              }
            } else {
              localStore.setCollection(colName, []);
            }
          } finally {
            setTimeout(() => {
              isSyncingFromFirestore = false;
            }, 50);
          }
          return;
        }

        const items: any[] = [];
        snapshot.forEach(docSnap => {
          items.push({ id: docSnap.id, ...docSnap.data() });
        });

        isSyncingFromFirestore = true;
        try {
          localStore.setCollection(colName, items);
        } finally {
          setTimeout(() => {
            isSyncingFromFirestore = false;
          }, 50);
        }
      }, (err) => {
        console.warn(`Firestore listener notice for [${colName}]:`, err.message);
        notifyStatus(false);
      });
      unsubs.push(unsub);
    } catch (err: any) {
      console.warn(`Failed to attach Firestore listener on ${colName}:`, err.message);
    }
  });

  // Also listen for settings/logo (Official System Logo embedded permanently in Firestore)
  try {
    const logoDocRef = doc(db, 'settings', 'logo');
    const unsubLogo = onSnapshot(logoDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && data.base64) {
          localStorage.setItem('madigun_custom_logo', data.base64);
          window.dispatchEvent(new Event('madigun_logo_updated'));
        }
      } else {
        // If Firestore doesn't have the logo yet, but localStorage already has one saved,
        // automatically push and embed it permanently in the Cloud database!
        const existingLocal = localStorage.getItem('madigun_custom_logo');
        if (existingLocal && existingLocal.startsWith('data:image')) {
          setDoc(logoDocRef, {
            id: 'logo',
            base64: existingLocal,
            updatedAt: new Date().toISOString(),
            isPermanentOfficialLogo: true
          }, { merge: true }).catch(err => {
            console.warn("Notice: Auto-embed local logo to Firestore deferred:", err.message);
          });
        }
      }
    }, (err) => {
      console.warn("Firestore logo sync notice:", err.message);
    });
    unsubs.push(unsubLogo);
  } catch (err) {
    // Ignore
  }

  return () => {
    unsubs.forEach(fn => {
      try {
        fn();
      } catch (e) {}
    });
  };
}

/**
 * Embeds and permanently saves the system brand logo into Cloud Firestore database ('settings/logo').
 * Propagates in real-time to all connected devices, sessions, and local storage caches.
 */
export async function syncSetSystemLogo(base64: string | null): Promise<boolean> {
  const logoDocRef = doc(db, 'settings', 'logo');
  if (base64) {
    await setDoc(logoDocRef, {
      id: 'logo',
      base64: base64,
      updatedAt: new Date().toISOString(),
      isPermanentOfficialLogo: true
    }, { merge: true });
    localStorage.setItem('madigun_custom_logo', base64);
  } else {
    await deleteDoc(logoDocRef);
    localStorage.removeItem('madigun_custom_logo');
  }
  window.dispatchEvent(new Event('madigun_logo_updated'));
  return true;
}

/**
 * Directly queries Firestore for the official system logo immediately.
 */
export async function fetchSystemLogoFromFirestore(): Promise<string | null> {
  try {
    const logoDocRef = doc(db, 'settings', 'logo');
    const snap = await getDoc(logoDocRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data && data.base64) {
        localStorage.setItem('madigun_custom_logo', data.base64);
        window.dispatchEvent(new Event('madigun_logo_updated'));
        return data.base64;
      }
    }
  } catch (err: any) {
    console.warn("Could not query logo from Firestore:", err.message);
  }
  return localStorage.getItem('madigun_custom_logo');
}

/**
 * Push an item write to Firestore
 */
export async function syncSetDoc(colName: string, id: string, data: any) {
  if (isSyncingFromFirestore) return;
  try {
    const docRef = doc(db, colName, id);
    await setDoc(docRef, data, { merge: true });
    notifyStatus(true);
  } catch (err: any) {
    console.warn(`Firestore sync write error for ${colName}/${id}:`, err.message);
  }
}

/**
 * Push an update to Firestore
 */
export async function syncUpdateDoc(colName: string, id: string, updates: any) {
  if (isSyncingFromFirestore) return;
  try {
    const docRef = doc(db, colName, id);
    await updateDoc(docRef, updates);
    notifyStatus(true);
  } catch (err: any) {
    console.warn(`Firestore sync update error for ${colName}/${id}:`, err.message);
  }
}

/**
 * Push a delete to Firestore
 */
export async function syncDeleteDoc(colName: string, id: string) {
  if (isSyncingFromFirestore) return;
  try {
    const docRef = doc(db, colName, id);
    await deleteDoc(docRef);
    notifyStatus(true);
  } catch (err: any) {
    console.warn(`Firestore sync delete error for ${colName}/${id}:`, err.message);
  }
}

/**
 * Bulk restore backup data directly to Firestore in batches
 */
export async function restoreBackupToFirestore(
  backupObj: any,
  wipeFirst: boolean = false,
  onProgress?: (status: string, percent: number) => void
) {
  if (!backupObj || !backupObj.data) {
    throw new Error('Invalid backup file structure.');
  }

  const collections = [
    'inventory',
    'transmittals',
    'deleted_logs',
    'warehouses',
    'custodians',
    'audit_logs',
    'users'
  ];

  let totalSteps = collections.length * (wipeFirst ? 2 : 1);
  let currentStep = 0;

  // 1. Wipe collections if requested
  if (wipeFirst) {
    for (const colName of collections) {
      onProgress?.(`Wiping cloud '${colName}' collection...`, Math.round((currentStep / totalSteps) * 100));
      try {
        const querySnapshot = await getDocs(collection(db, colName));
        let batch = writeBatch(db);
        let count = 0;
        for (const docSnap of querySnapshot.docs) {
          batch.delete(docSnap.ref);
          count++;
          if (count === 400) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }
        if (count > 0) {
          await batch.commit();
        }
      } catch (err: any) {
        console.warn(`Wipe notice for ${colName}:`, err.message);
      }
      currentStep++;
    }
  }

  // 2. Import items into Firestore
  for (const colName of collections) {
    const items = backupObj.data[colName] || [];
    onProgress?.(`Uploading ${items.length} records to '${colName}'...`, Math.round((currentStep / totalSteps) * 100));

    if (items.length > 0) {
      let batch = writeBatch(db);
      let count = 0;

      for (const item of items) {
        const { id, ...data } = item;
        const targetId = id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const docRef = doc(db, colName, targetId);
        
        batch.set(docRef, { ...data, id: targetId }, { merge: true });
        count++;

        if (count === 400) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }

      if (count > 0) {
        await batch.commit();
      }
    }

    currentStep++;
  }

  // 3. Handle custom logo
  if (backupObj.data.settings && backupObj.data.settings.length > 0) {
    const logoSetting = backupObj.data.settings.find((s: any) => s.id === 'logo');
    if (logoSetting && logoSetting.base64) {
      try {
        await setDoc(doc(db, 'settings', 'logo'), {
          base64: logoSetting.base64,
          updatedAt: new Date().toISOString()
        });
        localStorage.setItem('madigun_custom_logo', logoSetting.base64);
        window.dispatchEvent(new Event('madigun_logo_updated'));
      } catch (err) {
        // Ignore
      }
    }
  }

  // Also update local store with the new data
  await localStore.importAll(backupObj, wipeFirst);

  onProgress?.('Cloud database and local storage successfully restored!', 100);
}
