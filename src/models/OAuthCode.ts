import clientPromise from '@/lib/mongodb';
import {
  AUTH_CODE_TTL_SECONDS,
  generateToken,
  hashToken,
  isTokenOfKind,
} from '@/lib/oauth-core';

// Short-lived, single-use authorization codes. A TTL index reaps them, but
// Mongo's TTL monitor only runs every ~60 s, so consume re-checks expiry.
const COLLECTION_NAME = 'oauthCodes';

export interface AuthorizationCodeGrant {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  userEmail: string;
  userName: string;
  resource: string | null;
}

interface OAuthCodeDocument extends AuthorizationCodeGrant {
  codeHash: string;
  expiresAt: Date;
}

let indexesEnsured: Promise<void> | null = null;

async function getCollection() {
  const client = await clientPromise;
  const collection = client.db().collection<OAuthCodeDocument>(COLLECTION_NAME);
  if (!indexesEnsured) {
    indexesEnsured = Promise.all([
      collection.createIndex({ codeHash: 1 }, { unique: true }),
      collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
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

export async function createAuthorizationCode(grant: AuthorizationCodeGrant): Promise<string> {
  const collection = await getCollection();
  const code = generateToken('code');
  await collection.insertOne({
    ...grant,
    codeHash: hashToken(code),
    expiresAt: new Date(Date.now() + AUTH_CODE_TTL_SECONDS * 1000),
  });
  return code;
}

// Deletes on read: a code works at most once, whether or not the rest of the
// token request turns out to be valid.
export async function consumeAuthorizationCode(
  code: string
): Promise<AuthorizationCodeGrant | null> {
  if (!isTokenOfKind(code, 'code')) return null;
  const collection = await getCollection();
  const doc = await collection.findOneAndDelete({ codeHash: hashToken(code) });
  if (!doc || doc.expiresAt.getTime() <= Date.now()) return null;
  return {
    clientId: doc.clientId,
    redirectUri: doc.redirectUri,
    codeChallenge: doc.codeChallenge,
    userEmail: doc.userEmail,
    userName: doc.userName,
    resource: doc.resource,
  };
}
