const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI not set in .env.local');
  process.exit(1);
}

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

// photoUrl for each cafe (matched by placeName)
// photoData/photoType/photoName/photoSize will be unset for records that stored base64
const photoUpdates = [
  {
    placeName: 'קפה בית',
    photoUrl: 'https://img02.restaurantguru.com/ca0a-Cafe-Bayit-Tel-Aviv-Yafo-interior.jpg',
    clearBase64: true,
  },
  {
    placeName: 'ססיל הוטל',
    photoUrl: 'https://medias.timeout.co.il/www/uploads/2025/01/7-2000x1125.jpg',
    clearBase64: false,
  },
  {
    placeName: 'Fucking Sunday',
    photoUrl: 'https://medias.timeout.co.il/www/uploads/2021/11/fuckingsunday-2000x1125.jpg',
    clearBase64: true,
  },
  {
    placeName: 'קלארו',
    photoUrl: 'https://medias.timeout.co.il/www/uploads/2021/09/1631174384_5489-2000x1125.jpg',
    clearBase64: false,
  },
  {
    placeName: 'אלוף בצלות',
    photoUrl: 'https://medias.timeout.co.il/www/uploads/2022/02/WhatsApp-Image-2022-02-15-at-13.23.16-e1644924246177-2000x1125.jpeg',
    clearBase64: false,
  },
  {
    placeName: 'קפה רבי (בית חנה)',
    photoUrl: 'https://img.haarets.co.il/bs/00000183-0c74-d362-a7e7-5e7ea1e50000/64/21/e8fe285e406dbeddd9d9067f67ca/20987.jpg',
    clearBase64: false,
  },
  {
    placeName: 'P.O.C',
    photoUrl: 'https://medias.timeout.co.il/www/uploads/2022/05/poc__4-1000x667.jpg',
    clearBase64: false,
  },
  {
    placeName: 'E.Z',
    photoUrl: 'https://medias.timeout.co.il/www/uploads/2020/03/%D7%90%D7%99%D7%96%D7%99-%D7%A7%D7%A4%D7%94-1000x666.jpg',
    clearBase64: false,
  },
  {
    placeName: 'ברבוסה',
    photoUrl: 'https://eatintlv.com/wp-content/uploads/2017/10/Barbosa-5-1024x458.jpg',
    clearBase64: false,
  },
  {
    placeName: 'אליפלט',
    photoUrl: 'https://medias.timeout.co.il/www/uploads/2023/08/1693202102_1306014_58014-2000x1125.jpg',
    clearBase64: false,
  },
  {
    placeName: 'בנדוד',
    photoUrl: 'https://medias.timeout.co.il/www/uploads/2023/01/IMG-6712-1000x750.jpg',
    clearBase64: false,
  },
  {
    placeName: 'תומאס',
    photoUrl: 'https://medias.timeout.co.il/www/uploads/2024/09/IMG_9021-2000x1125.jpg',
    clearBase64: false,
  },
  {
    placeName: 'קפה בוקר',
    photoUrl: 'https://medias.timeout.co.il/www/uploads/2022/05/IMG_6473-1000x750.jpeg',
    clearBase64: false,
  },
  {
    placeName: 'מלביה',
    photoUrl: 'https://medias.timeout.co.il/www/uploads/2024/11/4534ae8f-da7c-42d0-ab93-009925dfc4a1-2000x1125-1732604819.jpg',
    clearBase64: false,
  },
  {
    placeName: 'בוטיק סנטרל',
    photoUrl: 'https://eatintlv.com/wp-content/uploads/2017/09/Boutique-Central-Dizengoff-1-350x450.jpg',
    clearBase64: false,
  },
  {
    placeName: 'ידידיה',
    photoUrl: 'https://cityrattelaviv.wordpress.com/wp-content/uploads/2024/01/20240107_214457.jpg',
    clearBase64: false,
  },
];

async function main() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const collection = db.collection('coffeeReviews');
    const now = new Date().toISOString();

    let updatedCount = 0;
    for (const { placeName, photoUrl, clearBase64 } of photoUpdates) {
      const setFields = { photoUrl, updatedAt: now };
      const update = clearBase64
        ? { $set: setFields, $unset: { photoData: '', photoType: '', photoName: '', photoSize: '' } }
        : { $set: setFields };

      const result = await collection.updateOne({ placeName }, update);
      if (result.modifiedCount > 0) {
        updatedCount++;
        console.log(`✓ ${placeName}`);
      } else {
        console.log(`✗ Not found or unchanged: ${placeName}`);
      }
    }

    console.log(`\nUpdated ${updatedCount}/${photoUpdates.length} records`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
