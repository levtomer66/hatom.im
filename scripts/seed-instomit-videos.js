/**
 * Seed script for InsTomit videos
 * Run with: node scripts/seed-instomit-videos.js
 * 
 * Make sure MONGODB_URI is set in your environment or .env.local file
 */

const { MongoClient } = require('mongodb');

// Try to load dotenv if available
try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {
  // dotenv not installed, that's fine - use environment variable directly
}

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Please set MONGODB_URI environment variable');
  process.exit(1);
}

// Sample YouTube Shorts videos for POC - These are actual vertical Shorts
const sampleVideos = [
  {
    youtubeUrl: 'https://www.youtube.com/shorts/ZPrAKuOBWzw',
    title: 'Satisfying art compilation',
    likes: 42,
    comments: [
      {
        id: 'comment-1',
        name: 'תומית',
        text: 'הסרטון הכי טוב!',
        createdAt: new Date().toISOString(),
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    youtubeUrl: 'https://www.youtube.com/shorts/gQlMMD8auMs',
    title: 'Cute puppy moments',
    likes: 28,
    comments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    youtubeUrl: 'https://www.youtube.com/shorts/2ZIpFytCSVc',
    title: 'Amazing nature view',
    likes: 15,
    comments: [
      {
        id: 'comment-2',
        name: 'תומר',
        text: 'וואו איזה יופי!',
        createdAt: new Date().toISOString(),
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

async function seedVideos() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    const collection = db.collection('videos');
    
    // Check if videos already exist
    const existingCount = await collection.countDocuments();
    if (existingCount > 0) {
      console.log(`Found ${existingCount} existing videos. Skipping seed.`);
      console.log('To reseed, delete existing videos first.');
      return;
    }
    
    // Insert sample videos
    const result = await collection.insertMany(sampleVideos);
    console.log(`Successfully inserted ${result.insertedCount} sample videos!`);
    
    // List inserted videos
    const videos = await collection.find({}).toArray();
    console.log('\nSeeded videos:');
    videos.forEach((video, index) => {
      console.log(`${index + 1}. ${video.title} (${video._id})`);
    });
    
  } catch (error) {
    console.error('Error seeding videos:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\nDatabase connection closed');
  }
}

seedVideos();
