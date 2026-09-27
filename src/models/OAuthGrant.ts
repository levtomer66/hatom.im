import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  generateToken,
  hashToken,
  isTokenOfKind,
} from '@/lib/oauth-core';
import type { ConnectedApp } from '@/types/oauth';

// One document per (user, client) connection — this IS the "connected app".
// It holds the current access + refresh token hashes; revoking the app is
// deleting the document. Reconnecting the same client replaces the tokens.
const COLLECTION_NAME = 'oauthGrants';

// lastUsedAt is display-only; don't write it on every MCP call.
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

interface OAuthGrantDocument {
  _id?: ObjectId;
  userEmail: string;
  userName: string;
  clientId: string;
  clientName: string;
  redirectHost: string;
  accessTokenHash: string;
  accessExpiresAt: Date;
  refreshTokenHash: string;
  refreshExpiresAt: Date;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

let indexesEnsured: Promise<void> | null = null;

async function getCollection() {
  const client = await clientPromise;
  const collection = client.db().collection<OAuthGrantDocument>(COLLECTION_NAME);
  if (!indexesEnsured) {
    indexesEnsured = Promise.all([
      collection.createIndex({ userEmail: 1, clientId: 1 }, { unique: true }),
      collection.createIndex({ accessTokenHash: 1 }, { unique: true }),
      collection.createIndex({ refreshTokenHash: 1 }, { unique: true }),
      collection.createIndex({ refreshExpiresAt: 1 }, { expireAfterSeconds: 0 }),
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

function freshTokens(now: number) {
  const accessToken = generateToken('access');
  const refreshToken = generateToken('refresh');
  return {
    pair: { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS },
    fields: {
      accessTokenHash: hashToken(accessToken),
      accessExpiresAt: new Date(now + ACCESS_TOKEN_TTL_SECONDS * 1000),
      refreshTokenHash: hashToken(refreshToken),
      refreshExpiresAt: new Date(now + REFRESH_TOKEN_TTL_SECONDS * 1000),
    },
  };
}

export async function issueGrant(input: {
  userEmail: string;
  userName: string;
  clientId: string;
  clientName: string;
  redirectHost: string;
}): Promise<TokenPair> {
  const collection = await getCollection();
  const now = Date.now();
  const { pair, fields } = freshTokens(now);
  const userEmail = input.userEmail.toLowerCase();
  await collection.updateOne(
    { userEmail, clientId: input.clientId },
    {
      $set: {
        ...fields,
        userName: input.userName,
        clientName: input.clientName,
        redirectHost: input.redirectHost,
      },
      $setOnInsert: { userEmail, clientId: input.clientId, createdAt: new Date(now), lastUsedAt: null },
    },
    { upsert: true }
  );
  return pair;
}

// Strict rotation, atomically: the filter matches the presented refresh token
// and the update replaces it, so a replayed or concurrent second use fails.
export async function rotateGrant(
  refreshToken: string,
  clientId: string
): Promise<TokenPair | null> {
  if (!isTokenOfKind(refreshToken, 'refresh')) return null;
  const collection = await getCollection();
  const now = Date.now();
  const { pair, fields } = freshTokens(now);
  const doc = await collection.findOneAndUpdate(
    {
      refreshTokenHash: hashToken(refreshToken),
      clientId,
      refreshExpiresAt: { $gt: new Date(now) },
    },
    { $set: fields },
    { returnDocument: 'after' }
  );
  return doc ? pair : null;
}

export async function resolveAccessToken(
  token: string
): Promise<{ grantId: string; userEmail: string; userName: string } | null> {
  if (!isTokenOfKind(token, 'access')) return null;
  const collection = await getCollection();
  const doc = await collection.findOne({
    accessTokenHash: hashToken(token),
    accessExpiresAt: { $gt: new Date() },
  });
  if (!doc?._id) return null;
  return { grantId: doc._id.toHexString(), userEmail: doc.userEmail, userName: doc.userName };
}

export async function touchGrant(grantId: string): Promise<void> {
  const collection = await getCollection();
  const now = Date.now();
  await collection.updateOne(
    {
      _id: new ObjectId(grantId),
      $or: [{ lastUsedAt: null }, { lastUsedAt: { $lt: new Date(now - TOUCH_INTERVAL_MS) } }],
    },
    { $set: { lastUsedAt: new Date(now) } }
  );
}

// RFC 7009: the client may present either token; either kills the grant.
export async function revokeTokenForClient(token: string, clientId: string): Promise<void> {
  const collection = await getCollection();
  const hash = hashToken(token);
  await collection.deleteOne({
    clientId,
    $or: [{ accessTokenHash: hash }, { refreshTokenHash: hash }],
  });
}

export async function listGrantsForUser(userEmail: string): Promise<ConnectedApp[]> {
  const collection = await getCollection();
  const docs = await collection
    .find({ userEmail: userEmail.toLowerCase() })
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map((doc) => ({
    id: doc._id!.toHexString(),
    clientName: doc.clientName,
    redirectHost: doc.redirectHost,
    createdAt: doc.createdAt.toISOString(),
    lastUsedAt: doc.lastUsedAt ? doc.lastUsedAt.toISOString() : null,
  }));
}

export async function deleteGrantForUser(id: string, userEmail: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const collection = await getCollection();
  const result = await collection.deleteOne({
    _id: new ObjectId(id),
    userEmail: userEmail.toLowerCase(),
  });
  return result.deletedCount === 1;
}
