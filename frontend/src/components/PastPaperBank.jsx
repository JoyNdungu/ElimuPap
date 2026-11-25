import React, { useState, useEffect } from 'react';
import { BookOpen, Upload, Loader2, Sparkles } from './Icons';
import api from '../api/axios';

export default function PastPaperBank() {
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [showAnswers, setShowAnswers] = useState({});

  const [unitCode, setUnitCode] = useState('ICS 2404');
  const [year, setYear] = useState('2024');
  const [file, setFile] = useState(null);

  const fetchPastPapers = async () => {
    try {
      const res = await api.get('/ai/past-papers');
      setPapers(res.data || []);
      if (res.data?.length > 0 && !selectedPaper) {
        setSelectedPaper(res.data[0]);
      }
    } catch (err) {
      console.error("Failed to load past papers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPastPapers();
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('unit_code', unitCode.toUpperCase());
    formData.append('year', year);

    try {
      const res = await api.post('/ai/past-papers/extract', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFile(null);
      setSelectedPaper(res.data);
      fetchPastPapers();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to parse past paper");
    } finally {
      setUploading(false);
    }
  };

  const toggleAnswer = (idx) => {
    setShowAnswers((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="bg-[#13131f] border border-[rgba(255,255,255,0.05)] rounded-3xl p-6 shadow-2xl space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[rgba(255,255,255,0.05)] pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-[#5B57FF]/10 text-[#a5a3ff] border border-[#5B57FF]/20">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">Past Paper & Question Bank</h3>

          </div>
        </div>
      </div>

      {/* Upload Past Paper Section */}
      <form onSubmit={handleUpload} className="p-4 bg-[#1F1F2A] rounded-2xl border border-[rgba(255,255,255,0.05)] space-y-3">
        <div className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
          <Upload className="w-3.5 h-3.5 text-[#a5a3ff]" /> Upload New Past Paper (PDF / Image)
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Unit Code (e.g. ICS 2404)"
            value={unitCode}
            onChange={(e) => setUnitCode(e.target.value)}
            className="bg-[#11111a] border border-[#2d2d4a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#5B57FF]"
          />
          <input
            type="text"
            placeholder="Year (e.g. 2024)"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="bg-[#11111a] border border-[#2d2d4a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#5B57FF]"
          />
          <input
            type="file"
            onChange={(e) => setFile(e.target.files[0])}
            className="bg-[#11111a] border border-[#2d2d4a] rounded-xl px-2 py-1.5 text-xs text-gray-400 file:bg-[#2b2b36] file:text-white file:border-0 file:rounded-lg file:px-2 file:py-1 file:mr-2"
          />
        </div>
        <button
          type="submit"
          disabled={uploading || !file}
          className="w-full py-2.5 rounded-xl bg-[#5B57FF] hover:bg-[#7571ff] disabled:opacity-50 text-white font-semibold text-xs transition flex items-center justify-center gap-2 shadow-lg"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {uploading ? 'Extracting Exam Questions ' : 'Extract Questions'}
        </button>
      </form>

      {/* Papers Selector & Questions Display */}
      {loading ? (
        <div className="text-center py-6 text-gray-500 text-xs">Loading Question Bank...</div>
      ) : papers.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-[rgba(255,255,255,0.05)] rounded-2xl text-xs text-gray-500">
          No past papers uploaded yet. Upload a past paper above to build your question bank!
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {papers.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPaper(p)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex-shrink-0 transition border ${selectedPaper?.id === p.id
                  ? 'bg-[#1F1F2A] text-white border-[rgba(91,87,255,0.3)]'
                  : 'bg-transparent text-gray-400 border-transparent hover:bg-[rgba(255,255,255,0.05)]'
                  }`}
              >
                {p.unit_code} ({p.year})
              </button>
            ))}
          </div>

          {selectedPaper && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Questions in {selectedPaper.unit_code} ({selectedPaper.year})
              </h4>
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {selectedPaper.questions?.map((q, idx) => (
                  <div key={idx} className="p-4 bg-[#11111a] rounded-2xl border border-[rgba(255,255,255,0.05)] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#a5a3ff] font-mono">{q.question_number}</span>
                      <span className="bg-[#2b2b36] text-gray-400 px-2 py-0.5 rounded text-[10px] font-mono">
                        {q.marks || 5} marks
                      </span>
                    </div>
                    <div className="text-sm font-medium text-white">{q.question_text}</div>

                    <button
                      onClick={() => toggleAnswer(idx)}
                      className="text-xs text-[#a5a3ff] hover:text-white font-semibold transition flex items-center gap-1 pt-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {showAnswers[idx] ? 'Hide Answer' : 'Show Answer'}
                    </button>

                    {showAnswers[idx] && (
                      <div className="p-3 bg-[#1F1F2A] border border-[rgba(91,87,255,0.3)] rounded-xl text-xs text-gray-300 mt-2 animate-fade-in">
                        <div className="font-bold mb-1 text-[#a5a3ff]">Suggested Mark Scheme / Answer:</div>
                        {q.sample_answer}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
