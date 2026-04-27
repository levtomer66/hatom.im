'use client';

import React from 'react';
import { useWorkoutTimer } from '@/context/WorkoutTimerContext';
import { useT } from '@/lib/workout-i18n';
import { formatSeconds } from '@/lib/time';

export default function RestTimerBar() {
  const { state, remainingSec, isRunning, add, skip } = useWorkoutTimer();
  const t = useT();

  const showFinished = state.startedAt === null && state.justFinishedAt !== null;
  if (!isRunning && !showFinished) return null;

  const pct = isRunning && state.durationSec > 0
    ? Math.max(0, Math.min(100, ((state.durationSec - remainingSec) / state.durationSec) * 100))
    : 100;

  return (
    <div
      className="rest-timer-bar"
      role="status"
      aria-live="polite"
      data-finished={showFinished ? '1' : undefined}
    >
      <div className="rest-timer-fill" style={{ width: `${pct}%` }} />
      <div className="rest-timer-row">
        <div className="rest-timer-info">
          <span className="rest-timer-label">
            {showFinished ? t('timer.done_label') : (state.label || t('timer.rest_label'))}
          </span>
          <span className="rest-timer-time">
            {showFinished ? '0:00' : formatSeconds(remainingSec)}
          </span>
        </div>
        {isRunning && (
          <div className="rest-timer-actions">
            <button type="button" onClick={() => add(-30)} aria-label={t('timer.minus_30')}>
              −30
            </button>
            <button type="button" onClick={() => add(30)} aria-label={t('timer.add_30')}>
              +30
            </button>
            <button
              type="button"
              className="rest-timer-skip"
              onClick={skip}
              aria-label={t('timer.skip')}
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
