import mongoose from 'mongoose';
import WorkoutTemplateModel from '@/models/WorkoutTemplate';
import WorkoutModel from '@/models/Workout';
import { TemplateExercise, DEFAULT_NUM_SETS, MIN_SETS, MAX_SETS } from '@/types/workout';
import { resolveExerciseId } from '@/data/exercise-library';
import { isOwnerEmail, OWNER_EMAILS } from '@/types/auth';

// Shared template logic — normalisation, sanitisation, and read helpers —
// consolidated out of the three template route files (and reused by the
// bootstrap endpoint) so there's a single source of truth.

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  const uri = process.env.MONGODB_URI!;
  await mongoose.connect(uri);
}

// Legacy shape: some templates still store { exerciseIds: string[] } from
// before per-exercise defaults existed. Either shape normalises to the new
// { exercises: TemplateExercise[] }.
export type LegacyTemplate = {
  _id: mongoose.Types.ObjectId | string;
  exerciseIds?: string[];
  exercises?: TemplateExercise[];
  [key: string]: unknown;
};

// Resolve legacy/renamed exercise IDs to canonical form, then drop duplicates
// that collapse together (e.g. lat-pulldown + wide-grip-lat-pulldown). Keeps
// the first occurrence's numSets / notes / supersetGroup.
export function dedupeByExerciseId(entries: TemplateExercise[]): TemplateExercise[] {
  const seen = new Set<string>();
  const out: TemplateExercise[] = [];
  for (const e of entries) {
    const canonical = resolveExerciseId(e.exerciseId);
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    out.push({ ...e, exerciseId: canonical });
  }
  return out;
}

export function normalizeTemplate(t: LegacyTemplate) {
  const rawExercises: TemplateExercise[] =
    Array.isArray(t.exercises) && t.exercises.length > 0
      ? t.exercises.map((e) => ({
          exerciseId: e.exerciseId,
          numSets: typeof e.numSets === 'number' ? e.numSets : DEFAULT_NUM_SETS,
          notes: typeof e.notes === 'string' ? e.notes : '',
          supersetGroup: typeof e.supersetGroup === 'number' ? e.supersetGroup : null,
        }))
      : Array.isArray(t.exerciseIds)
        ? t.exerciseIds.map((id) => ({ exerciseId: id, numSets: DEFAULT_NUM_SETS, notes: '', supersetGroup: null }))
        : [];

  const exercises = dedupeByExerciseId(rawExercises);

  const { exerciseIds: _legacy, _id, ...rest } = t;
  void _legacy;
  return {
    ...rest,
    id: _id.toString(),
    exercises,
    // Mirror canonical ids into the legacy field for stale clients still
    // reading template.exerciseIds; safe to remove once none remain.
    exerciseIds: exercises.map((e) => e.exerciseId),
  };
}

export function sanitizeExercises(raw: unknown): TemplateExercise[] {
  if (!Array.isArray(raw)) return [];
  const parsed = raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const e = entry as Record<string, unknown>;
      const exerciseId = typeof e.exerciseId === 'string' ? e.exerciseId.trim() : '';
      if (!exerciseId) return null;
      const rawNum = typeof e.numSets === 'number' ? e.numSets : Number(e.numSets);
      const numSets = Number.isFinite(rawNum)
        ? Math.min(MAX_SETS, Math.max(MIN_SETS, Math.round(rawNum)))
        : DEFAULT_NUM_SETS;
      const notes = typeof e.notes === 'string' ? e.notes : '';
      const supersetGroup =
        typeof e.supersetGroup === 'number' && Number.isFinite(e.supersetGroup)
          ? Math.round(e.supersetGroup)
          : null;
      return { exerciseId, numSets, notes, supersetGroup } as TemplateExercise;
    })
    .filter((e): e is TemplateExercise => e !== null);
  return dedupeByExerciseId(parsed);
}

// Free-text protocol/description, length-capped. undefined = field absent
// (so PUT can distinguish "leave unchanged" from "clear").
export function sanitizeDescription(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  return raw.slice(0, 2000);
}

// Only accept an Instagram permalink; anything else → ''. Absent → undefined.
// Blocks javascript:/data: etc. because the whole string must match.
export function sanitizeInstagramUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const url = raw.trim();
  if (url === '') return '';
  return /^https:\/\/(www\.)?instagram\.com\/[^\s"'<>]*$/i.test(url) ? url : '';
}

// ---- Read helpers (used by the templates GET routes + the bootstrap) ----

export async function getOwnTemplates(userId: string) {
  await connectDB();
  const templates = await WorkoutTemplateModel.find({ userId }).sort({ updatedAt: -1 }).lean();
  return templates.map((t) => normalizeTemplate(t as unknown as LegacyTemplate));
}

export async function getSharedTemplates() {
  await connectDB();
  const templates = await WorkoutTemplateModel
    .find({ sharedByOwner: true, userId: { $in: OWNER_EMAILS } })
    .sort({ updatedAt: -1 })
    .lean();
  return templates.map((t) => normalizeTemplate(t as unknown as LegacyTemplate));
}

// Owner-only: { templateId → workout count } across all users, for the
// shared templates. Non-owners get {} (the UI doesn't surface it for them).
export async function getTemplateUsage(userId: string): Promise<Record<string, number>> {
  if (!isOwnerEmail(userId)) return {};
  await connectDB();
  const shared = await WorkoutTemplateModel
    .find({ sharedByOwner: true, userId: { $in: OWNER_EMAILS } }, { _id: 1 })
    .lean();
  const ids = shared.map((t) => t._id.toString());
  if (ids.length === 0) return {};
  const counts = await WorkoutModel.aggregate<{ _id: string; count: number }>([
    { $match: { templateId: { $in: ids } } },
    { $group: { _id: '$templateId', count: { $sum: 1 } } },
  ]);
  const result: Record<string, number> = {};
  for (const c of counts) result[c._id.toString()] = c.count;
  return result;
}
