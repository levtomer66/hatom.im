import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';

const COLLECTION_NAME = 'authorizedEmails';

export interface AuthorizedEmail {
  id: string;
  email: string;     // always stored and compared lowercase
  addedBy: string;   // email of the owner who added this entry
  addedAt: string;   // ISO 8601
  note?: string;
}

interface AuthorizedEmailDocument extends Omit<AuthorizedEmail, 'id'> {
  _id?: ObjectId;
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
  const { _id, ...rest } = doc;
  return { ...rest, id: _id!.toString() } as AuthorizedEmail;
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
      },
    },
    { upsert: true, returnDocument: 'after' }
  );
  if (!result) {
    throw new Error('Failed to upsert authorized email');
  }
  return docToEntry(result);
}

export async function removeAuthorizedEmail(email: string): Promise<boolean> {
  const col = await getCollection();
  const result = await col.deleteOne({ email: email.trim().toLowerCase() });
  return result.deletedCount > 0;
}
