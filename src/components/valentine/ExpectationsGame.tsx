'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo, animate } from 'framer-motion';
import type { PlayerId } from '@/types/expectations';
import type { ExpectationsQuestion } from '@/types/expectations';
import { EXPECTATIONS_QUESTIONS } from '@/data/expectations-questions';
import MatchCelebration from './MatchCelebration';

const POLL_INTERVAL_MS = 2000;
const SWIPE_THRESHOLD = 80;

type Screen = 'landing' | 'waiting' | 'game' | 'result';

const SESSION_API = '/api/sex/session';

type ChoicesMap = Record<string, { tom: string | null; tomer: string | null }>;

/** Resolve "questionId.right" or "questionId.left" to the required choice value. */
function resolveDepRef(ref: string): 'right' | 'left' | null {
  const [, side] = ref.split('.');
  if (side === 'right' || side === 'left') return side;
  return null;
}

function isQuestionVisible(
  question: ExpectationsQuestion,
  player: PlayerId,
  choices: ChoicesMap
): boolean {
  if (!question.dependsOn?.length) return true;
  return question.dependsOn.every((ref) => {
    const required = resolveDepRef(ref);
    if (required == null) return false;
    const [qid] = ref.split('.');
    return choices[qid]?.[player] === required;
  });
}

function isDoneWithQuestion(
  question: ExpectationsQuestion,
  player: PlayerId,
  choices: ChoicesMap
): boolean {
  if (choices[question.id]?.[player] != null) return true;
  return !isQuestionVisible(question, player, choices);
}

function bothDoneWithQuestion(
  question: ExpectationsQuestion,
  choices: ChoicesMap
): boolean {
  return (
    isDoneWithQuestion(question, 'tom', choices) &&
    isDoneWithQuestion(question, 'tomer', choices)
  );
}

/** Both answered this question and chose the same option. */
function questionMatch(question: ExpectationsQuestion, choices: ChoicesMap): boolean {
  const c = choices[question.id];
  if (!c?.tom || !c?.tomer) return false;
  return c.tom === c.tomer;
}

/** First question that is visible and not yet "passed" (both done + match). Stays on question when both done but no match. */
function getCurrentQuestion(
  questions: ExpectationsQuestion[],
  player: PlayerId,
  choices: ChoicesMap
): ExpectationsQuestion | null {
  return (
    questions.find((q) => {
      if (!isQuestionVisible(q, player, choices)) return false;
      const bothDone = bothDoneWithQuestion(q, choices);
      if (!bothDone) return true;
      return !questionMatch(q, choices);
    }) ?? null
  );
}

/** Title without trailing ellipsis for conclusion line. */
function titleWithoutEllipsis(title: string): string {
  return title.replace(/\.{2,}\s*$/, '').trim();
}

/** Get the label for a side choice for a given player. */
function getLabelForChoice(
  question: ExpectationsQuestion,
  choice: string,
  forPlayer: PlayerId
): string {
  if (choice === 'right') return question.sideLabels[forPlayer].right;
  if (choice === 'left') return question.sideLabels[forPlayer].left;
  return '';
}

/** Conclusion lines for the current player: each line is "title (no ...) + answer" for the OTHER player's choices. */
function getConclusionLines(
  player: PlayerId,
  choices: ChoicesMap,
  questions: ExpectationsQuestion[]
): string[] {
  const other: PlayerId = player === 'tom' ? 'tomer' : 'tom';
  const lines: string[] = [];
  for (const q of questions) {
    const choice = choices[q.id]?.[other];
    if (!choice) continue;
    if (!isQuestionVisible(q, other, choices)) continue;
    const titleStripped = titleWithoutEllipsis(q.title);
    const label = getLabelForChoice(q, choice, other);
    if (label) lines.push(`${titleStripped} ${label}`);
  }
  return lines;
}

