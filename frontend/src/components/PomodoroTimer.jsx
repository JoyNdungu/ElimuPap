import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Minimize2, Timer } from './Icons';
import { useTheme } from '../context/ThemeContext';
import api from '../api/axios';

const MODE_TIMES = {
  focus: 25,
  shortBreak: 5,
  longBreak: 15,
};

const STORAGE_KEY = 'elimupap_pomodoro_state';

function readSavedTimerState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const validModes = ['focus', 'shortBreak', 'longBreak', 'custom'];
    const mode = validModes.includes(parsed.mode) ? parsed.mode : 'focus';
    const customMinutes = Number.isFinite(Number(parsed.customMinutes)) && Number(parsed.customMinutes) >= 1
      ? Math.min(360, Math.round(Number(parsed.customMinutes)))
      : 30;
    const sessionMinutes = Number.isFinite(Number(parsed.sessionMinutes)) && Number(parsed.sessionMinutes) >= 1
      ? Math.min(360, Math.round(Number(parsed.sessionMinutes)))
      : (mode === 'custom' ? customMinutes : MODE_TIMES[mode]);

    let timeLeft = Number.isFinite(Number(parsed.timeLeft)) && Number(parsed.timeLeft) >= 0
      ? Math.round(Number(parsed.timeLeft))
      : sessionMinutes * 60;
    const isRunning = Boolean(parsed.isRunning);
    const endTime = typeof parsed.endTime === 'number' ? parsed.endTime : null;

    if (isRunning && endTime) {
      timeLeft = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    }

    return {
      mode,
      customMinutes,
      customInput: typeof parsed.customInput === 'string' ? parsed.customInput : '',
      sessionMinutes,
      timeLeft,
      isRunning,
      endTime: isRunning ? endTime : null,
      soundOn: typeof parsed.soundOn === 'boolean' ? parsed.soundOn : true,
      minimized: typeof parsed.minimized === 'boolean' ? parsed.minimized : true,
    };
  } catch {
    return null;
  }
}

