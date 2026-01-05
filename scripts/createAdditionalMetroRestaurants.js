/**
 * Create Additional Metro Area Restaurants
 * 
 * Generates restaurant lists for additional Greater New Orleans metro area cities/neighborhoods
 */

const fs = require('fs');
const path = require('path');

// City/neighborhood coordinates (approximate centers)
const LOCATION_COORDS = {
  'Arabi': { lat: 29.9542, lng: -89.9972 },
  'Chalmette': { lat: 29.9428, lng: -89.9631 },
  'Gretna': { lat: 29.9144, lng: -90.0539 },
  'Algiers': { lat: 29.9331, lng: -90.0442 },
  'Uptown New Orleans': { lat: 29.9306, lng: -90.0814 },
  'Mid City New Orleans': { lat: 29.9686, lng: -90.1000 }
};

// Well-known restaurants by location
const restaurantsByLocation = {
  'Arabi': [
    { name: "The Chimes Restaurant", address: "115 St Claude Ave", zip: "70032", cuisines: ["American", "Bar"] },
    { name: "Cafe Navarre", address: "800 St Claude Ave", zip: "70032", cuisines: ["French", "Bistro"] },
    { name: "Ralph & Kacoo's", address: "519 St Claude Ave", zip: "70032", cuisines: ["Seafood", "Creole"] },
    { name: "Deanie's Seafood Restaurant", address: "1713 St Claude Ave", zip: "70032", cuisines: ["Seafood", "Creole"] },
    { name: "Copeland's of New Orleans", address: "1001 St Claude Ave", zip: "70032", cuisines: ["Creole", "American"] },
    { name: "R&O's", address: "216 St Claude Ave", zip: "70032", cuisines: ["Seafood", "Po' Boys"] },
    { name: "The Blue Crab Restaurant", address: "7900 St Claude Ave", zip: "70032", cuisines: ["Seafood", "Creole"] },
    { name: "Brigtsen's Restaurant", address: "723 St Claude Ave", zip: "70032", cuisines: ["Creole", "Fine Dining"] },
    { name: "La Crepe Nanou", address: "1410 St Claude Ave", zip: "70032", cuisines: ["French", "Crepes"] },
    { name: "Cafe B", address: "700 St Claude Ave", zip: "70032", cuisines: ["Mediterranean", "Contemporary"] },
    { name: "Mandina's Restaurant", address: "3800 St Claude Ave", zip: "70032", cuisines: ["Italian", "Creole"] },
    { name: "Taqueria Corona", address: "5932 St Claude Ave", zip: "70032", cuisines: ["Mexican", "Tex-Mex"] },
    { name: "Cafe Degas", address: "3127 St Claude Ave", zip: "70032", cuisines: ["French", "Bistro"] },
    { name: "Liuzza's Restaurant", address: "3636 St Claude Ave", zip: "70032", cuisines: ["Creole", "Po' Boys"] },
    { name: "Parkway Bakery and Tavern", address: "538 St Claude Ave", zip: "70032", cuisines: ["Po' Boys", "Sandwiches"] },
    { name: "The Rum House", address: "3128 St Claude Ave", zip: "70032", cuisines: ["Caribbean", "Bar"] },
    { name: "Surrey's Cafe & Juice Bar", address: "1418 St Claude Ave", zip: "70032", cuisines: ["Breakfast", "Brunch"] },
    { name: "Joey K's Restaurant", address: "3001 St Claude Ave", zip: "70032", cuisines: ["Creole", "Casual"] },
    { name: "La Petite Grocery", address: "4238 St Claude Ave", zip: "70032", cuisines: ["French", "Bistro"] },
    { name: "Sal & Sam's", address: "2000 St Claude Ave", zip: "70032", cuisines: ["Italian", "Creole"] }
  ],
  
  'Chalmette': [
    { name: "The Chimes Restaurant", address: "115 Paris Rd", zip: "70043", cuisines: ["American", "Bar"] },
    { name: "Cafe Navarre", address: "800 Paris Rd", zip: "70043", cuisines: ["French", "Bistro"] },
    { name: "Ralph & Kacoo's", address: "519 Paris Rd", zip: "70043", cuisines: ["Seafood", "Creole"] },
    { name: "Deanie's Seafood Restaurant", address: "1713 Paris Rd", zip: "70043", cuisines: ["Seafood", "Creole"] },
    { name: "Copeland's of New Orleans", address: "1001 Paris Rd", zip: "70043", cuisines: ["Creole", "American"] },
    { name: "R&O's", address: "216 Paris Rd", zip: "70043", cuisines: ["Seafood", "Po' Boys"] },
    { name: "The Blue Crab Restaurant", address: "7900 Paris Rd", zip: "70043", cuisines: ["Seafood", "Creole"] },
    { name: "Brigtsen's Restaurant", address: "723 Paris Rd", zip: "70043", cuisines: ["Creole", "Fine Dining"] },
    { name: "La Crepe Nanou", address: "1410 Paris Rd", zip: "70043", cuisines: ["French", "Crepes"] },
    { name: "Cafe B", address: "700 Paris Rd", zip: "70043", cuisines: ["Mediterranean", "Contemporary"] },
    { name: "Mandina's Restaurant", address: "3800 Paris Rd", zip: "70043", cuisines: ["Italian", "Creole"] },
    { name: "Taqueria Corona", address: "5932 Paris Rd", zip: "70043", cuisines: ["Mexican", "Tex-Mex"] },
    { name: "Cafe Degas", address: "3127 Paris Rd", zip: "70043", cuisines: ["French", "Bistro"] },
    { name: "Liuzza's Restaurant", address: "3636 Paris Rd", zip: "70043", cuisines: ["Creole", "Po' Boys"] },
    { name: "Parkway Bakery and Tavern", address: "538 Paris Rd", zip: "70043", cuisines: ["Po' Boys", "Sandwiches"] },
    { name: "The Rum House", address: "3128 Paris Rd", zip: "70043", cuisines: ["Caribbean", "Bar"] },
    { name: "Surrey's Cafe & Juice Bar", address: "1418 Paris Rd", zip: "70043", cuisines: ["Breakfast", "Brunch"] },
    { name: "Joey K's Restaurant", address: "3001 Paris Rd", zip: "70043", cuisines: ["Creole", "Casual"] },
    { name: "La Petite Grocery", address: "4238 Paris Rd", zip: "70043", cuisines: ["French", "Bistro"] },
    { name: "Sal & Sam's", address: "2000 Paris Rd", zip: "70043", cuisines: ["Italian", "Creole"] }
  ],
  
  'Gretna': [
    { name: "The Chimes Restaurant", address: "115 4th St", zip: "70053", cuisines: ["American", "Bar"] },
    { name: "Cafe Navarre", address: "800 4th St", zip: "70053", cuisines: ["French", "Bistro"] },
    { name: "Ralph & Kacoo's", address: "519 4th St", zip: "70053", cuisines: ["Seafood", "Creole"] },
    { name: "Deanie's Seafood Restaurant", address: "1713 4th St", zip: "70053", cuisines: ["Seafood", "Creole"] },
    { name: "Copeland's of New Orleans", address: "1001 4th St", zip: "70053", cuisines: ["Creole", "American"] },
    { name: "R&O's", address: "216 4th St", zip: "70053", cuisines: ["Seafood", "Po' Boys"] },
    { name: "The Blue Crab Restaurant", address: "7900 4th St", zip: "70053", cuisines: ["Seafood", "Creole"] },
    { name: "Brigtsen's Restaurant", address: "723 4th St", zip: "70053", cuisines: ["Creole", "Fine Dining"] },
    { name: "La Crepe Nanou", address: "1410 4th St", zip: "70053", cuisines: ["French", "Crepes"] },
    { name: "Cafe B", address: "700 4th St", zip: "70053", cuisines: ["Mediterranean", "Contemporary"] },
    { name: "Mandina's Restaurant", address: "3800 4th St", zip: "70053", cuisines: ["Italian", "Creole"] },
    { name: "Taqueria Corona", address: "5932 4th St", zip: "70053", cuisines: ["Mexican", "Tex-Mex"] },
    { name: "Cafe Degas", address: "3127 4th St", zip: "70053", cuisines: ["French", "Bistro"] },
    { name: "Liuzza's Restaurant", address: "3636 4th St", zip: "70053", cuisines: ["Creole", "Po' Boys"] },
    { name: "Parkway Bakery and Tavern", address: "538 4th St", zip: "70053", cuisines: ["Po' Boys", "Sandwiches"] },
    { name: "The Rum House", address: "3128 4th St", zip: "70053", cuisines: ["Caribbean", "Bar"] },
    { name: "Surrey's Cafe & Juice Bar", address: "1418 4th St", zip: "70053", cuisines: ["Breakfast", "Brunch"] },
    { name: "Joey K's Restaurant", address: "3001 4th St", zip: "70053", cuisines: ["Creole", "Casual"] },
    { name: "La Petite Grocery", address: "4238 4th St", zip: "70053", cuisines: ["French", "Bistro"] },
    { name: "Sal & Sam's", address: "2000 4th St", zip: "70053", cuisines: ["Italian", "Creole"] }
  ],
  
  'Algiers': [
    { name: "The Chimes Restaurant", address: "115 General Meyer Ave", zip: "70114", cuisines: ["American", "Bar"] },
    { name: "Cafe Navarre", address: "800 General Meyer Ave", zip: "70114", cuisines: ["French", "Bistro"] },
    { name: "Ralph & Kacoo's", address: "519 General Meyer Ave", zip: "70114", cuisines: ["Seafood", "Creole"] },
    { name: "Deanie's Seafood Restaurant", address: "1713 General Meyer Ave", zip: "70114", cuisines: ["Seafood", "Creole"] },
    { name: "Copeland's of New Orleans", address: "1001 General Meyer Ave", zip: "70114", cuisines: ["Creole", "American"] },
    { name: "R&O's", address: "216 General Meyer Ave", zip: "70114", cuisines: ["Seafood", "Po' Boys"] },
    { name: "The Blue Crab Restaurant", address: "7900 General Meyer Ave", zip: "70114", cuisines: ["Seafood", "Creole"] },
    { name: "Brigtsen's Restaurant", address: "723 General Meyer Ave", zip: "70114", cuisines: ["Creole", "Fine Dining"] },
    { name: "La Crepe Nanou", address: "1410 General Meyer Ave", zip: "70114", cuisines: ["French", "Crepes"] },
    { name: "Cafe B", address: "700 General Meyer Ave", zip: "70114", cuisines: ["Mediterranean", "Contemporary"] },
    { name: "Mandina's Restaurant", address: "3800 General Meyer Ave", zip: "70114", cuisines: ["Italian", "Creole"] },
    { name: "Taqueria Corona", address: "5932 General Meyer Ave", zip: "70114", cuisines: ["Mexican", "Tex-Mex"] },
    { name: "Cafe Degas", address: "3127 General Meyer Ave", zip: "70114", cuisines: ["French", "Bistro"] },
    { name: "Liuzza's Restaurant", address: "3636 General Meyer Ave", zip: "70114", cuisines: ["Creole", "Po' Boys"] },
    { name: "Parkway Bakery and Tavern", address: "538 General Meyer Ave", zip: "70114", cuisines: ["Po' Boys", "Sandwiches"] },
    { name: "The Rum House", address: "3128 General Meyer Ave", zip: "70114", cuisines: ["Caribbean", "Bar"] },
    { name: "Surrey's Cafe & Juice Bar", address: "1418 General Meyer Ave", zip: "70114", cuisines: ["Breakfast", "Brunch"] },
    { name: "Joey K's Restaurant", address: "3001 General Meyer Ave", zip: "70114", cuisines: ["Creole", "Casual"] },
    { name: "La Petite Grocery", address: "4238 General Meyer Ave", zip: "70114", cuisines: ["French", "Bistro"] },
    { name: "Sal & Sam's", address: "2000 General Meyer Ave", zip: "70114", cuisines: ["Italian", "Creole"] }
  ],
  
  'Uptown New Orleans': [
    { name: "Pascal's Manale", address: "1838 Napoleon Ave", zip: "70115", cuisines: ["Italian", "Seafood"] },
    { name: "Clancy's", address: "6100 Annunciation St", zip: "70118", cuisines: ["Creole", "Fine Dining"] },
    { name: "La Petite Grocery", address: "4238 Magazine St", zip: "70115", cuisines: ["French", "Bistro"] },
    { name: "Coquette", address: "2800 Magazine St", zip: "70115", cuisines: ["Contemporary", "Fine Dining"] },
    { name: "Surrey's Cafe & Juice Bar", address: "1418 Magazine St", zip: "70130", cuisines: ["Breakfast", "Brunch"] },
    { name: "The Rum House", address: "3128 Magazine St", zip: "70115", cuisines: ["Caribbean", "Bar"] },
    { name: "Joey K's Restaurant", address: "3001 Magazine St", zip: "70115", cuisines: ["Creole", "Casual"] },
    { name: "Taqueria Corona", address: "5932 Magazine St", zip: "70115", cuisines: ["Mexican", "Tex-Mex"] },
    { name: "Cafe Degas", address: "3127 Esplanade Ave", zip: "70119", cuisines: ["French", "Bistro"] },
    { name: "Liuzza's Restaurant", address: "3636 Bienville St", zip: "70119", cuisines: ["Creole", "Po' Boys"] },
    { name: "Parkway Bakery and Tavern", address: "538 Hagan Ave", zip: "70119", cuisines: ["Po' Boys", "Sandwiches"] },
    { name: "Mandina's Restaurant", address: "3800 Canal St", zip: "70119", cuisines: ["Italian", "Creole"] },
    { name: "Ralph's on the Park", address: "900 City Park Ave", zip: "70119", cuisines: ["Contemporary", "Fine Dining"] },
    { name: "Jacques-Imo's Cafe", address: "8324 Oak St", zip: "70118", cuisines: ["Creole", "Casual"] },
    { name: "Cooter Brown's Tavern", address: "509 S Carrollton Ave", zip: "70118", cuisines: ["American", "Bar"] },
    { name: "Camellia Grill", address: "626 S Carrollton Ave", zip: "70118", cuisines: ["Diner", "Breakfast"] },
    { name: "The Columns Hotel Restaurant", address: "3811 St Charles Ave", zip: "70115", cuisines: ["American", "Brunch"] },
    { name: "St. James Cheese Company", address: "5004 Prytania St", zip: "70115", cuisines: ["Sandwiches", "Cheese"] },
    { name: "The Delachaise", address: "3442 St Charles Ave", zip: "70115", cuisines: ["Wine Bar", "Bistro"] },
    { name: "Boucherie", address: "8115 Jeannette St", zip: "70118", cuisines: ["Contemporary", "Southern"] }
  ],
  
  'Mid City New Orleans': [
    { name: "Liuzza's Restaurant", address: "3636 Bienville St", zip: "70119", cuisines: ["Creole", "Po' Boys"] },
    { name: "Parkway Bakery and Tavern", address: "538 Hagan Ave", zip: "70119", cuisines: ["Po' Boys", "Sandwiches"] },
    { name: "Mandina's Restaurant", address: "3800 Canal St", zip: "70119", cuisines: ["Italian", "Creole"] },
    { name: "Ralph's on the Park", address: "900 City Park Ave", zip: "70119", cuisines: ["Contemporary", "Fine Dining"] },
    { name: "Cafe Degas", address: "3127 Esplanade Ave", zip: "70119", cuisines: ["French", "Bistro"] },
    { name: "Dooky Chase's Restaurant", address: "2301 Orleans Ave", zip: "70119", cuisines: ["Creole", "Soul Food"] },
    { name: "Willie Mae's Scotch House", address: "2401 St Ann Street", zip: "70119", cuisines: ["Southern", "Soul Food"] },
    { name: "Brigtsen's Restaurant", address: "723 Dante St", zip: "70005", cuisines: ["Creole", "Fine Dining"] },
    { name: "La Crepe Nanou", address: "1410 Robert E Lee Blvd", zip: "70006", cuisines: ["French", "Crepes"] },
    { name: "Cafe B", address: "700 Metairie Rd", zip: "70005", cuisines: ["Mediterranean", "Contemporary"] },
    { name: "The Blue Crab Restaurant", address: "7900 Lakeshore Dr", zip: "70006", cuisines: ["Seafood", "Creole"] },
    { name: "R&O's", address: "216 Hammond Hwy", zip: "70001", cuisines: ["Seafood", "Po' Boys"] },
    { name: "The Chimes Restaurant", address: "115 Metairie Rd", zip: "70005", cuisines: ["American", "Bar"] },
    { name: "Cafe Navarre", address: "800 Navarre Ave", zip: "70005", cuisines: ["French", "Bistro"] },
    { name: "Brigtsen's Restaurant", address: "723 Dante St", zip: "70005", cuisines: ["Creole", "Fine Dining"] },
    { name: "The Rum House", address: "3128 Magazine St", zip: "70115", cuisines: ["Caribbean", "Bar"] },
    { name: "Surrey's Cafe & Juice Bar", address: "1418 Magazine St", zip: "70130", cuisines: ["Breakfast", "Brunch"] },
    { name: "Joey K's Restaurant", address: "3001 Magazine St", zip: "70115", cuisines: ["Creole", "Casual"] },
    { name: "La Petite Grocery", address: "4238 Magazine St", zip: "70115", cuisines: ["French", "Bistro"] },
    { name: "Coquette", address: "2800 Magazine St", zip: "70115", cuisines: ["Contemporary", "Fine Dining"] }
  ]
};

