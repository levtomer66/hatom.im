# MongoDB Setup for Coffee Reviews API

This project now uses MongoDB to store coffee reviews. Follow these instructions to set up MongoDB for this project.

## Prerequisites

- MongoDB Atlas account or a local MongoDB installation
- Node.js and npm installed

## Setup Instructions

### 1. MongoDB Atlas Setup (Recommended for Production)

1. Create a MongoDB Atlas account at [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster (the free tier is sufficient for development)
3. In the Security tab, create a database user with read and write permissions
4. In the Network Access tab, add your IP address or allow access from anywhere for development
5. In the Database tab, click "Connect" and select "Connect your application"
6. Copy the connection string and replace `<password>` with your database user's password

### 2. Local MongoDB Setup (Alternative for Development)

1. Install MongoDB Community Edition from [https://www.mongodb.com/try/download/community](https://www.mongodb.com/try/download/community)
2. Start the MongoDB service
3. Use the connection string: `mongodb://localhost:27017/coffee-reviews`

### 3. Environment Configuration

1. Create a `.env.local` file in the root of your project
2. Add your MongoDB connection string:

```
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/coffee-reviews?retryWrites=true&w=majority
```

Or for local development:

```
MONGODB_URI=mongodb://localhost:27017/coffee-reviews
```

## Database Structure

The application uses a collection called `coffeeReviews` with the following structure:

```typescript
interface CoffeeReview {
  _id: ObjectId;          // MongoDB document ID
  placeName: string;      // Name of the coffee shop
  coffeeRating: number;   // Rating from 1-5
  foodRating: number;     // Rating from 1-5
  atmosphereRating: number; // Rating from 1-5
  priceRating: number;    // Rating from 1-5
  photoUrl?: string;      // Optional URL to a photo
  createdAt: string;      // ISO date string
  updatedAt: string;      // ISO date string
}
```

## API Endpoints

The following API endpoints are available:

- `GET /api/coffee-reviews` - Get all coffee reviews
- `POST /api/coffee-reviews` - Create a new coffee review
- `GET /api/coffee-reviews/:id` - Get a specific coffee review
- `PATCH /api/coffee-reviews/:id` - Update a specific coffee review
- `DELETE /api/coffee-reviews/:id` - Delete a specific coffee review

## Migrating Existing Data

If you have existing coffee reviews in the JSON file, you can migrate them to MongoDB using the following steps:

1. Create a migration script in `scripts/migrate-coffee-reviews.js`:

```javascript
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function main() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    const collection = db.collection('coffeeReviews');
    
    // Read the JSON file
    const filePath = path.join(process.cwd(), 'src/data/coffee-reviews.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    if (data.length === 0) {
      console.log('No data to migrate');
      return;
    }
    
    // Insert the data into MongoDB
    const result = await collection.insertMany(data);
    console.log(`${result.insertedCount} documents inserted`);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
```

2. Run the script:

```bash
node scripts/migrate-coffee-reviews.js
```

## Troubleshooting

- If you encounter connection issues, make sure your IP address is whitelisted in MongoDB Atlas
- Check that your connection string is correct in the `.env.local` file
- Ensure that the MongoDB service is running if using a local installation 