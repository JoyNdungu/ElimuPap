import React, { useState, useEffect } from 'react';
import { Search, FileText, BookOpen, Layers, X, ArrowRight, Loader2 } from './Icons';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

export default function GlobalSearchModal({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ notes: [], units: [], quizzes: [], flashcards: [] });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Open handled by parent or trigger
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ notes: [], units: [], quizzes: [], flashcards: [] });
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(`/api/search?q=${encodeURIComponent(query.trim())}`);
        setResults(res.data || { notes: [], units: [], quizzes: [], flashcards: [] });
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const totalResults =
    (results.notes?.length || 0) +
    (results.units?.length || 0) +
    (results.quizzes?.length || 0) +
    (results.flashcards?.length || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Header */}
        <div className="flex items-center px-4 py-3 border-b border-slate-800 gap-3">
          <Search className="w-5 h-5 text-purple-400 flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes, topics, units, flashcards, or quizzes... (ESC to close)"
            className="w-full bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-base font-medium"
            autoFocus
          />
          {loading && <Loader2 className="w-5 h-5 text-purple-400 animate-spin flex-shrink-0" />}
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results Container */}
        <div className="p-4 overflow-y-auto space-y-6 flex-1">
          {!query.trim() && (
            <div className="text-center py-10 text-slate-500 text-sm">
              Type anything to search across all your uploaded notes, units, and quizzes.
            </div>
          )}

          {query.trim() && totalResults === 0 && !loading && (
            <div className="text-center py-10 text-slate-500 text-sm">
              No matching results found for "{query}".
            </div>
          )}

          {/* Notes Results */}
          {results.notes?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-400 mb-2">
                <FileText className="w-4 h-4" /> Notes ({results.notes.length})
              </div>
              <div className="space-y-2">
                {results.notes.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => {
                      onClose();
                      navigate(`/notes/${note.id}`);
                    }}
                    className="p-3 bg-slate-800/50 hover:bg-slate-800 rounded-xl cursor-pointer transition border border-slate-800/80 hover:border-purple-500/30 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200 group-hover:text-purple-300 transition">
                        {note.title}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 font-mono">
                        {note.unit_code || note.topic}
                      </span>
                    </div>
                    {note.snippet && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{note.snippet}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Units Results */}
          {results.units?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-2">
                <BookOpen className="w-4 h-4" /> Units ({results.units.length})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {results.units.map((unit) => (
                  <div
                    key={unit.id}
                    onClick={() => {
                      onClose();
                      navigate(`/units/${unit.code}`);
                    }}
                    className="p-3 bg-slate-800/50 hover:bg-slate-800 rounded-xl cursor-pointer transition border border-slate-800 hover:border-cyan-500/30 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-slate-200 text-sm">{unit.code}</div>
                      <div className="text-xs text-slate-400 truncate">{unit.title}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-cyan-400" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Flashcards Results */}
          {results.flashcards?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400 mb-2">
                <Layers className="w-4 h-4" /> Flashcards ({results.flashcards.length})
              </div>
              <div className="space-y-2">
                {results.flashcards.map((fc) => (
                  <div
                    key={fc.id}
                    className="p-3 bg-slate-800/50 rounded-xl border border-slate-800 text-xs"
                  >
                    <div className="font-semibold text-amber-300">Q: {fc.front}</div>
                    <div className="text-slate-300 mt-1">A: {fc.back}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
