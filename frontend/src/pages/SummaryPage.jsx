import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useTheme } from '../context/ThemeContext';
import { BookOpen, FileText, HelpCircle, Layers, Lightbulb, Target, Zap } from '../components/Icons';
import api from '../api/axios';
import { getPendingUploadById } from '../utils/offlineUploads';
import { extractTextFromFileClient } from '../utils/offlineExtractor';
import { getCachedResponse, saveCachedResponse } from '../utils/offlineCache';
import { detectNonStudyNote, generateOfflineSummary } from '../utils/offlineAiTools';

export default function SummaryPage() {
  const { isDark } = useTheme();
  const { noteId } = useParams();
  const navigate = useNavigate();
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('sections'); // 'sections', 'overview', 'exam', 'definitions'
  const [copied, setCopied] = useState(false);

  const buildOfflineSummaryFallback = async () => {
    const cachedSummary = getCachedResponse('post', '/ai/summary', { note_id: noteId });
    if (cachedSummary) return cachedSummary;

    let noteObj = null;
    if (noteId?.startsWith('offline_upload_')) {
      const pending = await getPendingUploadById(noteId);
      if (pending) {
        let text = pending.extracted_text || pending.live_transcript || '';
        if (!text && pending.file) {
          text = await extractTextFromFileClient(pending.file);
        }
        noteObj = { ...pending, extracted_text: text };
      }
    } else {
      noteObj = getCachedResponse('get', `/notes/${noteId}`, null);
    }

    if (!noteObj) {
      noteObj = { id: noteId, title: 'Study Note', extracted_text: '' };
    }
    const nonStudyReason = detectNonStudyNote(noteObj);
    if (nonStudyReason) {
      return { __nonStudyError: `Not study-related: ${nonStudyReason}` };
    }
    const generated = generateOfflineSummary(noteObj);
    saveCachedResponse('post', '/ai/summary', { note_id: noteId }, generated);
    return generated;
  };

  const fetchSummary = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);

    if (noteId?.startsWith('offline_upload_') || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      const offlineSummary = await buildOfflineSummaryFallback();
      if (offlineSummary?.__nonStudyError) {
        setError(offlineSummary.__nonStudyError);
        setLoading(false);
        return;
      }
      if (offlineSummary) {
        setSummaryData(offlineSummary);
        setLoading(false);
        return;
      }
    }

    try {
      const response = await api.post('/ai/summary', { note_id: noteId, force_refresh: forceRefresh });
      setSummaryData(response.data);
      // Track reading progress
      api.post('/progress/view', { note_id: noteId }).catch(() => {});
    } catch (err) {
      if (!err?.response || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        const offlineSummary = await buildOfflineSummaryFallback();
        if (offlineSummary?.__nonStudyError) {
          setError(offlineSummary.__nonStudyError);
          setLoading(false);
          return;
        }
        if (offlineSummary) {
          setSummaryData(offlineSummary);
          setLoading(false);
          return;
        }
      }
      console.error("Failed to fetch summary:", err);
      setError(err?.response?.data?.detail || "Failed to generate summary. The document might not contain readable text.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary(false);
  }, [noteId]);

  const handleCopySummary = () => {
    if (!summaryData) return;
    const textToCopy = `
# ${summaryData.title}
${summaryData.deck_overview || summaryData.summary}

## Key Takeaways:
${summaryData.key_points?.map(p => `- ${p}`).join('\n')}

${summaryData.sections?.map(s => `### ${s.section_title} (${s.slide_range || ''})\n${s.summary}\n${s.key_takeaways?.map(t => `* ${t}`).join('\n')}\n`).join('\n')}

## Definitions:
${summaryData.definitions?.map(d => `- **${d.term}**: ${d.definition}`).join('\n')}
    `.trim();

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const cardCls = isDark
    ? 'bg-[#1F1F2A] border border-white/5 shadow-sm'
    : 'bg-white border border-slate-200 shadow-sm';
  const toolBtnCls = isDark
    ? 'text-gray-300 bg-white/5 hover:bg-white/10 border border-white/5'
    : 'text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-sm';
  const headingClr = isDark ? 'text-white' : 'text-slate-900';
  const bodyClr = isDark ? 'text-gray-300' : 'text-slate-700';
  const mutedClr = isDark ? 'text-gray-400' : 'text-slate-500';

  return (
    <div
      className="flex flex-col lg:flex-row min-h-dvh font-sans transition-colors"
      style={{
        backgroundColor: isDark ? '#13131f' : '#f8fafc',
        color: isDark ? '#ffffff' : '#0f172a',
      }}
    >
      <Sidebar />
      <div className="flex-1 overflow-y-auto pb-28 lg:pb-12 relative min-w-0">
        <main className="max-w-[1000px] mx-auto px-4 sm:px-8 py-6 sm:py-10">

          {/* ── Top Bar / Navigation ── */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6 sm:mb-8">
            <button
              onClick={() => navigate(-1)}
              className={`inline-flex items-center gap-2 text-xs sm:text-sm font-medium transition-colors px-3 py-2 rounded-xl border ${
                isDark
                  ? 'text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border-white/5'
                  : 'text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border-slate-200 shadow-sm'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Library</span>
            </button>

            {summaryData && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => fetchSummary(true)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${toolBtnCls}`}
                  title="Regenerate fresh summary"
                >
                  <span>↻</span>
                  <span>Regenerate</span>
                </button>

                <button
                  onClick={handleCopySummary}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${toolBtnCls}`}
                  title="Copy full summary markdown"
                >
                  <svg className="w-3.5 h-3.5 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>

                <button
                  onClick={handlePrint}
                  className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${toolBtnCls}`}
                >
                  <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  <span>Export</span>
                </button>

                <button
                  onClick={() => navigate(`/quiz?noteId=${noteId}`)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition shadow-sm"
                >
                  <span>Test Knowledge</span>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* ── Loading State ── */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-center px-4">
              <div className="relative w-16 h-16 mb-6">
                <div className={`absolute inset-0 rounded-full border-4 ${isDark ? 'border-white/5' : 'border-slate-200'}`}></div>
                <div className="absolute inset-0 rounded-full border-4 border-[#2563EB] border-t-transparent animate-spin"></div>
                <div className={`absolute inset-2 rounded-full flex items-center justify-center ${isDark ? 'bg-[#2563EB]/15' : 'bg-blue-50'}`}>
                  <BookOpen className="w-6 h-6 text-[#2563EB]" />
                </div>
              </div>
              <h2 className={`text-lg font-semibold mb-2 ${headingClr}`}>Synthesizing Presentation &amp; Notes</h2>
              <p className={`text-sm max-w-md ${mutedClr}`}>
                Analyzing slide transitions, identifying core concepts, and organizing high-yield takeaways for you...
              </p>
            </div>
          ) : error ? (
            <div className={`p-6 sm:p-8 rounded-2xl border flex flex-col items-center text-center gap-3 ${
              isDark ? 'bg-red-950/30 border-red-500/30 text-red-300' : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <span className="text-3xl">⚠️</span>
              <p className="font-medium text-base">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className={`mt-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
                  isDark ? 'bg-red-500/20 hover:bg-red-500/30 text-white' : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                Retry Extraction
              </button>
            </div>
          ) : summaryData ? (
            <div className="space-y-6 sm:space-y-8 animate-fade-in">

              {/* ── Presentation Deck Header Card ── */}
              <div
                className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 border ${
                  isDark ? 'border-white/10' : 'border-slate-200 shadow-sm'
                }`}
                style={{
                  background: isDark
                    ? 'linear-gradient(135deg, rgba(31,31,42,0.95) 0%, rgba(20,20,30,0.95) 100%)'
                    : '#ffffff',
                  boxShadow: isDark ? '0 20px 40px -15px rgba(0,0,0,0.5)' : undefined,
                }}
              >
                {/* Glow accent (dark mode only) */}
                {isDark && (
                  <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-[#2563EB]/20 blur-3xl pointer-events-none" />
                )}

                <div className="relative z-10 flex flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                      isDark
                        ? 'bg-[#2563EB]/20 text-blue-300 border-[#2563EB]/30'
                        : 'bg-blue-50 text-[#1D4ED8] border-blue-200'
                    }`}>
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{summaryData.doc_type || 'Slide Presentation Summary'}</span>
                    </span>
                    {summaryData.sections && (
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-mono border ${
                        isDark ? 'text-gray-300 bg-white/5 border-white/10' : 'text-slate-700 bg-[#f8fafc] border-slate-200'
                      }`}>
                        {summaryData.sections.length} Core Modules
                      </span>
                    )}
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-mono border ${
                      isDark
                        ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
                        : 'text-emerald-800 bg-emerald-50 border-emerald-200'
                    }`}>
                      High Yield Review
                    </span>
                  </div>

                  <h1 className={`text-2xl sm:text-4xl font-display font-bold tracking-tight leading-tight ${headingClr}`}>
                    {summaryData.title}
                  </h1>

                  {summaryData.deck_overview && (
                    <p className={`text-sm sm:text-base leading-relaxed font-normal p-4 rounded-2xl border ${
                      isDark
                        ? 'text-gray-200 bg-black/20 border-white/5'
                        : 'text-slate-700 bg-[#f8fafc] border-slate-200'
                    }`}>
                      {summaryData.deck_overview}
                    </p>
                  )}
                </div>
              </div>

              {/* ── Key Highlights Pills ── */}
              {summaryData.key_points && summaryData.key_points.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {summaryData.key_points.map((pt, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-3 p-4 rounded-2xl transition group ${cardCls} ${
                        isDark ? 'hover:border-[#2563EB]/40' : 'hover:border-blue-300'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-lg font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5 transition ${
                        isDark
                          ? 'bg-[#2563EB]/20 text-blue-300 group-hover:bg-[#2563EB] group-hover:text-white'
                          : 'bg-blue-50 text-[#2563EB] border border-blue-200 group-hover:bg-[#2563EB] group-hover:text-white'
                      }`}>
                        {i + 1}
                      </div>
                      <p className={`text-xs sm:text-sm leading-relaxed ${bodyClr}`}>{pt}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Modern Navigation Tabs ── */}
              <div className={`flex border-b gap-2 sm:gap-6 overflow-x-auto no-scrollbar ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                {[
                  { id: 'sections', label: 'Slide Modules & Walkthrough', icon: <Layers className="w-4 h-4" />, count: summaryData.sections?.length },
                  { id: 'overview', label: 'Detailed Summary', icon: <FileText className="w-4 h-4" /> },
                  { id: 'exam', label: 'Exam Hotspots', icon: <Target className="w-4 h-4" />, count: summaryData.exam_highlights?.length },
                  { id: 'definitions', label: 'Glossary & Terms', icon: <Lightbulb className="w-4 h-4" />, count: summaryData.definitions?.length },
                  { id: 'quiz', label: 'Self-Check Quiz', icon: <HelpCircle className="w-4 h-4" />, count: summaryData.quick_quiz?.length },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 pb-3.5 pt-1 text-xs sm:text-sm font-semibold tracking-wide border-b-2 transition whitespace-nowrap px-1 ${
                      activeTab === tab.id
                        ? (isDark ? 'text-white border-[#2563EB]' : 'text-[#2563EB] border-[#2563EB]')
                        : (isDark ? 'text-gray-400 border-transparent hover:text-gray-200' : 'text-slate-600 border-transparent hover:text-slate-900')
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                    {tab.count !== undefined && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                        activeTab === tab.id
                          ? 'bg-[#2563EB] text-white'
                          : (isDark ? 'bg-white/10 text-gray-300' : 'bg-slate-200 text-slate-700')
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* ── TAB 1: Presentation Modules / Sections ── */}
              {activeTab === 'sections' && (
                <div className="space-y-4">
                  {summaryData.sections && summaryData.sections.length > 0 ? (
                    summaryData.sections.map((sec, idx) => (
                      <div
                        key={idx}
                        className={`rounded-2xl p-5 sm:p-7 transition-all ${cardCls} ${
                          isDark ? 'hover:border-white/15' : 'hover:border-slate-300'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2.5">
                            <span className={`w-7 h-7 rounded-xl font-bold text-xs flex items-center justify-center border ${
                              isDark
                                ? 'bg-[#2563EB]/20 text-blue-300 border-[#2563EB]/30'
                                : 'bg-blue-50 text-[#1D4ED8] border-blue-200'
                            }`}>
                              {idx + 1}
                            </span>
                            <h3 className={`text-base sm:text-lg font-bold tracking-tight ${headingClr}`}>
                              {sec.section_title}
                            </h3>
                          </div>
                          {sec.slide_range && (
                            <span className={`text-[11px] font-mono uppercase px-2.5 py-1 rounded-full border ${
                              isDark
                                ? 'bg-white/5 text-gray-300 border-white/10'
                                : 'bg-[#f8fafc] text-slate-600 border-slate-200'
                            }`}>
                              {sec.slide_range}
                            </span>
                          )}
                        </div>

                        {sec.summary && (
                          <p className={`text-xs sm:text-sm leading-relaxed mb-4 ${bodyClr}`}>
                            {sec.summary}
                          </p>
                        )}

                        {sec.key_takeaways && sec.key_takeaways.length > 0 && (
                          <div className="mb-4 space-y-2">
                            <p className={`text-[11px] uppercase tracking-wider font-bold ${mutedClr}`}>Core Takeaways</p>
                            <ul className="space-y-2">
                              {sec.key_takeaways.map((item, tIdx) => (
                                <li key={tIdx} className={`flex items-start gap-2.5 text-xs sm:text-sm ${bodyClr}`}>
                                  <span className="text-[#2563EB] mt-1 flex-shrink-0">▸</span>
                                  <span className="leading-relaxed">{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {sec.highlight && (
                          <div className={`mt-3 p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
                            isDark
                              ? 'bg-blue-950/35 border-blue-500/30 text-blue-100'
                              : 'bg-blue-50 border-blue-200 text-slate-800'
                          }`}>
                            <span className="text-base">📌</span>
                            <span className="leading-relaxed">
                              <strong className={isDark ? 'text-white' : 'text-[#1E3A8A]'}>Exam Insight:</strong> {sec.highlight}
                            </span>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    /* Fallback when older summary lacks sections */
                    <div className={`p-6 rounded-2xl ${cardCls}`}>
                      <p className={`text-sm leading-relaxed whitespace-pre-wrap ${bodyClr}`}>
                        {summaryData.summary}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 2: Detailed Overview ── */}
              {activeTab === 'overview' && (
                <div className={`rounded-2xl p-6 sm:p-8 space-y-6 ${cardCls}`}>
                  <div>
                    <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 ${isDark ? 'text-blue-400' : 'text-[#2563EB]'}`}>
                      Comprehensive Overview
                    </h3>
                    <p className={`text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-sans ${isDark ? 'text-gray-200' : 'text-slate-800'}`}>
                      {summaryData.summary}
                    </p>
                  </div>

                  {summaryData.quick_quiz && summaryData.quick_quiz.length > 0 && (
                    <div className={`p-5 rounded-2xl border ${
                      isDark ? 'bg-[#11111a] border-white/5' : 'bg-[#f8fafc] border-slate-200'
                    }`}>
                      <h4 className={`text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2 ${
                        isDark ? 'text-blue-300' : 'text-[#1D4ED8]'
                      }`}>
                        <span>❓</span> Quick Self-Test Prompt
                      </h4>
                      <ul className="space-y-2">
                        {summaryData.quick_quiz.map((q, i) => (
                          <li key={i} className={`text-xs sm:text-sm flex items-start gap-2 ${bodyClr}`}>
                            <span className="text-[#2563EB]">•</span>
                            <span>{q}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 3: Exam Hotspots ── */}
              {activeTab === 'exam' && (
                <div className="space-y-4">
                  {summaryData.exam_highlights && summaryData.exam_highlights.length > 0 ? (
                    summaryData.exam_highlights.map((item, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start gap-4 p-5 rounded-2xl border ${
                          isDark
                            ? 'bg-amber-950/20 border-amber-500/25 text-amber-100'
                            : 'bg-amber-50 border-amber-200 text-slate-900 shadow-sm'
                        }`}
                      >
                        <span className={`w-8 h-8 rounded-xl font-bold text-sm flex items-center justify-center flex-shrink-0 border ${
                          isDark
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : 'bg-amber-100 text-amber-800 border-amber-200'
                        }`}>
                          <Zap className="w-4 h-4" />
                        </span>
                        <div className="space-y-1">
                          <p className={`text-xs font-bold uppercase tracking-wider ${
                            isDark ? 'text-amber-300' : 'text-amber-800'
                          }`}>
                            High-Probability Concept
                          </p>
                          <p className={`text-xs sm:text-sm leading-relaxed ${
                            isDark ? 'text-gray-200' : 'text-slate-800'
                          }`}>
                            {item}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={`p-8 rounded-2xl text-center ${cardCls} ${mutedClr}`}>
                      Review the key points and definitions for this note's exam preparation.
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 4: Definitions & Glossary ── */}
              {activeTab === 'definitions' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {summaryData.definitions && summaryData.definitions.length > 0 ? (
                    summaryData.definitions.map((def, idx) => (
                      <div
                        key={idx}
                        className={`p-5 rounded-2xl transition flex flex-col justify-between gap-2 ${cardCls} ${
                          isDark ? 'hover:border-[#2563EB]/40' : 'hover:border-blue-300'
                        }`}
                      >
                        <div>
                          <span className={`text-[10px] font-mono font-bold uppercase tracking-widest ${
                            isDark ? 'text-blue-400' : 'text-[#2563EB]'
                          }`}>
                            Term
                          </span>
                          <h4 className={`text-sm sm:text-base font-bold mt-0.5 ${headingClr}`}>{def.term}</h4>
                        </div>
                        <p className={`text-xs sm:text-sm leading-relaxed mt-2 pt-2 border-t ${bodyClr} ${
                          isDark ? 'border-white/5' : 'border-slate-200'
                        }`}>
                          {def.definition}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className={`col-span-2 p-8 rounded-2xl text-center ${cardCls} ${mutedClr}`}>
                      No explicit terms were identified in this document.
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 5: Interactive Self-Check Quiz ── */}
              {activeTab === 'quiz' && (
                <div className="space-y-4">
                  <div className={`p-4 sm:p-5 rounded-2xl border flex items-center justify-between gap-4 ${
                    isDark
                      ? 'bg-[#2563EB]/10 border-[#2563EB]/30'
                      : 'bg-blue-50 border-blue-200'
                  }`}>
                    <div>
                      <h4 className={`text-sm sm:text-base font-bold ${headingClr}`}>Slide Revision Check</h4>
                      <p className={`text-xs mt-0.5 ${isDark ? 'text-blue-200' : 'text-slate-700'}`}>
                        Test your recall of key ideas presented across the slides.
                      </p>
                    </div>
                    <button
                      onClick={() => navigate(`/quiz?noteId=${noteId}`)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition shadow-sm flex-shrink-0"
                    >
                      Start Full Quiz →
                    </button>
                  </div>

                  {summaryData.quick_quiz && summaryData.quick_quiz.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3.5">
                      {summaryData.quick_quiz.map((q, idx) => (
                        <div
                          key={idx}
                          className={`p-5 rounded-2xl transition flex items-start gap-3.5 ${cardCls} ${
                            isDark ? 'hover:border-[#2563EB]/40' : 'hover:border-blue-300'
                          }`}
                        >
                          <span className={`w-7 h-7 rounded-xl font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5 border ${
                            isDark
                              ? 'bg-[#2563EB]/20 text-blue-300 border-[#2563EB]/30'
                              : 'bg-blue-50 text-[#1D4ED8] border-blue-200'
                          }`}>
                            Q{idx + 1}
                          </span>
                          <div className="flex-1 space-y-2">
                            <p className={`text-xs sm:text-sm font-medium leading-relaxed ${headingClr}`}>{q}</p>
                            <div className="flex items-center gap-3 pt-1">
                              <span className={`text-[11px] font-mono ${isDark ? 'text-blue-400' : 'text-[#2563EB]'}`}>
                                High-Yield Recall Question
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={`p-8 rounded-2xl text-center ${cardCls} ${mutedClr}`}>
                      No self-check questions generated for this note yet. Click 'Start Full Quiz' to test your knowledge!
                    </div>
                  )}
                </div>
              )}

              {/* ── Bottom Call-to-Action ── */}
              <div className={`rounded-2xl p-6 sm:p-8 border flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left ${
                isDark
                  ? 'bg-[#1F1F2A] border-[#2563EB]/30'
                  : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div>
                  <h3 className={`text-base sm:text-lg font-bold ${headingClr}`}>Ready to lock in what you just learned?</h3>
                  <p className={`text-xs sm:text-sm mt-1 ${mutedClr}`}>
                    Generate dynamic quiz questions tailored specifically to this presentation.
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/quiz?noteId=${noteId}`)}
                  className="w-full sm:w-auto px-6 py-3 rounded-full text-xs sm:text-sm font-bold text-white transition shadow-sm whitespace-nowrap bg-[#2563EB] hover:bg-[#1D4ED8]"
                >
                  Generate Quiz Now →
                </button>
              </div>

            </div>
          ) : null}

        </main>
      </div>
    </div>
  );
}
