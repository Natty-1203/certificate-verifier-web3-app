import React, { useState } from 'react';
import { api } from '../services/api';
import { User } from '../types';
import { Lock, AlertCircle, UserPlus, ArrowLeft, Mail, BookOpen, CheckCircle } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (token: string, user: User) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Registration fields
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regStudentId, setRegStudentId] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regSuccess, setRegSuccess] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const result = await api.login(username.trim(), password.trim());
      onLoginSuccess(result.token, result.user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Incorrect credentials entered. Connection block.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setRegSuccess('');

    if (!regUsername.trim() || !regPassword.trim() || !regEmail.trim() || !regStudentId.trim()) {
      setErrorMsg('All fields marked with * are required.');
      return;
    }

    setLoading(true);
    try {
      await api.register({
        username: regUsername.trim(),
        password: regPassword.trim(),
        email: regEmail.trim(),
        student_id: regStudentId.trim(),
        full_name: regFullName.trim() || undefined,
      });
      setRegSuccess('Account created! You can now log in.');
      setTimeout(() => { setMode('login'); setRegSuccess(''); }, 2000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors">
        
        <div className="bg-primary dark:bg-slate-950 px-6 py-8 text-center text-white relative border-b border-light dark:border-slate-800">
          <div className="absolute top-4 right-4 text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest font-black">
            {mode === 'login' ? 'SECURE PORTAL' : 'STUDENT REGISTRATION'}
          </div>
          {mode === 'login' ? (
            <>
              <Lock className="h-8 w-8 text-amber-500 mx-auto mb-2" />
              <h3 className="font-extrabold text-lg font-sans tracking-tight uppercase">Institutional Portal</h3>
              <p className="text-xs text-slate-300 dark:text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                Enter your credentials to manage and audit university degrees.
              </p>
            </>
          ) : (
            <>
              <UserPlus className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
              <h3 className="font-extrabold text-lg font-sans tracking-tight uppercase">Student Self-Service</h3>
              <p className="text-xs text-slate-300 dark:text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                Register to view your certificates and download verified PDFs.
              </p>
            </>
          )}
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="p-6 sm:p-8 space-y-4">
            {errorMsg && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-350 text-xs font-medium rounded-lg border border-red-100 dark:border-red-900/50 flex items-start space-x-2">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 font-bold">Username ID</label>
              <input id="input-username" type="text" required placeholder="Enter username"
                className="w-full bg-slate-50/50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary dark:focus:ring-blue-600"
                value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 font-bold">Passkey</label>
              <input id="input-password" type="password" required placeholder="••••••••••••"
                className="w-full bg-slate-50/50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary dark:focus:ring-blue-600"
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            <button id="btn-submit-login" type="submit" disabled={loading}
              className="w-full bg-primary dark:bg-blue-600 hover:bg-primary-dark dark:hover:bg-blue-700 disabled:bg-slate-400 text-white font-bold py-3 px-4 rounded-xl text-xs sm:text-sm tracking-widest transition-all cursor-pointer flex justify-center items-center uppercase">
              {loading ? (
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : <span>Sign In</span>}
            </button>

            <div className="text-center pt-2 border-t border-slate-100 dark:border-slate-800">
              <button type="button" onClick={() => { setMode('register'); setErrorMsg(''); }}
                className="text-xs text-primary dark:text-blue-400 hover:underline font-semibold cursor-pointer">
                New student? Register here
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="p-6 sm:p-8 space-y-4">
            {errorMsg && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-350 text-xs font-medium rounded-lg border border-red-100 dark:border-red-900/50 flex items-start space-x-2">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}
            {regSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-xs font-medium rounded-lg border border-emerald-100 dark:border-emerald-900/50 flex items-start space-x-2">
                <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>{regSuccess}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 font-bold">Full Name <span className="text-slate-300">(optional)</span></label>
              <input type="text" placeholder="e.g. Dawit Yohannes"
                className="w-full bg-slate-50/50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary"
                value={regFullName} onChange={(e) => setRegFullName(e.target.value)} />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 font-bold">Username *</label>
              <input type="text" required placeholder="Choose a username"
                className="w-full bg-slate-50/50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary"
                value={regUsername} onChange={(e) => setRegUsername(e.target.value)} />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 font-bold">Password *</label>
              <input type="password" required placeholder="At least 6 characters"
                className="w-full bg-slate-50/50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary"
                value={regPassword} onChange={(e) => setRegPassword(e.target.value)} />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 font-bold">
                <Mail className="h-3 w-3 inline mr-1" />Email *
              </label>
              <input type="email" required placeholder="you@example.com"
                className="w-full bg-slate-50/50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary"
                value={regEmail} onChange={(e) => setRegEmail(e.target.value)} />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 font-bold">
                <BookOpen className="h-3 w-3 inline mr-1" />Student ID *
              </label>
              <input type="text" required placeholder="e.g. ETS0951/15"
                className="w-full bg-slate-50/50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary"
                value={regStudentId} onChange={(e) => setRegStudentId(e.target.value)} />
            </div>

            <div className="flex space-x-2 pt-2">
              <button type="button" onClick={() => { setMode('login'); setErrorMsg(''); }}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-lg cursor-pointer flex items-center space-x-1">
                <ArrowLeft className="h-3 w-3" />
                <span>Back</span>
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-bold text-xs rounded-lg transition-all cursor-pointer flex justify-center items-center space-x-1 uppercase">
                {loading ? (
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : <span>Register</span>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
