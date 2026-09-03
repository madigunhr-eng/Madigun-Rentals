import { initializeApp } from 'firebase/app';
import { initializeFirestore, memoryLocalCache, doc, getDocFromServer } from 'firebase/firestore';
import config from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp({
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId
});

const firestoreDbId = (config as any).firestoreDatabaseId || 'ai-studio-madigunrentals-25b80405-bd8e-4331-a790-adda554e8aef';

// Initialize Firestore with memory local cache to prevent slow IndexedDB lock-acquisition timeouts 
// in sandboxed iframes (like AI Studio previews).
const db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
  experimentalAutoDetectLongPolling: true
}, firestoreDbId);

// Validate connection to Firestore as per skill guidelines
async function testConnection() {
  try {
    await getDocFromServer(doc(db, '_connection_check_', 'ping'));
  } catch (error: any) {
    if (error instanceof Error && (error.message.includes('offline') || error.message.includes('unavailable'))) {
      console.warn("Firestore connection notice (operating in offline fallback mode):", error.message);
    }
  }
}
testConnection();

export { app, db };
