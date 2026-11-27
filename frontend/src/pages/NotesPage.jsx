import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import AudioRecorderModal from '../components/AudioRecorderModal';
import { useTheme } from '../context/ThemeContext';
import api from '../api/axios';
import { getPendingUploads, removePendingUpload } from '../utils/offlineUploads';

export default function NotesPage() {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [units, setUnits] = useState([]);
  const [notes, setNotes] = useState([]);
  const [pendingUploads, setPendingUploads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // UI Filter State
  const initialFilter = searchParams.get('filter') || 'all';
  const [mediaFilter, setMediaFilter] = useState(initialFilter); // 'all' | 'audio' | 'docs'
  const [activeUnitCode, setActiveUnitCode] = useState(searchParams.get('unit') || 'ALL');
  const [audioModalOpen, setAudioModalOpen] = useState(false);

  // Add Unit Form State
  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const [unitCode, setUnitCode] = useState('');
  const [unitName, setUnitName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'note' | 'unit', id, title, code }
  const [isDeleting, setIsDeleting] = useState(false);

  const refreshPendingUploads = async () => {
    const items = await getPendingUploads();
    setPendingUploads(items);
  };

  useEffect(() => {
    fetchData();
    refreshPendingUploads();

    const onUploadsUpdated = () => refreshPendingUploads();
    const onUploadsSynced = () => {
      refreshPendingUploads();
      fetchData();
    };
    window.addEventListener('elimupap:uploads-updated', onUploadsUpdated);
    window.addEventListener('elimupap:uploads-synced', onUploadsSynced);
    return () => {
      window.removeEventListener('elimupap:uploads-updated', onUploadsUpdated);
      window.removeEventListener('elimupap:uploads-synced', onUploadsSynced);
    };
  }, []);

  // Sync mediaFilter with URL if changed
  useEffect(() => {
    const f = searchParams.get('filter');
    if (f && ['all', 'audio', 'docs'].includes(f)) {
      setMediaFilter(f);
    }
  }, [searchParams]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('elimupap_token');
      const [notesRes, unitsRes] = await Promise.all([
        api.get('/notes', { headers: { Authorization: `Bearer ${token}` } }),
        api.get('/units', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setNotes(notesRes.data || []);
      setUnits(unitsRes.data || []);
    } catch (err) {
      console.error("Failed to fetch data", err);
      setError('Failed to load library.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUnit = async (e) => {
    e.preventDefault();
    if (!unitCode || !unitName) return;
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('elimupap_token');
      const res = await api.post('/units/', {
        unit_code: unitCode.toUpperCase(),
        unit_name: unitName,
        topics: []
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUnits([...units, res.data]);
      setActiveUnitCode(res.data.unit_code);
      setUnitCode('');
      setUnitName('');
      setIsAddingUnit(false);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to add unit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUnit = (unitId, code, name) => {
    setDeleteTarget({
      type: 'unit',
      id: unitId,
      code,
      title: name ? `${code} — ${name}` : code,
    });
  };

  const handleDeleteNote = (note, e) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteTarget({
      type: 'note',
      id: note.id,
      title: note.title || 'this note',
      isOfflinePending: Boolean(note.isOfflinePending),
    });
  };

  const confirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    const token = localStorage.getItem('elimupap_token');

    if (deleteTarget.type === 'unit') {
      const previousUnits = [...units];
      const previousActive = activeUnitCode;
      setUnits(units.filter(u => u.id !== deleteTarget.id));
      if (activeUnitCode === deleteTarget.code) {
        setActiveUnitCode('ALL');
      }
      try {
        await api.delete(`/units/${deleteTarget.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        window.dispatchEvent(new CustomEvent('elimupap:data-changed'));
        setDeleteTarget(null);
      } catch (err) {
        setUnits(previousUnits);
        setActiveUnitCode(previousActive);
        setError(err?.response?.data?.detail || 'Failed to delete unit.');
      } finally {
        setIsDeleting(false);
      }
      return;
    }

    if (deleteTarget.isOfflinePending) {
      try {
        await removePendingUpload(deleteTarget.id);
        setPendingUploads(prev => prev.filter(p => p.id !== deleteTarget.id));
        setDeleteTarget(null);
      } catch {
        setError('Failed to remove queued offline note.');
      } finally {
        setIsDeleting(false);
      }
      return;
    }

    const previousNotes = [...notes];
    setNotes(notes.filter(n => n.id !== deleteTarget.id));
    try {
      await api.delete(`/notes/${deleteTarget.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      window.dispatchEvent(new CustomEvent('elimupap:data-changed'));
      setDeleteTarget(null);
    } catch (err) {
      setNotes(previousNotes);
      setError(err?.response?.data?.detail || 'Failed to delete note.');
    } finally {
      setIsDeleting(false);
    }
  };

  const allNotes = useMemo(() => [...pendingUploads, ...notes], [pendingUploads, notes]);

  // Compile combined units (including auto-discovered ones from notes like GENERAL)
  const combinedUnits = useMemo(() => {
    const list = [...units];
    const noteCodes = [...new Set(allNotes.map(n => (n.unit_code || 'GENERAL').toUpperCase()))];
    noteCodes.forEach(code => {
      if (!list.some(u => u.unit_code?.toUpperCase() === code)) {
        list.push({
          id: `virtual_${code}`,
          unit_code: code,
          unit_name: code === 'GENERAL' ? 'General & Recorded Lectures' : `${code} Material`,
          topics: []
        });
      }
    });
    return list;
  }, [units, allNotes]);

  // Total counts
  const totalAudioCount = useMemo(() => allNotes.filter(n => n.file_type === 'audio_lecture').length, [allNotes]);
  const totalDocsCount = useMemo(() => allNotes.filter(n => n.file_type !== 'audio_lecture').length, [allNotes]);

  // Filter notes by unit and media type
  const displayedNotes = useMemo(() => {
    let result = allNotes;
    if (activeUnitCode && activeUnitCode !== 'ALL') {
      result = result.filter(n => (n.unit_code || 'GENERAL').toUpperCase() === activeUnitCode.toUpperCase());
    }
    if (mediaFilter === 'audio') {
      result = result.filter(n => n.file_type === 'audio_lecture');
    } else if (mediaFilter === 'docs') {
      result = result.filter(n => n.file_type !== 'audio_lecture');
    }
    return result;
  }, [allNotes, activeUnitCode, mediaFilter]);

  const activeUnitObj = activeUnitCode === 'ALL'
    ? { unit_name: 'All Library Materials', unit_code: 'ALL' }
    : combinedUnits.find(u => u.unit_code?.toUpperCase() === activeUnitCode.toUpperCase()) || { unit_name: activeUnitCode, unit_code: activeUnitCode };

  return (
    <div
      className="flex flex-col lg:flex-row min-h-dvh font-sans transition-colors"
      style={{
        backgroundColor: isDark ? '#13131f' : '#f8fafc',
        color: isDark ? '#ffffff' : '#0f172a',
      }}
    >
      <Sidebar />
      <div className="flex-1 overflow-hidden flex flex-col relative min-w-0">
        <main className="flex-1 overflow-y-auto px-4 sm:px-10 py-6 sm:py-8 lg:flex lg:gap-8 pb-28 lg:pb-12">

          {/* ── Mobile Header & Unit Selector ── */}
          <div className="lg:hidden mb-6">
            <header className="mb-4 flex items-center justify-between">
              <div>
                <h1 className={`font-display text-2xl sm:text-3xl font-bold leading-tight mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Library
                </h1>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                  View notes, documents &amp; audio recordings
                </p>
              </div>
              <button
                onClick={() => setAudioModalOpen(true)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
                  isDark
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                Record Audio
              </button>
            </header>

            {/* Horizontal Unit Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar">
              <button
                onClick={() => setActiveUnitCode('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition flex items-center gap-1.5 border ${
                  activeUnitCode === 'ALL'
                    ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-sm'
                    : isDark
                    ? 'bg-white/5 text-gray-300 border-white/5 hover:bg-white/10'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>All Units</span>
                <span className="opacity-70 text-[10px]">({notes.length})</span>
              </button>

              {combinedUnits.map(unit => (
                <button
                  key={unit.id}
                  onClick={() => setActiveUnitCode(unit.unit_code)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition flex items-center gap-1.5 border ${
                    activeUnitCode === unit.unit_code
                      ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-sm'
                      : isDark
                      ? 'bg-white/5 text-gray-300 border-white/5 hover:bg-white/10'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-mono font-bold">{unit.unit_code}</span>
                  <span className="opacity-70 text-[10px]">
                    ({notes.filter(n => (n.unit_code || 'GENERAL').toUpperCase() === unit.unit_code.toUpperCase()).length})
                  </span>
                </button>
              ))}
              <button
                onClick={() => setIsAddingUnit(!isAddingUnit)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border whitespace-nowrap flex items-center gap-1 flex-shrink-0 ${
                  isDark
                    ? 'text-blue-300 bg-blue-500/10 border-blue-500/20'
                    : 'text-[#2563EB] bg-blue-50 border-blue-200 hover:bg-blue-100'
                }`}
              >
                <span>+ Add Unit</span>
              </button>
            </div>

            {/* Mobile Add Unit Form */}
            {isAddingUnit && (
              <form
                onSubmit={handleAddUnit}
                className={`mt-3 p-4 rounded-xl animate-slide-up border ${
                  isDark ? 'bg-[#1F1F2A] border-white/10' : 'bg-white border-slate-200 shadow-sm'
                }`}
              >
                <div className="mb-2.5">
                  <input
                    type="text"
                    placeholder="Unit Code (e.g. CS 101)"
                    required
                    value={unitCode}
                    onChange={e => setUnitCode(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg text-xs sm:text-sm border focus:outline-none focus:ring-1 focus:ring-[#2563EB] ${
                      isDark ? 'text-white bg-[#11111a] border-[#2d2d4a]' : 'text-slate-900 bg-[#f8fafc] border-slate-200'
                    }`}
                  />
                </div>
                <div className="mb-3">
                  <input
                    type="text"
                    placeholder="Unit Name"
                    required
                    value={unitName}
                    onChange={e => setUnitName(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg text-xs sm:text-sm border focus:outline-none focus:ring-1 focus:ring-[#2563EB] ${
                      isDark ? 'text-white bg-[#11111a] border-[#2d2d4a]' : 'text-slate-900 bg-[#f8fafc] border-slate-200'
                    }`}
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={isSubmitting} className="flex-1 py-2 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white">
                    {isSubmitting ? 'Adding...' : 'Save Unit'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingUnit(false)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium ${
                      isDark ? 'bg-[#2b2b36] text-gray-300' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* ── Left Column: Units List (Desktop) ── */}
          <div className="hidden lg:flex lg:w-[280px] flex-shrink-0 flex-col h-full">
            <header className="mb-6 animate-fade-in">
              <h1 className={`font-display text-[2.4rem] leading-none mb-2 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Library
              </h1>
              <p className={`text-[13px] ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                Browse units and study materials
              </p>
            </header>

            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Categories &amp; Units</h2>
              <button
                onClick={() => setIsAddingUnit(!isAddingUnit)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 border ${
                  isDark
                    ? 'bg-[#2563EB]/15 text-blue-300 border-[#2563EB]/25 hover:bg-[#2563EB]/25'
                    : 'bg-blue-50 text-[#2563EB] border-blue-200 hover:bg-blue-100'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                Add Unit
              </button>
            </div>

            {/* Add Unit Form */}
            {isAddingUnit && (
              <form
                onSubmit={handleAddUnit}
                className={`mb-4 p-4 rounded-xl animate-slide-up border ${
                  isDark ? 'bg-[#1F1F2A] border-white/10' : 'bg-white border-slate-200 shadow-sm'
                }`}
              >
                <div className="mb-2">
                  <input
                    type="text"
                    placeholder="Unit Code (e.g. CS 101)"
                    required
                    value={unitCode}
                    onChange={e => setUnitCode(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg text-xs border focus:outline-none focus:ring-1 focus:ring-[#2563EB] ${
                      isDark ? 'text-white bg-[#11111a] border-[#2d2d4a]' : 'text-slate-900 bg-[#f8fafc] border-slate-200'
                    }`}
                  />
                </div>
                <div className="mb-3">
                  <input
                    type="text"
                    placeholder="Unit Name"
                    required
                    value={unitName}
                    onChange={e => setUnitName(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg text-xs border focus:outline-none focus:ring-1 focus:ring-[#2563EB] ${
                      isDark ? 'text-white bg-[#11111a] border-[#2d2d4a]' : 'text-slate-900 bg-[#f8fafc] border-slate-200'
                    }`}
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={isSubmitting} className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white">
                    {isSubmitting ? 'Adding...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingUnit(false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                      isDark ? 'bg-[#2b2b36] text-gray-300' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Units & All List */}
            <div className="space-y-1.5 overflow-y-auto pr-2 pb-20 lg:pb-0" style={{ maxHeight: 'calc(100vh - 220px)' }}>
              {/* All Units Option */}
              <button
                onClick={() => setActiveUnitCode('ALL')}
                className="w-full text-left p-3 rounded-xl transition-all flex items-center justify-between group"
                style={{
                  backgroundColor: activeUnitCode === 'ALL' ? (isDark ? '#1F1F2A' : '#ffffff') : 'transparent',
                  border: `1px solid ${
                    activeUnitCode === 'ALL'
                      ? (isDark ? 'rgba(37,99,235,0.45)' : '#bfdbfe')
                      : 'transparent'
                  }`,
                }}
              >
                <div className="min-w-0 pr-3">
                  <p className={`text-xs font-semibold transition-colors ${
                    isDark ? 'text-white group-hover:text-blue-400' : 'text-slate-900 group-hover:text-[#2563EB]'
                  }`}>
                    All Materials
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{notes.length} total items</p>
                </div>
                {activeUnitCode === 'ALL' && (
                  <div className="w-1.5 h-5 rounded-full flex-shrink-0 bg-[#2563EB]"></div>
                )}
              </button>

              {/* Units List */}
              {combinedUnits.map(unit => {
                const count = notes.filter(n => (n.unit_code || 'GENERAL').toUpperCase() === unit.unit_code.toUpperCase()).length;
                const audioCount = notes.filter(n => (n.unit_code || 'GENERAL').toUpperCase() === unit.unit_code.toUpperCase() && n.file_type === 'audio_lecture').length;
                const isSelected = activeUnitCode === unit.unit_code;

                return (
                  <button
                    key={unit.id}
                    onClick={() => setActiveUnitCode(unit.unit_code)}
                    className="w-full text-left p-3 rounded-xl transition-all flex items-center justify-between group"
                    style={{
                      backgroundColor: isSelected ? (isDark ? '#1F1F2A' : '#ffffff') : 'transparent',
                      border: `1px solid ${
                        isSelected
                          ? (isDark ? 'rgba(37,99,235,0.45)' : '#bfdbfe')
                          : 'transparent'
                      }`,
                    }}
                  >
                    <div className="min-w-0 pr-3">
                      <p className={`text-xs font-medium truncate transition-colors ${
                        isDark ? 'text-white group-hover:text-blue-400' : 'text-slate-900 group-hover:text-[#2563EB]'
                      }`}>
                        {unit.unit_name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-mono ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>{unit.unit_code}</span>
                        {audioCount > 0 && (
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                            isDark ? 'bg-rose-500/20 text-rose-300' : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            🎙️ {audioCount}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500">• {count} items</span>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-1.5 h-5 rounded-full flex-shrink-0 bg-[#2563EB]"></div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Right Column: Notes & Recordings Grid ── */}
          <div className={`flex-1 lg:pl-8 lg:border-l flex flex-col h-full animate-fade-in min-w-0 ${
            isDark ? 'border-white/5' : 'border-slate-200'
          }`}>

            {/* Header with Title and Actions */}
            <header className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className={`text-2xl font-display ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {activeUnitObj.unit_name}
                  </h2>
                  {activeUnitCode !== 'ALL' && !activeUnitObj.id?.startsWith('virtual_') && (
                    <button
                      onClick={() => handleDeleteUnit(activeUnitObj.id, activeUnitObj.unit_code, activeUnitObj.unit_name)}
                      className={`transition-colors ${isDark ? 'text-gray-500 hover:text-red-400' : 'text-slate-400 hover:text-red-600'}`}
                      title="Delete Unit"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                </div>
                <p className={`text-xs font-mono ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                  {activeUnitCode === 'ALL' ? 'All Units' : activeUnitObj.unit_code} • {displayedNotes.length} Items Listed
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setAudioModalOpen(true)}
                  className={`hidden lg:inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border shadow-sm ${
                    isDark
                      ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/30'
                      : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                  Record Audio
                </button>

                <Link
                  to={activeUnitCode !== 'ALL' ? `/upload-notes?unit=${encodeURIComponent(activeUnitObj.unit_code)}` : '/upload-notes'}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all bg-[#2563EB] hover:bg-[#1D4ED8] shadow-sm"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Upload File
                </Link>
              </div>
            </header>

            {/* Media Filter Tabs (All / Audio Lectures / Documents) */}
            <div className={`flex items-center gap-2 mb-6 border-b pb-3 flex-wrap ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
              <button
                onClick={() => setMediaFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-1.5 border ${
                  mediaFilter === 'all'
                    ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-sm'
                    : isDark
                    ? 'bg-white/5 text-gray-400 border-transparent hover:text-white'
                    : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span>All Materials</span>
                <span className="opacity-75 text-[10px]">({notes.length})</span>
              </button>

              <button
                onClick={() => setMediaFilter('audio')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 border ${
                  mediaFilter === 'audio'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                    : isDark
                    ? 'bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 border-rose-500/25'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200'
                }`}
              >
                <span>🎙️ Lecture Recordings</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  mediaFilter === 'audio'
                    ? 'bg-white/20 text-white'
                    : isDark
                    ? 'bg-rose-400/20 text-rose-200'
                    : 'bg-rose-200/70 text-rose-800'
                }`}>
                  {totalAudioCount}
                </span>
              </button>

              <button
                onClick={() => setMediaFilter('docs')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-1.5 border ${
                  mediaFilter === 'docs'
                    ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-sm'
                    : isDark
                    ? 'bg-white/5 text-gray-400 border-transparent hover:text-white'
                    : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span>📄 Documents &amp; Slides</span>
                <span className="opacity-75 text-[10px]">({totalDocsCount})</span>
              </button>
            </div>

            {/* Notes & Recordings Grid */}
            <div className="flex-1 overflow-y-auto pb-24 lg:pb-0 pr-1">
              {displayedNotes.length === 0 ? (
                <div className={`flex flex-col items-center justify-center py-16 border border-dashed rounded-3xl text-center px-4 ${
                  isDark ? 'border-white/10 bg-[#1F1F2A]/60' : 'border-slate-300 bg-white'
                }`}>
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${
                    isDark ? 'bg-white/5' : 'bg-[#f8fafc] border border-slate-200'
                  }`}>
                    {mediaFilter === 'audio' ? (
                      <span className="text-2xl">🎙️</span>
                    ) : (
                      <svg className="w-7 h-7 text-[#2563EB] opacity-75" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                    )}
                  </div>
                  <h3 className={`font-medium text-sm mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {mediaFilter === 'audio' ? 'No audio lecture recordings yet' : 'No materials found'}
                  </h3>
                  <p className={`text-xs mb-5 max-w-sm ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                    {mediaFilter === 'audio'
                      ? 'Record audio directly during class or lectures. They will appear here with an interactive audio player and AI summary.'
                      : 'Upload notes, PDFs, or record lectures to start studying.'}
                  </p>
                  {mediaFilter === 'audio' ? (
                    <button
                      onClick={() => setAudioModalOpen(true)}
                      className="px-5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition flex items-center gap-2"
                    >
                      <span>🎙️</span> Record First Lecture Audio
                    </button>
                  ) : (
                    <Link
                      to={activeUnitCode !== 'ALL' ? `/upload-notes?unit=${encodeURIComponent(activeUnitObj.unit_code)}` : '/upload-notes'}
                      className="text-[#2563EB] hover:text-[#1D4ED8] text-xs font-semibold hover:underline"
                    >
                      Upload your first material &rarr;
                    </Link>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {displayedNotes.map(note => {
                    const isAudio = note.file_type === 'audio_lecture';

                    return (
                      <Link
                        key={note.id}
                        to={`/notes/${note.id}`}
                        className={`rounded-2xl p-5 flex flex-col gap-4 transition-all hover:-translate-y-0.5 shadow-sm hover:shadow-md group relative overflow-hidden border ${
                          isAudio
                            ? isDark
                              ? 'bg-[#1C1625] border-rose-500/25 hover:border-rose-500/50'
                              : 'bg-white border-rose-200 hover:border-rose-300'
                            : isDark
                            ? 'bg-[#1F1F2A] border-white/5 hover:border-white/15'
                            : 'bg-white border-slate-200 hover:border-blue-300'
                        }`}
                      >
                        {/* Accent Bar */}
                        <div
                          className={`absolute top-0 left-0 w-1.5 h-full transition-opacity ${
                            isAudio ? 'bg-rose-500 opacity-90' : 'bg-[#2563EB] opacity-0 group-hover:opacity-100'
                          }`}
                        />

                        {/* Delete Button (always visible on mobile & desktop) */}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteNote(note, e)}
                          aria-label={`Delete ${note.title || 'note'}`}
                          className={`absolute top-3 right-3 p-2 rounded-xl opacity-100 lg:opacity-75 lg:group-hover:opacity-100 transition-all z-10 border ${
                            isDark
                              ? 'text-rose-400 bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/20'
                              : 'text-rose-600 bg-rose-50 border-rose-200 hover:bg-rose-100'
                          }`}
                          title="Delete note"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>

                        <div className="flex items-start gap-3.5">
                          {/* Icon Container */}
                          <div
                            className={`w-11 h-11 rounded-xl flex flex-shrink-0 items-center justify-center transition-colors border ${
                              isAudio
                                ? isDark
                                  ? 'bg-rose-500/15 border-rose-500/30'
                                  : 'bg-rose-50 border-rose-200'
                                : isDark
                                ? 'bg-white/5 border-white/5 group-hover:border-[#2563EB]/40'
                                : 'bg-[#f8fafc] border-slate-200 group-hover:border-blue-200'
                            }`}
                          >
                            {isAudio ? (
                              <svg className={`w-5 h-5 ${isDark ? 'text-rose-400' : 'text-rose-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15a3 3 0 01-3-3V4.5a3 3 0 116 0v7.5a3 3 0 01-3 3z" />
                              </svg>
                            ) : (
                              <svg className={`w-5 h-5 transition-colors ${isDark ? 'text-gray-400 group-hover:text-blue-400' : 'text-slate-500 group-hover:text-[#2563EB]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                              </svg>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0 pr-10">
                            <div className="flex items-center gap-2 mb-1">
                              {isAudio ? (
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border flex items-center gap-1 ${
                                  isDark
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}>
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                                  Audio Lecture
                                </span>
                              ) : (
                                <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                                  isDark
                                    ? 'bg-white/5 text-gray-400 border-transparent'
                                    : 'bg-[#f8fafc] text-slate-600 border-slate-200'
                                }`}>
                                  {note.file_type || 'DOC'}
                                </span>
                              )}
                              <span className={`text-[10px] font-mono ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                                {note.unit_code || 'General'}
                              </span>
                              {note.isOfflinePending && (
                                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                                  isDark
                                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                  Pending Sync
                                </span>
                              )}
                            </div>
                            <h4
                              className={`text-[14px] font-semibold leading-snug line-clamp-2 transition-colors ${
                                isAudio
                                  ? isDark
                                    ? 'text-rose-100 group-hover:text-rose-300'
                                    : 'text-slate-900 group-hover:text-rose-700'
                                  : isDark
                                  ? 'text-white group-hover:text-blue-400'
                                  : 'text-slate-900 group-hover:text-[#2563EB]'
                              }`}
                              title={note.title}
                            >
                              {note.title}
                            </h4>
                            <p className="text-[11px] text-slate-500 mt-1">{note.date || 'Recently'}</p>
                          </div>
                        </div>

                        {/* Bottom Action Footer */}
                        <div className={`mt-auto pt-3 border-t flex justify-between items-center text-xs ${
                          isDark ? 'border-white/5' : 'border-slate-200'
                        }`}>
                          {isAudio ? (
                            <span className={`font-semibold flex items-center gap-1.5 text-[11px] ${
                              isDark ? 'text-rose-300' : 'text-rose-700'
                            }`}>
                              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                              Listen &amp; Read Transcript
                            </span>
                          ) : (
                            <span className={`font-medium px-2 py-0.5 rounded-md text-[11px] ${
                              isDark ? 'bg-[#2563EB]/20 text-blue-300' : 'bg-blue-50 text-[#2563EB]'
                            }`}>
                              Open Note
                            </span>
                          )}
                          <span className={`text-[11px] transition-colors ${
                            isDark ? 'text-gray-400 group-hover:text-white' : 'text-slate-500 group-hover:text-[#2563EB]'
                          }`}>
                            Study Tools &rarr;
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Audio Recorder Modal */}
      <AudioRecorderModal
        isOpen={audioModalOpen}
        onClose={() => {
          setAudioModalOpen(false);
          fetchData();
        }}
      />

      {/* Delete Confirmation Alert Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-fade-in"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
          onClick={() => !isDeleting && setDeleteTarget(null)}
        >
          <div
            className={`w-full max-w-sm rounded-2xl p-6 shadow-2xl border animate-slide-up ${
              isDark ? 'bg-[#1F1F2A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                isDark ? 'bg-rose-500/15 border-rose-500/30 text-rose-400' : 'bg-rose-50 border-rose-200 text-rose-600'
              }`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 id="delete-confirm-title" className="text-base font-bold leading-snug">
                  {deleteTarget.type === 'unit' ? 'Delete Unit?' : 'Delete Note?'}
                </h3>
                <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
                  Are you sure you want to delete <span className="font-semibold">&ldquo;{deleteTarget.title}&rdquo;</span>? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border transition disabled:opacity-50 ${
                  isDark
                    ? 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                    : 'bg-[#f8fafc] border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition disabled:opacity-60"
              >
                {isDeleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