export default function ExpectationsGame() {
  const [screen, setScreen] = useState<Screen>('landing');
  const [player, setPlayer] = useState<PlayerId | null>(null);
  const [session, setSession] = useState<{
    tomJoined: boolean;
    tomerJoined: boolean;
    tomChoice: string | null;
    tomerChoice: string | null;
    choices: ChoicesMap;
  } | null>(null);
  const [celebrateMatch, setCelebrateMatch] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const choices = useMemo(() => session?.choices ?? {}, [session?.choices]);
  const bothJoined = Boolean(session?.tomJoined && session?.tomerJoined);

  const currentQuestion = player ? getCurrentQuestion(EXPECTATIONS_QUESTIONS, player, choices) : null;
  const myChoiceForCurrent = currentQuestion && player ? choices[currentQuestion.id]?.[player] ?? null : null;
  const bothDoneCurrent = currentQuestion ? bothDoneWithQuestion(currentQuestion, choices) : false;
  const noMatchCurrent = Boolean(currentQuestion && bothDoneCurrent && !questionMatch(currentQuestion, choices));
  const isWaitingForPartner = Boolean(currentQuestion && myChoiceForCurrent != null && !noMatchCurrent);
  const conclusionLines = useMemo(
    () => (player ? getConclusionLines(player, choices, EXPECTATIONS_QUESTIONS) : []),
    [player, choices]
  );
  const prevQuestionIdRef = useRef<string | null>(null);

  const fetchSession = useCallback(async () => {
    const res = await fetch(SESSION_API);
    if (!res.ok) return null;
    const data = await res.json();
    setSession({
      tomJoined: !!data.tomJoined,
      tomerJoined: !!data.tomerJoined,
      tomChoice: data.tomChoice ?? null,
      tomerChoice: data.tomerChoice ?? null,
      choices: data.choices ?? {},
    });
    return data;
  }, []);

  useEffect(() => {
    if ((screen !== 'waiting' && screen !== 'game') || !player) return;
    fetchSession();
    pollRef.current = setInterval(fetchSession, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [screen, player, fetchSession]);

  useEffect(() => {
    if (screen === 'waiting' && bothJoined) setScreen('game');
  }, [screen, bothJoined]);

  useEffect(() => {
    if (screen === 'game' && player && currentQuestion === null) {
      setScreen('result');
    }
  }, [screen, player, currentQuestion]);

  useEffect(() => {
    if (!player) return;
    const prevId = prevQuestionIdRef.current;
    const currId = currentQuestion?.id ?? null;
    if (prevId !== currId && prevId != null) {
      const prevQ = EXPECTATIONS_QUESTIONS.find((q) => q.id === prevId);
      if (prevQ && bothDoneWithQuestion(prevQ, choices) && questionMatch(prevQ, choices)) {
        setCelebrateMatch(true);
      }
    }
    prevQuestionIdRef.current = currId;
  }, [player, currentQuestion?.id, choices]);

  const handleEnter = useCallback(async (p: PlayerId) => {
    setPlayer(p);
    const res = await fetch(SESSION_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player: p }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err?.error || 'שגיאה. נסו שוב.');
      setPlayer(null);
      return;
    }
    const data = await res.json();
    setSession({
      tomJoined: !!data.tomJoined,
      tomerJoined: !!data.tomerJoined,
      tomChoice: data.tomChoice ?? null,
      tomerChoice: data.tomerChoice ?? null,
      choices: data.choices ?? {},
    });
    setScreen('waiting');
  }, []);

  const submitChoice = useCallback(
    async (questionId: string, choice: string) => {
      if (!player) return;
      await fetch(SESSION_API, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player, questionId, choice }),
      });
      await fetchSession();
    },
    [player, fetchSession]
  );

  const handleTryAgainQuestion = useCallback(
    async (questionId: string) => {
      await fetch(SESSION_API, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetQuestionId: questionId }),
      });
      await fetchSession();
    },
    [fetchSession]
  );

  const handleResetGame = useCallback(async () => {
    if (!confirm('לאפס את המשחק? שני השחקנים יצטרכו להיכנס מחדש.')) return;
    const res = await fetch(SESSION_API, { method: 'DELETE' });
    if (!res.ok) return;
    setScreen('landing');
    setPlayer(null);
    setSession(null);
    setCelebrateMatch(false);
  }, []);

  return (
    <div className="sex-expectations-page" dir="rtl">
      <header className="sex-expectations-header">
        <Link href="/sex" className="sex-positions-back">
          ← חזרה
        </Link>
        <h1 className="sex-expectations-title">התאמת ציפיות</h1>
      </header>

      <main className="sex-expectations-main">
        <AnimatePresence mode="wait">
          {screen === 'landing' && (
            <motion.section
              key="landing"
              className="sex-expectations-step"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="sex-expectations-turn-label">מי אתה?</p>
              <p className="sex-expectations-instruction">בחר את השם שלך. כששניכם בפנים – המשחק יתחיל.</p>
              <div className="sex-expectations-cards">
                <button type="button" className="sex-expectations-card" onClick={() => handleEnter('tom')}>
                  תום
                </button>
                <button type="button" className="sex-expectations-card" onClick={() => handleEnter('tomer')}>
                  תומר
                </button>
              </div>
              <button type="button" className="sex-expectations-reset-btn" onClick={handleResetGame}>
                איפוס משחק
              </button>
            </motion.section>
          )}

          {screen === 'waiting' && (
            <motion.section
              key="waiting"
              className="sex-expectations-step"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="sex-expectations-pass-text">מחכים לבן/בת הזוג</p>
              <p className="sex-expectations-instruction">הפרטנר יבחר את השם שלו – המשחק יתחיל.</p>
            </motion.section>
          )}

          {screen === 'game' && player && currentQuestion && noMatchCurrent && (
            <motion.section
              key={`nomatch-${currentQuestion.id}`}
              className="sex-expectations-step"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="sex-expectations-nomatch-title">לא בחרתם באותו דבר :)</p>
              <p className="sex-expectations-nomatch-sub">
                תסכמו ביניכם איך בא לכם שימשיך הערב ותמשיכו.
              </p>
              <button
                type="button"
                className="sex-expectations-try-again-btn"
                onClick={() => handleTryAgainQuestion(currentQuestion.id)}
              >
                נסו שוב
              </button>
            </motion.section>
          )}

          {screen === 'game' && player && currentQuestion && !noMatchCurrent && (
            <ExpectationsSwipeCard
              key={currentQuestion.id}
              questionId={currentQuestion.id}
              title={currentQuestion.title}
              sideLabels={currentQuestion.sideLabels[player]}
              onSubmit={(choice) => submitChoice(currentQuestion.id, choice)}
              disabled={isWaitingForPartner}
            />
          )}

          {screen === 'result' && player && (
            <motion.section
              key="result"
              className="sex-expectations-step sex-expectations-conclusion"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="sex-expectations-conclusion-title">הרצונות של בן/בת הזוג</p>
              <ul className="sex-expectations-conclusion-list">
                {conclusionLines.map((line, i) => (
                  <li key={i} className="sex-expectations-conclusion-line">
                    {line}
                  </li>
                ))}
              </ul>
              <Link href="/sex" className="sex-expectations-next-btn">
                סיום
              </Link>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <MatchCelebration trigger={celebrateMatch} />
    </div>
  );
}

