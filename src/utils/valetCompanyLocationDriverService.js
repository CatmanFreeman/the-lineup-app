// src/utils/valetCompanyLocationDriverService.js
//
// Manages drivers per location for valet companies
// Structure: valetCompanies/{companyId}/locations/{locationId}/drivers/{driverId}

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../hooks/services/firebase";
import { registerValetDriver } from "./valetCompanyService";

/**
 * Get all drivers for a specific location
 * 
 * @param {string} companyId - Valet company ID
 * @param {string} locationId - Location ID
 * @returns {Promise<Array>} Array of driver documents
 */
export async function getDriversForLocation(companyId, locationId) {
  try {
    const driversRef = collection(db, "valetCompanies", companyId, "locations", locationId, "drivers");
    const driversSnap = await getDocs(driversRef);
    
    const drivers = [];
    for (const driverDoc of driversSnap.docs) {
      const driverData = driverDoc.data();
      // Also get user profile for full info
      if (driverData.userId) {
        const userRef = doc(db, "users", driverData.userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          drivers.push({
            id: driverDoc.id,
            ...driverData,
            ...userSnap.data(),
          });
        } else {
          drivers.push({
            id: driverDoc.id,
            ...driverData,
          });
        }
      } else {
        drivers.push({
          id: driverDoc.id,
          ...driverData,
        });
      }
    }
    
    return drivers;
  } catch (error) {
    console.error("Error getting drivers for location:", error);
    return [];
  }
}

/**
 * Add a driver to a location
 * 
 * @param {Object} params
 * @param {string} params.companyId - Valet company ID
 * @param {string} params.locationId - Location ID
 * @param {string} params.userId - User ID (from Firebase Auth)
 * @param {string} params.restaurantId - Restaurant ID (if location is a restaurant)
 * @param {string} params.name - Driver name
 * @param {string} params.email - Driver email
 * @param {string} params.phone - Driver phone
 * @returns {Promise<void>}
 */
export async function addDriverToLocation({
  companyId,
  locationId,
  userId,
  restaurantId,
  name,
  email,
  phone,
}) {
  try {
    // First, register the driver with the valet company service
    if (restaurantId) {
      await registerValetDriver({
        userId,
        valetCompanyId: companyId,
        restaurantId,
        name,
        email,
        phone,
      });
    }

    // Add driver to location subcollection
    const driverRef = doc(db, "valetCompanies", companyId, "locations", locationId, "drivers", userId);
    await setDoc(driverRef, {
      userId,
      companyId,
      locationId,
      restaurantId: restaurantId || null,
      name,
      email,
      phone,
      status: "ACTIVE",
      assignedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error("Error adding driver to location:", error);
    throw error;
  }
}

/**
 * Remove a driver from a location
 * 
 * @param {string} companyId - Valet company ID
 * @param {string} locationId - Location ID
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export async function removeDriverFromLocation(companyId, locationId, userId) {
  try {
    const driverRef = doc(db, "valetCompanies", companyId, "locations", locationId, "drivers", userId);
    await deleteDoc(driverRef);

    // Optionally update user status
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      status: "INACTIVE",
      updatedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error("Error removing driver from location:", error);
    throw error;
  }
}

/**
 * Get all locations with their driver counts
 * 
 * @param {string} companyId - Valet company ID
 * @returns {Promise<Array>} Array of locations with driver counts
 */
export async function getLocationsWithDriverCounts(companyId) {
  try {
    // Get company locations from company document
    const companyRef = doc(db, "valetCompanies", companyId);
    const companySnap = await getDoc(companyRef);
    
    if (!companySnap.exists()) {
      return [];
    }

    const companyData = companySnap.data();
    const locations = companyData.locations || [];

    // Get driver counts for each location
    const locationsWithCounts = await Promise.all(
      locations.map(async (location) => {
        const driversRef = collection(db, "valetCompanies", companyId, "locations", location.id, "drivers");
        const driversSnap = await getDocs(driversRef);
        
        return {
          ...location,
          driverCount: driversSnap.size,
        };
      })
    );

    return locationsWithCounts;
  } catch (error) {
    console.error("Error getting locations with driver counts:", error);
    return [];
  }
}

/**
 * Get location financial data
 * 
 * @param {string} companyId - Valet company ID
 * @param {string} locationId - Location ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Object>} Financial summary
 */
export async function getLocationFinancials(companyId, locationId, startDate, endDate) {
  try {
    // This would query valet tickets/transactions for this location
    // For now, return placeholder structure
    return {
      totalRevenue: 0,
      totalTickets: 0,
      averageTicketValue: 0,
      period: {
        start: startDate,
        end: endDate,
      },
    };
  } catch (error) {
    console.error("Error getting location financials:", error);
    return {
      totalRevenue: 0,
      totalTickets: 0,
      averageTicketValue: 0,
      period: {
        start: startDate,
        end: endDate,
      },
    };
  }
}

