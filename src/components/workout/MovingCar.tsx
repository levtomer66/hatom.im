'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '@/lib/workout-i18n';
import {
  CAR_EMOJI,
  FINISH_EMOJI,
  computeCarState,
  kgToMeters,
  formatMeters,
  formatTons,
} from '@/lib/workout-car';

// Shape of GET /api/workout/feed/car (server attaches displayName).
interface CarTotals {
  totalKg: number;
  postCount: number;
  byUser: { userId: string; displayName: string; kg: number; posts: number }[];
}

// Per-device memory of the last level this viewer saw, so a level-up that
// happened while they were away gets celebrated on the next visit.
const LEVEL_SEEN_KEY = 'hatom-car-level-seen';
const LEVEL_UP_FLASH_MS = 4500;

// "The Moving Car" — the group's shared goal, pinned under the header on the
// feed. Every shared workout's volume pushes a 1-ton car along a track
// (1 000 kg = 1 m); reaching the flag levels the group up and moves the flag
// further away. All state is derived from the running total (see
// src/lib/workout-car.ts) — this component only fetches the total and draws.
// The track itself is always left→right (forced LTR in CSS), as specified.
//
// `refreshKey`: bump to refetch (e.g. after the viewer unshares a post).
export default function MovingCar({ refreshKey = 0 }: { refreshKey?: number }) {
  const t = useT();
  const [totals, setTotals] = useState<CarTotals | null>(null);
  const [levelUp, setLevelUp] = useState(false);
  // The flash timer lives in a ref so a refetch mid-flash can't strand the
  // toast: only unmount clears it, and a new level-up restarts it.
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/workout/feed/car');
        if (!res.ok) return;
        const data: CarTotals = await res.json();
        if (!cancelled) setTotals(data);
      } catch (error) {
        console.error('Error loading car totals:', error);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  const state = useMemo(() => (totals ? computeCarState(totals.totalKg) : null), [totals]);

  // Level-up flash: only when this device has seen a LOWER level before (a
  // first visit just records the level quietly).
  useEffect(() => {
    if (!state) return;
    try {
      const seen = Number(window.localStorage.getItem(LEVEL_SEEN_KEY) ?? '0');
      if (seen > 0 && state.level > seen) {
        setLevelUp(true);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setLevelUp(false), LEVEL_UP_FLASH_MS);
      }
      window.localStorage.setItem(LEVEL_SEEN_KEY, String(state.level));
    } catch {
      // localStorage unavailable (private mode etc.) — the strip still renders.
    }
  }, [state]);

  // Render nothing until the totals arrive: a 0 → real jump would read as
  // the car rolling backwards.
  if (!totals || !state) return null;

  const pct = Math.round(state.progress * 1000) / 10; // one decimal, stable string
  const progressM = kgToMeters(state.progressKg);
  const targetM = kgToMeters(state.levelTargetKg);
  const remainingM = kgToMeters(state.remainingKg);
  const ton = t('car.ton_short');
  const meter = t('car.meter_short');

  return (
    <section
      className={`car-strip${levelUp ? ' car-strip-levelup' : ''}`}
      aria-label={t('car.aria')}
      title={t('car.rule')}
    >
      <div className="car-strip-head">
        <span className="car-strip-title">{CAR_EMOJI} {t('car.title')}</span>
        <span className="car-strip-level">{t('car.level')} {state.level}</span>
      </div>

      <div
        className="car-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={Math.round(targetM)}
        aria-valuenow={Math.round(progressM)}
        aria-valuetext={`${formatMeters(progressM)} / ${formatMeters(targetM)} ${meter}`}
      >
        <div className="car-track-fill" style={{ width: `${pct}%` }} />
        <span className="car-track-car" style={{ left: `${pct}%` }} aria-hidden="true">
          {CAR_EMOJI}
        </span>
        <span className="car-track-flag" aria-hidden="true">{FINISH_EMOJI}</span>
      </div>

      <div className="car-strip-foot">
        <span className="car-strip-distance">
          <strong>{formatMeters(progressM)}</strong> / {formatMeters(targetM)} {meter}
        </span>
        <span className="car-strip-remaining">
          {totals.postCount === 0
            ? t('car.empty')
            : t('car.to_go').replace('{m}', formatMeters(remainingM))}
        </span>
      </div>

      {totals.byUser.length > 0 && (
        <div className="car-strip-pushers">
          {totals.byUser.map((u, i) => (
            <React.Fragment key={u.userId}>
              {i > 0 && ' · '}
              <strong>{u.displayName}</strong> {formatTons(u.kg)} {ton}
            </React.Fragment>
          ))}
        </div>
      )}

      {levelUp && (
        <div className="car-strip-toast" role="status">
          🎉 {t('car.level_up')}
        </div>
      )}
    </section>
  );
}
