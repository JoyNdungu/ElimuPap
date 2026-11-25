import React, { useState, useEffect } from 'react';
import { Layers, Check, X, RefreshCw } from './Icons';
import api from '../api/axios';

export default function SpacedRepetitionModal({ isOpen, onClose }) {
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);

  const fetchDueCards = async () => {
    setLoading(true);
    try {
      const res = await api.get('/ai/srs/due');
      setCards(res.data || []);
      setCurrentIndex(0);
      setFlipped(false);
      setFinished(false);
    } catch (err) {
      console.error("Failed to fetch due SRS cards:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDueCards();
    }
  }, [isOpen]);

  const handleRating = async (ratingValue) => {
    const card = cards[currentIndex];
    try {
      await api.post('/ai/srs/review', {
        card_id: card.id,
        rating: ratingValue
      });

      // Also log study activity
      api.post('/progress/activity', {
        type: 'flashcards_reviewed',
        unit_code: card.unit_code
      }).catch(err => console.error(err));

      if (currentIndex + 1 < cards.length) {
        setCurrentIndex((prev) => prev + 1);
        setFlipped(false);
      } else {
        setFinished(true);
      }
    } catch (err) {
      console.error("Rating submission error:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-xl shadow-2xl relative flex flex-col min-h-[420px]">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">Spaced Repetition Deck</h3>
              <p className="text-xs text-slate-400">SM-2 Algorithm Review Session</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
            Preparing your SRS study cards...
          </div>
        ) : finished || cards.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Check className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-slate-100">All Due Cards Reviewed!</h4>
              <p className="text-xs text-slate-400 max-w-xs mt-1">
                You've completed your spaced repetition session for today. Great job boosting long-term memory!
              </p>
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition"
            >
              Done & Return
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-between">
            {/* Card Progress */}
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-mono bg-slate-800 px-2.5 py-1 rounded-md">
                Card {currentIndex + 1} of {cards.length}
              </span>
              <span className="font-mono text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20">
                {cards[currentIndex].unit_code || 'General'}
              </span>
            </div>

            {/* Flip Card Container */}
            <div
              onClick={() => setFlipped(!flipped)}
              className="my-4 p-8 bg-slate-800/60 hover:bg-slate-800 rounded-2xl border border-slate-700/80 cursor-pointer min-h-[200px] flex flex-col items-center justify-center text-center transition shadow-inner group"
            >
              {!flipped ? (
                <div>
                  <div className="text-xs uppercase tracking-wider font-semibold text-purple-400 mb-3">
                    Question (Click to reveal answer)
                  </div>
                  <div className="text-base sm:text-lg font-semibold text-slate-100">
                    {cards[currentIndex].front}
                  </div>
                </div>
              ) : (
                <div className="animate-fade-in">
                  <div className="text-xs uppercase tracking-wider font-semibold text-emerald-400 mb-3">
                    Answer
                  </div>
                  <div className="text-base sm:text-lg font-medium text-slate-200">
                    {cards[currentIndex].back}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Rating Controls */}
            {flipped ? (
              <div className="space-y-2">
                <div className="text-center text-xs text-slate-400 font-medium">How well did you recall this answer?</div>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => handleRating(1)}
                    className="py-2.5 px-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-xl text-xs font-bold border border-rose-500/30 transition"
                  >
                    Again (1d)
                  </button>
                  <button
                    onClick={() => handleRating(2)}
                    className="py-2.5 px-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-xl text-xs font-bold border border-amber-500/30 transition"
                  >
                    Hard (2d)
                  </button>
                  <button
                    onClick={() => handleRating(3)}
                    className="py-2.5 px-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded-xl text-xs font-bold border border-cyan-500/30 transition"
                  >
                    Good (4d)
                  </button>
                  <button
                    onClick={() => handleRating(4)}
                    className="py-2.5 px-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold border border-emerald-500/30 transition"
                  >
                    Easy (7d)
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-2 text-xs text-slate-500 italic">
                Tap card to reveal answer
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