interface ExpectationsSwipeCardProps {
  questionId: string;
  title: string;
  sideLabels: { left: string; right: string };
  onSubmit: (choice: 'right' | 'left') => void;
  disabled: boolean;
}

function ExpectationsSwipeCard({ title, sideLabels, onSubmit, disabled }: ExpectationsSwipeCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-150, 150], [-12, 12]);
  const leftHintOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);
  const rightHintOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const committedRef = useRef<'right' | 'left' | null>(null);
  const isSubmittingRef = useRef(false);

  const commitChoice = useCallback(
    (choice: 'right' | 'left') => {
      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;
      animate(x, 0, { type: 'spring', stiffness: 300, damping: 30 });
      onSubmit(choice);
    },
    [onSubmit, x]
  );

  const handleDragStart = useCallback(() => {
    committedRef.current = null;
  }, []);

  const handleDrag = useCallback(
    (_: unknown, info: PanInfo) => {
      if (isSubmittingRef.current) return;
      const offset = info.offset.x;
      if (offset > SWIPE_THRESHOLD && committedRef.current !== 'right') {
        committedRef.current = 'right';
        commitChoice('right');
      } else if (offset < -SWIPE_THRESHOLD && committedRef.current !== 'left') {
        committedRef.current = 'left';
        commitChoice('left');
      }
    },
    [commitChoice]
  );

  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      if (isSubmittingRef.current) return;
      const offset = info.offset.x;
      const velocity = info.velocity.x;
      const effective = offset + velocity * 0.15;
      const byOffset = Math.abs(offset) >= SWIPE_THRESHOLD ? offset : effective;
      if (byOffset > SWIPE_THRESHOLD && !committedRef.current) {
        committedRef.current = 'right';
        commitChoice('right');
      } else if (byOffset < -SWIPE_THRESHOLD && !committedRef.current) {
        committedRef.current = 'left';
        commitChoice('left');
      }
    },
    [commitChoice]
  );

  if (disabled) {
    return (
      <motion.section key="game-wait" className="sex-expectations-step" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <p className="sex-expectations-pass-text">בחרת. מחכים לבן/בת הזוג...</p>
      </motion.section>
    );
  }

  return (
    <motion.section
      key="game"
      className="sex-expectations-swipe-step"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <p className="sex-expectations-swipe-title">{title}</p>
      <div className="sex-expectations-swipe-labels-row">
        <span className="sex-expectations-swipe-label sex-expectations-swipe-label-right">
          <span className="sex-expectations-swipe-label-text">{sideLabels.right}</span>
          <span className="sex-expectations-swipe-arrow" aria-hidden>→</span>
        </span>
        <span className="sex-expectations-swipe-label sex-expectations-swipe-label-left">
          <span className="sex-expectations-swipe-arrow" aria-hidden>←</span>
          <span className="sex-expectations-swipe-label-text">{sideLabels.left}</span>
        </span>
      </div>
      <p className="sex-expectations-swipe-instruction">
        <span className="sex-expectations-swipe-instruction-emoji" aria-hidden>↔</span>
        גרור ימינה או שמאלה לבחירה
      </p>
      <div className="sex-expectations-swipe-area">
        <motion.span className="sex-expectations-swipe-hint sex-expectations-swipe-left" style={{ opacity: leftHintOpacity }}>
          ← {sideLabels.left}
        </motion.span>
        <motion.span className="sex-expectations-swipe-hint sex-expectations-swipe-right" style={{ opacity: rightHintOpacity }}>
          {sideLabels.right} →
        </motion.span>
        <motion.div
          className="sex-expectations-swipe-card"
          drag="x"
          dragConstraints={{ left: -200, right: 200 }}
          dragElastic={0.3}
          style={{ x, rotate }}
          onDragStart={handleDragStart}
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
        >
          <span className="sex-expectations-swipe-card-text">↔ גרור לבחירה</span>
        </motion.div>
      </div>
    </motion.section>
  );
}
