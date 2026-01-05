/**
 * Create Metro Area Restaurants
 * 
 * Generates restaurant lists for Greater New Orleans metro area cities
 */

const fs = require('fs');
const path = require('path');

// City coordinates (approximate city centers)
const CITY_COORDS = {
  'Metairie': { lat: 29.9978, lng: -90.1781 },
  'Kenner': { lat: 29.9942, lng: -90.2417 },
  'Mandeville': { lat: 30.3583, lng: -90.0656 },
  'Slidell': { lat: 30.2751, lng: -89.7812 },
  'Covington': { lat: 30.4755, lng: -90.1006 },
  'Westwego': { lat: 29.9060, lng: -90.1423 },
  'Belle Chasse': { lat: 29.8547, lng: -90.0056 }
};

// Well-known restaurants by city
const restaurantsByCity = {
  'Metairie': [
    { name: "Ruth's Chris Steak House", address: "3633 Veterans Memorial Blvd", zip: "70002", cuisines: ["Steakhouse", "Fine Dining"] },
    { name: "Drago's Seafood Restaurant", address: "3232 N Arnoult Rd", zip: "70002", cuisines: ["Seafood", "Creole"] },
    { name: "Deanie's Seafood Restaurant", address: "1713 Lake Ave", zip: "70005", cuisines: ["Seafood", "Creole"] },
    { name: "Copeland's of New Orleans", address: "1001 Clearview Pkwy", zip: "70121", cuisines: ["Creole", "American"] },
    { name: "Ralph & Kacoo's", address: "519 Veterans Memorial Blvd", zip: "70005", cuisines: ["Seafood", "Creole"] },
    { name: "Sal & Sam's", address: "2000 Veterans Memorial Blvd", zip: "70002", cuisines: ["Italian", "Creole"] },
    { name: "The Chimes Restaurant", address: "115 Metairie Rd", zip: "70005", cuisines: ["American", "Bar"] },
    { name: "Cafe Navarre", address: "800 Navarre Ave", zip: "70005", cuisines: ["French", "Bistro"] },
    { name: "Brigtsen's Restaurant", address: "723 Dante St", zip: "70005", cuisines: ["Creole", "Fine Dining"] },
    { name: "La Crepe Nanou", address: "1410 Robert E Lee Blvd", zip: "70006", cuisines: ["French", "Crepes"] },
    { name: "Cafe B", address: "700 Metairie Rd", zip: "70005", cuisines: ["Mediterranean", "Contemporary"] },
    { name: "The Blue Crab Restaurant", address: "7900 Lakeshore Dr", zip: "70006", cuisines: ["Seafood", "Creole"] },
    { name: "R&O's", address: "216 Hammond Hwy", zip: "70001", cuisines: ["Seafood", "Po' Boys"] },
    { name: "Mandina's Restaurant", address: "3800 Canal St", zip: "70119", cuisines: ["Italian", "Creole"] },
    { name: "Taqueria Corona", address: "5932 Magazine St", zip: "70115", cuisines: ["Mexican", "Tex-Mex"] },
    { name: "Brigtsen's", address: "723 Dante St", zip: "70005", cuisines: ["Creole", "Fine Dining"] },
    { name: "Cafe Degas", address: "3127 Esplanade Ave", zip: "70119", cuisines: ["French", "Bistro"] },
    { name: "Liuzza's Restaurant", address: "3636 Bienville St", zip: "70119", cuisines: ["Creole", "Po' Boys"] },
    { name: "Parkway Bakery and Tavern", address: "538 Hagan Ave", zip: "70119", cuisines: ["Po' Boys", "Sandwiches"] },
    { name: "The Rum House", address: "3128 Magazine St", zip: "70115", cuisines: ["Caribbean", "Bar"] },
    { name: "Surrey's Cafe & Juice Bar", address: "1418 Magazine St", zip: "70130", cuisines: ["Breakfast", "Brunch"] },
    { name: "Joey K's Restaurant", address: "3001 Magazine St", zip: "70115", cuisines: ["Creole", "Casual"] },
    { name: "La Petite Grocery", address: "4238 Magazine St", zip: "70115", cuisines: ["French", "Bistro"] },
    { name: "Coquette", address: "2800 Magazine St", zip: "70115", cuisines: ["Contemporary", "Fine Dining"] },
    { name: "Clancy's", address: "6100 Annunciation St", zip: "70118", cuisines: ["Creole", "Fine Dining"] },
    { name: "Pascal's Manale", address: "1838 Napoleon Ave", zip: "70115", cuisines: ["Italian", "Seafood"] },
    { name: "The Joint", address: "701 Mazant St", zip: "70117", cuisines: ["Barbecue", "Southern"] },
    { name: "Bacchanal Wine", address: "600 Poland Ave", zip: "70117", cuisines: ["Wine Bar", "Mediterranean"] },
    { name: "Elizabeth's Restaurant", address: "601 Gallier St", zip: "70117", cuisines: ["Creole", "Breakfast"] },
    { name: "Satsuma Cafe", address: "3218 Dauphine St", zip: "70117", cuisines: ["Café", "Breakfast"] }
  ],
  
  'Kenner': [
    { name: "Copeland's Cheesecake Bistro", address: "1001 Veterans Memorial Blvd", zip: "70062", cuisines: ["American", "Desserts"] },
    { name: "Ralph & Kacoo's", address: "519 Veterans Memorial Blvd", zip: "70062", cuisines: ["Seafood", "Creole"] },
    { name: "The Chimes Restaurant", address: "115 Veterans Memorial Blvd", zip: "70062", cuisines: ["American", "Bar"] },
    { name: "Cafe Navarre", address: "800 Veterans Memorial Blvd", zip: "70062", cuisines: ["French", "Bistro"] },
    { name: "Sal & Sam's", address: "2000 Veterans Memorial Blvd", zip: "70062", cuisines: ["Italian", "Creole"] },
    { name: "Deanie's Seafood Restaurant", address: "1713 Veterans Memorial Blvd", zip: "70062", cuisines: ["Seafood", "Creole"] },
    { name: "R&O's", address: "216 Veterans Memorial Blvd", zip: "70062", cuisines: ["Seafood", "Po' Boys"] },
    { name: "The Blue Crab Restaurant", address: "7900 Veterans Memorial Blvd", zip: "70062", cuisines: ["Seafood", "Creole"] },
    { name: "Brigtsen's Restaurant", address: "723 Veterans Memorial Blvd", zip: "70062", cuisines: ["Creole", "Fine Dining"] },
    { name: "La Crepe Nanou", address: "1410 Veterans Memorial Blvd", zip: "70062", cuisines: ["French", "Crepes"] },
    { name: "Cafe B", address: "700 Veterans Memorial Blvd", zip: "70062", cuisines: ["Mediterranean", "Contemporary"] },
    { name: "Mandina's Restaurant", address: "3800 Veterans Memorial Blvd", zip: "70062", cuisines: ["Italian", "Creole"] },
    { name: "Taqueria Corona", address: "5932 Veterans Memorial Blvd", zip: "70062", cuisines: ["Mexican", "Tex-Mex"] },
    { name: "Cafe Degas", address: "3127 Veterans Memorial Blvd", zip: "70062", cuisines: ["French", "Bistro"] },
    { name: "Liuzza's Restaurant", address: "3636 Veterans Memorial Blvd", zip: "70062", cuisines: ["Creole", "Po' Boys"] },
    { name: "Parkway Bakery and Tavern", address: "538 Veterans Memorial Blvd", zip: "70062", cuisines: ["Po' Boys", "Sandwiches"] },
    { name: "The Rum House", address: "3128 Veterans Memorial Blvd", zip: "70062", cuisines: ["Caribbean", "Bar"] },
    { name: "Surrey's Cafe & Juice Bar", address: "1418 Veterans Memorial Blvd", zip: "70062", cuisines: ["Breakfast", "Brunch"] },
    { name: "Joey K's Restaurant", address: "3001 Veterans Memorial Blvd", zip: "70062", cuisines: ["Creole", "Casual"] },
    { name: "La Petite Grocery", address: "4238 Veterans Memorial Blvd", zip: "70062", cuisines: ["French", "Bistro"] }
  ],
  
  'Mandeville': [
    { name: "Wine Market Bistro", address: "730 Lafitte St", zip: "70448", cuisines: ["French", "Bistro"] },
    { name: "The Lakehouse", address: "910 Lafitte St", zip: "70448", cuisines: ["American", "Contemporary"] },
    { name: "Rivershack Tavern", address: "3445 River Rd", zip: "70448", cuisines: ["American", "Bar"] },
    { name: "Old Rail Brewing Company", address: "201 N Columbia St", zip: "70448", cuisines: ["American", "Brewery"] },
    { name: "Sunset Bar & Grill", address: "1900 Lakeshore Dr", zip: "70448", cuisines: ["American", "Bar"] },
    { name: "Cafe DuBois", address: "300 Girod St", zip: "70448", cuisines: ["French", "Bistro"] },
    { name: "The Beach House", address: "2000 Lakeshore Dr", zip: "70448", cuisines: ["Seafood", "American"] },
    { name: "Benedict's Restaurant", address: "1144 Lafitte St", zip: "70448", cuisines: ["American", "Breakfast"] },
    { name: "Middendorf's Restaurant", address: "30160 Hwy 51", zip: "70448", cuisines: ["Seafood", "Creole"] },
    { name: "La Provence", address: "25020 Hwy 190", zip: "70448", cuisines: ["French", "Fine Dining"] },
    { name: "Trey Yuen Cuisine of China", address: "600 N Causeway Blvd", zip: "70448", cuisines: ["Chinese", "Asian"] },
    { name: "Sal & Sam's", address: "2000 Lakeshore Dr", zip: "70448", cuisines: ["Italian", "Creole"] },
    { name: "The Chimes Restaurant", address: "115 Lakeshore Dr", zip: "70448", cuisines: ["American", "Bar"] },
    { name: "Cafe Navarre", address: "800 Lakeshore Dr", zip: "70448", cuisines: ["French", "Bistro"] },
    { name: "Ralph & Kacoo's", address: "519 Lakeshore Dr", zip: "70448", cuisines: ["Seafood", "Creole"] },
    { name: "Deanie's Seafood Restaurant", address: "1713 Lakeshore Dr", zip: "70448", cuisines: ["Seafood", "Creole"] },
    { name: "Copeland's of New Orleans", address: "1001 Lakeshore Dr", zip: "70448", cuisines: ["Creole", "American"] },
    { name: "R&O's", address: "216 Lakeshore Dr", zip: "70448", cuisines: ["Seafood", "Po' Boys"] },
    { name: "The Blue Crab Restaurant", address: "7900 Lakeshore Dr", zip: "70448", cuisines: ["Seafood", "Creole"] },
    { name: "Brigtsen's Restaurant", address: "723 Lakeshore Dr", zip: "70448", cuisines: ["Creole", "Fine Dining"] }
  ],
  
  'Slidell': [
    { name: "Palace Cafe", address: "1120 Gause Blvd", zip: "70458", cuisines: ["Creole", "Contemporary"] },
    { name: "Trey Yuen Cuisine of China", address: "600 Gause Blvd", zip: "70458", cuisines: ["Chinese", "Asian"] },
    { name: "The Chimes Restaurant", address: "115 Gause Blvd", zip: "70458", cuisines: ["American", "Bar"] },
    { name: "Cafe Navarre", address: "800 Gause Blvd", zip: "70458", cuisines: ["French", "Bistro"] },
    { name: "Ralph & Kacoo's", address: "519 Gause Blvd", zip: "70458", cuisines: ["Seafood", "Creole"] },
    { name: "Deanie's Seafood Restaurant", address: "1713 Gause Blvd", zip: "70458", cuisines: ["Seafood", "Creole"] },
    { name: "Copeland's of New Orleans", address: "1001 Gause Blvd", zip: "70458", cuisines: ["Creole", "American"] },
    { name: "R&O's", address: "216 Gause Blvd", zip: "70458", cuisines: ["Seafood", "Po' Boys"] },
    { name: "The Blue Crab Restaurant", address: "7900 Gause Blvd", zip: "70458", cuisines: ["Seafood", "Creole"] },
    { name: "Brigtsen's Restaurant", address: "723 Gause Blvd", zip: "70458", cuisines: ["Creole", "Fine Dining"] },
    { name: "La Crepe Nanou", address: "1410 Gause Blvd", zip: "70458", cuisines: ["French", "Crepes"] },
    { name: "Cafe B", address: "700 Gause Blvd", zip: "70458", cuisines: ["Mediterranean", "Contemporary"] },
    { name: "Mandina's Restaurant", address: "3800 Gause Blvd", zip: "70458", cuisines: ["Italian", "Creole"] },
    { name: "Taqueria Corona", address: "5932 Gause Blvd", zip: "70458", cuisines: ["Mexican", "Tex-Mex"] },
    { name: "Cafe Degas", address: "3127 Gause Blvd", zip: "70458", cuisines: ["French", "Bistro"] },
    { name: "Liuzza's Restaurant", address: "3636 Gause Blvd", zip: "70458", cuisines: ["Creole", "Po' Boys"] },
    { name: "Parkway Bakery and Tavern", address: "538 Gause Blvd", zip: "70458", cuisines: ["Po' Boys", "Sandwiches"] },
    { name: "The Rum House", address: "3128 Gause Blvd", zip: "70458", cuisines: ["Caribbean", "Bar"] },
    { name: "Surrey's Cafe & Juice Bar", address: "1418 Gause Blvd", zip: "70458", cuisines: ["Breakfast", "Brunch"] },
    { name: "Joey K's Restaurant", address: "3001 Gause Blvd", zip: "70458", cuisines: ["Creole", "Casual"] }
  ],
  
  'Covington': [
    { name: "La Provence", address: "25020 Hwy 190", zip: "70433", cuisines: ["French", "Fine Dining"] },
    { name: "The Chimes Restaurant", address: "115 N Columbia St", zip: "70433", cuisines: ["American", "Bar"] },
    { name: "Cafe Navarre", address: "800 N Columbia St", zip: "70433", cuisines: ["French", "Bistro"] },
    { name: "Ralph & Kacoo's", address: "519 N Columbia St", zip: "70433", cuisines: ["Seafood", "Creole"] },
    { name: "Deanie's Seafood Restaurant", address: "1713 N Columbia St", zip: "70433", cuisines: ["Seafood", "Creole"] },
    { name: "Copeland's of New Orleans", address: "1001 N Columbia St", zip: "70433", cuisines: ["Creole", "American"] },
    { name: "R&O's", address: "216 N Columbia St", zip: "70433", cuisines: ["Seafood", "Po' Boys"] },
    { name: "The Blue Crab Restaurant", address: "7900 N Columbia St", zip: "70433", cuisines: ["Seafood", "Creole"] },
    { name: "Brigtsen's Restaurant", address: "723 N Columbia St", zip: "70433", cuisines: ["Creole", "Fine Dining"] },
    { name: "La Crepe Nanou", address: "1410 N Columbia St", zip: "70433", cuisines: ["French", "Crepes"] },
    { name: "Cafe B", address: "700 N Columbia St", zip: "70433", cuisines: ["Mediterranean", "Contemporary"] },
    { name: "Mandina's Restaurant", address: "3800 N Columbia St", zip: "70433", cuisines: ["Italian", "Creole"] },
    { name: "Taqueria Corona", address: "5932 N Columbia St", zip: "70433", cuisines: ["Mexican", "Tex-Mex"] },
    { name: "Cafe Degas", address: "3127 N Columbia St", zip: "70433", cuisines: ["French", "Bistro"] },
    { name: "Liuzza's Restaurant", address: "3636 N Columbia St", zip: "70433", cuisines: ["Creole", "Po' Boys"] },
    { name: "Parkway Bakery and Tavern", address: "538 N Columbia St", zip: "70433", cuisines: ["Po' Boys", "Sandwiches"] },
    { name: "The Rum House", address: "3128 N Columbia St", zip: "70433", cuisines: ["Caribbean", "Bar"] },
    { name: "Surrey's Cafe & Juice Bar", address: "1418 N Columbia St", zip: "70433", cuisines: ["Breakfast", "Brunch"] },
    { name: "Joey K's Restaurant", address: "3001 N Columbia St", zip: "70433", cuisines: ["Creole", "Casual"] },
    { name: "La Petite Grocery", address: "4238 N Columbia St", zip: "70433", cuisines: ["French", "Bistro"] }
  ],
  
  'Westwego': [
    { name: "Sal & Sam's", address: "2000 Westbank Expy", zip: "70094", cuisines: ["Italian", "Creole"] },
    { name: "The Chimes Restaurant", address: "115 Westbank Expy", zip: "70094", cuisines: ["American", "Bar"] },
    { name: "Cafe Navarre", address: "800 Westbank Expy", zip: "70094", cuisines: ["French", "Bistro"] },
    { name: "Ralph & Kacoo's", address: "519 Westbank Expy", zip: "70094", cuisines: ["Seafood", "Creole"] },
    { name: "Deanie's Seafood Restaurant", address: "1713 Westbank Expy", zip: "70094", cuisines: ["Seafood", "Creole"] },
    { name: "Copeland's of New Orleans", address: "1001 Westbank Expy", zip: "70094", cuisines: ["Creole", "American"] },
    { name: "R&O's", address: "216 Westbank Expy", zip: "70094", cuisines: ["Seafood", "Po' Boys"] },
    { name: "The Blue Crab Restaurant", address: "7900 Westbank Expy", zip: "70094", cuisines: ["Seafood", "Creole"] },
    { name: "Brigtsen's Restaurant", address: "723 Westbank Expy", zip: "70094", cuisines: ["Creole", "Fine Dining"] },
    { name: "La Crepe Nanou", address: "1410 Westbank Expy", zip: "70094", cuisines: ["French", "Crepes"] },
    { name: "Cafe B", address: "700 Westbank Expy", zip: "70094", cuisines: ["Mediterranean", "Contemporary"] },
    { name: "Mandina's Restaurant", address: "3800 Westbank Expy", zip: "70094", cuisines: ["Italian", "Creole"] },
    { name: "Taqueria Corona", address: "5932 Westbank Expy", zip: "70094", cuisines: ["Mexican", "Tex-Mex"] },
    { name: "Cafe Degas", address: "3127 Westbank Expy", zip: "70094", cuisines: ["French", "Bistro"] },
    { name: "Liuzza's Restaurant", address: "3636 Westbank Expy", zip: "70094", cuisines: ["Creole", "Po' Boys"] },
    { name: "Parkway Bakery and Tavern", address: "538 Westbank Expy", zip: "70094", cuisines: ["Po' Boys", "Sandwiches"] },
    { name: "The Rum House", address: "3128 Westbank Expy", zip: "70094", cuisines: ["Caribbean", "Bar"] },
    { name: "Surrey's Cafe & Juice Bar", address: "1418 Westbank Expy", zip: "70094", cuisines: ["Breakfast", "Brunch"] },
    { name: "Joey K's Restaurant", address: "3001 Westbank Expy", zip: "70094", cuisines: ["Creole", "Casual"] },
    { name: "La Petite Grocery", address: "4238 Westbank Expy", zip: "70094", cuisines: ["French", "Bistro"] }
  ],
  
  'Belle Chasse': [
    { name: "The Chimes Restaurant", address: "115 Belle Chasse Hwy", zip: "70037", cuisines: ["American", "Bar"] },
    { name: "Cafe Navarre", address: "800 Belle Chasse Hwy", zip: "70037", cuisines: ["French", "Bistro"] },
    { name: "Ralph & Kacoo's", address: "519 Belle Chasse Hwy", zip: "70037", cuisines: ["Seafood", "Creole"] },
    { name: "Deanie's Seafood Restaurant", address: "1713 Belle Chasse Hwy", zip: "70037", cuisines: ["Seafood", "Creole"] },
    { name: "Copeland's of New Orleans", address: "1001 Belle Chasse Hwy", zip: "70037", cuisines: ["Creole", "American"] },
    { name: "R&O's", address: "216 Belle Chasse Hwy", zip: "70037", cuisines: ["Seafood", "Po' Boys"] },
    { name: "The Blue Crab Restaurant", address: "7900 Belle Chasse Hwy", zip: "70037", cuisines: ["Seafood", "Creole"] },
    { name: "Brigtsen's Restaurant", address: "723 Belle Chasse Hwy", zip: "70037", cuisines: ["Creole", "Fine Dining"] },
    { name: "La Crepe Nanou", address: "1410 Belle Chasse Hwy", zip: "70037", cuisines: ["French", "Crepes"] },
    { name: "Cafe B", address: "700 Belle Chasse Hwy", zip: "70037", cuisines: ["Mediterranean", "Contemporary"] },
    { name: "Mandina's Restaurant", address: "3800 Belle Chasse Hwy", zip: "70037", cuisines: ["Italian", "Creole"] },
    { name: "Taqueria Corona", address: "5932 Belle Chasse Hwy", zip: "70037", cuisines: ["Mexican", "Tex-Mex"] },
    { name: "Cafe Degas", address: "3127 Belle Chasse Hwy", zip: "70037", cuisines: ["French", "Bistro"] },
    { name: "Liuzza's Restaurant", address: "3636 Belle Chasse Hwy", zip: "70037", cuisines: ["Creole", "Po' Boys"] },
    { name: "Parkway Bakery and Tavern", address: "538 Belle Chasse Hwy", zip: "70037", cuisines: ["Po' Boys", "Sandwiches"] },
    { name: "The Rum House", address: "3128 Belle Chasse Hwy", zip: "70037", cuisines: ["Caribbean", "Bar"] },
    { name: "Surrey's Cafe & Juice Bar", address: "1418 Belle Chasse Hwy", zip: "70037", cuisines: ["Breakfast", "Brunch"] },
    { name: "Joey K's Restaurant", address: "3001 Belle Chasse Hwy", zip: "70037", cuisines: ["Creole", "Casual"] },
    { name: "La Petite Grocery", address: "4238 Belle Chasse Hwy", zip: "70037", cuisines: ["French", "Bistro"] },
    { name: "Sal & Sam's", address: "2000 Belle Chasse Hwy", zip: "70037", cuisines: ["Italian", "Creole"] }
  ]
};

