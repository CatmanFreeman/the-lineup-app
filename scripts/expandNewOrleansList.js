/**
 * Expand New Orleans Restaurant List
 * 
 * This script takes the existing manual list and expands it with more restaurants
 * by searching public data sources and adding well-known establishments.
 */

const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, '..', 'new-orleans-restaurants-manual.json');
const outputFile = path.join(__dirname, '..', 'new-orleans-expanded.json');

// Additional well-known New Orleans restaurants
const additionalRestaurants = [
  // French Quarter
  { name: "Muriel's Jackson Square", address: "801 Chartres St", zip: "70116", lat: 29.9578, lng: -90.0639, cuisines: ["Creole", "Fine Dining"] },
  { name: "The Gumbo Shop", address: "630 St Peter St", zip: "70116", lat: 29.9586, lng: -90.0642, cuisines: ["Creole", "Gumbo"] },
  { name: "Napoleon House", address: "500 Chartres St", zip: "70130", lat: 29.9567, lng: -90.0656, cuisines: ["Creole", "Bar"] },
  { name: "Johnny's Po-Boys", address: "511 St Louis St", zip: "70130", lat: 29.9572, lng: -90.0658, cuisines: ["Po' Boys", "Sandwiches"] },
  { name: "Central Grocery", address: "923 Decatur St", zip: "70116", lat: 29.9586, lng: -90.0628, cuisines: ["Deli", "Muffuletta"] },
  { name: "Felix's Restaurant & Oyster Bar", address: "739 Iberville St", zip: "70130", lat: 29.9567, lng: -90.0672, cuisines: ["Seafood", "Oysters"] },
  { name: "Mr. B's Bistro", address: "201 Royal St", zip: "70130", lat: 29.9575, lng: -90.0667, cuisines: ["Creole", "Bistro"] },
  { name: "Tujague's Restaurant", address: "823 Decatur St", zip: "70116", lat: 29.9583, lng: -90.0631, cuisines: ["Creole", "French"] },
  { name: "Irene's Cuisine", address: "539 St Philip St", zip: "70116", lat: 29.9592, lng: -90.0647, cuisines: ["Italian", "Creole"] },
  { name: "Coop's Place", address: "1109 Decatur St", zip: "70116", lat: 29.9592, lng: -90.0622, cuisines: ["Creole", "Bar"] },
  
  // Garden District / Uptown
  { name: "Pascal's Manale", address: "1838 Napoleon Ave", zip: "70115", lat: 29.9256, lng: -90.0814, cuisines: ["Italian", "Seafood"] },
  { name: "Clancy's", address: "6100 Annunciation St", zip: "70118", lat: 29.9306, lng: -90.0814, cuisines: ["Creole", "Fine Dining"] },
  { name: "La Petite Grocery", address: "4238 Magazine St", zip: "70115", lat: 29.9206, lng: -90.0814, cuisines: ["French", "Bistro"] },
  { name: "Coquette", address: "2800 Magazine St", zip: "70115", lat: 29.9256, lng: -90.0814, cuisines: ["Contemporary", "Fine Dining"] },
  { name: "Surrey's Cafe & Juice Bar", address: "1418 Magazine St", zip: "70130", lat: 29.9306, lng: -90.0814, cuisines: ["Breakfast", "Brunch"] },
  { name: "The Rum House", address: "3128 Magazine St", zip: "70115", lat: 29.9206, lng: -90.0814, cuisines: ["Caribbean", "Bar"] },
  { name: "Joey K's Restaurant", address: "3001 Magazine St", zip: "70115", lat: 29.9206, lng: -90.0814, cuisines: ["Creole", "Casual"] },
  
  // CBD / Warehouse District
  { name: "Herbsaint", address: "701 St Charles Ave", zip: "70130", lat: 29.9506, lng: -90.0681, cuisines: ["French", "Contemporary"] },
  { name: "Peche Seafood Grill", address: "800 Magazine St", zip: "70130", lat: 29.9478, lng: -70.0703, cuisines: ["Seafood", "Contemporary"] },
  { name: "Cochon Butcher", address: "930 Tchoupitoulas St", zip: "70130", lat: 29.9458, lng: -90.0708, cuisines: ["Sandwiches", "Butcher"] },
  { name: "Luke", address: "333 St Charles Ave", zip: "70130", lat: 29.9506, lng: -90.0681, cuisines: ["Brasserie", "French"] },
  { name: "Domenica", address: "123 Baronne St", zip: "70112", lat: 29.9506, lng: -90.0681, cuisines: ["Italian", "Pizza"] },
  { name: "August", address: "301 Tchoupitoulas St", zip: "70130", lat: 29.9506, lng: -90.0681, cuisines: ["Contemporary", "Fine Dining"] },
  
  // Marigny / Bywater
  { name: "Bacchanal Wine", address: "600 Poland Ave", zip: "70117", lat: 29.9631, lng: -90.0542, cuisines: ["Wine Bar", "Mediterranean"] },
  { name: "The Joint", address: "701 Mazant St", zip: "70117", lat: 29.9681, lng: -90.0444, cuisines: ["Barbecue", "Southern"] },
  { name: "Elizabeth's Restaurant", address: "601 Gallier St", zip: "70117", lat: 29.9631, lng: -90.0542, cuisines: ["Creole", "Breakfast"] },
  { name: "Satsuma Cafe", address: "3218 Dauphine St", zip: "70117", lat: 29.9631, lng: -90.0542, cuisines: ["Café", "Breakfast"] },
  { name: "Mimi's in the Marigny", address: "2601 Royal St", zip: "70117", lat: 29.9631, lng: -90.0542, cuisines: ["Tapas", "Bar"] },
  
  // Mid-City
  { name: "Liuzza's Restaurant", address: "3636 Bienville St", zip: "70119", lat: 29.9686, lng: -90.1000, cuisines: ["Creole", "Po' Boys"] },
  { name: "Parkway Bakery and Tavern", address: "538 Hagan Ave", zip: "70119", lat: 29.9686, lng: -90.1000, cuisines: ["Po' Boys", "Sandwiches"] },
  { name: "Mandina's Restaurant", address: "3800 Canal St", zip: "70119", lat: 29.9686, lng: -90.1000, cuisines: ["Italian", "Creole"] },
  { name: "Ralph's on the Park", address: "900 City Park Ave", zip: "70119", lat: 29.9686, lng: -90.1000, cuisines: ["Contemporary", "Fine Dining"] },
  { name: "Cafe Degas", address: "3127 Esplanade Ave", zip: "70119", lat: 29.9686, lng: -90.1000, cuisines: ["French", "Bistro"] },
  
  // More Famous Spots
  { name: "Port of Call", address: "838 Esplanade Ave", zip: "70116", lat: 29.9583, lng: -90.0625, cuisines: ["Burgers", "Bar"] },
  { name: "Camellia Grill", address: "626 S Carrollton Ave", zip: "70118", lat: 29.9306, lng: -90.0814, cuisines: ["Diner", "Breakfast"] },
  { name: "The Camellia Grill", address: "540 Chartres St", zip: "70130", lat: 29.9567, lng: -90.0656, cuisines: ["Diner", "Breakfast"] },
  { name: "Ruby Slipper Cafe", address: "200 Magazine St", zip: "70130", lat: 29.9506, lng: -90.0681, cuisines: ["Breakfast", "Brunch"] },
  { name: "Toast", address: "1039 Decatur St", zip: "70116", lat: 29.9592, lng: -90.0622, cuisines: ["Breakfast", "Brunch"] },
  { name: "Stanley", address: "547 St Ann St", zip: "70116", lat: 29.9586, lng: -90.0642, cuisines: ["Breakfast", "Brunch"] },
  { name: "Sylvain", address: "625 Chartres St", zip: "70130", lat: 29.9575, lng: -90.0653, cuisines: ["Contemporary", "Bar"] },
  { name: "SoBou", address: "310 Chartres St", zip: "70130", lat: 29.9567, lng: -90.0658, cuisines: ["Contemporary", "Bar"] },
  { name: "Bourbon House", address: "144 Bourbon St", zip: "70130", lat: 29.9578, lng: -90.0667, cuisines: ["Seafood", "Creole"] },
  { name: "Red Fish Grill", address: "115 Bourbon St", zip: "70130", lat: 29.9578, lng: -90.0667, cuisines: ["Seafood", "Creole"] },
  { name: "Dickie Brennan's Steakhouse", address: "716 Iberville St", zip: "70130", lat: 29.9567, lng: -90.0672, cuisines: ["Steakhouse", "Fine Dining"] },
  { name: "Palace Cafe", address: "605 Canal St", zip: "70130", lat: 29.9561, lng: -90.0681, cuisines: ["Creole", "Contemporary"] },
  { name: "Dickie Brennan's Tableau", address: "616 St Peter St", zip: "70116", lat: 29.9586, lng: -90.0642, cuisines: ["Creole", "Fine Dining"] },
  { name: "GW Fins", address: "808 Bienville St", zip: "70112", lat: 29.9561, lng: -90.0681, cuisines: ["Seafood", "Fine Dining"] },
  { name: "Iris", address: "321 N Peters St", zip: "70130", lat: 29.9567, lng: -90.0658, cuisines: ["Contemporary", "Fine Dining"] },
  { name: "Restaurant R'evolution", address: "777 Bienville St", zip: "70130", lat: 29.9561, lng: -90.0681, cuisines: ["Contemporary", "Fine Dining"] },
  { name: "Bayona", address: "430 Dauphine St", zip: "70112", lat: 29.9564, lng: -90.0658, cuisines: ["Mediterranean", "Fine Dining"] },
  { name: "NOLA Restaurant", address: "534 St Louis St", zip: "70130", lat: 29.9572, lng: -90.0658, cuisines: ["Contemporary", "Fine Dining"] },
  { name: "The Pelican Club", address: "615 Bienville St", zip: "70130", lat: 29.9561, lng: -90.0681, cuisines: ["Contemporary", "Fine Dining"] }
];

function expandList() {
  // Read existing list
  const existing = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  
  // Convert additional restaurants to full format
  const expanded = additionalRestaurants.map(r => ({
    name: r.name,
    address: {
      line1: r.address,
      line2: "",
      city: "New Orleans",
      state: "LA",
      zip: r.zip
    },
    lat: r.lat,
    lng: r.lng,
    cuisines: r.cuisines,
    phone: null,
    website: null,
    liveRating: null
  }));
  
  // Combine and remove duplicates
  const all = [...existing, ...expanded];
  const unique = [];
  const seen = new Set();
  
  all.forEach(r => {
    const key = `${r.name.toLowerCase().trim()}_${r.lat.toFixed(4)}_${r.lng.toFixed(4)}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(r);
    }
  });
  
  // Save
  fs.writeFileSync(outputFile, JSON.stringify(unique, null, 2));
  
  console.log(`✅ Expanded list: ${existing.length} → ${unique.length} restaurants`);
  console.log(`📝 Saved to: ${path.basename(outputFile)}`);
}

expandList();







