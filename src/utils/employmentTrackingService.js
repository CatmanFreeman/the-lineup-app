// src/utils/employmentTrackingService.js
//
// EMPLOYMENT TRACKING SERVICE
//
// Automatically tracks vetted employment history when employees work.
// This creates verified resume entries that are system-tracked, not user-entered.

import { doc, getDoc, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";
import { db } from "../hooks/services/firebase";

/**
 * Track vetted employment when an employee punches in for the first time at a restaurant
 * This creates a verified employment entry that will appear in their resume
 * 
 * @param {string} employeeUid - Employee user ID
 * @param {string} restaurantId - Restaurant ID
 * @param {string} restaurantName - Restaurant name
 * @param {string} role - Employee role/position
 * @param {Date} startDate - Employment start date (defaults to now)
 * @returns {Promise<boolean>} - True if employment was tracked, false if already exists
 */
export async function trackVettedEmployment({
  employeeUid,
  restaurantId,
  restaurantName,
  role,
  startDate = new Date(),
}) {
  if (!employeeUid || !restaurantId || !restaurantName || !role) {
    console.warn("EmploymentTracking: Missing required parameters");
    return false;
  }

  try {
    // Get user document
    const userRef = doc(db, "users", employeeUid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      console.warn(`EmploymentTracking: User document not found for ${employeeUid}`);
      return false;
    }

    const userData = userSnap.data();
    const employment = userData.employment || {};

    // Initialize vettedJobs array if it doesn't exist
    const vettedJobs = employment.vettedJobs || [];

    // Check if this restaurant/role combination already exists in vetted jobs
    const existingVettedJob = vettedJobs.find(
      (job) =>
        job.restaurantId === restaurantId &&
        job.position === role &&
        !job.endDate // Only check active jobs
    );

    if (existingVettedJob) {
      // Already tracked, no need to add again
      return false;
    }

    // Check if there's an existing vetted job at this restaurant that ended
    // If so, we might want to update it or create a new entry
    const previousJob = vettedJobs.find(
      (job) => job.restaurantId === restaurantId && job.endDate
    );

    // Format start date
    const startDateISO = startDate instanceof Date 
      ? startDate.toISOString() 
      : new Date(startDate).toISOString();

    // Create new vetted employment entry
    const newVettedJob = {
      restaurantId,
      restaurantName,
      position: role,
      startDate: startDateISO,
      endDate: null, // Active employment
      vetted: true,
      vettedAt: serverTimestamp(),
      trackedBy: "system", // Indicates this was automatically tracked
    };

    // Update user document with new vetted employment
    await updateDoc(userRef, {
      "employment.vettedJobs": arrayUnion(newVettedJob),
      updatedAt: serverTimestamp(),
    });

    console.log(`EmploymentTracking: Tracked vetted employment for ${employeeUid} at ${restaurantName}`);
    return true;
  } catch (error) {
    console.error("EmploymentTracking: Error tracking vetted employment:", error);
    return false;
  }
}

/**
 * End vetted employment when an employee leaves a restaurant
 * 
 * @param {string} employeeUid - Employee user ID
 * @param {string} restaurantId - Restaurant ID
 * @param {Date} endDate - Employment end date (defaults to now)
 * @returns {Promise<boolean>} - True if employment was ended, false if not found
 */
export async function endVettedEmployment({
  employeeUid,
  restaurantId,
  endDate = new Date(),
}) {
  if (!employeeUid || !restaurantId) {
    console.warn("EmploymentTracking: Missing required parameters");
    return false;
  }

  try {
    const userRef = doc(db, "users", employeeUid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      console.warn(`EmploymentTracking: User document not found for ${employeeUid}`);
      return false;
    }

    const userData = userSnap.data();
    const employment = userData.employment || {};
    const vettedJobs = employment.vettedJobs || [];

    // Find the active vetted job at this restaurant
    const activeJobIndex = vettedJobs.findIndex(
      (job) => job.restaurantId === restaurantId && !job.endDate
    );

    if (activeJobIndex === -1) {
      // No active job found
      return false;
    }

    // Update the job to mark it as ended
    const updatedJobs = [...vettedJobs];
    const endDateISO = endDate instanceof Date 
      ? endDate.toISOString() 
      : new Date(endDate).toISOString();

    updatedJobs[activeJobIndex] = {
      ...updatedJobs[activeJobIndex],
      endDate: endDateISO,
    };

    // Update user document
    await updateDoc(userRef, {
      "employment.vettedJobs": updatedJobs,
      updatedAt: serverTimestamp(),
    });

    console.log(`EmploymentTracking: Ended vetted employment for ${employeeUid} at restaurant ${restaurantId}`);
    return true;
  } catch (error) {
    console.error("EmploymentTracking: Error ending vetted employment:", error);
    return false;
  }
}

/**
 * Get vetted employment history for an employee
 * 
 * @param {string} employeeUid - Employee user ID
 * @returns {Promise<Array>} - Array of vetted employment entries
 */
export async function getVettedEmployment(employeeUid) {
  if (!employeeUid) {
    return [];
  }

  try {
    const userRef = doc(db, "users", employeeUid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return [];
    }

    const userData = userSnap.data();
    const employment = userData.employment || {};
    return employment.vettedJobs || [];
  } catch (error) {
    console.error("EmploymentTracking: Error getting vetted employment:", error);
    return [];
  }
}








