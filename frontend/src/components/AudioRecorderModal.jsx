import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, Upload, FileAudio, X } from './Icons';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { enqueueOfflineUpload } from '../utils/offlineUploads';

const getSpeechRecognition = () => {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

export default function AudioRecorderModal({ isOpen, onClose }) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [title, setTitle] = useState('');
  const [unitCode, setUnitCode] = useState('GENERAL');
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [sttSupported] = useState(() => Boolean(getSpeechRecognition()));
  const [sttActive, setSttActive] = useState(false);
  const [liveModeLabel, setLiveModeLabel] = useState('Recording & Transcribing…');
  const [sttError, setSttError] = useState('');
  const [loading, setLoading] = useState(false);
  const [savedNotice, setSavedNotice] = useState('');
  const navigate = useNavigate();

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const mimeTypeRef = useRef('audio/webm');
  const timerRef = useRef(null);
  const chunkTimerRef = useRef(null);
  const recognitionRef = useRef(null);
  const isRecordingRef = useRef(false);
  const sttGotResultRef = useRef(false);
  const chunkInFlightRef = useRef(false);

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

  const transcribeRecordedChunksLive = async () => {
    if (!isRecordingRef.current || chunkInFlightRef.current) return;
    if (sttGotResultRef.current) return; // Browser STT is already updating live
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (!audioChunksRef.current.length) return;

    chunkInFlightRef.current = true;
    try {
      const snapshotBlob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current || 'audio/webm' });
      if (snapshotBlob.size < 1000) return;

      const formData = new FormData();
      formData.append('file', snapshotBlob, `live_${Date.now()}.webm`);
      const res = await api.post('/ai/transcribe-chunk', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const text = (res?.data?.text || '').trim();
      if (text && isRecordingRef.current && !sttGotResultRef.current) {
        setTranscript(text);
        setLiveModeLabel('Live AI Transcription Active');
      }
    } catch {
      // ignore transient live chunk errors; full audio still saved
    } finally {
      chunkInFlightRef.current = false;
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
        setLiveModeLabel('Transcribing Live…');
      };

      recognition.onresult = (event) => {
        sttGotResultRef.current = true;
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
          setSttActive(false);
        } else if (event.error === 'audio-capture' || event.error === 'aborted' || event.error === 'network') {
          // Mobile browsers often lock mic for MediaRecorder; live Whisper chunk loop takes over seamlessly
          setSttActive(false);
          setLiveModeLabel(
            typeof navigator !== 'undefined' && navigator.onLine
              ? 'Live AI Transcription Active'
              : 'Recording Audio Offline'
          );
        }
      };

      recognition.onend = () => {
        setInterimText('');
        if (isRecordingRef.current && sttGotResultRef.current) {
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
      setSttActive(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopSpeechRecognition();
      clearInterval(chunkTimerRef.current);
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
      clearInterval(chunkTimerRef.current);
      clearInterval(timerRef.current);
    };
  }, [isOpen]);

  const startRecording = async () => {
    setSttError('');
    setSavedNotice('');
    setTranscript('');
    setInterimText('');
    sttGotResultRef.current = false;
    chunkInFlightRef.current = false;
    isRecordingRef.current = true;

    // Start browser SpeechRecognition synchronously inside the click gesture first
    if (sttSupported) {
      startSpeechRecognition();
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);

      mimeTypeRef.current = recorder.mimeType || 'audio/webm';
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current || 'audio/webm' });
        setAudioBlob(blob);
      };

      // Emit chunks every 4s so live AI transcription works on Android/iOS even when mic is locked
      recorder.start(4000);
      setIsRecording(true);
      setRecordingTime(0);
      setLiveModeLabel(
        sttSupported
          ? 'Transcribing Live…'
          : typeof navigator !== 'undefined' && navigator.onLine
            ? 'Live AI Transcription Active'
            : 'Recording Audio Offline'
      );

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      chunkTimerRef.current = setInterval(() => {
        transcribeRecordedChunksLive();
      }, 5000);
    } catch {
      isRecordingRef.current = false;
      stopSpeechRecognition();
      alert('Microphone access is required to record lectures.');
    }
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    stopSpeechRecognition();
    clearInterval(timerRef.current);
    clearInterval(chunkTimerRef.current);
    setIsRecording(false);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
  };

  const handleSaveRecording = async (e) => {
    e.preventDefault();
    if (!audioBlob) return;

    setLoading(true);
    const cleanTranscript = transcript.trim();
    const noteTitle = (title || 'Recorded Audio Lecture').trim();
    const cleanUnit = (unitCode || 'GENERAL').trim().toUpperCase() || 'GENERAL';
    const filename = `lecture_${Date.now()}.webm`;

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const queued = await enqueueOfflineUpload({
          title: noteTitle,
          filename,
          fileType: 'audio_lecture',
          mimeType: mimeTypeRef.current || 'audio/webm',
          unitCode: cleanUnit,
          endpoint: '/ai/transcribe-audio',
          file: audioBlob,
          liveTranscript: cleanTranscript,
        });
        setSavedNotice('Recording saved offline! Will sync automatically when online.');
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
          mimeType: mimeTypeRef.current || 'audio/webm',
          unitCode: cleanUnit,
          endpoint: '/ai/transcribe-audio',
          file: audioBlob,
          liveTranscript: cleanTranscript,
        });
        setSavedNotice('Recording saved offline!');
        setTimeout(() => {
          onClose();
          navigate(`/notes/${queued.id}`);
        }, 800);
      } else {
        alert(err.response?.data?.detail || 'Failed to save lecture recording');
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
    clearInterval(chunkTimerRef.current);
    setAudioBlob(null);
    setTranscript('');
    setInterimText('');
    setRecordingTime(0);
    setSavedNotice('');
    setSttError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl relative max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
            <Mic className="w-5 h-5" /> Record Lecture
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-200" aria-label="Close recorder">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-center py-4">
          {!isRecording && !audioBlob && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={startRecording}
                className="w-24 h-24 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex flex-col items-center justify-center mx-auto shadow-2xl transition transform hover:scale-105"
              >
                <Mic className="w-8 h-8 mb-1" />
                <span className="text-[10px] uppercase font-bold tracking-wider">Record</span>
              </button>
              <p className="text-[11px] text-slate-400">
                Tap Record to capture lecture audio and transcribe speech to text live.
              </p>
            </div>
          )}

          {isRecording && (
            <div className="space-y-4">
              <div className="w-24 h-24 rounded-full bg-rose-500/20 text-rose-400 border-2 border-rose-500 flex flex-col items-center justify-center mx-auto animate-pulse">
                <Mic className="w-8 h-8 mb-1" />
                <span className="font-mono text-xs font-bold">{formatTime(recordingTime)}</span>
              </div>

              {/* Live Speech-to-Text Preview */}
              <div className="text-left bg-slate-950/90 border border-slate-800 rounded-2xl p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${sttActive || transcript ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
                    {liveModeLabel}
                  </span>
                  {transcript && (
                    <span className="text-[10px] text-slate-500 font-mono">
                      {transcript.split(/\s+/).filter(Boolean).length} words
                    </span>
                  )}
                </div>
                <div className="max-h-36 overflow-y-auto text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {transcript || interimText ? (
                    <>
                      <span>{transcript}</span>
                      {interimText && (
                        <span className="text-blue-300 italic"> {interimText}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-slate-500 italic">
                      Listening… spoken words will appear here live as you record.
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={stopRecording}
                className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 mx-auto"
              >
                <Square className="w-4 h-4 text-rose-400" /> Stop Recording
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

          {audioBlob && !isRecording && (
            <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700/80 mt-2 mb-2">
              <div className="flex items-center justify-center gap-2 text-xs text-emerald-400 font-semibold mb-3">
                <FileAudio className="w-4 h-4" /> Recording Ready ({formatTime(recordingTime)})
              </div>
              <form onSubmit={handleSaveRecording} className="space-y-3 text-left">
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
                    Transcript Notes <span className="text-slate-500 font-normal">(editable)</span>
                  </label>
                  <textarea
                    rows={4}
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder="Live transcript appears here — edit or add notes before saving."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 resize-y"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={resetCapture}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800"
                  >
                    Re-record
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition flex items-center gap-2 shadow-lg disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {loading ? 'Saving & Transcribing…' : 'Save Recording'}
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
              className="text-[11px] text-rose-400 hover:text-rose-300 font-medium transition flex items-center justify-center gap-1.5 mx-auto"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>View all my saved lecture recordings &rarr;</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
