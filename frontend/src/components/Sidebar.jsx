import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

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
    to: '/tutor', label: 'ElimuPap Tutor',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H7.5A2.25 2.25 0 005.25 6.75v10.5a2.25 2.25 0 002.25 2.25z" /></svg>
  },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const handleLogout = () => { logout(); navigate('/'); };

  const desktopLink = ({ isActive }) => ({
    display: 'flex', alignItems: 'center', gap: '1rem',
    padding: '0.75rem 1rem', borderRadius: '0.5rem',
    fontSize: '0.9rem', fontWeight: 500,
    transition: 'all 0.15s',
    backgroundColor: isActive ? '#2b2b36' : 'transparent',
    color: isActive ? '#ffffff' : '#9898c0',
  });

  const mobileLink = ({ isActive }) => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: '0.2rem', padding: '0.5rem 0.75rem', flex: 1,
    color: isActive ? '#ffffff' : '#9898c0',
    transition: 'color 0.15s',
  });

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-[260px] h-screen sticky top-0 flex-shrink-0"
        style={{ backgroundColor: '#1e1e28', borderRight: '1px solid rgba(255,255,255,0.03)' }}>

        {/* Logo Area */}
        <div className="px-6 py-8 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg" style={{ backgroundColor: '#13131f' }}>
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
            </svg>
          </div>
          <div>
            <span className="font-display text-[22px] text-white leading-none tracking-tight">ElimuPap</span>
            <p className="text-[10px] tracking-wide uppercase font-semibold mt-0.5" style={{ color: '#9898c0' }}>Academic Assistant</p>
          </div>
        </div>



        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {NAV.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end} style={desktopLink}>
              {item.icon}{item.label}
            </NavLink>
          ))}
        </nav>

        {/* User profile block */}
        <div className="p-3 mb-2" style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
          <NavLink to="/profile"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group"
            style={({ isActive }) => ({
              backgroundColor: isActive ? 'rgba(91,87,255,0.15)' : 'transparent',
              color: isActive ? '#c4c2ff' : '#9898c0',
            })}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #5B57FF, #9b59ff)' }}>
              {(user?.name || 'U')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-[11px] truncate" style={{ color: '#6b7280' }}>{user?.year_of_study} · {user?.course}</p>
            </div>
          </NavLink>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors mt-1"
            style={{ color: '#9898c0' }}
            onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
            onMouseLeave={e => e.currentTarget.style.color = '#9898c0'}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Log out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between h-14 px-5"
        style={{ backgroundColor: '#1e1e28', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
        <span className="font-display text-base text-white">ElimuPap</span>
        <button onClick={() => setDrawerOpen(true)} className="p-2" style={{ color: '#9898c0' }} aria-label="Open menu" id="sidebar-mobile-open-btn">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex"
        style={{ backgroundColor: '#1e1e28', borderTop: '1px solid rgba(255,255,255,0.03)' }}
        aria-label="Bottom navigation">
        {NAV.map(item => (
          <NavLink key={item.to} to={item.to} end={item.end} style={mobileLink}>
            {item.icon}
            <span style={{ fontSize: '0.6rem', fontWeight: 500 }}>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-50 lg:hidden animate-fade-in"
            style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
            onClick={() => setDrawerOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 flex flex-col lg:hidden animate-slide-up"
            style={{ backgroundColor: '#1e1e28', borderRight: '1px solid rgba(255,255,255,0.03)' }}>
            <div className="flex items-center justify-between px-4 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <span className="font-display text-white">ElimuPap</span>
              <button onClick={() => setDrawerOpen(false)} style={{ color: '#9898c0' }} aria-label="Close" id="sidebar-mobile-close-btn">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <p className="text-sm font-medium text-white">{user?.name}</p>
              <p className="text-xs" style={{ color: '#7070b0' }}>{user?.university}</p>
            </div>
            <nav className="flex-1 py-3 px-2 space-y-1">
              {NAV.map(item => (
                <NavLink key={item.to} to={item.to} end={item.end} style={desktopLink} onClick={() => setDrawerOpen(false)}>
                  {item.icon}{item.label}
                </NavLink>
              ))}
            </nav>
            <div className="p-2" style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors" style={{ color: '#9898c0' }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Log out
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
