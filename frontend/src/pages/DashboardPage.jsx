import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import { useState, useRef, useEffect } from 'react';
import api from '../api/axios';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [units, setUnits] = useState([]);
  const [notes, setNotes] = useState([]);
  const [progressData, setProgressData] = useState(null);
  const dropdownRef = useRef(null);

  const firstName = user?.name?.split(' ')[0] || 'Guest';
  const avatarName = encodeURIComponent(user?.name || 'Guest');

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('elimupap_token');
        const [unitsRes, notesRes, progressRes] = await Promise.all([
          api.get('/units'),
          api.get('/notes'),
          api.get('/progress/stats', { headers: { Authorization: `Bearer ${token}` } })
        ]);
        setUnits(unitsRes.data);
        setNotes(notesRes.data);
        setProgressData(progressRes.data);
      } catch (err) {
        console.error("Failed to fetch dashboard data", err);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="flex min-h-dvh font-sans" style={{ backgroundColor: '#17171F' }}>
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto pb-20 lg:pb-0">
        <main className="max-w-[1000px] mx-auto px-6 sm:px-10 py-10">

          {/* ── Header ── */}
          <header className="relative z-50 flex justify-between items-start mb-12 animate-fade-in">
            <div>
              <h1 className="font-display text-[2.5rem] text-white leading-none mb-3">
                {getGreeting()}, {firstName}.
              </h1>
              <p className="text-[15px]" style={{ color: '#9ca3af' }}>
                Here is a summary of your academic progress.
              </p>
            </div>

            {/* Top Right Icons */}
            <div className="flex items-center gap-4">
              <button className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                style={{ backgroundColor: '#1e1e28', border: '1px solid rgba(255,255,255,0.03)' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2b2b36'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#1e1e28'}>
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
              </button>
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-9 h-9 rounded-full overflow-hidden focus:outline-none transition-transform hover:scale-105"
                  style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                  <img src={`https://ui-avatars.com/api/?name=${avatarName}&background=11111a&color=fff`} alt="Profile" className="w-full h-full object-cover" />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-xl py-1 shadow-xl animate-fade-in z-50" style={{ backgroundColor: '#1F1F2A', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="px-4 py-3 mb-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                      <p className="text-[11px] truncate mt-0.5" style={{ color: '#9ca3af' }}>{user?.email}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2.5 text-[13px] text-red-400 hover:bg-white/5 transition-colors flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* ── Student Profile & Progress ── */}
          <section className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-up">

            {/* Profile Info */}
            <div className="lg:col-span-2 rounded-2xl p-8 relative overflow-hidden" style={{ backgroundColor: '#1F1F2A', border: '1px solid rgba(255,255,255,0.03)' }}>
              {/* Background Accent */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#5B57FF] opacity-[0.03] rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>

              <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-8">
                <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0" style={{ border: '2px solid rgba(255,255,255,0.05)' }}>
                  <img src={`https://ui-avatars.com/api/?name=${avatarName}&background=2b2b36&color=fff&size=200`} alt="Profile" className="w-full h-full object-cover" />
                </div>
                <div>
                  <h2 className="text-2xl font-display text-white mb-2">{user?.name}</h2>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-[13px]" style={{ color: '#9ca3af' }}>
                      <svg className="w-4 h-4 text-[#5B57FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" /></svg>
                      <span className="font-medium text-white">{user?.course || 'Course Not Set'}</span>
                      <span className="opacity-50 mx-1">•</span>
                      <span>{user?.year_of_study || 'Year Not Set'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[13px]" style={{ color: '#9ca3af' }}>
                      <svg className="w-4 h-4 text-[#5B57FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                      <span>{user?.university || 'University Not Set'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Learning Activity Score */}
            <div className="rounded-2xl p-6 flex flex-col items-center justify-center text-center animate-slide-up" style={{ backgroundColor: '#1F1F2A', border: '1px solid rgba(255,255,255,0.03)', animationDelay: '50ms' }}>
              <h3 className="text-[14px] font-bold uppercase tracking-widest text-[#9ca3af] mb-4">Activity Score</h3>

              <div className="relative w-32 h-32 flex items-center justify-center mb-2">
                <style>
                  {`
                    @keyframes fillLearningScore {
                      0% { stroke-dasharray: 0, 100; }
                      100% { stroke-dasharray: ${progressData?.learning_score || 0}, 100; }
                    }
                  `}
                </style>
                <svg className="absolute w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  {/* Background Track */}
                  <path strokeWidth="3" stroke="currentColor" fill="none" className="text-[#2b2b36]" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  {/* Progress Fill */}
                  <path
                    strokeWidth="3"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    style={{
                      color: '#5B57FF',
                      animation: 'fillLearningScore 2s ease-out forwards'
                    }}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                {/* Percentage inside circle */}
                <div className="relative z-10 flex flex-col items-center">
                  <span className="text-[28px] font-display text-white leading-none">{progressData?.learning_score || 0}</span>
                  <span className="text-[10px] text-[#5B57FF] mt-1 font-medium">POINTS</span>
                </div>
              </div>
              <p className="text-[12px]" style={{ color: '#9ca3af' }}>Based on your weekly study habits</p>
            </div>
          </section>

          {/* ── Semester Units Snapshot ── */}
          <section className="mb-12 animate-slide-up" style={{ animationDelay: '100ms' }}>
            <div className="flex items-end justify-between mb-4">
              <h2 className="font-display text-2xl text-white">Semester Units</h2>
              <Link to="/notes" className="text-[11px] font-bold uppercase tracking-widest hover:text-white transition-colors" style={{ color: '#5B57FF' }}>
                Manage Units &rarr;
              </Link>
            </div>

            {units.length === 0 ? (
              <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: '#1F1F2A', border: '1px dashed rgba(255,255,255,0.1)' }}>
                <p className="text-sm text-gray-400 mb-4">You haven't registered any units for this semester yet.</p>
                <Link to="/notes" className="inline-block px-6 py-2.5 rounded-lg text-sm font-medium transition-colors" style={{ backgroundColor: '#5B57FF', color: '#fff' }}>
                  Add Units
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {units.map(unit => (
                  <Link key={unit.id} to={`/notes/unit/${unit.unit_code}`} className="rounded-xl p-5 flex flex-col gap-2 group transition-transform hover:-translate-y-1" style={{ backgroundColor: '#1F1F2A', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold tracking-wider px-2 py-1 rounded" style={{ backgroundColor: '#2b2b36', color: '#9ca3af' }}>{unit.unit_code}</span>
                      <svg className="w-4 h-4 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </div>
                    <h3 className="text-base font-medium text-white line-clamp-1">{unit.unit_name}</h3>
                    <p className="text-xs text-gray-400 mt-2">{unit.topics?.length || 0} Topics Registered</p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* ── Main Layout: Quick Actions & Recent Activity ── */}
          <div className="flex flex-col lg:flex-row gap-6">

            {/* Quick Actions */}
            <section className="w-full lg:w-[35%] flex flex-col gap-4">
              <h2 className="font-display text-2xl text-white mb-2">Quick Actions</h2>

              <Link to="/upload-notes" className="flex items-center justify-between p-4 rounded-xl group transition-colors" style={{ backgroundColor: '#22222d', border: '1px solid rgba(255,255,255,0.02)' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2a2a35'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#22222d'}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#2b2b36' }}>
                    <svg className="w-5 h-5" style={{ color: '#c4c2ff' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white mb-0.5">Upload Material</h3>
                    <p className="text-[11px]" style={{ color: '#9ca3af' }}>PDF, DOCX, or Image</p>
                  </div>
                </div>
                <svg className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" style={{ color: '#9ca3af' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" /></svg>
              </Link>

              <Link to="/tutor" className="flex items-center justify-between p-4 rounded-xl group transition-colors" style={{ backgroundColor: '#22222d', border: '1px solid rgba(255,255,255,0.02)' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2a2a35'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#22222d'}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#2b2b36' }}>
                    <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white mb-0.5">New Summary</h3>
                    <p className="text-[11px]" style={{ color: '#9ca3af' }}>From existing notes</p>
                  </div>
                </div>
                <svg className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" style={{ color: '#9ca3af' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" /></svg>
              </Link>

              <Link to="/notes" className="flex items-center justify-between p-4 rounded-xl group transition-colors" style={{ backgroundColor: '#22222d', border: '1px solid rgba(255,255,255,0.02)' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2a2a35'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#22222d'}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#2b2b36' }}>
                    <svg className="w-5 h-5" style={{ color: '#c4c2ff' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white mb-0.5">Browse Library</h3>
                    <p className="text-[11px]" style={{ color: '#9ca3af' }}>Access curated texts</p>
                  </div>
                </div>
                <svg className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" style={{ color: '#9ca3af' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" /></svg>
              </Link>
            </section>

            {/* Learning Metrics */}
            <section className="flex-1 flex flex-col gap-6">

              {/* Reading History */}
              <div>
                <h2 className="font-display text-2xl text-white mb-4">Reading History</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="rounded-xl p-4 flex flex-col items-center justify-center text-center" style={{ backgroundColor: '#22222d', border: '1px solid rgba(255,255,255,0.02)' }}>
                    <span className="text-2xl font-bold text-white mb-1">{progressData?.history?.notes_opened || 0}</span>
                    <span className="text-[11px] text-[#9ca3af] uppercase tracking-wider">Notes Opened</span>
                  </div>
                  <div className="rounded-xl p-4 flex flex-col items-center justify-center text-center" style={{ backgroundColor: '#22222d', border: '1px solid rgba(255,255,255,0.02)' }}>
                    <span className="text-2xl font-bold text-white mb-1">{progressData?.history?.topics_studied || '0/0'}</span>
                    <span className="text-[11px] text-[#9ca3af] uppercase tracking-wider">Units Studied</span>
                  </div>
                  <div className="rounded-xl p-4 flex flex-col items-center justify-center text-center" style={{ backgroundColor: '#22222d', border: '1px solid rgba(255,255,255,0.02)' }}>
                    <span className="text-2xl font-bold text-white mb-1">{progressData?.history?.practice_questions || 0}</span>
                    <span className="text-[11px] text-[#9ca3af] uppercase tracking-wider">Practice Qs</span>
                  </div>
                  <div className="rounded-xl p-4 flex flex-col items-center justify-center text-center" style={{ backgroundColor: '#22222d', border: '1px solid rgba(255,255,255,0.02)' }}>
                    <span className="text-2xl font-bold text-white mb-1">{progressData?.history?.flashcards_reviewed || 0}</span>
                    <span className="text-[11px] text-[#9ca3af] uppercase tracking-wider">Flashcards</span>
                  </div>
                </div>
              </div>

              {/* Weekly Time Tracker */}
              <div>
                <div className="flex items-end justify-between mb-4">
                  <h2 className="font-display text-2xl text-white">This Week's Tracker</h2>
                  <span className="text-[12px] font-bold text-[#5B57FF]">Total: {Math.floor((progressData?.time_tracker?.total_minutes || 0) / 60)}h {(progressData?.time_tracker?.total_minutes || 0) % 60}min</span>
                </div>

                <div className="rounded-xl overflow-hidden flex flex-col p-2" style={{ backgroundColor: '#22222d', border: '1px solid rgba(255,255,255,0.02)' }}>
                  {progressData?.time_tracker?.daily?.map((dayData, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors">
                      <span className="text-[13px] font-medium text-gray-300 w-24">{dayData.day}</span>
                      <div className="flex-1 mx-4 h-2 bg-[#1b1b22] rounded-full overflow-hidden">
                        <div className="h-full bg-[#5B57FF] rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (dayData.minutes / 120) * 100)}%` }}></div>
                      </div>
                      <span className="text-[13px] text-white font-mono w-16 text-right">
                        {dayData.minutes} min
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

          </div>

        </main>
      </div>
    </div>
  );
}
