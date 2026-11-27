import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useTheme } from '../context/ThemeContext';
import api from '../api/axios';
import { enqueueOfflineUpload } from '../utils/offlineUploads';
import { extractTextFromFileClient } from '../utils/offlineExtractor';

export default function UploadNotesPage() {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);

  const [files, setFiles] = useState([]);   // array of File objects
  const [units, setUnits] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState(searchParams.get('unit') || '');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState([]); // per-file results
  const [error, setError] = useState('');

  const VALID_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/markdown',
    'image/jpeg',
    'image/png',
    'image/webp'
  ];

  useEffect(() => {
    const fetchUnits = async () => {
      try {
        const token = localStorage.getItem('elimupap_token');
        const res = await api.get('/units', { headers: { Authorization: `Bearer ${token}` } });
        setUnits(res.data);
      } catch (err) {
        console.error('Failed to fetch units', err);
      }
    };
    fetchUnits();
  }, []);

  const isValidFile = (f) =>
    VALID_TYPES.includes(f.type) || /\.(pdf|docx|pptx|txt|md|png|jpg|jpeg|webp)$/i.test(f.name);

  const addFiles = (incoming) => {
    const valid = Array.from(incoming).filter(isValidFile);
    const invalid = Array.from(incoming).filter(f => !isValidFile(f));

    const hasLegacy = invalid.some(f => /\.(doc|ppt)$/i.test(f.name));

    if (hasLegacy) {
      setError(`Legacy formats (.doc, .ppt) are too old to be read by our AI. Please open them and "Save As" .docx, .pptx, or .pdf!`);
    } else if (invalid.length) {
      setError(`${invalid.length} file(s) skipped — only PDF, DOCX, PPTX, TXT, or Image (JPEG/PNG) files are allowed.`);
    } else {
      setError('');
    }
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...valid.filter(f => !names.has(f.name))];
    });
    setUploadResults([]);
  };

  const removeFile = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setUploadResults([]);
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };
  const handleFileInput = (e) => addFiles(e.target.files);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!files.length) { setError('Please select at least one file.'); return; }
    setIsUploading(true);
    setError('');

    const token = localStorage.getItem('elimupap_token');
    const isNavigatorOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    const queueFileOffline = async (file, endpoint, isImage) => {
      const extMatch = file.name.match(/\.([^/.]+)$/);
      const ext = isImage ? 'ocr_image' : (extMatch ? extMatch[1].toLowerCase() : 'doc');
      const extractedText = isImage ? '' : await extractTextFromFileClient(file);
      await enqueueOfflineUpload({
        title: file.name.replace(/\.[^/.]+$/, ''),
        filename: file.name,
        fileType: ext,
        mimeType: file.type,
        unitCode: selectedUnit || 'GENERAL',
        endpoint,
        file,
        extractedText,
      });
      return { name: file.name, ok: true, offlineQueued: true };
    };

    const uploadPromises = files.map(async (file) => {
      const isImage = /\.(png|jpg|jpeg|webp)$/i.test(file.name) || file.type.startsWith('image/');
      const endpoint = isImage ? '/ai/ocr' : '/notes/upload';

      if (isNavigatorOffline) {
        try {
          return await queueFileOffline(file, endpoint, isImage);
        } catch (qErr) {
          return { name: file.name, ok: false, error: qErr?.message || 'Failed to save offline' };
        }
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', file.name.replace(/\.[^/.]+$/, ''));
      formData.append('unit_code', selectedUnit);
      formData.append('topic', '');

      try {
        await api.post(endpoint, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`,
          },
        });
        return { name: file.name, ok: true };
      } catch (err) {
        if (!err?.response) {
          try {
            return await queueFileOffline(file, endpoint, isImage);
          } catch (qErr) {
            return { name: file.name, ok: false, error: qErr?.message || 'Offline save failed' };
          }
        }
        const msg = err?.response?.data?.detail || err.message || 'Upload failed';
        return { name: file.name, ok: false, error: typeof msg === 'string' ? msg : JSON.stringify(msg) };
      }
    });

    const results = await Promise.all(uploadPromises);

    setUploadResults(results);
    setIsUploading(false);

    if (results.every(r => r.ok)) {
      setTimeout(() => navigate('/notes'), 1500);
    }
  };


  const successCount = uploadResults.filter(r => r.ok).length;
  const offlineCount = uploadResults.filter(r => r.offlineQueued).length;
  const failCount = uploadResults.filter(r => !r.ok).length;
  const allDone = uploadResults.length > 0;

  return (
    <div
      className="flex flex-col lg:flex-row min-h-dvh font-sans transition-colors"
      style={{
        backgroundColor: isDark ? '#13131f' : '#f8fafc',
        color: isDark ? '#ffffff' : '#0f172a',
      }}
    >
      <Sidebar />
      <div className="flex-1 overflow-y-auto pb-28 lg:pb-10 min-w-0">
        <main className="max-w-[720px] mx-auto px-4 sm:px-10 py-6 sm:py-10">

          {/* Header */}
          <header className="mb-8 sm:mb-10 animate-fade-in">
            <h1 className={`font-display text-2xl sm:text-[2.5rem] leading-tight mb-2 sm:mb-3 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Upload Notes
            </h1>
            <p className={`text-[14px] leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
              Upload one or multiple files at once. ElimuPap will extract the text and power your ElimuPap Tutor, summaries, and quizzes.
            </p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-6 animate-slide-up">

            {/* ── Dropzone ── */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="relative rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-10 text-center cursor-pointer transition-all"
              style={{
                borderColor: isDragging || files.length ? '#2563EB' : (isDark ? 'rgba(255,255,255,0.12)' : '#cbd5e1'),
                backgroundColor: isDragging
                  ? (isDark ? 'rgba(37,99,235,0.1)' : '#eff6ff')
                  : (isDark ? '#1F1F2A' : '#ffffff'),
              }}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={handleFileInput}
              />
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mb-4 border"
                style={{
                  backgroundColor: isDragging || files.length
                    ? (isDark ? 'rgba(37,99,235,0.2)' : '#eff6ff')
                    : (isDark ? '#11111a' : '#f8fafc'),
                  borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0',
                }}
              >
                <svg className="w-6 h-6" style={{ color: isDragging || files.length ? '#2563EB' : '#64748b' }}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                </svg>
              </div>
              <p className={`text-[14px] font-medium mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {isDragging ? 'Drop files here' : 'Click to upload or drag and drop'}
              </p>
              <p className="text-[12px] text-slate-500">PDF, DOCX, PPTX, TXT, or Images — works online &amp; offline</p>
            </div>

            {error && (
              <p className={`text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>{error}</p>
            )}

            {/* ── File Queue ── */}
            {files.length > 0 && (
              <div className={`rounded-2xl overflow-hidden border shadow-sm ${isDark ? 'bg-[#1F1F2A] border-white/5' : 'bg-white border-slate-200'}`}>
                <div className={`px-5 py-3 flex items-center justify-between border-b ${isDark ? 'bg-[#22222d] border-white/5' : 'bg-[#f8fafc] border-slate-200'}`}>
                  <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {files.length} file{files.length > 1 ? 's' : ''} selected
                  </span>
                  <button type="button" onClick={() => { setFiles([]); setUploadResults([]); }}
                    className={`text-xs font-medium transition-colors ${isDark ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-700'}`}>
                    Clear all
                  </button>
                </div>
                <ul className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-200'}`}>
                  {files.map((file, idx) => {
                    const result = uploadResults[idx];
                    return (
                      <li key={idx} className="flex items-center gap-3 px-5 py-3">
                        {/* File icon */}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-[#2563EB]/15' : 'bg-blue-50 border border-blue-100'}`}>
                          <svg className="w-4 h-4 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                        </div>
                        {/* Name + size */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{file.name}</p>
                          <p className="text-[11px] text-slate-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                        </div>
                        {/* Status indicator */}
                        {result && (
                          result.ok ? (
                            <span className={`flex items-center gap-1 text-[11px] font-medium ${result.offlineQueued
                              ? (isDark ? 'text-amber-400' : 'text-amber-600')
                              : (isDark ? 'text-emerald-400' : 'text-emerald-600')
                              }`}>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              {result.offlineQueued ? 'Saved Offline' : 'Done'}
                            </span>
                          ) : (
                            <span className={`text-[11px] font-medium ${isDark ? 'text-red-400' : 'text-red-600'}`} title={result.error}>Failed</span>
                          )
                        )}
                        {/* Uploading spinner */}
                        {isUploading && !result && (
                          <svg className="w-4 h-4 animate-spin text-[#2563EB]" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                        )}
                        {/* Remove button (when not uploading) */}
                        {!isUploading && !result && (
                          <button type="button" onClick={() => removeFile(idx)}
                            className={`transition-colors flex-shrink-0 ${isDark ? 'text-gray-500 hover:text-red-400' : 'text-slate-400 hover:text-red-600'}`}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* ── Unit Selector ── */}
            <div>
              <label className={`block text-[10px] font-bold uppercase tracking-[0.1em] mb-2 ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                Registered Unit <span className="normal-case font-normal text-slate-500">(optional)</span>
              </label>
              <select
                value={selectedUnit}
                onChange={e => setSelectedUnit(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-lg text-sm border focus:outline-none focus:ring-1 focus:ring-[#2563EB] ${isDark ? 'bg-[#11111a] border-[#2d2d4a] text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}
              >
                <option value="">-- No unit selected --</option>
                {units.map(u => (
                  <option key={u.id} value={u.unit_code}>{u.unit_code} — {u.unit_name}</option>
                ))}
              </select>
              {units.length === 0 && (
                <p className={`text-[11px] mt-2 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                  No units registered yet. <a href="/notes" className="underline font-semibold">Add a unit first</a> to organise your notes.
                </p>
              )}
            </div>

            {/* ── Upload result summary ── */}
            {allDone && (
              <div className={`p-4 rounded-xl text-sm flex items-center gap-3 border ${failCount === 0
                ? (isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700')
                : (isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700')
                }`}>
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {failCount === 0
                    ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    : <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  }
                </svg>
                {failCount === 0
                  ? offlineCount > 0
                    ? `Saved ${offlineCount} file${offlineCount > 1 ? 's' : ''} offline! Available in Library now and will sync automatically when online.`
                    : `All ${successCount} file${successCount > 1 ? 's' : ''} uploaded successfully! Redirecting…`
                  : `${successCount} uploaded, ${failCount} failed. Check the list above.`
                }
              </div>
            )}

            {/* ── Submit ── */}
            <button
              type="submit"
              disabled={isUploading || files.length === 0}
              className="w-full py-3 rounded-xl flex justify-center items-center gap-2 text-sm font-semibold transition-all disabled:opacity-50 bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-sm"
            >
              {isUploading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Uploading {files.length} file{files.length > 1 ? 's' : ''}…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  Upload {files.length > 0 ? `${files.length} File${files.length > 1 ? 's' : ''}` : 'Files'}
                </>
              )}
            </button>

          </form>
        </main>
      </div>
    </div>
  );
}
