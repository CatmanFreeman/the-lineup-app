// src/utils/mockReviewService.js

import { collection, addDoc, serverTimestamp, Timestamp, doc, setDoc } from "firebase/firestore";
import { db } from "../hooks/services/firebase";

/**
 * Generate and add mock reviews to Firestore for demo purposes
 */

const MOCK_DINERS = [
  { name: "Sarah Johnson", id: "mock-diner-1" },
  { name: "Michael Chen", id: "mock-diner-2" },
  { name: "Emily Rodriguez", id: "mock-diner-3" },
  { name: "David Thompson", id: "mock-diner-4" },
  { name: "Jessica Martinez", id: "mock-diner-5" },
  { name: "James Wilson", id: "mock-diner-6" },
  { name: "Amanda Brown", id: "mock-diner-7" },
  { name: "Robert Taylor", id: "mock-diner-8" },
];

const MOCK_COMMENTS = [
  "Absolutely amazing experience! The food was incredible and the service was top-notch. Will definitely be back!",
  "Great atmosphere and delicious food. The staff was very attentive and made our evening special.",
  "The best meal I've had in a while. Everything was perfectly cooked and the presentation was beautiful.",
  "Really enjoyed the ambiance here. The food was good, though a bit pricey. Service was friendly and professional.",
  "Outstanding restaurant! The chef's special was incredible and the wine selection was impressive.",
  "Nice place with good food. The portions were generous and the flavors were well-balanced.",
  "Excellent service and delicious food. The dessert menu is a must-try!",
  "Had a wonderful dinner here. The staff went above and beyond to make our anniversary special.",
  "The food quality is consistently great. One of my favorite spots in the area.",
  "Beautiful restaurant with amazing food. The presentation was Instagram-worthy!",
  "Really enjoyed our meal. The cocktails were creative and the food was flavorful.",
  "Great place for a date night. The lighting and music set the perfect mood.",
  "The appetizers were fantastic! Main course was good too. Will return soon.",
  "Excellent value for the quality. The staff was knowledgeable about the menu.",
  "Loved everything about this place. The chef clearly knows what they're doing.",
];

const MOCK_SERVERS = [
  "Alex",
  "Jordan",
  "Casey",
  "Morgan",
  "Riley",
  "Taylor",
];

/**
 * Create mock reviews for a restaurant
 */
export async function createMockReviews(restaurantId, restaurantName, count = 5) {
  try {
    const reviewsRef = collection(db, "restaurant_reviews");
    const reviews = [];

    for (let i = 0; i < count; i++) {
      const diner = MOCK_DINERS[Math.floor(Math.random() * MOCK_DINERS.length)];
      const rating = Math.floor(Math.random() * 2) + 4; // 4 or 5 stars
      const comment = MOCK_COMMENTS[Math.floor(Math.random() * MOCK_COMMENTS.length)];
      const serverName = Math.random() > 0.5 ? MOCK_SERVERS[Math.floor(Math.random() * MOCK_SERVERS.length)] : null;
      const itemCount = Math.floor(Math.random() * 5) + 1;

      // Create timestamp that's within the last 30 days
      const daysAgo = Math.floor(Math.random() * 30);
      const createdAt = Timestamp.fromDate(
        new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
      );

      const reviewData = {
        dinerId: diner.id,
        dinerName: diner.name,
        restaurantId,
        restaurantName: restaurantName || "Restaurant",
        overallRating: rating,
        overallComment: comment,
        serverId: serverName ? `server-${Math.random().toString(36).substr(2, 9)}` : null,
        serverName,
        itemCount,
        createdAt,
        updatedAt: createdAt,
      };

      const docRef = await addDoc(reviewsRef, reviewData);
      reviews.push({ id: docRef.id, ...reviewData });
    }

    return reviews;
  } catch (error) {
    console.error("Error creating mock reviews:", error);
    throw error;
  }
}

/**
 * Generate mock review data (without saving to Firestore) for demo
 */
export function generateMockReviewData(restaurantId, restaurantName) {
  const diner = MOCK_DINERS[Math.floor(Math.random() * MOCK_DINERS.length)];
  const rating = Math.floor(Math.random() * 2) + 4; // 4 or 5 stars
  const comment = MOCK_COMMENTS[Math.floor(Math.random() * MOCK_COMMENTS.length)];
  const serverName = Math.random() > 0.5 ? MOCK_SERVERS[Math.floor(Math.random() * MOCK_SERVERS.length)] : null;
  const itemCount = Math.floor(Math.random() * 5) + 1;

  // Create timestamp that's within the last 30 days
  const daysAgo = Math.floor(Math.random() * 30);
  const createdAt = {
    toDate: () => new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
  };

  return {
    id: `mock-${Math.random().toString(36).substr(2, 9)}`,
    dinerId: diner.id,
    dinerName: diner.name,
    restaurantId,
    restaurantName: restaurantName || "Restaurant",
    overallRating: rating,
    overallComment: comment,
    serverId: serverName ? `server-${Math.random().toString(36).substr(2, 9)}` : null,
    serverName,
    itemCount,
    createdAt,
    updatedAt: createdAt,
  };
}

/**
 * Create user profiles for mock reviewers so their review pages work
 */
export async function createMockReviewerProfiles() {
  const reviewers = [
    { id: "mock-diner-1", name: "Sarah Johnson", email: "sarah.johnson@example.com" },
    { id: "mock-diner-5", name: "Jessica Martinez", email: "jessica.martinez@example.com" },
    { id: "mock-diner-7", name: "Amanda Brown", email: "amanda.brown@example.com" },
  ];

  try {
    for (const reviewer of reviewers) {
      const userRef = doc(db, "users", reviewer.id);
      await setDoc(
        userRef,
        {
          displayName: reviewer.name,
          name: reviewer.name,
          fullName: reviewer.name,
          email: reviewer.email,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
      console.log(`Created profile for ${reviewer.name}`);
    }
    return true;
  } catch (error) {
    console.error("Error creating reviewer profiles:", error);
    throw error;
  }
}

