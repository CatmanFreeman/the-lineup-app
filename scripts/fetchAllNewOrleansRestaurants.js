/**
 * Fetch ALL New Orleans Restaurants
 * 
 * This script comprehensively searches New Orleans for restaurants
 * across all neighborhoods and areas.
 * 
 * Usage:
 *   node scripts/fetchAllNewOrleansRestaurants.js YOUR_API_KEY
 * 
 * Or set GOOGLE_PLACES_API_KEY environment variable
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.argv[2] || process.env.GOOGLE_PLACES_API_KEY;
const OUTPUT_FILE = path.join(__dirname, '..', 'new-orleans-all-restaurants.json');

if (!API_KEY) {
  console.error('❌ Error: Google Places API key required!');
  console.error('\n📝 How to get a Google Places API key:');
  console.error('  1. Go to: https://console.cloud.google.com/');
  console.error('  2. Create a project (or select existing)');
  console.error('  3. Enable "Places API"');
  console.error('  4. Create credentials → API Key');
  console.error('  5. Copy the key');
  console.error('\nThen run:');
  console.error('  node scripts/fetchAllNewOrleansRestaurants.js YOUR_API_KEY');
  process.exit(1);
}

// New Orleans neighborhoods and areas to search
const SEARCH_AREAS = [
  // Major neighborhoods
  { name: 'French Quarter', location: '29.9581,-90.0647', radius: 2000 },
  { name: 'Garden District', location: '29.9256,-90.0814', radius: 2000 },
  { name: 'CBD/Warehouse District', location: '29.9506,-90.0681', radius: 2000 },
  { name: 'Marigny', location: '29.9631,-90.0542', radius: 1500 },
  { name: 'Bywater', location: '29.9681,-90.0444', radius: 1500 },
  { name: 'Treme', location: '29.9611,-90.0708', radius: 1500 },
  { name: 'Mid-City', location: '29.9686,-90.1000', radius: 2000 },
  { name: 'Uptown', location: '29.9306,-90.0814', radius: 2000 },
  { name: 'Lakeview', location: '30.0081,-90.1000', radius: 1500 },
  { name: 'Algiers', location: '29.9500,-90.0500', radius: 2000 },
  
  // Cuisine-specific searches
  { name: 'Creole Restaurants', query: 'creole restaurants New Orleans', location: '29.9511,-90.0715', radius: 10000 },
  { name: 'Cajun Restaurants', query: 'cajun restaurants New Orleans', location: '29.9511,-90.0715', radius: 10000 },
  { name: 'Seafood Restaurants', query: 'seafood restaurants New Orleans', location: '29.9511,-90.0715', radius: 10000 },
  { name: 'Po Boy Restaurants', query: 'po boy restaurants New Orleans', location: '29.9511,-90.0715', radius: 10000 },
  { name: 'Jazz Brunch', query: 'jazz brunch New Orleans', location: '29.9511,-90.0715', radius: 10000 },
  
  // General searches
  { name: 'Best Restaurants', query: 'best restaurants New Orleans', location: '29.9511,-90.0715', radius: 10000 },
  { name: 'Fine Dining', query: 'fine dining New Orleans', location: '29.9511,-90.0715', radius: 10000 },
  { name: 'Casual Dining', query: 'casual restaurants New Orleans', location: '29.9511,-90.0715', radius: 10000 },
];

/**
 * Search for restaurants using Google Places API
 */
