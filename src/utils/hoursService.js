// src/utils/hoursService.js

import {
    collection,
    doc,
    getDocs,
    query,
    where,
    orderBy,
    Timestamp,
  } from "firebase/firestore";
  import { db } from "../hooks/services/firebase";
  
  /**
   * Hours Service
   * Calculates hours worked from attendance/shift records
   */
  
  /**
   * Get weekly hours worked for an employee
   * 
   * Note: This assumes shift records are stored at:
   * restaurants/{restaurantId}/shifts/{shiftId}
   * OR
   * users/{employeeId}/shifts/{shiftId}
   * 
   * Each shift should have:
   * - punchedInAt: Timestamp
   * - punchedOutAt: Timestamp
   * - hours: number (calculated)
   */
  export async function getEmployeeWeeklyHours(employeeId, restaurantId, weekEndingISO) {
    try {
      // Calculate week start (Sunday) and end (Saturday)
      const weekEnd = new Date(weekEndingISO);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6); // Go back 6 days
      
      // Try path 1: restaurants/{restaurantId}/shifts
      const shiftsRef1 = collection(db, "restaurants", restaurantId, "shifts");
      const q1 = query(
        shiftsRef1,
        where("employeeId", "==", employeeId),
        where("punchedOutAt", ">=", Timestamp.fromDate(weekStart)),
        where("punchedOutAt", "<=", Timestamp.fromDate(weekEnd)),
        orderBy("punchedOutAt", "desc")
      );
      
      let totalHours = 0;
      let shiftCount = 0;
      
      try {
        const snap1 = await getDocs(q1);
        snap1.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.hours) {
            totalHours += data.hours;
            shiftCount++;
          } else if (data.punchedInAt && data.punchedOutAt) {
            // Calculate hours from timestamps
            const inTime = data.punchedInAt.toDate();
            const outTime = data.punchedOutAt.toDate();
            const hours = (outTime - inTime) / (1000 * 60 * 60);
            totalHours += hours;
            shiftCount++;
          }
        });
      } catch (err) {
        console.warn("Could not load shifts from restaurants path:", err);
      }
      
      // If no shifts found, log warning
      if (shiftCount === 0) {
        // Note: This only gets the current/latest attendance record
        // For accurate weekly totals, we need historical shift records
        // This is a fallback that may not be accurate
        console.warn("No shift records found. Weekly hours may be inaccurate.");
      }
      
      return {
        totalHours: Math.round(totalHours * 100) / 100, // Round to 2 decimals
        shiftCount,
        weekStart: weekStart.toISOString().split("T")[0],
        weekEnd: weekEnd.toISOString().split("T")[0],
      };
    } catch (error) {
      console.error("Error calculating weekly hours:", error);
      return {
        totalHours: 0,
        shiftCount: 0,
        weekStart: null,
        weekEnd: null,
      };
    }
  }
  
  /**
   * Helper: Get week ending ISO date (Sunday)
   */
  export function getWeekEndingISO(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day; // Get to Sunday
    const sunday = new Date(d.setDate(diff));
    sunday.setHours(23, 59, 59, 999);
    return sunday.toISOString().split("T")[0];
  }