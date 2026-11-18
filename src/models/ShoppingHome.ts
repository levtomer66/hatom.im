import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { MAX_MY_ITEMS, addToList, homeFromLists, type ListLine, type MyItem } from '@/lib/shopping/home';
import { acceptPlan, isDisposable, MAX_INVITES, MAX_MEMBERS, type Household, type Invite } from '@/lib/shopping/household';
import { getItemMeta } from '@/models/ShoppingCatalog';
import { getAllShoppingListsForMigration } from '@/models/ShoppingList';

// Households: one doc each in `shoppingHome`, holding its members, pending
// invites, My items, shopping list and favorite stores. A person is in exactly
// one (unique index on `members`); someone with no household gets an empty one
// on their first request. Today's household keeps `_id: 'home'` (built once
// from the old named lists, `shoppingLists`, left untouched) and starts with
// FOUNDING_MEMBERS. Writes replace a whole array; trips pull bought keys with
// $pull so they don't race an edit.
const COLLECTION_NAME = 'shoppingHome';
const HOME_ID = 'home';
/** Who today's household starts with: Tomer (the owner) and Tom (allowlisted since he stopped being an owner). */
const FOUNDING_MEMBERS = ['levtomer66@gmail.com', 'tomzari347@gmail.com'];

interface HomeDocument {
  _id: string;
  /** Missing only on today's doc before its one-time backfill. */
  members?: string[];
  invites?: Invite[];
  items: MyItem[];
  list: ListLine[];
  favStores?: number[];
  updatedAt: string;
}

/** What the API returns: the household plus each My item's department and photo. */
export type ShoppingHomeView = Household & { meta: Awaited<ReturnType<typeof getItemMeta>> };

async function getCollection() {
  return (await clientPromise).db().collection<HomeDocument>(COLLECTION_NAME);
}

const plain = (d: HomeDocument): Household => ({
  id: d._id, members: d.members ?? [], invites: d.invites ?? [],
  items: d.items, list: d.list, favStores: d.favStores ?? [], updatedAt: d.updatedAt,
});

/**
 * Once per process: today's household exists (built from the old lists the
 * first time), has its owners, and the indexes are in place. The backfill
 * runs before the unique index: a doc without `members` indexes as null.
 */
let prepared: Promise<void> | null = null;
function prepare(): Promise<void> {
  prepared ??= (async () => {
    const col = await getCollection();
    if (!(await col.findOne({ _id: HOME_ID }, { projection: { _id: 1 } }))) {
      const items = homeFromLists(await getAllShoppingListsForMigration());
      // Upsert with $setOnInsert: two first reads at once still make one doc.
      await col.updateOne(
        { _id: HOME_ID },
        { $setOnInsert: { items, list: [], updatedAt: new Date().toISOString() } },
        { upsert: true },
      );
    }
    await col.updateOne({ _id: HOME_ID, members: { $exists: false } }, { $set: { members: FOUNDING_MEMBERS, invites: [] } });
    await col.createIndex({ members: 1 }, { unique: true });
    await col.createIndex({ 'invites.email': 1 });
  })().catch((e) => { prepared = null; throw e; });
  return prepared;
}

const isDuplicateKey = (e: unknown) => (e as { code?: number })?.code === 11000;

/** The caller's household; an empty one of their own when they have none. */
export async function householdFor(email: string): Promise<Household> {
  await prepare();
  const me = email.toLowerCase();
  const col = await getCollection();
  const found = await col.findOne({ members: me });
  if (found) return plain(found);
  const doc: HomeDocument = {
    _id: new ObjectId().toHexString(), members: [me], invites: [], items: [], list: [], favStores: [], updatedAt: new Date().toISOString(),
  };
  try {
    await col.insertOne(doc);
    return plain(doc);
  } catch (e) {
    // Two first requests at once: the other one made it.
    if (!isDuplicateKey(e)) throw e;
    return plain((await col.findOne({ members: me }))!);
  }
}

export async function getHousehold(id: string): Promise<Household | null> {
  await prepare();
  const doc = await (await getCollection()).findOne({ _id: id });
  return doc ? plain(doc) : null;
}

export async function withMeta(h: Household): Promise<ShoppingHomeView> {
  const keys = [...new Set([...h.items, ...h.list].map((i) => i.key))];
  return { ...h, meta: await getItemMeta(keys) };
}

async function set(id: string, fields: Partial<Pick<HomeDocument, 'items' | 'list' | 'favStores'>>): Promise<Household> {
  const doc = await (await getCollection()).findOneAndUpdate(
    { _id: id },
    { $set: { ...fields, updatedAt: new Date().toISOString() } },
    { returnDocument: 'after' },
  );
  if (!doc) throw new Error(`No household ${id}`);
  return plain(doc);
}

