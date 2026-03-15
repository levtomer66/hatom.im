/**
 * Seed script for InsTomit videos
 * Run with: node scripts/seed-instomit-videos.js
 * 
 * Reads video data from src/data/instomit-videos.json
 * Make sure MONGODB_URI is set in your environment or .env.local file
 */

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Try to load dotenv if available
try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {
  // dotenv not installed, that's fine
}

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Please set MONGODB_URI environment variable');
  process.exit(1);
}

async function seedVideos() {
  // Read videos from JSON file
  const jsonPath = path.join(__dirname, '..', 'src', 'data', 'instomit-videos.json');
  const videosData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  console.log(`Read ${videosData.length} videos from instomit-videos.json`);

  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    const collection = db.collection('videos');
    
    // Clear existing videos
    const existingCount = await collection.countDocuments();
    if (existingCount > 0) {
      await collection.deleteMany({});
      console.log(`Cleared ${existingCount} existing videos`);
    }
    
    // Build documents from JSON, preserving order
    const now = new Date().toISOString();
    const documents = videosData.map((video, index) => ({
      youtubeUrl: video.youtubeUrl,
      title: video.title || '',
      username: video.username || '',
      likes: video.likes || 0,
      comments: (video.comments || []).map(comment => ({
        id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: comment.name,
        text: comment.text,
        createdAt: comment.createdAt || now,
      })),
      order: index, // Preserve order from JSON
      createdAt: now,
      updatedAt: now,
    }));

    // Insert all videos
    const result = await collection.insertMany(documents);
    console.log(`\nSuccessfully inserted ${result.insertedCount} videos!\n`);
    
    // List inserted videos
    const videos = await collection.find({}).sort({ order: 1 }).toArray();
    videos.forEach((video, index) => {
      const likesFormatted = video.likes >= 1000000
        ? `${(video.likes / 1000000).toFixed(1)}m`
        : video.likes >= 1000
          ? `${(video.likes / 1000).toFixed(0)}k`
          : video.likes;
      console.log(`${index + 1}. ${video.title} (${video.username}) - ${likesFormatted} likes`);
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
