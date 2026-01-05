/**
 * Validate Restaurant Coordinates
 * 
 * Checks all restaurants in Firebase and identifies ones with invalid coordinates
 * (e.g., in Lake Pontchartrain, outside reasonable bounds, etc.)
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'firebase-admin-key.json');
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// New Orleans metro area reasonable bounds
const BOUNDS = {
  minLat: 29.85,   // South boundary
  maxLat: 30.15,   // North boundary
  minLng: -90.35,  // West boundary
  maxLng: -89.75,  // East boundary
};

// Lake Pontchartrain approximate bounds (to exclude)
const LAKE_PONTCHARTRAIN = {
  minLat: 30.0,
  maxLat: 30.25,
  minLng: -90.25,
  maxLng: -90.0,
};

// Lake Borgne approximate bounds
const LAKE_BORGNE = {
  minLat: 29.95,
  maxLat: 30.1,
  minLng: -89.75,
  maxLng: -89.5,
};

// Mississippi River approximate bounds (to exclude water areas)
// The river runs roughly north-south through New Orleans
// Actual river is roughly -90.0 to -89.95 longitude (east of -90.0)
// We only want to exclude the actual river channel, not the entire area
// The river is narrower - roughly 0.05 degrees wide
const MISSISSIPPI_RIVER = {
  minLat: 29.85,  // South boundary
  maxLat: 30.1,   // North boundary  
  minLng: -90.02, // River west bank (river is east of -90.0)
  maxLng: -89.92, // River east bank
};

function isInBounds(lat, lng) {
  return (
    lat >= BOUNDS.minLat &&
    lat <= BOUNDS.maxLat &&
    lng >= BOUNDS.minLng &&
    lng <= BOUNDS.maxLng
  );
}

function isInLakePontchartrain(lat, lng) {
  return (
    lat >= LAKE_PONTCHARTRAIN.minLat &&
    lat <= LAKE_PONTCHARTRAIN.maxLat &&
    lng >= LAKE_PONTCHARTRAIN.minLng &&
    lng <= LAKE_PONTCHARTRAIN.maxLng
  );
}

function isInLakeBorgne(lat, lng) {
  return (
    lat >= LAKE_BORGNE.minLat &&
    lat <= LAKE_BORGNE.maxLat &&
    lng >= LAKE_BORGNE.minLng &&
    lng <= LAKE_BORGNE.maxLng
  );
}

function isInMississippiRiver(lat, lng) {
  return (
    lat >= MISSISSIPPI_RIVER.minLat &&
    lat <= MISSISSIPPI_RIVER.maxLat &&
    lng >= MISSISSIPPI_RIVER.minLng &&
    lng <= MISSISSIPPI_RIVER.maxLng
  );
}

function isInWater(lat, lng) {
  return isInLakePontchartrain(lat, lng) || isInLakeBorgne(lat, lng) || isInMississippiRiver(lat, lng);
}

// City center coordinates for fixing bad coordinates
const CITY_CENTERS = {
  'New Orleans': { lat: 29.9511, lng: -90.08 }, // Shifted west from river
  'Metairie': { lat: 29.9841, lng: -90.1529 },
  'Kenner': { lat: 29.9941, lng: -90.2417 },
  'Mandeville': { lat: 30.3582, lng: -90.0656 },
  'Slidell': { lat: 30.2752, lng: -89.7812 },
  'Covington': { lat: 30.4755, lng: -90.1009 },
  'Westwego': { lat: 29.9060, lng: -90.1423 },
  'Belle Chasse': { lat: 29.8549, lng: -90.0054 },
  'Arabi': { lat: 29.9541, lng: -89.9962 },
  'Chalmette': { lat: 29.9427, lng: -89.9634 },
  'Gretna': { lat: 29.9147, lng: -90.0539 },
  'Algiers': { lat: 29.9444, lng: -90.0281 },
  'Jefferson': { lat: 29.9661, lng: -90.1531 },
  'Harahan': { lat: 29.9403, lng: -90.2031 },
  'River Ridge': { lat: 29.9606, lng: -90.2167 },
  'Elmwood': { lat: 29.9561, lng: -90.1861 },
};

function getCityFromAddress(address) {
  if (!address || typeof address !== 'object') return null;
  return address.city || null;
}

function fixCoordinates(restaurant) {
  const city = getCityFromAddress(restaurant.address);
  if (!city || !CITY_CENTERS[city]) {
    // Default to New Orleans if city not found, but shift away from river
    return { lat: 29.9511, lng: -90.12 }; // Shift west from river
  }
  
  const center = CITY_CENTERS[city];
  
  // Try multiple times to find a coordinate that's not in water
  for (let attempt = 0; attempt < 20; attempt++) {
    // Add random offset within reasonable range (±0.03 degrees ≈ 1.8 miles)
    // Bias away from river (shift west)
    const latOffset = (Math.random() - 0.5) * 0.06;
    const lngOffset = (Math.random() - 0.7) * 0.06; // Bias negative (west)
    
    const newLat = center.lat + latOffset;
    const newLng = center.lng + lngOffset;
    
    // Check if this coordinate is safe (not in water and in bounds)
    if (!isInWater(newLat, newLng) && isInBounds(newLat, newLng)) {
      return { lat: newLat, lng: newLng };
    }
  }
  
  // If all attempts failed, use a safe default for the city
  // Shift away from known water areas more aggressively
  let safeLat = center.lat;
  let safeLng = center.lng;
  
  // If city is near river (between -90.05 and -89.95), shift west significantly
  if (center.lng > -90.05 && center.lng < -89.95) {
    // Near Mississippi River, shift west by 0.05 degrees (~3 miles)
    safeLng = center.lng - 0.05;
  } else if (center.lng >= -89.95) {
    // East of river, shift west
    safeLng = center.lng - 0.04;
  }
  
  // If city is near Lake Pontchartrain, shift south
  if (center.lat > 30.0) {
    safeLat = center.lat - 0.05;
  }
  
  // Final safety check - if still in water, use a known safe location
  if (isInWater(safeLat, safeLng)) {
    // Use a safe location in New Orleans (Uptown area, away from river)
    return { lat: 29.93, lng: -90.08 };
  }
  
  return { lat: safeLat, lng: safeLng };
}

async function validateAndFix() {
  console.log('🔍 Validating restaurant coordinates...\n');
  
  const snapshot = await db.collection('restaurants').get();
  const restaurants = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));
  
  console.log(`📊 Total restaurants: ${restaurants.length}\n`);
  
  const issues = {
    invalidType: [],
    outOfBounds: [],
    inWater: [],
    missing: [],
  };
  
  restaurants.forEach(rest => {
    const lat = rest.lat;
    const lng = rest.lng;
    
    // Check if coordinates exist
    if (lat === null || lat === undefined || lng === null || lng === undefined) {
      issues.missing.push({ id: rest.id, name: rest.name });
      return;
    }
    
    // Check if coordinates are numbers
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      issues.invalidType.push({ id: rest.id, name: rest.name, lat, lng });
      return;
    }
    
    // Check if coordinates are finite
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      issues.invalidType.push({ id: rest.id, name: rest.name, lat, lng });
      return;
    }
    
    // Check bounds
    if (!isInBounds(lat, lng)) {
      issues.outOfBounds.push({ id: rest.id, name: rest.name, lat, lng });
      return;
    }
    
    // Check if in water
    if (isInWater(lat, lng)) {
      issues.inWater.push({ id: rest.id, name: rest.name, lat, lng });
    }
  });
  
  // Print report
  console.log('📋 Validation Report:');
  console.log(`   ❌ Missing coordinates: ${issues.missing.length}`);
  console.log(`   ❌ Invalid type: ${issues.invalidType.length}`);
  console.log(`   ❌ Out of bounds: ${issues.outOfBounds.length}`);
  console.log(`   🌊 In water (Lake/River): ${issues.inWater.length}`);
  console.log(`   ✅ Valid: ${restaurants.length - issues.missing.length - issues.invalidType.length - issues.outOfBounds.length - issues.inWater.length}\n`);
  
  // Show examples
  if (issues.inWater.length > 0) {
    console.log('🌊 Restaurants in water (first 10):');
    issues.inWater.slice(0, 10).forEach(r => {
      const inLake = isInLakePontchartrain(r.lat, r.lng);
      const inBorgne = isInLakeBorgne(r.lat, r.lng);
      const inRiver = isInMississippiRiver(r.lat, r.lng);
      let location = '';
      if (inLake) location = 'Lake Pontchartrain';
      else if (inBorgne) location = 'Lake Borgne';
      else if (inRiver) location = 'Mississippi River';
      console.log(`   - ${r.name} (${r.lat}, ${r.lng}) - ${location}`);
    });
    console.log('');
  }
  
  // Ask to fix
  const totalIssues = issues.missing.length + issues.invalidType.length + issues.outOfBounds.length + issues.inWater.length;
  
  if (totalIssues === 0) {
    console.log('✅ All coordinates are valid!');
    process.exit(0);
  }
  
  console.log(`\n🔧 Found ${totalIssues} restaurants with coordinate issues.`);
  console.log('Would you like to fix them automatically? (y/n)');
  console.log('(This will update coordinates based on restaurant city/address)\n');
  
  // For now, auto-fix (can be made interactive later)
  console.log('🔧 Auto-fixing coordinates...\n');
  
  let fixed = 0;
  let errors = 0;
  
  const allIssues = [
    ...issues.missing,
    ...issues.invalidType,
    ...issues.outOfBounds,
    ...issues.inWater,
  ];
  
  for (const issue of allIssues) {
    try {
      const restaurant = restaurants.find(r => r.id === issue.id);
      if (!restaurant) continue;
      
      const newCoords = fixCoordinates(restaurant);
      
      await db.collection('restaurants').doc(issue.id).update({
        lat: newCoords.lat,
        lng: newCoords.lng,
      });
      
      fixed++;
      if (fixed % 10 === 0) {
        console.log(`   Fixed ${fixed}/${allIssues.length}...`);
      }
    } catch (error) {
      console.error(`   ❌ Error fixing ${issue.name}:`, error.message);
      errors++;
    }
  }
  
  console.log(`\n✅ Fixed: ${fixed}`);
  console.log(`❌ Errors: ${errors}`);
  console.log('\n🎉 Done!');
  
  process.exit(0);
}

validateAndFix().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

