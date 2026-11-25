import React, { useState, useEffect } from 'react';
import { Share2, RefreshCw, FileText } from './Icons';
import api from '../api/axios';

export default function KnowledgeGraphView() {
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);

  const fetchGraph = async () => {
    setLoading(true);
    try {
      const res = await api.get('/ai/knowledge-graph');
      setGraphData(res.data || { nodes: [], edges: [] });
    } catch (err) {
      console.error("Failed to load Knowledge Graph:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, []);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-sm">AI Concept Knowledge Graph</h3>
            <p className="text-xs text-slate-400">Cross-unit concept maps and topic links</p>
          </div>
        </div>
        <button
          onClick={fetchGraph}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Map
        </button>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-slate-500 text-xs gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" /> Building graph network...
        </div>
      ) : graphData.nodes.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-2xl">
          <Share2 className="w-8 h-8 text-slate-600 mb-2" />
          <p className="text-xs text-slate-400">Upload notes across units to visualize AI concept connections.</p>
        </div>
      ) : (
        <div>
          {/* Visual Node Grid Map */}
          <div className="p-6 bg-slate-950/60 rounded-2xl border border-slate-800/80 min-h-[300px] relative flex flex-wrap items-center justify-center gap-6">
            {graphData.nodes.map((node, idx) => (
              <div
                key={node.id || idx}
                className={`p-4 rounded-2xl border shadow-lg transition transform hover:scale-105 max-w-[200px] ${
                  node.type === 'concept'
                    ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200'
                    : 'bg-purple-950/40 border-purple-500/40 text-purple-200'
                }`}
              >
                <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider mb-1 opacity-80">
                  {node.type === 'concept' ? <Share2 className="w-3 h-3 text-cyan-400" /> : <FileText className="w-3 h-3 text-purple-400" />}
                  {node.unit_code || 'General'}
                </div>
                <div className="font-bold text-xs truncate">{node.label}</div>
              </div>
            ))}
          </div>

          {/* Relationship Edges Summary */}
          {graphData.edges?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-800">
              <div className="text-xs font-semibold text-slate-400 mb-2">Connected Relations</div>
              <div className="flex flex-wrap gap-2">
                {graphData.edges.map((edge, i) => (
                  <span key={i} className="text-[11px] bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700">
                    <span className="text-cyan-400 font-semibold">{edge.source}</span>
                    <span className="text-slate-500 mx-1">→ ({edge.relation}) →</span>
                    <span className="text-purple-400 font-semibold">{edge.target}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
