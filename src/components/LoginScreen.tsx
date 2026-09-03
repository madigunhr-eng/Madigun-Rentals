import React, { useState } from 'react';
import { motion } from 'motion/react';
import { User, HelpCircle, ArrowRight, Lock, UserPlus, CheckCircle2, Mail, Phone, Building, ShieldCheck } from 'lucide-react';
import { UserSession, UserRole } from '../types';
import MadigunLogo from './MadigunLogo';
import { localStore } from '../localStore';

interface LoginScreenProps {
  onLogin: (session: UserSession) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  
  // Login Form States
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Registration Form States
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regDepartment, setRegDepartment] = useState('Front Desk Operations');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setErrorMsg('Please enter your Username');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your account password');
      return;
    }

    try {
      setIsAuthenticating(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      let usersList = localStore.getCollection<any>('users');

      if (usersList.length === 0) {
        setErrorMsg('No accounts exist in the database. Please click the Register tab above to create your primary administrator account.');
        setIsAuthenticating(false);
        return;
      }

      // Match users in-memory for flexible case-insensitive and trimmed name matching (stripping spaces)
      const cleanMatchInput = username.replace(/\s+/g, '').toLowerCase();
      const matchedUser = usersList.find((u: any) => 
        (u.username || '').replace(/\s+/g, '').toLowerCase() === cleanMatchInput
      );

      if (!matchedUser) {
        setErrorMsg('Authorized profile not found. Please verify your Username.');
        setIsAuthenticating(false);
        return;
      }

      // Check Password
      if (matchedUser.password !== password) {
        setErrorMsg('Access Denied: Incorrect password.');
        setIsAuthenticating(false);
        return;
      }

      // Check Approval Status
      if (matchedUser.status === 'Pending' || matchedUser.role === 'Pending') {
        setErrorMsg('Account Pending Approval: Your registration is awaiting approval and role assignment from the System Administrator.');
        setIsAuthenticating(false);
        return;
      }

      if (matchedUser.status === 'Rejected') {
        setErrorMsg('Access Denied: Your registration request was declined by administration.');
        setIsAuthenticating(false);
        return;
      }

      // All checks passed! Start Session
      onLogin({
        username: matchedUser.username,
        employeeId: matchedUser.employeeId || 'EMP-001',
        role: matchedUser.role || 'Front Desk',
        status: matchedUser.status || 'Approved',
        fullName: matchedUser.fullName || '',
        phone: matchedUser.phone || '',
        email: matchedUser.email || '',
        department: matchedUser.department || '',
        bio: matchedUser.bio || ''
      });

    } catch (err: any) {
      console.warn("Authentication error in LoginScreen:", err);
      setErrorMsg(err.message || 'System authentication error.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regUsername.trim()) return setErrorMsg('Please enter a desired Username.');
    if (!regFullName.trim()) return setErrorMsg('Please enter your Full Name.');
    if (!regPassword) return setErrorMsg('Please choose a password.');
    if (regPassword !== regConfirmPassword) return setErrorMsg('Passwords do not match.');

    try {
      setIsAuthenticating(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const usersList = localStore.getCollection<any>('users');
      const isFirstUser = usersList.length === 0;

      const cleanNewUser = regUsername.trim().toLowerCase();
      const exists = usersList.some((u: any) => (u.username || '').toLowerCase() === cleanNewUser || (regEmail && u.email?.toLowerCase() === regEmail.trim().toLowerCase()));

      if (exists) {
        setErrorMsg('An account with this Username or Email already exists.');
        setIsAuthenticating(false);
        return;
      }

      const generatedEmpId = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
      const assignedRole: UserRole | 'Pending' = isFirstUser ? 'Admin' : 'Pending';
      const assignedStatus: 'Approved' | 'Pending' = isFirstUser ? 'Approved' : 'Pending';

      const newUserDoc = {
        username: regUsername.toUpperCase().trim(),
        password: regPassword,
        role: assignedRole,
        status: assignedStatus,
        employeeId: generatedEmpId,
        fullName: regFullName.trim(),
        email: regEmail.trim(),
        phone: regPhone.trim(),
        department: regDepartment.trim() || (isFirstUser ? 'Executive Administration' : 'Operations'),
        bio: isFirstUser ? 'Primary root organization administrator.' : 'Registered user account awaiting Primary Administrator approval.',
        createdAt: new Date().toISOString()
      };

      await localStore.addItem('users', newUserDoc);

      if (isFirstUser) {
        setSuccessMsg(`Primary Administrator account created successfully! Signing in...`);
        setTimeout(() => {
          onLogin({
            username: newUserDoc.username,
            employeeId: newUserDoc.employeeId,
            role: 'Admin',
            status: 'Approved',
            fullName: newUserDoc.fullName,
            email: newUserDoc.email,
            phone: newUserDoc.phone,
            department: newUserDoc.department,
            bio: newUserDoc.bio
          });
        }, 600);
        return;
      }

      setSuccessMsg(`Registration submitted successfully! Your account (${generatedEmpId}) is PENDING APPROVAL. The Primary Administrator must approve your account before you can log in.`);
      setUsername(regUsername.toUpperCase().trim());
      setPassword('');
      setRegUsername('');
      setRegPassword('');
      setRegConfirmPassword('');
      setRegFullName('');
      setRegEmail('');
      setRegPhone('');
      setMode('login');

    } catch (err: any) {
      setErrorMsg('Failed to submit registration: ' + err.message);
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4 sm:p-6 font-sans text-zinc-900 relative overflow-hidden">
      
      {/* Decorative Grid Accents consistent with Swiss Minimal design */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px]"></div>
      
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative w-full max-w-md bg-white border border-zinc-200 shadow-xl p-8 z-10 my-6"
      >
        
        {/* Crest Logo Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <MadigunLogo showText={true} className="mb-2" />
          <div className="h-[1px] w-12 bg-[#C3B5A6] my-3"></div>
          <h2 className="text-sm font-black font-mono tracking-[0.2em] text-zinc-900 uppercase">
            Madigun Rental Systems
          </h2>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex border-b border-zinc-200 mb-6 font-mono text-xs">
          <button
            id="tab-mode-login"
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer text-center ${
              mode === 'login'
                ? 'border-zinc-900 text-zinc-900 bg-zinc-50'
                : 'border-transparent text-zinc-400 hover:text-zinc-700'
            }`}
          >
            Sign In
          </button>
          <button
            id="tab-mode-register"
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5 ${
              mode === 'register'
                ? 'border-amber-500 text-zinc-950 bg-amber-50/50'
                : 'border-transparent text-zinc-400 hover:text-zinc-700'
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Register
          </button>
        </div>

        {successMsg && (
          <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold uppercase tracking-wide flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>{successMsg}</div>
          </div>
        )}

        {errorMsg && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold uppercase tracking-wide flex items-start gap-2">
            <span className="w-1.5 h-1.5 bg-red-600 rounded-full mt-1.5 shrink-0"></span>
            <div>{errorMsg}</div>
          </div>
        )}

        {/* LOGIN FORM */}
        {mode === 'login' && (
          <form onSubmit={handleSubmitLogin} className="space-y-4">
            <div>
              <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 h-3.5 w-3.5 text-zinc-400" />
                <input
                  id="input-login-username"
                  type="text"
                  placeholder="e.g. ADMIN or MARC"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 py-2.5 pl-10 pr-4 text-xs font-semibold focus:outline-none focus:border-zinc-900 transition-colors placeholder:text-zinc-400 font-mono tracking-wider uppercase"
                />
              </div>
            </div>

            <div>
              <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-3.5 w-3.5 text-zinc-400" />
                <input
                  id="input-login-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 py-2.5 pl-10 pr-4 text-xs font-semibold focus:outline-none focus:border-zinc-900 transition-colors placeholder:text-zinc-450"
                />
              </div>
            </div>

            <button
              id="btn-login-submit"
              type="submit"
              disabled={isAuthenticating}
              className="w-full bg-zinc-950 hover:bg-zinc-800 disabled:bg-zinc-400 text-white font-bold text-[10px] uppercase tracking-widest py-3 flex items-center justify-center gap-2 border border-zinc-950 transition-colors cursor-pointer mt-2"
            >
              <span>{isAuthenticating ? 'Authenticating Ledger...' : 'Initialize Terminal Session'}</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </form>
        )}

        {/* REGISTER FORM */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div>
              <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                Full Name *
              </label>
              <input
                id="input-reg-fullname"
                type="text"
                required
                placeholder="e.g. John Santos"
                value={regFullName}
                onChange={(e) => setRegFullName(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 py-2 px-3 text-xs font-semibold focus:outline-none focus:border-zinc-900 text-zinc-850"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                  Desired Username *
                </label>
                <input
                  id="input-reg-username"
                  type="text"
                  required
                  placeholder="e.g. JOHN"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 py-2 px-3 text-xs font-mono font-bold focus:outline-none focus:border-zinc-900 uppercase text-zinc-850"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                  Department
                </label>
                <input
                  id="input-reg-department"
                  type="text"
                  placeholder="e.g. Front Desk"
                  value={regDepartment}
                  onChange={(e) => setRegDepartment(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 py-2 px-3 text-xs font-semibold focus:outline-none focus:border-zinc-900 text-zinc-850"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                  Email Address
                </label>
                <input
                  id="input-reg-email"
                  type="email"
                  placeholder="john@madigun.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 py-2 px-3 text-xs font-semibold focus:outline-none focus:border-zinc-900 text-zinc-850"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                  Phone Number
                </label>
                <input
                  id="input-reg-phone"
                  type="text"
                  placeholder="+63 912 345 6789"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 py-2 px-3 text-xs font-semibold focus:outline-none focus:border-zinc-900 text-zinc-850"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                  Password *
                </label>
                <input
                  id="input-reg-password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 py-2 px-3 text-xs font-semibold focus:outline-none focus:border-zinc-900"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                  Confirm Password *
                </label>
                <input
                  id="input-reg-confirmpassword"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 py-2 px-3 text-xs font-semibold focus:outline-none focus:border-zinc-900"
                />
              </div>
            </div>

            <button
              id="btn-register-submit"
              type="submit"
              disabled={isAuthenticating}
              className="w-full bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-400 text-white font-bold text-[10px] uppercase tracking-widest py-3 flex items-center justify-center gap-2 border border-zinc-900 transition-colors cursor-pointer"
            >
              <span>{isAuthenticating ? 'Submitting Registration...' : 'Submit Application For Approval'}</span>
              <UserPlus className="h-3.5 w-3.5" />
            </button>
          </form>
        )}

        {/* Footnote */}
        <div className="mt-6 text-center text-[8px] text-zinc-400 font-semibold tracking-wider uppercase flex items-center justify-center gap-1">
          <HelpCircle className="h-2.5 w-2.5" />
          <span>Restricted to authorized Madigun personnel</span>
        </div>

      </motion.div>
    </div>
  );
}

