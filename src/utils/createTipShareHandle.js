// src/utils/createTipShareHandle.js
// Utility to create a TipShare handle for a staff member (for testing)

import { collection, getDocs, doc, updateDoc, query, where } from "firebase/firestore";
import { db } from "../hooks/services/firebase";

/**
 * Create or update a TipShare handle for a staff member
 * @param {string} staffName - Name of the staff member (e.g., "Jordan Blake")
 * @param {string} handle - The handle without $ signs (e.g., "jordanblake")
 * @returns {Promise<boolean>} Success status
 */
export async function createTipShareHandleForStaff(staffName, handle) {
  try {
    // Search for staff member by name across all restaurants
    const restaurantsRef = collection(db, "restaurants");
    const restaurantsSnap = await getDocs(restaurantsRef);
    
    let found = false;
    
    for (const restaurantDoc of restaurantsSnap.docs) {
      const restaurantId = restaurantDoc.id;
      const staffRef = collection(db, "restaurants", restaurantId, "staff");
      const staffSnap = await getDocs(staffRef);
      
      for (const staffDoc of staffSnap.docs) {
        const staffData = staffDoc.data();
        const name = staffData.name || "";
        
        // Check if name matches (case insensitive, partial match for "Jordan" or "Jordan Blake")
        if (name.toLowerCase().includes(staffName.toLowerCase())) {
          const staffDocRef = doc(db, "restaurants", restaurantId, "staff", staffDoc.id);
          
          // Format handle with $ signs: $handle$
          const formattedHandle = `$${handle}$`;
          
          await updateDoc(staffDocRef, {
            tipShareHandle: formattedHandle,
          });
          
          console.log(`✅ Created TipShare handle ${formattedHandle} for ${name} at ${restaurantDoc.data().name || restaurantId}`);
          found = true;
        }
      }
    }
    
    if (!found) {
      console.warn(`⚠️ No staff member found with name containing "${staffName}"`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Error creating TipShare handle:", error);
    throw error;
  }
}

/**
 * Quick function to create handle for Jordan Blake
 */
export async function createJordanBlakeHandle() {
  return await createTipShareHandleForStaff("Jordan", "jordanblake");
}









