// src/utils/restaurantContactService.js
//
// RESTAURANT CONTACT SERVICE
//
// Uses AI/web scraping to find restaurant contact information (email, phone, etc.)
// for off-app restaurants that need employment verification.

/**
 * Find restaurant contact information using web search/scraping
 * 
 * @param {string} restaurantName - Restaurant name
 * @param {string} location - Optional: city, state, or address
 * @returns {Promise<{email?: string, phone?: string, website?: string, found: boolean}>}
 */
export async function findRestaurantContact(restaurantName, location = null) {
  if (!restaurantName) {
    return { found: false };
  }

  try {
    // Method 1: Try to find restaurant in our database first (might have contact info)
    const restaurantData = await findRestaurantInDatabase(restaurantName, location);
    if (restaurantData?.email) {
      return {
        email: restaurantData.email,
        phone: restaurantData.phone,
        website: restaurantData.website,
        found: true,
      };
    }

    // Method 2: Use Google Places API (if available)
    const placesData = await findRestaurantViaGooglePlaces(restaurantName, location);
    if (placesData?.email || placesData?.website) {
      return {
        email: placesData.email,
        phone: placesData.phone,
        website: placesData.website,
        found: true,
      };
    }

    // Method 3: Web scraping via backend service
    const scrapedData = await scrapeRestaurantWebsite(restaurantName, location);
    if (scrapedData?.email) {
      return {
        email: scrapedData.email,
        phone: scrapedData.phone,
        website: scrapedData.website,
        found: true,
      };
    }

    return { found: false };
  } catch (error) {
    console.error("Error finding restaurant contact:", error);
    return { found: false };
  }
}

/**
 * Find restaurant in our database
 */
async function findRestaurantInDatabase(restaurantName, location) {
  try {
    const { collection, query, where, getDocs } = await import("firebase/firestore");
    const { db } = await import("../hooks/services/firebase");

    const restaurantsRef = collection(db, "restaurants");
    const nameQuery = query(restaurantsRef, where("name", "==", restaurantName));
    const snap = await getDocs(nameQuery);

    if (!snap.empty) {
      const restaurant = snap.docs[0].data();
      return {
        email: restaurant.contactEmail || restaurant.email,
        phone: restaurant.phone,
        website: restaurant.website,
      };
    }

    return null;
  } catch (error) {
    console.error("Error searching database:", error);
    return null;
  }
}

/**
 * Find restaurant via Google Places API
 */
async function findRestaurantViaGooglePlaces(restaurantName, location) {
  try {
    // This would require Google Places API key
    // For now, return null (would be implemented with actual API)
    const apiKey = process.env.REACT_APP_GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return null;
    }

    // TODO: Implement Google Places API search
    // const searchQuery = location ? `${restaurantName} ${location}` : restaurantName;
    // const response = await fetch(
    //   `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${apiKey}`
    // );
    // const data = await response.json();
    // ... extract email, phone, website from results

    return null;
  } catch (error) {
    console.error("Error with Google Places API:", error);
    return null;
  }
}

/**
 * Scrape restaurant website for contact information
 * This would be done via a backend service for security
 */
async function scrapeRestaurantWebsite(restaurantName, location) {
  try {
    // Call backend Cloud Function to scrape website
    const response = await fetch("https://us-central1-thelineupapp-88c99.cloudfunctions.net/scrapeRestaurantContact", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        restaurantName,
        location,
      }),
    });

    if (!response.ok) {
      throw new Error(`Scraping service returned ${response.status}`);
    }

    const result = await response.json();
    return {
      email: result.email,
      phone: result.phone,
      website: result.website,
    };
  } catch (error) {
    console.error("Error scraping restaurant website:", error);
    return null;
  }
}

/**
 * Extract email from website HTML (client-side fallback)
 * Note: This is a simple regex-based approach. For production, use a backend service.
 */
export function extractEmailFromText(text) {
  if (!text) return null;

  // Email regex pattern
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const emails = text.match(emailPattern);

  if (emails && emails.length > 0) {
    // Filter out common non-contact emails
    const filtered = emails.filter(
      (email) =>
        !email.includes("example.com") &&
        !email.includes("test.com") &&
        !email.includes("placeholder") &&
        !email.includes("noreply") &&
        !email.includes("no-reply")
    );

    // Prefer contact/hello/info emails
    const contactEmails = filtered.filter((email) =>
      email.split("@")[0].match(/contact|hello|info|general|support/i)
    );

    return contactEmails[0] || filtered[0];
  }

  return null;
}








