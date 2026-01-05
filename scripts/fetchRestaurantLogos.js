/**
 * Fetch Restaurant Logos
 * 
 * Uses Google Places API to fetch restaurant logos/photos and upload to Firebase Storage
 * 
 * Usage:
 *   node scripts/fetchRestaurantLogos.js [restaurantId]
 *   (if restaurantId provided, only fetches for that restaurant)
 */

const admin = require('firebase-admin');
const path = require('path');
const https = require('https');
const fs = require('fs');

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

// Google Places API key (from index.html)
const GOOGLE_PLACES_API_KEY = 'AIzaSyASxqfOLc8oU2wzMB93bAvq4vrJMKvuum0';

/**
 * Search for a place using Google Places API
 */
async function searchPlace(restaurantName, address, lat, lng) {
  return new Promise((resolve, reject) => {
    // Try multiple search strategies
    const queries = [
      `${restaurantName} New Orleans LA`,
      `${restaurantName} ${address?.city || 'New Orleans'} ${address?.state || 'LA'}`,
      restaurantName,
    ];

    // If we have coordinates, use nearby search first
    if (lat && lng) {
      const nearbyUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=5000&type=restaurant&keyword=${encodeURIComponent(restaurantName)}&key=${GOOGLE_PLACES_API_KEY}`;
      
      https.get(nearbyUrl, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.status === 'OK' && result.results && result.results.length > 0) {
              // Find best match by name similarity
              const nameLower = restaurantName.toLowerCase();
              const bestMatch = result.results.find(r => {
                const rName = r.name.toLowerCase();
                // Check if names are similar (at least 50% match)
                const words1 = nameLower.split(/\s+/);
                const words2 = rName.split(/\s+/);
                const matchingWords = words1.filter(w => words2.some(w2 => w2.includes(w) || w.includes(w2)));
                return matchingWords.length >= Math.min(words1.length, words2.length) * 0.5;
              }) || result.results[0];
              resolve(bestMatch);
              return;
            }
          } catch (error) {
            // Fall through to text search
          }
          
          // Fall back to text search
          tryTextSearch();
        });
      }).on('error', () => tryTextSearch());
    } else {
      tryTextSearch();
    }

    function tryTextSearch() {
      // Try text search with first query
      const query = queries[0];
      const encodedQuery = encodeURIComponent(query);
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodedQuery}&type=restaurant&key=${GOOGLE_PLACES_API_KEY}`;

      https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.status === 'OK' && result.results && result.results.length > 0) {
              // Find best match by name similarity
              const nameLower = restaurantName.toLowerCase();
              const bestMatch = result.results.find(r => {
                const rName = r.name.toLowerCase();
                // Check if names are similar (at least 50% match)
                const words1 = nameLower.split(/\s+/);
                const words2 = rName.split(/\s+/);
                const matchingWords = words1.filter(w => words2.some(w2 => w2.includes(w) || w.includes(w2)));
                return matchingWords.length >= Math.min(words1.length, words2.length) * 0.5;
              }) || result.results[0];
              resolve(bestMatch);
            } else {
              resolve(null);
            }
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', reject);
    }
  });
}

/**
 * Get place details including photos
 */
async function getPlaceDetails(placeId) {
  return new Promise((resolve, reject) => {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,photos,icon&key=${GOOGLE_PLACES_API_KEY}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.status === 'OK' && result.result) {
            resolve(result.result);
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

/**
 * Download image from URL
 */
async function downloadImage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    }).on('error', reject);
  });
}

/**
 * Upload image to Firebase Storage
 */
async function uploadToStorage(imageBuffer, restaurantId, filename) {
  const bucket = storage.bucket();
  const filePath = `restaurants/${restaurantId}/logo_${filename}`;
  const file = bucket.file(filePath);

  await file.save(imageBuffer, {
    metadata: {
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=31536000',
    },
  });

  // Make file publicly accessible
  await file.makePublic();

  // Get public URL
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
  return publicUrl;
}

/**
 * Fetch logo for a single restaurant
 */
async function fetchLogoForRestaurant(restaurant) {
  try {
    console.log(`\n🔍 Searching for: ${restaurant.name}`);

    // Search for place using coordinates if available
    const place = await searchPlace(
      restaurant.name, 
      restaurant.address, 
      restaurant.lat, 
      restaurant.lng
    );
    if (!place) {
      console.log(`   ⚠️  Place not found`);
      return null;
    }

    console.log(`   ✅ Found: ${place.name}`);

    // Get place details with photos
    const details = await getPlaceDetails(place.place_id);
    if (!details || !details.photos || details.photos.length === 0) {
      console.log(`   ⚠️  No photos available`);
      return null;
    }

    // Get the first photo (usually the logo/main photo)
    const photo = details.photos[0];
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo.photo_reference}&key=${GOOGLE_PLACES_API_KEY}`;

    console.log(`   📸 Downloading photo...`);

    // Download image
    const imageBuffer = await downloadImage(photoUrl);

    // Upload to Firebase Storage
    const filename = `${Date.now()}.jpg`;
    const logoUrl = await uploadToStorage(imageBuffer, restaurant.id, filename);

    console.log(`   ✅ Uploaded: ${logoUrl}`);

    return logoUrl;
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return null;
  }
}

/**
 * Main function
 */
async function main() {
  const restaurantId = process.argv[2]; // Optional: specific restaurant ID

  console.log('🚀 Fetching restaurant logos...\n');

  let restaurants = [];

  if (restaurantId) {
    // Fetch specific restaurant
    const doc = await db.collection('restaurants').doc(restaurantId).get();
    if (doc.exists) {
      restaurants.push({ id: doc.id, ...doc.data() });
    } else {
      console.error(`❌ Restaurant ${restaurantId} not found`);
      process.exit(1);
    }
  } else {
    // Fetch all restaurants without logos
    const snapshot = await db.collection('restaurants').get();
    restaurants = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Filter to only restaurants without logos
    restaurants = restaurants.filter(r => !r.imageURL && !r.logoURL);
    console.log(`📊 Found ${restaurants.length} restaurants without logos\n`);
  }

  if (restaurants.length === 0) {
    console.log('✅ All restaurants already have logos!');
    process.exit(0);
  }

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (let i = 0; i < restaurants.length; i++) {
    const restaurant = restaurants[i];
    console.log(`[${i + 1}/${restaurants.length}] ${restaurant.name}`);

    // Skip if already has logo
    if (restaurant.imageURL || restaurant.logoURL) {
      console.log(`   ⏭️  Already has logo, skipping`);
      skipCount++;
      continue;
    }

    const logoUrl = await fetchLogoForRestaurant(restaurant);

    if (logoUrl) {
      // Update restaurant document
      await db.collection('restaurants').doc(restaurant.id).update({
        imageURL: logoUrl,
        logoURL: logoUrl,
        logoFetchedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      successCount++;
    } else {
      failCount++;
    }

    // Rate limiting - wait 200ms between requests to avoid hitting API limits
    if (i < restaurants.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary');
  console.log('='.repeat(50));
  console.log(`✅ Success: ${successCount}`);
  console.log(`⏭️  Skipped: ${skipCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log('='.repeat(50));
  console.log('\n🎉 Done!');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

