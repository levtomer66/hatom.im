const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

if (!process.env.MONGODB_URI) {
  console.error('Error: MONGODB_URI environment variable is not set.');
  console.error('Please create a .env.local file with your MongoDB connection string:');
  console.error('MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/coffee-reviews?retryWrites=true&w=majority');
  process.exit(1);
}

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function main() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    const collection = db.collection('coffeeReviews');
    
    // Check if collection already has data
    const existingCount = await collection.countDocuments();
    if (existingCount > 0) {
      console.log(`The coffeeReviews collection already contains ${existingCount} documents.`);
      const answer = await promptUser('Do you want to proceed and potentially create duplicates? (y/n): ');
      if (answer.toLowerCase() !== 'y') {
        console.log('Migration cancelled.');
        return;
      }
    }
    
    // Read the JSON file
    const filePath = path.join(process.cwd(), 'src/data/coffee-reviews.json');
    
    if (!fs.existsSync(filePath)) {
      console.error(`Error: File not found: ${filePath}`);
      console.error('Make sure you have existing coffee reviews data to migrate.');
      return;
    }
    
    const fileData = fs.readFileSync(filePath, 'utf-8');
    let data;
    
    try {
      data = JSON.parse(fileData);
    } catch (error) {
      console.error('Error parsing JSON file:', error);
      return;
    }
    
    if (!Array.isArray(data)) {
      console.error('Error: The JSON file does not contain an array.');
      return;
    }
    
    if (data.length === 0) {
      console.log('No data to migrate. The JSON file contains an empty array.');
      return;
    }
    
    // Transform the data to match MongoDB format
    const transformedData = data.map(review => {
      // Keep the original id as a separate field for reference
      const { id, ...rest } = review;
      return {
        originalId: id,
        ...rest
      };
    });
    
    // Insert the data into MongoDB
    const result = await collection.insertMany(transformedData);
    console.log(`Success! ${result.insertedCount} documents inserted into MongoDB.`);
    
    // Create a backup of the original file
    const backupPath = `${filePath}.bak`;
    fs.copyFileSync(filePath, backupPath);
    console.log(`Original data backed up to ${backupPath}`);
    
    console.log('\nMigration completed successfully!');
    console.log('You can now use the MongoDB-based API for coffee reviews.');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

// Helper function to prompt user for input
function promptUser(question) {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    readline.question(question, answer => {
      readline.close();
      resolve(answer);
    });
  });
}

main().catch(console.error); 