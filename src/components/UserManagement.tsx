import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  UserCheck, 
  UserX, 
  ShieldCheck, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Search, 
  X, 
  Building, 
  Mail, 
  Phone,
  User,
  Eye,
  EyeOff,
  Key,
  Briefcase,
  Lock,
  Save,
  Trash2,
  UserPlus,
  ShieldAlert
} from 'lucide-react';
import { localStore } from '../localStore';
import { UserProfile, UserRole } from '../types';

interface UserManagementProps {
  currentUser: any;
}

export default function UserManagement({ currentUser }: UserManagementProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'accounts' | 'pending'>('accounts');
  const [roleFilter, setRoleFilter] = useState<'all' | 'Admin' | 'Managing Director' | 'Front Desk'>('all');
  const [assigningRoles, setAssigningRoles] = useState<{ [userId: string]: UserRole }>({});
  
  // Messages & Process State
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Personal Profile Modal State
  const [selectedProfileUser, setSelectedProfileUser] = useState<UserProfile | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [rejectingUser, setRejectingUser] = useState<UserProfile | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('Front Desk');
  const [editStatus, setEditStatus] = useState<'Approved' | 'Pending' | 'Rejected'>('Approved');
  const [editPassword, setEditPassword] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const isPrimaryRoot = currentUser?.employeeId === 'EMP-2026-001' || 
                        currentUser?.username?.toUpperCase() === 'ADMIN' || 
                        currentUser?.email === 'madigunhotelevents@gmail.com';

  // Listen to users collection
  useEffect(() => {
    setLoading(true);
    const unsubscribe = localStore.subscribe<UserProfile>('users', (list) => {
      setUsers(list || []);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Sync profile editor fields when a user is selected
  useEffect(() => {
    if (selectedProfileUser) {
      setEditFullName(selectedProfileUser.fullName || '');
      setEditPhone(selectedProfileUser.phone || '');
      setEditEmail(selectedProfileUser.email || '');
      setEditDepartment(selectedProfileUser.department || '');
      setEditBio(selectedProfileUser.bio || '');
      setEditRole(selectedProfileUser.role !== 'Pending' ? selectedProfileUser.role : 'Front Desk');
      setEditStatus(selectedProfileUser.status || 'Approved');
      setEditPassword(selectedProfileUser.password || '');
      setShowPassword(false);
    }
  }, [selectedProfileUser]);

  const pendingUsers = users.filter(u => u.status === 'Pending' || u.role === 'Pending');
  const approvedUsers = users.filter(u => u.status === 'Approved' || (u.status !== 'Pending' && u.status !== 'Rejected' && u.role !== 'Pending'));

  const filteredUsers = users.filter(u => {
    if (activeTab === 'pending') {
      return u.status === 'Pending' || u.role === 'Pending';
    }
    // Accounts Tab Filter
    if (roleFilter !== 'all') {
      if (roleFilter === 'Admin') return u.role === 'Admin' || u.employeeId === 'EMP-2026-001' || u.username.toUpperCase() === 'ADMIN';
      return u.role === roleFilter;
    }
    return true;
  }).filter(u => 
    (u.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.employeeId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.department || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRoleChange = (userId: string, role: UserRole) => {
    setAssigningRoles(prev => ({ ...prev, [userId]: role }));
  };

  const handleApproveUser = async (user: UserProfile) => {
    if (!user.id) return;
    const selectedRole = assigningRoles[user.id] || (user.role !== 'Pending' ? user.role : 'Front Desk');

    try {
      setProcessingId(user.id);
      setErrorMsg('');
      await localStore.updateItem('users', user.id, {
        status: 'Approved',
        role: selectedRole
      });

      setSuccessMsg(`Approved ${user.fullName || user.username} as "${selectedRole}" successfully!`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg('Failed to approve registration: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectUser = async (user: UserProfile) => {
    if (!user.id) return;

    try {
      setProcessingId(user.id);
      setErrorMsg('');
      await localStore.updateItem('users', user.id, {
        status: 'Rejected',
        role: 'Pending'
      });

      setSuccessMsg(`Declined registration for ${user.fullName || user.username}.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      setRejectingUser(null);
    } catch (err: any) {
      setErrorMsg('Failed to reject registration: ' + err.message);
      setRejectingUser(null);
    } finally {
      setProcessingId(null);
    }
  };

  const handleSaveProfileUpdates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfileUser || !selectedProfileUser.id) return;

    try {
      setIsSavingProfile(true);
      setErrorMsg('');
      
      const updatePayload: any = {
        fullName: editFullName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim(),
        department: editDepartment.trim(),
        bio: editBio.trim(),
        role: editRole,
        status: editStatus
      };

      if (editPassword.trim()) {
        updatePayload.password = editPassword.trim();
      }

      await localStore.updateItem('users', selectedProfileUser.id, updatePayload);

      setSuccessMsg(`Updated personal profile for @${selectedProfileUser.username} successfully.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      setSelectedProfileUser(null);
    } catch (err: any) {
      setErrorMsg('Failed to save profile updates: ' + err.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleDeleteUserRecord = async (user: UserProfile) => {
    if (!user.id) return;
    if (user.employeeId === 'EMP-2026-001' || user.username.toUpperCase() === 'ADMIN') {
      setErrorMsg('Cannot delete the primary root admin account.');
      setDeletingUser(null);
      return;
    }

    try {
      setProcessingId(user.id);
      await localStore.deleteItem('users', user.id);
      setSuccessMsg(`Deleted account record for ${user.username}.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      if (selectedProfileUser?.id === user.id) {
        setSelectedProfileUser(null);
      }
      setDeletingUser(null);
    } catch (err: any) {
      setErrorMsg('Failed to delete account: ' + err.message);
      setDeletingUser(null);
    } finally {
      setProcessingId(null);
    }
  };

  if (!isPrimaryRoot) {
    return (
      <div className="bg-white border border-red-200 p-8 text-center max-w-lg mx-auto my-12 shadow-xs">
        <ShieldAlert className="h-10 w-10 text-red-600 mx-auto mb-3" />
        <h2 className="text-base font-black uppercase text-zinc-900 tracking-wider">Access Restricted</h2>
        <p className="text-xs text-zinc-500 mt-2 font-medium">
          The Accounts portal is strictly restricted to the unique primary developer root account (EMP-2026-001 / ADMIN).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header Command Center Banner */}
      <div className="bg-white border border-zinc-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-amber-100 text-amber-900 border border-amber-300">
              <ShieldCheck className="h-6 w-6 text-amber-700" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black font-display text-zinc-900 uppercase tracking-wider">
                  Accounts
                </h1>
                {pendingUsers.length > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-widest bg-amber-400 text-zinc-950 border border-amber-300 animate-pulse font-mono">
                    {pendingUsers.length} Pending
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Tab Selection */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('accounts')}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border cursor-pointer transition-all flex items-center gap-1.5 ${
                activeTab === 'accounts'
                  ? 'bg-zinc-950 text-white border-zinc-900 shadow-xs'
                  : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Registered Accounts ({approvedUsers.length})
            </button>

            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border cursor-pointer transition-all flex items-center gap-1.5 ${
                activeTab === 'pending'
                  ? 'bg-amber-400 text-zinc-950 border-amber-300 font-mono font-black shadow-xs'
                  : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              Pending Approvals ({pendingUsers.length})
            </button>
          </div>
        </div>

        {/* Global Messages */}
        {successMsg && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider flex items-center">
            <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600 shrink-0" />
            {successMsg}
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase tracking-wider flex items-center">
            <AlertCircle className="h-4 w-4 mr-2 text-red-600 shrink-0" />
            {errorMsg}
          </div>
        )}

        {/* Search & Sub-Filter Bar */}
        <div className="mt-6 flex flex-col md:flex-row gap-3 items-center">
          <div className="relative w-full md:flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-400">
              <Search className="h-4 w-4" />
            </span>
            <input
              id="input-search-accounts"
              type="text"
              placeholder="Search by Name, Username, Employee ID, Email, Department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-zinc-200 text-xs font-semibold uppercase tracking-wider bg-zinc-50 focus:bg-white focus:outline-none focus:border-zinc-900 transition-all text-zinc-800"
            />
          </div>

          {activeTab === 'accounts' && (
            <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 whitespace-nowrap mr-1">Role:</span>
              <button
                onClick={() => setRoleFilter('all')}
                className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border cursor-pointer ${
                  roleFilter === 'all' ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-zinc-50 text-zinc-600 border-zinc-200'
                }`}
              >
                All Roles
              </button>
              <button
                onClick={() => setRoleFilter('Admin')}
                className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border cursor-pointer ${
                  roleFilter === 'Admin' ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-zinc-50 text-zinc-600 border-zinc-200'
                }`}
              >
                Root Admin
              </button>
              <button
                onClick={() => setRoleFilter('Managing Director')}
                className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border cursor-pointer ${
                  roleFilter === 'Managing Director' ? 'bg-zinc-800 text-white border-zinc-800' : 'bg-zinc-50 text-zinc-600 border-zinc-200'
                }`}
              >
                Managing Directors
              </button>
              <button
                onClick={() => setRoleFilter('Front Desk')}
                className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border cursor-pointer ${
                  roleFilter === 'Front Desk' ? 'bg-emerald-800 text-white border-emerald-800' : 'bg-zinc-50 text-zinc-600 border-zinc-200'
                }`}
              >
                Front Desk Staff
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Role Matrix Reference */}
      <div className="bg-zinc-950 text-white border border-zinc-800 p-4 space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300 block">
          Role Access Matrix Reference:
        </span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
          <div className="bg-zinc-900/80 p-2.5 border border-zinc-800 space-y-1">
            <span className="font-bold text-amber-300 uppercase">1. Front Desk (Staff Account)</span>
            <p className="text-[11px] text-zinc-300 font-sans">
              Operational staff access to <strong>Transmittals</strong>, <strong>Rental Items</strong>, and <strong>Rental Halls & Event Venues</strong>.
            </p>
          </div>

          <div className="bg-zinc-900/80 p-2.5 border border-zinc-800 space-y-1">
            <span className="font-bold text-emerald-300 uppercase">2. Managing Director (Executive Account)</span>
            <p className="text-[11px] text-zinc-300 font-sans">
              Operational & supervisory access to property management and transmittals.
            </p>
          </div>
        </div>
      </div>

      {/* User Accounts Directory Grid */}
      {loading ? (
        <div className="bg-white border border-zinc-200 p-12 text-center text-xs font-bold text-zinc-400 uppercase tracking-wider">
          Loading Personnel Accounts...
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white border border-zinc-200 p-12 text-center">
          <Users className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-zinc-700 uppercase tracking-wider">No Accounts Found</h3>
          <p className="text-xs text-zinc-400 mt-1">
            {activeTab === 'pending' ? 'There are no pending registrations requiring approval.' : 'No account records match the current search filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map((user) => {
            const isPending = user.status === 'Pending' || user.role === 'Pending';
            const isRejected = user.status === 'Rejected';
            const isRootAccount = user.employeeId === 'EMP-2026-001' || user.username.toUpperCase() === 'ADMIN';
            const currentSelectedRole = assigningRoles[user.id || ''] || (user.role !== 'Pending' ? user.role : 'Front Desk');

            return (
              <motion.div
                key={user.id || user.username}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white border p-5 flex flex-col justify-between space-y-4 shadow-xs transition-all ${
                  isPending 
                    ? 'border-amber-300 bg-amber-50/20' 
                    : isRejected 
                    ? 'border-red-200 bg-red-50/10' 
                    : isRootAccount
                    ? 'border-amber-300 bg-amber-50/20'
                    : 'border-zinc-200 hover:border-zinc-900'
                }`}
              >
                <div className="space-y-3">
                  {/* Card Header */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 bg-zinc-900 text-white font-black text-xs font-mono flex items-center justify-center border border-zinc-800 shrink-0 uppercase">
                        {(user.fullName || user.username).substring(0, 2)}
                      </div>
                      <div className="truncate">
                        <span className="font-black text-sm text-zinc-900 uppercase tracking-tight block truncate">
                          {user.fullName || user.username}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-zinc-400 block">
                          @{user.username}
                        </span>
                      </div>
                    </div>

                    <div>
                      {isPending ? (
                        <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-widest bg-amber-400 text-zinc-950 border border-amber-300 font-mono animate-pulse">
                          Pending
                        </span>
                      ) : isRejected ? (
                        <span className="px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest bg-red-100 text-red-800 border border-red-200 font-mono">
                          Declined
                        </span>
                      ) : (
                        <span className={`px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest border font-mono ${
                          isRootAccount || user.role === 'Admin'
                            ? 'bg-zinc-950 text-white border-zinc-900'
                            : user.role === 'Managing Director'
                            ? 'bg-zinc-800 text-white border-zinc-700'
                            : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        }`}>
                          {user.role}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Account Metadata */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-zinc-50 p-2.5 border border-zinc-200/80 text-zinc-700">
                    <div className="truncate">
                      <span className="text-zinc-400 block text-[8px] uppercase font-bold">Employee ID:</span>
                      <span className="font-semibold text-zinc-900">{user.employeeId || 'N/A'}</span>
                    </div>
                    <div className="truncate">
                      <span className="text-zinc-400 block text-[8px] uppercase font-bold">Department:</span>
                      <span className="font-semibold text-zinc-900 truncate block">{user.department || 'General Staff'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-zinc-50 p-2.5 border border-zinc-200/80 text-zinc-700">
                    <div className="truncate">
                      <span className="text-zinc-400 block text-[8px] uppercase font-bold">Email:</span>
                      <span className="font-semibold text-zinc-900 truncate block">{user.email || 'N/A'}</span>
                    </div>
                    <div className="truncate">
                      <span className="text-zinc-400 block text-[8px] uppercase font-bold">Phone:</span>
                      <span className="font-semibold text-zinc-900">{user.phone || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Account Actions */}
                <div className="pt-3 border-t border-zinc-150 flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button
                      id={`btn-view-profile-${user.id || user.username}`}
                      onClick={() => setSelectedProfileUser(user)}
                      className="flex-1 py-2 px-3 text-xs font-extrabold uppercase tracking-wider text-zinc-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                    >
                      <User className="h-3.5 w-3.5 text-amber-700" />
                      Profile Details
                    </button>
                    {!isRootAccount && (
                      <button
                        onClick={() => setDeletingUser(user)}
                        disabled={processingId === user.id}
                        className="py-2 px-3 text-xs font-bold uppercase tracking-wider text-red-650 bg-red-50 hover:bg-red-100 border border-red-200 cursor-pointer transition-colors flex items-center justify-center gap-1 shrink-0"
                        title="Delete account record"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    )}
                  </div>

                  {/* Primary Root Quick Role Update & Actions */}
                  {isPending && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveUser(user)}
                        disabled={processingId === user.id}
                        className="flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-950 bg-amber-400 hover:bg-amber-500 border border-amber-400 cursor-pointer flex items-center justify-center gap-1 font-black"
                      >
                        <UserCheck className="h-3 w-3 text-zinc-950" />
                        Approve
                      </button>
                      <button
                        onClick={() => setRejectingUser(user)}
                        disabled={processingId === user.id}
                        className="py-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 cursor-pointer flex items-center justify-center gap-1"
                      >
                        <UserX className="h-3 w-3" />
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Personal Profile Modal / Drawer */}
      <AnimatePresence>
        {selectedProfileUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProfileUser(null)}
              className="absolute inset-0 bg-zinc-950/40 backdrop-blur-xs"
            />

            {/* Profile Drawer Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white w-full max-w-lg border border-zinc-200 shadow-xl overflow-hidden flex flex-col relative z-10 max-h-[90vh]"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-950 text-white">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-zinc-800 text-amber-400 font-black font-mono text-sm border border-zinc-700 flex items-center justify-center uppercase">
                    {(selectedProfileUser.fullName || selectedProfileUser.username).substring(0, 2)}
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-white">
                      Personnel Profile & Account Record
                    </h3>
                    <p className="text-[10px] font-mono text-amber-300">
                      @{selectedProfileUser.username} • ID: {selectedProfileUser.employeeId || 'N/A'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedProfileUser(null)}
                  className="p-1 hover:bg-zinc-800 rounded-full transition-colors cursor-pointer text-zinc-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSaveProfileUpdates} className="p-6 overflow-y-auto space-y-4 flex-1">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                      Account Username (Static)
                    </label>
                    <input
                      type="text"
                      disabled
                      value={selectedProfileUser.username}
                      className="w-full px-3 py-2 border border-zinc-200 text-xs font-mono font-bold uppercase bg-zinc-100 text-zinc-500 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                      Employee Serial ID
                    </label>
                    <input
                      type="text"
                      disabled
                      value={selectedProfileUser.employeeId || 'NO-ID'}
                      className="w-full px-3 py-2 border border-zinc-200 text-xs font-mono font-bold uppercase bg-zinc-100 text-zinc-500 cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Password Management */}
                <div>
                  <label className="block text-[9px] font-bold text-zinc-950 uppercase tracking-widest mb-1 flex justify-between items-center">
                    <span>Account Security Password:</span>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[9px] text-amber-700 font-mono hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      {showPassword ? 'Hide Password' : 'Show Password'}
                    </button>
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="Security Password"
                      className="w-full pl-9 pr-3 py-2 border border-zinc-200 text-xs font-mono font-bold bg-zinc-50 focus:bg-white focus:outline-none focus:border-zinc-900 text-zinc-900"
                    />
                  </div>
                </div>

                {/* Legal Name */}
                <div>
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                    Full Legal Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                    <input
                      type="text"
                      required
                      value={editFullName}
                      onChange={(e) => setEditFullName(e.target.value)}
                      placeholder="e.g. MARC ALEXANDER"
                      className="w-full pl-9 pr-3 py-2 border border-zinc-200 text-xs font-semibold uppercase tracking-wider bg-zinc-50 focus:bg-white focus:outline-none focus:border-zinc-900 text-zinc-900"
                    />
                  </div>
                </div>

                {/* Contact & Department */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                      Contact Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                      <input
                        type="tel"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="+63 9xx"
                        className="w-full pl-9 pr-3 py-2 border border-zinc-200 text-xs font-semibold uppercase tracking-wider bg-zinc-50 focus:bg-white focus:outline-none focus:border-zinc-900 text-zinc-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                      Department Assignment
                    </label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                      <input
                        type="text"
                        value={editDepartment}
                        onChange={(e) => setEditDepartment(e.target.value)}
                        placeholder="e.g. FRONT DESK"
                        className="w-full pl-9 pr-3 py-2 border border-zinc-200 text-xs font-semibold uppercase tracking-wider bg-zinc-50 focus:bg-white focus:outline-none focus:border-zinc-900 text-zinc-900"
                      />
                    </div>
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                    Official Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="user@madigunhotel.com"
                      className="w-full pl-9 pr-3 py-2 border border-zinc-200 text-xs font-semibold uppercase tracking-wider bg-zinc-50 focus:bg-white focus:outline-none focus:border-zinc-900 text-zinc-900"
                    />
                  </div>
                </div>

                {/* Role & Status Selection */}
                <div className="grid grid-cols-2 gap-4 bg-amber-50/50 p-3 border border-amber-200">
                  <div>
                    <label className="block text-[9px] font-bold text-zinc-950 uppercase tracking-widest mb-1">
                      System Access Role
                    </label>
                    <select
                      disabled={selectedProfileUser.employeeId === 'EMP-2026-001'}
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as UserRole)}
                      className="w-full px-2 py-1.5 border border-zinc-300 text-xs font-bold bg-white text-zinc-950 focus:outline-none focus:border-zinc-900 font-mono disabled:bg-zinc-100 disabled:text-zinc-500"
                    >
                      <option value="Front Desk">Front Desk Staff</option>
                      <option value="Managing Director">Managing Director</option>
                      <option value="Admin">Primary Root Admin</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-zinc-950 uppercase tracking-widest mb-1">
                      Account Status
                    </label>
                    <select
                      disabled={selectedProfileUser.employeeId === 'EMP-2026-001'}
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as any)}
                      className="w-full px-2 py-1.5 border border-zinc-300 text-xs font-bold bg-white text-zinc-950 focus:outline-none focus:border-zinc-900 font-mono disabled:bg-zinc-100 disabled:text-zinc-500"
                    >
                      <option value="Approved">Approved</option>
                      <option value="Pending">Pending</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>
                </div>

                {/* Bio / Profile Notes */}
                <div>
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                    Personnel Bio / Profile Notes
                  </label>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder="Short bio or account notes..."
                    rows={2}
                    className="w-full px-3 py-2 border border-zinc-200 text-xs font-semibold bg-zinc-50 focus:bg-white focus:outline-none focus:border-zinc-900 text-zinc-900 resize-none uppercase tracking-wider"
                  />
                </div>

                {/* Footer Controls */}
                <div className="pt-4 border-t border-zinc-200 flex justify-between items-center gap-3">
                  {selectedProfileUser.employeeId !== 'EMP-2026-001' && selectedProfileUser.username.toUpperCase() !== 'ADMIN' && (
                    <button
                      type="button"
                      onClick={() => setDeletingUser(selectedProfileUser)}
                      className="py-2.5 px-3 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete Account
                    </button>
                  )}

                  <div className="flex gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => setSelectedProfileUser(null)}
                      className="px-4 py-2.5 border border-zinc-200 text-zinc-600 hover:bg-zinc-100 text-[10px] font-bold uppercase tracking-widest cursor-pointer"
                    >
                      Close
                    </button>

                    <button
                      type="submit"
                      disabled={isSavingProfile}
                      className="px-5 py-2.5 bg-zinc-950 hover:bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Save className="h-3.5 w-3.5 text-amber-400" />
                      Save Profile Updates
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete User Account Confirmation Modal */}
      <AnimatePresence>
        {deletingUser && (
          <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-zinc-200 max-w-md w-full p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-red-650">
                <div className="p-2 bg-red-50 border border-red-200">
                  <Trash2 className="h-5 w-5 text-red-650" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-zinc-900">
                    Delete Staff Account Record
                  </h3>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide">
                    @{deletingUser.username} ({deletingUser.fullName || 'No Full Name'})
                  </p>
                </div>
              </div>

              <p className="text-xs text-zinc-600 leading-relaxed">
                Are you sure you want to permanently delete the account record for <strong className="text-zinc-900">@{deletingUser.username}</strong>? This action is completely irreversible.
              </p>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingUser(null)}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-600 bg-white border border-zinc-200 hover:bg-zinc-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={processingId === deletingUser.id}
                  onClick={() => handleDeleteUserRecord(deletingUser)}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-white bg-red-650 hover:bg-red-700 disabled:opacity-50 cursor-pointer flex items-center shadow-md"
                >
                  {processingId === deletingUser.id ? 'Deleting...' : 'Confirm & Delete Record'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reject Registration Confirmation Modal */}
      <AnimatePresence>
        {rejectingUser && (
          <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-zinc-200 max-w-md w-full p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-red-650">
                <div className="p-2 bg-red-50 border border-red-200">
                  <UserX className="h-5 w-5 text-red-650" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-zinc-900">
                    Decline Registration Application
                  </h3>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide">
                    @{rejectingUser.username} ({rejectingUser.fullName || 'No Full Name'})
                  </p>
                </div>
              </div>

              <p className="text-xs text-zinc-600 leading-relaxed">
                Are you sure you want to decline registration for <strong className="text-zinc-900">@{rejectingUser.username}</strong>?
              </p>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingUser(null)}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-600 bg-white border border-zinc-200 hover:bg-zinc-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={processingId === rejectingUser.id}
                  onClick={() => handleRejectUser(rejectingUser)}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-white bg-red-650 hover:bg-red-700 disabled:opacity-50 cursor-pointer flex items-center shadow-md"
                >
                  {processingId === rejectingUser.id ? 'Processing...' : 'Confirm & Decline'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
