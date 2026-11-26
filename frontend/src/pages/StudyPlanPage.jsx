import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import api from '../api/axios';

export default function StudyPlanPage() {
  const [activeTab, setActiveTab] = useState('planner'); // 'planner' or 'exams'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Exams state
  const [exams, setExams] = useState([]);
  const [units, setUnits] = useState([]);
  const [manualExam, setManualExam] = useState({ unit_code: '', exam_date: '', exam_time: '', venue: '' });
  const [timetableFile, setTimetableFile] = useState(null);

  // Planner state
  const [hoursPerDay, setHoursPerDay] = useState(3);
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    fetchExams();
    fetchUnits();
    fetchActivePlan();
  }, []);

  const fetchExams = async () => {
    try {
      const token = localStorage.getItem('elimupap_token');
      const res = await api.get('/exams', { headers: { Authorization: `Bearer ${token}` } });
      setExams(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUnits = async () => {
    try {
      const token = localStorage.getItem('elimupap_token');
      const res = await api.get('/units', { headers: { Authorization: `Bearer ${token}` } });
      setUnits(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchActivePlan = async () => {
    try {
      const token = localStorage.getItem('elimupap_token');
      const res = await api.get('/study-plan/active', { headers: { Authorization: `Bearer ${token}` } });
      setPlan(res.data.plan_data);
    } catch (err) {
      // 404 is fine, just means no active plan
    }
  };

  const handleAddManualExam = async (e) => {
    e.preventDefault();
    if (!manualExam.unit_code || !manualExam.exam_date) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('elimupap_token');
      await api.post('/exams', manualExam, { headers: { Authorization: `Bearer ${token}` } });
      setManualExam({ unit_code: '', exam_date: '', exam_time: '', venue: '' });
      fetchExams();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to add exam');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExam = async (examId) => {
    if (!window.confirm("Delete this exam?")) return;
    try {
      const token = localStorage.getItem('elimupap_token');
      await api.delete(`/exams/${examId}`, { headers: { Authorization: `Bearer ${token}` } });
      fetchExams();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to delete exam');
    }
  };

  const handleUploadTimetable = async (e) => {
    e.preventDefault();
    if (!timetableFile) return;
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', timetableFile);
      const token = localStorage.getItem('elimupap_token');
      const res = await api.post('/exams/parse', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });
      setTimetableFile(null);
      fetchExams();
      alert(res?.data?.message || 'Timetable parsed and exams added!');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to parse timetable');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePlan = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('hours_per_day', hoursPerDay);
      const token = localStorage.getItem('elimupap_token');
      const res = await api.post('/ai/study-plan', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });
      setPlan(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to generate study plan. Have you added your exams?');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!window.confirm("Are you sure you want to delete your active study plan?")) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('elimupap_token');
      await api.delete('/study-plan/active', { headers: { Authorization: `Bearer ${token}` } });
      setPlan(null);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to delete study plan');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPlan = () => {
    // The browser's native print dialog will be triggered, allowing the user to "Save as PDF"
    // Our print CSS in index.css ensures that only the study plan is rendered beautifully
    window.print();
  };

  const DAY_COLORS = {
    Monday: { bg: 'rgba(91,87,255,0.12)', text: '#a5a3ff' },
    Tuesday: { bg: 'rgba(45,212,191,0.1)', text: '#2dd4bf' },
    Wednesday: { bg: 'rgba(251,191,36,0.1)', text: '#fbbf24' },
    Thursday: { bg: 'rgba(249,115,22,0.1)', text: '#fb923c' },
    Friday: { bg: 'rgba(167,139,250,0.1)', text: '#c084fc' },
    Saturday: { bg: 'rgba(52,211,153,0.1)', text: '#34d399' },
    Sunday: { bg: 'rgba(248,113,113,0.1)', text: '#f87171' },
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-dvh font-sans" style={{ backgroundColor: '#13131f' }}>
      <Sidebar />
      <div className="flex-1 overflow-y-auto pb-28 lg:pb-10 min-w-0">
        <main className="max-w-[900px] mx-auto px-4 sm:px-10 py-6 sm:py-10">

          <header className="mb-8 sm:mb-10 animate-fade-in">
            <h1 className="font-display text-2xl sm:text-[2.5rem] text-white leading-tight mb-2 sm:mb-3 tracking-tight">
              Adaptive Study Planner
            </h1>
            <p className="text-[14px] leading-relaxed" style={{ color: '#9ca3af' }}>
              ElimuPap uses your learning telemetry and upcoming exam dates to continuously generate an optimal, adaptive study plan that targets your weak areas.
            </p>
          </header>

          {/* Tabs */}
          <div className="flex gap-4 mb-8 border-b border-white/10 pb-4">
            <button
              onClick={() => setActiveTab('planner')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'planner' ? 'bg-[#5B57FF] text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Adaptive Plan
            </button>
            <button
              onClick={() => setActiveTab('exams')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'exams' ? 'bg-[#5B57FF] text-white' : 'text-gray-400 hover:text-white'}`}
            >
              My Exams
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Exams Tab */}
          {activeTab === 'exams' && (
            <div className="animate-slide-up space-y-8">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Upload Timetable */}
                <div className="p-6 rounded-2xl" style={{ backgroundColor: '#1F1F2A', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <h2 className="text-white font-semibold mb-4 text-lg">Upload Timetable</h2>
                  <p className="text-sm text-gray-400 mb-4">Instantly extract exam dates for your registered units.</p>
                  <form onSubmit={handleUploadTimetable} className="flex flex-col gap-4">
                    <input type="file" accept="image/*,application/pdf" onChange={e => setTimetableFile(e.target.files[0])}
                      className="w-full px-4 py-2 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#5B57FF]"
                      style={{ backgroundColor: '#11111a', border: '1px solid #2d2d4a' }} />
                    <button type="submit" disabled={loading || !timetableFile} className="px-4 py-2 rounded-lg text-white font-medium bg-[#5B57FF] disabled:opacity-50">
                      {loading ? 'Parsing...' : 'Extract Exams'}
                    </button>
                  </form>
                </div>

                {/* Manual Exam */}
                <div className="p-6 rounded-2xl" style={{ backgroundColor: '#1F1F2A', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <h2 className="text-white font-semibold mb-4 text-lg">Add Exam Manually</h2>
                  <form onSubmit={handleAddManualExam} className="flex flex-col gap-4">
                    <select value={manualExam.unit_code} onChange={e => setManualExam({ ...manualExam, unit_code: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#5B57FF]"
                      style={{ backgroundColor: '#11111a', border: '1px solid #2d2d4a' }} required>
                      <option value="">Select Unit...</option>
                      {units.map(u => <option key={u.id} value={u.unit_code}>{u.unit_code} - {u.unit_name || u.title}</option>)}
                    </select>
                    <input type="date" value={manualExam.exam_date} onChange={e => setManualExam({ ...manualExam, exam_date: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#5B57FF]"
                      style={{ backgroundColor: '#11111a', border: '1px solid #2d2d4a', colorScheme: 'dark' }} required />
                    <div className="flex gap-2">
                      <input type="time" value={manualExam.exam_time} onChange={e => setManualExam({ ...manualExam, exam_time: e.target.value })}
                        className="flex-1 px-4 py-2 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#5B57FF]"
                        style={{ backgroundColor: '#11111a', border: '1px solid #2d2d4a', colorScheme: 'dark' }} />
                      <input type="text" placeholder="Venue" value={manualExam.venue} onChange={e => setManualExam({ ...manualExam, venue: e.target.value })}
                        className="flex-1 px-4 py-2 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#5B57FF]"
                        style={{ backgroundColor: '#11111a', border: '1px solid #2d2d4a' }} />
                    </div>
                    <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg text-white font-medium bg-[#5B57FF] disabled:opacity-50">
                      Add Exam
                    </button>
                  </form>
                </div>
              </div>

              {/* Exam List */}
              <div className="p-6 rounded-2xl" style={{ backgroundColor: '#1F1F2A', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h2 className="text-white font-semibold mb-4 text-lg">Upcoming Exams</h2>
                {exams.length === 0 ? (
                  <p className="text-gray-400 text-sm">No exams scheduled. Add one above.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {exams.map(exam => (
                      <div key={exam.id} className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: '#11111a', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="text-white font-medium text-lg">{exam.unit_code}</div>
                            {exam.exam_date < new Date().toISOString().split('T')[0] && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-green-500/20 text-green-400">
                                Done
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-400 mt-1">
                            {exam.exam_date} {exam.exam_time && `at ${exam.exam_time}`} {exam.venue && `• ${exam.venue}`}
                          </div>
                        </div>
                        <button onClick={() => handleDeleteExam(exam.id)} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* Planner Tab */}
          {activeTab === 'planner' && (
            <div className="animate-slide-up space-y-6">

              <div className="p-6 rounded-2xl flex flex-col sm:flex-row gap-4 items-center justify-between" style={{ backgroundColor: '#1F1F2A', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <h2 className="text-white font-semibold mb-1">Generate Adaptive Plan</h2>
                  <p className="text-sm text-gray-400">Uses your current mastery scores and upcoming exam dates.</p>
                </div>
                <form onSubmit={handleGeneratePlan} className="flex gap-4 items-center">
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400 mb-1">Hours/Day</label>
                    <input type="number" min="1" max="12" value={hoursPerDay} onChange={e => setHoursPerDay(e.target.value)}
                      className="w-20 px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#5B57FF]"
                      style={{ backgroundColor: '#11111a', border: '1px solid #2d2d4a' }} />
                  </div>
                  <button type="submit" disabled={loading} className="px-6 py-2 rounded-lg text-white font-medium bg-[#5B57FF] disabled:opacity-50 mt-4">
                    {loading ? 'Generating...' : 'Regenerate Plan'}
                  </button>
                </form>
              </div>

              {/* Display Plan */}
              {plan && (
                <div className="space-y-8 animate-fade-in">
                  <div className="flex justify-end gap-3 mb-[-1rem]">
                    <button onClick={handleDownloadPlan} className="px-4 py-2 rounded-lg text-sm text-white font-medium bg-[#1F1F2A] hover:bg-[#2b2b36] border border-white/10 transition-colors flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      Download Plan
                    </button>
                    <button onClick={handleDeletePlan} disabled={loading} className="px-4 py-2 rounded-lg text-sm text-red-400 font-medium bg-red-400/10 hover:bg-red-400/20 border border-red-400/20 transition-colors flex items-center gap-2 disabled:opacity-50">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Delete Plan
                    </button>
                  </div>

                  <div className="p-6 rounded-2xl relative overflow-hidden" style={{ backgroundColor: '#1F1F2A', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#5B57FF] opacity-10 blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-4">
                        <svg className="w-6 h-6 text-[#5B57FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <h2 className="text-xl font-bold text-white">Your AI Adaptive Strategy</h2>
                      </div>
                      <p className="text-[#c4c2ff] leading-relaxed mb-4">{plan.advice}</p>
                      <div className="flex items-center gap-4 text-sm font-medium text-[#9ca3af]">
                        <span>📅 Earliest Exam: <span className="text-white">{plan.exam_date}</span></span>
                        <span>⏱️ Total Strategy: <span className="text-white">{plan.total_weeks} weeks</span></span>
                      </div>
                    </div>
                  </div>

                  {plan.weeks?.map((week, idx) => (
                    <div key={idx} className="mb-8">
                      <div className="flex flex-col mb-4">
                        <div className="flex items-center gap-4 mb-2">
                          <h3 className="text-2xl font-display text-white">Week {week.week_number}</h3>
                          <div className="h-[1px] flex-1 bg-white/5"></div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <p className="text-lg text-[#c4c2ff] font-medium">{week.focus_area}</p>
                          {week.reasoning && (
                            <p className="text-sm text-[#4ade80] flex items-start gap-2">
                              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                              <span>{week.reasoning}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {week.daily_tasks?.map((t, tIdx) => {
                          const c = DAY_COLORS[t.day] || { bg: '#2b2b36', text: '#fff' };
                          return (
                            <div key={tIdx} className="p-5 rounded-2xl relative group"
                              style={{ backgroundColor: '#1F1F2A', border: '1px solid rgba(255,255,255,0.03)' }}>
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md"
                                  style={{ backgroundColor: c.bg, color: c.text }}>
                                  {t.day}
                                </span>
                                <span className="text-[12px] font-medium" style={{ color: '#9ca3af' }}>
                                  {t.duration_hours} {t.duration_hours === 1 ? 'hr' : 'hrs'}
                                </span>
                              </div>
                              <p className="text-[14px] text-white leading-relaxed group-hover:text-[#c4c2ff] transition-colors">
                                {t.task}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!plan && !loading && (
                <div className="p-12 text-center text-gray-500 text-sm rounded-2xl" style={{ backgroundColor: '#1F1F2A', border: '1px dashed rgba(255,255,255,0.1)' }}>
                  No active study plan. Generate one above!
                </div>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
