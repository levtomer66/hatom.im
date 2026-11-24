import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import {
  MAX_EVENTS, MAX_INVITES, MAX_MEMBERS, MAX_REMINDERS,
  type Dating, type Invite, type Patch, type Pregnancy, type Scan,
} from '@/lib/pregnancy/pregnancy';
import { markDone, type PEvent, type Reminder, type SuggestionId } from '@/lib/pregnancy/schedule';
import { DEFAULT_CAF_LIMIT } from '@/lib/pregnancy/drinks';

// Pregnancies (docs/superpowers/specs/2026-11-24-pregnancy-design.md § Data): one
// small doc each, events/reminders/scans embedded. A person is in at most one
// active pregnancy (partial unique index on members); an ended one is kept, hidden.

interface PregnancyDocument extends Omit<Pregnancy, 'id'> { _id: string }

let prepared: Promise<void> | null = null;

async function col() {
  const c = (await clientPromise).db().collection<PregnancyDocument>('pregnancies');
  if (!prepared) {
    prepared = (async () => {
      await c.createIndex({ members: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });
      await c.createIndex({ 'invites.email': 1 });
    })().catch((e) => { prepared = null; throw e; });
  }
  await prepared;
  return c;
}

const plain = ({ _id, ...rest }: PregnancyDocument): Pregnancy => ({ ...rest, id: _id });
const now = () => new Date().toISOString();
export const isDuplicateKey = (e: unknown) => (e as { code?: number })?.code === 11000;

/** The caller's active pregnancy (as owner or member). */
export async function pregnancyFor(email: string): Promise<Pregnancy | null> {
  const d = await (await col()).findOne({ members: email.toLowerCase(), status: 'active' });
  return d ? plain(d) : null;
}

/** The active pregnancy `email` owns (is pregnant in). */
export async function pregnantOwner(email: string): Promise<Pregnancy | null> {
  const d = await (await col()).findOne({ owner: email.toLowerCase(), status: 'active' });
  return d ? plain(d) : null;
}

export async function invitesFor(email: string): Promise<{ id: string; owner: string; by: string }[]> {
  const me = email.toLowerCase();
  const docs = await (await col()).find({ 'invites.email': me, status: 'active' }, { projection: { owner: 1, invites: 1 } }).limit(5).toArray();
  return docs.map((d) => ({ id: d._id, owner: d.owner, by: d.invites.find((i) => i.email === me)?.by ?? d.owner }));
}

/** null when the caller is already in an active pregnancy. */
export async function createPregnancy(owner: string, s: { dating: Dating; edd: string; preKg: number | null; heightCm: number | null }): Promise<Pregnancy | null> {
  const me = owner.toLowerCase();
  const doc: PregnancyDocument = {
    _id: new ObjectId().toHexString(), owner: me, members: [me], invites: [], status: 'active',
    edd: s.edd, dating: s.dating, preKg: s.preKg, heightCm: s.heightCm, cafLimit: DEFAULT_CAF_LIMIT,
    events: [], reminders: [], dismissed: [], scans: {}, createdAt: now(), updatedAt: now(),
  };
  try {
    await (await col()).insertOne(doc);
    return plain(doc);
  } catch (e) {
    if (isDuplicateKey(e)) return null;
    throw e;
  }
}

async function update(id: string, filter: Record<string, unknown>, change: Record<string, unknown>): Promise<Pregnancy | null> {
  const $set = { ...((change.$set as object) ?? {}), updatedAt: now() };
  const d = await (await col()).findOneAndUpdate({ _id: id, status: 'active', ...filter }, { ...change, $set }, { returnDocument: 'after' });
  return d ? plain(d) : null;
}

export const patchPregnancy = (id: string, p: Patch) => update(id, {}, { $set: p });

// ── events ──

export const addEvent = (id: string, e: PEvent) =>
  update(id, { [`events.${MAX_EVENTS - 1}`]: { $exists: false } }, { $push: { events: e } });
