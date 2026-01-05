/**
 * Fetch New Orleans Restaurants
 * 
 * This script fetches restaurant data from Google Places API
 * and creates a JSON file ready to upload.
 * 
 * Usage:
 *   node scripts/fetchNewOrleansRestaurants.js [API_KEY]
 * 
 * Or set GOOGLE_PLACES_API_KEY environment variable
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.argv[2] || process.env.GOOGLE_PLACES_API_KEY;
const OUTPUT_FILE = path.join(__dirname, '..', 'new-orleans-restaurants.json');

if (!API_KEY) {
  console.error('❌ Error: Google Places API key required!');
  console.error('\nUsage:');
  console.error('  node scripts/fetchNewOrleansRestaurants.js YOUR_API_KEY');
  console.error('\nOr set environment variable:');
  console.error('  set GOOGLE_PLACES_API_KEY=YOUR_API_KEY');
  console.error('  node scripts/fetchNewOrleansRestaurants.js');
  console.error('\nGet API key from: https://console.cloud.google.com/');
  process.exit(1);
}

/**
 * Search for restaurants using Google Places API
 */
function searchPlaces(query, location = '29.9511,-90.0715', radius = 5000) {
  return new Promise((resolve, reject) => {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${location}&radius=${radius}&type=restaurant&key=${API_KEY}`;
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.status === 'OK') {
            resolve(json.results || []);
          } else {
            reject(new Error(`API Error: ${json.status} - ${json.error_message || 'Unknown error'}`));
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
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,formatted_phone_number,website,rating,geometry,types&key=${API_KEY}`;
    
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
  
  return {
    name: place.name,
    lat: place.geometry.location.lat,
    lng: place.geometry.location.lng,
    phone: place.formatted_phone_number || null,
    website: place.website || null,
    liveRating: place.rating || null,
    address: {
      line1: addressParts[0] || '',
      line2: '',
      city: addressParts[addressParts.length - 3] || 'New Orleans',
      state: 'LA',
      zip: addressParts[addressParts.length - 1]?.match(/\d{5}/)?.[0] || ''
    },
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
    'cajun_restaurant': 'Cajun'
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
 * Main function
 */
async function main() {
  console.log('🍽️  Fetching New Orleans restaurants...\n');
  
  const queries = [
    'restaurants in New Orleans French Quarter',
    'restaurants in New Orleans Garden District',
    'restaurants in New Orleans CBD',
    'best restaurants New Orleans',
    'famous restaurants New Orleans',
    'creole restaurants New Orleans',
    'cajun restaurants New Orleans'
  ];
  
  const allRestaurants = [];
  const seenIds = new Set();
  
  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    console.log(`[${i + 1}/${queries.length}] Searching: "${query}"...`);
    
    try {
      const results = await searchPlaces(query);
      console.log(`   Found ${results.length} results`);
      
      for (const place of results) {
        if (seenIds.has(place.place_id)) {
          continue; // Skip duplicates
        }
        
        seenIds.add(place.place_id);
        
        try {
          // Get detailed info
          const details = await getPlaceDetails(place.place_id);
          const restaurant = convertToRestaurant(details);
          allRestaurants.push(restaurant);
          console.log(`   ✅ ${restaurant.name}`);
        } catch (error) {
          console.log(`   ⚠️  Skipped ${place.name}: ${error.message}`);
        }
        
        // Rate limiting - wait a bit between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Wait between queries
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }
  
  // Remove duplicates by name + location
  const unique = [];
  const seen = new Set();
  
  allRestaurants.forEach(r => {
    const key = `${r.name.toLowerCase()}_${r.lat.toFixed(4)}_${r.lng.toFixed(4)}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(r);
    }
  });
  
  // Save to file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(unique, null, 2));
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary');
  console.log('='.repeat(50));
  console.log(`✅ Found ${unique.length} unique restaurants`);
  console.log(`📝 Saved to: ${OUTPUT_FILE}`);
  console.log('='.repeat(50));
  console.log('\n🚀 Next step:');
  console.log(`   node scripts/addRestaurants.js ${path.basename(OUTPUT_FILE)}`);
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});







