'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/workout-i18n';
import { formatSeconds } from '@/lib/time';

interface SetStopwatchProps {
  seconds: number | null;
  onChange: (seconds: number | null) => void;
}

// Per-set stopwatch shown in time-mode rows. Local running state — only the
// final seconds value is committed via onChange so the workout's
// auto-saver doesn't fire every tick. Direct numeric input is also
// supported via the embedded number field (tap the displayed value to
// edit).
export default function SetStopwatch({ seconds, onChange }: SetStopwatchProps) {
  const t = useT();
  const [running, setRunning] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const startRef = useRef<number | null>(null);
  const baseRef = useRef<number>(0);
  const [tick, setTick] = useState(0);

  // 250ms render tick while running — display jitters less than 1Hz.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick(n => n + 1), 250);
    return () => clearInterval(id);
  }, [running]);

  const liveSeconds = (() => {
    if (!running || startRef.current === null) return seconds ?? 0;
    return baseRef.current + Math.floor((Date.now() - startRef.current) / 1000);
  })();
  // tick referenced so the closure recomputes liveSeconds at each render.
  void tick;

  function handleStart() {
    baseRef.current = seconds ?? 0;
    startRef.current = Date.now();
    setRunning(true);
  }

  function handleStop() {
    if (startRef.current !== null) {
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
      const total = baseRef.current + elapsed;
      onChange(total > 0 ? total : null);
    }
    startRef.current = null;
    setRunning(false);
  }

  function handleReset() {
    startRef.current = null;
    baseRef.current = 0;
    setRunning(false);
    onChange(null);
  }

  function startEdit() {
    setEditing(true);
    setDraft(seconds === null ? '' : String(seconds));
  }

  function commitEdit() {
    setEditing(false);
    if (draft === '') { onChange(null); return; }
    const n = parseInt(draft, 10);
    if (Number.isFinite(n) && n >= 0 && n <= 9999) onChange(n);
  }

  return (
    <div className="exercise-form-field set-stopwatch">
      <label>{t('card.sec')}</label>
      {editing ? (
        <input
          type="number"
          inputMode="numeric"
          autoFocus
          className="workout-input workout-input-number"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); }}
          min="0"
          max="9999"
        />
      ) : (
        <button
          type="button"
          className="set-stopwatch-display"
          onClick={running ? handleStop : startEdit}
          title={running ? t('card.stop_stopwatch') : ''}
        >
          {formatSeconds(liveSeconds)}
        </button>
      )}
      <div className="set-stopwatch-actions">
        {!running ? (
          <button type="button" onClick={handleStart} aria-label={t('card.start_stopwatch')}>
            ▶
          </button>
        ) : (
          <button type="button" onClick={handleStop} aria-label={t('card.stop_stopwatch')}>
            ⏸
          </button>
        )}
        {(seconds !== null || running) && (
          <button type="button" onClick={handleReset} aria-label={t('card.reset_stopwatch')}>
            ↺
          </button>
        )}
      </div>
    </div>
  );
}
