import { useState, useEffect } from 'react';
import Header from './components/Header';
import PublicPortal from './components/PublicPortal';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import IssuerDashboard from './components/IssuerDashboard';
import StudentDashboard from './components/StudentDashboard';
import { User } from './types';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setView] = useState<'public' | 'dashboard' | 'login'>('public');
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('aastu_theme_dark');
    return saved === 'true';
  });

  // Theme synchronization effect
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('aastu_theme_dark', String(isDark));
  }, [isDark]);

  // Sync user session with LocalStorage on launch
  useEffect(() => {
    const savedUser = localStorage.getItem('aastu_blockchain_cur_user');
    const savedToken = localStorage.getItem('aastu_blockchain_cur_token');
    if (savedUser && savedToken) {
      try {
        setCurrentUser(JSON.parse(savedUser));
        setView('dashboard');
      } catch {
        localStorage.removeItem('aastu_blockchain_cur_user');
        localStorage.removeItem('aastu_blockchain_cur_token');
      }
    }

    // Advanced URL Routing: Catch QR code link verification (e.g., /verify/AASTU-2024-0001)
    const path = window.location.pathname;
    if (path.includes('/verify/')) {
      // Find the cert ID
      const parts = path.split('/verify/');
      const certId = parts[parts.length - 1];
      if (certId) {
        // Change URL back to normal SPA root to avoid routing error but pass code verification trigger
        window.history.replaceState({ certId }, '', '/');
        // Let component read history state or we can store in sessionStorage for PublicPortal to grab!
        sessionStorage.setItem('prefilled_verify_id', certId);
      }
    }
  }, []);

  const handleLoginSuccess = (token: string, user: User) => {
    setCurrentUser(user);
    localStorage.setItem('aastu_blockchain_cur_user', JSON.stringify(user));
    localStorage.setItem('aastu_blockchain_cur_token', token);
    setView('dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('aastu_blockchain_cur_user');
    localStorage.removeItem('aastu_blockchain_cur_token');
    setView('public');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors selection:bg-blue-500 selection:text-white flex flex-col">
      
      {/* Universal Institutional Header (AASTU ECE Department) */}
      <Header 
        currentUser={currentUser} 
        onLogout={handleLogout} 
        currentView={currentView} 
        setView={setView} 
        isDark={isDark}
        setIsDark={setIsDark}
      />

      {/* Main Viewport Router */}
      <main className="flex-1 pb-16">
        
        {currentView === 'public' && (
          <div className="animate-fade-in">
            <PublicPortal />
          </div>
        )}

        {currentView === 'login' && (
          <div className="animate-fade-in">
            <Login onLoginSuccess={handleLoginSuccess} />
          </div>
        )}

        {currentView === 'dashboard' && currentUser && (
          <div className="animate-fade-in">
            {currentUser.role === 'Admin' && (
              <AdminDashboard currentUser={currentUser} />
            )}
            {currentUser.role === 'Issuer' && (
              <IssuerDashboard currentUser={currentUser} />
            )}
            {currentUser.role === 'Student' && (
              <StudentDashboard currentUser={currentUser} />
            )}
          </div>
        )}

      </main>

      {/* Page Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-500 text-center py-6 text-xs font-mono">
        <div className="max-w-7xl mx-auto px-4">
          <p>© {new Date().getFullYear()} All Rights Reserved.</p>
        </div>
      </footer>

    </div>
  );
}
