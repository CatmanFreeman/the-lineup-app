/**
 * Interactive Restaurant JSON Creator
 * 
 * This script helps you create a restaurant JSON file step by step.
 * 
 * Usage:
 *   node scripts/createRestaurantJSON.js
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function createRestaurant() {
  console.log('\n🍽️  Let\'s add a restaurant!\n');
  console.log('(Press Enter to skip optional fields)\n');
  
  // Required fields
  const name = await question('Restaurant name: ');
  if (!name.trim()) {
    console.log('❌ Name is required!');
    return null;
  }
  
  console.log('\n📍 Address:');
  const line1 = await question('  Street address: ');
  const line2 = await question('  Address line 2 (optional): ');
  const city = await question('  City: ');
  const state = await question('  State (e.g., NY, CA): ');
  const zip = await question('  ZIP code: ');
  
  console.log('\n🌍 Coordinates (get from Google Maps):');
  console.log('  1. Go to https://www.google.com/maps');
  console.log('  2. Search for the restaurant');
  console.log('  3. Right-click the pin → "What\'s here?"');
  console.log('  4. Copy the coordinates\n');
  
  const latStr = await question('  Latitude (lat): ');
  const lngStr = await question('  Longitude (lng): ');
  
  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);
  
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    console.log('❌ Invalid coordinates!');
    return null;
  }
  
  // Optional fields
  console.log('\n📞 Contact (optional):');
  const phone = await question('  Phone number: ');
  const website = await question('  Website URL: ');
  
  console.log('\n🍴 Cuisine (optional, comma-separated):');
  const cuisinesStr = await question('  Cuisines (e.g., "Italian, Pizza"): ');
  const cuisines = cuisinesStr.trim() 
    ? cuisinesStr.split(',').map(c => c.trim()).filter(c => c)
    : [];
  
  const ratingStr = await question('  Rating (1-5, optional): ');
  const liveRating = ratingStr.trim() ? parseFloat(ratingStr) : null;
  
  // Build restaurant object
  const restaurant = {
    name: name.trim(),
    lat,
    lng,
  };
  
  if (line1.trim()) {
    restaurant.address = {
      line1: line1.trim(),
      line2: line2.trim() || '',
      city: city.trim() || '',
      state: state.trim() || '',
      zip: zip.trim() || ''
    };
  }
  
  if (phone.trim()) restaurant.phone = phone.trim();
  if (website.trim()) restaurant.website = website.trim();
  if (cuisines.length > 0) restaurant.cuisines = cuisines;
  if (liveRating) restaurant.liveRating = liveRating;
  
  return restaurant;
}

async function main() {
  console.log('='.repeat(50));
  console.log('🍽️  Restaurant JSON Creator');
  console.log('='.repeat(50));
  
  const restaurants = [];
  let addMore = true;
  
  while (addMore) {
    const restaurant = await createRestaurant();
    
    if (restaurant) {
      restaurants.push(restaurant);
      console.log('\n✅ Restaurant added!');
    } else {
      console.log('\n⚠️  Restaurant not added (missing required fields)');
    }
    
    const response = await question('\nAdd another restaurant? (y/n): ');
    addMore = response.toLowerCase().startsWith('y');
  }
  
  if (restaurants.length === 0) {
    console.log('\n❌ No restaurants to save.');
    rl.close();
    return;
  }
  
  // Save to file
  const filename = await question('\n📝 Save to file (default: restaurants.json): ');
  const outputFile = filename.trim() || 'restaurants.json';
  const outputPath = path.join(__dirname, '..', outputFile);
  
  fs.writeFileSync(outputPath, JSON.stringify(restaurants, null, 2));
  
  console.log(`\n✅ Saved ${restaurants.length} restaurant(s) to ${outputFile}`);
  console.log('\n🚀 Next step: Run the upload script:');
  console.log(`   node scripts/addRestaurants.js ${outputFile}`);
  
  rl.close();
}

main().catch((error) => {
  console.error('\n❌ Error:', error);
  rl.close();
  process.exit(1);
});







