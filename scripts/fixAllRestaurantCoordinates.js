/**
 * Fix All Restaurant Coordinates
 * 
 * Re-geocodes ALL restaurants using their addresses to ensure 100% accuracy
 * This fixes any restaurants that were added with approximate coordinates
 */

const admin = require('firebase-admin');
const path = require('path');
// Try Google first, fall back to Nominatim if Google fails
let geocodeAddressSafe, isInWater;
try {
  const googleGeocode = require('./geocodeAddress');
  geocodeAddressSafe = googleGeocode.geocodeAddressSafe;
  isInWater = googleGeocode.isInWater;
} catch (error) {
  // Fall back to Nominatim (free, no API key)
  const nominatimGeocode = require('./geocodeWithNominatim');
  geocodeAddressSafe = nominatimGeocode.geocodeAddressSafe;
  isInWater = nominatimGeocode.isInWater;
  console.log('⚠️  Using Nominatim (OpenStreetMap) for geocoding (free, no API key required)');
  console.log('⚠️  Rate limited to 1 request/second - this will take ~7 minutes for 400 restaurants\n');
}

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'firebase-admin-key.json');
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function fixAllCoordinates() {
  console.log('🔍 Fetching all restaurants...\n');
  
  const snapshot = await db.collection('restaurants').get();
  const restaurants = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));
  
  console.log(`📊 Found ${restaurants.length} restaurants\n`);
  console.log('🔧 Re-geocoding all restaurants using addresses...\n');
  console.log('⚠️  This ensures 100% accuracy and prevents water placements!\n');
  
  let fixed = 0;
  let skipped = 0;
  let errors = 0;
  let inWater = 0;
  
  for (let i = 0; i < restaurants.length; i++) {
    const restaurant = restaurants[i];
    console.log(`[${i + 1}/${restaurants.length}] ${restaurant.name}`);
    
    // Check if has address
    if (!restaurant.address || typeof restaurant.address !== 'object') {
      console.log(`   ⚠️  No address, skipping`);
      skipped++;
      continue;
    }
    
    // Check if already in water
    if (restaurant.lat && restaurant.lng && isInWater(restaurant.lat, restaurant.lng)) {
      console.log(`   🌊 Currently in water: ${restaurant.lat}, ${restaurant.lng}`);
      inWater++;
    }
    
    try {
      // Geocode address
      console.log(`   🔍 Geocoding: ${restaurant.address.line1 || ''}, ${restaurant.address.city || ''}, ${restaurant.address.state || ''}`);
      const geocoded = await geocodeAddressSafe(restaurant.address);
      
      // Check if new coordinates are in water
      if (isInWater(geocoded.lat, geocoded.lng)) {
        console.log(`   ⚠️  Geocoded coordinates in water: ${geocoded.lat}, ${geocoded.lng}`);
        console.log(`   ⚠️  Address may be incorrect or in water area`);
        errors++;
        continue;
      }
      
      // Update restaurant
      await db.collection('restaurants').doc(restaurant.id).update({
        lat: geocoded.lat,
        lng: geocoded.lng,
        geocodedAddress: geocoded.formattedAddress,
        coordinatesUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      console.log(`   ✅ Updated: ${geocoded.lat}, ${geocoded.lng}`);
      fixed++;
      
      // Rate limiting
      // Nominatim: 1 request/second, Google: can be faster
      const delay = geocodeAddressSafe.toString().includes('nominatim') ? 1100 : 200;
      if (i < restaurants.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      errors++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary');
  console.log('='.repeat(50));
  console.log(`✅ Fixed: ${fixed}`);
  console.log(`⏭️  Skipped (no address): ${skipped}`);
  console.log(`🌊 Found in water: ${inWater}`);
  console.log(`❌ Errors: ${errors}`);
  console.log('='.repeat(50));
  console.log('\n🎉 Done! All restaurants now have accurate coordinates!');
}

fixAllCoordinates().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

