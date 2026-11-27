import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useTheme } from '../context/ThemeContext';
import { getOfflineFileUrl, FILES_CACHE_NAME } from '../utils/offlineSync';
import { getPendingUploadById, removePendingUpload } from '../utils/offlineUploads';
import { extractTextFromFileClient } from '../utils/offlineExtractor';
import { getCachedResponse, saveCachedResponse } from '../utils/offlineCache';
import {
  detectNonStudyNote,
  generateOfflineSummary,
  generateOfflineFlashcards,
  generateOfflineMindMap,
} from '../utils/offlineAiTools';
import { Brain, Cpu, FileText, Layers, Sparkles, Target } from '../components/Icons';
import api from '../api/axios';

const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '');

// ── Mammoth DOCX renderer ────────────────────────────────────────────────────
function DocxViewer({ fileUrl, fallbackText }) {
  const { isDark } = useTheme();
  const [html, setHtml] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr('');
    async function render() {
      try {
        const mammoth = (await import('mammoth')).default;
        const res = await fetch(fileUrl);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const arrayBuffer = await res.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        if (!cancelled) setHtml(result.value);
      } catch (e) {
        if (!cancelled) setErr(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    render();
    return () => { cancelled = true; };
  }, [fileUrl]);

  if (loading) return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-gray-400">
      <div className="w-8 h-8 rounded-full border-2 border-t-[#5B57FF] border-[#2b2b36] animate-spin" />
      <p className="text-sm">Rendering document…</p>
    </div>
  );
  if (err) {
    if (fallbackText && fallbackText !== '__EXTRACTING__') {
      return (
        <div className="w-full h-full overflow-y-auto">
          <div className={`mx-4 sm:mx-8 mt-6 p-3 rounded-xl text-xs border ${
            isDark ? 'bg-blue-500/10 border-blue-500/25 text-blue-200' : 'bg-blue-50 border-blue-200 text-slate-700'
          }`}>
            Showing extracted document text (original DOCX formatting unavailable on server).
          </div>
          <FallbackText text={fallbackText} />
        </div>
      );
    }
    return <FallbackText text={`Could not render document: ${err}`} />;
  }

  return (
    <div className="w-full h-full overflow-y-auto bg-white">
      <div
        className="max-w-[800px] mx-auto px-12 py-10 text-[15px] leading-relaxed text-gray-800"
        style={{ fontFamily: 'Calibri, Georgia, serif' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

// ── PPTX Slideshow Viewer ─────────────────────────────────────────────────────
function PptxViewer({ text }) {
  const { isDark } = useTheme();
  const [current, setCurrent] = useState(0);

  // Split into slides on blank lines
  const slides = text
    ? text.split(/\n{2,}/).map(s => s.trim()).filter(Boolean)
    : [];

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setCurrent(c => Math.min(c + 1, slides.length - 1));
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   setCurrent(c => Math.max(c - 1, 0));
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [slides.length]);

  if (!slides.length) return <FallbackText text="No readable text found in this presentation." />;

  // Auto-detect title = first non-empty line of the slide
  const parseSlide = (raw) => {
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    let title = lines[0] || '';
    title = title.replace(/^Slide\s+\d+:\s*/i, '');
    const bullets = lines.slice(1);
    return { title, bullets };
  };

  const { title, bullets } = parseSlide(slides[current]);
  const thumbs = slides.map(s => parseSlide(s).title || `Slide`);

  return (
    <div className="w-full h-full flex overflow-hidden" style={{ backgroundColor: isDark ? '#0c0c17' : '#f1f5f9' }}>

      {/* ── Thumbnail strip ── */}
      <div className="hidden lg:flex flex-col w-44 flex-shrink-0 overflow-y-auto p-3 gap-2"
        style={{
          backgroundColor: isDark ? '#111120' : '#ffffff',
          borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0'}`,
        }}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 px-1">
          {slides.length} Slides
        </p>
        {thumbs.map((t, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className="w-full text-left rounded-lg px-3 py-2.5 transition-all"
            style={{
              backgroundColor: i === current
                ? (isDark ? 'rgba(37,99,235,0.2)' : '#eff6ff')
                : 'transparent',
              border: `1px solid ${
                i === current
                  ? (isDark ? 'rgba(37,99,235,0.5)' : '#93c5fd')
                  : (isDark ? 'rgba(255,255,255,0.04)' : '#e2e8f0')
              }`,
            }}
          >
            <p className="text-[10px] text-[#2563EB] font-bold mb-0.5">#{i + 1}</p>
            <p className={`text-[11px] line-clamp-2 leading-tight ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>{t || `Slide ${i + 1}`}</p>
          </button>
        ))}
      </div>

      {/* ── Main slide area ── */}
      <div className="flex-1 flex flex-col">

        {/* Slide canvas */}
        <div className="flex-1 flex items-center justify-center p-3 sm:p-6 lg:p-10 overflow-y-auto">
          <div
            className="w-full max-w-3xl rounded-2xl p-5 sm:p-10 lg:p-14 flex flex-col gap-4 sm:gap-6 shadow-lg my-auto"
            style={{
              border: `1px solid ${isDark ? 'rgba(37,99,235,0.25)' : '#e2e8f0'}`,
              minHeight: '260px',
              background: isDark
                ? 'linear-gradient(135deg, #1a1a2e 0%, #16162a 100%)'
                : '#ffffff',
            }}
          >
            {/* Slide number pill */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full"
                style={{
                  backgroundColor: isDark ? 'rgba(37,99,235,0.2)' : '#eff6ff',
                  color: isDark ? '#93c5fd' : '#1d4ed8',
                }}>
                Slide {current + 1} / {slides.length}
              </span>
              <div className="flex gap-1 max-w-[50%] overflow-x-auto no-scrollbar">
                {slides.map((_, i) => (
                  <div key={i} onClick={() => setCurrent(i)} className="cursor-pointer rounded-full transition-all flex-shrink-0"
                    style={{
                      width: i === current ? '16px' : '5px', height: '5px',
                      backgroundColor: i === current ? '#2563EB' : (isDark ? 'rgba(255,255,255,0.15)' : '#cbd5e1'),
                    }} />
                ))}
              </div>
            </div>

            {/* Title */}
            {title && (
              <h2 className={`text-lg sm:text-2xl lg:text-3xl font-bold leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}
                style={{ fontFamily: 'Inter, sans-serif' }}>
                {title}
              </h2>
            )}

            {/* Separator */}
            {title && bullets.length > 0 && (
              <div className="h-px w-10 sm:w-12 rounded" style={{ backgroundColor: '#2563EB' }} />
            )}

            {/* Bullet points */}
            {bullets.length > 0 ? (
              <ul className="space-y-2.5 sm:space-y-3">
                {bullets.map((b, i) => (
                  <li key={i} className={`flex items-start gap-2.5 sm:gap-3 text-xs sm:text-[15px] leading-relaxed ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#2563EB' }} />
                    {b}
                  </li>
                ))}
              </ul>
            ) : !title ? (
              <p className="text-slate-500 text-xs sm:text-sm italic">No content on this slide.</p>
            ) : null}
          </div>
        </div>

        {/* Navigation bar */}
        <div className="flex items-center justify-between px-6 py-3"
          style={{
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0'}`,
            backgroundColor: isDark ? '#111120' : '#ffffff',
          }}>
          <button
            onClick={() => setCurrent(c => Math.max(c - 1, 0))}
            disabled={current === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-30"
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc',
              color: isDark ? '#d1d5db' : '#334155',
              border: isDark ? 'none' : '1px solid #e2e8f0',
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </button>

          <span className="text-xs text-slate-500">Use ← → arrow keys to navigate</span>

          <button
            onClick={() => setCurrent(c => Math.min(c + 1, slides.length - 1))}
            disabled={current === slides.length - 1}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-30"
            style={{
              backgroundColor: isDark ? 'rgba(37,99,235,0.2)' : '#eff6ff',
              color: isDark ? '#93c5fd' : '#1d4ed8',
              border: isDark ? 'none' : '1px solid #bfdbfe',
            }}
          >
            Next
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

      </div>
    </div>
  );
}

// ── Plain text fallback ───────────────────────────────────────────────────────
function FallbackText({ text }) {
  const { isDark } = useTheme();
  return (
    <div className="p-8 max-w-[800px] mx-auto">
      <p className="whitespace-pre-wrap leading-relaxed text-[15px]" style={{ color: isDark ? '#d1d5db' : '#1e293b' }}>
        {text || 'No text could be extracted from this document.'}
      </p>
    </div>
  );
}

// ── Extracting spinner ────────────────────────────────────────────────────────
function ExtractingSpinner() {
  const { isDark } = useTheme();
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <div className={`w-8 h-8 rounded-full border-2 border-t-[#2563EB] animate-spin ${isDark ? 'border-[#2b2b36]' : 'border-slate-200'}`} />
      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>Extracting text from your document…</p>
      <p className="text-xs text-slate-500">This usually takes just a few seconds.</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function NoteViewerPage() {
  const { isDark } = useTheme();
  const { noteId } = useParams();
  const navigate = useNavigate();
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeTool, setActiveTool] = useState(null);
  const [toolData, setToolData] = useState(null);
  const [toolLoading, setToolLoading] = useState(false);
  const [toolError, setToolError] = useState('');
  const [mobileTab, setMobileTab] = useState('doc'); // 'doc' | 'tools'
  const [showPdfTextFallback, setShowPdfTextFallback] = useState(false);

  useEffect(() => {
    let active = true;
    let localObjectUrl = null;

    if (noteId?.startsWith('offline_upload_')) {
      (async () => {
        const pending = await getPendingUploadById(noteId);
        if (!active) return;
        if (!pending) {
          setError('Offline upload not found (it may have already synced — check Library).');
          setLoading(false);
          return;
        }

        let textContent = pending.extracted_text || pending.live_transcript || '';
        if (!textContent && pending.file && pending.file_type !== 'ocr_image' && pending.file_type !== 'audio_lecture') {
          textContent = await extractTextFromFileClient(pending.file);
        }

        if (!active) return;
        setNote({
          id: pending.id,
          title: pending.title,
          unit_code: pending.unit_code,
          file_type: pending.file_type,
          extracted_text: textContent,
          isOfflinePending: true,
        });

        if (pending.file) {
          localObjectUrl = URL.createObjectURL(pending.file);
          if (pending.file_type === 'pdf') setOfflinePdfBlob(localObjectUrl);
          else if (pending.file_type === 'docx') setOfflineDocxBlob(localObjectUrl);
          else if (pending.file_type === 'audio_lecture') setOfflineAudioBlob(localObjectUrl);
          else if (pending.file_type === 'ocr_image') setOfflineImageUrl(localObjectUrl);
        }
        setLoading(false);
      })();
      return () => {
        active = false;
        if (localObjectUrl) URL.revokeObjectURL(localObjectUrl);
      };
    }

    fetchNote();
    const token = localStorage.getItem('elimupap_token');
    api.post('/progress/activity', { type: 'note_opened', note_id: noteId }, {
      headers: { Authorization: `Bearer ${token}` }
    }).catch(() => {});
    const interval = setInterval(() => {
      api.post('/progress/activity', { type: 'time_spent', note_id: noteId, duration_minutes: 1 }, {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    }, 60000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [noteId]);

  const fetchNote = async () => {
    try {
      const token = localStorage.getItem('elimupap_token');
      const res = await api.get(`/notes/${noteId}`, { headers: { Authorization: `Bearer ${token}` } });
      setNote(res.data);
      const stillWorking =
        res.data?.extracted_text === '__EXTRACTING__' ||
        res.data?.conversion_status === 'pending';
      if (stillWorking) setTimeout(fetchNote, 3000);
    } catch (err) {
      console.error("Fetch note error:", err);
      setError(err?.response?.data?.detail || err?.message || 'Failed to fetch note');
    } finally {
      setLoading(false);
    }
  };

  const buildOfflineToolResult = (toolEndpoint, sourceNote) => {
    const cached = getCachedResponse('post', `/ai/${toolEndpoint}`, { note_id: noteId });
    if (cached) return cached;

    let generated = null;
    if (toolEndpoint === 'summary') generated = generateOfflineSummary(sourceNote);
    else if (toolEndpoint === 'flashcards') generated = generateOfflineFlashcards(sourceNote);
    else if (toolEndpoint === 'mindmap') generated = generateOfflineMindMap(sourceNote);

    if (generated) {
      saveCachedResponse('post', `/ai/${toolEndpoint}`, { note_id: noteId }, generated);
    }
    return generated;
  };

  const handleRunTool = async (toolEndpoint, toolName) => {
    setActiveTool(toolName);
    setMobileTab('tools');
    setToolLoading(true);
    setToolData(null);
    setToolError('');

    const nonStudyReason = detectNonStudyNote(note);
    if (nonStudyReason) {
      setToolError(`Not study-related: ${nonStudyReason}`);
      setToolLoading(false);
      return;
    }

    // Offline-uploaded notes don't exist on the server yet — generate directly offline
    if (note?.isOfflinePending || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      try {
        const offlineRes = buildOfflineToolResult(toolEndpoint, note || { title: 'Study Note' });
        if (offlineRes) {
          setToolData(offlineRes);
          setToolLoading(false);
          return;
        }
      } catch {}
    }

    try {
      const token = localStorage.getItem('elimupap_token');
      const res = await api.post(`/ai/${toolEndpoint}`, { note_id: noteId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setToolData(res.data);
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
      if (!err?.response || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        const offlineRes = buildOfflineToolResult(toolEndpoint, note || { title: 'Study Note' });
        if (offlineRes) {
          setToolData(offlineRes);
          return;
        }
      }
      setToolError(err.response?.data?.detail || `Failed to generate ${toolName}`);
    } finally {
      setToolLoading(false);
    }
  };

  // ── Compute viewer URL + resolve offline cached Blob URLs ──────────────────
  const pdfUrl          = note?.safe_filename          ? `${BASE}/uploads/${note.safe_filename}` : null;
  const convertedPdfUrl = note?.converted_pdf_filename ? `${BASE}/converted/${note.converted_pdf_filename}` : null;
  const fileUrl         = note?.safe_filename          ? `${BASE}/uploads/${note.safe_filename}` : null;

  const isNativePdf    = note?.file_type === 'pdf';
  const isDocx         = ['docx', 'doc'].includes(note?.file_type);
  const isPptx         = ['pptx', 'ppt'].includes(note?.file_type);
  const isAudio        = note?.file_type === 'audio_lecture';
  const rawAudioUrl    = note?.file_url ? (note.file_url.startsWith('http') ? note.file_url : `${BASE}${note.file_url}`) : null;
  const rawPdfViewUrl  = isNativePdf ? pdfUrl : convertedPdfUrl;

  const [offlinePdfBlob, setOfflinePdfBlob]     = useState(null);
  const [offlineDocxBlob, setOfflineDocxBlob]   = useState(null);
  const [offlineAudioBlob, setOfflineAudioBlob] = useState(null);
  const [offlineImageUrl, setOfflineImageUrl]   = useState(null);
  const [remotePdfMissing, setRemotePdfMissing] = useState(false);
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);

  const hasPdfVersion = isNativePdf ? Boolean(pdfUrl || offlinePdfBlob) : Boolean(convertedPdfUrl);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (note?.isOfflinePending) return undefined;
    let active = true;
    const createdUrls = [];

    async function resolveOrCache(remoteUrl, setter, onMissing) {
      if (!remoteUrl) return;
      const blobUrl = await getOfflineFileUrl(remoteUrl);
      if (blobUrl) {
        if (active) {
          createdUrls.push(blobUrl);
          setter(blobUrl);
        } else {
          URL.revokeObjectURL(blobUrl);
        }
        return;
      }
      // If online, quietly cache this document for future offline access
      if (navigator.onLine && typeof caches !== 'undefined') {
        try {
          const res = await fetch(remoteUrl, { mode: 'cors' });
          if (res && res.ok) {
            const cache = await caches.open(FILES_CACHE_NAME);
            await cache.put(remoteUrl, res.clone());
          } else if (res && res.status === 404 && onMissing && active) {
            onMissing();
          }
        } catch {}
      }
    }

    setOfflinePdfBlob(null);
    setOfflineDocxBlob(null);
    setOfflineAudioBlob(null);
    setOfflineImageUrl(null);
    setRemotePdfMissing(false);

    if (rawPdfViewUrl) resolveOrCache(rawPdfViewUrl, setOfflinePdfBlob, () => setRemotePdfMissing(true));
    if (isDocx && fileUrl) resolveOrCache(fileUrl, setOfflineDocxBlob);
    if (isAudio && rawAudioUrl) resolveOrCache(rawAudioUrl, setOfflineAudioBlob);

    return () => {
      active = false;
      createdUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [note?.isOfflinePending, rawPdfViewUrl, isDocx, fileUrl, isAudio, rawAudioUrl]);

  const pdfViewUrl = offlinePdfBlob || rawPdfViewUrl;
  const resolvedFileUrl = offlineDocxBlob || fileUrl;
  const audioUrl = offlineAudioBlob || rawAudioUrl;

  // ── Render viewer pane content ──────────────────────────────────────────────
  function renderViewer() {
    // 1. PDF ready (native, converted, or offline Blob URL)
    if (hasPdfVersion) {
      if ((isOffline || remotePdfMissing) && !offlinePdfBlob) {
        // Gracefully show extracted text if offline or if server restarted and cleared ephemeral disk
        return (
          <div className="w-full h-full overflow-y-auto">
            <div className={`mx-6 mt-6 p-3 rounded-xl text-xs border ${
              isDark ? 'bg-amber-500/10 border-amber-500/25 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              {remotePdfMissing
                ? 'Showing extracted document text (original PDF file is unavailable on the server after restart).'
                : 'Showing saved offline text transcript.'}
            </div>
            <FallbackText text={note?.extracted_text} />
          </div>
        );
      }
      return (
        <div className="w-full h-full flex flex-col">
          {(isOffline || note?.isOfflinePending) && pdfViewUrl && (
            <div className={`px-3 py-2 flex items-center justify-between gap-2 text-[11px] border-b ${
              isDark ? 'bg-[#171723] border-white/10 text-gray-300' : 'bg-white border-slate-200 text-slate-700'
            }`}>
              <a
                href={pdfViewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 rounded-lg bg-[#2563EB] text-white font-semibold hover:bg-[#1D4ED8] transition"
              >
                Open PDF Fullscreen ↗
              </a>
              {note?.extracted_text && (
                <button
                  type="button"
                  onClick={() => setShowPdfTextFallback((v) => !v)}
                  className={`px-2.5 py-1 rounded-lg border font-medium transition ${
                    isDark ? 'border-white/15 hover:bg-white/5 text-blue-300' : 'border-slate-200 hover:bg-slate-50 text-[#2563EB]'
                  }`}
                >
                  {showPdfTextFallback ? 'Show PDF View' : 'Read Extracted Text'}
                </button>
              )}
            </div>
          )}
          {showPdfTextFallback && note?.extracted_text ? (
            <div className="w-full flex-1 overflow-y-auto">
              <FallbackText text={note.extracted_text} />
            </div>
          ) : (
            <iframe
              src={`${pdfViewUrl}#view=FitH`}
              className="w-full flex-1 border-none"
              title="Document Viewer"
            />
          )}
        </div>
      );
    }

    // 2. Converting in progress
    if (!isNativePdf && note?.conversion_status === 'pending') {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-slate-500">
          <div className={`w-10 h-10 rounded-full border-2 border-t-[#2563EB] animate-spin ${isDark ? 'border-[#2b2b36]' : 'border-slate-200'}`} />
          <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>Converting to PDF…</p>
          <p className="text-xs text-slate-500">This only happens once. Sit tight!</p>
        </div>
      );
    }

    // 3. DOCX → mammoth client-side render
    if (isDocx && resolvedFileUrl) {
      if (isOffline && !offlineDocxBlob) {
        return <FallbackText text={note?.extracted_text} />;
      }
      return <DocxViewer fileUrl={resolvedFileUrl} fallbackText={note?.extracted_text} />;
    }

    // 4. PPTX → slide-card layout from extracted text
    if (isPptx) {
      if (note?.extracted_text === '__EXTRACTING__') return <ExtractingSpinner />;
      if (!note?.extracted_text && note?.isOfflinePending) {
        return (
          <FallbackText text="This presentation is saved offline and waiting to upload. Connect to the internet to extract its slides and unlock AI summaries & quizzes." />
        );
      }
      return <PptxViewer text={note?.extracted_text} />;
    }

    // 5. Generic text fallback / Image Preview / Audio Player
    const nonStudyWarning = detectNonStudyNote(note);
    const handleDeleteAccidentalNote = async () => {
      if (!window.confirm(`Delete "${note?.title || 'this recording'}"?`)) return;
      try {
        if (note?.isOfflinePending) {
          await removePendingUpload(note.id);
        } else {
          const token = localStorage.getItem('elimupap_token');
          await api.delete(`/notes/${noteId}`, { headers: { Authorization: `Bearer ${token}` } });
        }
        navigate('/notes');
      } catch (err) {
        alert(err?.response?.data?.detail || 'Failed to delete recording.');
      }
    };

    return (
      <div className="w-full h-full overflow-y-auto">
        <div className={`p-8 max-w-[800px] mx-auto ${isDark ? 'text-gray-200' : 'text-slate-800'}`}>
          {nonStudyWarning && (
            <div className={`mb-6 p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isDark ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}>
              <div className="text-xs leading-relaxed">
                <p className="font-bold uppercase tracking-wider text-[10px] mb-1">Non-Study Content Detected</p>
                <p>{nonStudyWarning}</p>
              </div>
              <button
                type="button"
                onClick={handleDeleteAccidentalNote}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition flex-shrink-0"
              >
                Delete Recording
              </button>
            </div>
          )}
          {note?.file_type === 'ocr_image' && offlineImageUrl && (
            <div className="mb-6 rounded-2xl overflow-hidden border border-slate-700/40 shadow-sm">
              <img src={offlineImageUrl} alt={note.title || 'Uploaded image'} className="w-full max-h-[70vh] object-contain bg-black/20" />
            </div>
          )}
          {isAudio && audioUrl && (
             <div className={`mb-8 rounded-3xl p-8 shadow-sm flex flex-col items-center justify-center border ${
               isDark ? 'bg-[#1F1F2A] border-white/5' : 'bg-white border-slate-200'
             }`}>
               <span className={`font-semibold mb-4 text-xs uppercase tracking-widest flex items-center gap-2 ${
                 isDark ? 'text-rose-400' : 'text-rose-600'
               }`}>
                 <span className="relative flex h-3 w-3">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                 </span>
                 Original Audio Recording
               </span>
               <audio controls src={audioUrl} className="w-full max-w-md rounded-full shadow-md" />
             </div>
          )}
          {note?.extracted_text === '__EXTRACTING__'
            ? <ExtractingSpinner />
            : <FallbackText text={note?.extracted_text} />
          }
        </div>
      </div>
    );
  }

  const cardCls = isDark
    ? 'bg-[#1F1F2A] border border-white/5'
    : 'bg-white border border-slate-200 shadow-sm';
  const headingClr = isDark ? 'text-white' : 'text-slate-900';
  const bodyClr = isDark ? 'text-gray-300' : 'text-slate-700';

  return (
    <div
      className="flex flex-col lg:flex-row min-h-dvh font-sans transition-colors"
      style={{
        backgroundColor: isDark ? '#13131f' : '#f8fafc',
        color: isDark ? '#ffffff' : '#0f172a',
      }}
    >
      <Sidebar hideMobileHeader={true} />
      <div className="flex-1 overflow-hidden flex flex-col min-w-0">

        {/* Header */}
        <header
          className="px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3"
          style={{
            backgroundColor: isDark ? '#1F1F2A' : '#ffffff',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0'}`,
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate(-1)}
              className={`p-2 rounded-xl transition-colors flex-shrink-0 border ${
                isDark
                  ? 'text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border-transparent'
                  : 'text-slate-600 hover:text-slate-900 bg-[#f8fafc] hover:bg-slate-100 border-slate-200'
              }`}
              aria-label="Go back"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="min-w-0">
              <h1 className={`text-sm sm:text-base font-medium truncate ${headingClr}`}>{loading ? 'Loading…' : note?.title}</h1>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-mono truncate">{note?.unit_code || 'General'}</p>
            </div>
          </div>

          {/* Actions badge */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {note?.isOfflinePending && (
              <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${
                isDark ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                Pending Sync
              </span>
            )}
            {note?.file_type && (
              <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${
                isDark ? 'bg-[#2563EB]/20 text-blue-300 border-[#2563EB]/30' : 'bg-blue-50 text-[#1D4ED8] border-blue-200'
              }`}>
                {note.file_type}
              </span>
            )}
            <button
              onClick={() => navigate(`/tutor?unit=${note?.unit_code || ''}`)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                isDark
                  ? 'bg-teal-500/10 text-teal-300 border-teal-500/20 hover:bg-teal-500/20'
                  : 'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100'
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span className="hidden sm:inline">Ask</span> Tutor
            </button>
          </div>
        </header>

        {/* Mobile View Switcher */}
        <div className={`lg:hidden flex border-b p-2 gap-2 ${isDark ? 'border-white/5 bg-[#17171F]' : 'border-slate-200 bg-white'}`}>
          <button
            onClick={() => setMobileTab('doc')}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition ${
              mobileTab === 'doc'
                ? 'bg-[#2563EB] text-white shadow-sm'
                : (isDark ? 'bg-white/5 text-gray-400 hover:text-white' : 'bg-[#f8fafc] text-slate-600 border border-slate-200 hover:text-slate-900')
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Document</span>
          </button>
          <button
            onClick={() => setMobileTab('tools')}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition ${
              mobileTab === 'tools'
                ? 'bg-[#2563EB] text-white shadow-sm'
                : (isDark ? 'bg-white/5 text-gray-400 hover:text-white' : 'bg-[#f8fafc] text-slate-600 border border-slate-200 hover:text-slate-900')
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Study Tools {activeTool ? `(${activeTool})` : ''}</span>
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-slate-500">Loading document…</div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-1 ${isDark ? 'bg-rose-500/10 text-rose-400' : 'bg-rose-50 text-rose-600'}`}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            </div>
            <p className={`font-medium text-sm max-w-md ${headingClr}`}>{error}</p>
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => { setLoading(true); setError(''); fetchNote(); }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#2563EB] text-white hover:bg-[#1D4ED8] transition"
              >
                Retry
              </button>
              <button
                onClick={() => navigate('/notes')}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition border ${
                  isDark ? 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Back to Library
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden pb-20 lg:pb-0">

            {/* Left side: Document Viewer */}
            <div className={`flex-1 lg:w-2/3 h-full border-b lg:border-b-0 lg:border-r relative overflow-hidden ${
              isDark ? 'border-white/5 bg-[#11111a]' : 'border-slate-200 bg-[#f1f5f9]'
            } ${mobileTab === 'doc' ? 'flex' : 'hidden lg:flex'}`}>
              {renderViewer()}
            </div>

            {/* Right side: AI Tools */}
            <div className={`lg:w-[420px] h-full flex flex-col ${
              isDark ? 'bg-[#17171F]' : 'bg-[#f8fafc]'
            } ${mobileTab === 'tools' ? 'flex' : 'hidden lg:flex'}`}>

              {/* Tool selector */}
              <div
                className="p-4 grid grid-cols-2 gap-2"
                style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0'}` }}
              >
                {[
                  { endpoint: 'summary',    name: 'Summary',    icon: <FileText className="w-5 h-5 text-[#2563EB]" /> },
                  { endpoint: 'flashcards', name: 'Flashcards', icon: <Layers className="w-5 h-5 text-emerald-500" /> },
                  { endpoint: 'mindmap',    name: 'Mind Map',   icon: <Brain className="w-5 h-5 text-violet-500" /> },
                ].map(({ endpoint, name, icon }) => (
                  <button
                    key={name}
                    onClick={() => handleRunTool(endpoint, name)}
                    className="p-3 rounded-xl flex flex-col items-center justify-center gap-2 transition-all border"
                    style={{
                      backgroundColor: activeTool === name
                        ? (isDark ? 'rgba(37,99,235,0.18)' : '#eff6ff')
                        : (isDark ? '#1F1F2A' : '#ffffff'),
                      borderColor: activeTool === name
                        ? (isDark ? 'rgba(37,99,235,0.5)' : '#93c5fd')
                        : (isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0'),
                    }}
                  >
                    <span>{icon}</span>
                    <span className={`text-[11px] font-medium ${activeTool === name && !isDark ? 'text-[#1D4ED8]' : headingClr}`}>{name}</span>
                  </button>
                ))}
                <button
                  onClick={() => navigate(`/quiz?noteId=${noteId}`)}
                  className={`p-3 rounded-xl flex flex-col items-center justify-center gap-2 transition-all border ${
                    isDark ? 'hover:bg-[#2b2b36]' : 'hover:bg-slate-50'
                  }`}
                  style={{
                    backgroundColor: isDark ? '#1F1F2A' : '#ffffff',
                    borderColor: isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0',
                  }}
                >
                  <Target className="w-5 h-5 text-amber-500" />
                  <span className={`text-[11px] font-medium ${headingClr}`}>Quiz</span>
                </button>
              </div>

              {/* Tool content area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 pb-24 lg:pb-6">
                {!activeTool ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 px-4">
                    <svg className={`w-12 h-12 mb-3 ${isDark ? 'text-[#38384f]' : 'text-slate-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>Select a tool above to generate study aids for your notes.</p>
                  </div>
                ) : toolLoading ? (
                  <div className="h-full flex flex-col items-center justify-center">
                    <div className={`w-8 h-8 rounded-full border-2 border-t-[#2563EB] animate-spin mb-4 ${isDark ? 'border-[#2b2b36]' : 'border-slate-200'}`} />
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>Generating {activeTool}…</p>
                  </div>
                ) : toolError ? (
                  <p className={`text-sm text-center ${isDark ? 'text-red-400' : 'text-red-600'}`}>{toolError}</p>
                ) : toolData && (
                  <div className="animate-fade-in space-y-4">
                    {toolData.offline_generated && (
                      <div className={`px-3 py-2 rounded-xl border text-[11px] font-medium flex items-center gap-2 ${
                        isDark ? 'bg-amber-500/10 border-amber-500/25 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
                      }`}>
                        <span>⚡</span>
                        <span>Generated offline on this device from your document text.</span>
                      </div>
                    )}

                    {/* SUMMARY */}
                    {activeTool === 'Summary' && toolData.summary && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className={`font-bold text-base sm:text-lg leading-tight ${headingClr}`}>{toolData.title}</h3>
                          <button
                            onClick={() => navigate(`/summary/${noteId}`)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition whitespace-nowrap flex-shrink-0 border ${
                              isDark
                                ? 'text-blue-300 bg-[#2563EB]/15 hover:bg-[#2563EB]/30 border-[#2563EB]/30'
                                : 'text-[#1D4ED8] bg-blue-50 hover:bg-blue-100 border-blue-200'
                            }`}
                          >
                            Full View ↗
                          </button>
                        </div>

                        {toolData.deck_overview && (
                          <div className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                            isDark
                              ? 'bg-blue-950/30 border-blue-500/30 text-blue-100'
                              : 'bg-blue-50 border-blue-200 text-slate-800'
                          }`}>
                            <span className={`font-bold ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>Deck Brief: </span>
                            {toolData.deck_overview}
                          </div>
                        )}

                        <div className={`p-4 rounded-xl ${cardCls}`}>
                          <h4 className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Overview</h4>
                          <p className={`text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${bodyClr}`}>{toolData.summary}</p>
                        </div>

                        {toolData.sections && toolData.sections.length > 0 && (
                          <div className="space-y-2.5">
                            <h4 className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-blue-300' : 'text-[#2563EB]'}`}>Slide Sections</h4>
                            {toolData.sections.map((sec, i) => (
                              <div key={i} className={`p-3.5 rounded-xl space-y-2 ${cardCls}`}>
                                <div className="flex justify-between items-center text-xs">
                                  <span className={`font-semibold ${headingClr}`}>{sec.section_title}</span>
                                  {sec.slide_range && <span className={`text-[10px] font-mono ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{sec.slide_range}</span>}
                                </div>
                                <p className={`text-xs leading-relaxed ${bodyClr}`}>{sec.summary}</p>
                                {sec.key_takeaways && (
                                  <ul className={`space-y-1 pt-1 border-t ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
                                    {sec.key_takeaways.map((t, idx) => (
                                      <li key={idx} className={`text-[11px] flex items-start gap-2 ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                                        <span className="text-[#2563EB] mt-0.5">•</span>
                                        <span>{t}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {toolData.exam_highlights && toolData.exam_highlights.length > 0 && (
                          <div className={`p-3.5 rounded-xl border ${
                            isDark ? 'bg-amber-950/20 border-amber-500/25' : 'bg-amber-50 border-amber-200'
                          }`}>
                            <h4 className={`text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5 ${
                              isDark ? 'text-amber-300' : 'text-amber-800'
                            }`}>
                              <span>⚡</span> Exam Focus
                            </h4>
                            <ul className="space-y-1.5">
                              {toolData.exam_highlights.map((h, i) => (
                                <li key={i} className={`text-xs leading-relaxed flex items-start gap-1.5 ${
                                  isDark ? 'text-amber-100' : 'text-slate-800'
                                }`}>
                                  <span className={isDark ? 'text-amber-400' : 'text-amber-700'}>▸</span>
                                  <span>{h}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {toolData.key_points && (
                          <div className={`p-4 rounded-xl ${cardCls}`}>
                            <h4 className={`text-xs font-bold uppercase tracking-widest mb-2.5 ${isDark ? 'text-blue-300' : 'text-[#2563EB]'}`}>Key Points</h4>
                            <ul className="space-y-2">
                              {toolData.key_points.map((pt, i) => (
                                <li key={i} className={`flex gap-2 text-xs leading-relaxed ${bodyClr}`}>
                                  <span className="text-[#2563EB]">•</span>
                                  <span>{pt}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* FLASHCARDS */}
                    {activeTool === 'Flashcards' && toolData.flashcards && (
                      <div className="space-y-3">
                        <p className={`text-xs mb-2 ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>Tap a card to flip it.</p>
                        {toolData.flashcards.map((card, i) => (
                          <details key={i} className={`group rounded-xl overflow-hidden cursor-pointer ${cardCls}`}>
                            <summary className={`p-4 text-sm font-medium flex justify-between items-center outline-none ${headingClr}`}>
                              {card.front}
                              <svg className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </summary>
                            <div className={`px-4 pb-4 pt-2 text-sm leading-relaxed border-t ${
                              isDark ? 'text-blue-300 border-white/5' : 'text-[#1D4ED8] bg-[#f8fafc] border-slate-200'
                            }`}>
                              {card.back}
                            </div>
                          </details>
                        ))}
                      </div>
                    )}

                    {/* MIND MAP */}
                    {activeTool === 'Mind Map' && toolData.root && (
                      <div className={`rounded-xl p-4 ${cardCls}`}>
                        <div className="text-center mb-6">
                          <span className="inline-block px-4 py-2 rounded-lg text-sm font-bold bg-[#2563EB] text-white">{toolData.root}</span>
                        </div>
                        <div className="space-y-4">
                          {toolData.branches?.map((branch, i) => (
                            <div key={i} className={`relative pl-4 border-l-2 ${isDark ? 'border-[#2563EB]/40' : 'border-blue-300'}`}>
                              <h4 className={`text-sm font-medium mb-2 flex items-center gap-2 ${headingClr}`}>
                                <span className="w-2 h-2 rounded-full bg-[#2563EB] absolute -left-[5px]" />
                                {branch.label}
                              </h4>
                              <ul className="space-y-1 pl-2">
                                {branch.children?.map((child, j) => (
                                  <li key={j} className={`text-xs leading-relaxed flex gap-2 ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                                    <span className="text-slate-400">-</span> {child}
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
