import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/'); setMobileOpen(false); };

  return (
    <nav
      style={{ backgroundColor: '#13131f', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}
      className="sticky top-0 z-50 font-sans"
      aria-label="Main navigation"
    >
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8 flex items-center h-[72px] relative">

        {/* Logo (Left) */}
        <div className="flex-1 flex justify-start">
          <Link to="/" className="font-display text-[#ffffff] text-[22px] hover:opacity-80 transition-opacity" aria-label="ElimuPap home">
            ElimuPap
          </Link>
        </div>

        {/* Center Nav */}
        <div className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
          {['Features', 'How it Works'].map((item) => (
            <a key={item} href={`#${item.toLowerCase().replace(/ /g, '-')}`}
              className="text-[13px] transition-colors"
              style={{ color: '#9ca3af' }}
              onMouseEnter={e => e.currentTarget.style.color = '#fff'}
              onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}
            >
              {item}
            </a>
          ))}
        </div>

        {/* Right Actions */}
        <div className="hidden md:flex flex-1 justify-end items-center gap-5">


          {/* Bell */}
          <button className="transition-colors hover:text-white" style={{ color: '#9ca3af' }} aria-label="Notifications">
            <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
          </button>

          {/* Avatar / auth */}
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <button
                onClick={handleLogout}
                className="text-xs px-2 py-1 rounded transition-colors"
                style={{ border: '1px solid #2d2d4a', color: '#9898c0', backgroundColor: 'transparent' }}
              >
                Log out
              </button>
              <div className="w-7 h-7 rounded-full overflow-hidden border border-gray-700 bg-[#2d2d3d] flex items-center justify-center">
                <span className="text-white text-[10px] font-medium">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Link to="/login"
                className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center"
                style={{ border: '1px solid #374151', backgroundColor: '#11111a' }}>
                <img src="https://ui-avatars.com/api/?name=Guest&background=11111a&color=fff" alt="Profile" className="w-full h-full object-cover" />
              </Link>
            </div>
          )}
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden p-2 absolute right-6" style={{ color: '#9ca3af' }}
          onClick={() => setMobileOpen(v => !v)} aria-label="Toggle menu">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {mobileOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden px-8 pb-6 pt-4 flex flex-col gap-4 animate-fade-in absolute w-full"
          style={{ backgroundColor: '#13131f', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
          {['Features', 'How it Works'].map(item => (
            <a key={item} href={`#${item.toLowerCase().replace(/ /g, '-')}`} className="text-[14px]" style={{ color: '#9ca3af' }} onClick={() => setMobileOpen(false)}>{item}</a>
          ))}
          {isAuthenticated
            ? <button onClick={handleLogout} className="text-left text-[14px]" style={{ color: '#9ca3af' }}>Log out</button>
            : <Link to="/login" className="text-[14px]" style={{ color: '#9ca3af' }} onClick={() => setMobileOpen(false)}>Log In</Link>
          }
        </div>
      )}
    </nav>
  );
}
