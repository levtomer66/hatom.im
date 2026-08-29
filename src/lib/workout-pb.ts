import mongoose from 'mongoose';
import WorkoutModel from '@/models/Workout';
import PersonalBestStore from '@/models/PersonalBestStore';
import {
  PersonalBest,
  WorkoutSet,
  isTimeSet,
  bestE1rmFromSets,
  BestE1rm,
} from '@/types/workout';
import { resolveExerciseId } from '@/data/exercise-library';
import { getProgressionStep, stepIndex } from '@/lib/workout-progression';

// Personal-best computation + a materialized per-user store. The expensive
// full-collection scan (computePersonalBests) now runs only when a workout is
// completed or deleted; the result is persisted to PersonalBestStore so the
// read path (pb route + bootstrap) is a single O(1) document fetch.

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  const uri = process.env.MONGODB_URI!;
  await mongoose.connect(uri);
}

export interface PBMap {
  [exerciseId: string]: PersonalBest;
}

// Highest weight across REP-MODE sets only. Time-mode sets have their own PB
// lane downstream — letting their kg leak in would make a weighted timed hold
// overwrite the exercise's rep-based current weight.
function getHighestKg(sets: WorkoutSet[]): number {
  let max = 0;
  for (const s of sets) {
    if (isTimeSet(s)) continue;
    if (s.kg !== null && s.kg > 0 && s.reps !== null && s.kg > max) max = s.kg;
  }
  return max;
}

// Reps at a specific weight across rep-mode sets only.
function getRepsAtWeight(sets: WorkoutSet[], targetKg: number): number[] {
  return sets
    .filter((s) => !isTimeSet(s) && s.kg === targetKg && s.reps !== null)
    .map((s) => s.reps as number);
}

// Per-exercise running PB candidate. `best*` tracks the rep-mode peak (Epley
// e1RM with rep cap at 10); `current*` tracks the most recent rep-mode
// occurrence (drives prefill + recommendation); time-mode is in a parallel lane.
interface PBCandidate {
  bestE1rm: number | null;
  bestKg: number | null;
  bestReps: number | null;
  bestDate: string | null;
  bestWorkoutId: string | null;

  currentKg: number;
  currentReps: number[];
  currentDate: string;
  currentWorkoutId: string;

  bestSeconds: number | null;
  bestSecondsKg: number | null;
  bestSecondsDate: string | null;
  bestSecondsWorkoutId: string | null;

  // Calisthenics: best per progression step, furthest rung ever logged, and
  // the bodyweight-rep lane.
  stepBests: Record<string, { best: number; date: string; workoutId: string }>;
  frontierStepIndex: number;
  frontierStepId: string | null;
  bestBodyweightReps: number | null;
  bestBodyweightRepsDate: string | null;
  bestBodyweightRepsWorkoutId: string | null;

  lastSets: WorkoutSet[] | null;
  lastSetsDate: string;
}

// Best bodyweight rep set in one workout's sets — rep-mode sets with no added
// weight (kg null or 0). This is the lane `epleyE1rm` can't score, so without
// it max-pull-ups / bodyweight rows record no PB at all. 0 = none.
//
// Laddered sets (those carrying a stepId) are EXCLUDED: they belong to
// `stepBests`, per rung. Otherwise a skill's easiest rung (e.g. assisted
// pistol × 12) would masquerade as a flat "bodyweight PB" for the exercise.
function getBestBodyweightReps(sets: WorkoutSet[]): number {
  let max = 0;
  for (const s of sets) {
    if (isTimeSet(s)) continue;
    if (s.stepId) continue;
    const bodyweight = s.kg === null || s.kg === 0;
    if (bodyweight && s.reps !== null && s.reps > 0 && s.reps > max) max = s.reps;
  }
  return max;
}

// Per-set progression measurements in one workout: for each set carrying a
// valid ladder step, the value in the step's own unit (seconds for holds,
// reps for dynamic) plus the step's ladder index (for frontier tracking).
function getStepMeasurements(
  exerciseId: string,
  sets: WorkoutSet[],
): Array<{ stepId: string; value: number; index: number }> {
  const out: Array<{ stepId: string; value: number; index: number }> = [];
  for (const s of sets) {
    if (!s.stepId) continue;
    const step = getProgressionStep(exerciseId, s.stepId);
    if (!step) continue;
    const value = step.measure === 'seconds' ? (s.seconds ?? 0) : (s.reps ?? 0);
    if (value <= 0) continue;
    out.push({ stepId: s.stepId, value, index: stepIndex(exerciseId, s.stepId) });
  }
  return out;
}

