import clientPromise from '@/lib/mongodb';
import {
  generateToken,
  hashToken,
  type ClientAuthMethod,
  type ClientRegistration,
} from '@/lib/oauth-core';

// Dynamically registered OAuth clients (RFC 7591) — ChatGPT, claude.ai,
// Copilot each register themselves the first time a user adds the connector.
// Confidential clients get a secret; only its hash is stored.
const COLLECTION_NAME = 'oauthClients';

export interface OAuthClient {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  tokenEndpointAuthMethod: ClientAuthMethod;
  createdAt: Date;
}

interface OAuthClientDocument extends OAuthClient {
  clientSecretHash: string | null;
}

let indexesEnsured: Promise<void> | null = null;

async function getCollection() {
  const client = await clientPromise;
  const collection = client.db().collection<OAuthClientDocument>(COLLECTION_NAME);
  if (!indexesEnsured) {
    indexesEnsured = collection
      .createIndex({ clientId: 1 }, { unique: true })
      .then(() => undefined)
      .catch((error) => {
        indexesEnsured = null;
        throw error;
      });
  }
  await indexesEnsured;
  return collection;
}

function toPublic(doc: OAuthClientDocument): OAuthClient {
  return {
    clientId: doc.clientId,
    clientName: doc.clientName,
    redirectUris: doc.redirectUris,
    tokenEndpointAuthMethod: doc.tokenEndpointAuthMethod,
    createdAt: doc.createdAt,
  };
}

export async function registerOAuthClient(
  registration: ClientRegistration
): Promise<{ client: OAuthClient; clientSecret: string | null }> {
  const collection = await getCollection();
  const clientSecret =
    registration.tokenEndpointAuthMethod === 'none' ? null : generateToken('secret');
  const doc: OAuthClientDocument = {
    clientId: generateToken('client'),
    clientName: registration.clientName,
    redirectUris: registration.redirectUris,
    tokenEndpointAuthMethod: registration.tokenEndpointAuthMethod,
    clientSecretHash: clientSecret ? hashToken(clientSecret) : null,
    createdAt: new Date(),
  };
  await collection.insertOne({ ...doc });
  return { client: toPublic(doc), clientSecret };
}

export async function getOAuthClient(clientId: string): Promise<OAuthClient | null> {
  const collection = await getCollection();
  const doc = await collection.findOne({ clientId });
  return doc ? toPublic(doc) : null;
}

export async function verifyOAuthClientSecret(
  clientId: string,
  secret: string
): Promise<boolean> {
  const collection = await getCollection();
  const doc = await collection.findOne(
    { clientId, clientSecretHash: hashToken(secret) },
    { projection: { _id: 1 } }
  );
  return doc !== null;
}
