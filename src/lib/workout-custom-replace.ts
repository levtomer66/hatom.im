import mongoose from 'mongoose';
import CustomExerciseModel from '@/models/CustomExercise';
import WorkoutModel from '@/models/Workout';
import WorkoutTemplateModel from '@/models/WorkoutTemplate';
import { getUserSettings, applyExerciseLoadMove } from '@/models/WorkoutUserSettings';
import { recomputeAndStorePersonalBests } from '@/lib/workout-pb';
import { normalizeTemplate } from '@/lib/workout-templates';
import { getExerciseById, resolveExerciseId } from '@/data/exercise-library';
import { MERGED_AWAY } from '@/data/exercise-movements';
import { moveLoadPref, replaceInTemplateList } from '@/lib/workout-replace-exercise';
import type { TemplateExercise } from '@/types/workout';

// "Replace my custom exercise with a built-in one", with the history
// backfill: every one of the user's workouts and templates that uses the
// custom switches to the built-in, the gear preference moves over, PBs are
// recomputed, and the custom is retired with `replacedBy` set. Scoped to the
// caller (customs are per user). Each step is idempotent, so a run that dies
// half-way is finished by running it again.

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGODB_URI!);
}

export type ReplaceError = 'custom-not-found' | 'target-not-built-in';

export interface ReplaceCounts {
  workouts: number;
  templates: number;
}

async function findCustom(userId: string, customId: string) {
  return CustomExerciseModel.findOne({ userId, exerciseId: customId }).lean();
}

function workoutFilter(userId: string, customId: string) {
  return { userId, $or: [{ 'exercises.exerciseId': customId }, { 'exercises.replacedFromExerciseId': customId }] };
}

function templateFilter(userId: string, customId: string) {
  return { userId, $or: [{ 'exercises.exerciseId': customId }, { exerciseIds: customId }] };
}

/** How many of the user's workouts and templates use the custom (for the confirm step). */
export async function countCustomUsage(userId: string, customId: string): Promise<ReplaceCounts | ReplaceError> {
  await connectDB();
  if (!(await findCustom(userId, customId))) return 'custom-not-found';
  const [workouts, templates] = await Promise.all([
    WorkoutModel.countDocuments(workoutFilter(userId, customId)),
    WorkoutTemplateModel.collection.countDocuments(templateFilter(userId, customId)),
  ]);
  return { workouts, templates };
}

export async function replaceCustomExercise(
  userId: string,
  customId: string,
  rawTargetId: string,
): Promise<(ReplaceCounts & { targetId: string }) | ReplaceError> {
  await connectDB();
  // The id the picker would show: merged-away ids land on what they merged into.
  const resolved = resolveExerciseId(rawTargetId);
  const targetId = MERGED_AWAY[resolved] ?? resolved;
  if (!getExerciseById(targetId)) return 'target-not-built-in';
  if (!(await findCustom(userId, customId))) return 'custom-not-found';

  // 1. Workouts (completed and in progress). The frozen `load` snapshot on
  //    each exercise is kept, so past volume doesn't move.
  //    Counted first, with the confirm step's filter, so both report the same.
  const workouts = await WorkoutModel.countDocuments(workoutFilter(userId, customId));
  await WorkoutModel.collection.updateMany(
    { userId, 'exercises.exerciseId': customId },
    { $set: { 'exercises.$[e].exerciseId': targetId } },
    { arrayFilters: [{ 'e.exerciseId': customId }] },
  );
  // "was: X" annotations on mid-workout swaps. A swap from the custom to the
  // target itself would now read "was: <same exercise>", so it's dropped.
  await WorkoutModel.collection.updateMany(
    { userId, 'exercises.replacedFromExerciseId': customId },
    { $set: { 'exercises.$[e].replacedFromExerciseId': targetId } },
    { arrayFilters: [{ 'e.replacedFromExerciseId': customId, 'e.exerciseId': { $ne: targetId } }] },
  );
  await WorkoutModel.collection.updateMany(
    { userId, 'exercises.replacedFromExerciseId': customId },
    { $unset: { 'exercises.$[e].replacedFromExerciseId': '' } },
    { arrayFilters: [{ 'e.replacedFromExerciseId': customId }] },
  );

  // 2. Templates, legacy shape included. A template that already has the
  //    built-in keeps a single entry.
  const templates = await WorkoutTemplateModel.collection.find(templateFilter(userId, customId)).toArray();
  for (const t of templates) {
    const { exercises } = normalizeTemplate(t as unknown as Parameters<typeof normalizeTemplate>[0]);
    const next = replaceInTemplateList(exercises as TemplateExercise[], customId, targetId);
    await WorkoutTemplateModel.collection.updateOne(
      { _id: t._id },
      { $set: { exercises: next, updatedAt: new Date() }, $unset: { exerciseIds: '' } },
    );
  }

  // 3. The ⚙️ gear preference.
  const settings = await getUserSettings(userId);
  const move = moveLoadPref(settings.exerciseLoad, customId, targetId);
  if (move.unset.length) await applyExerciseLoadMove(userId, move);

  // 4. Retire the custom, pointing at what replaced it.
  //    Raw collection: a hot-reloaded dev model may predate `replacedBy`.
  await CustomExerciseModel.collection.updateOne(
    { userId, exerciseId: customId },
    { $set: { retired: true, replacedBy: targetId } },
  );

  // 5. PBs: the custom's sets now count toward the built-in.
  await recomputeAndStorePersonalBests(userId);

  return { workouts, templates: templates.length, targetId };
}
