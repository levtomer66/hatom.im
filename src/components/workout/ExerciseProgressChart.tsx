'use client';

import React, { useMemo, useState } from 'react';
import { useWorkoutLanguage } from '@/context/WorkoutLanguageContext';
import { useWorkoutUnit } from '@/context/WorkoutUnitContext';
import { useT, formatDate } from '@/lib/workout-i18n';
import { formatWeight, getUnitSuffix } from '@/lib/weight';
import { formatSeconds } from '@/lib/time';
import { ExerciseHistoryEntry, WorkoutSet, isTimeSet } from '@/types/workout';

interface Point {
  date: string;
  value: number;
  isPB: boolean;
}

// Best rep-mode kg in a workout (highest weight across rep sets).
function bestKg(sets: WorkoutSet[]): number {
  let max = 0;
  for (const s of sets) {
    if (s.kg !== null && s.kg > 0 && s.reps !== null && s.kg > max) max = s.kg;
  }
  return max;
}

// Best time-mode seconds in a workout (longest hold; weighted holds preferred
// by kg, ties broken by seconds — same rule as the PB endpoint).
function bestSeconds(sets: WorkoutSet[]): number {
  let best = 0;
  let bestKgTier = -1;
  for (const s of sets) {
    if (!isTimeSet(s) || (s.seconds ?? 0) <= 0) continue;
    const kg = s.kg ?? 0;
    const sec = s.seconds as number;
    if (kg > bestKgTier || (kg === bestKgTier && sec > best)) {
      bestKgTier = kg;
      best = sec;
    }
  }
  return best;
}

interface Props {
  history: ExerciseHistoryEntry[];
}

export default function ExerciseProgressChart({ history }: Props) {
  const { language } = useWorkoutLanguage();
  const { unit } = useWorkoutUnit();
  const t = useT();
  const unitSuffix = getUnitSuffix(unit, language);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // Decide rep-mode (kg) vs time-mode (seconds) by picking whichever has more
  // non-zero workouts. Mixed exercises (weighted planks) usually have many
  // more rep entries than time entries so this is well-behaved.
  const { points, mode } = useMemo(() => {
    const ascending = [...history].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const repPts: Point[] = [];
    const timePts: Point[] = [];
    for (const entry of ascending) {
      const kg = bestKg(entry.sets);
      const sec = bestSeconds(entry.sets);
      if (kg > 0) repPts.push({ date: entry.date, value: kg, isPB: entry.isPB });
      if (sec > 0) timePts.push({ date: entry.date, value: sec, isPB: entry.isPB });
    }
    if (repPts.length >= timePts.length) {
      return { points: repPts, mode: 'rep' as const };
    }
    return { points: timePts, mode: 'time' as const };
  }, [history]);

  if (points.length < 2) return null;

  const W = 320;
  const H = 140;
  const padL = 36;
  const padR = 10;
  const padT = 10;
  const padB = 22;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const xs = points.map((_, i) => i);
  const minX = 0;
  const maxX = points.length - 1;
  const minY = Math.min(...points.map((p) => p.value));
  const maxY = Math.max(...points.map((p) => p.value));
  // Pad the y range by 10% so the highest point doesn't sit on the top edge.
  const yRange = Math.max(maxY - minY, maxY * 0.1, 1);
  const yLo = Math.max(0, minY - yRange * 0.1);
  const yHi = maxY + yRange * 0.1;

  const xOf = (i: number) =>
    padL + (innerW * (i - minX)) / Math.max(maxX - minX, 1);
  const yOf = (v: number) =>
    padT + innerH - (innerH * (v - yLo)) / (yHi - yLo);

  const linePath = xs
    .map((i) => `${i === 0 ? 'M' : 'L'} ${xOf(i).toFixed(1)} ${yOf(points[i].value).toFixed(1)}`)
    .join(' ');

  // Y axis tick marks — 3 evenly spaced lines.
  const yTicks = [yLo, (yLo + yHi) / 2, yHi];

  // Show first, middle, last date label to avoid crowding.
  const xLabelIdxs = points.length <= 3
    ? points.map((_, i) => i)
    : [0, Math.floor(points.length / 2), points.length - 1];

  const formatValue = (v: number) =>
    mode === 'rep'
      ? `${formatWeight(v, unit)}${unitSuffix}`
      : formatSeconds(v);

  const hover = hoverIdx !== null ? points[hoverIdx] : null;
  const titleKey = mode === 'rep'
    ? 'exercise_detail.chart_title_weight'
    : 'exercise_detail.chart_title_time';

  return (
    <div
      className="workout-card"
      style={{ marginBottom: '24px', padding: '12px 12px 8px' }}
    >
      <h3
        style={{
          fontSize: '14px',
          fontWeight: 600,
          marginBottom: '4px',
          color: 'var(--workout-text-secondary)',
        }}
      >
        {t(titleKey)}
      </h3>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label={t(titleKey)}
        onMouseLeave={() => setHoverIdx(null)}
        style={{ display: 'block', direction: 'ltr' }}
      >
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={padL}
              x2={W - padR}
              y1={yOf(tick)}
              y2={yOf(tick)}
              stroke="var(--workout-border)"
              strokeDasharray={i === 0 ? '' : '2 3'}
              strokeWidth={0.7}
            />
            <text
              x={padL - 4}
              y={yOf(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="9"
              fill="var(--workout-text-muted)"
            >
              {mode === 'rep' ? Math.round(tick) : formatSeconds(tick)}
            </text>
          </g>
        ))}

        <path
          d={linePath}
          fill="none"
          stroke="var(--workout-accent)"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((p, i) => (
          <circle
            key={i}
            cx={xOf(i)}
            cy={yOf(p.value)}
            r={p.isPB ? 4 : 2.6}
            fill={p.isPB ? 'var(--workout-gold)' : 'var(--workout-accent)'}
            stroke={p.isPB ? 'var(--workout-gold)' : 'transparent'}
            strokeWidth={p.isPB ? 1.2 : 0}
            onMouseEnter={() => setHoverIdx(i)}
            onClick={() => setHoverIdx(i)}
            style={{ cursor: 'pointer' }}
          />
        ))}

        {xLabelIdxs.map((i) => (
          <text
            key={i}
            x={xOf(i)}
            y={H - 6}
            textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
            fontSize="9"
            fill="var(--workout-text-muted)"
          >
            {formatDate(points[i].date, language, { month: 'short', day: 'numeric' })}
          </text>
        ))}
      </svg>
      <div
        style={{
          fontSize: '12px',
          color: 'var(--workout-text-muted)',
          textAlign: 'center',
          minHeight: '18px',
          marginTop: '2px',
        }}
      >
        {hover ? (
          <>
            <span style={{ fontWeight: 600, color: 'var(--workout-text-secondary)' }}>
              {formatValue(hover.value)}
            </span>
            {' · '}
            {formatDate(hover.date, language, { year: 'numeric', month: 'short', day: 'numeric' })}
            {hover.isPB && <span style={{ marginInlineStart: 6 }}>🥇</span>}
          </>
        ) : (
          <span>
            {t('exercise_detail.chart_hint')} · {points.length} {t('exercise_detail.chart_workouts')}
          </span>
        )}
      </div>
    </div>
  );
}
