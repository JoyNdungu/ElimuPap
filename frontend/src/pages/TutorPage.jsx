import React, { useState, useRef, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import { useLocation } from 'react-router-dom';
import api from '../api/axios';
import ReactMarkdown from 'react-markdown';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

function createConversationId() {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function deriveConversationTitle(msgs, note) {
  const firstUser = msgs.find(m => m.role === 'user' && m.content?.trim());
  if (firstUser) {
    const clean = firstUser.content.trim().replace(/\s+/g, ' ');
    return clean.length > 52 ? `${clean.slice(0, 52)}…` : clean;
  }
  return note?.title || 'Tutor Session';
}

function formatChatTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Left Panel: Notes Context + Conversation History ──────────────────────────
function TutorLeftPanel({
  activeTab,
  setActiveTab,
  activeNoteId,
  onSelectNote,
  conversations,
  activeConvId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  loadingHistory,
}) {
  const { isDark } = useTheme();
  const [notes, setNotes]       = useState([]);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(true);
  const [openUnits, setOpenUnits] = useState({});

  useEffect(() => {
    const token = localStorage.getItem('elimupap_token');
    api.get('/notes', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        setNotes(r.data || []);
        const units = [...new Set((r.data || []).map(n => n.unit_code || 'Other'))];
        setOpenUnits(Object.fromEntries(units.map(u => [u, true])));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const activeNote = notes.find(n => n.id === activeNoteId);

  const filtered = notes.filter(n =>
    !search ||
    n.title?.toLowerCase().includes(search.toLowerCase()) ||
    n.unit_code?.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filtered.reduce((acc, n) => {
    const key = n.unit_code || 'Other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(n);
    return acc;
  }, {});

  const toggleUnit = (unit) =>
    setOpenUnits(prev => ({ ...prev, [unit]: !prev[unit] }));

  return (
    <div
      className="flex flex-col h-full transition-colors"
      style={{ backgroundColor: isDark ? '#13131f' : '#ffffff' }}
    >
      {/* Top Tab Switcher: Notes vs History */}
      <div className={`px-3 pt-3 pb-2.5 border-b ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
        <div className={`grid grid-cols-2 p-1 rounded-xl border ${isDark ? 'bg-[#1a1a2e] border-white/5' : 'bg-[#f8fafc] border-slate-200'}`}>
          <button
            onClick={() => setActiveTab('notes')}
            className={`py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'notes'
                ? 'bg-[#2563EB] text-white shadow-sm'
                : (isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
            }`}
          >
            <span>📚</span>
            <span>Notes</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-[#2563EB] text-white shadow-sm'
                : (isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
            }`}
          >
            <span>💬</span>
            <span>History</span>
            {conversations.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono ${
                activeTab === 'history'
                  ? 'bg-white/20 text-white'
                  : (isDark ? 'bg-white/10 text-gray-300' : 'bg-slate-200 text-slate-700')
              }`}>
                {conversations.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'notes' ? (
        <>
          {/* Active note chip */}
          <div className={`px-3.5 pt-3 pb-3 border-b ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${isDark ? 'text-blue-400/80' : 'text-[#2563EB]'}`}>
              Active Study Context
            </p>
            {activeNote ? (
              <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border ${
                isDark ? 'bg-[#2563EB]/15 border-[#2563EB]/30' : 'bg-blue-50 border-blue-200'
              }`}>
                <div className="min-w-0">
                  <p className={`text-[11px] font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{activeNote.title}</p>
                  <p className={`text-[10px] font-mono mt-0.5 ${isDark ? 'text-blue-300' : 'text-[#1D4ED8]'}`}>{activeNote.unit_code || 'General'}</p>
                </div>
                <button
                  onClick={() => onSelectNote(null)}
                  className={`p-1 rounded text-xs transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-blue-100'}`}
                  title="Clear context"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className={`px-2.5 py-1.5 rounded-lg border border-dashed ${
                isDark ? 'bg-white/5 border-white/10' : 'bg-[#f8fafc] border-slate-300'
              }`}>
                <p className={`text-[11px] ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>No note selected (General Mode)</p>
              </div>
            )}

            {/* Search */}
            <div className="relative mt-3">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                placeholder="Search notes & units…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={`w-full pl-8 pr-2.5 py-1.5 rounded-xl text-[11px] border focus:outline-none focus:ring-1 focus:ring-[#2563EB] ${
                  isDark
                    ? 'text-white bg-[#1a1a2e] border-white/10 placeholder:text-gray-500'
                    : 'text-slate-900 bg-[#f8fafc] border-slate-200 placeholder:text-slate-400'
                }`}
              />
            </div>
          </div>

          {/* Grouped list */}
          <div className="flex-1 overflow-y-auto py-2 px-1">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className={`w-5 h-5 rounded-full border-2 border-t-[#2563EB] animate-spin ${isDark ? 'border-[#2b2b36]' : 'border-slate-200'}`} />
              </div>
            ) : Object.keys(grouped).length === 0 ? (
              <p className="text-center text-[11px] text-slate-500 py-8">No notes found</p>
            ) : (
              Object.entries(grouped).map(([unit, unitNotes]) => (
                <div key={unit} className="mb-2">
                  <button
                    onClick={() => toggleUnit(unit)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors ${
                      isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded font-mono ${
                        isDark ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-50 text-[#2563EB] border border-blue-100'
                      }`}>
                        {unit}
                      </span>
                      <span className="text-[11px] text-slate-500">({unitNotes.length})</span>
                    </div>
                    <svg className={`w-3.5 h-3.5 text-slate-400 transform transition-transform ${openUnits[unit] ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {openUnits[unit] && (
                    <div className="space-y-1 mt-1 pl-2">
                      {unitNotes.map(n => {
                        const isSelected = n.id === activeNoteId;
                        const isAudio = n.file_type === 'audio_lecture';

                        return (
                          <button
                            key={n.id}
                            onClick={() => onSelectNote(n)}
                            className={`w-full text-left px-2.5 py-2 rounded-xl text-xs transition-all flex items-center gap-2 ${
                              isSelected
                                ? 'bg-[#2563EB] text-white font-medium shadow-sm'
                                : isDark
                                ? 'text-gray-300 hover:bg-white/5 hover:text-white'
                                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                          >
                            <span className="text-xs">{isAudio ? '🎙️' : '📄'}</span>
                            <span className="truncate flex-1">{n.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        /* ── History Tab ── */
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className={`px-3.5 pt-3 pb-3 border-b ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
            <button
              onClick={onNewChat}
              className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors flex items-center justify-center gap-1.5 shadow-sm"
            >
              <span>+</span>
              <span>New Conversation</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {loadingHistory && conversations.length === 0 ? (
              <div className="flex justify-center py-8">
                <div className={`w-5 h-5 rounded-full border-2 border-t-[#2563EB] animate-spin ${isDark ? 'border-[#2b2b36]' : 'border-slate-200'}`} />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-10 px-3">
                <p className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>No saved chats yet</p>
                <p className="text-[11px] text-slate-500">Your tutor conversations are saved automatically so you can revisit them anytime.</p>
              </div>
            ) : (
              conversations.map(conv => {
                const isSelected = conv.id === activeConvId;
                const msgCount = conv.messages?.length || 0;
                return (
                  <div
                    key={conv.id}
                    onClick={() => onSelectConversation(conv)}
                    className={`group relative rounded-xl p-2.5 cursor-pointer border transition-all ${
                      isSelected
                        ? (isDark ? 'bg-[#2563EB]/15 border-[#2563EB]/40' : 'bg-blue-50 border-blue-200')
                        : (isDark ? 'bg-transparent border-transparent hover:bg-white/5' : 'bg-transparent border-transparent hover:bg-slate-100')
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-xs font-semibold line-clamp-2 leading-snug pr-4 ${
                        isSelected
                          ? (isDark ? 'text-white' : 'text-[#1E3A8A]')
                          : (isDark ? 'text-gray-200' : 'text-slate-800')
                      }`}>
                        {conv.title || 'Tutor Session'}
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(conv.id);
                        }}
                        title="Delete conversation"
                        className={`opacity-100 lg:opacity-0 lg:group-hover:opacity-100 p-1.5 rounded-md text-[10px] transition ${
                          isDark ? 'text-gray-400 hover:text-rose-400 hover:bg-white/10' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                        }`}
                      >
                        ✕
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1.5 text-[10px]">
                      <span className={`truncate font-mono ${isDark ? 'text-blue-300/80' : 'text-[#2563EB]'}`}>
                        {conv.unit_code || conv.note_title || 'General'}
                      </span>
                      <span className="text-slate-500 flex-shrink-0">
                        {msgCount} msg{msgCount === 1 ? '' : 's'} · {formatChatTime(conv.updated_at)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Tutor Page Component ────────────────────────────────────────────────
export default function TutorPage() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const location = useLocation();
  const params   = new URLSearchParams(location.search);
  const urlNoteId = params.get('note_id');

  // Resolve stable per-user storage keys synchronously so reloads restore immediately
  const cachedUser = (() => {
    try { return JSON.parse(localStorage.getItem('elimupap_user') || 'null'); } catch { return null; }
  })();
  const userKey    = user?.id || user?.email || cachedUser?.id || cachedUser?.email || 'anon';
  const CHATS_KEY  = `elimupap_tutor_chats_${userKey}`;
  const ACTIVE_KEY = `elimupap_tutor_active_${userKey}`;

  const readLocalConversations = useCallback(() => {
    try {
      const raw = localStorage.getItem(CHATS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [CHATS_KEY]);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
  const [leftTab, setLeftTab]               = useState('notes'); // 'notes' | 'history'
  const [conversations, setConversations]   = useState(() => readLocalConversations());
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Determine initial active conversation on load / reload
  const initialSession = (() => {
    const localList = readLocalConversations();
    const savedActiveId = localStorage.getItem(ACTIVE_KEY);

    if (urlNoteId) {
      const matchingActive = localList.find(c => c.id === savedActiveId && c.note_id === urlNoteId);
      const latestForNote = matchingActive || localList.find(c => c.note_id === urlNoteId);
      if (latestForNote) return latestForNote;
      return null;
    }

    if (savedActiveId === '__new__') return null;
    if (savedActiveId) {
      const found = localList.find(c => c.id === savedActiveId);
      if (found) return found;
    }
    return localList[0] || null;
  })();

  const [activeConvId, setActiveConvId] = useState(() => initialSession?.id || createConversationId());
  const [activeNote, setActiveNote] = useState(() =>
    initialSession?.note_id
      ? {
          id: initialSession.note_id,
          title: initialSession.note_title || 'Selected Note',
          unit_code: initialSession.unit_code || 'General',
        }
      : null
  );
  const [panelOpen, setPanelOpen]   = useState(!urlNoteId && !isMobile);

  // Tutor Modes: 'tutor' | 'exam_drill' | 'simple_analogy' | 'quiz'
  const [tutorMode, setTutorMode]   = useState(() => initialSession?.mode || 'tutor');
  const [copiedId, setCopiedId]     = useState(null);
  const [messages, setMessages]     = useState(() => initialSession?.messages || []);
  const [input, setInput]           = useState('');
  const [isTyping, setIsTyping]     = useState(false);
  const [showTestMenu, setShowTestMenu] = useState(false);
  const messagesEndRef = useRef(null);
  const testMenuRef    = useRef(null);
  const hasUserInteractedRef = useRef((initialSession?.messages?.length || 0) > 0);

  // Persist a conversation locally and sync to MongoDB Atlas
  const persistConversation = useCallback(
    async (convId, nextMessages, noteObj, modeVal, { syncRemote = true } = {}) => {
      if (!convId) return;
      const hasUserMessage = nextMessages.some(m => m.role === 'user' && m.content?.trim());
      if (!hasUserMessage) return;

      const nowIso = new Date().toISOString();
      const entry = {
        id: convId,
        title: deriveConversationTitle(nextMessages, noteObj),
        note_id: noteObj?.id || null,
        note_title: noteObj?.title || null,
        unit_code: noteObj?.unit_code || null,
        mode: modeVal || 'tutor',
        messages: nextMessages,
        updated_at: nowIso,
      };

      setConversations(prev => {
        const others = prev.filter(c => c.id !== convId);
        const merged = [entry, ...others].slice(0, 40);
        try {
          localStorage.setItem(CHATS_KEY, JSON.stringify(merged));
          localStorage.setItem(ACTIVE_KEY, convId);
        } catch {
          // ignore storage quota errors
        }
        return merged;
      });

      if (syncRemote) {
        try {
          const token = localStorage.getItem('elimupap_token');
          if (token) {
            await api.post('/ai/tutor/conversations', entry, {
              headers: { Authorization: `Bearer ${token}` },
            });
          }
        } catch {
          // Offline or transient error — localStorage copy still intact
        }
      }
    },
    [CHATS_KEY, ACTIVE_KEY]
  );

  // Fetch note context when navigated with ?note_id=...
  useEffect(() => {
    if (urlNoteId) {
      const token = localStorage.getItem('elimupap_token');
      api.get(`/notes/${urlNoteId}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => setActiveNote(r.data))
        .catch(() => {});
    }
  }, [urlNoteId]);

  // Load & merge saved conversations from MongoDB on mount
  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('elimupap_token');
    if (!token) return;

    setLoadingHistory(true);
    api.get('/ai/tutor/conversations', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (cancelled || !Array.isArray(res.data)) return;
        const remote = res.data;
        const local = readLocalConversations();

        // Merge local + remote by id, keeping whichever has more messages or newer timestamp
        const map = new Map();
        [...local, ...remote].forEach(item => {
          if (!item?.id) return;
          const existing = map.get(item.id);
          if (!existing) {
            map.set(item.id, item);
          } else {
            const existingLen = existing.messages?.length || 0;
            const itemLen = item.messages?.length || 0;
            const existingTime = new Date(existing.updated_at || 0).getTime();
            const itemTime = new Date(item.updated_at || 0).getTime();
            if (itemLen > existingLen || (itemLen === existingLen && itemTime > existingTime)) {
              map.set(item.id, item);
            }
          }
        });

        const merged = Array.from(map.values())
          .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
          .slice(0, 40);

        setConversations(merged);
        try {
          localStorage.setItem(CHATS_KEY, JSON.stringify(merged));
        } catch {}

        // If nothing loaded yet from localStorage (e.g. new browser/device), restore latest chat
        const savedActive = localStorage.getItem(ACTIVE_KEY);
        if (!hasUserInteractedRef.current && savedActive !== '__new__' && merged.length > 0) {
          const target = urlNoteId
            ? merged.find(c => c.note_id === urlNoteId)
            : (savedActive ? merged.find(c => c.id === savedActive) : null) || merged[0];

          if (target && target.messages?.length > 0) {
            setActiveConvId(target.id);
            setMessages(target.messages);
            setTutorMode(target.mode || 'tutor');
            if (target.note_id) {
              setActiveNote(prev => prev || {
                id: target.note_id,
                title: target.note_title || 'Selected Note',
                unit_code: target.unit_code || 'General',
              });
            }
            try { localStorage.setItem(ACTIVE_KEY, target.id); } catch {}
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });

    return () => { cancelled = true; };
  }, [CHATS_KEY, ACTIVE_KEY, readLocalConversations, urlNoteId]);

  const handleSelectNote = (note) => {
    setActiveNote(note);
    if (note) {
      const contextMsg = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `🎯 **Context Loaded:** *"__${note.title}__"* (${note.unit_code || 'Course Unit'}).\n\nI am now analyzing this material. Ask me for a summary, an exam breakdown, or test questions whenever you're ready!`
      };
      setMessages(prev => {
        const next = [...prev, contextMsg];
        persistConversation(activeConvId, next, note, tutorMode);
        return next;
      });
    }
  };

  const handleNewChat = () => {
    if (isTyping) return;
    const freshId = createConversationId();
    hasUserInteractedRef.current = false;
    setActiveConvId(freshId);
    setMessages([]);
    try { localStorage.setItem(ACTIVE_KEY, '__new__'); } catch {}
    if (isMobile) setPanelOpen(false);
  };

  const handleSelectConversation = (conv) => {
    if (isTyping) return;
    hasUserInteractedRef.current = true;
    setActiveConvId(conv.id);
    setMessages(conv.messages || []);
    setTutorMode(conv.mode || 'tutor');
    if (conv.note_id) {
      setActiveNote({
        id: conv.note_id,
        title: conv.note_title || 'Selected Note',
        unit_code: conv.unit_code || 'General',
      });
    } else {
      setActiveNote(null);
    }
    try { localStorage.setItem(ACTIVE_KEY, conv.id); } catch {}
    if (isMobile) setPanelOpen(false);
  };

  const handleDeleteConversation = async (convId) => {
    setConversations(prev => {
      const next = prev.filter(c => c.id !== convId);
      try { localStorage.setItem(CHATS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });

    if (convId === activeConvId) {
      const freshId = createConversationId();
      hasUserInteractedRef.current = false;
      setActiveConvId(freshId);
      setMessages([]);
      try { localStorage.setItem(ACTIVE_KEY, '__new__'); } catch {}
    }

    try {
      const token = localStorage.getItem('elimupap_token');
      if (token) {
        await api.delete(`/ai/tutor/conversations/${encodeURIComponent(convId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
      // ignore if offline or already deleted
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (testMenuRef.current && !testMenuRef.current.contains(e.target)) setShowTestMenu(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendPrompt = async (customPrompt) => {
    const textToSend = customPrompt || input;
    if (!textToSend.trim() || isTyping) return;

    hasUserInteractedRef.current = true;
    const convId = activeConvId || createConversationId();
    if (!activeConvId) setActiveConvId(convId);

    const userMsg = { id: Date.now().toString(), role: 'user', content: textToSend };
    const updatedWithUser = [...messages, userMsg];
    setMessages(updatedWithUser);
    setInput('');
    setIsTyping(true);

    // Save immediately with user's prompt so even an early reload keeps it
    persistConversation(convId, updatedWithUser, activeNote, tutorMode, { syncRemote: false });

    try {
      const token = localStorage.getItem('elimupap_token');
      const messagesForApi = updatedWithUser.map(m => ({ role: m.role, content: m.content }));

      const baseUrl = (api.defaults.baseURL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '');
      const response = await fetch(
        `${baseUrl}/ai/tutor`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            note_id: activeNote?.id || null,
            messages: messagesForApi,
            mode: tutorMode
          })
        }
      );

      if (!response.ok) {
        let serverDetail = '';
        try {
          const errData = await response.json();
          serverDetail = errData?.detail || '';
        } catch {
          // ignore non-JSON error body
        }
        throw new Error(serverDetail || `HTTP ${response.status}`);
      }
      setIsTyping(false);

      const aiMsgId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: aiMsgId, role: 'assistant', content: '' }]);

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let aiContent = '';
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value);
          aiContent += chunk;
          setMessages(prev => prev.map(msg => msg.id === aiMsgId ? { ...msg, content: aiContent } : msg));
        }
      }

      const finalMessages = [...updatedWithUser, { id: aiMsgId, role: 'assistant', content: aiContent }];
      await persistConversation(convId, finalMessages, activeNote, tutorMode, { syncRemote: true });
    } catch (err) {
      const detail = err?.message || '';
      const isHttpDetail = detail && !/failed to fetch|load failed|networkerror|network request failed/i.test(detail);
      const errMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: isHttpDetail
          ? `⚠️ Study server error: ${detail}`
          : '⚠️ I had a temporary issue connecting with the study server. Please check your network or try again in a moment!'
      };
      const finalMessages = [...updatedWithUser, errMsg];
      setMessages(finalMessages);
      setIsTyping(false);
      await persistConversation(convId, finalMessages, activeNote, tutorMode, { syncRemote: false });
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    handleSendPrompt(input);
  };

  // Quick Action Starters for Empty State
  const STARTER_CARDS = [
    {
      icon: '💡',
      title: 'Simple Analogy',
      desc: 'Explain core concept in real-world everyday terms',
      prompt: activeNote ? `Explain the core concept in "${activeNote.title}" using a colorful everyday analogy.` : 'Explain a challenging concept using a relatable everyday analogy.'
    },
    {
      icon: '🎯',
      title: 'Exam Drill',
      desc: 'What are the top exam questions professors ask?',
      prompt: activeNote ? `What are the top 3 high-yield exam questions most likely to appear from "${activeNote.title}"?` : 'Give me 3 high-yield exam questions and model marking points for this topic.'
    },
    {
      icon: '⚡',
      title: '5-Minute Crash Course',
      desc: 'High-impact key takeaways & principles',
      prompt: activeNote ? `Give me a high-yield 5-minute crash course on "${activeNote.title}".` : 'Give me a fast 5-minute crash course on the fundamentals.'
    },
    {
      icon: '🎮',
      title: 'Pop Quiz Challenge',
      desc: 'Test knowledge with a turn-by-turn trivia challenge',
      prompt: activeNote ? `Start an interactive pop quiz on "${activeNote.title}". Ask me question #1!` : 'Start a rapid pop quiz to test my active recall. Give me the first question!'
    }
  ];

  return (
    <div
      className="flex flex-col lg:flex-row h-dvh font-sans overflow-hidden transition-colors"
      style={{ backgroundColor: isDark ? '#12121c' : '#f8fafc' }}
    >
      <Sidebar hideMobileHeader={true} />

      {/* ── Desktop Left Panel (Notes & Conversation History) ── */}
      <div
        className="hidden lg:block flex-shrink-0 h-full transition-all duration-300 overflow-hidden"
        style={{
          width: panelOpen ? '250px' : '0px',
          borderRight: panelOpen
            ? `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`
            : 'none',
        }}
      >
        <div className="w-[250px] h-full">
          <TutorLeftPanel
            activeTab={leftTab}
            setActiveTab={setLeftTab}
            activeNoteId={activeNote?.id}
            onSelectNote={handleSelectNote}
            conversations={conversations}
            activeConvId={activeConvId}
            onSelectConversation={handleSelectConversation}
            onNewChat={handleNewChat}
            onDeleteConversation={handleDeleteConversation}
            loadingHistory={loadingHistory}
          />
        </div>
      </div>

      {/* ── Mobile Drawer (Notes & Conversation History) ── */}
      {panelOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-md animate-fade-in"
            onClick={() => setPanelOpen(false)}
          />
          <div
            className={`relative z-10 w-72 max-w-[85vw] h-full shadow-2xl flex flex-col border-r animate-slide-up ${
              isDark ? 'bg-[#13131f] border-white/10' : 'bg-white border-slate-200'
            }`}
          >
            <div className={`flex items-center justify-between p-3.5 border-b ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
              <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Study Context &amp; Chats
              </span>
              <button
                onClick={() => setPanelOpen(false)}
                className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white bg-white/5' : 'text-slate-500 hover:text-slate-900 bg-slate-100'}`}
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <TutorLeftPanel
                activeTab={leftTab}
                setActiveTab={setLeftTab}
                activeNoteId={activeNote?.id}
                onSelectNote={(note) => {
                  handleSelectNote(note);
                  setPanelOpen(false);
                }}
                conversations={conversations}
                activeConvId={activeConvId}
                onSelectConversation={handleSelectConversation}
                onNewChat={handleNewChat}
                onDeleteConversation={handleDeleteConversation}
                loadingHistory={loadingHistory}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Main Chat Column ── */}
      <div
        className="flex-1 flex flex-col h-full overflow-hidden min-w-0 transition-colors"
        style={{ backgroundColor: isDark ? '#12121c' : '#f8fafc' }}
      >

        {/* Top Header & Study Mode Selector */}
        <header
          className={`flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b backdrop-blur-md z-20 transition-colors ${
            isDark ? 'border-white/5' : 'border-slate-200'
          }`}
          style={{ backgroundColor: isDark ? 'rgba(23, 23, 35, 0.92)' : '#ffffff' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setPanelOpen(o => !o)}
              aria-label={panelOpen ? 'Hide notes and chats menu' : 'Open notes and chats menu'}
              title={panelOpen ? 'Hide notes & history menu' : 'Open notes & history menu'}
              className={`flex-shrink-0 px-3 py-2 rounded-xl flex items-center gap-2 text-xs font-semibold transition-all border ${
                isDark
                  ? 'bg-[#2563EB]/20 border-[#2563EB]/40 text-blue-200 hover:bg-[#2563EB]/30 hover:text-white'
                  : 'bg-blue-50 border-blue-200 text-[#1D4ED8] hover:bg-blue-100'
              }`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
              <span className="whitespace-nowrap lg:hidden">{panelOpen ? 'Hide Menu' : 'Notes & Menu'}</span>
              <span className="hidden lg:inline whitespace-nowrap">{panelOpen ? 'Hide Panel' : 'Notes & Chats'}</span>
            </button>

            <div>
              <div className="flex items-center gap-2">
                <h1 className={`font-bold text-sm sm:text-base tracking-tight flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  ElimuPap AI Mentor
                </h1>
                <span className={`hidden md:inline-block text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${
                  isDark ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-blue-50 text-[#2563EB] border-blue-200'
                }`}>
                  Smart Tutor
                </span>
              </div>
              {activeNote && (
                <p className={`text-[11px] truncate max-w-[220px] sm:max-w-xs font-mono ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                  Context: <span className={isDark ? 'text-blue-300' : 'text-[#2563EB]'}>{activeNote.title}</span>
                </p>
              )}
            </div>
          </div>

          {/* Chat Controls */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              onClick={() => {
                setLeftTab('history');
                setPanelOpen(true);
              }}
              title="View past conversations"
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition border flex items-center gap-1 ${
                isDark
                  ? 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                  : 'bg-[#f8fafc] text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>💬</span>
              <span>History</span>
              {conversations.length > 0 && (
                <span className="text-[10px] font-mono opacity-80">({conversations.length})</span>
              )}
            </button>

            {messages.length > 0 && (
              <button
                onClick={handleNewChat}
                title="Start new conversation (current chat stays in History)"
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition border ${
                  isDark
                    ? 'bg-[#2563EB]/15 text-blue-300 border-[#2563EB]/30 hover:bg-[#2563EB]/25'
                    : 'bg-blue-50 text-[#2563EB] border-blue-200 hover:bg-blue-100'
                }`}
              >
                + New Chat
              </button>
            )}
          </div>
        </header>

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
          <div className="max-w-[760px] w-full mx-auto flex flex-col gap-6">

            {/* Empty State / Welcome Hero */}
            {messages.length === 0 && (
              <div className="py-6 animate-fade-in flex flex-col items-center text-center">
                {/* Avatar */}
                <div className="relative mb-4">
                  <div className="w-16 h-16 rounded-3xl flex items-center justify-center shadow-lg bg-[#2563EB] p-0.5">
                    <div
                      className="w-full h-full rounded-[22px] flex items-center justify-center"
                      style={{ backgroundColor: isDark ? '#171723' : '#ffffff' }}
                    >
                      <span className="text-3xl animate-bounce">🎓</span>
                    </div>
                  </div>
                  <span className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500 text-white font-mono shadow">
                    Active
                  </span>
                </div>

                <h2 className={`text-xl sm:text-2xl font-bold mb-2 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Habari! Let's master your coursework.
                </h2>
                <p className={`text-xs sm:text-sm max-w-md mb-8 ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                  {activeNote
                    ? `I'm ready with "${activeNote.title}". Choose a starter prompt below or ask me any question directly.`
                    : 'Select a note from the left panel for syllabus context, or pick an interactive study mode below to begin!'}
                </p>

                {/* 4 Interactive Starter Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl text-left">
                  {STARTER_CARDS.map((card, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendPrompt(card.prompt)}
                      className={`p-4 rounded-2xl border transition-all group flex items-start gap-3.5 shadow-sm ${
                        isDark
                          ? 'bg-[#1F1F2A] border-white/10 hover:border-[#2563EB]/60 hover:bg-[#252536]'
                          : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`text-2xl p-2 rounded-xl group-hover:scale-110 transition-transform ${
                        isDark ? 'bg-white/5' : 'bg-[#f8fafc] border border-slate-200'
                      }`}>
                        {card.icon}
                      </span>
                      <div className="min-w-0">
                        <h4 className={`text-xs font-bold transition-colors mb-0.5 ${
                          isDark ? 'text-white group-hover:text-blue-400' : 'text-slate-900 group-hover:text-[#2563EB]'
                        }`}>
                          {card.title}
                        </h4>
                        <p className={`text-[11px] leading-snug line-clamp-2 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                          {card.desc}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message Bubbles */}
            {messages.map((msg, index) => {
              const isAssistant = msg.role === 'assistant';
              const isLatestAssistant = isAssistant && index === messages.length - 1;

              return (
                <div key={msg.id} className={`flex ${isAssistant ? 'justify-start' : 'justify-end'} animate-fade-in`}>
                  <div className={`flex items-start gap-3 max-w-[92%] sm:max-w-[85%] ${isAssistant ? 'flex-row' : 'flex-row-reverse'}`}>

                    {/* Avatar Icon */}
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                      isAssistant
                        ? 'bg-[#2563EB] text-white'
                        : isDark
                        ? 'bg-white/10 text-gray-300 border border-white/10'
                        : 'bg-slate-200 text-slate-700 border border-slate-300'
                    }`}>
                      {isAssistant ? (
                        <span className="text-xs">✨</span>
                      ) : (
                        <span className="text-xs font-bold">You</span>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 min-w-0 flex-1">
                      {/* Message Card */}
                      <div
                        className={`p-4 sm:p-5 rounded-3xl text-[14px] leading-relaxed shadow-sm relative ${
                          isAssistant
                            ? isDark
                              ? 'bg-[#1F1F2A] border border-white/10 rounded-tl-sm text-gray-200'
                              : 'bg-white border border-slate-200 rounded-tl-sm text-slate-800'
                            : 'bg-[#2563EB] text-white rounded-tr-sm font-medium'
                        }`}
                      >
                        {/* Assistant Header Strip (Badge + Copy Button) */}
                        {isAssistant && (
                          <div className={`flex items-center justify-between pb-2 mb-3 border-b text-xs ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
                            <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 font-mono ${isDark ? 'text-blue-300' : 'text-[#2563EB]'}`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]"></span>
                              ElimuPap Mentor
                            </span>
                            <button
                              onClick={() => handleCopy(msg.id, msg.content)}
                              className={`text-[11px] px-2 py-0.5 rounded-md transition flex items-center gap-1 ${
                                isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                              }`}
                              title="Copy response"
                            >
                              {copiedId === msg.id ? (
                                <span className="text-emerald-500 font-semibold">✓ Copied</span>
                              ) : (
                                <span>Copy</span>
                              )}
                            </button>
                          </div>
                        )}

                        {/* Content Rendering */}
                        {isAssistant ? (
                          <div className={`max-w-none text-[13.5px] sm:text-[14px] ${isDark ? 'prose prose-invert' : 'prose prose-slate'}`}>
                            <ReactMarkdown
                              components={{
                                p:          ({children}) => <p className="mb-3 last:mb-0 text-[13.5px] sm:text-[14px] leading-[1.7]">{children}</p>,
                                strong:     ({children}) => <strong className={`font-bold px-1 py-0.2 rounded ${isDark ? 'text-blue-200 bg-blue-500/10' : 'text-slate-900 bg-blue-50'}`}>{children}</strong>,
                                em:         ({children}) => <em className={`italic ${isDark ? 'text-blue-300' : 'text-[#1D4ED8]'}`}>{children}</em>,
                                h1:         ({children}) => <h1 className={`text-base sm:text-lg font-bold mt-4 mb-2 pb-1 border-b ${isDark ? 'text-white border-white/10' : 'text-slate-900 border-slate-200'}`}>{children}</h1>,
                                h2:         ({children}) => <h2 className={`text-sm sm:text-base font-bold mt-3 mb-2 ${isDark ? 'text-blue-300' : 'text-[#2563EB]'}`}>{children}</h2>,
                                h3:         ({children}) => <h3 className={`text-xs sm:text-sm font-bold mt-2 mb-1 ${isDark ? 'text-blue-200' : 'text-slate-800'}`}>{children}</h3>,
                                ul:         ({children}) => <ul className="space-y-1.5 my-2.5 pl-1">{children}</ul>,
                                ol:         ({children}) => <ol className="list-decimal list-inside space-y-1.5 my-2.5 pl-1">{children}</ol>,
                                li:         ({children}) => (
                                  <li className="flex items-start gap-2 text-[13.5px]">
                                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#2563EB] flex-shrink-0" />
                                    <span>{children}</span>
                                  </li>
                                ),
                                blockquote: ({children}) => (
                                  <blockquote className={`border-l-2 border-[#2563EB] p-3 rounded-r-xl my-3 text-xs sm:text-sm italic ${
                                    isDark ? 'bg-blue-500/5 text-blue-200' : 'bg-blue-50 text-slate-700'
                                  }`}>
                                    {children}
                                  </blockquote>
                                ),
                                code:       ({children}) => <code className={`px-1.5 py-0.5 rounded text-[12px] font-mono ${isDark ? 'bg-white/10 text-blue-300' : 'bg-slate-100 text-[#1D4ED8]'}`}>{children}</code>,
                                pre:        ({children}) => <pre className={`p-3.5 rounded-xl my-3 overflow-x-auto text-[12px] font-mono border ${isDark ? 'bg-[#0e0e17] border-white/10 text-gray-200' : 'bg-slate-900 border-slate-800 text-slate-100'}`}>{children}</pre>,
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap text-white">{msg.content}</p>
                        )}
                      </div>

                      {/* Interactive Quick Follow-Up Chips under the latest Assistant message */}
                      {isLatestAssistant && !isTyping && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-1 animate-fade-in pl-1">
                          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mr-1">Quick Dive:</span>
                          {[
                            { label: '💡 Real Example', prompt: 'Can you give me a real-world everyday example of this?' },
                            { label: '🎯 Exam Trap', prompt: 'What mistake do students commonly make on exams regarding this?' },
                            { label: '📝 Quiz Me', prompt: 'Quiz me on this concept with 1 multiple choice question!' },
                            { label: '🔄 Simpler', prompt: 'Can you explain this in even simpler, plain terms?' },
                          ].map((chip, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleSendPrompt(chip.prompt)}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all shadow-sm ${
                                isDark
                                  ? 'bg-white/5 hover:bg-blue-500/20 text-gray-300 hover:text-blue-200 border-white/10 hover:border-blue-500/40'
                                  : 'bg-white hover:bg-blue-50 text-slate-700 hover:text-[#2563EB] border-slate-200 hover:border-blue-300'
                              }`}
                            >
                              {chip.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex justify-start animate-fade-in">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#2563EB] text-white shadow">
                    <span className="text-xs">✨</span>
                  </div>
                  <div className={`px-5 py-3.5 rounded-2xl rounded-tl-sm flex items-center gap-2 border shadow-sm ${
                    isDark ? 'bg-[#1F1F2A] border-white/10' : 'bg-white border-slate-200'
                  }`}>
                    <span className={`text-xs font-medium font-mono ${isDark ? 'text-blue-300' : 'text-[#2563EB]'}`}>Thinking…</span>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#2563EB] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-[#2563EB] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-[#2563EB] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Bar */}
        <div
          className={`flex-shrink-0 px-4 sm:px-6 pt-3 pb-20 lg:pb-5 border-t backdrop-blur-md transition-colors ${
            isDark ? 'border-white/5' : 'border-slate-200'
          }`}
          style={{ backgroundColor: isDark ? 'rgba(23, 23, 35, 0.92)' : '#ffffff' }}
        >
          <div className="max-w-[760px] mx-auto">
            <form onSubmit={handleFormSubmit} className="relative flex items-center">

              {/* Test Mode Menu Trigger */}
              <div className="absolute left-2.5 z-10" ref={testMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowTestMenu(!showTestMenu)}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all border ${
                    isDark
                      ? 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border-white/5'
                      : 'bg-[#f8fafc] hover:bg-slate-100 text-slate-600 hover:text-slate-900 border-slate-200'
                  }`}
                  title="Study formats"
                >
                  <span className="text-sm">🎲</span>
                </button>

                {showTestMenu && (
                  <div className={`absolute bottom-full left-0 mb-3 w-48 rounded-2xl py-2 shadow-2xl z-30 border animate-slide-up ${
                    isDark ? 'bg-[#1F1F2A] border-white/10' : 'bg-white border-slate-200'
                  }`}>
                    <p className={`text-[10px] font-bold uppercase tracking-widest px-3 pb-2 border-b ${
                      isDark ? 'text-blue-300 border-white/5' : 'text-[#2563EB] border-slate-200'
                    }`}>
                      Interactive Formats:
                    </p>
                    {[
                      { icon: '📝', label: 'Practice Questions', prompt: 'Generate 3 exam practice questions based on this material.' },
                      { icon: '🎮', label: 'Quiz Game', prompt: 'Turn this into an interactive trivia quiz. Ask me question 1!' },
                      { icon: '🗂️', label: 'Flashcards', prompt: 'Extract 4 high-yield flashcard concepts (Front/Back) from this material.' },
                      { icon: '💡', label: 'Real Analogy', prompt: 'Give me a vivid, funny real-world analogy to help me remember this.' }
                    ].map(item => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          setShowTestMenu(false);
                          handleSendPrompt(item.prompt);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs transition flex items-center gap-2 ${
                          isDark ? 'text-gray-300 hover:text-white hover:bg-white/5' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
                        }`}
                      >
                        <span>{item.icon}</span> {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Chat Input Field */}
              <input
                type="text"
                placeholder={
                  tutorMode === 'exam_drill'
                    ? 'Ask about exam patterns, marking keys, or past questions…'
                    : tutorMode === 'simple_analogy'
                    ? 'Ask to explain any concept with a real-world analogy…'
                    : tutorMode === 'quiz'
                    ? 'Type your answer or type "Next question"…'
                    : activeNote
                    ? `Ask anything about "${activeNote.title}"…`
                    : 'Ask anything or choose a study mode above…'
                }
                value={input}
                onChange={e => setInput(e.target.value)}
                className={`w-full pl-12 pr-12 py-3.5 rounded-2xl text-[13.5px] border focus:outline-none focus:ring-2 focus:ring-[#2563EB] ${
                  isDark
                    ? 'text-white bg-[#1A1A2A] border-white/10 shadow-inner placeholder:text-gray-500'
                    : 'text-slate-900 bg-[#f8fafc] border-slate-200 placeholder:text-slate-400'
                }`}
              />

              {/* Send Button */}
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className="absolute right-2.5 w-8 h-8 rounded-xl flex items-center justify-center transition-all bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-30 disabled:hover:bg-[#2563EB] text-white shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
