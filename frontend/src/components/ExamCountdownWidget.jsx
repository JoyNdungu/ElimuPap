import React, { useState, useEffect } from 'react';
import { Calendar, Plus } from './Icons';
import { useTheme } from '../context/ThemeContext';
import api from '../api/axios';

export default function ExamCountdownWidget() {
  const { isDark } = useTheme();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newUnit, setNewUnit] = useState('');
  const [newDate, setNewDate] = useState('');

  const fetchExams = async () => {
    try {
      const res = await api.get('/exams');
      setExams(res.data || []);
    } catch (err) {
      console.error("Failed to fetch exams:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  const handleAddExam = async (e) => {
    e.preventDefault();
    if (!newUnit || !newDate) return;
    try {
      await api.post('/exams', {
        unit_code: newUnit.toUpperCase(),
        exam_date: newDate
      });
      setNewUnit('');
      setNewDate('');
      setShowModal(false);
      fetchExams();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to add exam date");
    }
  };

  const getDaysLeft = (dateStr) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const examDate = new Date(dateStr);
    const diffTime = examDate - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <div className={`rounded-2xl p-5 shadow-sm border ${isDark ? 'bg-[#1F1F2A] border-white/5' : 'bg-white border-slate-200'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`flex items-center gap-2 font-bold text-sm ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
          <Calendar className="w-4 h-4 text-[#2563EB]" /> Exam Countdown &amp; Reminders
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="text-xs bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold px-3 py-1.5 rounded-lg transition flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Add Exam
        </button>
      </div>

      {loading ? (
        <div className="text-xs text-slate-500 py-4 text-center">Loading exams...</div>
      ) : exams.length === 0 ? (
        <div className={`text-xs text-center py-4 border border-dashed rounded-xl ${isDark ? 'text-gray-400 border-white/10 bg-[#11111a]' : 'text-slate-500 border-slate-300 bg-[#f8fafc]'}`}>
          No exams scheduled. Click "+ Add Exam" to track your paper dates!
        </div>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {exams.map((exam) => {
            const daysLeft = getDaysLeft(exam.exam_date);
            const isUrgent = daysLeft >= 0 && daysLeft <= 7;
            const isPassed = daysLeft < 0;

            return (
              <div
                key={exam.id}
                className={`p-3 rounded-xl border flex items-center justify-between text-xs transition ${
                  isUrgent
                    ? (isDark ? 'bg-rose-950/30 border-rose-500/40 text-rose-200' : 'bg-rose-50 border-rose-200 text-rose-900')
                    : isPassed
                    ? (isDark ? 'bg-white/[0.02] border-white/5 text-slate-500' : 'bg-[#f8fafc] border-slate-200 text-slate-500')
                    : (isDark ? 'bg-[#11111a] border-white/5 text-slate-200' : 'bg-[#f8fafc] border-slate-200 text-slate-800')
                }`}
              >
                <div>
                  <div className="font-bold text-sm flex items-center gap-2">
                    <span>{exam.unit_code}</span>
                    {isUrgent && (
                      <span className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border ${isDark ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
                        Urgent
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] opacity-80 mt-0.5">{exam.exam_date}</div>
                </div>

                <div className="text-right">
                  {isPassed ? (
                    <span className="font-mono text-slate-500">Completed</span>
                  ) : (
                    <div className="font-mono font-bold text-base">
                      {daysLeft} <span className="text-[10px] font-sans font-normal opacity-70">days left</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Exam Modal */}
      {showModal && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4 ${isDark ? 'bg-slate-950/80' : 'bg-slate-950/60'}`}>
          <div className={`rounded-2xl p-6 w-full max-w-md shadow-2xl border ${isDark ? 'bg-[#1F1F2A] border-white/10' : 'bg-white border-slate-200'}`}>
            <h3 className={`text-base font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Set Exam Date</h3>
            <form onSubmit={handleAddExam} className="space-y-4">
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Unit Code</label>
                <input
                  type="text"
                  placeholder="e.g. ICS 2404"
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 text-sm border focus:outline-none focus:ring-1 focus:ring-[#2563EB] ${isDark ? 'bg-[#11111a] border-[#2d2d4a] text-white' : 'bg-[#f8fafc] border-slate-200 text-slate-900'}`}
                  required
                />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Exam Date</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 text-sm border focus:outline-none focus:ring-1 focus:ring-[#2563EB] ${isDark ? 'bg-[#11111a] border-[#2d2d4a] text-white' : 'bg-[#f8fafc] border-slate-200 text-slate-900'}`}
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-sm transition"
                >
                  Save Exam
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
