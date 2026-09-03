import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Package, 
  Send, 
  LayoutDashboard, 
  Database, 
  FileText, 
  Clock, 
  AlertCircle,
  RefreshCw,
  ChevronRight,
  Download,
  Laptop,
  X,
  User,
  Mail,
  Phone,
  Briefcase,
  ShieldCheck,
  Users,
  Cloud,
  HardDrive,
  Zap,
  Menu,
  TrendingUp,
  Building2
} from 'lucide-react';

import { localStore } from './localStore';
import { initFirestoreSync, subscribeFirestoreStatus } from './firebaseSync';
import { initAutoBackupScheduler, subscribeDriveState, isDriveConnected } from './googleDrive';
import { InventoryItem, Transmittal, TransmittalItem, DeletedLog, UserSession, UserProfile } from './types';
import { generateTransmittalNo } from './utils';

// Import our components
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import InventoryList from './components/InventoryList';
import TransmittalList from './components/TransmittalList';
import CreateTransmittal from './components/CreateTransmittal';
import DeletedLogsList from './components/DeletedLogsList';
import CustodianHub from './components/CustodianHub';
import MadigunLogo from './components/MadigunLogo';
import RoomInventories from './components/RoomInventories';
import RevenueDashboard from './components/RevenueDashboard';
import RentalHalls from './components/RentalHalls';
import UserManagement from './components/UserManagement';
import CloudSyncModal from './components/CloudSyncModal';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    const saved = localStorage.getItem('madigun_user_session');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [view, setView] = useState<'dashboard' | 'inventory' | 'transmittals' | 'create-transmittal' | 'deleted-logs' | 'custodian-hub' | 'warehouse' | 'revenue' | 'rental-halls' | 'user-management'>(() => {
    const saved = localStorage.getItem('madigun_user_session');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        if (u && (u.role?.toLowerCase() === 'staff' || u.role?.toLowerCase() === 'front desk')) {
          return 'inventory';
        }
      } catch (e) {}
    }
    return 'dashboard';
  });
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [transmittals, setTransmittals] = useState<Transmittal[]>([]);
  const [deletedLogs, setDeletedLogs] = useState<DeletedLog[]>([]);
  const [pendingUsersCount, setPendingUsersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isFirestoreConnected, setIsFirestoreConnected] = useState(false);
  const [isDriveConnectedState, setIsDriveConnectedState] = useState(isDriveConnected());
  const [isCloudSyncModalOpen, setIsCloudSyncModalOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const handleLogin = (session: UserSession) => {
    setCurrentUser(session);
    localStorage.setItem('madigun_user_session', JSON.stringify(session));
    if (session.role?.toLowerCase() === 'staff' || session.role?.toLowerCase() === 'front desk') {
      setView('inventory');
    } else {
      setView('dashboard');
    }
  };

  // Personal Profile States for Logged In User
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [pFullName, setPFullName] = useState('');
  const [pPhone, setPPhone] = useState('');
  const [pEmail, setPEmail] = useState('');
  const [pDepartment, setPDepartment] = useState('');
  const [pBio, setPBio] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Sync profile fields when modal opens or user changes
  useEffect(() => {
    if (currentUser) {
      setPFullName(currentUser.fullName || '');
      setPPhone(currentUser.phone || '');
      setPEmail(currentUser.email || '');
      setPDepartment(currentUser.department || '');
      setPBio(currentUser.bio || '');
    }
  }, [currentUser, isProfileModalOpen]);

  const handleUpdateOwnProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    try {
      setIsSavingProfile(true);
      const allUsers = localStore.getCollection<UserProfile>('users');
      const targetUser = allUsers.find(u => u.employeeId === currentUser.employeeId);
      
      if (targetUser) {
        const updatedFields = {
          fullName: pFullName.trim(),
          phone: pPhone.trim(),
          email: pEmail.trim(),
          department: pDepartment.trim(),
          bio: pBio.trim()
        };
        await localStore.updateItem('users', targetUser.id, updatedFields);
        
        const updatedSession: UserSession = {
          ...currentUser,
          ...updatedFields
        };
        setCurrentUser(updatedSession);
        localStorage.setItem('madigun_user_session', JSON.stringify(updatedSession));
        setIsProfileModalOpen(false);
        alert('Your personal profile has been updated successfully.');
      } else {
        alert('User profile record not found in database.');
      }
    } catch (err: any) {
      alert('Failed to update profile: ' + err.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Enforce role-based access limits
  const isFrontDesk = currentUser?.role === 'Front Desk' || currentUser?.role?.toLowerCase() === 'staff';
  const isPrimaryRootAdmin = currentUser?.role === 'Admin' || 
                             currentUser?.role === 'Managing Director';

  useEffect(() => {
    if (currentUser && !isPrimaryRootAdmin && view === 'user-management') {
      setView('inventory');
    }
    if (currentUser && isFrontDesk) {
      const allowedViews = ['inventory', 'transmittals', 'create-transmittal', 'rental-halls'];
      if (!allowedViews.includes(view)) {
        setView('inventory');
      }
    }
  }, [currentUser, view, isFrontDesk, isPrimaryRootAdmin]);

  // Keep clock running and monitor offline/online status
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Real-time Listeners and Firestore Sync Initializer
  useEffect(() => {
    setLoading(true);

    // Initialize cloud Firestore real-time listener syncing
    const cleanupFirestoreSync = initFirestoreSync();
    const cleanupFirestoreStatus = subscribeFirestoreStatus((connected) => {
      setIsFirestoreConnected(connected);
    });

    // Initialize Google Drive listeners & Auto-backup scheduler
    const cleanupDriveState = subscribeDriveState((connected) => {
      setIsDriveConnectedState(connected);
    });
    const cleanupAutoBackup = initAutoBackupScheduler();

    // 1. Listen to Inventory
    const unsubscribeInventory = localStore.subscribe<InventoryItem>('inventory', (itemsList) => {
      setInventory(itemsList || []);
      setLoading(false);
    });

    // 2. Listen to Transmittals
    const unsubscribeTransmittals = localStore.subscribe<Transmittal>('transmittals', (transmittalList) => {
      setTransmittals(transmittalList || []);
    });

    // 3. Listen to Deleted Logs
    const unsubscribeDeletedLogs = localStore.subscribe<DeletedLog>('deleted_logs', (logsList) => {
      setDeletedLogs(logsList || []);
    });

    // 4. Listen to Users for Pending Count
    const unsubscribeUsers = localStore.subscribe<any>('users', (usersList) => {
      let pendingCount = 0;
      (usersList || []).forEach((u) => {
        if (u.status === 'Pending' || u.role === 'Pending') {
          pendingCount++;
        }
      });
      setPendingUsersCount(pendingCount);
    });

    return () => {
      if (cleanupFirestoreSync) cleanupFirestoreSync();
      if (cleanupFirestoreStatus) cleanupFirestoreStatus();
      if (cleanupDriveState) cleanupDriveState();
      if (cleanupAutoBackup) cleanupAutoBackup();
      unsubscribeInventory();
      unsubscribeTransmittals();
      unsubscribeDeletedLogs();
      unsubscribeUsers();
    };
  }, []);

  // 1. Add Inventory Item
  const handleAddInventoryItem = async (item: Omit<InventoryItem, 'id' | 'createdAt'>) => {
    await localStore.addItem('inventory', {
      ...item,
      createdAt: new Date().toISOString()
    });
  };

  // 2. Update Inventory Item (e.g. edit details or direct quantities check)
  const handleUpdateInventoryItem = async (id: string, updates: Partial<InventoryItem>) => {
    await localStore.updateItem('inventory', id, updates);
  };

  // 3. Create Transmittal (Checkout)
  const handleCreateTransmittal = async (txData: {
    handler: string;
    rentee: string;
    address: string;
    dateCheckout: string;
    dateCheckin: string;
    items: TransmittalItem[];
    notes: string;
  }) => {
    const batch = localStore.batch();
    const transmittalNo = generateTransmittalNo(transmittals, deletedLogs);

    // Loop through selected transmittal items to adjust inventory quantities
    for (const txItem of txData.items) {
      const originalItem = inventory.find(i => i.id === txItem.itemId);
      if (!originalItem) continue;

      const isNoQty = originalItem.isNoQuantity || originalItem.category === 'Corkage & Service Permits' || originalItem.category === 'Rental Halls & Event Venues';
      const newAvailable = isNoQty ? originalItem.quantityAvailable : originalItem.quantityAvailable - txItem.quantity;
      if (!isNoQty && newAvailable < 0) {
        throw new Error(`Insufficient stock for ${originalItem.name}.`);
      }

      // Compute new status
      let status: 'In Stock' | 'Partially Rented' | 'Out of Stock' = originalItem.status;
      if (!isNoQty) {
        if (newAvailable === 0 && originalItem.quantityTotal > 0) {
          status = 'Out of Stock';
        } else if (newAvailable < originalItem.quantityTotal) {
          status = 'Partially Rented';
        } else {
          status = 'In Stock';
        }
      }

      batch.update('inventory', txItem.itemId, {
        quantityAvailable: newAvailable,
        status
      });
    }

    // Add Transmittal Doc
    const newTxId = `TX-${Date.now()}`;
    batch.set('transmittals', newTxId, {
      id: newTxId,
      transmittalNo,
      handler: txData.handler,
      rentee: txData.rentee,
      address: txData.address,
      dateCheckout: txData.dateCheckout,
      dateCheckin: txData.dateCheckin,
      items: txData.items,
      notes: txData.notes,
      status: 'On Going',
      createdAt: new Date().toISOString()
    });

    await batch.commit();
    setView('transmittals');
  };

  // 3.5. Extend Rental Duration for Venue / Hall Transmittal
  const handleExtendTransmittal = async (
    transmittalId: string,
    additionalHours: number,
    additionalCost: number,
    extensionNote: string
  ) => {
    const tx = transmittals.find(t => t.id === transmittalId);
    if (!tx) return;

    // Calculate new target checkin time by adding additionalHours
    const currentCheckinStr = tx.dateCheckin || tx.dateCheckout;
    const currentCheckinObj = new Date(currentCheckinStr);
    const validCurrentObj = isNaN(currentCheckinObj.getTime()) ? new Date() : currentCheckinObj;
    const newCheckinObj = new Date(validCurrentObj.getTime() + additionalHours * 60 * 60 * 1000);
    const newCheckinStr = newCheckinObj.toISOString().split('T')[0];

    const extensionTimestamp = new Date().toLocaleDateString('en-US', {
      timeZone: 'Asia/Manila',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const extensionLog = `[EXTENDED +${additionalHours} HR(S) on ${extensionTimestamp} | +₱${additionalCost.toLocaleString()}] ${extensionNote}`;
    const updatedNotes = tx.notes ? `${tx.notes}\n${extensionLog}` : extensionLog;

    await localStore.updateItem('transmittals', transmittalId, {
      dateCheckin: newCheckinStr,
      notes: updatedNotes
    });
  };

  // 4. Return Items (Check-in)
  const handleReturnTransmittalItems = async (
    transmittalId: string,
    returns: { itemId: string; quantityToReturn: number }[],
    newStatus: 'Pending' | 'On Going' | 'Partially Returned' | 'Returned'
  ) => {
    const batch = localStore.batch();

    // 1. Update the transmittal object with new returned counts
    const tx = transmittals.find(t => t.id === transmittalId);
    if (!tx) return;

    const updatedTxItems = tx.items.map(item => {
      const returnRecord = returns.find(r => r.itemId === item.itemId);
      const qtyReturnedThisTime = returnRecord ? returnRecord.quantityToReturn : 0;
      return {
        ...item,
        returnedQuantity: item.returnedQuantity + qtyReturnedThisTime
      };
    });

    batch.update('transmittals', transmittalId, {
      items: updatedTxItems,
      status: newStatus
    });

    // 2. Restore available counts in corresponding inventory items
    for (const ret of returns) {
      const originalItem = inventory.find(i => i.id === ret.itemId);
      if (!originalItem) continue;

      const newAvailable = Math.min(originalItem.quantityTotal, originalItem.quantityAvailable + ret.quantityToReturn);
      
      let status: 'In Stock' | 'Partially Rented' | 'Out of Stock' = 'In Stock';
      if (newAvailable === 0 && originalItem.quantityTotal > 0) {
        status = 'Out of Stock';
      } else if (newAvailable < originalItem.quantityTotal) {
        status = 'Partially Rented';
      }

      batch.update('inventory', ret.itemId, {
        quantityAvailable: newAvailable,
        status
      });
    }

    await batch.commit();
  };

  const handleReverseReconciliation = async (transmittalId: string) => {
    const tx = transmittals.find(t => t.id === transmittalId);
    if (!tx) return;

    const batch = localStore.batch();

    // 1. Reset returnedQuantity of all items inside the transmittal to 0 and set status to 'On Going'
    const updatedTxItems = tx.items.map(item => ({
      ...item,
      returnedQuantity: 0
    }));

    batch.update('transmittals', transmittalId, {
      items: updatedTxItems,
      status: 'On Going'
    });

    // 2. Subtract the previously returned quantities from the corresponding inventory items
    for (const item of tx.items) {
      if (item.returnedQuantity <= 0) continue;
      
      const originalItem = inventory.find(i => i.id === item.itemId);
      if (!originalItem) continue;

      const newAvailable = Math.max(0, originalItem.quantityAvailable - item.returnedQuantity);

      let status: 'In Stock' | 'Partially Rented' | 'Out of Stock' = 'In Stock';
      if (newAvailable === 0 && originalItem.quantityTotal > 0) {
        status = 'Out of Stock';
      } else if (newAvailable < originalItem.quantityTotal) {
        status = 'Partially Rented';
      }

      batch.update('inventory', item.itemId, {
        quantityAvailable: newAvailable,
        status
      });
    }

    await batch.commit();
  };

  // 5. Delete Inventory Item (Completely remove asset)
  const handleDeleteInventoryItem = async (id: string) => {
    await localStore.deleteItem('inventory', id);
  };

  // 6. Delete / Void Transmittal (And optionally restore rented quantities to inventory)
  const handleDeleteTransmittal = async (id: string, restoreInventory: boolean = true) => {
    const tx = transmittals.find(t => t.id === id);
    if (!tx) return;

    const batch = localStore.batch();

    if (restoreInventory && tx.status !== 'Returned') {
      // Loop through items and add back outstanding rented units to available counts
      for (const txItem of tx.items) {
        const outstandingQty = txItem.quantity - txItem.returnedQuantity;
        if (outstandingQty <= 0) continue;

        const originalItem = inventory.find(i => i.id === txItem.itemId);
        if (!originalItem) continue;

        const newAvailable = Math.min(originalItem.quantityTotal, originalItem.quantityAvailable + outstandingQty);
        let status: 'In Stock' | 'Partially Rented' | 'Out of Stock' = 'In Stock';
        if (newAvailable === 0 && originalItem.quantityTotal > 0) {
          status = 'Out of Stock';
        } else if (newAvailable < originalItem.quantityTotal) {
          status = 'Partially Rented';
        }

        batch.update('inventory', txItem.itemId, {
          quantityAvailable: newAvailable,
          status
        });
      }
    }

    batch.delete('transmittals', id);

    // Create custom deleted log entry in same batch for atomic reliability
    const logId = `LOG-${Date.now()}`;
    batch.set('deleted_logs', logId, {
      id: logId,
      transmittalNo: tx.transmittalNo,
      rentee: tx.rentee,
      handler: tx.handler,
      deletedAt: new Date().toISOString(),
      originalCreatedAt: tx.createdAt || '',
      statusAtDeletion: tx.status,
      itemsSummary: tx.items.map(item => `${item.quantity}x ${item.name} (${item.sku})`).join(', '),
      itemsCount: tx.items.reduce((acc, item) => acc + item.quantity, 0),
      originalData: {
        id: tx.id,
        transmittalNo: tx.transmittalNo,
        handler: tx.handler,
        rentee: tx.rentee,
        address: tx.address,
        dateCheckout: tx.dateCheckout,
        dateCheckin: tx.dateCheckin,
        items: tx.items,
        status: tx.status,
        notes: tx.notes || '',
        createdAt: tx.createdAt || new Date().toISOString()
      }
    });

    await batch.commit();
  };

  // 7. Restore Transmittal from Deleted Logs
  const handleRestoreTransmittal = async (log: DeletedLog) => {
    if (!log.originalData) {
      throw new Error("This deleted log does not contain the original data snapshot required for restoration.");
    }

    const batch = localStore.batch();
    const tx = log.originalData;

    // Deduct outstanding quantities from inventory again
    if (tx.status !== 'Returned' && tx.items) {
      for (const txItem of tx.items) {
        const outstandingQty = txItem.quantity - txItem.returnedQuantity;
        if (outstandingQty <= 0) continue;

        const originalItem = inventory.find(i => i.id === txItem.itemId);
        if (originalItem) {
          const newAvailable = Math.max(0, originalItem.quantityAvailable - outstandingQty);
          let status: 'In Stock' | 'Partially Rented' | 'Out of Stock' = 'In Stock';
          if (newAvailable === 0 && originalItem.quantityTotal > 0) {
            status = 'Out of Stock';
          } else if (newAvailable < originalItem.quantityTotal) {
            status = 'Partially Rented';
          }

          batch.update('inventory', txItem.itemId, {
            quantityAvailable: newAvailable,
            status
          });
        }
      }
    }

    // Restore transmittal
    batch.set('transmittals', tx.id, {
      id: tx.id,
      transmittalNo: tx.transmittalNo,
      handler: tx.handler,
      rentee: tx.rentee,
      address: tx.address,
      dateCheckout: tx.dateCheckout,
      dateCheckin: tx.dateCheckin,
      items: tx.items,
      status: tx.status,
      notes: tx.notes || '',
      createdAt: tx.createdAt || new Date().toISOString()
    });

    // Delete log entry
    batch.delete('deleted_logs', log.id);

    await batch.commit();
  };

  // 8. Delete / Purge Log Entry Permanently
  const handleDeleteLogEntry = async (logId: string) => {
    await localStore.deleteItem('deleted_logs', logId);
  };

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col font-sans text-zinc-900">
      
      {/* Geometric Balance Top Navigation Bar */}
      <header className="border-b border-zinc-200 bg-white shrink-0 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Logo and Name */}
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <MadigunLogo size="sm" showText={false} />
              <div className="min-w-0">
                <span className="text-[8px] sm:text-[9px] font-bold font-mono text-zinc-400 tracking-widest block uppercase leading-none truncate">
                  HOTEL & EVENTS
                </span>
                <span className="font-black font-display text-zinc-900 tracking-tight text-sm sm:text-base uppercase leading-none mt-1 block truncate">
                  Madigun Rentals
                </span>
              </div>
            </div>

            {/* Actions & Navigation Controls */}
            <div className="flex items-center gap-2 sm:gap-4">
              
              {/* Cloud & Drive Storage Center Button */}
              <button
                id="btn-open-cloud-sync-modal"
                onClick={() => setIsCloudSyncModalOpen(true)}
                className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 transition-colors cursor-pointer text-left"
                title="Open Cloud & Google Drive Storage Center"
              >
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isFirestoreConnected ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${isFirestoreConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                  </span>
                  <div className="hidden xs:flex flex-col">
                    <span className="text-[8px] font-black uppercase tracking-widest text-zinc-800 leading-none">
                      Cloud Sync
                    </span>
                    <span className="text-[7.5px] font-mono text-zinc-500 uppercase tracking-tight mt-0.5 leading-none">
                      {isDriveConnectedState ? 'Drive: Active' : 'Drive: Ready'}
                    </span>
                  </div>
                </div>
              </button>

              {/* Desktop System Live Feed Clock */}
              <div className="hidden lg:flex flex-col items-end text-right">
                <span className="text-[9px] font-bold font-mono text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-zinc-500" />
                  SYSTEM LIVE FEED
                </span>
                <span className="text-xs font-mono text-zinc-600 mt-0.5">
                  {currentTime.toLocaleDateString('en-US', { 
                    timeZone: 'Asia/Manila', 
                    weekday: 'short', 
                    month: 'short', 
                    day: '2-digit', 
                    year: 'numeric' 
                  })} {currentTime.toLocaleTimeString('en-US', { 
                    timeZone: 'Asia/Manila', 
                    hour12: false 
                  })} (GMT+8)
                </span>
              </div>

              {/* Desktop User Info & Profile / Logout */}
              {currentUser && (
                <div className="hidden md:flex items-center gap-3 sm:gap-4 border-l border-zinc-200 pl-3 sm:pl-4">
                  <div className="flex flex-col items-end text-right">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-zinc-900 leading-none max-w-[130px] truncate">
                        {currentUser.fullName || currentUser.username}
                      </span>
                      <span className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 border leading-none ${
                        currentUser.role === 'Admin'
                          ? 'bg-zinc-900 text-white border-zinc-900'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        {currentUser.role}
                      </span>
                    </div>
                    <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mt-1">
                      ID: {currentUser.employeeId || 'N/A'}{currentUser.fullName ? ` • ${currentUser.username}` : ''}
                    </span>
                  </div>
                  
                  {currentUser.employeeId !== 'EMP-2026-001' && (
                    <button
                      id="btn-my-profile"
                      onClick={() => setIsProfileModalOpen(true)}
                      className="inline-flex items-center justify-center px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-zinc-700 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 transition-colors cursor-pointer"
                    >
                      Profile
                    </button>
                  )}

                  <button
                    id="btn-logout"
                    onClick={() => {
                      localStorage.removeItem('madigun_user_session');
                      setCurrentUser(null);
                    }}
                    className="inline-flex items-center justify-center px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer"
                  >
                    Log Out
                  </button>
                </div>
              )}

              {/* Mobile Hamburger Toggle Button */}
              <button
                id="btn-mobile-nav-toggle"
                onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
                className="md:hidden p-2 text-zinc-800 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 transition-colors cursor-pointer flex items-center justify-center"
                aria-label="Toggle navigation menu"
              >
                {isMobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer (Dropdown Overlay) */}
        <AnimatePresence>
          {isMobileNavOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-zinc-200 bg-white shadow-xl overflow-hidden"
            >
              <div className="px-4 py-4 space-y-4 max-h-[80vh] overflow-y-auto">
                {/* Mobile User Profile Section */}
                {currentUser && (
                  <div className="p-3.5 bg-zinc-50 border border-zinc-200 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <span className="text-xs font-black uppercase tracking-wider text-zinc-900 block truncate">
                          {currentUser.fullName || currentUser.username}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500 mt-0.5 block">
                          ID: {currentUser.employeeId || 'N/A'} • @{currentUser.username}
                        </span>
                      </div>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border ${
                        currentUser.role === 'Admin'
                          ? 'bg-zinc-900 text-white border-zinc-900'
                          : 'bg-amber-100 text-amber-900 border-amber-300'
                      }`}>
                        {currentUser.role}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-zinc-200">
                      {currentUser.employeeId !== 'EMP-2026-001' && (
                        <button
                          onClick={() => {
                            setIsProfileModalOpen(true);
                            setIsMobileNavOpen(false);
                          }}
                          className="flex-1 py-1.5 px-2.5 text-[10px] font-bold uppercase tracking-wider text-zinc-800 bg-white border border-zinc-200 hover:bg-zinc-100 transition-colors text-center"
                        >
                          Edit Profile
                        </button>
                      )}
                      <button
                        onClick={() => {
                          localStorage.removeItem('madigun_user_session');
                          setCurrentUser(null);
                        }}
                        className="flex-1 py-1.5 px-2.5 text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors text-center"
                      >
                        Log Out
                      </button>
                    </div>
                  </div>
                )}

                {/* Mobile Navigation Links */}
                <div className="space-y-1">
                  {!isFrontDesk && (
                    <button
                      onClick={() => {
                        setView('dashboard');
                        setIsMobileNavOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors border ${
                        view === 'dashboard'
                          ? 'bg-zinc-900 text-white border-zinc-900'
                          : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      Overview Dashboard
                    </button>
                  )}

                  {!isFrontDesk && (
                    <button
                      onClick={() => {
                        setView('revenue');
                        setIsMobileNavOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors border ${
                        view === 'revenue'
                          ? 'bg-zinc-900 text-white border-zinc-900'
                          : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      <TrendingUp className="h-4 w-4" />
                      Revenue Analytics
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setView('rental-halls');
                      setIsMobileNavOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors border ${
                      view === 'rental-halls'
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                    }`}
                  >
                    <Building2 className="h-4 w-4" />
                    Rental Halls & Event Venues
                  </button>

                  <button
                    onClick={() => {
                      setView('inventory');
                      setIsMobileNavOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors border ${
                      view === 'inventory'
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                    }`}
                  >
                    <Package className="h-4 w-4" />
                    Rental Inventory Items
                  </button>

                  {!isFrontDesk && (
                    <button
                      onClick={() => {
                        setView('warehouse');
                        setIsMobileNavOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors border ${
                        view === 'warehouse'
                          ? 'bg-zinc-900 text-white border-zinc-900'
                          : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      <HardDrive className="h-4 w-4" />
                      Warehouse Locations
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setView('transmittals');
                      setIsMobileNavOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors border ${
                      view === 'transmittals' || view === 'create-transmittal'
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Send className="h-4 w-4" />
                      Transmittals
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-200 text-zinc-800">
                      {transmittals.length}
                    </span>
                  </button>

                  {!isFrontDesk && (
                    <button
                      onClick={() => {
                        setView('custodian-hub');
                        setIsMobileNavOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors border ${
                        view === 'custodian-hub'
                          ? 'bg-zinc-900 text-white border-zinc-900'
                          : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      <Database className="h-4 w-4" />
                      Custodian Hub & System Config
                    </button>
                  )}

                  {isPrimaryRootAdmin && (
                    <button
                      onClick={() => {
                        setView('user-management');
                        setIsMobileNavOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors border ${
                        view === 'user-management'
                          ? 'bg-zinc-900 text-white border-zinc-900'
                          : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Users className="h-4 w-4 text-amber-500" />
                        Personnel & Logo Branding
                      </span>
                      {pendingUsersCount > 0 && (
                        <span className="px-2 py-0.5 text-[9px] font-black bg-amber-400 text-zinc-950 border border-amber-300 font-mono animate-pulse">
                          {pendingUsersCount} PENDING
                        </span>
                      )}
                    </button>
                  )}

                  {!isFrontDesk && (
                    <button
                      onClick={() => {
                        setView('deleted-logs');
                        setIsMobileNavOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors border ${
                        view === 'deleted-logs'
                          ? 'bg-zinc-900 text-white border-zinc-900'
                          : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      <FileText className="h-4 w-4" />
                      Audit Deleted Logs
                    </button>
                  )}
                </div>

                {/* Mobile Manila Clock & Status */}
                <div className="pt-3 border-t border-zinc-200 flex justify-between items-center text-[10px] font-mono text-zinc-500">
                  <span>Manila (GMT+8):</span>
                  <span>
                    {currentTime.toLocaleTimeString('en-US', { 
                      timeZone: 'Asia/Manila', 
                      hour12: false 
                    })}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Horizontal Navigation Tabs (Visible on all screens, smooth scrolling) */}
        <div className="border-t border-zinc-100 bg-white">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
            <div className="overflow-x-auto whitespace-nowrap scrollbar-none w-full">
              <nav className="flex gap-4 sm:gap-6 text-xs font-semibold uppercase tracking-widest text-zinc-400 min-w-max" aria-label="Tabs">
              {!isFrontDesk && (
                <button
                  id="tab-dashboard"
                  onClick={() => setView('dashboard')}
                  className={`pb-3 pt-3 px-1 border-b-2 text-xs font-bold uppercase tracking-widest transition-all cursor-pointer ${
                    view === 'dashboard'
                      ? 'text-zinc-900 border-zinc-900'
                      : 'border-transparent text-zinc-400 hover:text-zinc-900'
                  }`}
                >
                  Overview
                </button>
              )}

              {!isFrontDesk && (
                <button
                  id="tab-revenue"
                  onClick={() => setView('revenue')}
                  className={`pb-3 pt-3 px-1 border-b-2 text-xs font-bold uppercase tracking-widest transition-all cursor-pointer ${
                    view === 'revenue'
                      ? 'text-zinc-900 border-zinc-900'
                      : 'border-transparent text-zinc-400 hover:text-zinc-900'
                  }`}
                >
                  Revenue
                </button>
              )}

              <button
                id="tab-rental-halls"
                onClick={() => setView('rental-halls')}
                className={`pb-3 pt-3 px-1 border-b-2 text-xs font-bold uppercase tracking-widest transition-all cursor-pointer ${
                  view === 'rental-halls'
                    ? 'text-zinc-950 border-zinc-900 font-extrabold'
                    : 'border-transparent text-zinc-400 hover:text-zinc-900'
                }`}
              >
                Rental Halls & Venues
              </button>

              <button
                id="tab-inventory"
                onClick={() => setView('inventory')}
                className={`pb-3 pt-3 px-1 border-b-2 text-xs font-bold uppercase tracking-widest transition-all cursor-pointer ${
                  view === 'inventory'
                    ? 'text-zinc-900 border-zinc-900'
                    : 'border-transparent text-zinc-400 hover:text-zinc-900'
                }`}
              >
                Rental Items
              </button>

              {!isFrontDesk && (
                <button
                  id="tab-warehouse"
                  onClick={() => setView('warehouse')}
                  className={`pb-3 pt-3 px-1 border-b-2 text-xs font-bold uppercase tracking-widest transition-all cursor-pointer ${
                    view === 'warehouse'
                      ? 'text-zinc-900 border-zinc-900'
                      : 'border-transparent text-zinc-400 hover:text-zinc-900'
                  }`}
                >
                  Warehouse Location
                </button>
              )}

              <button
                id="tab-transmittals"
                onClick={() => setView('transmittals')}
                className={`pb-3 pt-3 px-1 border-b-2 text-xs font-bold uppercase tracking-widest transition-all cursor-pointer ${
                  view === 'transmittals' || view === 'create-transmittal'
                    ? 'text-zinc-900 border-zinc-900'
                    : 'border-transparent text-zinc-400 hover:text-zinc-900'
                }`}
              >
                Transmittals
              </button>

              {!isFrontDesk && (
                <button
                  id="tab-deleted-logs"
                  onClick={() => setView('deleted-logs')}
                  className={`pb-3 pt-3 px-1 border-b-2 text-xs font-bold uppercase tracking-widest transition-all cursor-pointer ${
                    view === 'deleted-logs'
                      ? 'text-zinc-900 border-zinc-900'
                      : 'border-transparent text-zinc-400 hover:text-zinc-900'
                  }`}
                >
                  Deleted Logs
                </button>
              )}

              {!isFrontDesk && (
                <button
                  id="tab-custodian-hub"
                  onClick={() => setView('custodian-hub')}
                  className={`pb-3 pt-3 px-1 border-b-2 text-xs font-bold uppercase tracking-widest transition-all cursor-pointer ${
                    view === 'custodian-hub'
                      ? 'text-zinc-900 border-zinc-900'
                      : 'border-transparent text-zinc-400 hover:text-zinc-900'
                  }`}
                >
                  Custodian Hub
                </button>
              )}

              {isPrimaryRootAdmin && (
                <button
                  id="tab-user-management"
                  onClick={() => setView('user-management')}
                  className={`pb-3 pt-3 px-1 border-b-2 text-xs font-bold uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5 ${
                    view === 'user-management'
                      ? 'text-zinc-950 border-zinc-900 font-extrabold'
                      : 'border-transparent text-zinc-400 hover:text-zinc-900'
                  }`}
                >
                  <Users className="h-3.5 w-3.5 text-amber-600" />
                  Accounts
                  {pendingUsersCount > 0 && (
                    <span className="px-1.5 py-0.5 text-[9px] font-black bg-amber-400 text-zinc-950 border border-amber-300 font-mono animate-pulse shrink-0">
                      {pendingUsersCount} PENDING
                    </span>
                  )}
                </button>
              )}
            </nav>
          </div>
        </div>
      </div>
    </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        
        {/* Loading overlay if database is loading */}
        {loading && inventory.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-[50vh]">
            <RefreshCw className="h-8 w-8 text-zinc-900 animate-spin mb-3" />
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Syncing database feed...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {view === 'dashboard' && !isFrontDesk && (
                <Dashboard
                  inventory={inventory}
                  transmittals={transmittals}
                  onCreateTransmittalClick={() => setView('create-transmittal')}
                  onAddInventoryClick={() => setView('inventory')}
                  setView={setView}
                  currentUser={currentUser}
                  onOpenCloudSync={() => setIsCloudSyncModalOpen(true)}
                />
              )}

              {view === 'inventory' && (
                <InventoryList
                  items={inventory}
                  onAddItem={handleAddInventoryItem}
                  onUpdateItem={handleUpdateInventoryItem}
                  onDeleteItem={handleDeleteInventoryItem}
                  currentUser={currentUser}
                  onNewTransmittalClick={() => setView('create-transmittal')}
                />
              )}

              {view === 'warehouse' && !isFrontDesk && (
                <RoomInventories
                  items={inventory}
                  onUpdateItem={handleUpdateInventoryItem}
                  onDeleteItem={handleDeleteInventoryItem}
                  currentUser={currentUser}
                />
              )}

              {view === 'rental-halls' && (
                <RentalHalls
                  inventory={inventory}
                  transmittals={transmittals}
                  currentUser={currentUser}
                  onAddItem={handleAddInventoryItem}
                  onUpdateItem={handleUpdateInventoryItem}
                  onDeleteItem={handleDeleteInventoryItem}
                  onSubmitTransmittal={handleCreateTransmittal}
                  onExtendTransmittal={handleExtendTransmittal}
                  onNavigateToTransmittals={() => setView('transmittals')}
                />
              )}

              {view === 'transmittals' && (
                <TransmittalList
                  transmittals={transmittals}
                  inventory={inventory}
                  onReturnItems={handleReturnTransmittalItems}
                  onDeleteTransmittal={handleDeleteTransmittal}
                  currentUser={currentUser}
                  onReverseReconciliation={handleReverseReconciliation}
                />
              )}

              {view === 'create-transmittal' && (
                <CreateTransmittal
                  inventory={inventory}
                  onSubmit={handleCreateTransmittal}
                  onCancel={() => setView('transmittals')}
                />
              )}

              {view === 'deleted-logs' && !isFrontDesk && (
                <DeletedLogsList
                  logs={deletedLogs}
                  onRestoreTransmittal={handleRestoreTransmittal}
                  onDeleteLog={handleDeleteLogEntry}
                />
              )}

              {view === 'custodian-hub' && !isFrontDesk && (
                <CustodianHub
                  inventory={inventory}
                  currentUser={currentUser}
                />
              )}

              {view === 'revenue' && !isFrontDesk && (
                <RevenueDashboard
                  inventory={inventory}
                  transmittals={transmittals}
                />
              )}

              {view === 'user-management' && isPrimaryRootAdmin && (
                <UserManagement currentUser={currentUser} />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {/* Aesthetic Footer */}
      <footer className="bg-white border-t border-zinc-200 shrink-0 text-[10px] uppercase font-bold tracking-widest text-zinc-400 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-center items-center">
          <span>© 2026 Madigun Hotel & Events. All Rights Reserved.</span>
        </div>
      </footer>

      {/* Personal Profile Modal */}
      <AnimatePresence>
        {isProfileModalOpen && currentUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProfileModalOpen(false)}
              className="absolute inset-0 bg-zinc-950/40 backdrop-blur-xs"
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-white w-full max-w-md border border-zinc-200 overflow-hidden flex flex-col relative z-10"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-zinc-900" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900">Personal Profile</h3>
                </div>
                <button
                  id="btn-close-profile-modal"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="p-1 hover:bg-zinc-200/60 rounded-full transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4 text-zinc-500" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleUpdateOwnProfile} className="p-6 space-y-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                      Personnel Username
                    </label>
                    <input
                      type="text"
                      disabled
                      value={currentUser.username}
                      className="w-full px-3 py-2 border border-zinc-200 text-xs font-semibold uppercase tracking-wider bg-zinc-100 text-zinc-400 cursor-not-allowed"
                    />
                    <p className="text-[8px] text-zinc-400 uppercase font-bold tracking-wider mt-1">
                      System username cannot be modified.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                      Full Legal Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400 animate-none" />
                      <input
                        type="text"
                        required
                        value={pFullName}
                        onChange={(e) => setPFullName(e.target.value)}
                        placeholder="e.g. MARC ALEXANDER"
                        className="w-full pl-9 pr-3 py-2 border border-zinc-200 text-xs font-semibold uppercase tracking-wider bg-zinc-50 focus:bg-white focus:outline-none focus:border-zinc-900 text-zinc-850"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                        Contact Number
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                        <input
                          type="tel"
                          value={pPhone}
                          onChange={(e) => setPPhone(e.target.value)}
                          placeholder="+63 9xx"
                          className="w-full pl-9 pr-3 py-2 border border-zinc-200 text-xs font-semibold uppercase tracking-wider bg-zinc-50 focus:bg-white focus:outline-none focus:border-zinc-900 text-zinc-850"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                        Department
                      </label>
                      <div className="relative">
                        <Briefcase className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                        <input
                          type="text"
                          value={pDepartment}
                          onChange={(e) => setPDepartment(e.target.value)}
                          placeholder="e.g. FRONT DESK"
                          className="w-full pl-9 pr-3 py-2 border border-zinc-200 text-xs font-semibold uppercase tracking-wider bg-zinc-50 focus:bg-white focus:outline-none focus:border-zinc-900 text-zinc-850"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                      <input
                        type="email"
                        value={pEmail}
                        onChange={(e) => setPEmail(e.target.value)}
                        placeholder="marc@madigunhotel.com"
                        className="w-full pl-9 pr-3 py-2 border border-zinc-200 text-xs font-semibold uppercase tracking-wider bg-zinc-50 focus:bg-white focus:outline-none focus:border-zinc-900 text-zinc-850"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                      Short Biography / Notes
                    </label>
                    <textarea
                      value={pBio}
                      onChange={(e) => setPBio(e.target.value)}
                      placeholder="Brief notes about your role or schedules..."
                      rows={3}
                      className="w-full px-3 py-2 border border-zinc-200 text-xs font-semibold bg-zinc-50 focus:bg-white focus:outline-none focus:border-zinc-900 text-zinc-850 resize-none uppercase tracking-wider"
                    />
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="pt-4 border-t border-zinc-150 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsProfileModalOpen(false)}
                    className="flex-1 py-2.5 border border-zinc-200 text-zinc-500 hover:bg-zinc-50 text-[10px] font-bold uppercase tracking-widest transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-850 disabled:bg-zinc-400 text-white text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isSavingProfile && <RefreshCw className="h-3 w-3 animate-spin" />}
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cloud & Google Drive Storage Center Modal */}
      <CloudSyncModal
        isOpen={isCloudSyncModalOpen}
        onClose={() => setIsCloudSyncModalOpen(false)}
        currentUser={currentUser}
      />

    </div>
  );
}