function searchPlaces(options) {
  return new Promise((resolve, reject) => {
    const { query, location, radius = 5000 } = options;
    
    let url;
    if (query) {
      url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${location}&radius=${radius}&type=restaurant&key=${API_KEY}`;
    } else {
      url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location}&radius=${radius}&type=restaurant&key=${API_KEY}`;
    }
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.status === 'OK' || json.status === 'ZERO_RESULTS') {
            resolve(json.results || []);
          } else if (json.status === 'NEXT_PAGE_TOKEN') {
            resolve(json.results || []);
          } else {
            console.warn(`  ⚠️  API Status: ${json.status} - ${json.error_message || ''}`);
            resolve([]);
          }
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Get place details
 */
function getPlaceDetails(placeId) {
  return new Promise((resolve, reject) => {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,formatted_phone_number,website,rating,geometry,types,opening_hours&key=${API_KEY}`;
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.status === 'OK') {
            resolve(json.result);
          } else {
            reject(new Error(`API Error: ${json.status}`));
          }
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Convert Google Places result to our format
 */
function convertToRestaurant(place) {
  const addressParts = (place.formatted_address || '').split(', ');
  
  // Parse address
  const address = {
    line1: addressParts[0] || '',
    line2: '',
    city: 'New Orleans',
    state: 'LA',
    zip: ''
  };
  
  // Try to extract city and zip
  for (let i = addressParts.length - 1; i >= 0; i--) {
    const part = addressParts[i];
    if (part && part.match(/^\d{5}(-\d{4})?$/)) {
      address.zip = part.match(/^\d{5}/)[0];
    } else if (part && part.includes('New Orleans')) {
      address.city = 'New Orleans';
    }
  }
  
  return {
    name: place.name,
    lat: place.geometry.location.lat,
    lng: place.geometry.location.lng,
    phone: place.formatted_phone_number || null,
    website: place.website || null,
    liveRating: place.rating || null,
    address: address,
    cuisines: extractCuisines(place.types || [])
  };
}

/**
 * Extract cuisine types from Google Places types
 */
function extractCuisines(types) {
  const cuisineMap = {
    'restaurant': 'American',
    'italian_restaurant': 'Italian',
    'chinese_restaurant': 'Chinese',
    'mexican_restaurant': 'Mexican',
    'japanese_restaurant': 'Japanese',
    'sushi_restaurant': 'Sushi',
    'seafood_restaurant': 'Seafood',
    'steak_house': 'Steakhouse',
    'pizza_restaurant': 'Pizza',
    'cafe': 'Café',
    'bar': 'Bar',
    'american_restaurant': 'American',
    'french_restaurant': 'French',
    'thai_restaurant': 'Thai',
    'indian_restaurant': 'Indian',
    'mediterranean_restaurant': 'Mediterranean',
    'barbecue_restaurant': 'Barbecue',
    'southern_restaurant': 'Southern',
    'soul_food_restaurant': 'Soul Food',
    'creole_restaurant': 'Creole',
    'cajun_restaurant': 'Cajun',
    'breakfast_restaurant': 'Breakfast',
    'brunch_restaurant': 'Brunch'
  };
  
  const cuisines = [];
  types.forEach(type => {
    const cuisine = cuisineMap[type];
    if (cuisine && !cuisines.includes(cuisine)) {
      cuisines.push(cuisine);
    }
  });
  
  return cuisines.length > 0 ? cuisines : ['American'];
}

/**
 * Sleep function for rate limiting
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main function
 */
async function main() {
  console.log('🍽️  Fetching ALL New Orleans restaurants...\n');
  console.log(`📍 Searching ${SEARCH_AREAS.length} areas/neighborhoods\n`);
  
  const allRestaurants = [];
  const seenIds = new Set();
  let totalFound = 0;
  
  for (let i = 0; i < SEARCH_AREAS.length; i++) {
    const area = SEARCH_AREAS[i];
    console.log(`[${i + 1}/${SEARCH_AREAS.length}] ${area.name}...`);
    
    try {
      const options = {
        query: area.query || `restaurants ${area.name} New Orleans`,
        location: area.location,
        radius: area.radius
      };
      
      const results = await searchPlaces(options);
      console.log(`   Found ${results.length} results`);
      totalFound += results.length;
      
      // Process each result
      for (const place of results) {
        if (seenIds.has(place.place_id)) {
          continue; // Skip duplicates
        }
        
        seenIds.add(place.place_id);
        
        try {
          // Get detailed info
          const details = await getPlaceDetails(place.place_id);
          
          // Only include if in New Orleans area
          const lat = details.geometry.location.lat;
          const lng = details.geometry.location.lng;
          
          // Check if within New Orleans metro area (rough bounds)
          if (lat >= 29.8 && lat <= 30.1 && lng >= -90.2 && lng <= -89.9) {
            const restaurant = convertToRestaurant(details);
            allRestaurants.push(restaurant);
            console.log(`   ✅ ${restaurant.name}`);
          } else {
            console.log(`   ⏭️  Skipped ${details.name} (outside area)`);
          }
          
          // Rate limiting - wait between requests
          await sleep(100);
        } catch (error) {
          console.log(`   ⚠️  Skipped ${place.name}: ${error.message}`);
        }
      }
      
      // Wait between area searches
      await sleep(500);
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }
  
  // Remove duplicates by name + location
  const unique = [];
  const seen = new Set();
  
  allRestaurants.forEach(r => {
    const key = `${r.name.toLowerCase().trim()}_${r.lat.toFixed(4)}_${r.lng.toFixed(4)}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(r);
    }
  });
  
  // Sort by name
  unique.sort((a, b) => a.name.localeCompare(b.name));
  
  // Save to file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(unique, null, 2));
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary');
  console.log('='.repeat(50));
  console.log(`🔍 Total results found: ${totalFound}`);
  console.log(`✅ Unique restaurants: ${unique.length}`);
  console.log(`📝 Saved to: ${path.basename(OUTPUT_FILE)}`);
  console.log('='.repeat(50));
  console.log('\n🚀 Next step:');
  console.log(`   node scripts/addRestaurants.js ${path.basename(OUTPUT_FILE)}`);
  console.log('\n⏱️  This may take a while - the script will add them one by one.');
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});







