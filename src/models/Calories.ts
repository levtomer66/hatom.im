import { ObjectId, MongoServerError } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import {
  MAX_ENTRIES, MAX_GRAMS, mealPerPortion, pushRecent, pushWeighIn, rescaleEntry,
  type Aim, type Entry, type Meal, type MealDoc, type MealItem, type Profile, type Recent, type Settings, type WeighIn,
} from '@/lib/calories/calories';
import type { FoodDoc } from '@/lib/calories/moh';
import type { Nutrition } from '@/lib/shopping/nutrition';

// The calories diary (docs/superpowers/specs/2026-11-21-calories-design.md § Data).
// Every function takes the caller's email: nobody reads or writes anyone else's.

interface DayDoc { _id: string; entries: Entry[]; updatedAt: string; burned?: Record<string, number>; steps?: number }
interface UserDoc {
  _id: string; goal?: number; proteinGoal?: number | null; recent?: Recent[];
  profile?: Profile; aim?: Aim; followRec?: boolean; weighIns?: WeighIn[];
}
/** The workout app's documents, read only (src/models/Workout.ts). */
interface WorkoutRead { _id: ObjectId; workoutName?: string; exercises?: { sets?: { reps?: number | null; seconds?: number | null }[] }[] }
interface MealDocument { _id: ObjectId; owner: string; name: string; portions: number; items: MealItem[]; per: MealDoc['per']; updatedAt: string }
interface LabelDoc { _id: string; nu: Nutrition; by: string; at: string }

async function db() {
  return (await clientPromise).db();
}
const days = async () => (await db()).collection<DayDoc>('caloriesDays');
const users = async () => (await db()).collection<UserDoc>('caloriesUsers');
const foods = async () => (await db()).collection<FoodDoc>('caloriesFoods');
const labels = async () => (await db()).collection<LabelDoc>('caloriesLabels');

let mealsIndexed = false;
async function meals() {
  const col = (await db()).collection<MealDocument>('caloriesMeals');
  if (!mealsIndexed) {
    await col.createIndex({ owner: 1 });
    mealsIndexed = true;
  }
  return col;
}

const dayId = (email: string, date: string) => `${email}|${date}`;

// ── days ──

export async function getDays(email: string, dates: string[]): Promise<Record<string, Entry[]>> {
  const docs = await (await days()).find({ _id: { $in: dates.map((d) => dayId(email, d)) } }).toArray();
  const out: Record<string, Entry[]> = {};
  for (const d of docs) out[d._id.slice(email.length + 1)] = d.entries ?? [];
  return out;
}

/** false when the day already holds MAX_ENTRIES. */
export async function addEntry(email: string, date: string, entry: Entry): Promise<boolean> {
  try {
    const res = await (await days()).updateOne(
      // No MAX_ENTRIES-th entry yet ($expr isn't allowed in an upsert's filter).
      { _id: dayId(email, date), [`entries.${MAX_ENTRIES - 1}`]: { $exists: false } },
      { $push: { entries: entry }, $set: { updatedAt: new Date().toISOString() } },
      { upsert: true },
    );
    return res.matchedCount + res.upsertedCount > 0;
  } catch (error) {
    // The day is full: the filter didn't match, so the upsert tried to insert an existing _id.
    if (error instanceof MongoServerError && error.code === 11000) return false;
    throw error;
  }
}

/** null when there is no such entry; 'too-big' (nothing written) when the new amount is over MAX_GRAMS. */
export async function updateEntry(email: string, date: string, id: string, patch: { meal?: Meal; qty?: number }): Promise<Entry | null | 'too-big'> {
  const col = await days();
  const doc = await col.findOne({ _id: dayId(email, date), 'entries.id': id });
  const old = doc?.entries.find((e) => e.id === id);
  if (!old) return null;
  let next = patch.qty !== undefined ? rescaleEntry(old, patch.qty) : old;
  if (patch.meal) next = { ...next, meal: patch.meal };
  if (next.ref.kind !== 'quick' && next.unit.g * next.qty > MAX_GRAMS) return 'too-big';
  await col.updateOne({ _id: dayId(email, date), 'entries.id': id }, { $set: { 'entries.$': next, updatedAt: new Date().toISOString() } });
  return next;
}

export async function deleteEntry(email: string, date: string, id: string): Promise<boolean> {
  const res = await (await days()).updateOne({ _id: dayId(email, date), 'entries.id': id }, { $pull: { entries: { id } }, $set: { updatedAt: new Date().toISOString() } });
  return res.modifiedCount > 0;
}

// ── the person ──

export async function getUser(email: string): Promise<{ settings: Settings | null; recent: Recent[]; weighIns: WeighIn[] }> {
  const doc = await (await users()).findOne({ _id: email });
  let settings: Settings | null = null;
  if (doc?.goal) {
    settings = { goal: doc.goal, proteinGoal: doc.proteinGoal ?? null };
    if (doc.profile) settings.profile = doc.profile;
    if (doc.aim) settings.aim = doc.aim;
    if (doc.followRec !== undefined) settings.followRec = doc.followRec;
  }
  return { settings, recent: doc?.recent ?? [], weighIns: doc?.weighIns ?? [] };
}

export async function setSettings(email: string, s: Settings): Promise<void> {
  const set: Partial<UserDoc> = { goal: s.goal, proteinGoal: s.proteinGoal, followRec: s.followRec === true };
  if (s.profile) set.profile = s.profile;
  if (s.aim) set.aim = s.aim;
  await (await users()).updateOne({ _id: email }, { $set: set }, { upsert: true });
}

