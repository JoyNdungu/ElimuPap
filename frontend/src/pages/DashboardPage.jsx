import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Sidebar from '../components/Sidebar';
import { useState, useRef, useEffect } from 'react';
import api from '../api/axios';
import { Search, Layers, Mic, FileAudio } from '../components/Icons';
import GlobalSearchModal from '../components/GlobalSearchModal';
import ExamCountdownWidget from '../components/ExamCountdownWidget';
import SpacedRepetitionModal from '../components/SpacedRepetitionModal';
import AudioRecorderModal from '../components/AudioRecorderModal';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [units, setUnits] = useState([]);
  const [notes, setNotes] = useState([]);
  const [progressData, setProgressData] = useState(null);
  const dropdownRef = useRef(null);

  // New Modals State
  const [searchOpen, setSearchOpen] = useState(false);
  const [srsOpen, setSrsOpen] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false);

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

  const pageStyle = {
    backgroundColor: isDark ? '#13131f' : '#f8fafc',
    color: isDark ? '#ffffff' : '#0f172a',
  };
  const cardCls = isDark
    ? 'bg-[#1F1F2A] border border-white/5 shadow-sm'
    : 'bg-white border border-slate-200 shadow-sm';
  const actionBtnCls = isDark
    ? 'bg-[#1F1F2A] hover:bg-[#2b2b36] text-slate-200 border border-white/10'
    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200';
  const quickActionCls = isDark
    ? 'bg-[#1F1F2A] hover:bg-[#2b2b36] border border-white/5 shadow-sm'
    : 'bg-white hover:bg-slate-50 border border-slate-200 shadow-sm';
  const headingClr = isDark ? 'text-white' : 'text-slate-900';
  const subClr = isDark ? 'text-gray-400' : 'text-slate-600';
  const mutedClr = isDark ? 'text-gray-400' : 'text-slate-500';
  const insetBoxCls = isDark
    ? 'bg-[#11111a] border border-white/5'
    : 'bg-[#f8fafc] border border-slate-200';

  return (
    <div
      className="flex flex-col lg:flex-row min-h-dvh font-sans transition-colors"
      style={pageStyle}
    >
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto pb-28 lg:pb-12 min-w-0">
        <main className="max-w-[1000px] mx-auto px-4 sm:px-10 py-6 sm:py-10">

          {/* ── Header ── */}
          <header className="relative z-30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 sm:mb-12 animate-fade-in">
            <div>
              <h1 className={`font-display text-2xl sm:text-4xl leading-tight mb-1.5 sm:mb-2 ${headingClr}`}>
                {getGreeting()}, {firstName}.
              </h1>
              <p className={`text-xs sm:text-sm ${subClr}`}>
                Here is a summary of your academic progress.
              </p>
            </div>

            {/* Quick Feature Actions */}
            <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap w-full sm:w-auto">
              <button
                onClick={() => setSearchOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition shadow-sm ${actionBtnCls}`}
              >
                <Search className={`w-3.5 h-3.5 ${mutedClr}`} />
                <span>Search</span>
                <kbd className={`hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono ${insetBoxCls} ${mutedClr}`}>Ctrl+K</kbd>
              </button>

              <button
                onClick={() => setSrsOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition shadow-sm ${actionBtnCls}`}
              >
                <Layers className={`w-3.5 h-3.5 ${isDark ? 'text-blue-400' : 'text-[#2563EB]'}`} />
                <span className="hidden sm:inline">Pap</span> Flashcards
              </button>

              <button
                onClick={() => setAudioOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition shadow-sm ${actionBtnCls}`}
              >
                <Mic className={`w-3.5 h-3.5 ${mutedClr}`} />
                <span className="hidden sm:inline">Record</span> Audio
              </button>

              <Link
                to="/notes?filter=audio"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition shadow-sm ${actionBtnCls}`}
              >
                <FileAudio className={`w-3.5 h-3.5 ${mutedClr}`} />
                <span className="hidden sm:inline">My</span> Recordings
              </Link>

              <div className="relative ml-auto sm:ml-0" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className={`w-9 h-9 rounded-full overflow-hidden focus:outline-none transition-transform hover:scale-105 ring-2 ${isDark ? 'ring-white/10' : 'ring-slate-200'}`}
                  aria-label="User profile">
                  <img src={`https://ui-avatars.com/api/?name=${avatarName}&background=2563eb&color=fff`} alt="Profile" className="w-full h-full object-cover" />
                </button>

                {dropdownOpen && (
                  <div className={`absolute right-0 mt-2 w-48 rounded-xl py-1 shadow-xl animate-fade-in z-50 border ${isDark ? 'bg-[#1F1F2A] border-white/10' : 'bg-white border-slate-200'}`}>
                    <div className={`px-4 py-3 mb-1 border-b ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
                      <p className={`text-xs font-medium truncate ${headingClr}`}>{user?.name}</p>
                      <p className={`text-[10px] truncate mt-0.5 ${mutedClr}`}>{user?.email}</p>
                    </div>
                    <Link
                      to="/profile"
                      className={`w-full text-left px-4 py-2 text-xs transition-colors flex items-center gap-2 ${isDark ? 'text-gray-300 hover:bg-white/5' : 'text-slate-700 hover:bg-slate-50'}`}>
                      <span>👤</span> Profile
                    </Link>
                    <button
                      onClick={handleLogout}
                      className={`w-full text-left px-4 py-2 text-xs transition-colors flex items-center gap-2 border-t mt-1 ${isDark ? 'text-red-400 hover:bg-white/5 border-white/5' : 'text-red-600 hover:bg-red-50 border-slate-200'}`}>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
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
            <div className={`lg:col-span-2 rounded-2xl p-6 sm:p-7 flex flex-col justify-between gap-6 relative overflow-hidden ${cardCls}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                <div className="flex items-center gap-5 min-w-0">
                  <div className={`w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 border-2 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                    <img src={`https://ui-avatars.com/api/?name=${avatarName}&background=2563eb&color=fff&size=200`} alt="Profile" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className={`text-2xl font-display leading-tight truncate ${headingClr}`}>{user?.name}</h2>
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                        isDark ? 'bg-[#2563EB]/15 text-blue-300 border-[#2563EB]/30' : 'bg-blue-50 text-[#2563EB] border-blue-200'
                      }`}>
                        {user?.year_of_study
                          ? (/year/i.test(String(user.year_of_study)) ? user.year_of_study : `Year ${user.year_of_study}`)
                          : 'Student'}
                      </span>
                    </div>
                    {user?.email && (
                      <p className={`text-xs truncate mt-0.5 ${mutedClr}`}>{user.email}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5">
                      <div className={`flex items-center gap-1.5 text-[13px] ${subClr}`}>
                        <svg className="w-4 h-4 text-[#2563EB] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" /></svg>
                        <span className={`font-medium ${headingClr}`}>{user?.course || 'Course Not Set'}</span>
                      </div>
                      <div className={`flex items-center gap-1.5 text-[13px] ${subClr}`}>
                        <svg className="w-4 h-4 text-[#2563EB] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" /></svg>
                        <span>{user?.university || 'University Not Set'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <Link
                  to="/profile"
                  className={`self-start sm:self-center px-3 py-1.5 rounded-xl text-xs font-medium transition-colors flex-shrink-0 border ${
                    isDark
                      ? 'bg-[#11111a] border-white/10 text-gray-300 hover:text-white hover:bg-white/5'
                      : 'bg-[#f8fafc] border-slate-200 text-slate-700 hover:text-[#2563EB] hover:border-blue-200'
                  }`}
                >
                  Edit Profile
                </Link>
              </div>

              {/* Compact Academic Snapshot */}
              <div className={`grid grid-cols-3 gap-3 pt-5 border-t ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
                <div className={`rounded-xl px-3.5 py-2.5 ${insetBoxCls}`}>
                  <p className={`text-[10px] font-semibold uppercase tracking-wider ${mutedClr}`}>Units</p>
                  <p className={`text-lg font-display mt-0.5 ${headingClr}`}>{units.length}</p>
                </div>
                <div className={`rounded-xl px-3.5 py-2.5 ${insetBoxCls}`}>
                  <p className={`text-[10px] font-semibold uppercase tracking-wider ${mutedClr}`}>Materials</p>
                  <p className={`text-lg font-display mt-0.5 ${headingClr}`}>{notes.length}</p>
                </div>
                <div className={`rounded-xl px-3.5 py-2.5 ${insetBoxCls}`}>
                  <p className={`text-[10px] font-semibold uppercase tracking-wider ${mutedClr}`}>This Week</p>
                  <p className={`text-lg font-display mt-0.5 ${headingClr}`}>
                    {Math.floor((progressData?.time_tracker?.total_minutes || 0) / 60)}h {(progressData?.time_tracker?.total_minutes || 0) % 60}m
                  </p>
                </div>
              </div>
            </div>

            {/* Learning Activity Score */}
            <div className={`rounded-2xl p-6 flex flex-col items-center justify-center text-center animate-slide-up ${cardCls}`} style={{ animationDelay: '50ms' }}>
              <h3 className={`text-[13px] font-bold uppercase tracking-widest mb-4 ${mutedClr}`}>Activity Score</h3>

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
                  <path strokeWidth="3" stroke="currentColor" fill="none" className={isDark ? 'text-[#2b2b36]' : 'text-slate-200'} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  {/* Progress Fill */}
                  <path
                    strokeWidth="3"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    className="text-[#2563EB]"
                    style={{
                      animation: 'fillLearningScore 2s ease-out forwards'
                    }}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                {/* Percentage inside circle */}
                <div className="relative z-10 flex flex-col items-center">
                  <span className={`text-[28px] font-display leading-none ${headingClr}`}>{progressData?.learning_score || 0}</span>
                  <span className="text-[10px] text-[#2563EB] mt-1 font-semibold">POINTS</span>
                </div>
              </div>
              <p className={`text-[12px] ${mutedClr}`}>Based on your weekly study habits</p>
            </div>
          </section>

          {/* ── Semester Units Snapshot ── */}
          <section className="mb-12 animate-slide-up" style={{ animationDelay: '100ms' }}>
            <div className="flex items-end justify-between mb-4">
              <h2 className={`font-display text-2xl ${headingClr}`}>Semester Units</h2>
              <Link to="/notes" className="text-[11px] font-bold uppercase tracking-widest text-[#2563EB] hover:text-[#1D4ED8] transition-colors">
                Manage Units &rarr;
              </Link>
            </div>

            {units.length === 0 ? (
              <div className={`rounded-2xl p-8 text-center border border-dashed ${isDark ? 'bg-[#1F1F2A] border-white/10' : 'bg-white border-slate-300'}`}>
                <p className={`text-sm mb-4 ${mutedClr}`}>You haven't registered any units for this semester yet.</p>
                <Link to="/notes" className="inline-block px-6 py-2.5 rounded-lg text-sm font-medium bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors">
                  Add Units
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {units.map(unit => (
                  <Link key={unit.id} to={`/notes/unit/${unit.unit_code}`} className={`rounded-xl p-5 flex flex-col gap-2 group transition-all hover:-translate-y-0.5 ${cardCls} ${isDark ? 'hover:border-white/15' : 'hover:border-blue-300'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-mono font-bold tracking-wider px-2.5 py-1 rounded border ${isDark ? 'bg-[#11111a] text-[#93c5fd] border-white/10' : 'bg-[#f8fafc] text-[#2563EB] border-slate-200'}`}>{unit.unit_code}</span>
                      <svg className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </div>
                    <h3 className={`text-base font-medium line-clamp-1 ${headingClr}`}>{unit.unit_name}</h3>
                    <p className={`text-xs mt-2 ${mutedClr}`}>{unit.topics?.length || 0} Topics Registered</p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* ── Main Layout: Quick Actions & Recent Activity ── */}
          <div className="flex flex-col lg:flex-row gap-6">

            {/* Quick Actions */}
            <section className="w-full lg:w-[35%] flex flex-col gap-3">
              <h2 className={`font-display text-2xl mb-2 ${headingClr}`}>Quick Actions</h2>

              <Link to="/upload-notes" className={`flex items-center justify-between p-4 rounded-xl group transition-colors ${quickActionCls}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${isDark ? 'bg-[#11111a] border-white/5' : 'bg-blue-50 border-blue-100'}`}>
                    <svg className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-[#2563EB]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                  </div>
                  <div>
                    <h3 className={`text-sm font-medium mb-0.5 ${headingClr}`}>Upload Material</h3>
                    <p className={`text-[11px] ${mutedClr}`}>PDF, DOCX, or Image</p>
                  </div>
                </div>
                <svg className="w-4 h-4 text-slate-400 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" /></svg>
              </Link>

              <Link to="/tutor" className={`flex items-center justify-between p-4 rounded-xl group transition-colors ${quickActionCls}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${insetBoxCls}`}>
                    <svg className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-[#2563EB]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>
                  </div>
                  <div>
                    <h3 className={`text-sm font-medium mb-0.5 ${headingClr}`}>AI Tutor</h3>
                    <p className={`text-[11px] ${mutedClr}`}>Ask questions &amp; drill exams</p>
                  </div>
                </div>
                <svg className="w-4 h-4 text-slate-400 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" /></svg>
              </Link>

              <Link to="/notes" className={`flex items-center justify-between p-4 rounded-xl group transition-colors ${quickActionCls}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${insetBoxCls}`}>
                    <svg className={`w-5 h-5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
                  </div>
                  <div>
                    <h3 className={`text-sm font-medium mb-0.5 ${headingClr}`}>Browse Library</h3>
                    <p className={`text-[11px] ${mutedClr}`}>Access curated texts</p>
                  </div>
                </div>
                <svg className="w-4 h-4 text-slate-400 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" /></svg>
              </Link>

              <Link to="/notes?filter=audio" className={`flex items-center justify-between p-4 rounded-xl group transition-colors ${quickActionCls}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${insetBoxCls}`}>
                    <Mic className={`w-5 h-5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`} />
                  </div>
                  <div>
                    <h3 className={`text-sm font-medium mb-0.5 ${headingClr}`}>Lecture Recordings</h3>
                    <p className={`text-[11px] ${mutedClr}`}>Listen to audio lectures &amp; transcripts</p>
                  </div>
                </div>
                <svg className="w-4 h-4 text-slate-400 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" /></svg>
              </Link>
            </section>

            {/* Learning Metrics & Exam Countdown */}
            <section className="flex-1 flex flex-col gap-6">

              {/* Exam Countdown Widget */}
              <ExamCountdownWidget />

              {/* Reading History */}

              <div>
                <h2 className={`font-display text-2xl mb-4 ${headingClr}`}>Reading History</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className={`rounded-xl p-4 flex flex-col items-center justify-center text-center ${cardCls}`}>
                    <span className={`text-2xl font-bold mb-1 ${headingClr}`}>{progressData?.history?.notes_opened || 0}</span>
                    <span className={`text-[11px] uppercase tracking-wider ${mutedClr}`}>Notes Opened</span>
                  </div>
                  <div className={`rounded-xl p-4 flex flex-col items-center justify-center text-center ${cardCls}`}>
                    <span className={`text-2xl font-bold mb-1 ${headingClr}`}>{progressData?.history?.topics_studied || '0/0'}</span>
                    <span className={`text-[11px] uppercase tracking-wider ${mutedClr}`}>Units Studied</span>
                  </div>
                  <div className={`rounded-xl p-4 flex flex-col items-center justify-center text-center ${cardCls}`}>
                    <span className={`text-2xl font-bold mb-1 ${headingClr}`}>{progressData?.history?.practice_questions || 0}</span>
                    <span className={`text-[11px] uppercase tracking-wider ${mutedClr}`}>Practice Qs</span>
                  </div>
                  <div className={`rounded-xl p-4 flex flex-col items-center justify-center text-center ${cardCls}`}>
                    <span className={`text-2xl font-bold mb-1 ${headingClr}`}>{progressData?.history?.flashcards_reviewed || 0}</span>
                    <span className={`text-[11px] uppercase tracking-wider ${mutedClr}`}>Flashcards</span>
                  </div>
                </div>
              </div>

              {/* Weekly Time Tracker */}
              <div>
                <div className="flex items-end justify-between mb-4">
                  <h2 className={`font-display text-2xl ${headingClr}`}>This Week's Tracker</h2>
                  <span className="text-[12px] font-bold text-[#2563EB]">Total: {Math.floor((progressData?.time_tracker?.total_minutes || 0) / 60)}h {(progressData?.time_tracker?.total_minutes || 0) % 60}min</span>
                </div>

                <div className={`rounded-xl overflow-hidden flex flex-col p-2 ${cardCls}`}>
                  {progressData?.time_tracker?.daily?.map((dayData, idx) => (
                    <div key={idx} className={`flex items-center justify-between p-3 rounded-lg transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-[#f8fafc]'}`}>
                      <span className={`text-[13px] font-medium w-24 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>{dayData.day}</span>
                      <div className={`flex-1 mx-4 h-2 rounded-full overflow-hidden ${isDark ? 'bg-[#11111a]' : 'bg-slate-100'}`}>
                        <div className="h-full bg-[#2563EB] rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (dayData.minutes / 120) * 100)}%` }}></div>
                      </div>
                      <span className={`text-[13px] font-mono w-16 text-right ${headingClr}`}>
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

      {/* Global Modals */}
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      <SpacedRepetitionModal isOpen={srsOpen} onClose={() => setSrsOpen(false)} />
      <AudioRecorderModal isOpen={audioOpen} onClose={() => setAudioOpen(false)} />
    </div>
  );
}
