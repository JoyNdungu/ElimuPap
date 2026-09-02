import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const YEARS = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Postgraduate', 'Alumni'];
const LANGUAGES = [
  { value: 'english', label: 'English' },
  { value: 'swahili', label: 'Swahili' },
];

export default function ProfilePage() {
  const { user, setUser, token } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '',
    university: user?.university || '',
    course: user?.course || '',
    year_of_study: user?.year_of_study || 'Year 1',
    language: user?.language || 'english',
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setSuccess('');
    setError('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccess('');
    setError('');
    try {
      const res = await api.put('/auth/profile', { ...form, token });
      // Update stored user data and context state
      localStorage.setItem('elimupap_user', JSON.stringify(res.data.user));
      setUser(res.data.user);
      setSuccess('Profile updated successfully! Your changes are saved.');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-dvh font-sans" style={{ backgroundColor: '#13131f' }}>
      <Sidebar />
      <div className="flex-1 overflow-y-auto pb-24 lg:pb-10">
        <main className="max-w-[680px] mx-auto px-6 sm:px-10 py-10">

          {/* Header */}
          <header className="mb-10 animate-fade-in">
            <h1 className="font-display text-[2.5rem] text-white leading-none mb-3 tracking-tight">
              My Profile
            </h1>
            <p className="text-[14px] leading-relaxed" style={{ color: '#9ca3af' }}>
              Update your academic details. Change your year of study here when you progress to a new year — your notes and history are always preserved.
            </p>
          </header>

          {/* Avatar + Email (non-editable) */}
          <div className="flex items-center gap-4 mb-8 p-5 rounded-2xl animate-slide-up"
            style={{ backgroundColor: '#1F1F2A', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #5B57FF, #9b59ff)' }}>
              {(user?.name || 'U')[0].toUpperCase()}
            </div>
            <div>
              <p className="text-white font-semibold text-lg">{user?.name}</p>
              <p className="text-sm" style={{ color: '#6b7280' }}>{user?.email}</p>
              <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: 'rgba(91,87,255,0.15)', color: '#a5a3ff' }}>
                {form.year_of_study}
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="space-y-5 animate-slide-up" style={{ animationDelay: '80ms' }}>

            {success && (
              <div className="p-4 rounded-xl flex items-center gap-3 text-sm"
                style={{ backgroundColor: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.2)', color: '#2dd4bf' }}>
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {success}
              </div>
            )}
            {error && (
              <div className="p-4 rounded-xl text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                {error}
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.1em] mb-2" style={{ color: '#9898c0' }}>Full Name</label>
              <input name="name" value={form.name} onChange={handleChange} type="text"
                className="w-full px-4 py-2.5 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#5B57FF]"
                style={{ backgroundColor: '#11111a', border: '1px solid #2d2d4a' }} />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.1em] mb-2" style={{ color: '#9898c0' }}>University</label>
              <input name="university" value={form.university} onChange={handleChange} type="text"
                className="w-full px-4 py-2.5 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#5B57FF]"
                style={{ backgroundColor: '#11111a', border: '1px solid #2d2d4a' }} />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.1em] mb-2" style={{ color: '#9898c0' }}>Course / Programme</label>
              <input name="course" value={form.course} onChange={handleChange} type="text"
                className="w-full px-4 py-2.5 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#5B57FF]"
                style={{ backgroundColor: '#11111a', border: '1px solid #2d2d4a' }} />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-[10px] font-bold uppercase tracking-[0.1em] mb-2" style={{ color: '#9898c0' }}>
                  Year of Study
                </label>
                <select name="year_of_study" value={form.year_of_study} onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#5B57FF]"
                  style={{ backgroundColor: '#11111a', border: '1px solid #2d2d4a' }}>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>

              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold uppercase tracking-[0.1em] mb-2" style={{ color: '#9898c0' }}>
                  Language
                </label>
                <select name="language" value={form.language} onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#5B57FF]"
                  style={{ backgroundColor: '#11111a', border: '1px solid #2d2d4a' }}>
                  {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
            </div>

            <button type="submit" disabled={saving}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all mt-4"
              style={{ backgroundColor: '#5B57FF', color: '#fff' }}
              onMouseEnter={e => !saving && (e.currentTarget.style.backgroundColor = '#7571ff')}
              onMouseLeave={e => !saving && (e.currentTarget.style.backgroundColor = '#5B57FF')}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>

        </main>
      </div>
    </div>
  );
}
