import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import api from '../api/axios';
import { getPendingUploadById } from '../utils/offlineUploads';
import { extractTextFromFileClient } from '../utils/offlineExtractor';
import { getCachedResponse } from '../utils/offlineCache';
import { generateOfflineQuiz } from '../utils/offlineAiTools';

export default function QuizPage() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const noteId = searchParams.get('noteId');
  const navigate = useNavigate();

  const [quizData, setQuizData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [showSettings, setShowSettings] = useState(true);
  const [quizType, setQuizType] = useState('multiple_choice');
  const [numQuestions, setNumQuestions] = useState(5);

  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [quizFinished, setQuizFinished] = useState(false);

  const fetchQuiz = async () => {
    setLoading(true);
    setError(null);
    setQuizData(null);

    const buildOfflineFallback = async () => {
      let noteObj = null;
      if (noteId?.startsWith('offline_upload_')) {
        const pending = await getPendingUploadById(noteId);
        if (pending) {
          let text = pending.extracted_text || pending.live_transcript || '';
          if (!text && pending.file) {
            text = await extractTextFromFileClient(pending.file);
          }
          noteObj = { ...pending, extracted_text: text };
        }
      } else {
        noteObj = getCachedResponse('get', `/notes/${noteId}`, null);
      }
      return noteObj ? generateOfflineQuiz(noteObj, numQuestions) : null;
    };

    if (noteId?.startsWith('offline_upload_') || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      const offlineQuiz = await buildOfflineFallback();
      if (offlineQuiz) {
        setQuizData(offlineQuiz);
        setLoading(false);
        return;
      }
    }

    try {
      const token = localStorage.getItem('elimupap_token');
      const response = await api.post('/ai/quiz', {
        note_id: noteId,
        quiz_type: quizType,
        num_questions: numQuestions
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQuizData(response.data);
    } catch (err) {
      if (!err?.response || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        const offlineQuiz = await buildOfflineFallback();
        if (offlineQuiz) {
          setQuizData(offlineQuiz);
          setLoading(false);
          return;
        }
      }
      console.error("Failed to fetch quiz:", err);
      setError(err.response?.data?.detail || "Failed to generate quiz. The note might not contain extractable text.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!noteId) {
      setError("No note selected for the quiz.");
    }
  }, [noteId]);

  const handleStartQuiz = (e) => {
    e.preventDefault();
    setShowSettings(false);
    fetchQuiz();
  };

  const handleSelectOption = (option) => {
    if (quizFinished) return;
    setSelectedAnswers(prev => ({
      ...prev,
      [currentQuestionIdx]: option
    }));
  };

  const handleNext = () => {
    if (currentQuestionIdx < quizData.questions.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
    } else {
      setQuizFinished(true);
      // Log quiz completed
      const token = localStorage.getItem('elimupap_token');
      api.post('/progress/activity', { 
        type: 'quiz_completed', 
        note_id: noteId,
        metadata: { total_questions: quizData.questions.length }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    }
  };

  const handleRetry = () => {
    setQuizFinished(false);
    setCurrentQuestionIdx(0);
    setSelectedAnswers({});
  };

  const handleNewQuiz = () => {
    setQuizFinished(false);
    setCurrentQuestionIdx(0);
    setSelectedAnswers({});
    setShowSettings(true);
    setQuizData(null);
  };

  const calculateScore = () => {
    if (!quizData) return 0;
    let score = 0;
    quizData.questions.forEach((q, idx) => {
      if (q.type === 'multiple_choice' && selectedAnswers[idx] === q.correct_answer) score++;
    });
    return score;
  };

  const totalMultipleChoice = quizData?.questions.filter(q => q.type === 'multiple_choice').length || 0;

  return (
    <div className="flex flex-col lg:flex-row min-h-dvh font-sans" style={{ backgroundColor: '#17171F' }}>
      <Sidebar />
      <div className="flex-1 overflow-y-auto pb-28 lg:pb-10 relative min-w-0">
        <main className="max-w-[800px] mx-auto px-4 sm:px-10 py-6 sm:py-10">
          <header className="mb-10">
            <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white mb-4 flex items-center gap-2 text-sm transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Go Back
            </button>
            <h1 className="font-display text-[2.5rem] text-white leading-none mb-3 tracking-tight">
              {quizData?.quiz_title || "AI Generated Quiz"}
            </h1>
          </header>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 rounded-full border-t-2 border-[#5B57FF] animate-spin mb-4"></div>
              <p className="text-gray-400 text-sm">Generating your quiz questions...</p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-xl bg-red-900/20 border border-red-500/30 text-red-400">
              {error}
            </div>
          ) : showSettings ? (
            <div className="animate-fade-in max-w-xl mx-auto">
              <div className="p-8 rounded-2xl bg-[#1F1F2A] border border-white/5">
                <h2 className="text-xl text-white font-medium mb-6">Configure Your Quiz</h2>
                <form onSubmit={handleStartQuiz} className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.1em] mb-3 text-gray-400">Question Type</label>
                    <div className="space-y-2">
                      <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${quizType === 'multiple_choice' ? 'bg-indigo-900/30 border-indigo-500 text-white' : 'border-white/5 hover:border-white/20 text-gray-400'}`}>
                        <input type="radio" name="qType" value="multiple_choice" checked={quizType === 'multiple_choice'} onChange={() => setQuizType('multiple_choice')} className="hidden" />
                        <span className="text-xl"></span>
                        <span className="font-medium">Multiple Choice Only</span>
                      </label>
                      <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${quizType === 'text_answer' ? 'bg-indigo-900/30 border-indigo-500 text-white' : 'border-white/5 hover:border-white/20 text-gray-400'}`}>
                        <input type="radio" name="qType" value="text_answer" checked={quizType === 'text_answer'} onChange={() => setQuizType('text_answer')} className="hidden" />
                        <span className="text-xl"></span>
                        <span className="font-medium">Text Answers Only</span>
                      </label>
                      <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${quizType === 'combination' ? 'bg-indigo-900/30 border-indigo-500 text-white' : 'border-white/5 hover:border-white/20 text-gray-400'}`}>
                        <input type="radio" name="qType" value="combination" checked={quizType === 'combination'} onChange={() => setQuizType('combination')} className="hidden" />
                        <span className="text-xl"></span>
                        <span className="font-medium">Combination (Mixed)</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.1em] mb-3 text-gray-400">Number of Questions</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[5, 10, 15, 20].map(num => (
                        <button key={num} type="button" onClick={() => setNumQuestions(num)}
                          className={`p-3 rounded-xl border text-sm font-medium transition-colors ${numQuestions === num ? 'bg-indigo-900/30 border-indigo-500 text-white' : 'border-white/5 hover:border-white/20 text-gray-400'}`}>
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button type="submit" className="w-full px-6 py-3.5 rounded-xl text-white font-medium transition-all flex items-center justify-center gap-2" style={{ backgroundColor: '#5B57FF' }}>
                    Generate Quiz
                  </button>
                </form>
              </div>
            </div>
          ) : quizData && !quizFinished ? (
            <div className="animate-fade-in">
              {/* Progress Bar */}
              <div className="mb-8">
                <div className="flex justify-between text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">
                  <span>Question {currentQuestionIdx + 1} of {quizData.questions.length}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#2b2b36]">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${((currentQuestionIdx + 1) / quizData.questions.length) * 100}%`, backgroundColor: '#5B57FF' }}
                  ></div>
                </div>
              </div>

              {/* Question Card */}
              <div className="p-8 rounded-2xl bg-[#1F1F2A] border border-white/5 mb-6">
                <h2 className="text-xl text-white font-medium mb-6 leading-relaxed">
                  {quizData.questions[currentQuestionIdx].question}
                </h2>

                {quizData.questions[currentQuestionIdx].type === 'text_answer' ? (
                  <textarea
                    className="w-full h-32 p-4 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-[#5B57FF]"
                    style={{ backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}
                    placeholder="Type your answer here..."
                    value={selectedAnswers[currentQuestionIdx] || ''}
                    onChange={(e) => handleSelectOption(e.target.value)}
                  />
                ) : (
                  <div className="space-y-3">
                    {quizData.questions[currentQuestionIdx].options?.map((option, idx) => {
                      const isSelected = selectedAnswers[currentQuestionIdx] === option;
                      let bgStyle = isSelected ? 'bg-indigo-900/30' : 'bg-black/20 hover:bg-black/40';
                      let borderStyle = isSelected ? 'border-indigo-500' : 'border-white/5 hover:border-white/20';
                      let textStyle = isSelected ? 'text-white' : 'text-gray-300';

                      return (
                        <button
                          key={idx}
                          onClick={() => handleSelectOption(option)}
                          className={`w-full text-left p-4 rounded-xl border transition-colors ${bgStyle} ${borderStyle}`}
                        >
                          <span className={textStyle}>{option}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex justify-end">
                <button
                  onClick={handleNext}
                  disabled={!selectedAnswers[currentQuestionIdx]}
                  className="px-6 py-3 rounded-xl text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#5B57FF' }}
                >
                  {currentQuestionIdx < quizData.questions.length - 1 ? 'Next Question' : 'Submit Quiz'}
                </button>
              </div>
            </div>
          ) : quizFinished ? (
            <div className="animate-fade-in space-y-6">
              <div className="p-8 rounded-2xl bg-[#1F1F2A] border border-white/5 text-center">

                {totalMultipleChoice > 0 ? (
                  <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4"
                    style={{ backgroundColor: 'rgba(91,87,255,0.1)', border: '2px solid #5B57FF' }}>
                    <span className="text-2xl font-bold text-white">{calculateScore()}</span>
                    <span className="text-gray-400 text-lg mx-1">/</span>
                    <span className="text-gray-400 text-lg">{totalMultipleChoice}</span>
                  </div>
                ) : (
                  <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4"
                    style={{ backgroundColor: 'rgba(91,87,255,0.1)', border: '2px solid #5B57FF' }}>
                    <span className="text-2xl">✍️</span>
                  </div>
                )}

                <h2 className="text-2xl text-white font-bold mb-2">Review Your Answers</h2>
                {totalMultipleChoice < quizData.questions.length && (
                  <p className="text-gray-400 mb-6 text-sm max-w-sm mx-auto">
                    Note: Your score only reflects multiple-choice questions. For written answers, compare your response to the correct key points below.
                  </p>
                )}

                <div className="flex justify-center gap-4">
                  <button onClick={handleRetry} className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all border border-gray-600 text-white hover:bg-gray-800">
                    Retry Same Quiz
                  </button>
                  <button onClick={handleNewQuiz} className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all" style={{ backgroundColor: '#5B57FF', color: '#fff' }}>
                    Setup New Quiz
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {quizData.questions.map((q, idx) => {
                  const userAnswer = selectedAnswers[idx];
                  const isMultipleChoice = q.type === 'multiple_choice';
                  const isCorrect = isMultipleChoice && userAnswer === q.correct_answer;

                  return (
                    <div key={idx} className="p-6 rounded-2xl bg-[#1F1F2A] border border-white/5">
                      <div className="flex items-start gap-4 mb-4">

                        {isMultipleChoice ? (
                          <div className={`mt-1 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${isCorrect ? 'bg-green-500' : 'bg-red-500'}`}>
                            {isCorrect ? (
                              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            ) : (
                              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            )}
                          </div>
                        ) : (
                          <div className="mt-1 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-indigo-500">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </div>
                        )}

                        <div className="w-full">
                          <h3 className="text-white font-medium text-lg leading-snug">{q.question}</h3>

                          {isMultipleChoice ? (
                            <div className="mt-3 space-y-2">
                              <p className="text-sm">
                                <span className="text-gray-500">Your Answer: </span>
                                <span className={isCorrect ? 'text-green-400 font-medium' : 'text-red-400 font-medium line-through'}>{userAnswer || 'Skipped'}</span>
                              </p>
                              {!isCorrect && (
                                <p className="text-sm">
                                  <span className="text-gray-500">Correct Answer: </span>
                                  <span className="text-green-400 font-medium">{q.correct_answer}</span>
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="mt-4 grid md:grid-cols-2 gap-4">
                              <div className="bg-[#17171F] p-4 rounded-xl border border-white/5">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Your Typed Answer</p>
                                <p className="text-sm text-white whitespace-pre-wrap">{userAnswer || 'Skipped'}</p>
                              </div>
                              <div className="bg-[#17171F] p-4 rounded-xl border border-white/5">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-green-400 mb-2">Ideal Answer / Key Points</p>
                                <p className="text-sm text-green-400 font-medium whitespace-pre-wrap">{q.correct_answer}</p>
                              </div>
                            </div>
                          )}

                        </div>
                      </div>
                      <div className="mt-4 p-4 rounded-xl bg-[#17171F] border border-white/5 ml-10">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 mb-1">Detailed Explanation</p>
                        <p className="text-sm text-gray-400 leading-relaxed">{q.explanation}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
