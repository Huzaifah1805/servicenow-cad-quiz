import React, { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import questionsData from './data/questions.json';
import { 
  BookOpen, 
  Clock, 
  Search, 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Bookmark, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  Layers,
  Filter,
  Check
} from 'lucide-react';

// Sound Synth Helper using Web Audio API
const playSound = (type, enabled = true) => {
  if (!enabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'correct') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'wrong') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime); // A3
      osc.frequency.exponentialRampToValueAtTime(130.81, ctx.currentTime + 0.2); // C3
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'finish') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch (e) {
    console.error(e);
  }
};

export default function App() {
  const [mode, setMode] = useState('practice'); // 'practice', 'exam', 'flashcards', 'bank'
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Quiz State
  const [activeQuestions, setActiveQuestions] = useState(questionsData);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({}); // { qId: [selectedOptions] }
  const [submittedQuestions, setSubmittedQuestions] = useState({}); // { qId: boolean }
  const [bookmarked, setBookmarked] = useState(() => {
    const saved = localStorage.getItem('cad_bookmarks');
    return saved ? JSON.parse(saved) : [];
  });
  
  // Exam Timer State
  const [timeLeft, setTimeLeft] = useState(90 * 60);
  const [isExamFinished, setIsExamFinished] = useState(false);
  const [examScore, setExamScore] = useState(null);

  // Bank Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [bankFilterCategory, setBankFilterCategory] = useState('All');

  // Flashcards state
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);

  // Categories extraction
  const categories = useMemo(() => {
    const cats = new Set(questionsData.map(q => q.category));
    return ['All', ...Array.from(cats)];
  }, []);

  // Save Bookmarks
  useEffect(() => {
    localStorage.setItem('cad_bookmarks', JSON.stringify(bookmarked));
  }, [bookmarked]);

  // Exam Timer Effect
  useEffect(() => {
    let timer;
    if (mode === 'exam' && !isExamFinished && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            finishExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [mode, isExamFinished, timeLeft]);

  // Handle Mode Change
  const startMode = (newMode) => {
    setMode(newMode);
    setCurrentIndex(0);
    setUserAnswers({});
    setSubmittedQuestions({});
    setFlashcardFlipped(false);

    if (newMode === 'exam') {
      const shuffled = [...questionsData].sort(() => 0.5 - Math.random()).slice(0, 60);
      setActiveQuestions(shuffled);
      setTimeLeft(90 * 60);
      setIsExamFinished(false);
      setExamScore(null);
    } else if (newMode === 'practice' || newMode === 'flashcards') {
      let filtered = questionsData;
      if (selectedCategory !== 'All') {
        filtered = questionsData.filter(q => q.category === selectedCategory);
      }
      setActiveQuestions(filtered);
    }
  };

  // Category change handling
  const handleCategoryChange = (cat) => {
    setSelectedCategory(cat);
    let filtered = questionsData;
    if (cat !== 'All') {
      filtered = questionsData.filter(q => q.category === cat);
    }
    setActiveQuestions(filtered);
    setCurrentIndex(0);
  };

  const currentQ = activeQuestions[currentIndex] || activeQuestions[0];

  // Helper check correctness
  const isAnswerCorrect = (question, userSelected) => {
    if (!userSelected || userSelected.length === 0) return false;
    const normCorrect = question.correct.map(c => c.trim());
    const normUser = userSelected.map(u => u.trim());
    if (normCorrect.length !== normUser.length) return false;
    return normCorrect.every(c => normUser.includes(c));
  };

  // Answer Selection logic - Instant Check on Click!
  const handleOptionToggle = (optionText) => {
    if (mode === 'practice' && submittedQuestions[currentQ.id]) return; // locked after checking
    if (mode === 'exam' && isExamFinished) return;

    if (mode === 'practice') {
      if (currentQ.type === 'single') {
        const newSel = [optionText];
        setUserAnswers(prev => ({ ...prev, [currentQ.id]: newSel }));
        setSubmittedQuestions(sq => ({ ...sq, [currentQ.id]: true }));
        const correct = isAnswerCorrect(currentQ, newSel);
        playSound(correct ? 'correct' : 'wrong', soundEnabled);
      } else {
        // Multi-select handling
        const existing = userAnswers[currentQ.id] || [];
        const newSel = existing.includes(optionText)
          ? existing.filter(o => o !== optionText)
          : [...existing, optionText];

        setUserAnswers(prev => ({ ...prev, [currentQ.id]: newSel }));

        // Auto check when user has selected the required number of choices for multi-select
        if (newSel.length === currentQ.correct.length) {
          setSubmittedQuestions(sq => ({ ...sq, [currentQ.id]: true }));
          const correct = isAnswerCorrect(currentQ, newSel);
          playSound(correct ? 'correct' : 'wrong', soundEnabled);
        }
      }
    } else {
      // Exam mode selection without auto-reveal
      const existing = userAnswers[currentQ.id] || [];
      if (currentQ.type === 'single') {
        setUserAnswers(prev => ({ ...prev, [currentQ.id]: [optionText] }));
      } else {
        const newSel = existing.includes(optionText)
          ? existing.filter(o => o !== optionText)
          : [...existing, optionText];
        setUserAnswers(prev => ({ ...prev, [currentQ.id]: newSel }));
      }
    }
  };

  // Verify Answer button for multi-select if pressed manually
  const verifyAnswer = () => {
    if (!userAnswers[currentQ.id] || userAnswers[currentQ.id].length === 0) return;
    setSubmittedQuestions(prev => ({ ...prev, [currentQ.id]: true }));
    const isCorrect = isAnswerCorrect(currentQ, userAnswers[currentQ.id]);
    playSound(isCorrect ? 'correct' : 'wrong', soundEnabled);
  };

  // Bookmark Toggle
  const toggleBookmark = (qId) => {
    setBookmarked(prev => 
      prev.includes(qId) ? prev.filter(id => id !== qId) : [...prev, qId]
    );
  };

  // Finish Exam
  const finishExam = () => {
    let score = 0;
    activeQuestions.forEach(q => {
      const selected = userAnswers[q.id] || [];
      if (isAnswerCorrect(q, selected)) {
        score++;
      }
    });

    const percent = Math.round((score / activeQuestions.length) * 100);
    setExamScore({ score, total: activeQuestions.length, percent, passed: percent >= 70 });
    setIsExamFinished(true);

    if (percent >= 70) {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      playSound('finish', soundEnabled);
    } else {
      playSound('wrong', soundEnabled);
    }
  };

  // Time formatter
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Search filter for bank
  const filteredBankQuestions = useMemo(() => {
    return questionsData.filter(q => {
      const matchesCat = bankFilterCategory === 'All' || q.category === bankFilterCategory;
      const matchesQuery = q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.choices.some(c => c.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCat && matchesQuery;
    });
  }, [searchQuery, bankFilterCategory]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header Bar */}
      <header className="glass-panel" style={{ borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none', padding: '16px 28px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          
          {/* Logo & Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: 'linear-gradient(135deg, #6366f1, #06b6d4)', padding: 10, borderRadius: 12, display: 'flex', boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)' }}>
              <Sparkles size={24} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, background: 'linear-gradient(90deg, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                ServiceNow CAD Pro Exam Prep
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Certified Application Developer • Instant Answer Feedback Simulator
              </div>
            </div>
          </div>

          {/* Mode Switcher Nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0, 0, 0, 0.3)', padding: 6, borderRadius: 14, border: '1px solid var(--border-color)' }}>
            <button 
              className={`btn ${mode === 'practice' ? 'btn-primary' : 'btn-secondary'}`} 
              onClick={() => startMode('practice')}
              style={{ padding: '8px 14px', fontSize: '0.85rem' }}
            >
              <BookOpen size={16} /> Practice
            </button>
            
            <button 
              className={`btn ${mode === 'exam' ? 'btn-primary' : 'btn-secondary'}`} 
              onClick={() => startMode('exam')}
              style={{ padding: '8px 14px', fontSize: '0.85rem' }}
            >
              <Clock size={16} /> Timed Exam
            </button>
            
            <button 
              className={`btn ${mode === 'flashcards' ? 'btn-primary' : 'btn-secondary'}`} 
              onClick={() => startMode('flashcards')}
              style={{ padding: '8px 14px', fontSize: '0.85rem' }}
            >
              <Layers size={16} /> Flashcards
            </button>
            
            <button 
              className={`btn ${mode === 'bank' ? 'btn-primary' : 'btn-secondary'}`} 
              onClick={() => startMode('bank')}
              style={{ padding: '8px 14px', fontSize: '0.85rem' }}
            >
              <Search size={16} /> Question Bank ({questionsData.length})
            </button>
          </div>

          {/* Audio Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button 
              onClick={() => setSoundEnabled(!soundEnabled)} 
              title={soundEnabled ? "Mute sound effects" : "Enable sound effects"}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: 8, borderRadius: 10, cursor: 'pointer', display: 'flex' }}
            >
              {soundEnabled ? <Volume2 size={18} color="#10b981" /> : <VolumeX size={18} color="#64748b" />}
            </button>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ maxWidth: 1280, width: '100%', margin: '24px auto', padding: '0 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* PRACTICE MODE */}
        {mode === 'practice' && (
          <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24 }}>
            
            {/* Question Panel */}
            <div className="glass-panel" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="tag tag-purple">Q{currentQ.id}</span>
                  <span className="tag tag-cyan">{currentQ.category}</span>
                  {currentQ.type === 'multiple' && (
                    <span className="tag tag-rose">Select {currentQ.correct.length} Choices</span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button 
                    onClick={() => toggleBookmark(currentQ.id)}
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                  >
                    <Bookmark size={15} color={bookmarked.includes(currentQ.id) ? '#f59e0b' : '#64748b'} fill={bookmarked.includes(currentQ.id) ? '#f59e0b' : 'none'} />
                    {bookmarked.includes(currentQ.id) ? 'Bookmarked' : 'Bookmark'}
                  </button>
                </div>
              </div>

              {/* Question Text */}
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {currentQ.question}
              </h2>

              {/* Sub-options if given */}
              {currentQ.options && currentQ.options.length > 0 && (
                <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: 16, borderRadius: 10, border: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {currentQ.options.map((opt, i) => (
                    <div key={i} style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      {opt}
                    </div>
                  ))}
                </div>
              )}

              {/* Select Choices - INSTANT REVEAL ON CLICK */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                {currentQ.choices.map((choice, idx) => {
                  const isSelected = (userAnswers[currentQ.id] || []).includes(choice);
                  const isSubmitted = submittedQuestions[currentQ.id];
                  const isCorrectAnswer = currentQ.correct.includes(choice);

                  let cardClass = 'option-card';
                  if (isSubmitted) {
                    if (isCorrectAnswer) {
                      cardClass += ' correct-answer'; // GREEN
                    } else if (isSelected && !isCorrectAnswer) {
                      cardClass += ' wrong-answer';   // RED
                    }
                  } else if (isSelected) {
                    cardClass += ' selected';
                  }

                  return (
                    <div 
                      key={idx} 
                      className={cardClass}
                      onClick={() => handleOptionToggle(choice)}
                    >
                      <div style={{ 
                        width: 24, 
                        height: 24, 
                        borderRadius: currentQ.type === 'single' ? '50%' : '6px',
                        border: isSubmitted
                          ? (isCorrectAnswer ? '2px solid #10b981' : (isSelected ? '2px solid #ef4444' : '2px solid var(--border-color)'))
                          : (isSelected ? '2px solid var(--accent-primary)' : '2px solid var(--border-color)'),
                        background: isSubmitted
                          ? (isCorrectAnswer ? '#10b981' : (isSelected ? '#ef4444' : 'transparent'))
                          : (isSelected ? 'var(--accent-primary)' : 'transparent'),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: 2
                      }}>
                        {isSubmitted ? (
                          isCorrectAnswer ? <Check size={14} color="#fff" /> : (isSelected ? <XCircle size={14} color="#fff" /> : null)
                        ) : (
                          isSelected && <Check size={14} color="#fff" />
                        )}
                      </div>

                      <div style={{ flex: 1, fontSize: '0.95rem', fontWeight: isSubmitted && isCorrectAnswer ? 700 : 400, color: isSubmitted && isCorrectAnswer ? '#34d399' : (isSubmitted && isSelected ? '#f87171' : 'var(--text-primary)') }}>
                        {choice}
                      </div>

                      {isSubmitted && isCorrectAnswer && (
                        <CheckCircle2 size={22} color="#10b981" style={{ flexShrink: 0 }} />
                      )}
                      {isSubmitted && isSelected && !isCorrectAnswer && (
                        <XCircle size={22} color="#ef4444" style={{ flexShrink: 0 }} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action & Nav Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
                <button 
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex(prev => prev - 1)}
                  className="btn btn-secondary"
                >
                  <ChevronLeft size={18} /> Previous
                </button>

                {currentQ.type === 'multiple' && !submittedQuestions[currentQ.id] && (
                  <button 
                    disabled={!userAnswers[currentQ.id] || userAnswers[currentQ.id].length === 0}
                    onClick={verifyAnswer}
                    className="btn btn-primary"
                  >
                    Check Answer
                  </button>
                )}

                {submittedQuestions[currentQ.id] && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ 
                      fontSize: '1.05rem',
                      fontWeight: 800, 
                      color: isAnswerCorrect(currentQ, userAnswers[currentQ.id]) ? '#10b981' : '#ef4444',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}>
                      {isAnswerCorrect(currentQ, userAnswers[currentQ.id]) ? (
                        <><CheckCircle2 size={20} /> Correct Answer!</>
                      ) : (
                        <><XCircle size={20} /> Incorrect</>
                      )}
                    </span>
                  </div>
                )}

                <button 
                  disabled={currentIndex === activeQuestions.length - 1}
                  onClick={() => setCurrentIndex(prev => prev + 1)}
                  className="btn btn-secondary"
                >
                  Next <ChevronRight size={18} />
                </button>
              </div>

              {/* Official Answer Breakdown Panel */}
              {submittedQuestions[currentQ.id] && (
                <div className="animate-fade-in" style={{ 
                  marginTop: 16, 
                  padding: 18, 
                  borderRadius: 12, 
                  background: isAnswerCorrect(currentQ, userAnswers[currentQ.id]) ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  border: isAnswerCorrect(currentQ, userAnswers[currentQ.id]) ? '1.5px solid rgba(16, 185, 129, 0.4)' : '1.5px solid rgba(239, 68, 68, 0.4)'
                }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: isAnswerCorrect(currentQ, userAnswers[currentQ.id]) ? '#34d399' : '#f87171', marginBottom: 6 }}>
                    Official PDF Correct Answer Key:
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {currentQ.correct.join(', ')}
                  </div>
                </div>
              )}

            </div>

            {/* Sidebar Navigation */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              
              {/* Category Filter */}
              <div className="glass-panel" style={{ padding: 20 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Filter size={14} /> Filter Category
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                  {categories.map((cat, idx) => (
                    <div 
                      key={idx}
                      onClick={() => handleCategoryChange(cat)}
                      style={{ 
                        padding: '8px 12px', 
                        borderRadius: 8, 
                        fontSize: '0.85rem', 
                        cursor: 'pointer',
                        background: selectedCategory === cat ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                        color: selectedCategory === cat ? '#818cf8' : 'var(--text-secondary)',
                        fontWeight: selectedCategory === cat ? 700 : 500
                      }}
                    >
                      {cat}
                    </div>
                  ))}
                </div>
              </div>

              {/* Question Navigator Grid */}
              <div className="glass-panel" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Questions ({currentIndex + 1}/{activeQuestions.length})
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                    {Math.round(((currentIndex + 1) / activeQuestions.length) * 100)}%
                  </div>
                </div>

                <div className="progress-bar-bg" style={{ marginBottom: 16 }}>
                  <div className="progress-bar-fill" style={{ width: `${((currentIndex + 1) / activeQuestions.length) * 100}%` }}></div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, maxHeight: 240, overflowY: 'auto', paddingRight: 4 }}>
                  {activeQuestions.map((q, idx) => {
                    const isCurrent = idx === currentIndex;
                    const isSubmitted = submittedQuestions[q.id];
                    const isRight = isSubmitted && isAnswerCorrect(q, userAnswers[q.id]);
                    const isWrong = isSubmitted && !isRight;

                    let bg = 'rgba(255, 255, 255, 0.06)';
                    let borderColor = 'transparent';
                    if (isRight) bg = 'rgba(16, 185, 129, 0.4)';
                    else if (isWrong) bg = 'rgba(239, 68, 68, 0.4)';
                    
                    if (isCurrent) borderColor = 'var(--accent-primary)';

                    return (
                      <button
                        key={q.id}
                        onClick={() => setCurrentIndex(idx)}
                        style={{
                          aspectRatio: '1',
                          borderRadius: 8,
                          border: `1.5px solid ${borderColor}`,
                          background: bg,
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative'
                        }}
                      >
                        {idx + 1}
                        {bookmarked.includes(q.id) && (
                          <div style={{ position: 'absolute', top: 2, right: 2, width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }}></div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* TIMED EXAM MODE */}
        {mode === 'exam' && (
          <div className="animate-fade-in" style={{ maxWidth: 860, margin: '0 auto', width: '100%' }}>
            {!isExamFinished ? (
              <div className="glass-panel" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
                
                {/* Timer Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0, 0, 0, 0.3)', padding: '12px 20px', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Clock size={20} color={timeLeft < 300 ? '#ef4444' : '#06b6d4'} className={timeLeft < 300 ? 'pulse-glow' : ''} />
                    <span style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'JetBrains Mono', color: timeLeft < 300 ? '#ef4444' : 'var(--text-primary)' }}>
                      {formatTime(timeLeft)}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Question {currentIndex + 1} of {activeQuestions.length}
                  </div>

                  <button onClick={finishExam} className="btn btn-success" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                    Submit Exam
                  </button>
                </div>

                {/* Question Box */}
                <div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <span className="tag tag-purple">Q{currentQ.id}</span>
                    <span className="tag tag-cyan">{currentQ.category}</span>
                    {currentQ.type === 'multiple' && (
                      <span className="tag tag-rose">Select {currentQ.correct.length} Choices</span>
                    )}
                  </div>

                  <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
                    {currentQ.question}
                  </h2>

                  {currentQ.options && currentQ.options.length > 0 && (
                    <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: 16, borderRadius: 10, border: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                      {currentQ.options.map((opt, i) => (
                        <div key={i} style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{opt}</div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {currentQ.choices.map((choice, idx) => {
                      const isSelected = (userAnswers[currentQ.id] || []).includes(choice);
                      return (
                        <div 
                          key={idx} 
                          className={`option-card ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleOptionToggle(choice)}
                        >
                          <div style={{ 
                            width: 22, 
                            height: 22, 
                            borderRadius: currentQ.type === 'single' ? '50%' : '6px',
                            border: isSelected ? '2px solid var(--accent-primary)' : '2px solid var(--border-color)',
                            background: isSelected ? 'var(--accent-primary)' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {isSelected && <Check size={14} color="#fff" />}
                          </div>
                          <div style={{ fontSize: '0.95rem' }}>{choice}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
                  <button 
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex(prev => prev - 1)}
                    className="btn btn-secondary"
                  >
                    <ChevronLeft size={18} /> Previous
                  </button>

                  <button 
                    disabled={currentIndex === activeQuestions.length - 1}
                    onClick={() => setCurrentIndex(prev => prev + 1)}
                    className="btn btn-primary"
                  >
                    Next <ChevronRight size={18} />
                  </button>
                </div>

              </div>
            ) : (
              /* Exam Result Summary */
              <div className="glass-panel" style={{ padding: 40, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
                <div style={{ 
                  width: 100, 
                  height: 100, 
                  borderRadius: '50%', 
                  background: examScore.passed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: examScore.passed ? '3px solid #10b981' : '3px solid #ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
                  fontWeight: 800,
                  color: examScore.passed ? '#10b981' : '#ef4444'
                }}>
                  {examScore.percent}%
                </div>

                <div>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: examScore.passed ? '#10b981' : '#ef4444', marginBottom: 8 }}>
                    {examScore.passed ? '🎉 Congratulations! CAD Exam Passed' : '⚠️ Exam Not Passed'}
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
                    You scored {examScore.score} out of {examScore.total} questions ({examScore.percent}%). Minimum passing score is 70%.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 16 }}>
                  <button onClick={() => startMode('exam')} className="btn btn-primary">
                    <RotateCcw size={18} /> Retake Exam
                  </button>
                  <button onClick={() => startMode('practice')} className="btn btn-secondary">
                    Review Questions
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FLASHCARDS MODE */}
        {mode === 'flashcards' && (
          <div className="animate-fade-in" style={{ maxWidth: 640, margin: '20px auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="tag tag-cyan">{currentQ.category}</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Card {currentIndex + 1} of {activeQuestions.length}
              </span>
            </div>

            <div 
              onClick={() => setFlashcardFlipped(!flashcardFlipped)}
              className="glass-panel"
              style={{ 
                minHeight: 280, 
                padding: 32, 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center', 
                alignItems: 'center', 
                textAlign: 'center',
                cursor: 'pointer',
                border: flashcardFlipped ? '1.5px solid var(--accent-success)' : '1.5px solid var(--border-color)',
                transition: 'transform 0.3s ease'
              }}
            >
              {!flashcardFlipped ? (
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 12 }}>
                    Click Card to Flip Answer
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.5 }}>
                    {currentQ.question}
                  </h3>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 700, textTransform: 'uppercase', marginBottom: 12 }}>
                    Official Correct Answer
                  </div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#34d399', lineHeight: 1.5 }}>
                    {currentQ.correct.join('\n')}
                  </h3>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button 
                disabled={currentIndex === 0}
                onClick={() => { setFlashcardFlipped(false); setCurrentIndex(prev => prev - 1); }}
                className="btn btn-secondary"
              >
                <ChevronLeft size={18} /> Previous
              </button>

              <button 
                disabled={currentIndex === activeQuestions.length - 1}
                onClick={() => { setFlashcardFlipped(false); setCurrentIndex(prev => prev + 1); }}
                className="btn btn-primary"
              >
                Next <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* QUESTION BANK SEARCH & BROWSE MODE */}
        {mode === 'bank' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {/* Search & Filter Bar */}
            <div className="glass-panel" style={{ padding: 20, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 280, display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '0 16px', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                <Search size={18} color="#64748b" />
                <input 
                  type="text" 
                  placeholder="Search CAD questions or keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', background: 'transparent', border: 'none', padding: '12px', color: '#fff', outline: 'none', fontSize: '0.95rem' }}
                />
              </div>

              <select 
                value={bankFilterCategory}
                onChange={(e) => setBankFilterCategory(e.target.value)}
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: '#fff', padding: '0 16px', borderRadius: 10, outline: 'none', fontSize: '0.9rem', cursor: 'pointer' }}
              >
                {categories.map((c, i) => (
                  <option key={i} value={c} style={{ background: '#121824', color: '#fff' }}>{c}</option>
                ))}
              </select>
            </div>

            {/* Questions List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {filteredBankQuestions.map((q) => (
                <div key={q.id} className="glass-panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="tag tag-purple">Q{q.id}</span>
                    <span className="tag tag-cyan">{q.category}</span>
                  </div>

                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {q.question}
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                    {q.choices.map((choice, cIdx) => {
                      const isCorrect = q.correct.includes(choice);
                      return (
                        <div key={cIdx} style={{ 
                          padding: '8px 12px', 
                          borderRadius: 8, 
                          fontSize: '0.88rem', 
                          background: isCorrect ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255,255,255,0.02)',
                          border: isCorrect ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid transparent',
                          color: isCorrect ? '#34d399' : 'var(--text-secondary)',
                          fontWeight: isCorrect ? 600 : 400,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8
                        }}>
                          {isCorrect && <CheckCircle2 size={16} color="#10b981" />}
                          {choice}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}

      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-color)', padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        ServiceNow Certified Application Developer (CAD) Interactive Exam Prep • Deployed on Vercel
      </footer>
    </div>
  );
}