export const setList = (id: string, list: ListLine[]) => set(id, { list });
export const setHome = (id: string, fields: { items?: MyItem[]; list?: ListLine[]; favStores?: number[] }) => set(id, fields);

export async function addLines(id: string, lines: ListLine[]): Promise<Household> {
  const h = await getHousehold(id);
  if (!h) throw new Error(`No household ${id}`);
  return set(id, { list: addToList(h.list, lines) });
}

/** Lines not yet among My items are saved there too, their quantity as the usual one. */
export async function ensureMyItems(id: string, lines: ListLine[], by: string): Promise<void> {
  const h = await getHousehold(id);
  if (!h) return;
  const have = new Set(h.items.map((i) => i.key));
  const now = new Date().toISOString();
  const add = lines.filter((l) => !have.has(l.key)).map((l) => ({ ...l, addedBy: by, addedAt: now }));
  if (!add.length) return;
  await set(id, { items: [...h.items, ...add].slice(0, MAX_MY_ITEMS) });
}

/** After a trip: pull what was ticked, unless it was also marked not there. */
export async function pullBought(id: string, ticked: string[], notThere: string[]): Promise<void> {
  const gone = ticked.filter((k) => !notThere.includes(k));
  if (!gone.length) return;
  await (await getCollection()).updateOne(
    { _id: id },
    { $pull: { list: { key: { $in: gone } } }, $set: { updatedAt: new Date().toISOString() } },
  );
}

// ── invites ──

/** A pending invite on household `id`; false when it's there already or the caps are full (checked again here, atomically). */
export async function addInvite(id: string, invite: Invite): Promise<boolean> {
  const res = await (await getCollection()).updateOne(
    { _id: id, 'invites.email': { $ne: invite.email }, members: { $ne: invite.email }, [`invites.${MAX_INVITES - 1}`]: { $exists: false } },
    { $push: { invites: invite } },
  );
  return res.modifiedCount === 1;
}

export async function cancelInvite(id: string, email: string): Promise<void> {
  await (await getCollection()).updateOne({ _id: id }, { $pull: { invites: { email } } });
}

/** Invites to `email` from other households. */
export async function incomingInvites(email: string): Promise<{ id: string; by: string; at: string }[]> {
  await prepare();
  const me = email.toLowerCase();
  const docs = await (await getCollection()).find({ 'invites.email': me }, { projection: { invites: 1 } }).toArray();
  return docs.flatMap((d) => (d.invites ?? []).filter((i) => i.email === me).map((i) => ({ id: d._id, by: i.by, at: i.at })));
}

export async function declineInvite(email: string, toId: string): Promise<void> {
  await cancelInvite(toId, email.toLowerCase());
}

/**
 * Join household `toId` on its invite. In order, so a failure never leaves
 * the caller in no household: claim the invite (gone or full → null, nothing
 * changed); leave the current household (deleted when they were alone in it —
 * acceptPlan); join. If joining fails (the household vanished), they get a
 * new empty household and null.
 */
export async function acceptInvite(email: string, toId: string): Promise<Household | null> {
  const me = email.toLowerCase();
  const current = await householdFor(me);
  if (current.id === toId) return current;
  const col = await getCollection();
  const claimed = await col.findOneAndUpdate(
    { _id: toId, 'invites.email': me, [`members.${MAX_MEMBERS - 1}`]: { $exists: false } },
    { $pull: { invites: { email: me } } },
  );
  if (!claimed) return null;
  const left = acceptPlan(current, me).deleteFrom
    ? (await col.deleteOne({ _id: current.id, members: [me] })).deletedCount
    : 0;
  if (!left) await col.updateOne({ _id: current.id }, { $pull: { members: me } }); // someone else joined it meanwhile
  let joined;
  try {
    joined = await col.updateOne({ _id: toId }, { $addToSet: { members: me } });
  } catch (e) {
    // Another request of theirs (a tab, a phone, an MCP call) made them a fresh household between
    // leaving and joining: drop it if it's still empty, and join once more.
    if (!isDuplicateKey(e)) throw e;
    const stray = await col.findOne({ members: me });
    if (stray && isDisposable(plain(stray), me)) await col.deleteOne({ _id: stray._id, members: [me] });
    joined = await col.updateOne({ _id: toId }, { $addToSet: { members: me } }).catch((e2) => {
      if (isDuplicateKey(e2)) return { matchedCount: 0 };
      throw e2;
    });
  }
  if (!joined.matchedCount) {
    await householdFor(me);
    return null;
  }
  return getHousehold(toId);
}

/** Leave a household others are in; the caller gets a new empty one. Null when they're its only member. */
export async function leaveHousehold(email: string): Promise<Household | null> {
  const me = email.toLowerCase();
  const h = await householdFor(me);
  if (h.members.length < 2) return null;
  await (await getCollection()).updateOne({ _id: h.id, 'members.1': { $exists: true } }, { $pull: { members: me } });
  return householdFor(me);
}
