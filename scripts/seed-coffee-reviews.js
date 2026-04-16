const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI not set in .env.local');
  process.exit(1);
}

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

const now = new Date().toISOString();

// Updates for existing records (fix ratings + add links)
const updates = [
  {
    id: '68270c9c050b8a42cd4b0f78',
    placeName: 'קפה בית',
    // ratings already correct, just add links
    mapsUrl: 'https://maps.google.com/?q=HaRav+Yedidya+Frenkel+43+Tel+Aviv',
    instagramUrl: 'https://www.instagram.com/cafe_bayit/',
  },
  {
    id: '6827125e3c0fe2f6b1ab3832',
    placeName: 'ססיל הוטל',
    // ratings already correct, just add links
    mapsUrl: 'https://maps.google.com/?q=Abarbanel+52+Tel+Aviv',
    instagramUrl: 'https://www.instagram.com/hotel.cecil.tlv/',
  },
  {
    id: '67d8812acc5ffd607e3e9f84',
    placeName: 'Fucking Sunday',
    // ratings already correct, just add links
    mapsUrl: 'https://maps.google.com/?q=Levinski+61+Tel+Aviv',
    instagramUrl: 'https://www.instagram.com/fckn_sunday/',
  },
  {
    id: '6870d5a2f5c7052f8e7f5410',
    placeName: 'קלארו',
    tomCoffeeRating: 10, tomFoodRating: 10, tomAtmosphereRating: 9, tomPriceRating: 7,
    tomerCoffeeRating: 10, tomerFoodRating: 10, tomerAtmosphereRating: 8, tomerPriceRating: 8,
    mapsUrl: 'https://maps.google.com/?q=Claro+23+Haarbaa+Tel+Aviv',
    instagramUrl: 'https://www.instagram.com/clarotlv/',
  },
  {
    id: '6870d5b4f5c7052f8e7f5411',
    placeName: 'אלוף בצלות',
    tomCoffeeRating: 7, tomFoodRating: 10, tomAtmosphereRating: 10, tomPriceRating: 8,
    tomerCoffeeRating: 8, tomerFoodRating: 10, tomerAtmosphereRating: 8.5, tomerPriceRating: 8.5,
    mapsUrl: 'https://maps.google.com/?q=Simtat+Aluf+Batslut+6+Tel+Aviv',
    instagramUrl: 'https://www.instagram.com/alufbatslut/',
  },
  {
    id: '6870d577f5c7052f8e7f540f',
    placeName: 'קפה רבי (בית חנה)',
    tomCoffeeRating: 5, tomFoodRating: 6, tomAtmosphereRating: 10, tomPriceRating: 6,
    tomerCoffeeRating: 5, tomerFoodRating: 4, tomerAtmosphereRating: 10, tomerPriceRating: 4,
    mapsUrl: 'https://maps.google.com/?q=Compert+5+Tel+Aviv',
    instagramUrl: 'https://www.instagram.com/cafe_rabi/',
  },
  {
    id: '6870d5e7f5c7052f8e7f5412',
    placeName: 'P.O.C',
    tomCoffeeRating: 0, tomFoodRating: 0, tomAtmosphereRating: 0, tomPriceRating: 0,
    tomerCoffeeRating: 5, tomerFoodRating: 6, tomerAtmosphereRating: 8, tomerPriceRating: 6,
    mapsUrl: 'https://maps.google.com/?q=Kfar+Gilaadi+48+Tel+Aviv',
    instagramUrl: 'https://www.instagram.com/p.o.c.c.a.f.e/',
  },
  {
    id: '6870d615f5c7052f8e7f5413',
    placeName: 'E.Z',
    tomCoffeeRating: 8, tomFoodRating: 10, tomAtmosphereRating: 8, tomPriceRating: 10,
    tomerCoffeeRating: 6, tomerFoodRating: 9, tomerAtmosphereRating: 9, tomerPriceRating: 10,
    mapsUrl: 'https://maps.google.com/?q=Florentin+38+Tel+Aviv',
    instagramUrl: 'https://www.instagram.com/eazycafetlv/',
  },
];

