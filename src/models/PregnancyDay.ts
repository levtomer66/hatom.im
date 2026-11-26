import clientPromise from '@/lib/mongodb';
import { isEmptyDay, MAX_NOTES, prevValues, type DayLog, type DayNote, type DayPatch, type Measures, type PrevValues } from '@/lib/pregnancy/daylog';

// The day log (docs/superpowers/specs/2026-11-26-pregnancy-day-log-design.md § Data):
// one small doc per pregnancy and day, `_id: '<pid>|YYYY-MM-DD'`. Every write touches
// only its own part, so two people editing one day don't undo each other; a day
// left with nothing in it is deleted. No extra index: reads are `_id` ranges.

interface DayDocument extends DayLog { _id: string; pid: string }

const col = async () => (await clientPromise).db().collection<DayDocument>('pregnancyDays');
const key = (pid: string, date: string) => `${pid}|${date}`;
/** Every day of a pregnancy, optionally from/to (inclusive). */
const range = (pid: string, from = '', to = '9') => ({ _id: { $gte: key(pid, from), $lte: key(pid, to) } });
const plain = (doc: DayDocument): DayLog => {
  const { _id, pid, ...d } = doc;
  void _id; void pid;
  return d;
};
const now = () => new Date().toISOString();

/** A doc left empty by a write is removed (unless another write filled it meanwhile). */
async function settle(d: DayDocument | null): Promise<DayLog | null> {
  if (!d) return null;
  if (!isEmptyDay(d)) return plain(d);
  await (await col()).deleteOne({ _id: d._id, updatedAt: d.updatedAt });
  return null;
}

export async function getDayRange(pid: string, from: string, to: string): Promise<DayLog[]> {
  return (await (await col()).find(range(pid, from, to)).sort({ _id: 1 }).toArray()).map(plain);
}

/** For the cubes: each day's mood and whether any note is starred. */
export async function getSummaryRows(pid: string): Promise<{ date: string; mood?: number; star?: boolean }[]> {
  const docs = await (await col()).find(range(pid), { projection: { date: 1, mood: 1, 'notes.star': 1 } }).toArray();
  return docs.map((d) => ({ date: d.date, ...(d.mood ? { mood: d.mood } : {}), ...(d.notes?.some((n) => n.star) ? { star: true } : {}) }));
}

/** Each measurement's last value before `date`. */
export async function prevMeasures(pid: string, date: string): Promise<PrevValues> {
  const docs = await (await col())
    .find({ _id: { $gte: key(pid, ''), $lt: key(pid, date) }, m: { $exists: true } }, { projection: { date: 1, m: 1 } })
    .sort({ _id: -1 }).limit(60).toArray();
  return prevValues(docs as { date: string; m?: Measures }[], date);
}

const blank = (v: unknown) => v === null || (typeof v === 'object' && v !== null && !Object.keys(v).length);

export async function putDay(pid: string, date: string, patch: DayPatch): Promise<DayLog | null> {
  const $set: Record<string, unknown> = { pid, date, updatedAt: now() };
  const $unset: Record<string, ''> = {};
  for (const part of ['mood', 'sym', 'm'] as const) {
    if (!(part in patch)) continue;
    if (blank(patch[part])) $unset[part] = '';
    else $set[part] = patch[part];
  }
  const d = await (await col()).findOneAndUpdate(
    { _id: key(pid, date) },
    { $set, ...(Object.keys($unset).length ? { $unset } : {}) },
    { upsert: true, returnDocument: 'after' },
  );
  return settle(d);
}

/** null when the day already holds MAX_NOTES notes. */
export async function addNote(pid: string, date: string, n: DayNote): Promise<DayLog | null | 'full'> {
  try {
    const d = await (await col()).findOneAndUpdate(
      { _id: key(pid, date), [`notes.${MAX_NOTES - 1}`]: { $exists: false } },
      { $set: { pid, date, updatedAt: now() }, $push: { notes: n } },
      { upsert: true, returnDocument: 'after' },
    );
    return settle(d);
  } catch (e) {
    // A full day fails the filter, so the upsert tries to insert a second doc with the same _id.
    if ((e as { code?: number })?.code === 11000) return 'full';
    throw e;
  }
}

/** undefined when the note isn't there. */
export async function updateNote(pid: string, date: string, id: string, v: { text: string; star: boolean }): Promise<DayLog | null | undefined> {
  const d = await (await col()).findOneAndUpdate(
    { _id: key(pid, date), 'notes.id': id },
    v.star
      ? { $set: { 'notes.$.text': v.text, 'notes.$.star': true, updatedAt: now() } }
      : { $set: { 'notes.$.text': v.text, updatedAt: now() }, $unset: { 'notes.$.star': '' } },
    { returnDocument: 'after' },
  );
  return d ? settle(d) : undefined;
}

export async function deleteNote(pid: string, date: string, id: string): Promise<DayLog | null> {
  const d = await (await col()).findOneAndUpdate(
    { _id: key(pid, date) },
    { $pull: { notes: { id } }, $set: { updatedAt: now() } },
    { returnDocument: 'after' },
  );
  return settle(d);
}
