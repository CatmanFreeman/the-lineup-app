// src/utils/valetCompanyLocationService.js
//
// VALET COMPANY LOCATION SERVICE
//
// Manages valet company locations (for paid plans)
// - FREE plan: Can only work at restaurants (must be associated)
// - PAID plan: Can add non-restaurant locations (venues, nightclubs, etc.)

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../hooks/services/firebase";
import { VALET_COMPANY_PLAN } from "./valetCompanyService";

/**
 * Add a location to a valet company
 * 
 * @param {Object} params
 * @param {string} params.valetCompanyId - Valet company ID
 * @param {Object} params.location - Location object
 * @param {string} params.location.name - Location name
 * @param {string} params.location.type - Location type (restaurant, venue, nightclub, etc.)
 * @param {number} params.location.lat - Latitude
 * @param {number} params.location.lng - Longitude
 * @param {string} params.location.address - Address
 * @param {string} params.location.restaurantId - Restaurant ID (if type is "restaurant")
 * @returns {Promise<{success: boolean, requiresUpgrade?: boolean}>}
 */
export async function addValetCompanyLocation({
  valetCompanyId,
  location,
}) {
  try {
    // Get valet company
    const companyRef = doc(db, "valetCompanies", valetCompanyId);
    const companySnap = await getDoc(companyRef);

    if (!companySnap.exists()) {
      throw new Error("Valet company not found");
    }

    const companyData = companySnap.data();
    const plan = companyData.plan || VALET_COMPANY_PLAN.FREE;

    // Check if location is a restaurant
    const isRestaurant = location.type === "restaurant" || location.restaurantId;

    // FREE plan can only add restaurant locations
    if (plan === VALET_COMPANY_PLAN.FREE && !isRestaurant) {
      return {
        success: false,
        requiresUpgrade: true,
        message: "Upgrade to a paid plan to add non-restaurant locations",
      };
    }

    // Add location
    const locationData = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: location.name,
      type: location.type || (isRestaurant ? "restaurant" : "venue"),
      lat: location.lat,
      lng: location.lng,
      address: location.address || "",
      restaurantId: location.restaurantId || null,
      createdAt: serverTimestamp(),
    };

    await updateDoc(companyRef, {
      locations: arrayUnion(locationData),
      updatedAt: serverTimestamp(),
    });

    return {
      success: true,
      locationId: locationData.id,
    };
  } catch (error) {
    console.error("Error adding valet company location:", error);
    throw error;
  }
}

/**
 * Remove a location from a valet company
 * 
 * @param {string} valetCompanyId
 * @param {string} locationId
 * @returns {Promise<void>}
 */
export async function removeValetCompanyLocation(valetCompanyId, locationId) {
  try {
    const companyRef = doc(db, "valetCompanies", valetCompanyId);
    const companySnap = await getDoc(companyRef);

    if (!companySnap.exists()) {
      throw new Error("Valet company not found");
    }

    const companyData = companySnap.data();
    const locations = companyData.locations || [];
    const locationToRemove = locations.find((loc) => loc.id === locationId);

    if (!locationToRemove) {
      throw new Error("Location not found");
    }

    await updateDoc(companyRef, {
      locations: arrayRemove(locationToRemove),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error removing valet company location:", error);
    throw error;
  }
}

/**
 * Get all locations for a valet company
 * 
 * @param {string} valetCompanyId
 * @returns {Promise<Array>} Array of locations
 */
export async function getValetCompanyLocations(valetCompanyId) {
  try {
    const companyRef = doc(db, "valetCompanies", valetCompanyId);
    const companySnap = await getDoc(companyRef);

    if (!companySnap.exists()) {
      return [];
    }

    const companyData = companySnap.data();
    return companyData.locations || [];
  } catch (error) {
    console.error("Error getting valet company locations:", error);
    return [];
  }
}

/**
 * Upgrade valet company to paid plan
 * 
 * @param {string} valetCompanyId
 * @returns {Promise<void>}
 */
export async function upgradeValetCompanyToPaid(valetCompanyId) {
  try {
    const companyRef = doc(db, "valetCompanies", valetCompanyId);
    await updateDoc(companyRef, {
      plan: VALET_COMPANY_PLAN.PAID,
      upgradedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error upgrading valet company:", error);
    throw error;
  }
}

/**
 * Get all valet companies with locations (for search)
 * 
 * @returns {Promise<Array>} Array of valet companies with their locations
 */
export async function getAllValetCompaniesWithLocations() {
  try {
    const companiesRef = collection(db, "valetCompanies");
    const companiesSnap = await getDocs(companiesRef);

    const companies = [];
    companiesSnap.forEach((doc) => {
      const data = doc.data();
      const locations = data.locations || [];
      
      // Only include companies with locations
      if (locations.length > 0) {
        companies.push({
          id: doc.id,
          name: data.name,
          logoURL: data.logoURL,
          plan: data.plan || VALET_COMPANY_PLAN.FREE,
          locations: locations.map((loc) => ({
            ...loc,
            valetCompanyId: doc.id,
            valetCompanyName: data.name,
          })),
        });
      }
    });

    return companies;
  } catch (error) {
    console.error("Error getting valet companies with locations:", error);
    return [];
  }
}

