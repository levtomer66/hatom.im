import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import type { PermissionKey } from '@/types/permissions';
import { parsePermissionKeyArray } from '@/types/permissions';

const COLLECTION_NAME = 'authorizedEmails';

export interface AuthorizedEmail {
  id: string;
  email: string;     // always stored and compared lowercase
  addedBy: string;   // email of the owner who added this entry
  addedAt: string;   // ISO 8601
  note?: string;
  // Per-user, per-page grant matrix. Empty array = signed-in but can't see
  // any gated feature. Owners are never present in this collection, so
  // there's no special "all" sentinel here.
  allowedPages: PermissionKey[];
}

interface AuthorizedEmailDocument extends Omit<AuthorizedEmail, 'id' | 'allowedPages'> {
  _id?: ObjectId;
  // Optional on disk so legacy docs (added before the permissions matrix
  // landed) read cleanly without a migration; the mapper defaults missing
  // values to [].
  allowedPages?: unknown;
}

let indexEnsured = false;

async function getCollection() {
  const client = await clientPromise;
  const db = client.db();
  const col = db.collection<AuthorizedEmailDocument>(COLLECTION_NAME);
  if (!indexEnsured) {
    // Unique on email so we can't accidentally add the same address twice.
    // Idempotent — createIndex is a no-op if it already exists.
    await col.createIndex({ email: 1 }, { unique: true });
    indexEnsured = true;
  }
  return col;
}

function docToEntry(doc: AuthorizedEmailDocument): AuthorizedEmail {
  const { _id, allowedPages, ...rest } = doc;
  // Validate at read-time so a corrupted DB row can never poison the
  // session (e.g. fabricating an unknown permission key). Unknown / missing
  // pages default to []; the owner can re-grant via the admin UI.
  const parsed = parsePermissionKeyArray(allowedPages) ?? [];
  return { ...rest, id: _id!.toString(), allowedPages: parsed } as AuthorizedEmail;
}

export async function getAllAuthorizedEmails(): Promise<AuthorizedEmail[]> {
  const col = await getCollection();
  const docs = await col.find({}).sort({ addedAt: -1 }).toArray();
  return docs.map(docToEntry);
}

// Returns true if the email exists in the collection (case-insensitive).
export async function isEmailAuthorized(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const col = await getCollection();
  const hit = await col.findOne({ email: email.toLowerCase() });
  return hit !== null;
}

// Full row lookup for session enrichment. Returns null when the email is
// not allowlisted, distinct from the `[] allowedPages` case where the user
// is allowlisted but has no granted features yet.
export async function getAuthorizedEmailEntry(
  email: string | null | undefined
): Promise<AuthorizedEmail | null> {
  if (!email) return null;
  const col = await getCollection();
  const hit = await col.findOne({ email: email.toLowerCase() });
  return hit ? docToEntry(hit) : null;
}

export async function addAuthorizedEmail(
  email: string,
  addedBy: string,
  note?: string
): Promise<AuthorizedEmail> {
  const col = await getCollection();
  const now = new Date().toISOString();
  const normalised = email.trim().toLowerCase();
  const result = await col.findOneAndUpdate(
    { email: normalised },
    {
      $setOnInsert: {
        email: normalised,
        addedBy: addedBy.toLowerCase(),
        addedAt: now,
        note: note?.trim() || undefined,
        // New users start with no granted pages; owners flip permissions
        // explicitly via the matrix UI.
        allowedPages: [],
      },
    },
    { upsert: true, returnDocument: 'after' }
  );
  if (!result) {
    throw new Error('Failed to upsert authorized email');
  }
  return docToEntry(result);
}

// Replace the entire allowedPages array for one user. We always rewrite
// the full set (instead of a per-key delta) because the matrix is tiny and
// the optimistic-UI client already holds the canonical post-toggle state.
export async function setAllowedPages(
  email: string,
  allowedPages: PermissionKey[]
): Promise<AuthorizedEmail | null> {
  const col = await getCollection();
  const normalised = email.trim().toLowerCase();
  // Dedupe defensively in case the caller passed duplicates.
  const unique = [...new Set(allowedPages)];
  const result = await col.findOneAndUpdate(
    { email: normalised },
    { $set: { allowedPages: unique } },
    { returnDocument: 'after' }
  );
  return result ? docToEntry(result) : null;
}

export async function removeAuthorizedEmail(email: string): Promise<boolean> {
  const col = await getCollection();
  const result = await col.deleteOne({ email: email.trim().toLowerCase() });
  return result.deletedCount > 0;
}
