import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, Upload, FileAudio, X, MessageSquare } from './Icons';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { enqueueOfflineUpload } from '../utils/offlineUploads';

const getSpeechRecognition = () => {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

export default function AudioRecorderModal({ isOpen, onClose }) {
  const [captureMode, setCaptureMode] = useState('audio_stt'); // 'audio_stt' | 'stt_only'
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [title, setTitle] = useState('');
  const [unitCode, setUnitCode] = useState('GENERAL');
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [sttSupported] = useState(() => Boolean(getSpeechRecognition()));
  const [sttActive, setSttActive] = useState(false);
  const [sttError, setSttError] = useState('');
  const [loading, setLoading] = useState(false);
  const [savedNotice, setSavedNotice] = useState('');
  const navigate = useNavigate();

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const recognitionRef = useRef(null);
  const isRecordingRef = useRef(false);

  const stopSpeechRecognition = () => {
    isRecordingRef.current = false;
    setSttActive(false);
    setInterimText('');
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
  };

  const startSpeechRecognition = () => {
    const SpeechRec = getSpeechRecognition();
    if (!SpeechRec) return;

    try {
      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setSttActive(true);
        setSttError('');
      };

      recognition.onresult = (event) => {
        let finalAdded = '';
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const piece = event.results[i][0]?.transcript || '';
          if (event.results[i].isFinal) {
            finalAdded += (finalAdded ? ' ' : '') + piece.trim();
          } else {
            interim += piece;
          }
        }
        if (finalAdded) {
          setTranscript((prev) => {
            const base = prev.trim();
            return base ? `${base} ${finalAdded}` : finalAdded;
          });
        }
        setInterimText(interim.trim());
      };

      recognition.onerror = (event) => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setSttError('Microphone permission denied for Speech-to-Text.');
          setSttActive(false);
        } else if (event.error === 'network') {
          setSttError('Live Speech-to-Text needs browser speech service (audio is still recording).');
        }
      };

      // Chrome stops SpeechRecognition after brief silence; auto-restart while recording
      recognition.onend = () => {
        setInterimText('');
        if (isRecordingRef.current) {
          try {
            recognition.start();
          } catch {
            setSttActive(false);
          }
        } else {
          setSttActive(false);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setSttError('Could not start live Speech-to-Text in this browser.');
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopSpeechRecognition();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
        } catch {}
      }
      clearInterval(timerRef.current);
      setIsRecording(false);
    }
    return () => {
      stopSpeechRecognition();
      clearInterval(timerRef.current);
    };
  }, [isOpen]);

  const startRecording = async () => {
    setSttError('');
    setSavedNotice('');

    if (captureMode === 'stt_only') {
      if (!sttSupported) {
        setSttError('Live Speech-to-Text is not supported in this browser. Try Chrome/Edge or use Audio Recording.');
        return;
      }
      isRecordingRef.current = true;
      setIsRecording(true);
      setRecordingTime(0);
      startSpeechRecognition();
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
      };

      mediaRecorderRef.current.start();
      isRecordingRef.current = true;
      setIsRecording(true);
      setRecordingTime(0);

      if (sttSupported) {
        startSpeechRecognition();
      }

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch {
      alert('Microphone access is required to record lectures.');
    }
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    stopSpeechRecognition();
    clearInterval(timerRef.current);
    setIsRecording(false);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
  };

  const handleSaveRecordingOrNotes = async (e, saveTextOnly = false) => {
    e.preventDefault();
    const cleanTranscript = transcript.trim();
    const noteTitle = (title || (saveTextOnly ? 'Class Speech Notes' : 'Recorded Audio Lecture')).trim();
    const cleanUnit = (unitCode || 'GENERAL').trim().toUpperCase() || 'GENERAL';

    if (saveTextOnly || captureMode === 'stt_only') {
      if (!cleanTranscript) {
        alert('Please dictate or type some class notes before saving.');
        return;
      }
      setLoading(true);
      const safeFileSlug = noteTitle.replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '_') || 'class_notes';
      const txtFile = new File([cleanTranscript], `${safeFileSlug}_${Date.now()}.txt`, { type: 'text/plain' });

      try {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const queued = await enqueueOfflineUpload({
            title: noteTitle,
            filename: txtFile.name,
            fileType: 'txt',
            mimeType: 'text/plain',
            unitCode: cleanUnit,
            endpoint: '/notes/upload',
            file: txtFile,
            liveTranscript: cleanTranscript,
          });
          setSavedNotice('Class notes saved offline! Opening note…');
          setTimeout(() => {
            onClose();
            navigate(`/notes/${queued.id}`);
          }, 700);
          return;
        }

        const formData = new FormData();
        formData.append('file', txtFile);
        formData.append('title', noteTitle);
        formData.append('unit_code', cleanUnit === 'GENERAL' ? '' : cleanUnit);
        formData.append('topic', '');

        const res = await api.post('/notes/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const createdId = res?.data?.id || res?.data?.note_id;
        window.dispatchEvent(new CustomEvent('elimupap:data-changed'));
        onClose();
        navigate(createdId ? `/notes/${createdId}` : '/notes');
      } catch (err) {
        if (!err?.response) {
          const queued = await enqueueOfflineUpload({
            title: noteTitle,
            filename: txtFile.name,
            fileType: 'txt',
            mimeType: 'text/plain',
            unitCode: cleanUnit,
            endpoint: '/notes/upload',
            file: txtFile,
            liveTranscript: cleanTranscript,
          });
          setSavedNotice('Saved offline — will sync when online!');
          setTimeout(() => {
            onClose();
            navigate(`/notes/${queued.id}`);
          }, 700);
        } else {
          alert(err.response?.data?.detail || 'Failed to save class notes');
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!audioBlob) return;
    setLoading(true);
    const filename = `lecture_${Date.now()}.webm`;

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const queued = await enqueueOfflineUpload({
          title: noteTitle,
          filename,
          fileType: 'audio_lecture',
          mimeType: 'audio/webm',
          unitCode: cleanUnit,
          endpoint: '/ai/transcribe-audio',
          file: audioBlob,
          liveTranscript: cleanTranscript,
        });
        setSavedNotice('Audio & transcript saved offline! Will upload automatically when online.');
        setTimeout(() => {
          onClose();
          navigate(`/notes/${queued.id}`);
        }, 800);
        return;
      }

      const formData = new FormData();
      formData.append('file', audioBlob, filename);
      formData.append('title', noteTitle);
      formData.append('unit_code', cleanUnit);
      if (cleanTranscript) {
        formData.append('live_transcript', cleanTranscript);
      }

      const res = await api.post('/ai/transcribe-audio', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const createdId = res?.data?.id || res?.data?.note_id;
      window.dispatchEvent(new CustomEvent('elimupap:data-changed'));
      onClose();
      navigate(createdId ? `/notes/${createdId}` : '/notes');
    } catch (err) {
      if (!err?.response) {
        const queued = await enqueueOfflineUpload({
          title: noteTitle,
          filename,
          fileType: 'audio_lecture',
          mimeType: 'audio/webm',
          unitCode: cleanUnit,
          endpoint: '/ai/transcribe-audio',
          file: audioBlob,
          liveTranscript: cleanTranscript,
        });
        setSavedNotice('Audio & transcript saved offline!');
        setTimeout(() => {
          onClose();
          navigate(`/notes/${queued.id}`);
        }, 800);
      } else {
        alert(err.response?.data?.detail || 'Failed to transcribe lecture audio');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const resetCapture = () => {
    stopSpeechRecognition();
    setAudioBlob(null);
    setTranscript('');
    setInterimText('');
    setRecordingTime(0);
    setSavedNotice('');
    setSttError('');
  };

  const showSaveForm = !isRecording && (audioBlob || (captureMode === 'stt_only' && transcript.trim().length > 0));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl relative max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
            <Mic className="w-5 h-5" /> Record &amp; Live Speech-to-Text
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-200" aria-label="Close recorder">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher */}
        {!isRecording && !audioBlob && (
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-950/80 border border-slate-800 mb-4 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setCaptureMode('audio_stt')}
              className={`py-2 px-3 rounded-lg transition flex items-center justify-center gap-1.5 ${
                captureMode === 'audio_stt'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Audio + Speech-to-Text</span>
            </button>
            <button
              type="button"
              onClick={() => setCaptureMode('stt_only')}
              className={`py-2 px-3 rounded-lg transition flex items-center justify-center gap-1.5 ${
                captureMode === 'stt_only'
                  ? 'bg-[#2563EB] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Speech-to-Text Notes</span>
            </button>
          </div>
        )}

        <div className="text-center py-3">
          {!isRecording && !showSaveForm && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={startRecording}
                className={`w-24 h-24 rounded-full text-white flex flex-col items-center justify-center mx-auto shadow-2xl transition transform hover:scale-105 ${
                  captureMode === 'stt_only'
                    ? 'bg-[#2563EB] hover:bg-[#1D4ED8]'
                    : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                <Mic className="w-8 h-8 mb-1" />
                <span className="text-[10px] uppercase font-bold tracking-wider">
                  {captureMode === 'stt_only' ? 'Dictate' : 'Record'}
                </span>
              </button>
              <p className="text-[11px] text-slate-400">
                {captureMode === 'stt_only'
                  ? 'Speak during class to convert voice straight into text notes.'
                  : sttSupported
                    ? 'Records class audio while live Speech-to-Text drafts your notes.'
                    : 'Records class audio (AI will transcribe on upload).'}
              </p>
            </div>
          )}

          {isRecording && (
            <div className="space-y-4">
              <div className={`w-24 h-24 rounded-full border-2 flex flex-col items-center justify-center mx-auto animate-pulse ${
                captureMode === 'stt_only'
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500'
                  : 'bg-rose-500/20 text-rose-400 border-rose-500'
              }`}>
                <Mic className="w-8 h-8 mb-1" />
                <span className="font-mono text-xs font-bold">{formatTime(recordingTime)}</span>
              </div>

              {/* Live Speech-to-Text Preview */}
              <div className="text-left bg-slate-950/90 border border-slate-800 rounded-2xl p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${sttActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                    {sttActive ? 'Live Speech-to-Text Active' : 'Speech-to-Text Standby'}
                  </span>
                  {transcript && (
                    <span className="text-[10px] text-slate-500 font-mono">
                      {transcript.split(/\s+/).filter(Boolean).length} words
                    </span>
                  )}
                </div>
                <div className="max-h-32 overflow-y-auto text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {transcript || interimText ? (
                    <>
                      <span>{transcript}</span>
                      {interimText && (
                        <span className="text-blue-300 italic"> {interimText}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-slate-500 italic">
                      {sttSupported
                        ? 'Listening… speak clearly to capture live class notes.'
                        : 'Live browser Speech-to-Text unavailable here — audio is recording safely.'}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={stopRecording}
                className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 mx-auto"
              >
                <Square className="w-4 h-4 text-rose-400" />
                {captureMode === 'stt_only' ? 'Finish Dictation' : 'Stop Recording'}
              </button>
            </div>
          )}

          {sttError && (
            <p className="mt-3 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
              {sttError}
            </p>
          )}

          {savedNotice && (
            <p className="mt-3 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 font-medium">
              {savedNotice}
            </p>
          )}

          {showSaveForm && (
            <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700/80 mt-2 mb-2">
              <div className="flex items-center justify-center gap-2 text-xs text-emerald-400 font-semibold mb-3">
                <FileAudio className="w-4 h-4" />
                {audioBlob
                  ? `Audio Recorded (${formatTime(recordingTime)})`
                  : `Live Speech Notes Captured (${formatTime(recordingTime)})`}
              </div>
              <form onSubmit={(e) => handleSaveRecordingOrNotes(e, captureMode === 'stt_only')} className="space-y-3 text-left">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Lecture Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Contract Law Lecture 4"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-rose-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Unit Code</label>
                  <input
                    type="text"
                    placeholder="e.g. LAW 1102"
                    value={unitCode}
                    onChange={(e) => setUnitCode(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Captured Speech-to-Text Notes <span className="text-slate-500 font-normal">(editable)</span>
                  </label>
                  <textarea
                    rows={4}
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder="Live spoken notes appear here — you can also type or edit before saving."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 resize-y"
                  />
                </div>

                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={resetCapture}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800"
                  >
                    Re-record
                  </button>
                  {audioBlob && transcript.trim() && (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={(e) => handleSaveRecordingOrNotes(e, true)}
                      className="px-3.5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs transition disabled:opacity-50"
                    >
                      Save Text Only
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition flex items-center gap-2 shadow-lg disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {loading
                      ? 'Saving…'
                      : captureMode === 'stt_only'
                        ? 'Save Class Notes'
                        : 'Save & Transcribe Audio'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* View past recordings link */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 text-center">
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate('/notes?filter=audio');
              }}
              className="text-[11px] text-rose-400 hover:text-rose-300 font-medium transition flex items-center justify-center gap-1 mx-auto"
            >
              <span>🎙️</span> View all my saved lecture recordings &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
