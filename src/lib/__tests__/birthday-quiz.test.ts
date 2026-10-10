import { test } from 'node:test';
import assert from 'node:assert/strict';
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
  type PreparedQuestion,
  type QuizAction,
  type QuizState,
} from '../birthday-quiz.ts';

const Q: PreparedQuestion[] = [
  { question: 'q1', answers: ['a', 'b', 'c'], correctIndex: 1 },
  { question: 'q2', answers: ['x', 'y'], correctIndex: 0 },
];

const run = (...actions: QuizAction[]): QuizState =>
  actions.reduce(quizReducer, quizReducer(INITIAL_QUIZ_STATE, { type: 'start', questions: Q }));

test('answers reveal one at a time and cannot be picked until all are showing', () => {
  let s = run({ type: 'advance' }, { type: 'advance' });
  assert.equal(s.revealed[0], 2);
  assert.equal(canPick(s), false);
  s = quizReducer(s, { type: 'pick', answer: 1 });
  assert.equal(s.picked[0], null);
  s = quizReducer(s, { type: 'advance' });
  assert.equal(canPick(s), true);
  s = quizReducer(s, { type: 'pick', answer: 1 });
  assert.equal(s.picked[0], 1);
  assert.equal(quizScore(s), 1);
});

test('advance waits for an answer once everything is revealed, then moves on', () => {
  let s = run({ type: 'advance' }, { type: 'advance' }, { type: 'advance' }, { type: 'advance' });
  assert.equal(s.index, 0);
  s = quizReducer(s, { type: 'pick', answer: 0 });
  assert.equal(quizReducer(s, { type: 'pick', answer: 1 }).picked[0], 0, 'answer is locked');
  s = quizReducer(s, { type: 'advance' });
  assert.equal(s.index, 1);
});

test('next/prev move freely and each question keeps its own progress', () => {
  let s = run({ type: 'advance' }, { type: 'next' }, { type: 'prev' });
  assert.equal(s.index, 0);
  assert.equal(s.revealed[0], 1);
  assert.equal(s.revealed[1], 0);
  assert.equal(quizReducer(s, { type: 'prev' }).index, 0, 'no going before the first question');
  s = run({ type: 'next' }, { type: 'next' });
  assert.equal(s.phase, 'done');
  s = quizReducer(s, { type: 'prev' });
  assert.equal(s.phase, 'playing');
  assert.equal(s.index, 1);
});

test('every question has 2+ distinct answers and a valid 1-based correct answer', () => {
  for (const q of QUIZ_QUESTIONS) {
    assert.ok(q.question.trim(), 'empty question');
    assert.ok(q.answers.length >= 2, `fewer than 2 answers: ${q.question}`);
    assert.ok(Number.isInteger(q.correct) && q.correct >= 1 && q.correct <= q.answers.length, `bad correct: ${q.question}`);
    const all = q.answers.map((a) => a.trim());
    assert.ok(all.every(Boolean), `empty answer: ${q.question}`);
    assert.equal(new Set(all).size, all.length, `duplicate answer: ${q.question}`);
  }
});

test('prepareQuiz keeps answer order and converts correct to a 0-based index', () => {
  prepareQuiz(QUIZ_QUESTIONS).forEach((p, i) => {
    assert.deepEqual(p.answers, QUIZ_QUESTIONS[i].answers);
    assert.equal(p.correctIndex, QUIZ_QUESTIONS[i].correct - 1);
  });
});

test('resultMessage tiers', () => {
  assert.equal(resultMessage(5, 5).emoji, '🏆');
  assert.equal(resultMessage(4, 5).emoji, '🎉');
  assert.equal(resultMessage(2, 5).emoji, '🙂');
  assert.equal(resultMessage(0, 5).emoji, '🙈');
  assert.equal(resultMessage(0, 0).emoji, '🙈');
});

test('splitEmphasis puts *bold* parts at odd indexes', () => {
  assert.deepEqual(splitEmphasis('מה היא *לא* מצאה'), ['מה היא ', 'לא', ' מצאה']);
  assert.deepEqual(splitEmphasis('plain'), ['plain']);
});

test('celebrates at 70% and up, never on an empty quiz', () => {
  assert.equal(celebrates(7, 10), true);
  assert.equal(celebrates(6, 10), false);
  assert.equal(celebrates(0, 0), false);
});

test('advance on an empty quiz is a no-op', () => {
  const s = quizReducer(INITIAL_QUIZ_STATE, { type: 'start', questions: [] });
  assert.equal(quizReducer(s, { type: 'advance' }), s);
});
