import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { Link, useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import PastPaperBank from '../components/PastPaperBank';

export default function UnitTopicsPage() {
  const { unitCode } = useParams();
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [unit, setUnit] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('notes'); // 'notes', 'past_papers', 'graph'

  useEffect(() => {
    fetchData();
  }, [unitCode]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('elimupap_token');
      const [notesRes, unitsRes] = await Promise.all([
        api.get('/notes', { headers: { Authorization: `Bearer ${token}` } }),
        api.get('/units', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      const foundUnit = unitsRes.data.find(u => u.unit_code === unitCode);
      if (!foundUnit) {
        navigate('/notes');
        return;
      }
      setUnit(foundUnit);
      setNotes(notesRes.data.filter(n => n.unit_code === unitCode));
    } catch (err) {
      console.error("Failed to fetch data", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteNote = async (noteId, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this note?")) return;
    
    const previousNotes = [...notes];
    setNotes(notes.filter(n => n.id !== noteId));
    
    try {
      const token = localStorage.getItem('elimupap_token');
      await api.delete(`/notes/${noteId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.error(err);
      setNotes(previousNotes);
      alert('Failed to delete note.');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-dvh font-sans" style={{ backgroundColor: '#17171F' }}>
      <Sidebar />

      <div className="flex-1 overflow-y-auto pb-28 lg:pb-10 relative min-w-0">
        <main className="max-w-[1100px] mx-auto px-4 sm:px-10 py-6 sm:py-10">
          
          {/* Header */}
          <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-6 mb-8 animate-fade-in">
            <div className="max-w-[600px]">
              <Link to="/notes" className="inline-flex items-center gap-2 text-[13px] font-medium text-[#9ca3af] hover:text-white transition-colors mb-4">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                Back to All Units
              </Link>
              <h1 className="font-display text-2xl sm:text-[2.75rem] text-white leading-tight mb-2 tracking-tight">
                {unit?.unit_name || unitCode}
              </h1>
              <p className="text-[15px] leading-relaxed" style={{ color: '#9ca3af' }}>
                {unitCode} • Manage notes, past papers, and concept graphs for this unit.
              </p>
            </div>
            
            <div className="flex-shrink-0 w-full md:w-auto">
              <Link to={`/upload-notes?unit=${unitCode}`} className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-[13px] font-medium transition-colors"
                style={{ backgroundColor: '#5B57FF', color: '#fff' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#7571ff'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#5B57FF'}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Upload Note
              </Link>
            </div>
          </header>

          {/* Unit Feature Tabs */}
          <div className="flex bg-[#11111a] border border-[rgba(255,255,255,0.05)] p-1.5 rounded-2xl mb-8 max-w-md">
            <button
              onClick={() => setActiveTab('notes')}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === 'notes' ? 'bg-[#5B57FF] text-white shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              Topics & Notes
            </button>
            <button
              onClick={() => setActiveTab('past_papers')}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === 'past_papers' ? 'bg-[#5B57FF] text-white shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              Past Papers Bank
            </button>
          </div>

          {activeTab === 'past_papers' && <PastPaperBank />}

          {activeTab === 'notes' && (
            <>


          {/* ── Topics Quick List (Table of Contents) ── */}
          {!isLoading && unit?.topics?.length > 0 && (
            <div className="mb-10 p-5 rounded-2xl animate-fade-in" style={{ backgroundColor: '#1F1F2A', border: '1px solid rgba(255,255,255,0.03)' }}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Topics in {unitCode}</h3>
              <div className="flex flex-wrap gap-2">
                {unit.topics.map((topic, idx) => (
                  <button 
                    key={idx}
                    onClick={() => {
                      document.getElementById(`topic-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors hover:-translate-y-0.5"
                    style={{ backgroundColor: '#2b2b36', color: '#c4c2ff', border: '1px solid rgba(255,255,255,0.03)' }}>
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Topics List ── */}
          {isLoading ? (
            <div className="text-center py-20 text-gray-400">Loading topics...</div>
          ) : (
            <div className="space-y-8 animate-slide-up" style={{ animationDelay: '100ms' }}>
              
              {unit?.topics?.length === 0 ? (
                <div className="text-center py-20 rounded-2xl" style={{ border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <p className="text-gray-400 mb-4">You haven't registered any topics for this unit yet.</p>
                  <Link to="/units" className="text-[#5B57FF] hover:underline">Manage Units</Link>
                </div>
              ) : (
                unit?.topics?.map((topic, topicIdx) => {
                  const topicNotes = notes.filter(n => n.topic === topic);
                  
                  return (
                    <div id={`topic-${topicIdx}`} key={topicIdx} className="rounded-2xl overflow-hidden scroll-mt-24" style={{ backgroundColor: '#1F1F2A', border: '1px solid rgba(255,255,255,0.03)' }}>
                      
                      {/* Topic Header */}
                      <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', backgroundColor: '#22222d' }}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(91,87,255,0.1)' }}>
                            <svg className="w-4 h-4 text-[#7571ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 6v3.776" />
                            </svg>
                          </div>
                          <h2 className="text-lg font-medium text-white">{topic}</h2>
                        </div>
                        <Link to={`/tutor?unit=${encodeURIComponent(unitCode)}&topic=${encodeURIComponent(topic)}`} className="text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2"
                          style={{ backgroundColor: 'rgba(45,212,191,0.1)', color: '#2dd4bf' }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(45,212,191,0.2)'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(45,212,191,0.1)'}>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                          </svg>
                          Ask ElimuPap Tutor
                        </Link>
                      </div>

                      {/* Notes Grid */}
                      <div className="p-6">
                        {topicNotes.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8">
                            <p className="text-[14px] text-gray-500 mb-4">No notes uploaded for this topic yet.</p>
                            <Link to={`/upload-notes?unit=${encodeURIComponent(unitCode)}&topic=${encodeURIComponent(topic)}`} className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors"
                              style={{ border: '1px solid rgba(91,87,255,0.3)', color: '#c4c2ff', backgroundColor: 'rgba(91,87,255,0.05)' }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(91,87,255,0.1)'}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(91,87,255,0.05)'}>
                              Upload Notes for {topic}
                            </Link>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {topicNotes.map(note => (
                              <Link key={note.id} to={`/notes/${note.id}`} className="rounded-xl p-4 flex flex-col gap-3 transition-transform hover:-translate-y-0.5 hover:shadow-lg group"
                                style={{ backgroundColor: '#17171F', border: '1px solid rgba(255,255,255,0.03)' }}>
                                <div className="flex items-start justify-between">
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                                    <svg className="w-4 h-4 text-gray-400 group-hover:text-[#5B57FF] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                    </svg>
                                  </div>
                                  <button onClick={(e) => handleDeleteNote(note.id, e)} className="p-1.5 rounded-lg text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-400/10 transition-all z-10" title="Delete Note">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                                </div>
                                <div>
                                  <h4 className="text-[14px] font-medium text-white mb-1 line-clamp-2 group-hover:text-[#c4c2ff] transition-colors" title={note.title}>{note.title}</h4>
                                  <div className="flex justify-between items-center">
                                    <span className="text-[11px] text-gray-500">{note.date || 'Recently'}</span>
                                    <span className="text-[11px] text-[#5B57FF] font-medium opacity-0 group-hover:opacity-100 transition-opacity">View Summary →</span>
                                  </div>
                                </div>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })
              )}

            </div>
          )}
          </>
          )}

        </main>

      </div>
    </div>
  );
}
