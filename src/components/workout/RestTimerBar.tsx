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
            {/* ±15 to match the global default-timer popover step. Single
                consistent step keeps the muscle memory between the prefs
                menu and the running pill aligned. */}
            <button type="button" onClick={() => add(-15)} aria-label={t('timer.minus_15')}>
              −15
            </button>
            <button type="button" onClick={() => add(15)} aria-label={t('timer.add_15')}>
              +15
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
