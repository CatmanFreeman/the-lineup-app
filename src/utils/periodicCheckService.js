// src/utils/periodicCheckService.js

import { collection, getDocs } from "firebase/firestore";
import { db } from "../hooks/services/firebase";
import { runEmployeeAutoAwards, runDinerAutoAwards } from "./autoAwardService";

const COMPANY_ID = "company-demo";

/**
 * Periodic Check Service
 * Runs auto-award checks for all users on a schedule
 * 
 * NOTE: For production, this should be run as a Firebase Cloud Function
 * on a schedule (e.g., daily at midnight). This client-side version
 * is for development/testing purposes.
 */

/**
 * Run periodic checks for all employees at a restaurant
 */
export async function runPeriodicEmployeeChecks(restaurantId, companyId = COMPANY_ID) {
  try {
    console.log(`Running periodic employee checks for restaurant: ${restaurantId}`);
    
    const staffRef = collection(db, "restaurants", restaurantId, "staff");
    const staffSnap = await getDocs(staffRef);
    
    const checks = staffSnap.docs.map(async (doc) => {
      const staffData = doc.data();
      const userId = doc.id;
      
      try {
        await runEmployeeAutoAwards(userId, restaurantId, companyId);
        console.log(`✓ Checked employee: ${userId}`);
      } catch (error) {
        console.error(`✗ Error checking employee ${userId}:`, error);
      }
    });
    
    await Promise.all(checks);
    console.log(`Completed periodic checks for ${staffSnap.docs.length} employees`);
    
    return {
      success: true,
      checked: staffSnap.docs.length,
    };
  } catch (error) {
    console.error("Error running periodic employee checks:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Run periodic checks for all diners
 * NOTE: This is expensive and should be run server-side
 */
export async function runPeriodicDinerChecks(userIds = null) {
  try {
    console.log("Running periodic diner checks...");
    
    let usersToCheck = userIds;
    
    // If no userIds provided, get all users (expensive!)
    if (!usersToCheck) {
      const usersRef = collection(db, "users");
      const usersSnap = await getDocs(usersRef);
      usersToCheck = usersSnap.docs.map(doc => doc.id);
    }
    
    const checks = usersToCheck.map(async (userId) => {
      try {
        await runDinerAutoAwards(userId);
        console.log(`✓ Checked diner: ${userId}`);
      } catch (error) {
        console.error(`✗ Error checking diner ${userId}:`, error);
      }
    });
    
    await Promise.all(checks);
    console.log(`Completed periodic checks for ${usersToCheck.length} diners`);
    
    return {
      success: true,
      checked: usersToCheck.length,
    };
  } catch (error) {
    console.error("Error running periodic diner checks:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Run periodic checks for all restaurants in a company
 */
export async function runPeriodicCompanyChecks(companyId = COMPANY_ID) {
  try {
    console.log(`Running periodic checks for company: ${companyId}`);
    
    const restaurantsRef = collection(
      db,
      "companies",
      companyId,
      "restaurants"
    );
    const restaurantsSnap = await getDocs(restaurantsRef);
    
    const checks = restaurantsSnap.docs.map(async (doc) => {
      const restaurantId = doc.id;
      try {
        await runPeriodicEmployeeChecks(restaurantId, companyId);
        console.log(`✓ Checked restaurant: ${restaurantId}`);
      } catch (error) {
        console.error(`✗ Error checking restaurant ${restaurantId}:`, error);
      }
    });
    
    await Promise.all(checks);
    console.log(`Completed periodic checks for ${restaurantsSnap.docs.length} restaurants`);
    
    return {
      success: true,
      checked: restaurantsSnap.docs.length,
    };
  } catch (error) {
    console.error("Error running periodic company checks:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Check if periodic checks should run (based on last run time)
 * Returns true if checks should run (e.g., daily)
 */
export function shouldRunPeriodicChecks(lastRunTimestamp) {
  if (!lastRunTimestamp) return true;
  
  const lastRun = lastRunTimestamp instanceof Date 
    ? lastRunTimestamp 
    : lastRunTimestamp.toDate 
    ? lastRunTimestamp.toDate() 
    : new Date(lastRunTimestamp);
  
  const now = new Date();
  const hoursSinceLastRun = (now - lastRun) / (1000 * 60 * 60);
  
  // Run checks if it's been more than 24 hours
  return hoursSinceLastRun >= 24;
}