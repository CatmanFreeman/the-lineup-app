/**
 * Simple Logo Fetch - Use Nearby Search
 * 
 * Since many restaurants are mock data, this uses nearby search based on coordinates
 * to find real restaurants and get their logos
 */

const admin = require('firebase-admin');
const path = require('path');
const https = require('https');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'firebase-admin-key.json');
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const storage = admin.storage();

const GOOGLE_PLACES_API_KEY = 'AIzaSyASxqfOLc8oU2wzMB93bAvq4vrJMKvuum0';

async function findNearbyRestaurant(lat, lng, restaurantName) {
  return new Promise((resolve, reject) => {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=1000&type=restaurant&key=${GOOGLE_PLACES_API_KEY}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.status === 'OK' && result.results && result.results.length > 0) {
            // Return closest restaurant (first result is closest)
            resolve(result.results[0]);
          } else {
            resolve(null);
          }
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

async function getPlaceDetails(placeId) {
  return new Promise((resolve, reject) => {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,photos,icon&key=${GOOGLE_PLACES_API_KEY}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result.status === 'OK' ? result.result : null);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

async function downloadImage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

async function uploadToStorage(imageBuffer, restaurantId) {
  const bucket = storage.bucket();
  const filePath = `restaurants/${restaurantId}/logo_${Date.now()}.jpg`;
  const file = bucket.file(filePath);
  await file.save(imageBuffer, {
    metadata: { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000' },
  });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${filePath}`;
}

async function fetchLogoForRestaurant(restaurant) {
  try {
    if (!restaurant.lat || !restaurant.lng) {
      console.log(`   ⚠️  No coordinates`);
      return null;
    }

    // Find nearby restaurant
    const nearby = await findNearbyRestaurant(restaurant.lat, restaurant.lng, restaurant.name);
    if (!nearby) {
      console.log(`   ⚠️  No nearby restaurant found`);
      return null;
    }

    // Get details with photos
    const details = await getPlaceDetails(nearby.place_id);
    if (!details || !details.photos || details.photos.length === 0) {
      console.log(`   ⚠️  No photos`);
      return null;
    }

    // Download first photo
    const photo = details.photos[0];
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photo.photo_reference}&key=${GOOGLE_PLACES_API_KEY}`;
    const imageBuffer = await downloadImage(photoUrl);

    // Upload to storage
    const logoUrl = await uploadToStorage(imageBuffer, restaurant.id);
    return logoUrl;
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🚀 Fetching restaurant logos using nearby search...\n');

  const snapshot = await db.collection('restaurants').get();
  const restaurants = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(r => !r.imageURL && !r.logoURL && r.lat && r.lng);

  console.log(`📊 Found ${restaurants.length} restaurants without logos\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < restaurants.length; i++) {
    const restaurant = restaurants[i];
    console.log(`[${i + 1}/${restaurants.length}] ${restaurant.name}`);
    
    const logoUrl = await fetchLogoForRestaurant(restaurant);
    
    if (logoUrl) {
      await db.collection('restaurants').doc(restaurant.id).update({
        imageURL: logoUrl,
        logoURL: logoUrl,
        logoFetchedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`   ✅ Uploaded: ${logoUrl}`);
      success++;
    } else {
      failed++;
    }

    // Rate limit
    if (i < restaurants.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  console.log(`\n✅ Success: ${success}`);
  console.log(`❌ Failed: ${failed}`);
}

main().catch(console.error);







