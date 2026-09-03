// "The Moving Car" — the motivation feed's shared, group-wide goal.
//
// A 1-ton car sits on a track. Every kilogram of volume in a SHARED workout
// pushes it forward: lifting the car's own weight (1 000 kg) moves it 1 m.
// When it reaches the finish line the group levels up and the next finish
// line is further away (×1.25 per level, rounded to whole metres).
//
// Everything here is a PURE function of the running total of all feed posts'
// `stats.totalVolumeKg`. Nothing is stored: no level document, no write
// races, and the car can never disagree with the posts underneath it. The
// flip side is that unsharing a post rolls the car back — honest, and rare.
//
// Import-free so it is unit-testable with `node --test` and safe to use from
// both client components and route handlers.

export const CAR_WEIGHT_KG = 1000;          // 1 ton lifted → 1 m travelled
export const LEVEL_1_TARGET_M = 50;         // first finish line, in metres
export const LEVEL_GROWTH = 1.25;           // each level is 25% further than the last
export const MAX_LEVEL = 99;                // hard stop so the loop always terminates

export const CAR_EMOJI = '🚗';
export const FINISH_EMOJI = '🏁';

export function kgToMeters(kg: number): number {
  return kg / CAR_WEIGHT_KG;
}

// Distance of level `n`'s track in metres: 50, 63, 78, 98, 122, 153, …
export function levelTargetMeters(level: number): number {
  const lvl = Math.max(1, Math.floor(level));
  return Math.round(LEVEL_1_TARGET_M * Math.pow(LEVEL_GROWTH, lvl - 1));
}

export function levelTargetKg(level: number): number {
  return levelTargetMeters(level) * CAR_WEIGHT_KG;
}

export interface CarState {
  totalKg: number;        // sanitised input (finite, ≥ 0)
  level: number;          // 1-based
  levelStartKg: number;   // cumulative kg at which this level began
  levelTargetKg: number;  // kg needed to finish THIS level (relative to its start)
  progressKg: number;     // kg accumulated within this level
  remainingKg: number;    // kg still needed to finish this level
  progress: number;       // 0..1 along this level's track
}

export function computeCarState(totalKg: number): CarState {
  const total = Number.isFinite(totalKg) && totalKg > 0 ? totalKg : 0;

  let level = 1;
  let levelStartKg = 0;
  let target = levelTargetKg(1);
  while (total - levelStartKg >= target && level < MAX_LEVEL) {
    levelStartKg += target;
    level += 1;
    target = levelTargetKg(level);
  }

  const progressKg = total - levelStartKg;
  return {
    totalKg: total,
    level,
    levelStartKg,
    levelTargetKg: target,
    progressKg,
    remainingKg: Math.max(0, target - progressKg),
    progress: Math.min(1, progressKg / target),
  };
}

// Human distance: one decimal under 100 m ("12.3"), whole metres above.
export function formatMeters(m: number): string {
  if (!Number.isFinite(m) || m <= 0) return '0';
  return m >= 100 ? String(Math.round(m)) : (Math.round(m * 10) / 10).toFixed(1);
}

// Human tonnage for the per-user line: "12.3".
export function formatTons(kg: number): string {
  if (!Number.isFinite(kg) || kg <= 0) return '0';
  return (Math.round(kg / 100) / 10).toFixed(1);
}
