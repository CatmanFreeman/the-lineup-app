/**
 * Add Restaurants to Firebase
 * 
 * This script adds restaurants to the Firestore 'restaurants' collection.
 * 
 * Usage:
 *   node scripts/addRestaurants.js
 * 
 * Or with a JSON file:
 *   node scripts/addRestaurants.js restaurants.json
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { geocodeAddressSafe, isInWater } = require('./geocodeAddress');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'firebase-admin-key.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Error: firebase-admin-key.json not found!');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Sample restaurants (you can modify these or load from JSON)
const SAMPLE_RESTAURANTS = [
  {
    name: "The Lineup Bistro",
    phone: "(555) 123-4567",
    website: "https://thelineupbistro.com",
    address: {
      line1: "123 Main Street",
      line2: "",
      city: "New York",
      state: "NY",
      zip: "10001"
    },
    lat: 40.7128,
    lng: -74.0060,
    cuisines: ["American", "Bistro"],
    liveRating: 4.5,
    companyId: null, // Set to company ID if part of a company
    imageURL: null, // Add image URL if available
    hoursOfOperation: {
      Monday: { openTime: "11:00", openMeridiem: "AM", closeTime: "10:00", closeMeridiem: "PM" },
      Tuesday: { openTime: "11:00", openMeridiem: "AM", closeTime: "10:00", closeMeridiem: "PM" },
      Wednesday: { openTime: "11:00", openMeridiem: "AM", closeTime: "10:00", closeMeridiem: "PM" },
      Thursday: { openTime: "11:00", openMeridiem: "AM", closeTime: "10:00", closeMeridiem: "PM" },
      Friday: { openTime: "11:00", openMeridiem: "AM", closeTime: "11:00", closeMeridiem: "PM" },
      Saturday: { openTime: "10:00", openMeridiem: "AM", closeTime: "11:00", closeMeridiem: "PM" },
      Sunday: { openTime: "10:00", openMeridiem: "AM", closeTime: "9:00", closeMeridiem: "PM" }
    },
    preferences: {
      patioSeating: true,
      outdoorSeating: true
    }
  },
  {
    name: "Coastal Seafood House",
    phone: "(555) 234-5678",
    website: "https://coastalseafood.com",
    address: {
      line1: "456 Ocean Drive",
      line2: "Suite 200",
      city: "Miami",
      state: "FL",
      zip: "33139"
    },
    lat: 25.7617,
    lng: -80.1918,
    cuisines: ["Seafood"],
    liveRating: 4.8,
    companyId: null,
    imageURL: null,
    hoursOfOperation: {
      Monday: { openTime: "5:00", openMeridiem: "PM", closeTime: "10:00", closeMeridiem: "PM" },
      Tuesday: { openTime: "5:00", openMeridiem: "PM", closeTime: "10:00", closeMeridiem: "PM" },
      Wednesday: { openTime: "5:00", openMeridiem: "PM", closeTime: "10:00", closeMeridiem: "PM" },
      Thursday: { openTime: "5:00", openMeridiem: "PM", closeTime: "10:00", closeMeridiem: "PM" },
      Friday: { openTime: "5:00", openMeridiem: "PM", closeTime: "11:00", closeMeridiem: "PM" },
      Saturday: { openTime: "5:00", openMeridiem: "PM", closeTime: "11:00", closeMeridiem: "PM" },
      Sunday: { openTime: "5:00", openMeridiem: "PM", closeTime: "9:00", closeMeridiem: "PM" }
    },
    preferences: {
      oceanView: true,
      waterView: true,
      patioSeating: true
    }
  }
];

/**
 * Validate restaurant data
 */
function validateRestaurant(restaurant) {
  const errors = [];
  
  if (!restaurant.name || restaurant.name.trim() === '') {
    errors.push('Missing name');
  }
  
  // lat/lng are optional if address is provided (will be geocoded)
  if (!restaurant.address && (typeof restaurant.lat !== 'number' || !Number.isFinite(restaurant.lat))) {
    errors.push('Missing or invalid lat (must be a number), or provide address for geocoding');
  }
  
  if (!restaurant.address && (typeof restaurant.lng !== 'number' || !Number.isFinite(restaurant.lng))) {
    errors.push('Missing or invalid lng (must be a number), or provide address for geocoding');
  }
  
  if (restaurant.lat < -90 || restaurant.lat > 90) {
    errors.push('lat must be between -90 and 90');
  }
  
  if (restaurant.lng < -180 || restaurant.lng > 180) {
    errors.push('lng must be between -180 and 180');
  }
  
  return errors;
}

/**
 * Add a restaurant to Firestore
 */
