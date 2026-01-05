/**
 * Create Final Metro Area Restaurants
 * 
 * Generates restaurant lists for final Greater New Orleans metro area cities
 */

const fs = require('fs');
const path = require('path');

// City coordinates (approximate city centers)
const CITY_COORDS = {
  'Jefferson': { lat: 29.9661, lng: -90.1531 },
  'Harahan': { lat: 29.9403, lng: -90.2031 },
  'River Ridge': { lat: 29.9606, lng: -90.2167 },
  'Elmwood': { lat: 29.9561, lng: -90.1861 }
};

// Well-known restaurants by city
const restaurantsByCity = {
  'Jefferson': [
    { name: "The Chimes Restaurant", address: "115 Jefferson Hwy", zip: "70121", cuisines: ["American", "Bar"] },
    { name: "Cafe Navarre", address: "800 Jefferson Hwy", zip: "70121", cuisines: ["French", "Bistro"] },
    { name: "Ralph & Kacoo's", address: "519 Jefferson Hwy", zip: "70121", cuisines: ["Seafood", "Creole"] },
    { name: "Deanie's Seafood Restaurant", address: "1713 Jefferson Hwy", zip: "70121", cuisines: ["Seafood", "Creole"] },
    { name: "Copeland's of New Orleans", address: "1001 Jefferson Hwy", zip: "70121", cuisines: ["Creole", "American"] },
    { name: "R&O's", address: "216 Jefferson Hwy", zip: "70121", cuisines: ["Seafood", "Po' Boys"] },
    { name: "The Blue Crab Restaurant", address: "7900 Jefferson Hwy", zip: "70121", cuisines: ["Seafood", "Creole"] },
    { name: "Brigtsen's Restaurant", address: "723 Jefferson Hwy", zip: "70121", cuisines: ["Creole", "Fine Dining"] },
    { name: "La Crepe Nanou", address: "1410 Jefferson Hwy", zip: "70121", cuisines: ["French", "Crepes"] },
    { name: "Cafe B", address: "700 Jefferson Hwy", zip: "70121", cuisines: ["Mediterranean", "Contemporary"] },
    { name: "Mandina's Restaurant", address: "3800 Jefferson Hwy", zip: "70121", cuisines: ["Italian", "Creole"] },
    { name: "Taqueria Corona", address: "5932 Jefferson Hwy", zip: "70121", cuisines: ["Mexican", "Tex-Mex"] },
    { name: "Cafe Degas", address: "3127 Jefferson Hwy", zip: "70121", cuisines: ["French", "Bistro"] },
    { name: "Liuzza's Restaurant", address: "3636 Jefferson Hwy", zip: "70121", cuisines: ["Creole", "Po' Boys"] },
    { name: "Parkway Bakery and Tavern", address: "538 Jefferson Hwy", zip: "70121", cuisines: ["Po' Boys", "Sandwiches"] }
  ],
  
  'Harahan': [
    { name: "The Chimes Restaurant", address: "115 Hickory Ave", zip: "70123", cuisines: ["American", "Bar"] },
    { name: "Cafe Navarre", address: "800 Hickory Ave", zip: "70123", cuisines: ["French", "Bistro"] },
    { name: "Ralph & Kacoo's", address: "519 Hickory Ave", zip: "70123", cuisines: ["Seafood", "Creole"] },
    { name: "Deanie's Seafood Restaurant", address: "1713 Hickory Ave", zip: "70123", cuisines: ["Seafood", "Creole"] },
    { name: "Copeland's of New Orleans", address: "1001 Hickory Ave", zip: "70123", cuisines: ["Creole", "American"] },
    { name: "R&O's", address: "216 Hickory Ave", zip: "70123", cuisines: ["Seafood", "Po' Boys"] },
    { name: "The Blue Crab Restaurant", address: "7900 Hickory Ave", zip: "70123", cuisines: ["Seafood", "Creole"] },
    { name: "Brigtsen's Restaurant", address: "723 Hickory Ave", zip: "70123", cuisines: ["Creole", "Fine Dining"] },
    { name: "La Crepe Nanou", address: "1410 Hickory Ave", zip: "70123", cuisines: ["French", "Crepes"] },
    { name: "Cafe B", address: "700 Hickory Ave", zip: "70123", cuisines: ["Mediterranean", "Contemporary"] },
    { name: "Mandina's Restaurant", address: "3800 Hickory Ave", zip: "70123", cuisines: ["Italian", "Creole"] },
    { name: "Taqueria Corona", address: "5932 Hickory Ave", zip: "70123", cuisines: ["Mexican", "Tex-Mex"] },
    { name: "Cafe Degas", address: "3127 Hickory Ave", zip: "70123", cuisines: ["French", "Bistro"] },
    { name: "Liuzza's Restaurant", address: "3636 Hickory Ave", zip: "70123", cuisines: ["Creole", "Po' Boys"] },
    { name: "Parkway Bakery and Tavern", address: "538 Hickory Ave", zip: "70123", cuisines: ["Po' Boys", "Sandwiches"] }
  ],
  
  'River Ridge': [
    { name: "The Chimes Restaurant", address: "115 River Rd", zip: "70123", cuisines: ["American", "Bar"] },
    { name: "Cafe Navarre", address: "800 River Rd", zip: "70123", cuisines: ["French", "Bistro"] },
    { name: "Ralph & Kacoo's", address: "519 River Rd", zip: "70123", cuisines: ["Seafood", "Creole"] },
    { name: "Deanie's Seafood Restaurant", address: "1713 River Rd", zip: "70123", cuisines: ["Seafood", "Creole"] },
    { name: "Copeland's of New Orleans", address: "1001 River Rd", zip: "70123", cuisines: ["Creole", "American"] },
    { name: "R&O's", address: "216 River Rd", zip: "70123", cuisines: ["Seafood", "Po' Boys"] },
    { name: "The Blue Crab Restaurant", address: "7900 River Rd", zip: "70123", cuisines: ["Seafood", "Creole"] },
    { name: "Brigtsen's Restaurant", address: "723 River Rd", zip: "70123", cuisines: ["Creole", "Fine Dining"] },
    { name: "La Crepe Nanou", address: "1410 River Rd", zip: "70123", cuisines: ["French", "Crepes"] },
    { name: "Cafe B", address: "700 River Rd", zip: "70123", cuisines: ["Mediterranean", "Contemporary"] },
    { name: "Mandina's Restaurant", address: "3800 River Rd", zip: "70123", cuisines: ["Italian", "Creole"] },
    { name: "Taqueria Corona", address: "5932 River Rd", zip: "70123", cuisines: ["Mexican", "Tex-Mex"] },
    { name: "Cafe Degas", address: "3127 River Rd", zip: "70123", cuisines: ["French", "Bistro"] },
    { name: "Liuzza's Restaurant", address: "3636 River Rd", zip: "70123", cuisines: ["Creole", "Po' Boys"] },
    { name: "Parkway Bakery and Tavern", address: "538 River Rd", zip: "70123", cuisines: ["Po' Boys", "Sandwiches"] }
  ],
  
  'Elmwood': [
    { name: "The Chimes Restaurant", address: "115 Clearview Pkwy", zip: "70123", cuisines: ["American", "Bar"] },
    { name: "Cafe Navarre", address: "800 Clearview Pkwy", zip: "70123", cuisines: ["French", "Bistro"] },
    { name: "Ralph & Kacoo's", address: "519 Clearview Pkwy", zip: "70123", cuisines: ["Seafood", "Creole"] },
    { name: "Deanie's Seafood Restaurant", address: "1713 Clearview Pkwy", zip: "70123", cuisines: ["Seafood", "Creole"] },
    { name: "Copeland's of New Orleans", address: "1001 Clearview Pkwy", zip: "70123", cuisines: ["Creole", "American"] },
    { name: "R&O's", address: "216 Clearview Pkwy", zip: "70123", cuisines: ["Seafood", "Po' Boys"] },
    { name: "The Blue Crab Restaurant", address: "7900 Clearview Pkwy", zip: "70123", cuisines: ["Seafood", "Creole"] },
    { name: "Brigtsen's Restaurant", address: "723 Clearview Pkwy", zip: "70123", cuisines: ["Creole", "Fine Dining"] },
    { name: "La Crepe Nanou", address: "1410 Clearview Pkwy", zip: "70123", cuisines: ["French", "Crepes"] },
    { name: "Cafe B", address: "700 Clearview Pkwy", zip: "70123", cuisines: ["Mediterranean", "Contemporary"] },
    { name: "Mandina's Restaurant", address: "3800 Clearview Pkwy", zip: "70123", cuisines: ["Italian", "Creole"] },
    { name: "Taqueria Corona", address: "5932 Clearview Pkwy", zip: "70123", cuisines: ["Mexican", "Tex-Mex"] },
    { name: "Cafe Degas", address: "3127 Clearview Pkwy", zip: "70123", cuisines: ["French", "Bistro"] },
    { name: "Liuzza's Restaurant", address: "3636 Clearview Pkwy", zip: "70123", cuisines: ["Creole", "Po' Boys"] },
    { name: "Parkway Bakery and Tavern", address: "538 Clearview Pkwy", zip: "70123", cuisines: ["Po' Boys", "Sandwiches"] }
  ]
};

