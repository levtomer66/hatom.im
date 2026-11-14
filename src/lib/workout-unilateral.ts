import type { SetSide, WorkoutSet } from '@/types/workout';

// Unilateral ("single-arm / single-leg") exercises: each logical set is
// logged as TWO WorkoutSet rows, one per side, tagged `side: 'left'|'right'`
// and stored in L,R,L,R… order. Keeping each side as a real set means volume,
// e1RM, PBs and completion all keep working unchanged — a set is still
// kg × reps. The per-user gear toggle (ExerciseLoadPref.unilateral) decides
// how NEW sets are shaped; rendering is driven by the stored `side` tags, so
// history shows L/R no matter what the setting is today.
//
// Import-free (type-only import is erased) so node --test can load it.

export function isSidedSet(s: WorkoutSet): s is WorkoutSet & { side: SetSide } {
  return s.side === 'left' || s.side === 'right';
}

export function isUnilateralSets(sets: readonly WorkoutSet[]): boolean {
  return sets.some(isSidedSet);
}

// Any right-side row with something logged — merging back to two-sided
// would drop it, so the UI confirms first.
export function hasLoggedRightSide(sets: readonly WorkoutSet[]): boolean {
  return sets.some((s) => s.side === 'right' && (s.reps != null || (s.seconds ?? 0) > 0));
}

// Number of logical sets — what the set-count tuner shows and what a
// template's numSets means. A unilateral pair counts once.
export function logicalSetCount(sets: readonly WorkoutSet[]): number {
  if (!isUnilateralSets(sets)) return sets.length;
  return Math.max(
    sets.filter((s) => s.side === 'left').length,
    sets.filter((s) => s.side === 'right').length,
  );
}

// 1-based logical set number for the row at `index` — "Set 2" for both the
// L and R rows of the second pair; plain index + 1 for a normal set.
export function setNumber(sets: readonly WorkoutSet[], index: number): number {
  const row = sets[index];
  if (!row || !isSidedSet(row)) return index + 1;
  let n = 0;
  for (let i = 0; i <= index; i++) if (sets[i].side === row.side) n++;
  return n;
}

function blankLike(s: WorkoutSet | undefined): WorkoutSet {
  // Same weight + mode + rung as its partner, but nothing logged yet.
  return {
    kg: s?.kg ?? null,
    reps: null,
    seconds: s && s.seconds != null ? 0 : null,
    stepId: s?.stepId ?? null,
  };
}

// Split each bilateral set into a left (the original) + right (same kg,
// nothing logged) pair. Already-sided input is returned as is.
export function toUnilateral(sets: readonly WorkoutSet[]): WorkoutSet[] {
  if (isUnilateralSets(sets)) return [...sets];
  return sets.flatMap((s) => [
    { ...s, side: 'left' as const },
    { ...blankLike(s), side: 'right' as const },
  ]);
}

// Collapse L/R pairs back to one set per pair. Keeps the left row, unless
// only the right one has anything logged. Unsided input is returned as is.
export function toBilateral(sets: readonly WorkoutSet[]): WorkoutSet[] {
  if (!isUnilateralSets(sets)) return [...sets];
  const lefts = sets.filter((s) => s.side !== 'right');
  const rights = sets.filter((s) => s.side === 'right');
  const n = Math.max(lefts.length, rights.length);
  const logged = (s: WorkoutSet | undefined) =>
    !!s && (s.reps != null || (s.seconds ?? 0) > 0);
  return Array.from({ length: n }, (_, i) => {
    const l = lefts[i];
    const r = rights[i];
    const pick = (logged(l) || !logged(r) ? (l ?? r) : r) as WorkoutSet;
    return { ...pick, side: null };
  });
}

// Resize to `count` logical sets, appending blank sets (blank pairs when
// unilateral) or trimming from the end.
export function resizeSets(sets: readonly WorkoutSet[], count: number): WorkoutSet[] {
  const blank = (): WorkoutSet => ({ kg: null, reps: null, seconds: null });
  if (!isUnilateralSets(sets)) {
    if (count <= sets.length) return sets.slice(0, count);
    return [...sets, ...Array.from({ length: count - sets.length }, blank)];
  }
  const current = logicalSetCount(sets);
  if (count <= current) {
    const kept: WorkoutSet[] = [];
    const seen = { left: 0, right: 0 };
    for (const s of sets) {
      const side = s.side === 'right' ? 'right' : 'left';
      if (seen[side] < count) {
        kept.push(s);
        seen[side]++;
      }
    }
    return kept;
  }
  const extra = Array.from({ length: count - current }, () => [
    { ...blank(), side: 'left' as const },
    { ...blank(), side: 'right' as const },
  ]).flat();
  return [...sets, ...extra];
}

// Pick one prior set per slot for prefilling a new exercise from history
// (`PersonalBest.lastSets`), shaped for the CURRENT setting. Returns
// `count` slots (×2 when unilateral, L,R,L,R…), each the prior set to copy
// kg/mode/rung from with the right `side` stamped on. Short history repeats
// its last entry; a unilateral history read bilaterally uses its left lane.
export function shapePriorSets(
  prior: readonly WorkoutSet[],
  count: number,
  unilateral: boolean,
): WorkoutSet[] {
  if (prior.length === 0) return [];
  const pick = (arr: readonly WorkoutSet[], i: number) => arr[Math.min(i, arr.length - 1)];
  const priorSided = isUnilateralSets(prior);
  const lefts = priorSided ? prior.filter((s) => s.side !== 'right') : prior;
  const rights = priorSided ? prior.filter((s) => s.side === 'right') : prior;
  const leftLane = lefts.length > 0 ? lefts : rights;
  const rightLane = rights.length > 0 ? rights : lefts;

  const out: WorkoutSet[] = [];
  for (let i = 0; i < count; i++) {
    if (unilateral) {
      out.push({ ...pick(leftLane, i), side: 'left' });
      out.push({ ...pick(rightLane, i), side: 'right' });
    } else {
      out.push({ ...pick(leftLane, i), side: null });
    }
  }
  return out;
}
