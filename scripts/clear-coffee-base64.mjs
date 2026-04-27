import { MongoClient } from 'mongodb';
import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: '.env.local' });

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI not set');
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const dry = !apply;

const client = new MongoClient(process.env.MONGODB_URI);

async function main() {
  await client.connect();
  console.log(`Connected to MongoDB (${dry ? 'DRY RUN' : 'APPLY'})`);

  const db = client.db();
  const collection = db.collection('coffeeReviews');

  const docs = await collection.find({ photoData: { $exists: true } }).toArray();
  let scanned = 0;
  let cleared = 0;

  for (const doc of docs) {
    scanned++;
    console.log(JSON.stringify({
      id: doc._id.toString(),
      placeName: doc.placeName,
      hasUrl: Boolean(doc.photoUrl),
    }));

    if (apply) {
      const result = await collection.updateOne(
        { _id: doc._id },
        { $unset: { photoData: '', photoType: '', photoName: '', photoSize: '' } }
      );
      if (result.modifiedCount > 0) cleared++;
    }
  }

  const totalDocs = await collection.countDocuments();
  const alreadyClean = totalDocs - scanned;

  console.log('\nSummary:', JSON.stringify({ scanned, cleared, alreadyClean }));
  if (dry) console.log('Dry run only — pass --apply to perform $unset.');
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => client.close());