export async function addWeighIn(email: string, w: WeighIn): Promise<WeighIn[]> {
  const col = await users();
  const doc = await col.findOne({ _id: email });
  const weighIns = pushWeighIn(doc?.weighIns ?? [], w);
  await col.updateOne({ _id: email }, { $set: { weighIns } }, { upsert: true });
  return weighIns;
}

// ── workouts (the workout app's, read only) and corrections to their estimate ──

/** The caller's completed workouts on a day (the workout app's `date` is a UTC YYYY-MM-DD). */
export async function getWorkouts(email: string, date: string): Promise<{ id: string; name: string; sets: { reps?: number | null; seconds?: number | null }[] }[]> {
  const docs = await (await db()).collection<WorkoutRead>('workouts')
    .find({ userId: email, isCompleted: true, date: { $regex: `^${date}` } }, { projection: { workoutName: 1, 'exercises.sets.reps': 1, 'exercises.sets.seconds': 1 } })
    .sort({ createdAt: 1 }).limit(10).toArray();
  return docs.map((d) => ({ id: d._id.toHexString(), name: d.workoutName || 'אימון', sets: (d.exercises ?? []).flatMap((e) => e.sets ?? []) }));
}

/** The day's workout corrections and its steps (typed by hand), in one read. */
export async function getDayActivity(email: string, date: string): Promise<{ burned: Record<string, number>; steps: number | null }> {
  const doc = await (await days()).findOne({ _id: dayId(email, date) }, { projection: { burned: 1, steps: 1 } });
  return { burned: doc?.burned ?? {}, steps: doc?.steps ?? null };
}

/** steps null clears the day's count. */
export async function setSteps(email: string, date: string, steps: number | null): Promise<void> {
  await (await days()).updateOne(
    { _id: dayId(email, date) },
    steps === null ? { $unset: { steps: '' } } : { $set: { steps }, $setOnInsert: { entries: [], updatedAt: new Date().toISOString() } },
    { upsert: steps !== null },
  );
}

/** kcal null removes the correction (back to the estimate). workoutId is a 24-hex id. */
export async function setBurned(email: string, date: string, workoutId: string, kcal: number | null): Promise<void> {
  const field = `burned.${workoutId}`;
  await (await days()).updateOne(
    { _id: dayId(email, date) },
    kcal === null ? { $unset: { [field]: '' } } : { $set: { [field]: kcal }, $setOnInsert: { entries: [], updatedAt: new Date().toISOString() } },
    { upsert: kcal !== null },
  );
}

export async function addRecent(email: string, r: Recent): Promise<void> {
  const col = await users();
  const doc = await col.findOne({ _id: email });
  await col.updateOne({ _id: email }, { $set: { recent: pushRecent(doc?.recent ?? [], r) } }, { upsert: true });
}

// ── home-made meals ──

const toMeal = (d: MealDocument): MealDoc => ({ id: d._id.toHexString(), name: d.name, portions: d.portions, items: d.items, per: d.per });
const oid = (id: string) => (ObjectId.isValid(id) && id.length === 24 ? new ObjectId(id) : null);

export async function listMeals(email: string): Promise<MealDoc[]> {
  return (await (await meals()).find({ owner: email }).sort({ name: 1 }).toArray()).map(toMeal);
}

export async function getMeal(email: string, id: string): Promise<MealDoc | null> {
  const _id = oid(id);
  if (!_id) return null;
  const d = await (await meals()).findOne({ _id, owner: email });
  return d ? toMeal(d) : null;
}

type MealInput = { name: string; portions: number; items: MealItem[] };

export async function createMeal(email: string, m: MealInput): Promise<MealDoc> {
  const doc: MealDocument = { _id: new ObjectId(), owner: email, ...m, per: mealPerPortion(m.items, m.portions), updatedAt: new Date().toISOString() };
  await (await meals()).insertOne(doc);
  return toMeal(doc);
}

export async function updateMeal(email: string, id: string, m: MealInput): Promise<MealDoc | null> {
  const _id = oid(id);
  if (!_id) return null;
  const d = await (await meals()).findOneAndUpdate(
    { _id, owner: email },
    { $set: { ...m, per: mealPerPortion(m.items, m.portions), updatedAt: new Date().toISOString() } },
    { returnDocument: 'after' },
  );
  return d ? toMeal(d) : null;
}

export async function deleteMeal(email: string, id: string): Promise<boolean> {
  const _id = oid(id);
  if (!_id) return false;
  return (await (await meals()).deleteOne({ _id, owner: email })).deletedCount > 0;
}

// ── shared food data ──

/** One MoH food by its id (an entry's ref key). */
export async function getFood(id: number): Promise<FoodDoc | null> {
  return (await foods()).findOne({ _id: id }, { projection: { h: 0 } });
}

/** MoH foods whose name matches every pattern (searchPatterns), unranked (at most 500). */
export async function searchFoods(terms: string[]): Promise<FoodDoc[]> {
  if (!terms.length) return [];
  // Every match (common words hit ~200 of ~2,800 small docs), so ranking sees the plain foods too.
  return (await foods()).find({ $and: terms.map((t) => ({ n: { $regex: t, $options: 'i' } })) }, { projection: { h: 0 } }).limit(500).toArray();
}

export async function getLabel(key: string): Promise<Nutrition | null> {
  return (await (await labels()).findOne({ _id: key }))?.nu ?? null;
}

export async function setLabel(key: string, nu: Nutrition, email: string): Promise<void> {
  await (await labels()).replaceOne({ _id: key }, { nu, by: email, at: new Date().toISOString() }, { upsert: true });
}

export async function getLabels(keys: string[]): Promise<Map<string, Nutrition>> {
  if (!keys.length) return new Map();
  return new Map((await (await labels()).find({ _id: { $in: keys } }).toArray()).map((d) => [d._id, d.nu]));
}
