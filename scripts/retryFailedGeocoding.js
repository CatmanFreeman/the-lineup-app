/**
 * Retry Failed Geocoding
 * 
 * Retries geocoding for restaurants that failed previously
 * Run this after fixing API key restrictions
 */

const admin = require('firebase-admin');
const path = require('path');
const { geocodeAddressSafe, isInWater } = require('./geocodeAddress');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'firebase-admin-key.json');
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function retryFailed() {
  console.log('🔍 Finding restaurants that need geocoding...\n');
  
  const snapshot = await db.collection('restaurants').get();
  const restaurants = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(r => {
      // Find restaurants that:
      // 1. Have an address
      // 2. Don't have geocodedAddress field (weren't successfully geocoded)
      // OR have coordinates that are clearly wrong (0,0 or default values)
      return r.address && 
             (!r.geocodedAddress || 
              !r.lat || 
              !r.lng || 
              r.lat === 0 || 
              r.lng === 0 ||
              (r.lat === 29.9511 && r.lng === -90.12)); // Default fallback coordinate
    });
  
  console.log(`📊 Found ${restaurants.length} restaurants that need geocoding\n`);
  
  if (restaurants.length === 0) {
    console.log('✅ All restaurants are already geocoded!');
    return;
  }
  
  let fixed = 0;
  let errors = 0;
  
  for (let i = 0; i < restaurants.length; i++) {
    const restaurant = restaurants[i];
    console.log(`[${i + 1}/${restaurants.length}] ${restaurant.name}`);
    console.log(`   🔍 Geocoding: ${restaurant.address.line1 || ''}, ${restaurant.address.city || ''}, ${restaurant.address.state || ''}`);
    
    try {
      const geocoded = await geocodeAddressSafe(restaurant.address);
      
      if (isInWater(geocoded.lat, geocoded.lng)) {
        console.log(`   ⚠️  Geocoded coordinates in water: ${geocoded.lat}, ${geocoded.lng}`);
        console.log(`   ⚠️  Address may be incorrect or in water area`);
        errors++;
        continue;
      }
      
      await db.collection('restaurants').doc(restaurant.id).update({
        lat: geocoded.lat,
        lng: geocoded.lng,
        geocodedAddress: geocoded.formattedAddress,
        coordinatesUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      console.log(`   ✅ Updated: ${geocoded.lat}, ${geocoded.lng}`);
      fixed++;
      
      // Rate limiting
      if (i < restaurants.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
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
  console.log(`❌ Errors: ${errors}`);
  console.log('='.repeat(50));
  console.log('\n🎉 Done!');
}

retryFailed().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});





