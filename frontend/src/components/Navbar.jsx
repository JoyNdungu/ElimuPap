import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleOutside = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setMobileOpen(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [mobileOpen]);

  const handleLogout = () => { logout(); navigate('/'); setMobileOpen(false); };

  /* ── resolved class strings so they never get overridden by global CSS ── */
  const navBg    = isDark ? 'bg-[#111318]' : 'bg-white';
  const logoText = isDark ? 'text-white'   : 'text-slate-900';
  const linkText = isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900';
  const toggleBorder = isDark ? 'border-white/10' : 'border-slate-200';
  const toggleColor  = isDark ? 'text-amber-400'  : 'text-slate-500';
  const toggleHover  = isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100';
  const logoutCls    = isDark
    ? 'border-white/10 text-slate-300 hover:bg-white/5'
    : 'border-slate-200 text-slate-600 hover:bg-slate-100';
  const loginText    = isDark ? 'text-gray-300 hover:text-white' : 'text-slate-700 hover:text-slate-900';
  const mobileBg     = isDark ? 'bg-[#16181f] border-white/5' : 'bg-white border-slate-200';
  const mobileLink   = isDark ? 'text-gray-300' : 'text-slate-700';
  const hamburgerClr = isDark ? 'text-gray-400' : 'text-slate-600';
  const navBorder    = isDark ? 'border-white/5' : 'border-slate-200';

  return (
    <nav
      ref={navRef}
      className={`sticky top-0 z-50 font-sans ${navBg} backdrop-blur-md border-b ${navBorder} transition-colors`}
      aria-label="Main navigation"
    >
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8 flex items-center h-[72px] relative">

        {/* Logo */}
        <div className="flex-1 flex justify-start">
          <Link
            to="/"
            className={`font-display text-[22px] hover:opacity-80 transition-opacity ${logoText}`}
            aria-label="ElimuPap home"
          >
            ElimuPap
          </Link>
        </div>

        {/* Center Nav Links */}
        <div className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
          {['Features', 'How it Works'].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase().replace(/ /g, '-')}`}
              className={`text-[13px] font-medium transition-colors ${linkText}`}
            >
              {item}
            </a>
          ))}
        </div>

        {/* Right Actions */}
        <div className="hidden md:flex flex-1 justify-end items-center gap-4">

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg border transition-colors ${toggleBorder} ${toggleColor} ${toggleHover}`}
            aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? (
              /* Sun icon — click to go light */
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
            ) : (
              /* Moon icon — click to go dark */
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            )}
          </button>

          {/* Auth buttons */}
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <button
                onClick={handleLogout}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${logoutCls}`}
              >
                Log out
              </button>
              <Link
                to="/dashboard"
                className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center text-xs font-semibold text-white"
              >
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className={`text-[13px] font-medium px-3 py-1.5 transition-colors ${loginText}`}
              >
                Log In
              </Link>
              <Link
                to="/register"
                className="text-[13px] font-medium px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors shadow-sm"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>

        {/* Mobile: theme + hamburger */}
        <div className="md:hidden flex items-center gap-2 absolute right-6">
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg border ${toggleBorder} ${toggleColor} ${toggleHover}`}
            aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            )}
          </button>
          <button
            onClick={() => setMobileOpen(v => !v)}
            className={`p-2 ${hamburgerClr}`}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {mobileOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className={`md:hidden px-8 pb-6 pt-4 flex flex-col gap-4 animate-fade-in absolute w-full border-b shadow-lg ${mobileBg}`}>
          {['Features', 'How it Works'].map(item => (
            <a
              key={item}
              href={`#${item.toLowerCase().replace(/ /g, '-')}`}
              className={`text-[14px] ${mobileLink}`}
              onClick={() => setMobileOpen(false)}
            >
              {item}
            </a>
          ))}
          {isAuthenticated
            ? <button onClick={handleLogout} className={`text-left text-[14px] ${mobileLink}`}>Log out</button>
            : <Link to="/login" className={`text-[14px] ${mobileLink}`} onClick={() => setMobileOpen(false)}>Log In</Link>
          }
        </div>
      )}
    </nav>
  );
}