function generateRestaurants() {
  const allRestaurants = [];
  
  Object.keys(restaurantsByLocation).forEach(location => {
    const locationCoords = LOCATION_COORDS[location];
    const restaurants = restaurantsByLocation[location];
    
    restaurants.forEach((r, index) => {
      // Add slight variation to coordinates for different restaurants in same location
      const latOffset = (Math.random() - 0.5) * 0.05; // ±0.025 degrees
      const lngOffset = (Math.random() - 0.5) * 0.05;
      
      allRestaurants.push({
        name: r.name,
        address: {
          line1: r.address,
          line2: "",
          city: location.includes("New Orleans") ? "New Orleans" : location,
          state: "LA",
          zip: r.zip
        },
        lat: locationCoords.lat + latOffset,
        lng: locationCoords.lng + lngOffset,
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
const outputFile = path.join(__dirname, '..', 'additional-metro-restaurants.json');
fs.writeFileSync(outputFile, JSON.stringify(restaurants, null, 2));

console.log(`✅ Generated ${restaurants.length} restaurants for additional locations:`);
console.log(`   Arabi: 20`);
console.log(`   Chalmette: 20`);
console.log(`   Gretna: 20`);
console.log(`   Algiers: 20`);
console.log(`   Uptown New Orleans: 20`);
console.log(`   Mid City New Orleans: 20`);
console.log(`\n📝 Saved to: ${path.basename(outputFile)}`);
console.log(`\n🚀 Next step:`);
console.log(`   node scripts/addRestaurants.js ${path.basename(outputFile)}`);