export default function PomodoroTimer() {
  const { isDark } = useTheme();
  const initial = useRef(readSavedTimerState()).current;

  const [mode, setMode] = useState(initial?.mode ?? 'focus'); // 'focus' | 'shortBreak' | 'longBreak' | 'custom'
  const [customMinutes, setCustomMinutes] = useState(initial?.customMinutes ?? 30);
  const [customInput, setCustomInput] = useState(initial?.customInput ?? '');
  const [sessionMinutes, setSessionMinutes] = useState(initial?.sessionMinutes ?? 25);
  const [timeLeft, setTimeLeft] = useState(initial?.timeLeft ?? 25 * 60);
  const [isRunning, setIsRunning] = useState(initial?.isRunning ?? false);
  const [endTime, setEndTime] = useState(initial?.endTime ?? null);
  const [soundOn, setSoundOn] = useState(initial?.soundOn ?? true);
  const [minimized, setMinimized] = useState(initial?.minimized ?? true);
  const [completionMessage, setCompletionMessage] = useState('');

  const containerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const completedEndTimeRef = useRef(null);

  const getAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }, []);

  const playCompletionSound = useCallback(() => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      // Play two clear chime waves so alert is unmistakable on any page
      const notes = [523.25, 659.25, 783.99, 1046.5, 659.25, 783.99, 1046.5];
      const baseTime = ctx.currentTime + 0.02;

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = baseTime + idx * 0.17;
        const duration = idx === notes.length - 1 ? 0.65 : 0.24;

        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.32, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration + 0.03);
      });

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
    } catch {
      // Ignore Web Audio errors on restricted devices
    }
  }, [getAudioContext]);

  // Persist timer state so page refreshes keep exact remaining time & running state
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          mode,
          customMinutes,
          customInput,
          sessionMinutes,
          timeLeft,
          isRunning,
          endTime,
          soundOn,
          minimized,
        })
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [mode, customMinutes, customInput, sessionMinutes, timeLeft, isRunning, endTime, soundOn, minimized]);

  // Close (minimize) when clicking or tapping outside the expanded timer card
  useEffect(() => {
    if (minimized) return undefined;
    const handleOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setMinimized(true);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [minimized]);

  const handleTimerComplete = useCallback((completedEnd) => {
    if (completedEnd && completedEndTimeRef.current === completedEnd) return;
    completedEndTimeRef.current = completedEnd || Date.now();

    setIsRunning(false);
    setEndTime(null);
    setTimeLeft(0);
    setMinimized(false);

    if (soundOn) {
      playCompletionSound();
    }

    if (mode === 'focus' || mode === 'custom') {
      api.post('/progress/activity', {
        type: 'time_spent',
        duration_minutes: sessionMinutes,
        metadata: { source: 'pomodoro_timer', mode }
      }).catch(err => console.error('Logged pomodoro error:', err));
    }

    setCompletionMessage(
      mode === 'focus' || mode === 'custom'
        ? `Study session (${sessionMinutes} min) complete! Take a break.`
        : 'Break over! Ready to focus?'
    );
  }, [mode, sessionMinutes, soundOn, playCompletionSound]);

  // Accurate wall-clock countdown so refresh & background tabs stay synced
  useEffect(() => {
    if (!isRunning) return undefined;

    const targetEnd = endTime || (Date.now() + timeLeft * 1000);
    if (!endTime) {
      setEndTime(targetEnd);
    }

    const syncRemaining = () => {
      const remaining = Math.max(0, Math.ceil((targetEnd - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        handleTimerComplete(targetEnd);
      }
    };

    syncRemaining();
    const interval = setInterval(syncRemaining, 500);
    return () => clearInterval(interval);
  }, [isRunning, endTime, handleTimerComplete]);

  const switchMode = (newMode) => {
    const mins = newMode === 'custom' ? customMinutes : MODE_TIMES[newMode];
    setMode(newMode);
    setSessionMinutes(mins);
    setTimeLeft(mins * 60);
    setIsRunning(false);
    setEndTime(null);
    setCompletionMessage('');
  };

  const applyCustomMinutes = (rawMins) => {
    const parsed = Math.max(1, Math.min(360, Math.round(Number(rawMins) || 0)));
    setCustomMinutes(parsed);
    setCustomInput(String(parsed));
    setMode('custom');
    setSessionMinutes(parsed);
    setTimeLeft(parsed * 60);
    setIsRunning(false);
    setEndTime(null);
    setCompletionMessage('');
    return parsed;
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    applyCustomMinutes(customInput);
  };

  const resetTimer = () => {
    const mins = mode === 'custom' ? customMinutes : MODE_TIMES[mode];
    setSessionMinutes(mins);
    setTimeLeft(mins * 60);
    setIsRunning(false);
    setEndTime(null);
    setCompletionMessage('');
  };

  const toggleRun = () => {
    getAudioContext();
    setCompletionMessage('');

    if (isRunning) {
      const remaining = endTime ? Math.max(0, Math.ceil((endTime - Date.now()) / 1000)) : timeLeft;
      setTimeLeft(remaining);
      setIsRunning(false);
      setEndTime(null);
      return;
    }

    let startSecs = timeLeft;

    // If user typed a custom duration and tapped Start directly without pressing Set
    if (mode === 'custom' && customInput.trim()) {
      const typed = Math.max(1, Math.min(360, Math.round(Number(customInput) || 0)));
      if (typed >= 1 && typed !== sessionMinutes && (timeLeft === sessionMinutes * 60 || timeLeft === 0)) {
        setCustomMinutes(typed);
        setCustomInput(String(typed));
        setSessionMinutes(typed);
        startSecs = typed * 60;
        setTimeLeft(startSecs);
      }
    }

    if (startSecs <= 0) {
      const mins = mode === 'custom' ? customMinutes : MODE_TIMES[mode];
      startSecs = mins * 60;
      setSessionMinutes(mins);
      setTimeLeft(startSecs);
    }

    completedEndTimeRef.current = null;
    setEndTime(Date.now() + startSecs * 1000);
    setIsRunning(true);
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    if (next) {
      getAudioContext();
    }
  };

  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (minimized) {
    const pillLabel = isRunning
      ? (mode === 'shortBreak' || mode === 'longBreak' ? 'Break' : 'Focus')
      : 'Study Timer';

    return (
      <button
        onClick={() => setMinimized(false)}
        title="Open Study Timer"
        aria-label={`Open Study Timer (${pillLabel} ${formatTime(timeLeft)})`}
        className="fixed bottom-24 lg:bottom-6 right-4 lg:right-6 z-40 bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-3.5 py-2.5 rounded-full shadow-lg flex items-center gap-2 border border-blue-500/30 transition transform hover:scale-105"
      >
        <Timer className={`w-4 h-4 shrink-0 ${isRunning ? 'animate-pulse' : ''}`} />
        <span className="text-xs font-semibold tracking-tight whitespace-nowrap">{pillLabel}</span>
        <span className="text-blue-200/70 text-xs">•</span>
        <span className="font-mono font-bold text-xs sm:text-sm tabular-nums">{formatTime(timeLeft)}</span>
      </button>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`fixed bottom-24 lg:bottom-6 right-4 lg:right-6 z-40 rounded-2xl shadow-2xl p-5 w-80 sm:w-[340px] animate-slide-up border ${isDark ? 'bg-[#1F1F2A] border-white/10 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}
    >
      <div className={`flex items-center justify-between border-b pb-3 mb-4 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
        <div className={`flex items-center gap-2 font-bold text-sm ${isDark ? 'text-blue-400' : 'text-[#2563EB]'}`}>
          <Timer className="w-4 h-4" /> ElimuPap Study Timer
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleSound}
            className={`p-1.5 rounded-lg transition ${soundOn ? (isDark ? 'text-[#2563EB] hover:bg-blue-500/10' : 'text-[#2563EB] hover:bg-blue-50') : (isDark ? 'text-slate-500 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100')}`}
            title={soundOn ? 'Mute Alarm Sound' : 'Enable Alarm Sound'}
          >
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setMinimized(true)}
            className={`p-1.5 rounded-lg transition ${isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}
            title="Minimize Timer"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Completion Alert Banner */}
      {completionMessage && (
        <div className={`mb-3 p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
          isDark ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          <span className="font-medium">🔔 {completionMessage}</span>
          <button
            type="button"
            onClick={() => setCompletionMessage('')}
            className="text-[11px] font-bold opacity-75 hover:opacity-100 px-1"
            aria-label="Dismiss timer alert"
          >
            ✕
          </button>
        </div>
      )}

      {/* Modes */}
      <div className={`grid grid-cols-4 border p-1 rounded-xl mb-3 text-[11px] font-semibold text-center gap-1 ${isDark ? 'bg-[#11111a] border-white/5' : 'bg-[#f8fafc] border-slate-200'}`}>
        <button
          onClick={() => switchMode('focus')}
          className={`py-1.5 rounded-lg transition ${mode === 'focus' ? 'bg-[#2563EB] text-white shadow-sm' : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900')}`}
        >
          25m
        </button>
        <button
          onClick={() => switchMode('shortBreak')}
          className={`py-1.5 rounded-lg transition ${mode === 'shortBreak' ? 'bg-cyan-600 text-white shadow-sm' : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900')}`}
        >
          5m
        </button>
        <button
          onClick={() => switchMode('longBreak')}
          className={`py-1.5 rounded-lg transition ${mode === 'longBreak' ? 'bg-emerald-600 text-white shadow-sm' : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900')}`}
        >
          15m
        </button>
        <button
          onClick={() => switchMode('custom')}
          className={`py-1.5 rounded-lg transition ${mode === 'custom' ? 'bg-[#2563EB] text-white shadow-sm' : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900')}`}
        >
          Custom
        </button>
      </div>

      {/* Custom Time Input */}
      {mode === 'custom' && (
        <div className={`mb-3 p-2.5 rounded-xl border ${isDark ? 'bg-[#11111a] border-white/5' : 'bg-[#f8fafc] border-slate-200'}`}>
          <form onSubmit={handleCustomSubmit} className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="360"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Enter minutes (1–360)"
              className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-mono border focus:outline-none focus:ring-1 focus:ring-[#2563EB] ${
                isDark ? 'bg-[#1F1F2A] border-[#2d2d4a] text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
              }`}
            />
            <span className="text-[11px] text-slate-500 flex-shrink-0">min</span>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white flex-shrink-0 transition"
            >
              Set
            </button>
          </form>
        </div>
      )}

      {/* Timer Display */}
      <div className="text-center py-3">
        <div className={`font-mono text-4xl sm:text-5xl font-extrabold tracking-tight mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {formatTime(timeLeft)}
        </div>
        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {mode === 'focus' || mode === 'custom'
            ? `🎯 Stay focused (${sessionMinutes} min session)`
            : '☕ Relax & rest your mind'}
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 mt-2">
        <button
          onClick={toggleRun}
          className={`px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition shadow-sm ${
            isRunning ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white'
          }`}
        >
          {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {isRunning ? 'Pause' : mode === 'shortBreak' || mode === 'longBreak' ? 'Start Break' : 'Start Focus'}
        </button>
        <button
          onClick={resetTimer}
          className={`p-2.5 rounded-xl border transition ${isDark ? 'bg-[#11111a] border-white/10 hover:bg-white/5 text-slate-300' : 'bg-[#f8fafc] border-slate-200 hover:bg-slate-100 text-slate-600'}`}
          title="Reset Timer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