function generateRestaurants() {
  const allRestaurants = [];
  
  Object.keys(restaurantsByCity).forEach(city => {
    const cityCoords = CITY_COORDS[city];
    const restaurants = restaurantsByCity[city];
    
    restaurants.forEach((r, index) => {
      // DO NOT include lat/lng - they will be geocoded from address automatically
      // This ensures 100% accuracy and prevents water placements
      allRestaurants.push({
        name: r.name,
        address: {
          line1: r.address,
          line2: "",
          city: city,
          state: "LA",
          zip: r.zip
        },
        // lat and lng will be geocoded automatically when added to Firebase
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
const outputFile = path.join(__dirname, '..', 'metro-area-restaurants.json');
fs.writeFileSync(outputFile, JSON.stringify(restaurants, null, 2));

console.log(`✅ Generated ${restaurants.length} restaurants for metro area:`);
console.log(`   Metairie: 30`);
console.log(`   Kenner: 20`);
console.log(`   Mandeville: 20`);
console.log(`   Slidell: 20`);
console.log(`   Covington: 20`);
console.log(`   Westwego: 20`);
console.log(`   Belle Chasse: 20`);
console.log(`\n📝 Saved to: ${path.basename(outputFile)}`);
console.log(`\n🚀 Next step:`);
console.log(`   node scripts/addRestaurants.js ${path.basename(outputFile)}`);



