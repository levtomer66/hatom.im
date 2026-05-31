'use client';

import React, { useMemo, useState } from 'react';
import { useWorkoutLanguage } from '@/context/WorkoutLanguageContext';
import { useWorkoutUnit } from '@/context/WorkoutUnitContext';
import { useT, formatDate } from '@/lib/workout-i18n';
import { formatWeight, getUnitSuffix } from '@/lib/weight';
import { formatSeconds } from '@/lib/time';
import {
  ExerciseHistoryEntry,
  WorkoutSet,
  isTimeSet,
} from '@/types/workout';

interface Point {
  date: string;
  value: number;
  isPB: boolean;
  // Rep-mode points carry the number of working sets that were averaged
  // into `value`, so the hover tooltip can show "95 kg avg · 3 sets".
  // Absent for time-mode points.
  setCount?: number;
}

// Average working weight across a workout's rep-mode sets. "Working"
// = has a real load (kg > 0) AND reps logged, so warm-up-only or blank
// rows don't drag the mean down. Returns null when no qualifying set.
// This is the chart metric the owner asked for — average scale per
// workout shows steady progression better than a peak e1RM line, which
// spikes on a single heavy single. (The PB marker on each point is
// still e1RM-derived from the history endpoint and unaffected.)
function avgWorkingKg(sets: WorkoutSet[]): { avg: number; count: number } | null {
  let sum = 0;
  let count = 0;
  for (const s of sets) {
    if (isTimeSet(s)) continue;
    if (s.kg !== null && s.kg > 0 && s.reps !== null && s.reps > 0) {
      sum += s.kg;
      count += 1;
    }
  }
  if (count === 0) return null;
  return { avg: sum / count, count };
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

  // Decide rep-mode (avg working weight) vs time-mode (seconds) by picking
  // whichever has more non-zero workouts. Mixed exercises (weighted planks)
  // usually have many more rep entries than time entries so this is
  // well-behaved. Rep-mode plots the AVERAGE working-set weight per
  // workout — a steadier progression signal than a peak line.
  const { points, mode } = useMemo(() => {
    const ascending = [...history].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const repPts: Point[] = [];
    const timePts: Point[] = [];
    for (const entry of ascending) {
      const avg = avgWorkingKg(entry.sets);
      const sec = bestSeconds(entry.sets);
      if (avg) {
        repPts.push({
          date: entry.date,
          value: avg.avg,
          isPB: entry.isPB,
          setCount: avg.count,
        });
      }
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

  // Average weight shows one decimal — averaging two different loads
  // can land on a .5, and the value is a real measured mean (not an
  // estimate), so a single decimal is honest precision.
  const formatValue = (v: number) =>
    mode === 'rep'
      ? `${formatWeight(Math.round(v * 10) / 10, unit)}${unitSuffix}`
      : formatSeconds(v);

  const hover = hoverIdx !== null ? points[hoverIdx] : null;
  const titleKey = mode === 'rep'
    ? 'exercise_detail.chart_title_avg_weight'
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

        {points.map((p, i) => {
          const isHovered = hoverIdx === i;
          // Per Imp 10 — hovered (or tapped) point gets a visible halo
          // ring around it so the user has a concrete affordance that
          // the chart is interactive. PB stays gold; the halo is the
          // theme accent at low alpha so the existing PB color reads.
          return (
            <g key={i}>
              {isHovered && (
                <circle
                  cx={xOf(i)}
                  cy={yOf(p.value)}
                  r={8}
                  fill="none"
                  stroke="var(--workout-accent)"
                  strokeOpacity={0.35}
                  strokeWidth={2}
                  pointerEvents="none"
                />
              )}
              <circle
                cx={xOf(i)}
                cy={yOf(p.value)}
                r={isHovered ? (p.isPB ? 5.5 : 4) : (p.isPB ? 4 : 2.6)}
                fill={p.isPB ? 'var(--workout-gold)' : 'var(--workout-accent)'}
                stroke={p.isPB ? 'var(--workout-gold)' : 'transparent'}
                strokeWidth={p.isPB ? 1.2 : 0}
                onMouseEnter={() => setHoverIdx(i)}
                onClick={() => setHoverIdx(i)}
                style={{ cursor: 'pointer', transition: 'r 0.12s ease' }}
              />
            </g>
          );
        })}

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
            {/* "avg · N sets" makes clear the plotted value is the mean
                working weight across that workout's sets, not a single set. */}
            {mode === 'rep' && hover.setCount != null && (
              <span style={{ marginInlineStart: 4, color: 'var(--workout-text-muted)' }}>
                {t('exercise_detail.chart_avg_suffix')} · {hover.setCount} {t('exercise_detail.chart_sets')}
              </span>
            )}
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
