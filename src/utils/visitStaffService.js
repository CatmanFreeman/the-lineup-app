// src/utils/visitStaffService.js

import { collection, getDocs, doc, getDoc, query, where } from "firebase/firestore";
import { db } from "../hooks/services/firebase";

/**
 * Visit Staff Service
 * 
 * Gets staff members who were working during a restaurant visit
 * - Server (from visit data or order)
 * - Hostess (from schedule)
 * - BOH employees by station (from schedule)
 */

/**
 * Get staff working during a visit
 * @param {string} restaurantId - Restaurant ID
 * @param {Date} visitDate - Date/time of the visit
 * @param {string} serverId - Optional server ID (if known)
 * @returns {Promise<Object>} Staff members organized by role
 */
export async function getStaffDuringVisit(restaurantId, visitDate, serverId = null) {
  try {
    const staff = {
      server: null,
      hostess: [],
      boh: [],
      all: [],
    };

    // Load all staff
    const staffRef = collection(db, "restaurants", restaurantId, "staff");
    const staffSnap = await getDocs(staffRef);
    
    const allStaff = [];
    staffSnap.forEach((docSnap) => {
      const data = docSnap.data();
      allStaff.push({
        id: docSnap.id,
        uid: data.uid || docSnap.id,
        name: data.name,
        role: data.role,
        subRole: data.subRole,
        station: data.station,
        stations: data.stations || [],
        imageURL: data.imageURL || null,
      });
    });

    // Get server if provided
    if (serverId) {
      staff.server = allStaff.find((s) => 
        (s.id === serverId || s.uid === serverId) && 
        s.role === "Front of House" &&
        (s.subRole?.toLowerCase().includes("server") || 
         s.subRole?.toLowerCase().includes("waiter") ||
         s.subRole?.toLowerCase().includes("waitress"))
      ) || null;
    }

    // Get hostess
    staff.hostess = allStaff.filter((s) => 
      s.role === "Front of House" &&
      (s.subRole?.toLowerCase().includes("host") ||
       s.subRole?.toLowerCase().includes("hostess"))
    );

    // Get BOH employees
    staff.boh = allStaff.filter((s) => s.role === "Back of House");

    // TODO: Filter by who was actually working during visit time
    // This would require checking the published schedule for that date/time
    // For now, return all staff - can be enhanced later

    staff.all = allStaff;

    return staff;
  } catch (error) {
    console.error("Error getting staff during visit:", error);
    return {
      server: null,
      hostess: [],
      boh: [],
      all: [],
    };
  }
}

/**
 * Get BOH employees for a specific station
 * @param {Array} bohStaff - Array of BOH staff
 * @param {string} station - Station name (e.g., "grill", "fry")
 * @returns {Array} Employees working at that station
 */
export function getBohEmployeesForStation(bohStaff, station) {
  if (!station || !bohStaff) return [];
  
  return bohStaff.filter((emp) => 
    emp.station === station || 
    (emp.stations && emp.stations.includes(station))
  );
}

/**
 * Get employees working at a specific time from schedule
 * @param {string} restaurantId - Restaurant ID
 * @param {Date} visitDate - Date/time of visit
 * @returns {Promise<Array>} Array of employee IDs who were working
 */
export async function getEmployeesFromSchedule(restaurantId, visitDate) {
  try {
    // Get the week ending date for the visit
    const visitDay = new Date(visitDate);
    const dayOfWeek = visitDay.getDay(); // 0 = Sunday
    const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const weekEnding = new Date(visitDay);
    weekEnding.setDate(visitDay.getDate() + daysToSunday);
    const weekEndingISO = weekEnding.toISOString().split('T')[0].replace(/-/g, '');

    // Load published schedule for that week
    const scheduleRef = doc(
      db,
      "restaurants",
      restaurantId,
      "schedules",
      weekEndingISO
    );
    const scheduleSnap = await getDoc(scheduleRef);

    if (!scheduleSnap.exists()) {
      return [];
    }

    const scheduleData = scheduleSnap.data();
    if (scheduleData.status !== "published") {
      return [];
    }

    // Get the day of the visit
    const visitDateISO = visitDay.toISOString().split('T')[0];
    const daySchedule = scheduleData.days?.[visitDateISO];

    if (!daySchedule || !daySchedule.slots) {
      return [];
    }

    // Extract employee UIDs from slots
    const employeeIds = new Set();
    Object.values(daySchedule.slots).forEach((uid) => {
      if (uid) employeeIds.add(uid);
    });

    return Array.from(employeeIds);
  } catch (error) {
    console.error("Error getting employees from schedule:", error);
    return [];
  }
}