// Pick the best time-mode (kg, seconds) tuple from a single workout's sets.
// Highest kg wins; ties broken by longest seconds.
function getBestTimeMode(sets: WorkoutSet[]): { kg: number; seconds: number } | null {
  let best: { kg: number; seconds: number } | null = null;
  for (const s of sets) {
    if (!isTimeSet(s) || (s.seconds ?? 0) <= 0) continue;
    const seconds = s.seconds as number;
    const kg = s.kg ?? 0;
    if (
      best === null ||
      kg > best.kg ||
      (kg === best.kg && seconds > best.seconds)
    ) {
      best = { kg, seconds };
    }
  }
  return best;
}

// Pure PB computation for one user — the expensive full-collection scan. Only
// invoked by recomputeAndStorePersonalBests (on workout complete/delete) and
// the lazy first-read init, never on the hot read path.
async function computePersonalBests(userId: string): Promise<PBMap> {
  await connectDB();

  // Workouts most-recent first so `last*` and `current*` fields stay correct
  // on first encounter. Projected to only the fields PB needs (date, _id, and
  // each exercise's id + sets) so the scan doesn't drag the full docs —
  // notes, photos, metadata — over the slow shared tier.
  const workouts = await WorkoutModel
    .find({ userId }, { date: 1, 'exercises.exerciseId': 1, 'exercises.sets': 1 })
    .sort({ date: -1 })
    .lean();

  const pbCandidates: Record<string, PBCandidate> = {};

  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      const sets = exercise.sets || [];
      const highestKg = getHighestKg(sets);
      const timeBest = getBestTimeMode(sets);
      const setBest: BestE1rm | null = bestE1rmFromSets(sets);
      const exerciseId = resolveExerciseId(exercise.exerciseId);
      const bwReps = getBestBodyweightReps(sets);
      const stepMeas = getStepMeasurements(exerciseId, sets);

      // Skip when this workout's exercise has NO usable data at all — no
      // rep-mode weight, no timed hold, no bodyweight reps, no step data.
      // (The old guard checked only weight/time, which would have discarded
      // bodyweight-only and skill-only sessions.)
      if (highestKg <= 0 && timeBest === null && bwReps <= 0 && stepMeas.length === 0) continue;

      if (!pbCandidates[exerciseId]) {
        pbCandidates[exerciseId] = {
          bestE1rm: null,
          bestKg: null,
          bestReps: null,
          bestDate: null,
          bestWorkoutId: null,
          currentKg: 0,
          currentReps: [],
          currentDate: '',
          currentWorkoutId: '',
          bestSeconds: null,
          bestSecondsKg: null,
          bestSecondsDate: null,
          bestSecondsWorkoutId: null,
          stepBests: {},
          frontierStepIndex: -1,
          frontierStepId: null,
          bestBodyweightReps: null,
          bestBodyweightRepsDate: null,
          bestBodyweightRepsWorkoutId: null,
          lastSets: null,
          lastSetsDate: '',
        };
      }

      const candidate = pbCandidates[exerciseId];

      // Capture the most recent sets verbatim (drives kg-prefill).
      if (
        candidate.lastSets === null ||
        new Date(workout.date) > new Date(candidate.lastSetsDate)
      ) {
        candidate.lastSets = sets.map((s) => ({
          kg: s.kg ?? null,
          reps: s.reps ?? null,
          seconds: s.seconds ?? null,
          stepId: s.stepId ?? null,
        }));
        candidate.lastSetsDate = workout.date;
      }

      // Time-mode PB: highest kg wins, ties broken by longest seconds.
      if (timeBest !== null) {
        const isBetter =
          candidate.bestSecondsKg === null ||
          timeBest.kg > candidate.bestSecondsKg ||
          (timeBest.kg === candidate.bestSecondsKg &&
            candidate.bestSeconds !== null &&
            timeBest.seconds > candidate.bestSeconds);
        if (isBetter) {
          candidate.bestSeconds = timeBest.seconds;
          candidate.bestSecondsKg = timeBest.kg;
          candidate.bestSecondsDate = workout.date;
          candidate.bestSecondsWorkoutId = workout._id.toString();
        }
      }

      // Bodyweight-rep PB lane: most reps at bodyweight, ever.
      if (
        bwReps > 0 &&
        (candidate.bestBodyweightReps === null || bwReps > candidate.bestBodyweightReps)
      ) {
        candidate.bestBodyweightReps = bwReps;
        candidate.bestBodyweightRepsDate = workout.date;
        candidate.bestBodyweightRepsWorkoutId = workout._id.toString();
      }

      // Per-step bests + frontier. Outer loop is date-desc, so on a tie the
      // existing (earlier-seen) entry is already the more recent one; `>`
      // keeps the frontier at the furthest rung and best at the top value.
      for (const m of stepMeas) {
        const prev = candidate.stepBests[m.stepId];
        if (!prev || m.value > prev.best) {
          candidate.stepBests[m.stepId] = {
            best: m.value,
            date: workout.date,
            workoutId: workout._id.toString(),
          };
        }
        if (m.index > candidate.frontierStepIndex) {
          candidate.frontierStepIndex = m.index;
          candidate.frontierStepId = m.stepId;
        }
      }

      // Rep-mode tracking — only runs when this workout has rep data, so a
      // time-only iteration can't stomp on currentKg.
      if (highestKg > 0) {
        // PB candidate: did this workout produce a better e1RM than anything
        // previously seen? Ties resolve to the more recent occurrence — outer
        // loop is desc, so an existing best is already the most recent.
        if (
          setBest !== null &&
          (candidate.bestE1rm === null || setBest.e1rm > candidate.bestE1rm)
        ) {
          candidate.bestE1rm = setBest.e1rm;
          candidate.bestKg = setBest.kg;
          candidate.bestReps = setBest.reps;
          candidate.bestDate = workout.date;
          candidate.bestWorkoutId = workout._id.toString();
        }

        // Current working weight = highest kg used most recently.
        if (candidate.currentDate === '' || highestKg > candidate.currentKg) {
          const repsAtHighest = getRepsAtWeight(sets, highestKg);
          candidate.currentKg = highestKg;
          candidate.currentReps = repsAtHighest;
          candidate.currentDate = workout.date;
          candidate.currentWorkoutId = workout._id.toString();
        } else if (highestKg === candidate.currentKg) {
          if (new Date(workout.date) > new Date(candidate.currentDate)) {
            candidate.currentReps = getRepsAtWeight(sets, highestKg);
            candidate.currentDate = workout.date;
            candidate.currentWorkoutId = workout._id.toString();
          }
        }
      }
    }
  }

  // Build the final PB map.
  const pbMap: PBMap = {};
  for (const [exerciseId, candidate] of Object.entries(pbCandidates)) {
    // Recommendation: if the user just hit their PB at the current working
    // weight (current >= the PB-producing weight), nudge +2.5 kg next session
    // at the same rep target. Otherwise stick to the current working weight.
    let recommendedKg = candidate.currentKg;
    if (candidate.bestKg !== null && candidate.currentKg >= candidate.bestKg) {
      recommendedKg = candidate.bestKg + 2.5;
    }

    pbMap[exerciseId] = {
      userId,
      exerciseId,
      bestE1rm: candidate.bestE1rm,
      bestKg: candidate.bestKg,
      bestReps: candidate.bestReps,
      bestDate: candidate.bestDate,
      bestWorkoutId: candidate.bestWorkoutId,
      currentKg: candidate.currentKg,
      currentReps: candidate.currentReps,
      currentDate: candidate.currentDate,
      currentWorkoutId: candidate.currentWorkoutId,
      recommendedKg,
      bestSeconds: candidate.bestSeconds,
      bestSecondsKg: candidate.bestSecondsKg,
      bestSecondsDate: candidate.bestSecondsDate,
      bestSecondsWorkoutId: candidate.bestSecondsWorkoutId,
      lastSets: candidate.lastSets ?? undefined,
      // Calisthenics lanes — included only when the exercise actually has
      // progression/bodyweight data, so weighted exercises stay lean.
      ...(Object.keys(candidate.stepBests).length > 0
        ? { stepBests: candidate.stepBests }
        : {}),
      ...(candidate.frontierStepId ? { frontierStepId: candidate.frontierStepId } : {}),
      ...(candidate.bestBodyweightReps !== null
        ? {
            bestBodyweightReps: candidate.bestBodyweightReps,
            bestBodyweightRepsDate: candidate.bestBodyweightRepsDate,
            bestBodyweightRepsWorkoutId: candidate.bestBodyweightRepsWorkoutId,
          }
        : {}),
    };
  }

  return pbMap;
}

// Read path: return the materialized PB map (one O(1) doc fetch). On the very
// first read for a user (no stored doc yet) it computes + stores once, so the
// store self-populates without a migration.
export async function getStoredPersonalBests(userId: string): Promise<PBMap> {
  await connectDB();
  const doc = await PersonalBestStore.findOne({ userId }).lean();
  if (doc && doc.pbMap) return doc.pbMap as PBMap;
  return recomputeAndStorePersonalBests(userId);
}

// Write path: run the full scan and persist the result. Called only when a
// workout is completed or deleted — not on every autosave — so the scan runs
// at most once per finished workout.
export async function recomputeAndStorePersonalBests(userId: string): Promise<PBMap> {
  const pbMap = await computePersonalBests(userId);
  await PersonalBestStore.updateOne(
    { userId },
    { $set: { pbMap, updatedAt: new Date() } },
    { upsert: true },
  );
  return pbMap;
}
