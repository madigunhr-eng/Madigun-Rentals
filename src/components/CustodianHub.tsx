import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  UserCheck, 
  UserPlus, 
  ShieldAlert, 
  History, 
  CheckCircle, 
  AlertTriangle, 
  RotateCcw, 
  Plus, 
  Trash2, 
  FileSpreadsheet, 
  Briefcase, 
  Phone, 
  ClipboardCheck, 
  Tag, 
  Package,
  MapPin,
  Download,
  Upload,
  Database,
  RefreshCw,
  FileJson,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { localStore } from '../localStore';
import { InventoryItem, Custodian, AuditLog, UserSession } from '../types';
import { restoreBackupToFirestore } from '../firebaseSync';

interface CustodianHubProps {
  inventory: InventoryItem[];
  currentUser: UserSession | null;
}

export default function CustodianHub({ inventory, currentUser }: CustodianHubProps) {
  const [activeTab, setActiveTab] = useState<'audit' | 'custodians' | 'history' | 'assignments' | 'backup' | 'staff'>('audit');
  
  // Backup & Restore States
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [loadedBackup, setLoadedBackup] = useState<any>(null);
  const [dragOver, setDragOver] = useState(false);
  const [backupConfirm, setBackupConfirm] = useState<{
    isOpen: boolean;
    wipeFirst: boolean;
    title: string;
    message: string;
  }>({
    isOpen: false,
    wipeFirst: false,
    title: '',
    message: ''
  });

  const [stats, setStats] = useState({
    inventory: 0,
    transmittals: 0,
    deleted_logs: 0,
    rooms: 0,
    custodians: 0,
    audit_logs: 0
  });
  const [loadingStats, setLoadingStats] = useState(false);
  
  // Real-time states
  const [custodians, setCustodians] = useState<Custodian[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingCustodians, setLoadingCustodians] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // Staff registry real-time states
  const [registeredUsers, setRegisteredUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Form States - Register User
  const [regName, setRegName] = useState('');
  const [regEmpId, setRegEmpId] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<'Admin' | 'Front Desk'>('Front Desk');
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  // Branding Logo Upload States
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [logoSuccess, setLogoSuccess] = useState('');
  const [currentCustomLogo, setCurrentCustomLogo] = useState<string | null>(() => localStorage.getItem('madigun_custom_logo'));

  useEffect(() => {
    const handleUpdate = () => {
      setCurrentCustomLogo(localStorage.getItem('madigun_custom_logo'));
    };
    window.addEventListener('madigun_logo_updated', handleUpdate);
    return () => {
      window.removeEventListener('madigun_logo_updated', handleUpdate);
    };
  }, []);

  // Form States - Add Custodian
  const [newCustName, setNewCustName] = useState('');
  const [newCustEmpId, setNewCustEmpId] = useState('');
  const [newCustRole, setNewCustRole] = useState('Property Custodian');
  const [newCustContact, setNewCustContact] = useState('');
  const [custodianError, setCustodianError] = useState('');
  const [custodianSuccess, setCustodianSuccess] = useState('');
  const [isAddingCustodian, setIsAddingCustodian] = useState(false);

  // Form States - Physical Audit
  const [selectedItemId, setSelectedItemId] = useState('');
  const [countedQty, setCountedQty] = useState<number>(0);
  const [auditorName, setAuditorName] = useState('');
  const [auditNotes, setAuditNotes] = useState('');
  const [auditError, setAuditError] = useState('');
  const [auditSuccess, setAuditSuccess] = useState('');
  const [isSubmittingAudit, setIsSubmittingAudit] = useState(false);

  // Deletion State
  const [custodianToDelete, setCustodianToDelete] = useState<{ id: string; name: string } | null>(null);
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string; employeeId: string } | null>(null);

  // Listeners for Custodians, Audit Logs, and Registered Staff Users
  useEffect(() => {
    // Listen to Custodians
    const unsubscribeCustodians = localStore.subscribe<Custodian>('custodians', (list) => {
      setCustodians(list || []);
      setLoadingCustodians(false);
    });

    // Listen to Audit Logs
    const unsubscribeLogs = localStore.subscribe<AuditLog>('audit_logs', (list) => {
      setAuditLogs(list || []);
      setLoadingLogs(false);
    });

    // Listen to Registered Users
    const unsubscribeUsers = localStore.subscribe<any>('users', (list) => {
      setRegisteredUsers(list || []);
      setLoadingUsers(false);
    });

    return () => {
      unsubscribeCustodians();
      unsubscribeLogs();
      unsubscribeUsers();
    };
  }, []);

  // Fetch real-time count stats for backup
  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const collections = ['inventory', 'transmittals', 'deleted_logs', 'rooms', 'custodians', 'audit_logs', 'users', 'warehouses'];
      const counts: any = {};
      for (const col of collections) {
        counts[col] = localStore.getCollection(col).length;
      }
      setStats(counts);
    } catch (err) {
      console.error("Failed to fetch collections sizes:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'backup') {
      fetchStats();
    }
  }, [activeTab]);

  // Export all system records as JSON backup file
  const handleExportBackup = async () => {
    setIsExporting(true);
    setExportError('');
    try {
      const collections = ['inventory', 'transmittals', 'deleted_logs', 'rooms', 'custodians', 'audit_logs', 'users', 'warehouses'];
      const backupData: any = {};

      for (const col of collections) {
        backupData[col] = localStore.getCollection(col);
      }

      const backupObj = {
        version: 1,
        exportedAt: new Date().toISOString(),
        appName: "Madigun Storage System",
        data: backupData
      };

      const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const formattedDate = new Date().toISOString().split('T')[0];
      const formattedTime = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
      link.download = `Madigun_Storage_Backup_${formattedDate}_${formattedTime}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Error exporting backup:", err);
      setExportError("Export failed: " + (err.message || err));
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (file.type !== "application/json" && !file.name.endsWith('.json')) {
      setImportError("Please upload a valid .json backup file");
      setLoadedBackup(null);
      return;
    }

    setImportError('');
    setImportSuccess('');
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json || typeof json !== 'object') {
          throw new Error("Invalid file content. Must be a JSON object.");
        }
        if (!json.version || !json.data) {
          throw new Error("Missing 'version' or 'data' properties. Ensure this is a valid Madigun Storage Backup file.");
        }
        setLoadedBackup(json);
      } catch (err: any) {
        setImportError("Failed to parse JSON file: " + err.message);
        setLoadedBackup(null);
      }
    };
    reader.readAsText(file);
  };

  // Click handler to open custom in-app modal instead of browser's blocked window.confirm
  const handleImportBackupClick = (wipeFirst: boolean) => {
    if (!loadedBackup) return;
    setBackupConfirm({
      isOpen: true,
      wipeFirst,
      title: wipeFirst ? "Confirm Overwrite & Full Restore" : "Confirm Safe Merge Import",
      message: wipeFirst
        ? "Warning: This will PERMANENTLY WIPE all your existing database records in all collections and replace them with the data from the backup file. This operation is irreversible. Are you absolutely sure?"
        : "This will merge the backup records with your current data. Existing records with matching IDs will be updated, and new records will be added. Continue?"
    });
  };

  // Import JSON backup and execute operations
  const executeImportBackup = async () => {
    if (!loadedBackup) return;
    const wipeFirst = backupConfirm.wipeFirst;
    
    // Close the confirm dialog immediately
    setBackupConfirm(prev => ({ ...prev, isOpen: false }));

    setIsImporting(true);
    setImportError('');
    setImportSuccess('');
    setImportStatus('Initializing import...');
    
    try {
      await restoreBackupToFirestore(
        loadedBackup,
        wipeFirst,
        (status, _percent) => setImportStatus(status)
      );

      setImportSuccess('Data Backup imported and restored successfully to Cloud Firestore and local database!');
      setLoadedBackup(null);
      fetchStats();
    } catch (err: any) {
      console.error("Error during import:", err);
      setImportError('Import failed: ' + (err.message || err));
    } finally {
      setIsImporting(false);
      setImportStatus('');
    }
  };

  // Register New Staff Account (Admin Only Backend Function)
  const handleRegisterUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim()) {
      setRegError('Please enter the personnel username.');
      return;
    }
    if (!regPassword) {
      setRegError('Please enter a secure login password.');
      return;
    }

    try {
      setIsRegistering(true);
      setRegError('');
      setRegSuccess('');

      // Generate a clean username and auto-generate a unique Employee ID behind the scenes
      const cleanUsername = regName.trim();
      const targetEmpId = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;

      const newUser = {
        username: cleanUsername,
        employeeId: targetEmpId,
        password: regPassword,
        role: regRole,
        status: 'Approved',
        fullName: cleanUsername,
        department: 'Operations',
        createdAt: new Date().toISOString()
      };

      await localStore.addItem('users', newUser);

      await localStore.addItem('audit_logs', {
        auditorName: 'System (Admin Registry)',
        itemId: 'STAFF_REGISTRATION',
        itemName: `Registered user "${newUser.username}"`,
        countedQty: 1,
        systemQty: 1,
        difference: 0,
        status: 'Staff Registered',
        notes: `Admin created credentials for ${newUser.username} (${targetEmpId}) with system role ${newUser.role}.`,
        createdAt: new Date().toISOString()
      });

      setRegSuccess(`Personnel "${cleanUsername}" has been successfully registered.`);
      setRegName('');
      setRegEmpId('');
      setRegPassword('');
      setRegRole('Front Desk');
    } catch (err: any) {
      setRegError(err.message || 'Failed to register account.');
    } finally {
      setIsRegistering(false);
    }
  };

  // Revoke / Delete Staff Account credentials
  const handleDeleteUser = async (userId: string, userName: string, userEmpId: string) => {
    if (currentUser?.role === 'Front Desk') {
      setRegError('Access Denied: Front Desk staff are not authorized to delete staff accounts.');
      return;
    }
    if (currentUser && userEmpId === currentUser.employeeId) {
      setRegError('You cannot delete your own active login credentials from the current session.');
      return;
    }

    try {
      // 1. Delete user from the 'users' collection
      await localStore.deleteItem('users', userId);

      // 2. Also search and delete corresponding custodian profile if exists
      const existingCustodians = localStore.getCollection<Custodian>('custodians');
      const matchedCustodian = existingCustodians.find(c => c.employeeId === userEmpId);
      if (matchedCustodian) {
        await localStore.deleteItem('custodians', matchedCustodian.id);
      }

      // Log deletion to system audit logs
      await localStore.addItem('audit_logs', {
        auditorName: 'System (Admin Registry)',
        itemId: 'STAFF_DELETION',
        itemName: `Deleted user "${userName}"`,
        countedQty: 0,
        systemQty: 1,
        difference: -1,
        status: 'Staff Deleted',
        notes: `Admin deleted and erased login access for ${userName} (${userEmpId}).${matchedCustodian ? ' Corresponding custodian profile was also completely erased.' : ''}`,
        createdAt: new Date().toISOString()
      });

      setRegSuccess(`Successfully deleted and erased all account records for "${userName}".`);
      setTimeout(() => setRegSuccess(''), 4000);
    } catch (err: any) {
      setRegError('Failed to delete user: ' + err.message);
    }
  };

  // Branding Logo Handlers
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setLogoError('Please select a valid image file (PNG/JPEG).');
      return;
    }

    setLogoError('');
    setLogoSuccess('');
    setLogoUploading(true);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64String = reader.result as string;
          
          // Cache in localStorage
          localStorage.setItem('madigun_custom_logo', base64String);
          window.dispatchEvent(new Event('madigun_logo_updated'));

          setLogoSuccess('Logo updated successfully!');
        } catch (dbErr: any) {
          setLogoError('Logo update failed: ' + dbErr.message);
        } finally {
          setLogoUploading(false);
        }
      };
      reader.onerror = () => {
        setLogoError('Failed to read image file.');
        setLogoUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setLogoError(err.message || 'Failed to upload logo.');
      setLogoUploading(false);
    }
  };

  const handleResetLogo = async () => {
    setLogoError('');
    setLogoSuccess('');
    setLogoUploading(true);

    try {
      localStorage.removeItem('madigun_custom_logo');
      window.dispatchEvent(new Event('madigun_logo_updated'));

      setLogoSuccess('Logo reverted to default.');
    } catch (err: any) {
      setLogoError(err.message || 'Failed to reset logo.');
    } finally {
      setLogoUploading(false);
    }
  };

  // Select Item Handler for Audit
  const handleSelectItemForAudit = (id: string) => {
    setSelectedItemId(id);
    const item = inventory.find(i => i.id === id);
    if (item) {
      setCountedQty(item.quantityAvailable);
    }
    setAuditError('');
    setAuditSuccess('');
  };

  // Submit Add Custodian
  const handleAddCustodian = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser?.role === 'Managing Director') {
      setCustodianError('Managing Director account is read-only and cannot perform modifications.');
      return;
    }
    setCustodianError('');
    setCustodianSuccess('');

    if (!newCustName.trim()) return setCustodianError('Custodian name is required');
    if (!newCustEmpId.trim()) return setCustodianError('Employee ID is required');

    // Check for duplicate Employee ID
    if (custodians.some(c => c.employeeId.toLowerCase() === newCustEmpId.trim().toLowerCase())) {
      return setCustodianError('A custodian with this Employee ID is already registered');
    }

    try {
      setIsAddingCustodian(true);
      await localStore.addItem('custodians', {
        name: newCustName.trim(),
        employeeId: newCustEmpId.trim().toUpperCase(),
        role: newCustRole,
        contact: newCustContact.trim() || 'N/A',
        status: 'Active',
        createdAt: new Date().toISOString()
      });

      setNewCustName('');
      setNewCustEmpId('');
      setNewCustContact('');
      setCustodianSuccess('Property Custodian registered successfully!');
      setTimeout(() => setCustodianSuccess(''), 3000);
    } catch (err: any) {
      setCustodianError(err.message || 'Failed to add custodian');
    } finally {
      setIsAddingCustodian(false);
    }
  };

  // Delete Custodian
  const handleDeleteCustodian = async (id: string, name: string) => {
    if (currentUser?.role === 'Front Desk') {
      setCustodianError('Access Denied: Front Desk staff are not authorized to delete custodians.');
      return;
    }
    try {
      await localStore.deleteItem('custodians', id);
      setCustodianToDelete(null);
      setCustodianSuccess(`Custodian ${name} deleted completely from the system.`);
      setTimeout(() => setCustodianSuccess(''), 3000);
    } catch (err: any) {
      setCustodianError('Failed to delete custodian: ' + err.message);
    }
  };

  // Submit Physical Audit Reconciliation
  const handleSubmitAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser?.role === 'Managing Director') {
      setAuditError('Managing Director account is read-only and cannot submit physical audits.');
      return;
    }
    setAuditError('');
    setAuditSuccess('');

    if (!selectedItemId) return setAuditError('Please select an asset profile to audit');
    if (countedQty < 0) return setAuditError('Counted quantity cannot be negative');
    if (!auditorName) return setAuditError('Please select an authorized Auditor/Custodian');

    const item = inventory.find(i => i.id === selectedItemId);
    if (!item) return setAuditError('Selected item could not be found');

    try {
      setIsSubmittingAudit(true);

      const previousAvailable = item.quantityAvailable;
      const previousTotal = item.quantityTotal;
      const rentedQty = previousTotal - previousAvailable; // Units currently checked out

      // Discrepancy details
      const difference = countedQty - previousAvailable; 
      
      let status: 'Matched' | 'Discrepancy - Discovered Extra' | 'Discrepancy - Missing Units' = 'Matched';
      if (difference > 0) {
        status = 'Discrepancy - Discovered Extra';
      } else if (difference < 0) {
        status = 'Discrepancy - Missing Units';
      }

      // To reconcile, we adjust both quantityAvailable and quantityTotal.
      // Checked out/rented units are assumed preserved.
      // So, new quantityTotal = countedQty (available) + rentedQty (outbound)
      const newAvailable = countedQty;
      const newTotal = countedQty + rentedQty;

      let itemStatus: 'In Stock' | 'Partially Rented' | 'Out of Stock' = 'In Stock';
      if (newAvailable === 0 && newTotal > 0) {
        itemStatus = 'Out of Stock';
      } else if (newAvailable < newTotal) {
        itemStatus = 'Partially Rented';
      }

      // 1. Log Audit Record
      await localStore.addItem('audit_logs', {
        itemId: item.id,
        itemName: item.name,
        itemSku: item.sku,
        previousQuantity: previousAvailable,
        countedQuantity: countedQty,
        difference,
        auditorName,
        notes: auditNotes.trim() || 'Routine stock validation check.',
        status,
        createdAt: new Date().toISOString()
      });

      // 2. Update Inventory Document
      await localStore.updateItem('inventory', item.id, {
        quantityAvailable: newAvailable,
        quantityTotal: newTotal,
        status: itemStatus
      });

      setAuditSuccess(`Audit logged successfully! Adjusted stock counts in real-time.`);
      setSelectedItemId('');
      setCountedQty(0);
      setAuditNotes('');
      setTimeout(() => setAuditSuccess(''), 5000);
    } catch (err: any) {
      setAuditError(err.message || 'Failed to submit physical audit');
    } finally {
      setIsSubmittingAudit(false);
    }
  };

  // Update Custodian Assignment for Asset
  const handleAssignCustodian = async (itemId: string, custodianId: string) => {
    try {
      const custodian = custodians.find(c => c.id === custodianId);
      if (custodianId === 'unassigned') {
        await localStore.updateItem('inventory', itemId, {
          assignedCustodianId: '',
          assignedCustodianName: ''
        });
      } else if (custodian) {
        await localStore.updateItem('inventory', itemId, {
          assignedCustodianId: custodian.id,
          assignedCustodianName: custodian.name
        });
      }
    } catch (err: any) {
      alert('Failed to update asset custodian assignment: ' + err.message);
    }
  };

  const selectedItemObj = inventory.find(i => i.id === selectedItemId);

  return (
    <div className="space-y-8">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-200 pb-6">
        <div>
          <h1 className="text-xl font-black font-display text-zinc-900 uppercase tracking-wider">Property Custodian Hub</h1>
        </div>
      </div>

      {currentUser?.role === 'Managing Director' && (
        <div className="bg-amber-50 border border-amber-300 p-4 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-700" />
            <span className="font-bold text-amber-900 uppercase tracking-wide">
              Managing Director Read-Only Session
            </span>
          </div>
          <span className="text-[10px] text-amber-700 font-medium">
            You can view all records and audit logs, but cannot edit or submit changes.
          </span>
        </div>
      )}

      {/* Tabs Menu */}
      <div className="border-b border-zinc-200 bg-white p-2 flex gap-2">
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest border transition-all cursor-pointer ${
            activeTab === 'audit'
              ? 'bg-zinc-900 text-white border-zinc-900'
              : 'bg-white text-zinc-500 hover:text-zinc-900 hover:border-zinc-300 border-zinc-200'
          }`}
        >
          Physical Reconciliation
        </button>
        <button
          onClick={() => setActiveTab('assignments')}
          className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest border transition-all cursor-pointer ${
            activeTab === 'assignments'
              ? 'bg-zinc-900 text-white border-zinc-900'
              : 'bg-white text-zinc-500 hover:text-zinc-900 hover:border-zinc-300 border-zinc-200'
          }`}
        >
          Assign Custody
        </button>
        <button
          onClick={() => setActiveTab('custodians')}
          className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest border transition-all cursor-pointer ${
            activeTab === 'custodians'
              ? 'bg-zinc-900 text-white border-zinc-900'
              : 'bg-white text-zinc-500 hover:text-zinc-900 hover:border-zinc-300 border-zinc-200'
          }`}
        >
          Active Custodians
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest border transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-zinc-900 text-white border-zinc-900'
              : 'bg-white text-zinc-500 hover:text-zinc-900 hover:border-zinc-300 border-zinc-200'
          }`}
        >
          Audit Logs
        </button>
        <button
          onClick={() => setActiveTab('backup')}
          className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest border transition-all cursor-pointer ${
            activeTab === 'backup'
              ? 'bg-zinc-900 text-white border-zinc-900'
              : 'bg-white text-zinc-500 hover:text-zinc-900 hover:border-zinc-300 border-zinc-200'
          }`}
        >
          Backup & Restore
        </button>
        <button
          onClick={() => setActiveTab('staff')}
          className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest border transition-all cursor-pointer ${
            activeTab === 'staff'
              ? 'bg-zinc-900 text-white border-zinc-900'
              : 'bg-white text-zinc-500 hover:text-zinc-900 hover:border-zinc-300 border-zinc-200'
          }`}
        >
          Staff Accounts
        </button>
      </div>

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
          className="bg-white border border-zinc-200 p-6"
        >
          
          {/* TAB 1: PHYSICAL RECONCILIATION */}
          {activeTab === 'audit' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Audit Form */}
              <div className="lg:col-span-1 space-y-5 border-r border-zinc-100 lg:pr-8">
                <div>
                  <h3 className="text-xs font-black text-zinc-900 uppercase tracking-widest flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4" />
                    Record Physical Count
                  </h3>
                </div>

                {auditSuccess && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-850 p-3 text-[11px] font-bold uppercase tracking-wider">
                    {auditSuccess}
                  </div>
                )}
                {auditError && (
                  <div className="bg-red-50 border border-red-200 text-red-750 p-3 text-[11px] font-bold uppercase tracking-wider">
                    {auditError}
                  </div>
                )}

                <form onSubmit={handleSubmitAudit} className="space-y-4">
                  {/* Select Asset */}
                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Select Asset to Audit</label>
                    <select
                      id="audit-select-item"
                      required
                      value={selectedItemId}
                      onChange={(e) => handleSelectItemForAudit(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 text-xs font-semibold uppercase bg-zinc-50 focus:bg-white focus:outline-none focus:border-zinc-900 text-zinc-800"
                    >
                      <option value="">-- Choose Asset Profile --</option>
                      {inventory.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.sku})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Asset Snapshot details if selected */}
                  {selectedItemObj && (
                    <div className="bg-zinc-50 p-3 border border-zinc-200 text-xs space-y-2 uppercase tracking-wide">
                      <div className="text-[10px] font-bold text-zinc-400 border-b border-zinc-200 pb-1">Ledger Quantities</div>
                      <div className="flex justify-between font-semibold">
                        <span>Available in Warehouse:</span>
                        <span className="font-mono text-zinc-900 font-bold">{selectedItemObj.quantityAvailable} units</span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span>Currently Rented Out:</span>
                        <span className="font-mono text-zinc-650 font-bold">{selectedItemObj.quantityTotal - selectedItemObj.quantityAvailable} units</span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span>Total Registered:</span>
                        <span className="font-mono text-zinc-900 font-bold">{selectedItemObj.quantityTotal} units</span>
                      </div>
                      <div className="flex justify-between font-semibold border-t border-zinc-200/60 pt-1.5">
                        <span>Storage Grid Location:</span>
                        <span className="text-zinc-600 font-bold">{selectedItemObj.location || 'N/A'}</span>
                      </div>
                    </div>
                  )}

                  {/* Physical Count */}
                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Physical Count inside Warehouse</label>
                    <input
                      id="audit-counted-qty"
                      type="number"
                      min="0"
                      disabled={!selectedItemId}
                      value={countedQty === 0 ? '' : countedQty}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : Number(e.target.value);
                        setCountedQty(Math.max(0, val));
                      }}
                      className="w-full px-3 py-2 border border-zinc-200 text-xs font-mono font-bold bg-zinc-50 focus:bg-white focus:outline-none focus:border-zinc-900 text-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <p className="text-[9px] text-zinc-450 italic lowercase">Input the actual number of units physically sitting on the shelves right now.</p>
                  </div>

                  {/* Calculated Discrepancy Alert */}
                  {selectedItemObj && (
                    <div className="p-3 border text-xs">
                      {countedQty === selectedItemObj.quantityAvailable ? (
                        <div className="flex items-center gap-2 text-emerald-800 font-bold">
                          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>Ledger Match • No adjustment needed</span>
                        </div>
                      ) : countedQty > selectedItemObj.quantityAvailable ? (
                        <div className="flex items-start gap-2 text-amber-800 font-bold">
                          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span>Discrepancy: +{countedQty - selectedItemObj.quantityAvailable} Surplus Found</span>
                            <span className="block font-medium normal-case text-zinc-500 mt-1">
                              Database will be updated to higher count (Total Registered from {selectedItemObj.quantityTotal} to {countedQty + (selectedItemObj.quantityTotal - selectedItemObj.quantityAvailable)}).
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2 text-red-800 font-bold">
                          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                          <div>
                            <span>Discrepancy: {countedQty - selectedItemObj.quantityAvailable} Missing Unit(s)</span>
                            <span className="block font-medium normal-case text-zinc-500 mt-1">
                              Database will be updated to lower count (Total Registered from {selectedItemObj.quantityTotal} to {countedQty + (selectedItemObj.quantityTotal - selectedItemObj.quantityAvailable)}).
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Auditor Selector */}
                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Authorized Custodian / Auditor</label>
                    <select
                      id="audit-auditor"
                      required
                      value={auditorName}
                      onChange={(e) => setAuditorName(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 text-xs font-semibold uppercase bg-zinc-50 focus:bg-white focus:outline-none focus:border-zinc-900 text-zinc-800"
                    >
                      <option value="">-- Choose Auditor --</option>
                      {custodians.map(c => (
                        <option key={c.id} value={c.name}>
                          {c.name} ({c.employeeId})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Audit Notes */}
                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Protocol Audit Explanation Notes</label>
                    <textarea
                      id="audit-notes"
                      rows={3}
                      placeholder="Explain physical findings, packaging condition, serial matches, etc."
                      value={auditNotes}
                      onChange={(e) => setAuditNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 text-xs font-semibold bg-zinc-50 focus:bg-white focus:outline-none focus:border-zinc-900 text-zinc-800"
                    />
                  </div>

                  <button
                    id="btn-submit-audit"
                    type="submit"
                    disabled={isSubmittingAudit || !selectedItemId || !auditorName}
                    className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer text-center"
                  >
                    {isSubmittingAudit ? 'Aligning Ledger...' : 'Commit Physical Audit'}
                  </button>
                </form>
              </div>

              {/* Sidebar: Real-time Reconciliation Insights */}
              <div className="lg:col-span-2 space-y-6">
                <div>
                  <h3 className="text-xs font-black text-zinc-900 uppercase tracking-widest">Custodian Stock Status Report</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border border-zinc-200 bg-zinc-50">
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Active Audits Logged</span>
                    <h4 className="text-2xl font-black font-mono text-zinc-900 mt-1">{auditLogs.length}</h4>
                  </div>
                  <div className="p-4 border border-zinc-200 bg-zinc-50">
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Assets Needing Audits</span>
                    <h4 className="text-2xl font-black font-mono text-zinc-900 mt-1">
                      {inventory.filter(item => !auditLogs.some(log => log.itemId === item.id)).length}
                    </h4>
                  </div>
                </div>

                {/* Quick Audit Tips */}
                <div className="bg-zinc-900 text-zinc-100 p-5 space-y-3 uppercase tracking-wide">
                  <h4 className="text-[10px] font-bold text-zinc-350 tracking-wider">Property Custodian Protocol guidelines</h4>
                  <ul className="text-[10px] space-y-2 font-semibold text-zinc-300">
                    <li className="flex items-start gap-2">
                      <span className="h-1.5 w-1.5 bg-white rotate-45 shrink-0 mt-1"></span>
                      <span>Never edit stock values directly during high transaction times; verify returns first.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="h-1.5 w-1.5 bg-white rotate-45 shrink-0 mt-1"></span>
                      <span>If missing items are found later, execute a surplus audit to safely increase availability.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="h-1.5 w-1.5 bg-white rotate-45 shrink-0 mt-1"></span>
                      <span>All discrepancy events must be documented with specific serial mismatch or shelf logs.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CUSTODIAN ASSIGNMENTS */}
          {activeTab === 'assignments' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-black text-zinc-900 uppercase tracking-widest">Assign Asset Custodianship</h3>
              </div>

              <div className="overflow-x-auto">
                {inventory.length === 0 ? (
                  <p className="text-xs text-zinc-400 py-6 text-center">No assets found to assign</p>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-200 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                        <th className="py-3 px-2">Asset Details</th>
                        <th className="py-3 px-2">Grid Location</th>
                        <th className="py-3 px-2">Stock Levels</th>
                        <th className="py-3 px-2">Assigned Custodian</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {inventory.map(item => (
                        <tr key={item.id} className="hover:bg-zinc-50/40 transition-colors">
                          <td className="py-4 px-2">
                            <div className="font-bold text-zinc-900 uppercase tracking-tight">{item.name}</div>
                            <div className="text-[10px] text-zinc-400 font-mono mt-0.5 uppercase">{item.sku} • {item.category}</div>
                          </td>
                          <td className="py-4 px-2 text-zinc-650 uppercase font-semibold text-[11px]">
                            {item.location || 'Warehouse Grid'}
                          </td>
                          <td className="py-4 px-2 font-mono text-zinc-800">
                            {item.quantityAvailable} / {item.quantityTotal} units
                          </td>
                          <td className="py-4 px-2">
                            <select
                              id={`assign-custodian-${item.sku}`}
                              value={item.assignedCustodianId || 'unassigned'}
                              onChange={(e) => handleAssignCustodian(item.id, e.target.value)}
                              className="px-2 py-1.5 border border-zinc-200 text-xs font-semibold bg-zinc-50 focus:bg-white focus:outline-none uppercase tracking-wider text-zinc-850"
                            >
                              <option value="unassigned">-- UNASSIGNED --</option>
                              {custodians.map(c => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: REGISTERED CUSTODIANS */}
          {activeTab === 'custodians' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Add Custodian Form */}
              <div className="lg:col-span-1 border-r border-zinc-100 lg:pr-8 space-y-5">
                <div>
                  <h3 className="text-xs font-black text-zinc-900 uppercase tracking-widest flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Register Custodian
                  </h3>
                </div>

                {custodianSuccess && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-850 p-3 text-[11px] font-bold uppercase tracking-wider">
                    {custodianSuccess}
                  </div>
                )}
                {custodianError && (
                  <div className="bg-red-50 border border-red-200 text-red-750 p-3 text-[11px] font-bold uppercase tracking-wider">
                    {custodianError}
                  </div>
                )}

                <form onSubmit={handleAddCustodian} className="space-y-4">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Full Printed Name</label>
                    <input
                      id="custodian-name"
                      type="text"
                      required
                      placeholder="e.g. JUNMARCK MEBULOS"
                      value={newCustName}
                      onChange={(e) => setNewCustName(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 text-xs font-semibold uppercase bg-zinc-50 focus:bg-white focus:outline-none focus:border-zinc-900 text-zinc-800"
                    />
                  </div>

                  {/* Employee ID */}
                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Employee UID ID</label>
                    <input
                      id="custodian-empid"
                      type="text"
                      required
                      placeholder="e.g. MC-2026-001"
                      value={newCustEmpId}
                      onChange={(e) => setNewCustEmpId(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 text-xs font-mono uppercase bg-zinc-50 focus:bg-white focus:outline-none focus:border-zinc-900 text-zinc-800"
                    />
                  </div>

                  {/* Role */}
                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Security Role Category</label>
                    <select
                      id="custodian-role"
                      value={newCustRole}
                      onChange={(e) => setNewCustRole(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 text-xs font-semibold uppercase bg-zinc-50 focus:bg-white focus:outline-none focus:border-zinc-900 text-zinc-800"
                    >
                      <option value="Head Property Custodian">Head Property Custodian</option>
                      <option value="Assistant Custodian">Assistant Custodian</option>
                      <option value="Logistics Inspector">Logistics Inspector</option>
                      <option value="Rentals Officer">Rentals Officer</option>
                    </select>
                  </div>

                  {/* Contact Number */}
                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Active Contact Number</label>
                    <input
                      id="custodian-contact"
                      type="text"
                      placeholder="e.g. +63 917 123 4567"
                      value={newCustContact}
                      onChange={(e) => setNewCustContact(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 text-xs font-semibold bg-zinc-50 focus:bg-white focus:outline-none focus:border-zinc-900 text-zinc-800"
                    />
                  </div>

                  <button
                    id="btn-register-custodian"
                    type="submit"
                    disabled={isAddingCustodian}
                    className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer text-center"
                  >
                    {isAddingCustodian ? 'Registering...' : 'Register Authorized Custodian'}
                  </button>
                </form>
              </div>

              {/* Custodian List */}
              <div className="lg:col-span-2 space-y-5">
                <div>
                  <h3 className="text-xs font-black text-zinc-900 uppercase tracking-widest flex items-center gap-2">
                    <UserCheck className="h-4 w-4" />
                    Authorized Property Custodians ({custodians.length})
                  </h3>
                </div>

                {loadingCustodians ? (
                  <div className="py-8 text-center text-xs font-semibold uppercase text-zinc-400 animate-pulse">
                    Querying custodian database...
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {custodians.map(c => (
                      <div key={c.id} className="p-4 bg-zinc-50 border border-zinc-200 space-y-3.5 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <h4 className="font-bold text-zinc-900 text-xs uppercase tracking-tight">{c.name}</h4>
                              <span className="text-[9px] font-mono bg-zinc-150 text-zinc-550 border border-zinc-200 px-1.5 py-0.5 uppercase tracking-wide inline-block mt-1">
                                {c.employeeId}
                              </span>
                            </div>
                            <span className="text-[9px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 border border-emerald-200 uppercase tracking-widest">
                              {c.status}
                            </span>
                          </div>

                          <div className="mt-4 space-y-1.5 text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
                            <div className="flex items-center gap-1.5">
                              <Briefcase className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                              <span>Role: <span className="font-bold text-zinc-700">{c.role}</span></span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                              <span>Contact: <span className="font-bold text-zinc-700">{c.contact}</span></span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="border-t border-zinc-200/60 pt-3 flex justify-end">
                          <button
                            id={`btn-delete-custodian-${c.employeeId}`}
                            onClick={() => setCustodianToDelete({ id: c.id, name: c.name })}
                            className="p-1.5 text-zinc-400 hover:text-red-750 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all cursor-pointer"
                            title="Remove Custodian"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: AUDIT RECONCILIATION LOG HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-xs font-black text-zinc-900 uppercase tracking-widest flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Ledger Audit Logs Registry
                  </h3>
                </div>
              </div>

              {loadingLogs ? (
                <div className="py-12 text-center text-xs font-semibold uppercase text-zinc-400 animate-pulse">
                  Querying physical logs ledger...
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="py-12 text-center text-zinc-400 bg-zinc-50 border border-zinc-150">
                  <History className="h-8 w-8 mx-auto mb-2 text-zinc-300" />
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">No physical count audits have been logged yet.</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5 uppercase tracking-wider">Use the 'Physical Reconciliation' tab to conduct your first stock audit.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-200 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                        <th className="py-3 px-2">Timestamp</th>
                        <th className="py-3 px-2">Asset Audited</th>
                        <th className="py-3 px-2">Auditor</th>
                        <th className="py-3 px-2 text-center">Previous Qty</th>
                        <th className="py-3 px-2 text-center">Counted Qty</th>
                        <th className="py-3 px-2 text-center">Difference</th>
                        <th className="py-3 px-2">Findings / Notes</th>
                        <th className="py-3 px-2 text-right">Audit Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {auditLogs.map(log => {
                        const isSurplus = log.difference > 0;
                        const isDeficit = log.difference < 0;
                        return (
                          <tr key={log.id} className="hover:bg-zinc-50/50 transition-colors">
                            <td className="py-4 px-2 font-mono text-[10px] text-zinc-500">
                              {new Date(log.createdAt).toLocaleString().toUpperCase()}
                            </td>
                            <td className="py-4 px-2">
                              <div className="font-bold text-zinc-900 uppercase tracking-tight">{log.itemName}</div>
                              <div className="text-[10px] text-zinc-400 font-mono mt-0.5 uppercase">{log.itemSku}</div>
                            </td>
                            <td className="py-4 px-2 font-semibold text-zinc-700 uppercase">
                              {log.auditorName}
                            </td>
                            <td className="py-4 px-2 text-center font-mono text-zinc-650 font-semibold">
                              {log.previousQuantity}
                            </td>
                            <td className="py-4 px-2 text-center font-mono text-zinc-900 font-bold">
                              {log.countedQuantity}
                            </td>
                            <td className="py-4 px-2 text-center font-mono font-bold">
                              <span className={isSurplus ? 'text-emerald-700' : isDeficit ? 'text-red-700' : 'text-zinc-400'}>
                                {isSurplus ? `+${log.difference}` : log.difference}
                              </span>
                            </td>
                            <td className="py-4 px-2 text-zinc-550 max-w-xs truncate" title={log.notes}>
                              {log.notes}
                            </td>
                            <td className="py-4 px-2 text-right">
                              <span className={`inline-flex px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
                                log.status === 'Matched'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : isSurplus
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-red-50 text-red-700 border-red-200'
                              }`}>
                                {log.status === 'Matched' ? 'MATCH' : isSurplus ? 'SURPLUS' : 'DEFICIT'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: BACKUP & RESTORE */}
          {activeTab === 'backup' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: DB Status & Local Record Counts */}
              <div className="lg:col-span-1 border-r border-zinc-100 lg:pr-8 space-y-6">
                <div>
                  <h3 className="text-xs font-black text-zinc-900 uppercase tracking-widest flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Offline Ledger Status
                  </h3>
                </div>

                <div className="bg-zinc-50 border border-zinc-200 p-4 space-y-4">
                  <div className="flex justify-between items-center border-b border-zinc-200 pb-2">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Active Database Sizes</span>
                    <button
                      onClick={fetchStats}
                      disabled={loadingStats}
                      className="p-1 text-zinc-500 hover:text-zinc-900 transition-colors rounded hover:bg-zinc-200 cursor-pointer"
                      title="Recalculate record counts"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${loadingStats ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {loadingStats ? (
                    <div className="py-6 text-center text-[10px] uppercase font-bold tracking-widest text-zinc-400 animate-pulse">
                      Analyzing local tables...
                    </div>
                  ) : (
                    <div className="space-y-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                      <div className="flex justify-between items-center bg-white p-2 border border-zinc-150">
                        <span>Asset Profiles:</span>
                        <span className="font-mono font-bold text-zinc-900">{stats.inventory} records</span>
                      </div>
                      <div className="flex justify-between items-center bg-white p-2 border border-zinc-150">
                        <span>Transmittal Invoices:</span>
                        <span className="font-mono font-bold text-zinc-900">{stats.transmittals} records</span>
                      </div>
                      <div className="flex justify-between items-center bg-white p-2 border border-zinc-150">
                        <span>Staff Custodians:</span>
                        <span className="font-mono font-bold text-zinc-900">{stats.custodians} records</span>
                      </div>
                      <div className="flex justify-between items-center bg-white p-2 border border-zinc-150">
                        <span>Storage Rooms:</span>
                        <span className="font-mono font-bold text-zinc-900">{stats.rooms} records</span>
                      </div>
                      <div className="flex justify-between items-center bg-white p-2 border border-zinc-150">
                        <span>Reconciliation Logs:</span>
                        <span className="font-mono font-bold text-zinc-900">{stats.audit_logs} records</span>
                      </div>
                      <div className="flex justify-between items-center bg-white p-2 border border-zinc-150">
                        <span>Deletion Audit Trail:</span>
                        <span className="font-mono font-bold text-zinc-900">{stats.deleted_logs} records</span>
                      </div>
                      <div className="flex justify-between items-center bg-white p-2 border border-zinc-150">
                        <span>User Accounts:</span>
                        <span className="font-mono font-bold text-zinc-900">{stats.users || 0} records</span>
                      </div>
                      <div className="flex justify-between items-center bg-white p-2 border border-zinc-150">
                        <span>System Settings:</span>
                        <span className="font-mono font-bold text-zinc-900">{stats.settings || 0} records</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-zinc-900 text-zinc-150 space-y-2 uppercase tracking-wide">
                  <h4 className="text-[9px] font-bold text-zinc-400 tracking-widest">Offline Protection Invariant</h4>
                  <p className="text-[10px] leading-relaxed text-zinc-300 font-medium normal-case">
                    This web interface uses local cache persistence. In case of browser cache clearing or hardware swap, downloading and saving a regular offline backup guarantees total security over your data.
                  </p>
                </div>
              </div>

              {/* Right Column: Export and Import Operations */}
              <div className="lg:col-span-2 space-y-8">
                {/* Export Card */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-black text-zinc-900 uppercase tracking-widest flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      Export Data Backup
                    </h3>
                  </div>

                  {exportError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-750 text-[11px] font-bold uppercase tracking-wider">
                      {exportError}
                    </div>
                  )}

                  <div className="p-5 border border-zinc-200 bg-zinc-50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[11px] font-black uppercase tracking-wider text-zinc-800 block">Backup Package Compiled</span>
                      <span className="text-[10px] text-zinc-500 block leading-tight">
                        Contains all asset details, staff logins, room records, and transaction receipts.
                      </span>
                    </div>
                    <button
                      id="btn-export-backup"
                      onClick={handleExportBackup}
                      disabled={isExporting}
                      className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] font-bold uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2"
                    >
                      {isExporting ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Generating File...</span>
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4" />
                          <span>Download Backup JSON</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Divider */}
                <hr className="border-zinc-200" />

                {/* Import Card */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-black text-zinc-900 uppercase tracking-widest flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Import & Restore Ledger
                    </h3>
                  </div>

                  {importSuccess && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-850 text-[11px] font-bold uppercase tracking-wider flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 shrink-0" />
                      <span>{importSuccess}</span>
                    </div>
                  )}

                  {importError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-750 text-[11px] font-bold uppercase tracking-wider flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{importError}</span>
                    </div>
                  )}

                  {importStatus && (
                    <div className="p-3 bg-zinc-100 border border-zinc-300 text-zinc-800 text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 animate-pulse">
                      <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
                      <span>{importStatus}</span>
                    </div>
                  )}

                  {/* Drag and Drop Zone */}
                  {!loadedBackup && (
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => document.getElementById('backup-file-input')?.click()}
                      className={`border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
                        dragOver 
                          ? 'border-zinc-900 bg-zinc-50' 
                          : 'border-zinc-300 hover:border-zinc-500 bg-white'
                      }`}
                    >
                      <input
                        id="backup-file-input"
                        type="file"
                        accept=".json"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <FileJson className="h-8 w-8 mx-auto text-zinc-400 mb-2" />
                      <span className="block text-xs font-bold uppercase tracking-widest text-zinc-700">
                        Drag and drop backup .json here
                      </span>
                      <span className="block text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mt-1">
                        or click to browse your files
                      </span>
                    </div>
                  )}

                  {/* Loaded File Details & Actions */}
                  {loadedBackup && (
                    <div className="border border-zinc-200 p-5 space-y-4 bg-zinc-50">
                      <div className="flex justify-between items-start border-b border-zinc-200 pb-3">
                        <div>
                          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Import Candidate File Loaded</span>
                          <h4 className="text-xs font-black text-zinc-900 uppercase tracking-tight mt-0.5 flex items-center gap-1.5">
                            <FileJson className="h-4 w-4 text-zinc-600 shrink-0" />
                            {loadedBackup.appName || "Madigun Storage Backup"} (v{loadedBackup.version})
                          </h4>
                          <span className="text-[10px] text-zinc-500 font-mono block mt-1 uppercase">
                            Exported: {new Date(loadedBackup.exportedAt).toLocaleString().toUpperCase()}
                          </span>
                        </div>
                        <button
                          onClick={() => setLoadedBackup(null)}
                          className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-900 border border-zinc-200 px-2.5 py-1 bg-white hover:bg-zinc-100 transition-colors cursor-pointer"
                        >
                          Clear File
                        </button>
                      </div>

                      {/* Content breakdown inside candidate file */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                        <div className="bg-white p-2 border border-zinc-150">
                          <span className="block text-zinc-400 text-[8px]">Assets:</span>
                          <span className="font-mono text-zinc-900">{(loadedBackup.data.inventory || []).length} items</span>
                        </div>
                        <div className="bg-white p-2 border border-zinc-150">
                          <span className="block text-zinc-400 text-[8px]">Invoices:</span>
                          <span className="font-mono text-zinc-900">{(loadedBackup.data.transmittals || []).length} items</span>
                        </div>
                        <div className="bg-white p-2 border border-zinc-150">
                          <span className="block text-zinc-400 text-[8px]">Staff:</span>
                          <span className="font-mono text-zinc-900">{(loadedBackup.data.custodians || []).length} items</span>
                        </div>
                        <div className="bg-white p-2 border border-zinc-150">
                          <span className="block text-zinc-400 text-[8px]">Rooms:</span>
                          <span className="font-mono text-zinc-900">{(loadedBackup.data.rooms || []).length} items</span>
                        </div>
                        <div className="bg-white p-2 border border-zinc-150">
                          <span className="block text-zinc-400 text-[8px]">Logs:</span>
                          <span className="font-mono text-zinc-900">{(loadedBackup.data.audit_logs || []).length} items</span>
                        </div>
                        <div className="bg-white p-2 border border-zinc-150">
                          <span className="block text-zinc-400 text-[8px]">Deletions:</span>
                          <span className="font-mono text-zinc-900">{(loadedBackup.data.deleted_logs || []).length} items</span>
                        </div>
                      </div>

                      {/* Decision actions */}
                      <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-zinc-200">
                        <button
                          onClick={() => handleImportBackupClick(false)}
                          disabled={isImporting}
                          className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-850 text-white font-bold text-xs uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer text-center"
                        >
                          Safe Merge Import
                        </button>
                        <button
                          onClick={() => handleImportBackupClick(true)}
                          disabled={isImporting}
                          className="flex-1 py-3 bg-white hover:bg-red-50 border border-red-200 text-red-600 hover:text-red-750 font-bold text-xs uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer text-center"
                        >
                          Wipe & Full Restore
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: STAFF ACCOUNTS REGISTRY */}
          {activeTab === 'staff' && (
            currentUser?.role !== 'Admin' ? (
              <div className="p-8 border border-zinc-200 bg-white space-y-4 max-w-xl mx-auto text-center mt-6">
                <ShieldAlert className="h-12 w-12 text-zinc-400 mx-auto" />
                <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900">Access Restricted</h3>
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold leading-relaxed">
                  Only authorized Chief Custodians (Admin) can view, register, or manage staff personnel accounts and password credentials.
                </p>
                <div className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                  Current Session: {currentUser?.username} ({currentUser?.employeeId}) • Role: {currentUser?.role}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Register New Account Form */}
                <div className="lg:col-span-1 border-r border-zinc-100 lg:pr-8 space-y-6">
                  <div>
                    <h3 className="text-sm font-black text-zinc-900 uppercase tracking-widest flex items-center gap-2">
                      <UserPlus className="h-4 w-4 text-zinc-800" />
                      Register Staff Account
                    </h3>
                  </div>

                  {regError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-750 text-[10px] font-bold uppercase tracking-wider">
                      {regError}
                    </div>
                  )}

                  {regSuccess && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-850 text-[10px] font-bold uppercase tracking-wider">
                      {regSuccess}
                    </div>
                  )}

                  <form onSubmit={handleRegisterUserSubmit} className="space-y-4">
                    <div>
                      <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                        Personnel Username
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Marc"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200 py-2 px-3 text-xs font-semibold focus:outline-none focus:border-zinc-900 transition-colors uppercase"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                        Login Password
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. desk"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200 py-2 px-3 text-xs font-semibold focus:outline-none focus:border-zinc-900 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                        Personnel Role
                      </label>
                      <select
                        value={regRole}
                        onChange={(e) => setRegRole(e.target.value as any)}
                        className="w-full bg-zinc-50 border border-zinc-200 py-2.5 px-3 text-xs font-bold uppercase tracking-wider focus:outline-none focus:border-zinc-900 transition-colors"
                      >
                        <option value="Front Desk">Front Desk Staff</option>
                        <option value="Admin">Chief Custodian (Admin)</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={isRegistering}
                      className="w-full bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 text-white font-bold text-[10px] uppercase tracking-widest py-3 flex items-center justify-center gap-2 border border-zinc-900 transition-colors cursor-pointer"
                    >
                      <span>{isRegistering ? 'Registering...' : 'Register Staff Account'}</span>
                      <UserPlus className="h-3.5 w-3.5" />
                    </button>
                  </form>

                  {/* BRANDING CUSTOMIZATION SECTION */}
                  <div className="pt-6 mt-6 border-t border-zinc-200 space-y-4">
                    <div>
                      <h3 className="text-sm font-black text-zinc-900 uppercase tracking-widest flex items-center gap-2">
                        <Upload className="h-4 w-4 text-zinc-800" />
                        System Brand Logo
                      </h3>
                    </div>

                    {logoError && (
                      <div className="p-3 bg-red-50 border border-red-200 text-red-750 text-[10px] font-bold uppercase tracking-wider">
                        {logoError}
                      </div>
                    )}

                    {logoSuccess && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-850 text-[10px] font-bold uppercase tracking-wider">
                        {logoSuccess}
                      </div>
                    )}

                    <div className="space-y-4">
                      {/* Logo Preview */}
                      <div className="flex items-center gap-4 bg-zinc-50 border border-zinc-200 p-3">
                        <div className="w-16 h-16 bg-white border border-zinc-200 rounded flex items-center justify-center p-2 shrink-0">
                          {currentCustomLogo ? (
                            <img 
                              src={currentCustomLogo} 
                              alt="Branded Logo Preview" 
                              className="max-w-full max-h-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Default</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold uppercase text-zinc-700 leading-none">Logo Status</p>
                          <p className="text-[9px] text-zinc-500 font-mono mt-1">
                            {currentCustomLogo ? 'Custom Upload Active' : 'Default Monogram SVG'}
                          </p>
                          {currentCustomLogo && (
                            <button
                              type="button"
                              onClick={handleResetLogo}
                              disabled={logoUploading}
                              className="mt-1.5 text-[9px] font-bold text-red-650 hover:text-red-800 uppercase tracking-wider transition-colors cursor-pointer block underline"
                            >
                              Reset to Default
                            </button>
                          )}
                        </div>
                      </div>

                      {/* File Selection */}
                      <div className="relative">
                        <input
                          type="file"
                          id="system-logo-upload"
                          accept="image/png, image/jpeg, image/jpg"
                          onChange={handleLogoUpload}
                          disabled={logoUploading}
                          className="hidden"
                        />
                        <label
                          htmlFor="system-logo-upload"
                          className={`w-full py-3 px-4 border border-dashed border-zinc-300 hover:border-zinc-900 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-zinc-900 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            logoUploading ? 'opacity-50 pointer-events-none' : ''
                          }`}
                        >
                          <Upload className="h-4 w-4 text-zinc-400" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-center">
                            {logoUploading ? 'Processing File...' : 'Upload Clean Transparent PNG / JPEG'}
                          </span>
                          <span className="text-[8px] text-zinc-400 uppercase tracking-wider font-mono">
                            Max 1MB recommended
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Active Staff Accounts List */}
                <div className="lg:col-span-2 space-y-6">
                  <div>
                    <h3 className="text-sm font-black text-zinc-900 uppercase tracking-widest flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-zinc-800" />
                      Authorized Personnel List
                    </h3>
                  </div>

                  {loadingUsers ? (
                    <div className="py-8 text-center text-[10px] uppercase font-bold tracking-widest text-zinc-400 animate-pulse">
                      Retrieving authorized user registry...
                    </div>
                  ) : registeredUsers.length === 0 ? (
                    <div className="text-center py-12 text-zinc-400 border border-dashed border-zinc-200 bg-zinc-50/50">
                      <HelpCircle className="h-6 w-6 mx-auto mb-2 text-zinc-350" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">No personnel accounts found</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-zinc-200 bg-white">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-zinc-50 border-b border-zinc-200 text-[9px] font-bold text-zinc-400 uppercase tracking-wider">
                            <th className="py-3 px-4">Authorized Name</th>
                            <th className="py-3 px-4">Employee ID</th>
                            <th className="py-3 px-4">Password</th>
                            <th className="py-3 px-4">System Role</th>
                            <th className="py-3 px-4 text-right">Access Control</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-150">
                          {registeredUsers.map((u) => (
                            <tr key={u.id} className="hover:bg-zinc-50/50 transition-colors">
                              <td className="py-3 px-4 uppercase text-zinc-800">
                                <div className="font-bold text-zinc-900">{u.username}</div>
                                {(u.fullName || u.email || u.phone || u.department || u.bio) && u.employeeId !== 'EMP-2026-001' && (
                                  <div className="mt-1.5 pt-1.5 border-t border-dashed border-zinc-200 space-y-1 text-[10px] text-zinc-500 normal-case">
                                    {u.fullName && (
                                      <div>
                                        <span className="font-bold text-[8px] uppercase tracking-wider text-zinc-400">Name:</span>{' '}
                                        <span className="font-semibold text-zinc-700 uppercase">{u.fullName}</span>
                                      </div>
                                    )}
                                    {u.department && (
                                      <div>
                                        <span className="font-bold text-[8px] uppercase tracking-wider text-zinc-400">Dept:</span>{' '}
                                        <span className="font-semibold text-zinc-700 uppercase">{u.department}</span>
                                      </div>
                                    )}
                                    {(u.phone || u.email) && (
                                      <div className="flex flex-wrap gap-x-2 text-[9px] text-zinc-400 font-mono">
                                        {u.phone && <span>📞 {u.phone}</span>}
                                        {u.email && <span className="lowercase">✉️ {u.email}</span>}
                                      </div>
                                    )}
                                    {u.bio && (
                                      <div className="italic text-zinc-400 mt-1 max-w-xs truncate uppercase text-[8px] tracking-wide" title={u.bio}>
                                        💬 "{u.bio}"
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4 font-mono font-bold text-zinc-900">
                                {u.employeeId}
                              </td>
                              <td className="py-3 px-4 font-mono text-zinc-500">
                                {u.password}
                              </td>
                              <td className="py-3 px-4">
                                <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
                                  u.role === 'Admin'
                                    ? 'bg-zinc-900 text-white border-zinc-900'
                                    : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                                }`}>
                                  {u.role === 'Admin' ? 'Admin' : 'Front Desk'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                {u.employeeId === currentUser?.employeeId ? (
                                  <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest italic">
                                    Active Session
                                  </span>
                                ) : currentUser?.role !== 'Front Desk' ? (
                                  <button
                                    onClick={() => setUserToDelete({ id: u.id, name: u.username, employeeId: u.employeeId })}
                                    className="inline-flex items-center px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-red-650 hover:bg-red-50 hover:text-red-800 border border-transparent hover:border-red-100 transition-colors cursor-pointer"
                                    title="Delete and erase account completely"
                                  >
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Delete
                                  </button>
                                ) : (
                                  <span className="text-[9px] text-zinc-300 font-bold uppercase tracking-widest italic" title="Only administrators can delete staff profiles">
                                    Locked
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )
          )}

        </motion.div>
      </AnimatePresence>

      {/* Custodian Delete Confirmation Modal */}
      <AnimatePresence>
        {custodianToDelete && (
          <div className="fixed inset-0 z-50 bg-zinc-900/30 backdrop-blur-[1px] flex items-center justify-center p-4">
            <div className="absolute inset-0 cursor-default" onClick={() => setCustodianToDelete(null)}></div>
            
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              className="bg-white w-full max-w-md border border-zinc-200 overflow-hidden flex flex-col relative z-10 p-6 space-y-4"
            >
              <div className="text-center space-y-2">
                <ShieldAlert className="h-10 w-10 text-red-600 mx-auto" />
                <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900">Delete Custodian Account</h3>
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                  Are you sure you want to completely delete "<span className="text-zinc-900">{custodianToDelete.name}</span>"?
                </p>
                <p className="text-[11px] text-red-600 leading-relaxed font-semibold">
                  Warning: Deleting this account will completely remove them as a Property Custodian. This action is irreversible.
                </p>
              </div>

              <div className="flex gap-3 pt-4 border-t border-zinc-200">
                <button
                  id="btn-cancel-delete-custodian"
                  type="button"
                  onClick={() => setCustodianToDelete(null)}
                  className="flex-1 py-2 text-xs font-bold uppercase tracking-widest text-zinc-600 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 transition-colors cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-delete-custodian-proceed"
                  type="button"
                  onClick={() => handleDeleteCustodian(custodianToDelete.id, custodianToDelete.name)}
                  className="flex-1 py-2 text-xs font-bold uppercase tracking-widest text-white bg-red-600 hover:bg-red-700 transition-colors cursor-pointer text-center"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Staff Account Delete Confirmation Modal */}
      <AnimatePresence>
        {userToDelete && (
          <div className="fixed inset-0 z-50 bg-zinc-900/30 backdrop-blur-[1px] flex items-center justify-center p-4">
            <div className="absolute inset-0 cursor-default" onClick={() => setUserToDelete(null)}></div>
            
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              className="bg-white w-full max-w-md border border-zinc-200 overflow-hidden flex flex-col relative z-10 p-6 space-y-4"
            >
              <div className="text-center space-y-2">
                <ShieldAlert className="h-10 w-10 text-red-600 mx-auto animate-none" />
                <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900">Delete Staff Account</h3>
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                  Are you sure you want to completely delete "<span className="text-zinc-900">{userToDelete.name}</span>" ({userToDelete.employeeId})?
                </p>
                <p className="text-[11px] text-red-600 leading-relaxed font-semibold">
                  Warning: This will completely erase their system credentials and also remove their Property Custodian profile if it exists. This action is irreversible.
                </p>
              </div>

              <div className="flex gap-3 pt-4 border-t border-zinc-200">
                <button
                  id="btn-cancel-delete-user"
                  type="button"
                  onClick={() => setUserToDelete(null)}
                  className="flex-1 py-2 text-xs font-bold uppercase tracking-widest text-zinc-600 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 transition-colors cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-delete-user-proceed"
                  type="button"
                  onClick={async () => {
                    const { id, name, employeeId } = userToDelete;
                    setUserToDelete(null);
                    await handleDeleteUser(id, name, employeeId);
                  }}
                  className="flex-1 py-2 text-xs font-bold uppercase tracking-widest text-white bg-red-600 hover:bg-red-700 transition-colors cursor-pointer text-center"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Database Backup Import Confirmation Modal */}
      <AnimatePresence>
        {backupConfirm.isOpen && (
          <div className="fixed inset-0 z-50 bg-zinc-900/30 backdrop-blur-[1px] flex items-center justify-center p-4">
            <div className="absolute inset-0 cursor-default" onClick={() => setBackupConfirm(prev => ({ ...prev, isOpen: false }))}></div>
            
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              className="bg-white w-full max-w-lg border border-zinc-200 overflow-hidden flex flex-col relative z-10 p-6 space-y-4"
            >
              <div className="text-center space-y-2">
                {backupConfirm.wipeFirst ? (
                  <ShieldAlert className="h-12 w-12 text-red-600 mx-auto" />
                ) : (
                  <Database className="h-12 w-12 text-zinc-800 mx-auto" />
                )}
                
                <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900">{backupConfirm.title}</h3>
                
                <p className="text-xs text-zinc-700 uppercase tracking-wider font-semibold leading-relaxed">
                  {backupConfirm.message}
                </p>

                {backupConfirm.wipeFirst && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-750 text-[10px] uppercase font-black tracking-widest mt-2">
                    ALL EXISTING ASSET PROFILES, TRANSMITTAL INVOICES, CUSTODIAN RECORDS, AND SYSTEM LOGS WILL BE TOTALLY DESTROYED.
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-zinc-200">
                <button
                  id="btn-cancel-backup-import"
                  type="button"
                  onClick={() => setBackupConfirm(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-2.5 text-xs font-bold uppercase tracking-widest text-zinc-600 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 transition-colors cursor-pointer text-center"
                >
                  No, Abort
                </button>
                <button
                  id="btn-confirm-backup-import-proceed"
                  type="button"
                  onClick={executeImportBackup}
                  className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition-colors cursor-pointer text-center ${
                    backupConfirm.wipeFirst 
                      ? 'bg-red-600 hover:bg-red-700' 
                      : 'bg-zinc-900 hover:bg-zinc-800'
                  }`}
                >
                  Yes, Proceed
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