async function addRestaurant(restaurant, options = {}) {
  const { skipIfExists = true, autoGeocode = true } = options;
  
  let lat = restaurant.lat;
  let lng = restaurant.lng;
  
  // Auto-geocode if coordinates missing or invalid
  if (autoGeocode && (!lat || !lng || !Number.isFinite(lat) || !Number.isFinite(lng)) && restaurant.address) {
    console.log(`   🔍 Geocoding address for ${restaurant.name}...`);
    try {
      const geocoded = await geocodeAddressSafe(restaurant.address);
      lat = geocoded.lat;
      lng = geocoded.lng;
      console.log(`   ✅ Geocoded: ${lat}, ${lng}`);
    } catch (error) {
      throw new Error(`Geocoding failed: ${error.message}`);
    }
  }
  
  // Validate coordinates are not in water
  if (lat && lng && isInWater(lat, lng)) {
    throw new Error(`Coordinates (${lat}, ${lng}) are in water! Please provide accurate address for geocoding.`);
  }
  
  // Update restaurant with geocoded coordinates
  restaurant.lat = lat;
  restaurant.lng = lng;
  
  // Validate
  const errors = validateRestaurant(restaurant);
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }
  
  // Check if restaurant already exists (by name and location)
  if (skipIfExists) {
    const existing = await db.collection('restaurants')
      .where('name', '==', restaurant.name)
      .where('lat', '==', restaurant.lat)
      .where('lng', '==', restaurant.lng)
      .limit(1)
      .get();
    
    if (!existing.empty) {
      return { skipped: true, id: existing.docs[0].id };
    }
  }
  
  // Prepare restaurant data
  const restaurantData = {
    name: restaurant.name.trim(),
    lat: restaurant.lat,
    lng: restaurant.lng,
    phone: restaurant.phone || null,
    website: restaurant.website || null,
    address: restaurant.address || null,
    cuisines: restaurant.cuisines || [],
    liveRating: typeof restaurant.liveRating === 'number' ? restaurant.liveRating : null,
    companyId: restaurant.companyId || null,
    imageURL: restaurant.imageURL || null,
    logoURL: restaurant.logoURL || restaurant.imageURL || null,
    hoursOfOperation: restaurant.hoursOfOperation || null,
    preferences: restaurant.preferences || {},
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  
  // Add to Firestore
  const docRef = await db.collection('restaurants').add(restaurantData);
  
  return { success: true, id: docRef.id };
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Adding restaurants to Firebase...\n');
  
  // Check if JSON file provided
  const jsonFile = process.argv[2];
  let restaurants = SAMPLE_RESTAURANTS;
  
  if (jsonFile) {
    const jsonPath = path.resolve(jsonFile);
    if (!fs.existsSync(jsonPath)) {
      console.error(`❌ Error: File not found: ${jsonPath}`);
      process.exit(1);
    }
    
    try {
      const jsonData = fs.readFileSync(jsonPath, 'utf8');
      restaurants = JSON.parse(jsonData);
      
      if (!Array.isArray(restaurants)) {
        throw new Error('JSON file must contain an array of restaurants');
      }
      
      console.log(`📄 Loaded ${restaurants.length} restaurants from ${jsonFile}\n`);
    } catch (error) {
      console.error(`❌ Error reading JSON file: ${error.message}`);
      process.exit(1);
    }
  } else {
    console.log(`📝 Using ${restaurants.length} sample restaurants from script\n`);
    console.log('💡 Tip: Create a JSON file with restaurants and run:');
    console.log('   node scripts/addRestaurants.js restaurants.json\n');
  }
  
  let added = 0;
  let skipped = 0;
  let errors = 0;
  
  // Process each restaurant
  for (let i = 0; i < restaurants.length; i++) {
    const restaurant = restaurants[i];
    
    try {
      console.log(`[${i + 1}/${restaurants.length}] ${restaurant.name || 'Unnamed'}...`);
      
      const result = await addRestaurant(restaurant);
      
      if (result.skipped) {
        console.log(`   ⏭️  Skipped (already exists): ${result.id}`);
        skipped++;
      } else {
        console.log(`   ✅ Added: ${result.id}`);
        added++;
      }
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      errors++;
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary');
  console.log('='.repeat(50));
  console.log(`✅ Added: ${added}`);
  console.log(`⏭️  Skipped (already exist): ${skipped}`);
  console.log(`❌ Errors: ${errors}`);
  console.log('='.repeat(50));
  
  if (errors === 0) {
    console.log('\n🎉 Done! All restaurants added successfully!');
  } else {
    console.log('\n⚠️  Some errors occurred. Please review and fix.');
  }
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });



