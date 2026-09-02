import React, { useState, useRef, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useLocation } from 'react-router-dom';
import api from '../api/axios';

export default function TutorPage() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const contextUnit = searchParams.get('unit');
  const contextTopic = searchParams.get('topic');
  const contextNoteId = searchParams.get('noteId'); // Optional note_id to pass for context

  const initialMessage = contextUnit || contextTopic
    ? `Hi there! I am your ElimuPap Tutor. I see you're studying ${contextTopic ? `"${contextTopic}"` : ''} from ${contextUnit}. How can I help you with this material?`
    : 'Hi there! I am your ElimuPap Tutor. I can help you understand your uploaded notes. What would you like to learn today?';

  const [messages, setMessages] = useState([
    {
      id: '1',
      role: 'assistant',
      content: initialMessage
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showTestMenu, setShowTestMenu] = useState(false);
  const messagesEndRef = useRef(null);
  const testMenuRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (testMenuRef.current && !testMenuRef.current.contains(event.target)) {
        setShowTestMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMsg = { id: Date.now().toString(), role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const token = localStorage.getItem('elimupap_token');
      const messagesForApi = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/ai/tutor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          note_id: contextNoteId || null,
          messages: messagesForApi
        })
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      setIsTyping(false);
      const aiMsgId = Date.now().toString();
      setMessages(prev => [...prev, { id: aiMsgId, role: 'assistant', content: '' }]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunkValue = decoder.decode(value);
          setMessages(prev => prev.map(msg => {
            if (msg.id === aiMsgId) {
              return { ...msg, content: msg.content + chunkValue };
            }
            return msg;
          }));
        }
      }
    } catch (error) {
      console.error("Error streaming AI response:", error);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: 'Sorry, I encountered an error while trying to respond.' }]);
      setIsTyping(false);
    }
  };

  const handleTestSelection = (method) => {
    const prompt = `Test my knowledge on ${contextTopic || contextUnit || 'my recent notes'} using ${method}.`;
    setInput(prompt);
    setShowTestMenu(false);
  };

  const SUGGESTIONS = contextTopic ? [
    `Summarize ${contextTopic}`,
    `Give illustrations for ${contextTopic}`,
    `Explain ${contextTopic} simply`
  ] : [
    "Summarize Macroeconomics Chapter 4",
    "Explain Cellular Respiration in simple terms",
    "Generate a quiz for my notes"
  ];

  return (
    <div className="flex min-h-dvh font-sans" style={{ backgroundColor: '#17171F' }}>
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-dvh relative">
        <main className="flex-1 min-h-0 flex flex-col max-w-[900px] w-full mx-auto px-6 sm:px-10 py-10">

          <header className="flex-shrink-0 flex flex-col md:flex-row md:justify-between md:items-start gap-6 mb-8 animate-fade-in">
            <div>
              <h1 className="font-display text-[2.5rem] text-white leading-none mb-3 tracking-tight">
                ElimuPap Tutor
              </h1>
              <p className="text-[14px] leading-relaxed" style={{ color: '#9ca3af', maxWidth: '500px' }}>
                Ask questions about your uploaded notes and get answers grounded strictly in your own content.
              </p>

              {(contextUnit || contextTopic) && (
                <div className="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-lg inline-flex" style={{ backgroundColor: 'rgba(91,87,255,0.1)', border: '1px solid rgba(91,87,255,0.2)' }}>
                  <svg className="w-4 h-4 text-[#7571ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                  <span className="text-[12px] font-medium" style={{ color: '#c4c2ff' }}>
                    Context: {contextUnit} {contextTopic && `> ${contextTopic}`}
                  </span>
                </div>
              )}
            </div>


          </header>

          <div className="flex-1 min-h-0 overflow-y-auto pr-2 rounded-2xl flex flex-col gap-6 scrollbar-thin mb-6">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
                <div className={`flex items-start gap-4 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>

                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: msg.role === 'user' ? '#1a1a2e' : 'rgba(91,87,255,0.1)', border: msg.role === 'user' ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                    {msg.role === 'user' ? (
                      <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                    ) : (
                      <svg className="w-5 h-5" style={{ color: '#7571ff' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H7.5A2.25 2.25 0 005.25 6.75v10.5a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    )}
                  </div>

                  <div className={`p-5 rounded-2xl ${msg.role === 'user' ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
                    style={{
                      backgroundColor: msg.role === 'user' ? '#5B57FF' : '#1F1F2A',
                      border: msg.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.03)',
                      color: msg.role === 'user' ? '#fff' : '#d1d5db'
                    }}>
                    <p className="text-[14px] leading-[1.6] whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start animate-fade-in">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(91,87,255,0.1)' }}>
                    <svg className="w-5 h-5" style={{ color: '#7571ff' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H7.5A2.25 2.25 0 005.25 6.75v10.5a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </div>
                  <div className="p-5 rounded-2xl rounded-tl-sm flex items-center gap-1.5" style={{ backgroundColor: '#1F1F2A', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="flex-shrink-0 mt-auto">
            {messages.length < 3 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {SUGGESTIONS.map((sug, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInput(sug)}
                    className="px-4 py-2 rounded-full text-[12px] font-medium transition-colors"
                    style={{ backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af' }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff' }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9ca3af' }}>
                    {sug}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleSend} className="relative flex items-center">
              <div className="absolute left-2 z-10" ref={testMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowTestMenu(!showTestMenu)}
                  className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
                  style={{ backgroundColor: showTestMenu ? 'rgba(255,255,255,0.1)' : 'transparent', color: '#9ca3af' }}
                  title="Test Me Options">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>

                {showTestMenu && (
                  <div className="absolute bottom-full left-0 mb-2 w-48 rounded-xl py-2 shadow-xl animate-fade-in"
                    style={{ backgroundColor: '#1F1F2A', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="px-3 pb-2 mb-1 border-b border-[rgba(255,255,255,0.05)]">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Learn interactively:</p>
                    </div>
                    <button type="button" onClick={() => handleTestSelection('Questions')} className="w-full text-left px-4 py-2.5 text-[13px] text-white hover:bg-white/5 transition-colors flex items-center gap-3">
                      <span>📝</span> Questions
                    </button>
                    <button type="button" onClick={() => handleTestSelection('Games')} className="w-full text-left px-4 py-2.5 text-[13px] text-white hover:bg-white/5 transition-colors flex items-center gap-3">
                      <span>🎮</span> Games
                    </button>
                    <button type="button" onClick={() => handleTestSelection('Flashcards')} className="w-full text-left px-4 py-2.5 text-[13px] text-white hover:bg-white/5 transition-colors flex items-center gap-3">
                      <span>🗂️</span> Flashcards
                    </button>
                  </div>
                )}
              </div>

              <input
                type="text"
                placeholder="Message ElimuPap Tutor or select a test mode..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full pl-14 pr-14 py-4 rounded-2xl text-[14px] text-white focus:outline-none focus:ring-1 focus:ring-[#5B57FF] transition-shadow shadow-lg"
                style={{ backgroundColor: '#1a1a2e', border: '1px solid rgba(255,255,255,0.05)' }}
              />
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className="absolute right-3 w-10 h-10 rounded-xl flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: input.trim() ? '#5B57FF' : 'rgba(255,255,255,0.05)', color: input.trim() ? '#fff' : '#7070b0' }}>
                <svg className="w-4 h-4 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </form>
          </div>

        </main>
      </div>
    </div>
  );
}