// New records to insert
const newRecords = [
  {
    placeName: 'ברבוסה',
    tomCoffeeRating: 5, tomFoodRating: 0, tomAtmosphereRating: 0, tomPriceRating: 0,
    tomerCoffeeRating: 0, tomerFoodRating: 0, tomerAtmosphereRating: 0, tomerPriceRating: 0,
    mapsUrl: 'https://maps.google.com/?q=Abarbanel+45+Tel+Aviv',
    instagramUrl: null,
    createdAt: now, updatedAt: now,
  },
  {
    placeName: 'אליפלט',
    tomCoffeeRating: 9.5, tomFoodRating: 9, tomAtmosphereRating: 10, tomPriceRating: 8.5,
    tomerCoffeeRating: 9, tomerFoodRating: 0, tomerAtmosphereRating: 10, tomerPriceRating: 9,
    mapsUrl: 'https://maps.google.com/?q=Elifelet+26+Tel+Aviv',
    instagramUrl: 'https://www.instagram.com/_elifelet/',
    createdAt: now, updatedAt: now,
  },
  {
    placeName: 'בנדוד',
    tomCoffeeRating: 9.5, tomFoodRating: 8.5, tomAtmosphereRating: 6, tomPriceRating: 7.5,
    tomerCoffeeRating: 9.5, tomerFoodRating: 9, tomerAtmosphereRating: 6.5, tomerPriceRating: 7.5,
    mapsUrl: 'https://maps.google.com/?q=Florentin+50+Tel+Aviv',
    instagramUrl: 'https://www.instagram.com/bendodbagels/',
    createdAt: now, updatedAt: now,
  },
  {
    placeName: 'תומאס',
    tomCoffeeRating: 8, tomFoodRating: 6, tomAtmosphereRating: 7.5, tomPriceRating: 9,
    tomerCoffeeRating: 6, tomerFoodRating: 5, tomerAtmosphereRating: 7.5, tomerPriceRating: 8,
    mapsUrl: 'https://maps.google.com/?q=Florentin+33+Tel+Aviv',
    instagramUrl: null,
    createdAt: now, updatedAt: now,
  },
  {
    placeName: 'קפה בוקר',
    tomCoffeeRating: 8, tomFoodRating: 7, tomAtmosphereRating: 7.5, tomPriceRating: 7.5,
    tomerCoffeeRating: 7, tomerFoodRating: 7, tomerAtmosphereRating: 8, tomerPriceRating: 7,
    mapsUrl: 'https://maps.google.com/?q=Abarbanel+29+Tel+Aviv',
    instagramUrl: null,
    createdAt: now, updatedAt: now,
  },
  {
    placeName: 'מלביה',
    tomCoffeeRating: 8.5, tomFoodRating: 0, tomAtmosphereRating: 0, tomPriceRating: 8,
    tomerCoffeeRating: 9, tomerFoodRating: 0, tomerAtmosphereRating: 0, tomerPriceRating: 8,
    mapsUrl: 'https://maps.google.com/?q=Florentin+28+Tel+Aviv',
    instagramUrl: 'https://www.instagram.com/hamalabiya/',
    createdAt: now, updatedAt: now,
  },
  {
    placeName: 'בוטיק סנטרל',
    tomCoffeeRating: 8.5, tomFoodRating: 8, tomAtmosphereRating: 0, tomPriceRating: 8,
    tomerCoffeeRating: 6.5, tomerFoodRating: 8, tomerAtmosphereRating: 0, tomerPriceRating: 8,
    mapsUrl: 'https://maps.google.com/?q=Dizengoff+161+Tel+Aviv',
    instagramUrl: 'https://www.instagram.com/boutique_central/',
    createdAt: now, updatedAt: now,
  },
  {
    placeName: 'ידידיה',
    tomCoffeeRating: 9, tomFoodRating: 9, tomAtmosphereRating: 8, tomPriceRating: 9,
    tomerCoffeeRating: 9.5, tomerFoodRating: 8, tomerAtmosphereRating: 9, tomerPriceRating: 9.5,
    mapsUrl: 'https://maps.google.com/?q=Yedidya+Frankel+29+Tel+Aviv',
    instagramUrl: 'https://www.instagram.com/yedidi.ya/',
    createdAt: now, updatedAt: now,
  },
];

async function main() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const collection = db.collection('coffeeReviews');

    // Update existing records
    let updatedCount = 0;
    for (const update of updates) {
      const { id, ...fields } = update;
      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { ...fields, updatedAt: now } }
      );
      if (result.modifiedCount > 0) {
        updatedCount++;
        console.log(`Updated: ${update.placeName}`);
      } else {
        console.log(`No change or not found: ${update.placeName}`);
      }
    }

    // Insert new records
    const insertResult = await collection.insertMany(newRecords);
    console.log(`\nInserted ${insertResult.insertedCount} new records`);
    console.log(`Updated ${updatedCount} existing records`);
    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
