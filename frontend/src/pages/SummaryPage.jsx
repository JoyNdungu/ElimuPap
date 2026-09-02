import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import api from '../api/axios';

export default function SummaryPage() {
  const { noteId } = useParams();
  const navigate = useNavigate();
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await api.post('/ai/summary', { note_id: noteId });
        setSummaryData(response.data);
        // Track that the user read this note (for reading progress)
        api.post('/progress/view', { note_id: noteId }).catch(() => {});
      } catch (err) {
        console.error("Failed to fetch summary:", err);
        setError("Failed to generate summary. The note might not contain extractable text.");
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [noteId]);

  return (
    <div className="flex min-h-dvh font-sans" style={{ backgroundColor: '#17171F' }}>
      <Sidebar />
      <div className="flex-1 overflow-y-auto pb-24 lg:pb-10 relative">
        <main className="max-w-[900px] mx-auto px-6 sm:px-10 py-10">
          <header className="mb-10 flex items-center justify-between">
            <div>
              <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white mb-4 flex items-center gap-2 text-sm transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back to Notes
              </button>
              <h1 className="font-display text-[2.5rem] text-white leading-none mb-3 tracking-tight">
                AI Summary
              </h1>
            </div>
          </header>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 rounded-full border-t-2 border-[#5B57FF] animate-spin mb-4"></div>
              <p className="text-gray-400 text-sm">Generating your AI summary... this might take a few seconds.</p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-xl bg-red-900/20 border border-red-500/30 text-red-400">
              {error}
            </div>
          ) : summaryData ? (
            <div className="space-y-8 animate-fade-in">
              <div className="p-8 rounded-2xl bg-[#1F1F2A] border border-white/5">
                <h2 className="text-2xl text-white font-display mb-4">{summaryData.title}</h2>
                <p className="text-gray-300 leading-relaxed text-sm whitespace-pre-wrap">{summaryData.summary}</p>
              </div>

              <div className="p-8 rounded-2xl bg-[#1a1a2e] border border-indigo-500/20">
                <h3 className="text-lg font-bold text-indigo-300 uppercase tracking-wider mb-4 text-[12px]">Key Points</h3>
                <ul className="space-y-3">
                  {summaryData.key_points?.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 flex-shrink-0"></div>
                      <p className="text-gray-300 text-sm leading-relaxed">{point}</p>
                    </li>
                  ))}
                </ul>
              </div>

              {summaryData.definitions && summaryData.definitions.length > 0 && (
                <div className="p-8 rounded-2xl bg-[#1F1F2A] border border-white/5">
                  <h3 className="text-lg font-bold text-gray-400 uppercase tracking-wider mb-6 text-[12px]">Important Definitions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {summaryData.definitions.map((def, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-black/20 border border-white/5">
                        <h4 className="text-white font-medium mb-2">{def.term}</h4>
                        <p className="text-gray-400 text-xs leading-relaxed">{def.definition}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex justify-center pt-4">
                <button 
                  onClick={() => navigate(`/quiz?noteId=${noteId}`)}
                  className="px-6 py-3 rounded-full text-white text-sm font-medium transition-colors"
                  style={{ backgroundColor: '#5B57FF' }}>
                  Take a Quiz on this Note
                </button>
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
