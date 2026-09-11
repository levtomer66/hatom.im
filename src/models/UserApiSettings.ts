import { randomBytes } from 'node:crypto';
import { MongoServerError } from 'mongodb';
import clientPromise from '@/lib/mongodb';

// One personal API key per user. It authenticates every headless caller
// (iPhone Shortcuts, the macOS app, MCP clients) as `Authorization: Bearer
// <key>`; each endpoint still checks the owner's live page permission, so the
// key never grants more than the person already has on the web. Plaintext +
// revealable by design — a convenience credential, not a security boundary,
// but 24 random chars (unlike the earlier 5-digit key) so it isn't
// brute-forceable on the internet-facing MCP endpoint.
const COLLECTION_NAME = 'userApiSettings';
const KEY_PREFIX = 'htm_';
const KEY_BYTES = 18; // base64url → 24 chars, so the token is "htm_" + 24.
const MAX_KEY_ATTEMPTS = 5;

// Shared with the auth gate so a garbage Authorization header is rejected
// before a Mongo lookup. Kept lenient on length so tweaking KEY_BYTES later
// doesn't silently break verification.
const KEY_FORMAT = /^htm_[A-Za-z0-9_-]{16,64}$/;

export function isApiKeyFormat(value: string): boolean {
  return KEY_FORMAT.test(value);
}

function generateApiKey(): string {
  return KEY_PREFIX + randomBytes(KEY_BYTES).toString('base64url');
}

export interface PublicUserApiSettings {
  apiKey: string | null;
  defaultCoffeeFavoriteId: string | null;
}

export interface ApiKeyOwner extends PublicUserApiSettings {
  userEmail: string;
  userName: string;
}

interface UserApiSettingsDocument extends ApiKeyOwner {
  updatedAt: string;
}

let indexesEnsured: Promise<void> | null = null;

async function getCollection() {
  const client = await clientPromise;
  const collection = client
    .db()
    .collection<UserApiSettingsDocument>(COLLECTION_NAME);
  if (!indexesEnsured) {
    indexesEnsured = Promise.all([
      collection.createIndex({ userEmail: 1 }, { unique: true }),
      collection.createIndex(
        { apiKey: 1 },
        {
          unique: true,
          partialFilterExpression: { apiKey: { $type: 'string' } },
        }
      ),
    ])
      .then(() => undefined)
      .catch((error) => {
        indexesEnsured = null;
        throw error;
      });
  }
  await indexesEnsured;
  return collection;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeName(email: string, name: string | null | undefined): string {
  return name?.trim() || email.split('@')[0];
}

function toPublicSettings(doc: UserApiSettingsDocument): PublicUserApiSettings {
  return {
    apiKey: doc.apiKey ?? null,
    defaultCoffeeFavoriteId: doc.defaultCoffeeFavoriteId ?? null,
  };
}

// Ensure the row exists and keep the display-name snapshot fresh, so
// key-authenticated calls (which never touch the Auth.js session) still have a
// useful userName without coupling to the adapter's internal schema.
async function upsertIdentity(
  userEmail: string,
  userName: string | null | undefined
): Promise<UserApiSettingsDocument> {
  const collection = await getCollection();
  const email = normalizeEmail(userEmail);
  const now = new Date().toISOString();
  const doc = await collection.findOneAndUpdate(
    { userEmail: email },
    {
      $set: {
        userName: normalizeName(email, userName),
        updatedAt: now,
      },
      $setOnInsert: {
        userEmail: email,
        apiKey: null,
        defaultCoffeeFavoriteId: null,
      },
    },
    { upsert: true, returnDocument: 'after' }
  );
  if (!doc) throw new Error('Failed to upsert API settings');
  return doc;
}

export async function getUserApiSettings(
  userEmail: string,
  userName?: string | null
): Promise<PublicUserApiSettings> {
  return toPublicSettings(await upsertIdentity(userEmail, userName));
}

// Generate the first key or rotate an existing one. Rotation immediately
// invalidates the old value (the row holds exactly one key). Collisions on a
// unique index are astronomically unlikely at 24 random chars but retried
// anyway so a fluke can never surface as a 500 to the user.
export async function regenerateUserApiKey(
  userEmail: string,
  userName?: string | null
): Promise<PublicUserApiSettings> {
  await upsertIdentity(userEmail, userName);
  const collection = await getCollection();
  const email = normalizeEmail(userEmail);

  for (let attempt = 0; attempt < MAX_KEY_ATTEMPTS; attempt += 1) {
    const apiKey = generateApiKey();
    try {
      const doc = await collection.findOneAndUpdate(
        { userEmail: email },
        {
          $set: {
            apiKey,
            userName: normalizeName(email, userName),
            updatedAt: new Date().toISOString(),
          },
        },
        { returnDocument: 'after' }
      );
      if (!doc) throw new Error('Failed to rotate API key');
      return toPublicSettings(doc);
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) continue;
      throw error;
    }
  }
  throw new Error('Unable to allocate a unique API key');
}

export async function setDefaultCoffeeFavorite(
  userEmail: string,
  userName: string | null | undefined,
  defaultCoffeeFavoriteId: string | null
): Promise<PublicUserApiSettings> {
  await upsertIdentity(userEmail, userName);
  const collection = await getCollection();
  const email = normalizeEmail(userEmail);
  const doc = await collection.findOneAndUpdate(
    { userEmail: email },
    {
      $set: {
        defaultCoffeeFavoriteId,
        userName: normalizeName(email, userName),
        updatedAt: new Date().toISOString(),
      },
    },
    { returnDocument: 'after' }
  );
  if (!doc) throw new Error('Failed to update API settings');
  return toPublicSettings(doc);
}

// Resolve a presented key to its owner. Authorization (page permission) is the
// caller's responsibility — this only answers "whose key is this?".
export async function getApiKeyOwner(apiKey: string): Promise<ApiKeyOwner | null> {
  const collection = await getCollection();
  const doc = await collection.findOne({ apiKey });
  if (!doc) return null;
  return {
    userEmail: doc.userEmail,
    userName: doc.userName,
    apiKey: doc.apiKey,
    defaultCoffeeFavoriteId: doc.defaultCoffeeFavoriteId ?? null,
  };
}
