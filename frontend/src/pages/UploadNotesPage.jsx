import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import api from '../api/axios';

export default function UploadNotesPage() {
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
    VALID_TYPES.includes(f.type) || /\.(pdf|docx|pptx)$/i.test(f.name);

  const addFiles = (incoming) => {
    const valid = Array.from(incoming).filter(isValidFile);
    const invalid = Array.from(incoming).filter(f => !isValidFile(f));
    
    const hasLegacy = invalid.some(f => /\.(doc|ppt)$/i.test(f.name));
    
    if (hasLegacy) {
      setError(`Legacy formats (.doc, .ppt) are too old to be read by our AI. Please open them and "Save As" .docx, .pptx, or .pdf!`);
    } else if (invalid.length) {
      setError(`${invalid.length} file(s) skipped — only PDF, DOCX, or PPTX are allowed.`);
    } else {
      setError('');
    }
    setFiles(prev => {
      // deduplicate by name
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
    const uploadPromises = files.map(async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', file.name.replace(/\.[^/.]+$/, ''));
      formData.append('unit_code', selectedUnit);
      formData.append('topic', '');  // topic is optional now

      try {
        await api.post('/notes/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`,
          },
        });
        return { name: file.name, ok: true };
      } catch (err) {
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
  const failCount = uploadResults.filter(r => !r.ok).length;
  const allDone = uploadResults.length > 0;

  return (
    <div className="flex min-h-dvh font-sans" style={{ backgroundColor: '#13131f' }}>
      <Sidebar />
      <div className="flex-1 overflow-y-auto pb-24 lg:pb-10">
        <main className="max-w-[720px] mx-auto px-6 sm:px-10 py-10">

          {/* Header */}
          <header className="mb-10 animate-fade-in">
            <h1 className="font-display text-[2.5rem] text-white leading-none mb-3 tracking-tight">
              Upload Notes
            </h1>
            <p className="text-[14px] leading-relaxed" style={{ color: '#9ca3af' }}>
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
                borderColor: isDragging ? '#5B57FF' : files.length ? '#5B57FF' : 'rgba(255,255,255,0.1)',
                backgroundColor: isDragging ? 'rgba(91,87,255,0.07)' : 'transparent',
              }}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.pptx"
                className="hidden"
                onChange={handleFileInput}
              />
              <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
                style={{ backgroundColor: isDragging ? 'rgba(91,87,255,0.2)' : '#1e1e2a' }}>
                <svg className="w-6 h-6" style={{ color: isDragging || files.length ? '#7571ff' : '#6b7280' }}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                </svg>
              </div>
              <p className="text-[14px] font-medium text-white mb-1">
                {isDragging ? 'Drop files here' : 'Click to upload or drag and drop'}
              </p>
              <p className="text-[12px]" style={{ color: '#6b7280' }}>PDF, DOCX, or PPTX — select as many as you like</p>
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            {/* ── File Queue ── */}
            {files.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#1F1F2A', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="px-5 py-3 flex items-center justify-between"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', backgroundColor: '#22222d' }}>
                  <span className="text-sm font-medium text-white">{files.length} file{files.length > 1 ? 's' : ''} selected</span>
                  <button type="button" onClick={() => { setFiles([]); setUploadResults([]); }}
                    className="text-xs font-medium transition-colors" style={{ color: '#f87171' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#fca5a5'}
                    onMouseLeave={e => e.currentTarget.style.color = '#f87171'}>
                    Clear all
                  </button>
                </div>
                <ul className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                  {files.map((file, idx) => {
                    const result = uploadResults[idx];
                    return (
                      <li key={idx} className="flex items-center gap-3 px-5 py-3">
                        {/* File icon */}
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: 'rgba(91,87,255,0.1)' }}>
                          <svg className="w-4 h-4 text-[#7571ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                        </div>
                        {/* Name + size */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-white truncate">{file.name}</p>
                          <p className="text-[11px]" style={{ color: '#6b7280' }}>{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                        </div>
                        {/* Status indicator */}
                        {result && (
                          result.ok ? (
                            <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: '#34d399' }}>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              Done
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium" style={{ color: '#f87171' }} title={result.error}>Failed</span>
                          )
                        )}
                        {/* Uploading spinner */}
                        {isUploading && !result && (
                          <svg className="w-4 h-4 animate-spin text-[#5B57FF]" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                          </svg>
                        )}
                        {/* Remove button (when not uploading) */}
                        {!isUploading && !result && (
                          <button type="button" onClick={() => removeFile(idx)}
                            className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0">
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
              <label className="block text-[10px] font-bold uppercase tracking-[0.1em] mb-2" style={{ color: '#9898c0' }}>
                Registered Unit <span className="normal-case font-normal text-gray-500">(optional)</span>
              </label>
              <select
                value={selectedUnit}
                onChange={e => setSelectedUnit(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#5B57FF]"
                style={{ backgroundColor: '#11111a', border: '1px solid #2d2d4a' }}>
                <option value="">-- No unit selected --</option>
                {units.map(u => (
                  <option key={u.id} value={u.unit_code}>{u.unit_code} — {u.unit_name}</option>
                ))}
              </select>
              {units.length === 0 && (
                <p className="text-[11px] mt-2 text-yellow-500">
                  No units registered yet. <a href="/units" className="underline font-semibold">Add a unit first</a> to organise your notes.
                </p>
              )}
            </div>

            {/* ── Upload result summary ── */}
            {allDone && (
              <div className="p-4 rounded-xl text-sm flex items-center gap-3"
                style={{
                  backgroundColor: failCount === 0 ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)',
                  border: `1px solid ${failCount === 0 ? 'rgba(52,211,153,0.2)' : 'rgba(251,191,36,0.2)'}`,
                  color: failCount === 0 ? '#34d399' : '#fbbf24'
                }}>
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {failCount === 0
                    ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    : <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  }
                </svg>
                {failCount === 0
                  ? `All ${successCount} file${successCount > 1 ? 's' : ''} uploaded successfully! Redirecting…`
                  : `${successCount} uploaded, ${failCount} failed. Check the list above.`
                }
              </div>
            )}

            {/* ── Submit ── */}
            <button
              type="submit"
              disabled={isUploading || files.length === 0}
              className="w-full py-3 rounded-xl flex justify-center items-center gap-2 text-sm font-semibold transition-all disabled:opacity-50"
              style={{ backgroundColor: '#5B57FF', color: '#fff' }}
              onMouseEnter={e => !isUploading && (e.currentTarget.style.backgroundColor = '#7571ff')}
              onMouseLeave={e => !isUploading && (e.currentTarget.style.backgroundColor = '#5B57FF')}>
              {isUploading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
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
