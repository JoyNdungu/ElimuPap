import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import api from '../api/axios';

export default function NoteViewerPage() {
  const { noteId } = useParams();
  const navigate = useNavigate();
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Tools state
  const [activeTool, setActiveTool] = useState(null); // 'summary', 'flashcards', 'mindmap', 'annotated'
  const [toolData, setToolData] = useState(null);
  const [toolLoading, setToolLoading] = useState(false);
  const [toolError, setToolError] = useState('');

  useEffect(() => {
    fetchNote();
    
    // Log note opened
    const token = localStorage.getItem('elimupap_token');
    api.post('/progress/activity', { type: 'note_opened', note_id: noteId }, {
      headers: { Authorization: `Bearer ${token}` }
    }).catch(() => { });

    // Start time_spent heartbeat every 60 seconds
    const interval = setInterval(() => {
      api.post('/progress/activity', { 
        type: 'time_spent', 
        note_id: noteId,
        duration_minutes: 1
      }, {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => { });
    }, 60000);

    return () => clearInterval(interval);
  }, [noteId]);

  const fetchNote = async () => {
    try {
      const token = localStorage.getItem('elimupap_token');
      const res = await api.get(`/notes/${noteId}`, { headers: { Authorization: `Bearer ${token}` } });
      setNote(res.data);
    } catch (err) {
      setError('Failed to fetch note');
    } finally {
      setLoading(false);
    }
  };

  const handleRunTool = async (toolEndpoint, toolName) => {
    setActiveTool(toolName);
    setToolLoading(true);
    setToolData(null);
    setToolError('');
    try {
      const token = localStorage.getItem('elimupap_token');
      const res = await api.post(`/ai/${toolEndpoint}`, { note_id: noteId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setToolData(res.data);
      
      // Log tool activity
      if (toolName === 'Flashcards') {
        api.post('/progress/activity', { type: 'flashcards_reviewed', note_id: noteId }, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => {});
      } else if (toolName === 'Summary' || toolName === 'Mind Map') {
        api.post('/progress/activity', { type: 'ai_practice', note_id: noteId }, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => {});
      }
    } catch (err) {
      console.error(`Failed to generate ${toolName}:`, err);
      setToolError(err.response?.data?.detail || `Failed to generate ${toolName}`);
    } finally {
      setToolLoading(false);
    }
  };

  // The backend exposes PDF files statically at /uploads/filename
  const pdfUrl = note?.safe_filename ? `http://localhost:8000/uploads/${note.safe_filename}` : null;

  return (
    <div className="flex min-h-dvh font-sans" style={{ backgroundColor: '#13131f' }}>
      <Sidebar />
      <div className="flex-1 overflow-hidden flex flex-col">

        {/* Header */}
        <header className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: '#1F1F2A', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-4 min-w-0">
            <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white p-1 rounded-md transition-colors" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="min-w-0">
              <h1 className="text-white font-medium truncate">{loading ? 'Loading...' : note?.title}</h1>
              <p className="text-[11px] text-gray-500 font-mono">{note?.unit_code || 'No Unit'}</p>
            </div>
          </div>
          <button onClick={() => navigate(`/tutor?unit=${note?.unit_code || ''}`)} className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={{ backgroundColor: 'rgba(45,212,191,0.1)', color: '#2dd4bf' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(45,212,191,0.2)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(45,212,191,0.1)'}>
            Ask ElimuPap Tutor
          </button>
        </header>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">Loading document...</div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center text-red-400">{error}</div>
        ) : (
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

            {/* Left side: PDF Viewer or Text Viewer */}
            <div className="flex-1 lg:w-2/3 h-[50vh] lg:h-auto border-b lg:border-b-0 lg:border-r border-[rgba(255,255,255,0.05)] bg-[#11111a] relative overflow-y-auto">
              {note?.file_type === 'pdf' ? (
                pdfUrl ? (
                  <iframe src={`${pdfUrl}#view=FitH`} className="w-full h-full border-none" title="PDF Viewer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                    PDF not available
                  </div>
                )
              ) : (
                <div className="p-8 max-w-[800px] mx-auto text-gray-200">
                  <div className="mb-6 p-4 rounded-xl bg-[rgba(91,87,255,0.1)] border border-[rgba(91,87,255,0.2)] text-[#a5a3ff] text-sm">
                    <p className="font-semibold mb-1">Text Preview Mode</p>
                    <p>This is a {note?.file_type?.toUpperCase()} file. Browsers cannot render these documents natively, so we are displaying the extracted text instead. You can download the original file if needed.</p>
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed text-[15px]" style={{ color: '#d1d5db' }}>
                    {note?.extracted_text || "No text could be extracted from this document."}
                  </div>
                </div>
              )}
            </div>

            {/* Right side: AI Tools */}
            <div className="lg:w-[400px] h-full flex flex-col bg-[#17171F]">

              {/* Tool selector */}
              <div className="p-4 grid grid-cols-2 gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <button onClick={() => handleRunTool('summary', 'Summary')} className="p-3 rounded-xl flex flex-col items-center justify-center gap-2 transition-all border border-transparent"
                  style={{ backgroundColor: activeTool === 'Summary' ? 'rgba(91,87,255,0.15)' : '#1F1F2A', borderColor: activeTool === 'Summary' ? 'rgba(91,87,255,0.5)' : 'rgba(255,255,255,0.03)' }}>
                  <span className="text-xl">📝</span>
                  <span className="text-[11px] font-medium text-white">Summary</span>
                </button>
                <button onClick={() => handleRunTool('flashcards', 'Flashcards')} className="p-3 rounded-xl flex flex-col items-center justify-center gap-2 transition-all border border-transparent"
                  style={{ backgroundColor: activeTool === 'Flashcards' ? 'rgba(91,87,255,0.15)' : '#1F1F2A', borderColor: activeTool === 'Flashcards' ? 'rgba(91,87,255,0.5)' : 'rgba(255,255,255,0.03)' }}>
                  <span className="text-xl">🃏</span>
                  <span className="text-[11px] font-medium text-white">Flashcards</span>
                </button>
                <button onClick={() => handleRunTool('mindmap', 'Mind Map')} className="p-3 rounded-xl flex flex-col items-center justify-center gap-2 transition-all border border-transparent"
                  style={{ backgroundColor: activeTool === 'Mind Map' ? 'rgba(91,87,255,0.15)' : '#1F1F2A', borderColor: activeTool === 'Mind Map' ? 'rgba(91,87,255,0.5)' : 'rgba(255,255,255,0.03)' }}>
                  <span className="text-xl">🧠</span>
                  <span className="text-[11px] font-medium text-white">Mind Map</span>
                </button>
                <button onClick={() => navigate(`/quiz?noteId=${noteId}`)} className="p-3 rounded-xl flex flex-col items-center justify-center gap-2 transition-all border border-transparent hover:bg-[#2b2b36]"
                  style={{ backgroundColor: '#1F1F2A', borderColor: 'rgba(255,255,255,0.03)' }}>
                  <span className="text-xl">🎯</span>
                  <span className="text-[11px] font-medium text-white">Quiz (Qns)</span>
                </button>
              </div>

              {/* Tool content area */}
              <div className="flex-1 overflow-y-auto p-5">
                {!activeTool ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 px-4">
                    <svg className="w-12 h-12 mb-3 text-[#38384f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    <p className="text-sm text-gray-400">Select a tool above to generate study aids for your notes.</p>
                  </div>
                ) : toolLoading ? (
                  <div className="h-full flex flex-col items-center justify-center">
                    <div className="w-8 h-8 rounded-full border-2 border-t-[#5B57FF] border-[#2b2b36] animate-spin mb-4"></div>
                    <p className="text-xs text-gray-400">Generating {activeTool}...</p>
                  </div>
                ) : toolError ? (
                  <p className="text-red-400 text-sm text-center">{toolError}</p>
                ) : toolData && (
                  <div className="animate-fade-in space-y-4">

                    {/* SUMMARY RENDER */}
                    {activeTool === 'Summary' && toolData.summary && (
                      <>
                        <h3 className="text-white font-medium text-lg">{toolData.title}</h3>
                        <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap bg-[#1F1F2A] p-4 rounded-xl border border-[rgba(255,255,255,0.03)]">{toolData.summary}</p>
                        {toolData.key_points && (
                          <div className="mt-4">
                            <h4 className="text-xs font-bold uppercase tracking-widest text-[#a5a3ff] mb-2">Key Points</h4>
                            <ul className="space-y-2">
                              {toolData.key_points.map((pt, i) => (
                                <li key={i} className="flex gap-2 text-sm text-gray-300">
                                  <span className="text-[#5B57FF]">•</span> {pt}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}

                    {/* FLASHCARDS RENDER */}
                    {activeTool === 'Flashcards' && toolData.flashcards && (
                      <div className="space-y-3">
                        <p className="text-xs text-gray-400 mb-2">Tap a card to flip it.</p>
                        {toolData.flashcards.map((card, i) => (
                          <details key={i} className="group bg-[#1F1F2A] rounded-xl border border-[rgba(255,255,255,0.03)] overflow-hidden cursor-pointer">
                            <summary className="p-4 text-sm font-medium text-white flex justify-between items-center outline-none">
                              {card.front}
                              <svg className="w-4 h-4 text-gray-500 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </summary>
                            <div className="px-4 pb-4 pt-1 text-sm text-[#a5a3ff] leading-relaxed border-t border-[rgba(255,255,255,0.03)]">
                              {card.back}
                            </div>
                          </details>
                        ))}
                      </div>
                    )}

                    {/* MIND MAP RENDER */}
                    {activeTool === 'Mind Map' && toolData.root && (
                      <div className="bg-[#1F1F2A] rounded-xl border border-[rgba(255,255,255,0.03)] p-4">
                        <div className="text-center mb-6">
                          <span className="inline-block px-4 py-2 rounded-lg text-sm font-bold bg-[#5B57FF] text-white">
                            {toolData.root}
                          </span>
                        </div>
                        <div className="space-y-4">
                          {toolData.branches?.map((branch, i) => (
                            <div key={i} className="relative pl-4 border-l-2 border-[rgba(91,87,255,0.3)]">
                              <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-[#5B57FF] absolute -left-[5px]"></span>
                                {branch.label}
                              </h4>
                              <ul className="space-y-1 pl-2">
                                {branch.children?.map((child, j) => (
                                  <li key={j} className="text-xs text-gray-400 leading-relaxed flex gap-2">
                                    <span className="text-gray-600">-</span> {child}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