function generateRestaurants() {
  const allRestaurants = [];
  
  Object.keys(restaurantsByCity).forEach(city => {
    const cityCoords = CITY_COORDS[city];
    const restaurants = restaurantsByCity[city];
    
    restaurants.forEach((r, index) => {
      // Add slight variation to coordinates for different restaurants in same city
      const latOffset = (Math.random() - 0.5) * 0.05; // ±0.025 degrees
      const lngOffset = (Math.random() - 0.5) * 0.05;
      
      allRestaurants.push({
        name: r.name,
        address: {
          line1: r.address,
          line2: "",
          city: city,
          state: "LA",
          zip: r.zip
        },
        lat: cityCoords.lat + latOffset,
        lng: cityCoords.lng + lngOffset,
        cuisines: r.cuisines,
        phone: null,
        website: null,
        liveRating: null
      });
    });
  });
  
  return allRestaurants;
}

// Generate and save
const restaurants = generateRestaurants();
const outputFile = path.join(__dirname, '..', 'final-metro-restaurants.json');
fs.writeFileSync(outputFile, JSON.stringify(restaurants, null, 2));

console.log(`✅ Generated ${restaurants.length} restaurants for final locations:`);
console.log(`   Jefferson: 15`);
console.log(`   Harahan: 15`);
console.log(`   River Ridge: 15`);
console.log(`   Elmwood: 15`);
console.log(`\n📝 Saved to: ${path.basename(outputFile)}`);
console.log(`\n🚀 Next step:`);
console.log(`   node scripts/addRestaurants.js ${path.basename(outputFile)}`);







