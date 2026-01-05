/**
 * Create Mock Valet Company
 * 
 * Creates "Valet Company 123" with 3 New Orleans restaurant locations
 * and 3 drivers per location (9 drivers total)
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'firebase-admin-key.json');
const fs = require('fs');

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

// New Orleans restaurants (we'll use these names and create locations)
const RESTAURANTS = [
  {
    name: "Commander's Palace",
    address: "1403 Washington Ave, New Orleans, LA 70130",
    lat: 29.9256,
    lng: -90.0828,
    type: "restaurant",
  },
  {
    name: "Acme Oyster House",
    address: "724 Iberville St, New Orleans, LA 70130",
    lat: 29.9567,
    lng: -90.0672,
    type: "restaurant",
  },
  {
    name: "Galatoire's Restaurant",
    address: "209 Bourbon St, New Orleans, LA 70130",
    lat: 29.9575,
    lng: -90.0667,
    type: "restaurant",
  },
];

// Driver names (3 per location)
const DRIVER_NAMES = [
  ["John Smith", "Mike Johnson", "David Williams"],
  ["James Brown", "Robert Davis", "William Miller"],
  ["Richard Wilson", "Joseph Moore", "Thomas Taylor"],
];

async function createMockValetCompany() {
  try {
    console.log('🚗 Creating Valet Company 123...\n');

    // 1. Create the valet company
    const companyId = "valet-company-123";
    const companyRef = db.collection('valetCompanies').doc(companyId);
    
    await companyRef.set({
      id: companyId,
      name: "Valet Company 123",
      contactName: "Admin User",
      contactEmail: "admin@valetcompany123.com",
      contactPhone: "(504) 555-0123",
      address: "New Orleans, LA",
      status: "ACTIVE",
      plan: "FREE",
      adminUserId: "test-admin-user-id", // You can update this with a real user ID
      locations: [],
      drivers: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ Created valet company:', companyId);

    // 2. Add locations
    const locations = [];
    const locationIds = [];

    for (let i = 0; i < RESTAURANTS.length; i++) {
      const restaurant = RESTAURANTS[i];
      const locationId = `loc-${Date.now()}-${i}`;
      locationIds.push(locationId);

      const locationData = {
        id: locationId,
        name: restaurant.name,
        type: restaurant.type,
        lat: restaurant.lat,
        lng: restaurant.lng,
        address: restaurant.address,
        restaurantId: null, // We'll try to find matching restaurant IDs
        createdAt: admin.firestore.Timestamp.now(),
      };

      locations.push(locationData);
      console.log(`✅ Added location: ${restaurant.name}`);
    }

    // Update company with locations
    await companyRef.update({
      locations: locations,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 3. Create drivers and assign to locations
    const allDriverIds = [];

    for (let locIndex = 0; locIndex < locations.length; locIndex++) {
      const location = locations[locIndex];
      const locationDrivers = DRIVER_NAMES[locIndex];

      console.log(`\n👥 Creating drivers for ${location.name}...`);

      for (let driverIndex = 0; driverIndex < locationDrivers.length; driverIndex++) {
        const driverName = locationDrivers[driverIndex];
        const driverId = `driver-${location.id}-${driverIndex}`;
        const driverEmail = `driver${locIndex + 1}${driverIndex + 1}@valetcompany123.com`;
        const driverPhone = `(504) 555-${1000 + (locIndex * 3) + driverIndex}`;

        // Create user document
        const userRef = db.collection('users').doc(driverId);
        await userRef.set({
          role: "VALET",
          valetCompanyId: companyId,
          restaurantId: location.restaurantId || null,
          name: driverName,
          email: driverEmail,
          phone: driverPhone,
          status: "ACTIVE",
          assignedLocation: location.restaurantId || location.id,
          organization: companyId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Add driver to location subcollection
        const locationDriverRef = db
          .collection('valetCompanies')
          .doc(companyId)
          .collection('locations')
          .doc(location.id)
          .collection('drivers')
          .doc(driverId);

        await locationDriverRef.set({
          userId: driverId,
          companyId: companyId,
          locationId: location.id,
          restaurantId: location.restaurantId || null,
          name: driverName,
          email: driverEmail,
          phone: driverPhone,
          status: "ACTIVE",
          assignedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        allDriverIds.push(driverId);
        console.log(`  ✅ Created driver: ${driverName} (${driverEmail})`);
      }
    }

    // Update company drivers list
    await companyRef.update({
      drivers: allDriverIds,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('\n✨ Successfully created mock valet company!');
    console.log(`\n📊 Summary:`);
    console.log(`   Company: Valet Company 123 (${companyId})`);
    console.log(`   Locations: ${locations.length}`);
    console.log(`   Total Drivers: ${allDriverIds.length}`);
    console.log(`\n🔗 Dashboard URL: /dashboard/valet-company/${companyId}?test=true`);

  } catch (error) {
    console.error('❌ Error creating mock valet company:', error);
    throw error;
  }
}

// Run the script
createMockValetCompany()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

