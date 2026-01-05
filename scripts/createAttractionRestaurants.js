/**
 * Create Attraction Restaurants
 * 
 * Creates Fulton Alley (bowling) and Dave & Buster's (gaming venue)
 * with their respective attractions enabled
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'firebase-admin-key.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Error: firebase-admin-key.json not found!');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// Restaurant data
const RESTAURANTS = [
  {
    name: "Fulton Alley",
    phone: "(504) 566-0000",
    website: "https://www.fultonalley.com",
    address: {
      line1: "600 Fulton St",
      line2: "",
      city: "New Orleans",
      state: "LA",
      zip: "70130"
    },
    lat: 29.9506,
    lng: -90.0711,
    cuisines: ["American", "Bar"],
    attractions: {
      bowling: true,
      gamingVenue: false
    },
    liveRating: 4.5,
    companyId: null,
    hoursOfOperation: {
      Monday: { openTime: "11:00", openMeridiem: "AM", closeTime: "11:00", closeMeridiem: "PM" },
      Tuesday: { openTime: "11:00", openMeridiem: "AM", closeTime: "11:00", closeMeridiem: "PM" },
      Wednesday: { openTime: "11:00", openMeridiem: "AM", closeTime: "11:00", closeMeridiem: "PM" },
      Thursday: { openTime: "11:00", openMeridiem: "AM", closeTime: "11:00", closeMeridiem: "PM" },
      Friday: { openTime: "11:00", openMeridiem: "AM", closeTime: "12:00", closeMeridiem: "AM" },
      Saturday: { openTime: "11:00", openMeridiem: "AM", closeTime: "12:00", closeMeridiem: "AM" },
      Sunday: { openTime: "11:00", openMeridiem: "AM", closeTime: "11:00", closeMeridiem: "PM" }
    }
  },
  {
    name: "Dave & Buster's",
    phone: "(504) 301-2000",
    website: "https://www.daveandbusters.com",
    address: {
      line1: "6015 Veterans Memorial Blvd",
      line2: "",
      city: "Metairie",
      state: "LA",
      zip: "70003"
    },
    lat: 29.9978,
    lng: -90.1781,
    cuisines: ["American", "Bar"],
    attractions: {
      bowling: false,
      gamingVenue: true
    },
    liveRating: 4.2,
    companyId: null,
    hoursOfOperation: {
      Monday: { openTime: "11:00", openMeridiem: "AM", closeTime: "12:00", closeMeridiem: "AM" },
      Tuesday: { openTime: "11:00", openMeridiem: "AM", closeTime: "12:00", closeMeridiem: "AM" },
      Wednesday: { openTime: "11:00", openMeridiem: "AM", closeTime: "12:00", closeMeridiem: "AM" },
      Thursday: { openTime: "11:00", openMeridiem: "AM", closeTime: "12:00", closeMeridiem: "AM" },
      Friday: { openTime: "11:00", openMeridiem: "AM", closeTime: "1:00", closeMeridiem: "AM" },
      Saturday: { openTime: "10:00", openMeridiem: "AM", closeTime: "1:00", closeMeridiem: "AM" },
      Sunday: { openTime: "10:00", openMeridiem: "AM", closeTime: "12:00", closeMeridiem: "AM" }
    }
  }
];

async function createAttractionRestaurants() {
  try {
    console.log('🍽️  Creating attraction restaurants...\n');

    for (const restaurant of RESTAURANTS) {
      // Create a document ID from the restaurant name (slugified)
      const restaurantId = restaurant.name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      const restaurantRef = db.collection('restaurants').doc(restaurantId);

      // Check if restaurant already exists
      const existingDoc = await restaurantRef.get();
      if (existingDoc.exists) {
        console.log(`⚠️  Restaurant "${restaurant.name}" already exists. Updating...`);
        await restaurantRef.update({
          ...restaurant,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        await restaurantRef.set({
          ...restaurant,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      console.log(`✅ Created/Updated: ${restaurant.name}`);
      console.log(`   ID: ${restaurantId}`);
      console.log(`   Attractions: ${JSON.stringify(restaurant.attractions)}`);
      console.log(`   URL: /restaurant/${restaurantId}\n`);
    }

    console.log('✨ Successfully created attraction restaurants!');
    console.log('\n📊 Summary:');
    console.log(`   Fulton Alley - Bowling enabled`);
    console.log(`   Dave & Buster's - Gaming Venue enabled`);

  } catch (error) {
    console.error('❌ Error creating restaurants:', error);
    throw error;
  }
}

// Run the script
createAttractionRestaurants()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

