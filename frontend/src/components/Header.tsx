import { useState } from 'react';
import { Role, User } from '../types';
import { api } from '../services/api';
import { Award, Lock, LogOut, Sun, Moon, KeyRound, X, Check, AlertCircle } from 'lucide-react';

interface HeaderProps {
  currentUser: User | null;
  onLogout: () => void;
  currentView: 'public' | 'dashboard' | 'login';
  setView: (view: 'public' | 'dashboard' | 'login') => void;
  isDark: boolean;
  setIsDark: (dark: boolean) => void;
}

export default function Header({ currentUser, onLogout, currentView, setView, isDark, setIsDark }: HeaderProps) {
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');

    if (!pwdCurrent || !pwdNew || !pwdConfirm) {
      setPwdError('All fields are required.');
      return;
    }
    if (pwdNew.length < 6) {
      setPwdError('New password must be at least 6 characters.');
      return;
    }
    if (pwdNew !== pwdConfirm) {
      setPwdError('New passwords do not match.');
      return;
    }

    setPwdLoading(true);
    try {
      await api.changePassword(pwdCurrent, pwdNew);
      setPwdSuccess('Password changed successfully!');
      setPwdCurrent('');
      setPwdNew('');
      setPwdConfirm('');
    } catch (err: any) {
      setPwdError(err.message || 'Failed to change password.');
    } finally {
      setPwdLoading(false);
    }
  };
  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 shadow-sm transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 md:h-20">
          
          {/* Logo & Institution Brand: Navy background brand icon, custom typographic pairings */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setView('public')}>
            <div className="w-8 h-8 md:w-10 md:h-10 bg-primary dark:bg-blue-600 rounded flex items-center justify-center text-white font-extrabold text-lg md:text-xl shadow-md shadow-primary/10">
              A
            </div>
            <div>
              <h1 className="font-black text-lg leading-tight tracking-tight text-primary dark:text-white md:text-xl uppercase">
                AASTU <span className="text-slate-400 dark:text-slate-500 font-normal">| SECURECERT</span>
              </h1>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 font-mono tracking-wider uppercase font-semibold">
                 Student verification system
              </p>
            </div>
          </div>

          {/* Nav Links & Controls */}
          <div className="flex items-center space-x-2 md:space-x-4 text-xs md:text-sm font-semibold tracking-wide">
            
            {/* Quick Public Verification Access */}
            <button
              id="nav-public"
              onClick={() => setView('public')}
              className={`px-3 py-2 rounded-xl text-xs md:text-sm font-bold uppercase tracking-wider transition-all cursor-pointer ${
                currentView === 'public'
                  ? 'text-primary dark:text-blue-400 border-b-2 border-primary dark:border-blue-400 rounded-none bg-transparent'
                  : 'text-slate-500 hover:text-primary dark:hover:text-blue-400'
              }`}
            >
              Verify Portal
            </button>

            {/* Theme switch state toggle */}
            

            {currentUser ? (
              <>
                <button
                  id="nav-dashboard"
                  onClick={() => setView('dashboard')}
                  className={`px-3 py-2 rounded-xl text-xs md:text-sm font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    currentView === 'dashboard'
                      ? 'text-primary dark:text-blue-400 border-b-2 border-primary dark:border-blue-400 rounded-none bg-transparent'
                      : 'text-slate-500 hover:text-primary dark:hover:text-blue-400'
                  }`}
                >
                  Dashboard
                </button>

                <div className="flex items-center pl-2 md:pl-4 border-l border-slate-200 dark:border-slate-800 space-x-2 md:space-x-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs md:text-sm font-bold text-slate-800 dark:text-slate-200">{currentUser.username}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono uppercase tracking-widest">{currentUser.role}</p>
                  </div>
                  <button
                    id="btn-change-password"
                    onClick={() => { setShowPasswordModal(true); setPwdError(''); setPwdSuccess(''); }}
                    className="p-2 bg-slate-100 dark:bg-slate-850 hover:bg-amber-50 dark:hover:bg-amber-950 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
                    title="Change Password"
                  >
                    <KeyRound className="h-4 w-4" />
                  </button>
                  <button
                    id="btn-logout"
                    onClick={onLogout}
                    className="p-2 bg-slate-100 dark:bg-slate-850 hover:bg-rose-50 dark:hover:bg-rose-950 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
                    title="Log Out"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </>
            ) : (
              <button
                id="nav-login"
                onClick={() => setView('login')}
                className={`flex items-center space-x-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  currentView === 'login'
                    ? 'bg-primary-dark dark:bg-blue-700 text-white shadow-lg'
                    : 'bg-primary dark:bg-blue-600 text-white hover:bg-primary-dark dark:hover:bg-blue-700 shadow-sm'
                }`}
              >
                <Lock className="h-3.5 w-3.5" />
                <span>Sign In</span>
              </button>

              
            )}

            <button
              onClick={() => setIsDark(!isDark)}
              className="p-2 bg-slate-100 dark:bg-slate-850 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg transition-colors cursor-pointer"
              title={isDark ? "Light Mode" : "Dark Mode"}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

          </div>

        </div>
      </div>

      {/* ── Change Password Modal ─────────────────────────────────────────── */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4 z-55 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-850 shadow-2xl max-w-md w-full overflow-hidden transition-colors">
            
            <div className="bg-amber-600 text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <KeyRound className="h-5 w-5 text-white" />
                <h4 className="font-extrabold text-xs uppercase tracking-wider font-mono">
                  Change Password
                </h4>
              </div>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="p-1 hover:bg-amber-700 rounded cursor-pointer transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="p-6 space-y-4 text-xs font-sans">
              
              {pwdError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 text-xs font-medium rounded-lg border border-red-100 dark:border-red-900/40 flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <span>{pwdError}</span>
                </div>
              )}
              
              {pwdSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-xs font-medium rounded-lg border border-emerald-100 dark:border-emerald-900/40 flex items-start space-x-2">
                  <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>{pwdSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-400 dark:text-slate-500 font-mono uppercase tracking-widest font-bold mb-1">Current Password</label>
                <input
                  type="password"
                  required
                  placeholder="Enter current password"
                  className="w-full text-xs py-2 px-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  value={pwdCurrent}
                  onChange={(e) => setPwdCurrent(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-slate-400 dark:text-slate-500 font-mono uppercase tracking-widest font-bold mb-1">New Password</label>
                <input
                  type="password"
                  required
                  placeholder="At least 6 characters"
                  className="w-full text-xs py-2 px-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  value={pwdNew}
                  onChange={(e) => setPwdNew(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-slate-400 dark:text-slate-500 font-mono uppercase tracking-widest font-bold mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  placeholder="Re-enter new password"
                  className="w-full text-xs py-2 px-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  value={pwdConfirm}
                  onChange={(e) => setPwdConfirm(e.target.value)}
                />
              </div>

              <div className="flex space-x-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition-colors cursor-pointer border border-slate-200 dark:border-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white text-xs font-extrabold uppercase tracking-wider rounded-lg border border-amber-700 cursor-pointer shadow-sm transition-colors flex justify-center items-center"
                >
                  {pwdLoading ? 'Saving...' : 'Update'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}
      
    </header>
  );
}
