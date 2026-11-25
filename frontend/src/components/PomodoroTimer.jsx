import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Minimize2, Timer } from './Icons';
import { useTheme } from '../context/ThemeContext';
import api from '../api/axios';

const MODE_TIMES = {
  focus: 25,
  shortBreak: 5,
  longBreak: 15,
};

export default function PomodoroTimer() {
  const { isDark } = useTheme();
  const [mode, setMode] = useState('focus'); // 'focus' | 'shortBreak' | 'longBreak' | 'custom'
  const [customMinutes, setCustomMinutes] = useState(45);
  const [customInput, setCustomInput] = useState('45');
  const [sessionMinutes, setSessionMinutes] = useState(25);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [minimized, setMinimized] = useState(true);

  useEffect(() => {
    if (!isRunning) return undefined;

    if (timeLeft <= 0) {
      setIsRunning(false);
      // Log completed study session (focus or custom) with the actual duration
      if (mode === 'focus' || mode === 'custom') {
        api.post('/progress/activity', {
          type: 'time_spent',
          duration_minutes: sessionMinutes,
          metadata: { source: 'pomodoro_timer', mode }
        }).catch(err => console.error("Logged pomodoro error:", err));
      }
      alert(
        mode === 'focus' || mode === 'custom'
          ? `Study session (${sessionMinutes} min) complete! Take a break.`
          : 'Break over! Ready to focus?'
      );
      return undefined;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, timeLeft, mode, sessionMinutes]);

  const switchMode = (newMode) => {
    const mins = newMode === 'custom' ? customMinutes : MODE_TIMES[newMode];
    setMode(newMode);
    setSessionMinutes(mins);
    setTimeLeft(mins * 60);
    setIsRunning(false);
  };

  const applyCustomMinutes = (rawMins) => {
    const parsed = Math.max(1, Math.min(360, Math.round(Number(rawMins) || 0)));
    setCustomMinutes(parsed);
    setCustomInput(String(parsed));
    setMode('custom');
    setSessionMinutes(parsed);
    setTimeLeft(parsed * 60);
    setIsRunning(false);
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    applyCustomMinutes(customInput);
  };

  const resetTimer = () => {
    const mins = mode === 'custom' ? customMinutes : MODE_TIMES[mode];
    setSessionMinutes(mins);
    setTimeLeft(mins * 60);
    setIsRunning(false);
  };

  const toggleSound = () => {
    setSoundOn(!soundOn);
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
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-6 right-6 z-40 bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-3 rounded-full shadow-lg flex items-center gap-2 border border-blue-500/30 transition transform hover:scale-105"
      >
        <Timer className="w-5 h-5 animate-pulse" />
        <span className="font-mono font-bold text-sm">{formatTime(timeLeft)}</span>
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 z-40 rounded-2xl shadow-2xl p-5 w-80 sm:w-[340px] animate-slide-up border ${isDark ? 'bg-[#1F1F2A] border-white/10 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}>
      <div className={`flex items-center justify-between border-b pb-3 mb-4 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
        <div className={`flex items-center gap-2 font-bold text-sm ${isDark ? 'text-blue-400' : 'text-[#2563EB]'}`}>
          <Timer className="w-4 h-4" /> ElimuPap Study Timer
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleSound}
            className={`p-1.5 rounded-lg transition ${soundOn ? (isDark ? 'text-[#2563EB] hover:bg-blue-500/10' : 'text-[#2563EB] hover:bg-blue-50') : (isDark ? 'text-slate-500 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100')}`}
            title="Toggle Ambient Audio"
          >
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setMinimized(true)}
            className={`p-1.5 rounded-lg transition ${isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

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

      {/* Custom Time Input + Quick Extended Presets */}
      {mode === 'custom' && (
        <div className={`mb-3 p-2.5 rounded-xl border ${isDark ? 'bg-[#11111a] border-white/5' : 'bg-[#f8fafc] border-slate-200'}`}>
          <form onSubmit={handleCustomSubmit} className="flex items-center gap-2 mb-2">
            <input
              type="number"
              min="1"
              max="360"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Minutes"
              className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-mono border focus:outline-none focus:ring-1 focus:ring-[#2563EB] ${
                isDark ? 'bg-[#1F1F2A] border-[#2d2d4a] text-white' : 'bg-white border-slate-200 text-slate-900'
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
          <div className="flex items-center gap-1.5">
            {[45, 60, 90, 120].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => applyCustomMinutes(mins)}
                className={`flex-1 py-1 rounded-md text-[10px] font-mono font-semibold border transition ${
                  customMinutes === mins
                    ? 'bg-[#2563EB]/15 text-[#2563EB] border-[#2563EB]/40'
                    : (isDark ? 'bg-[#1F1F2A] text-slate-400 border-white/5 hover:text-white' : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900')
                }`}
              >
                {mins}m
              </button>
            ))}
          </div>
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
          onClick={() => {
            if (timeLeft === 0) resetTimer();
            setIsRunning((r) => !r);
          }}
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
