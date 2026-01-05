/**
 * Preload Restaurant Cache
 * 
 * Run this script to pre-populate the localStorage cache
 * This ensures instant map loading on first visit
 * 
 * Usage: node scripts/preloadRestaurantCache.js
 */

const admin = require('firebase-admin');
const path = require('path');
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

async function generateCache() {
  console.log('🔄 Loading restaurants from Firestore...\n');
  
  const startTime = Date.now();
  const snapshot = await db.collection('restaurants').get();
  
  const restaurants = [];
  const newOrleansBounds = {
    minLat: 29.85,
    maxLat: 30.15,
    minLng: -90.35,
    maxLng: -89.75,
  };
  
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const lat = data.lat;
    const lng = data.lng;
    
    if (
      typeof lat === "number" &&
      typeof lng === "number" &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat !== 0 &&
      lng !== 0 &&
      lat >= newOrleansBounds.minLat &&
      lat <= newOrleansBounds.maxLat &&
      lng >= newOrleansBounds.minLng &&
      lng <= newOrleansBounds.maxLng
    ) {
      restaurants.push({
        id: doc.id,
        ...data,
      });
    }
  });
  
  const loadTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✅ Loaded ${restaurants.length} restaurants in ${loadTime}s\n`);
  
  // Generate cache JSON
  const cache = {
    data: restaurants,
    timestamp: Date.now(),
  };
  
  // Write to file
  const cacheFile = path.join(__dirname, '..', 'public', 'restaurants-cache.json');
  fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
  
  console.log(`📦 Cache file written to: ${cacheFile}`);
  console.log(`📊 Cache size: ${(JSON.stringify(cache).length / 1024).toFixed(2)} KB\n`);
  console.log('✅ Cache generated! The app will load this on first visit.');
}

generateCache().catch(console.error);





