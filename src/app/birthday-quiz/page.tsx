'use client';

import React, { useEffect, useReducer, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import {
  INITIAL_QUIZ_STATE,
  QUIZ_QUESTIONS,
  canPick,
  celebrates,
  prepareQuiz,
  quizReducer,
  quizScore,
  resultMessage,
  splitEmphasis,
} from '@/lib/birthday-quiz';
import './birthday-quiz.css';

const Confetti = dynamic(() => import('react-confetti'), { ssr: false });

const LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];

const MAX_ANSWERS = Math.max(...QUIZ_QUESTIONS.map((q) => q.answers.length));

function withEmphasis(text: string): React.ReactNode[] {
  return splitEmphasis(text).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));
}

// Keyboard map (RTL, so "forward" points left):
//   Space / Enter / PageDown  reveal the next answer, then move on once answered
//   ArrowLeft                 next question
//   ArrowRight / PageUp       previous question
//   1–9 / א–ו                 pick an answer (only once all answers are showing)
export default function BirthdayQuizPage() {
  const [state, dispatch] = useReducer(quizReducer, INITIAL_QUIZ_STATE);
  const [size, setSize] = useState({ width: 0, height: 0 });
  // Keydown handler is bound once; read the latest state through a ref.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const start = () => dispatch({ type: 'start', questions: prepareQuiz(QUIZ_QUESTIONS) });

  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // A keyboard-focused button keeps its native Enter/Space. Mouse clicks
      // blur their button (see `button()`), so the host's Space still works.
      const onButton = e.target instanceof HTMLElement && !!e.target.closest('button');
      if (onButton && (e.key === 'Enter' || e.key === ' ')) return;
      const { phase } = stateRef.current;
      let handled = true;
      switch (e.key) {
        case ' ':
        case 'Enter':
        case 'PageDown':
        case 'ArrowLeft':
          if (phase === 'intro') start();
          else dispatch({ type: e.key === 'ArrowLeft' ? 'next' : 'advance' });
          break;
        case 'ArrowRight':
        case 'PageUp':
          dispatch({ type: 'prev' });
          break;
        default:
          // 1–9, or the Hebrew letter shown on the answer (א, ב, …).
          const answer = /^[1-9]$/.test(e.key) ? Number(e.key) - 1 : LETTERS.indexOf(e.key);
          if (phase === 'playing' && answer >= 0) dispatch({ type: 'pick', answer });
          else handled = false;
      }
      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const { phase, questions, index } = state;
  const total = QUIZ_QUESTIONS.length;
  const current = questions[index];
  const revealed = state.revealed[index] ?? 0;
  const picked = state.picked[index] ?? null;
  const allShown = !!current && revealed >= current.answers.length;
  const answered = picked !== null;
  const gotIt = answered && picked === current?.correctIndex;
  const score = quizScore(state);
  const result = resultMessage(score, total);
  const pickable = canPick(state);

  // Host click anywhere on the stage reveals the next answer. Buttons stop
  // propagation so they only do their own thing.
  const onStageClick = () => {
    if (phase === 'playing') dispatch({ type: 'advance' });
  };
  const button = (fn: () => void) => (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    // detail > 0 = a real pointer click (keyboard activation reports 0).
    if (e.detail > 0) e.currentTarget.blur();
    fn();
  };

  return (
    <main className="bq-page" dir="rtl" onClick={onStageClick}>
      {phase === 'done' && celebrates(score, total) && size.width > 0 && (
        <Confetti width={size.width} height={size.height} recycle={false} numberOfPieces={350} />
      )}

      <AnimatePresence mode="wait">
        {phase === 'intro' && (
          <motion.section
            key="intro"
            className="bq-card bq-center"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <motion.div
              className="bq-hero-emoji"
              animate={{ rotate: [0, -8, 8, -4, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 1.5 }}
            >
              🎂
            </motion.div>
            <h1 className="bq-title">חידון יום הולדת משפחתי</h1>
            <p className="bq-subtitle">
              כמה טוב אתם מכירים את המשפחה?
              <br />
              {total} שאלות, תשובה נכונה אחת בכל שאלה.
            </p>
            <button type="button" className="bq-primary" onClick={button(start)}>
              בואו נתחיל 🎉
            </button>
            <p className="bq-keys">
              <kbd>רווח</kbd> / קליק — תשובה הבאה · <kbd>←</kbd> <kbd>→</kbd> — מעבר בין שאלות ·{' '}
              <kbd>1</kbd>–<kbd>{MAX_ANSWERS}</kbd> או <kbd>א</kbd>–<kbd>{LETTERS[MAX_ANSWERS - 1]}</kbd> — בחירת תשובה
            </p>
          </motion.section>
        )}

        {phase === 'playing' && current && (
          <motion.section
            key={`q-${index}`}
            className="bq-card"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.25 }}
          >
            <div className="bq-meta">
              <span>שאלה {index + 1} מתוך {total}</span>
              <span>⭐ {score}</span>
            </div>
            <div
              className="bq-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={index + 1}
            >
              <div className="bq-progress-fill" style={{ width: `${((index + 1) / total) * 100}%` }} />
            </div>

            <h2 className={`bq-question ${current.question.length > 140 ? 'is-long' : ''}`}>
              {withEmphasis(current.question)}
            </h2>

            <ul className="bq-answers">
              {current.answers.map((answer, i) => {
                const shown = i < revealed;
                const look = !answered
                  ? ''
                  : i === current.correctIndex
                    ? 'is-correct'
                    : i === picked
                      ? 'is-wrong'
                      : 'is-dim';
                return (
                  <li key={answer}>
                    {/* Hidden slots keep their space so the card doesn't jump. */}
                    <motion.button
                      type="button"
                      className={`bq-answer ${look} ${pickable ? 'is-pickable' : ''}`}
                      initial={false}
                      // Opacity lives here, not in CSS: framer's inline style would override .is-dim.
                      animate={shown ? { opacity: look === 'is-dim' ? 0.45 : 1, y: 0 } : { opacity: 0, y: 12 }}
                      transition={{ duration: 0.3 }}
                      style={{ visibility: shown ? 'visible' : 'hidden' }}
                      aria-hidden={!shown}
                      aria-disabled={!pickable}
                      tabIndex={shown ? 0 : -1}
                      onClick={button(() =>
                        dispatch(pickable ? { type: 'pick', answer: i } : { type: 'advance' }),
                      )}
                    >
                      <span className="bq-letter">{LETTERS[i] ?? i + 1}</span>
                      <span className="bq-answer-text">{answer}</span>
                      {look === 'is-correct' && <span aria-hidden>✅</span>}
                      {look === 'is-wrong' && <span aria-hidden>❌</span>}
                    </motion.button>
                  </li>
                );
              })}
            </ul>

            <div className="bq-feedback">
              {!allShown && (
                <p className="bq-hint">
                  לחצו או הקישו <kbd>רווח</kbd> לתשובה הבאה ({revealed}/{current.answers.length})
                </p>
              )}
              {allShown && !answered && <p className="bq-hint">מה התשובה? 🤔</p>}
              {answered && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <p className={`bq-verdict ${gotIt ? 'is-correct' : 'is-wrong'}`}>
                    {gotIt ? 'נכון! 🎈' : 'לא נכון 😅'}
                  </p>
                  {current.note && <p className="bq-note">{current.note}</p>}
                </motion.div>
              )}
            </div>

            <nav className="bq-nav">
              <button
                type="button"
                className="bq-nav-btn"
                onClick={button(() => dispatch({ type: 'prev' }))}
                disabled={index === 0}
              >
                → הקודמת
              </button>
              <button
                type="button"
                className={answered ? 'bq-primary' : 'bq-nav-btn'}
                onClick={button(() => dispatch({ type: 'next' }))}
              >
                {index + 1 >= total ? 'לתוצאות 🏁' : 'הבאה ←'}
              </button>
            </nav>
          </motion.section>
        )}

        {phase === 'done' && (
          <motion.section
            key="done"
            className="bq-card bq-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="bq-hero-emoji">{result.emoji}</div>
            <h1 className="bq-title">
              {score} / {total}
            </h1>
            <p className="bq-subtitle">{result.text}</p>
            <nav className="bq-nav">
              <button type="button" className="bq-nav-btn" onClick={button(() => dispatch({ type: 'prev' }))}>
                → חזרה לשאלות
              </button>
              <button type="button" className="bq-primary" onClick={button(start)}>
                לשחק שוב 🔁
              </button>
            </nav>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
