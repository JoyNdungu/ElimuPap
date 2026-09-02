import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import api from '../api/axios';

export default function NotesPage() {
  const navigate = useNavigate();
  const [units, setUnits] = useState([]);
  const [notes, setNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // UI State
  const [activeUnitCode, setActiveUnitCode] = useState(null);

  // Add Unit Form State
  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const [unitCode, setUnitCode] = useState('');
  const [unitName, setUnitName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('elimupap_token');
      const [notesRes, unitsRes] = await Promise.all([
        api.get('/notes', { headers: { Authorization: `Bearer ${token}` } }),
        api.get('/units', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setNotes(notesRes.data);
      setUnits(unitsRes.data);
      if (unitsRes.data.length > 0) {
        setActiveUnitCode(unitsRes.data[0].unit_code);
      }
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
        unit_code: unitCode,
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

  const handleDeleteUnit = async (unitId, code) => {
    if (!window.confirm(`Are you sure you want to delete ${code}?`)) return;
    
    // Optimistic update
    const previousUnits = [...units];
    const previousActive = activeUnitCode;
    const updatedUnits = units.filter(u => u.id !== unitId);
    setUnits(updatedUnits);
    if (activeUnitCode === code) {
      setActiveUnitCode(updatedUnits.length > 0 ? updatedUnits[0].unit_code : null);
    }
    
    try {
      const token = localStorage.getItem('elimupap_token');
      await api.delete(`/units/${unitId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      setUnits(previousUnits);
      setActiveUnitCode(previousActive);
      setError('Failed to delete unit.');
    }
  };

  const handleDeleteNote = async (noteId, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this note?")) return;
    
    // Optimistic update
    const previousNotes = [...notes];
    setNotes(notes.filter(n => n.id !== noteId));
    
    try {
      const token = localStorage.getItem('elimupap_token');
      await api.delete(`/notes/${noteId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      setNotes(previousNotes);
      setError(err?.response?.data?.detail || 'Failed to delete note.');
    }
  };

  const activeNotes = notes.filter(n => n.unit_code === activeUnitCode);
  const activeUnitObj = units.find(u => u.unit_code === activeUnitCode);

  return (
    <div className="flex min-h-dvh font-sans" style={{ backgroundColor: '#13131f' }}>
      <Sidebar />
      <div className="flex-1 overflow-hidden flex flex-col relative">
        <main className="flex-1 overflow-y-auto px-6 py-8 sm:px-10 lg:flex lg:gap-8">
          
          {/* ── Left Column: Units List ── */}
          <div className="lg:w-[320px] flex-shrink-0 mb-8 lg:mb-0 flex flex-col h-full">
            <header className="mb-6 animate-fade-in">
              <h1 className="font-display text-[2.5rem] text-white leading-none mb-2 tracking-tight">
                Library
              </h1>
              <p className="text-[14px]" style={{ color: '#9ca3af' }}>Manage your units and notes</p>
            </header>

            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">My Units</h2>
              <button onClick={() => setIsAddingUnit(!isAddingUnit)}
                className="text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                style={{ backgroundColor: 'rgba(91,87,255,0.1)', color: '#a5a3ff' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(91,87,255,0.2)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(91,87,255,0.1)'}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                Add Unit
              </button>
            </div>

            {/* Add Unit Form */}
            {isAddingUnit && (
              <form onSubmit={handleAddUnit} className="mb-4 p-4 rounded-xl animate-slide-up" style={{ backgroundColor: '#1F1F2A', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="mb-3">
                  <input type="text" placeholder="Unit Code (e.g. CS 101)" required value={unitCode} onChange={e => setUnitCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#5B57FF]"
                    style={{ backgroundColor: '#11111a', border: '1px solid #2d2d4a' }} />
                </div>
                <div className="mb-3">
                  <input type="text" placeholder="Unit Name" required value={unitName} onChange={e => setUnitName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#5B57FF]"
                    style={{ backgroundColor: '#11111a', border: '1px solid #2d2d4a' }} />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={isSubmitting} className="flex-1 py-2 rounded-lg text-xs font-semibold" style={{ backgroundColor: '#5B57FF', color: '#fff' }}>
                    {isSubmitting ? 'Adding...' : 'Save Unit'}
                  </button>
                  <button type="button" onClick={() => setIsAddingUnit(false)} className="px-4 py-2 rounded-lg text-xs font-medium" style={{ backgroundColor: '#2b2b36', color: '#9ca3af' }}>Cancel</button>
                </div>
              </form>
            )}

            {/* Units List */}
            <div className="space-y-2 overflow-y-auto pr-2 pb-20 lg:pb-0" style={{ maxHeight: 'calc(100vh - 200px)' }}>
              {isLoading ? (
                <p className="text-gray-500 text-sm">Loading units...</p>
              ) : units.length === 0 && !isAddingUnit ? (
                <div className="text-center p-6 border border-dashed border-gray-700 rounded-xl text-gray-500 text-sm">
                  No units yet. Add a unit to get started.
                </div>
              ) : (
                units.map(unit => (
                  <button key={unit.id} onClick={() => setActiveUnitCode(unit.unit_code)}
                    className="w-full text-left p-4 rounded-xl transition-all flex items-center justify-between group"
                    style={{
                      backgroundColor: activeUnitCode === unit.unit_code ? '#1F1F2A' : 'transparent',
                      border: `1px solid ${activeUnitCode === unit.unit_code ? 'rgba(91,87,255,0.3)' : 'transparent'}`,
                    }}>
                    <div className="min-w-0 pr-4">
                      <p className="text-sm font-medium text-white truncate group-hover:text-[#a5a3ff] transition-colors">{unit.unit_name}</p>
                      <p className="text-[11px] font-mono mt-1" style={{ color: '#6b7280' }}>{unit.unit_code}</p>
                    </div>
                    {activeUnitCode === unit.unit_code && (
                      <div className="w-1.5 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: '#5B57FF' }}></div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ── Right Column: Active Unit & Notes ── */}
          <div className="flex-1 lg:pl-8 lg:border-l border-[rgba(255,255,255,0.03)] flex flex-col h-full animate-fade-in">
            {activeUnitObj ? (
              <>
                <header className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-2xl font-display text-white">{activeUnitObj.unit_name}</h2>
                      <button onClick={() => handleDeleteUnit(activeUnitObj.id, activeUnitObj.unit_code)} className="text-gray-600 hover:text-red-400" title="Delete Unit">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 font-mono">{activeUnitObj.unit_code} • {activeNotes.length} Notes</p>
                  </div>
                  <Link to={`/upload-notes?unit=${encodeURIComponent(activeUnitObj.unit_code)}`}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-semibold transition-colors"
                    style={{ backgroundColor: '#5B57FF', color: '#fff' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#7571ff'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#5B57FF'}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Upload Notes
                  </Link>
                </header>

                <div className="flex-1 overflow-y-auto pb-24 lg:pb-0 pr-2">
                  {activeNotes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 border border-dashed border-[rgba(255,255,255,0.05)] rounded-2xl text-center px-4">
                      <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(91,87,255,0.05)' }}>
                        <svg className="w-8 h-8 text-[#5B57FF] opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                      </div>
                      <p className="text-gray-400 text-sm mb-4 max-w-sm">No notes uploaded for {activeUnitObj.unit_name} yet. Upload your lecture materials to start studying.</p>
                      <Link to={`/upload-notes?unit=${encodeURIComponent(activeUnitObj.unit_code)}`} className="text-[#a5a3ff] text-sm font-medium hover:underline">Upload your first note →</Link>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {activeNotes.map(note => (
                        <Link key={note.id} to={`/notes/${note.id}`} className="rounded-2xl p-5 flex flex-col gap-4 transition-transform hover:-translate-y-0.5 hover:shadow-lg group relative overflow-hidden"
                          style={{ backgroundColor: '#1F1F2A', border: '1px solid rgba(255,255,255,0.03)' }}>
                          <div className="absolute top-0 left-0 w-1 h-full bg-[#5B57FF] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          
                          <button onClick={(e) => handleDeleteNote(note.id, e)} className="absolute top-3 right-3 p-1.5 rounded-lg text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-400/10 transition-all z-10" title="Delete Note">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>

                          <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl flex flex-shrink-0 items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
                              <svg className="w-5 h-5 text-gray-400 group-hover:text-[#5B57FF] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-[15px] font-medium text-white mb-1 line-clamp-2 leading-snug group-hover:text-[#a5a3ff] transition-colors" title={note.title}>{note.title}</h4>
                              <p className="text-[11px] text-gray-500">{note.date || 'Recently'}</p>
                            </div>
                          </div>

                          <div className="mt-auto pt-4 border-t border-[rgba(255,255,255,0.03)] flex justify-between items-center">
                            <span className="text-[11px] font-medium px-2 py-1 rounded-md" style={{ backgroundColor: 'rgba(91,87,255,0.1)', color: '#7571ff' }}>Open Note</span>
                            <span className="text-[11px] font-medium text-gray-500 group-hover:text-white transition-colors">Study Tools →</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              !isLoading && (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-gray-500 text-sm">Select a unit from the left panel.</p>
                </div>
              )
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
