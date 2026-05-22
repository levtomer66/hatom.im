import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import {
  SpaSession,
  CreateSpaSessionDto,
  emptyFlags,
  otherSpaUser,
} from '@/types/spa';

const COLLECTION_NAME = 'spaSessions';

interface SpaSessionDocument extends Omit<SpaSession, 'id'> {
  _id?: ObjectId;
}

export async function getSpaSessionsCollection() {
  const client = await clientPromise;
  const db = client.db();
  return db.collection<SpaSessionDocument>(COLLECTION_NAME);
}

function docToSession(doc: SpaSessionDocument): SpaSession {
  const { _id, ...rest } = doc;
  return {
    ...rest,
    id: _id!.toString(),
  } as SpaSession;
}

export async function getAllSpaSessions(): Promise<SpaSession[]> {
  const collection = await getSpaSessionsCollection();
  const docs = await collection.find({}).sort({ scheduledAt: -1 }).toArray();
  return docs.map(docToSession);
}

export async function createSpaSession(
  data: CreateSpaSessionDto
): Promise<SpaSession> {
  const collection = await getSpaSessionsCollection();
  const now = new Date().toISOString();

  const newDoc: Omit<SpaSessionDocument, '_id'> = {
    giverId: data.giverId,
    receiverId: otherSpaUser(data.giverId),
    scheduledAt: data.scheduledAt,
    durationMinutes: data.durationMinutes,
    flags: data.flags ?? emptyFlags(),
    preferences: data.preferences,
    happyEnding: data.happyEnding ?? false,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(newDoc);
  return {
    ...newDoc,
    id: result.insertedId.toString(),
  } as SpaSession;
}

export async function getSpaSessionById(id: string): Promise<SpaSession | null> {
  const collection = await getSpaSessionsCollection();
  try {
    const doc = await collection.findOne({ _id: new ObjectId(id) });
    return doc ? docToSession(doc) : null;
  } catch (error) {
    console.error('Error fetching spa session by ID:', error);
    return null;
  }
}

export async function setHappyEnding(
  id: string,
  value: boolean
): Promise<SpaSession | null> {
  const collection = await getSpaSessionsCollection();
  try {
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          happyEnding: value,
          updatedAt: new Date().toISOString(),
        },
      },
      { returnDocument: 'after' }
    );
    return result ? docToSession(result) : null;
  } catch (error) {
    console.error('Error updating happy ending flag:', error);
    return null;
  }
}

export async function deleteSpaSession(id: string): Promise<boolean> {
  const collection = await getSpaSessionsCollection();
  try {
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  } catch (error) {
    console.error('Error deleting spa session:', error);
    return false;
  }
}
