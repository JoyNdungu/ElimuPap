import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useState, useEffect } from 'react';
import { syncAllForOffline, getOfflineMeta } from '../utils/offlineSync';

const NAV = [
  {
    to: '/dashboard', end: true, label: 'Home',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.592 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
  },
  {
    to: '/notes', label: 'Library',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
  },
  {
    to: '/study-plan', label: 'Study Plan',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" /></svg>
  },
  {
    to: '/tutor', label: 'AI Tutor',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H7.5A2.25 2.25 0 005.25 6.75v10.5a2.25 2.25 0 002.25 2.25z" /></svg>
  },
];

export default function Sidebar({ hideMobileHeader = false, hideMobileNav = false }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [syncingOffline, setSyncingOffline] = useState(false);
  const [offlineMeta, setOfflineMeta] = useState(() => getOfflineMeta());
  const [syncLabel, setSyncLabel] = useState('');
  const handleLogout = () => { logout(); navigate('/'); };

  useEffect(() => {
    const onSynced = (e) => setOfflineMeta(e?.detail || getOfflineMeta());
    window.addEventListener('elimupap:offline-synced', onSynced);
    return () => window.removeEventListener('elimupap:offline-synced', onSynced);
  }, []);

  const handleSyncOffline = async () => {
    if (syncingOffline) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      alert('You are currently offline. Connect to Wi-Fi or mobile data to download your latest notes.');
      return;
    }
    setSyncingOffline(true);
    setSyncLabel('Syncing…');
    try {
      const meta = await syncAllForOffline({
        includeFiles: true,
        onProgress: (p) => setSyncLabel(p?.stage === 'files' ? 'Caching files…' : 'Syncing…'),
      });
      if (meta) setOfflineMeta(meta);
      setSyncLabel('Synced!');
      setTimeout(() => setSyncLabel(''), 2500);
    } catch (err) {
      setSyncLabel('Sync failed');
      setTimeout(() => setSyncLabel(''), 3000);
    } finally {
      setSyncingOffline(false);
    }
  };

  const isDark = theme === 'dark';

  const desktopLink = ({ isActive }) => ({
    display: 'flex', alignItems: 'center', gap: '0.85rem',
    padding: '0.75rem 1rem', borderRadius: '0.75rem',
    fontSize: '0.875rem', fontWeight: isActive ? 600 : 500,
    transition: 'all 0.15s ease',
    backgroundColor: isActive ? (isDark ? 'rgba(37,99,235,0.16)' : '#EFF6FF') : 'transparent',
    color: isActive ? (isDark ? '#ffffff' : '#1D4ED8') : (isDark ? '#9ca3af' : '#475569'),
    border: `1px solid ${isActive ? (isDark ? 'rgba(37,99,235,0.35)' : '#BFDBFE') : 'transparent'}`,
  });

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden lg:flex flex-col w-[260px] h-screen sticky top-0 flex-shrink-0 z-30 border-r transition-colors"
        style={{
          backgroundColor: isDark ? '#16181f' : '#ffffff',
          borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0',
        }}>

        {/* Logo Area */}
        <div className="px-6 pt-7 pb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#2563EB] shadow-sm">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
            </svg>
          </div>
          <div>
            <span className={`font-display text-[22px] font-bold tracking-tight leading-none block ${isDark ? 'text-white' : 'text-slate-900'}`}>ElimuPap</span>
            <span className="text-[10px] tracking-wider uppercase font-semibold text-blue-500">Study Suite</span>
          </div>
        </div>

        {/* Quick Upload Button */}
        <div className="px-4 mb-4">
          <NavLink
            to="/notes/upload"
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors shadow-sm active:scale-[0.98]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span>Upload Notes / PPT</span>
          </NavLink>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="flex-1 px-3 space-y-1.5 overflow-y-auto">
          {NAV.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end} style={desktopLink}>
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Offline Sync + Theme Toggle + User Profile Bar */}
        <div className={`p-3 mb-2 border-t ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
          <button
            onClick={handleSyncOffline}
            disabled={syncingOffline}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors mb-2 disabled:opacity-70 ${
              isDark
                ? 'text-slate-300 hover:bg-white/5 bg-white/[0.03]'
                : 'text-slate-700 hover:bg-slate-100 bg-slate-50 border border-slate-200'
            }`}
            title="Download all notes, summaries, flashcards & study files for offline reading"
          >
            <span className="flex items-center gap-2">
              <svg className={`w-4 h-4 ${syncingOffline ? 'animate-spin text-[#2563EB]' : 'text-emerald-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M7.5 12l4.5 4.5m0 0l4.5-4.5M12 16.5V3" />
              </svg>
              <span>{syncLabel || (offlineMeta ? 'Offline Ready' : 'Save Offline')}</span>
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
              offlineMeta
                ? (isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700 border border-emerald-200')
                : (isDark ? 'bg-white/10 text-slate-300' : 'bg-slate-200 text-slate-700')
            }`}>
              {offlineMeta ? `${offlineMeta.noteCount} notes` : 'Sync'}
            </span>
          </button>

          <button
            onClick={toggleTheme}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors mb-2 ${
              isDark
                ? 'text-slate-300 hover:bg-white/5 bg-white/[0.03]'
                : 'text-slate-700 hover:bg-slate-100 bg-slate-50 border border-slate-200'
            }`}
            title="Switch Light / Dark Mode"
          >
            <span className="flex items-center gap-2">
              {isDark ? (
                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
              )}
              <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${isDark ? 'bg-white/10 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>
              {isDark ? 'Dark' : 'Light'}
            </span>
          </button>

          <NavLink to="/profile"
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}
            style={({ isActive }) => ({
              backgroundColor: isActive ? (isDark ? 'rgba(37,99,235,0.14)' : '#EFF6FF') : 'transparent',
              color: isActive ? (isDark ? '#93c5fd' : '#1d4ed8') : (isDark ? '#9ca3af' : '#475569'),
            })}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 bg-slate-700 dark:bg-slate-600">
              {(user?.name || 'U')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className={`text-xs font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{user?.name || 'Student'}</p>
              <p className="text-[10px] text-gray-500 truncate">{user?.university || user?.course || 'Campus Account'}</p>
            </div>
          </NavLink>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors mt-1 text-gray-400 hover:text-red-500 hover:bg-red-500/10">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile Top Header ── */}
      {!hideMobileHeader && (
        <header className={`lg:hidden w-full flex-shrink-0 sticky top-0 z-40 flex items-center justify-between h-14 px-4 backdrop-blur-md border-b ${
          isDark ? 'bg-[#16181f]/95 border-white/5' : 'bg-white/95 border-slate-200'
        }`}>
          <NavLink to="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#2563EB]">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
              </svg>
            </div>
            <span className={`font-display font-bold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>ElimuPap</span>
          </NavLink>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className={`p-1.5 rounded-lg border transition ${
                isDark ? 'border-white/10 text-amber-400 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
              aria-label="Toggle theme"
            >
              {isDark ? '☀️' : '🌙'}
            </button>
            <NavLink
              to="/notes/upload"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#2563EB] text-white"
            >
              <span>+</span> Upload
            </NavLink>

            <button
              onClick={() => setDrawerOpen(true)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-slate-700"
              aria-label="Account Menu"
            >
              {(user?.name || 'U')[0].toUpperCase()}
            </button>
          </div>
        </header>
      )}

      {/* ── Mobile Bottom Navigation Bar ── */}
      {!hideMobileNav && (
        <nav className={`lg:hidden fixed bottom-0 left-0 right-0 z-40 backdrop-blur-lg border-t px-2 py-1.5 flex items-center justify-around ${
          isDark ? 'bg-[#16181f]/95 border-white/10' : 'bg-white/95 border-slate-200'
        }`}
          style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
          aria-label="Bottom Navigation">
        
        {/* Home */}
        <NavLink
          to="/dashboard"
          end
          className={({ isActive }) => `flex flex-col items-center justify-center py-1 px-3 rounded-xl transition ${
            isActive ? 'text-[#2563EB]' : 'text-gray-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.592 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
          <span className="text-[10px] font-medium mt-0.5">Home</span>
        </NavLink>

        {/* Library */}
        <NavLink
          to="/notes"
          className={({ isActive }) => `flex flex-col items-center justify-center py-1 px-3 rounded-xl transition ${
            isActive ? 'text-[#2563EB]' : 'text-gray-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <span className="text-[10px] font-medium mt-0.5">Library</span>
        </NavLink>

        {/* Prominent Center Upload Action */}
        <NavLink
          to="/notes/upload"
          className="flex flex-col items-center justify-center -mt-5"
          aria-label="Upload document"
        >
          <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md text-white bg-[#2563EB] hover:bg-[#1D4ED8] ring-4 active:scale-95 transition ${
            isDark ? 'ring-[#16181f]' : 'ring-white'
          }`}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <span className="text-[9px] font-semibold text-blue-500 mt-1">Upload</span>
        </NavLink>

        {/* Study Plan */}
        <NavLink
          to="/study-plan"
          className={({ isActive }) => `flex flex-col items-center justify-center py-1 px-3 rounded-xl transition ${
            isActive ? 'text-[#2563EB]' : 'text-gray-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          <span className="text-[10px] font-medium mt-0.5">Plan</span>
        </NavLink>

        {/* AI Tutor */}
        <NavLink
          to="/tutor"
          className={({ isActive }) => `flex flex-col items-center justify-center py-1 px-3 rounded-xl transition ${
            isActive ? 'text-[#2563EB]' : 'text-gray-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H7.5A2.25 2.25 0 005.25 6.75v10.5a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <span className="text-[10px] font-medium mt-0.5">Tutor</span>
        </NavLink>
      </nav>
      )}

      {/* ── Mobile Account Drawer ── */}
      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-50 lg:hidden bg-black/70 backdrop-blur-sm animate-fade-in"
            onClick={() => setDrawerOpen(false)} />
          <aside className="fixed inset-y-0 right-0 z-50 w-72 flex flex-col lg:hidden bg-[#181824] border-l border-white/10 animate-slide-up shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <span className="font-display font-bold text-white text-base">Student Account</span>
              <button onClick={() => setDrawerOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-white bg-white/5" aria-label="Close">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-4 border-b border-white/5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white bg-gradient-to-tr from-[#5B57FF] to-[#9b59ff] shadow">
                {(user?.name || 'U')[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
                <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                <span className="text-[10px] font-mono text-indigo-400">{user?.university || 'University Student'}</span>
              </div>
            </div>

            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              <NavLink to="/profile" onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5">
                <span>👤</span> Profile & Settings
              </NavLink>
              <NavLink to="/notes" onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5">
                <span>📚</span> All Notes & Units
              </NavLink>
              <NavLink to="/study-plan" onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5">
                <span>📅</span> Exam Schedule & Plan
              </NavLink>
              <NavLink to="/tutor" onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5">
                <span>🤖</span> Ask ElimuPap Tutor
              </NavLink>
            </nav>

            <div className="p-3 border-t border-white/5 space-y-2">
              <button
                onClick={handleSyncOffline}
                disabled={syncingOffline}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition"
              >
                <span>⬇️</span>
                <span>{syncLabel || (offlineMeta ? `Offline Ready (${offlineMeta.noteCount} notes)` : 'Save Notes Offline')}</span>
              </button>
              <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 transition">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Log out</span>
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
