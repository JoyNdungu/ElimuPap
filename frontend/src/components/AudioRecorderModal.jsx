import React, { useState, useRef } from 'react';
import { Mic, Square, Loader2, Upload, FileAudio, X } from './Icons';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

export default function AudioRecorderModal({ isOpen, onClose }) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [title, setTitle] = useState('');
  const [unitCode, setUnitCode] = useState('GENERAL');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = async () => {
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
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      alert("Microphone access is required to record lectures.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const handleUploadAndTranscribe = async (e) => {
    e.preventDefault();
    if (!audioBlob) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', audioBlob, `lecture_${Date.now()}.webm`);
    formData.append('title', title || 'Recorded Audio Lecture');
    formData.append('unit_code', unitCode.toUpperCase() || 'GENERAL');

    try {
      const res = await api.post('/ai/transcribe-audio', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      onClose();
      navigate(`/notes/${res.data.id}`);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to transcribe lecture audio");
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl relative">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
            <Mic className="w-5 h-5" /> Record Audio Lecture
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-center py-6">
          {!isRecording && !audioBlob && (
            <button
              onClick={startRecording}
              className="w-24 h-24 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex flex-col items-center justify-center mx-auto shadow-2xl transition transform hover:scale-105"
            >
              <Mic className="w-8 h-8 mb-1" />
              <span className="text-[10px] uppercase font-bold tracking-wider">Record</span>
            </button>
          )}

          {isRecording && (
            <div className="space-y-4">
              <div className="w-24 h-24 rounded-full bg-rose-500/20 text-rose-400 border-2 border-rose-500 flex flex-col items-center justify-center mx-auto animate-pulse">
                <Mic className="w-8 h-8 mb-1" />
                <span className="font-mono text-xs font-bold">{formatTime(recordingTime)}</span>
              </div>
              <button
                onClick={stopRecording}
                className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 mx-auto"
              >
                <Square className="w-4 h-4 text-rose-400" /> Stop Recording
              </button>
            </div>
          )}

          {audioBlob && !isRecording && (
            <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700/80 mb-4">
              <div className="flex items-center justify-center gap-2 text-xs text-emerald-400 font-semibold mb-3">
                <FileAudio className="w-4 h-4" /> Audio Recorded ({formatTime(recordingTime)})
              </div>
              <form onSubmit={handleUploadAndTranscribe} className="space-y-3 text-left">
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

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAudioBlob(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800"
                  >
                    Re-record
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition flex items-center gap-2 shadow-lg"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {loading ? 'AI Transcribing Audio...' : 'Transcribe & Generate Note'}
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