export const updateEvent = (id: string, e: PEvent) => update(id, { 'events.id': e.id }, { $set: { 'events.$': e } });
export const deleteEvent = (id: string, eventId: string) => update(id, { 'events.id': eventId }, { $pull: { events: { id: eventId } } });

export const setDismissed = (id: string, sid: SuggestionId, on: boolean) =>
  update(id, {}, on ? { $addToSet: { dismissed: sid } } : { $pull: { dismissed: sid } });

// ── reminders ──

export const addReminder = (id: string, r: Reminder) =>
  update(id, { [`reminders.${MAX_REMINDERS - 1}`]: { $exists: false } }, { $push: { reminders: r } });
export const updateReminder = (id: string, r: Reminder) => update(id, { 'reminders.id': r.id }, { $set: { 'reminders.$': r } });
export const deleteReminder = (id: string, rid: string) => update(id, { 'reminders.id': rid }, { $pull: { reminders: { id: rid } } });

export async function setDone(p: Pregnancy, rid: string, date: string, done: boolean, today: string): Promise<Pregnancy | null> {
  const r = p.reminders.find((x) => x.id === rid);
  if (!r) return null;
  return update(p.id, { 'reminders.id': rid }, { $set: { 'reminders.$.done': markDone(r, date, done, today).done } });
}

// ── members ──

export const invite = (id: string, inv: Invite) =>
  update(id, { 'invites.email': { $ne: inv.email }, members: { $ne: inv.email }, [`invites.${MAX_INVITES - 1}`]: { $exists: false } }, { $push: { invites: inv } });
export const cancelInvite = (id: string, email: string) => update(id, {}, { $pull: { invites: { email } } });
/** A member other than the owner leaves (the owner ends the pregnancy instead). */
export const removeMember = (id: string, email: string) => update(id, { owner: { $ne: email } }, { $pull: { members: email } });

/** 'busy' when the caller is in another active pregnancy; 'gone' when the invite isn't there any more. */
export async function acceptInvite(id: string, email: string): Promise<'ok' | 'busy' | 'gone'> {
  const me = email.toLowerCase();
  if (await pregnancyFor(me)) return 'busy';
  try {
    const d = await update(id, { 'invites.email': me, [`members.${MAX_MEMBERS - 1}`]: { $exists: false } }, { $pull: { invites: { email: me } }, $addToSet: { members: me } });
    return d ? 'ok' : 'gone';
  } catch (e) {
    if (isDuplicateKey(e)) return 'busy';
    throw e;
  }
}

export const declineInvite = (id: string, email: string) => update(id, {}, { $pull: { invites: { email: email.toLowerCase() } } });

// ── scans ──

/** Sets the week's scan; returns the doc and the URL it replaced (to delete from Blob). */
export async function setScan(id: string, week: number, scan: Scan): Promise<{ p: Pregnancy; replaced: string | null } | null> {
  const before = await (await col()).findOneAndUpdate(
    { _id: id, status: 'active' },
    { $set: { [`scans.${week}`]: scan, updatedAt: now() } },
    { returnDocument: 'before' },
  );
  if (!before) return null;
  return { p: { ...plain(before), scans: { ...before.scans, [week]: scan } }, replaced: before.scans?.[week]?.url ?? null };
}

export async function deleteScan(id: string, week: number): Promise<{ p: Pregnancy; url: string | null } | null> {
  const before = await (await col()).findOneAndUpdate(
    { _id: id, status: 'active' },
    { $unset: { [`scans.${week}`]: '' }, $set: { updatedAt: now() } },
    { returnDocument: 'before' },
  );
  if (!before) return null;
  const scans = { ...before.scans };
  delete scans[week];
  return { p: { ...plain(before), scans }, url: before.scans?.[week]?.url ?? null };
}

export const endPregnancy = (id: string) => update(id, {}, { $set: { status: 'ended', endedAt: now() } });
