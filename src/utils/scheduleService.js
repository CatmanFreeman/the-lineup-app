// src/utils/scheduleService.js

import { doc, getDoc } from "firebase/firestore";
import { db } from "../hooks/services/firebase";

/**
 * Slot definitions (must match SchedulingTab.jsx)
 */
const SLOT_DEFS = [
  { id: "foh-host", label: "Host", side: "foh", startTime: "10:00", endTime: "18:00", hours: 8 },
  { id: "foh-server-1", label: "Server 1", side: "foh", startTime: "11:00", endTime: "19:00", hours: 8 },
  { id: "foh-server-2", label: "Server 2", side: "foh", startTime: "11:00", endTime: "19:00", hours: 8 },
  { id: "foh-bartender", label: "Bartender", side: "foh", startTime: "16:00", endTime: "00:00", hours: 8 },
  { id: "boh-grill", label: "Grill", side: "boh", startTime: "10:00", endTime: "18:00", hours: 8 },
  { id: "boh-fry", label: "Fry", side: "boh", startTime: "11:00", endTime: "19:00", hours: 8 },
  { id: "boh-saute", label: "Saute", side: "boh", startTime: "11:00", endTime: "19:00", hours: 8 },
  { id: "boh-salad", label: "Salad", side: "boh", startTime: "10:00", endTime: "18:00", hours: 8 },
];

/**
 * Get employee's scheduled shift end time for today
 * @param {string} employeeUid - Employee UID
 * @param {string} restaurantId - Restaurant ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Date|null>} - Scheduled end time or null if not scheduled
 */
export async function getScheduledShiftEndTime(employeeUid, restaurantId, companyId = "company-demo") {
  try {
    const today = new Date();
    const todayISO = today.toISOString().split('T')[0];
    
    // Get week ending date (nearest Sunday)
    const dayOfWeek = today.getDay();
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const weekEndingDate = new Date(today);
    weekEndingDate.setDate(today.getDate() + daysUntilSunday);
    const weekEndingISO = weekEndingDate.toISOString().split('T')[0];
    
    // Load schedule for this week
    const scheduleRef = doc(
      db,
      "companies",
      companyId,
      "restaurants",
      restaurantId,
      "schedules",
      weekEndingISO
    );
    
    const scheduleSnap = await getDoc(scheduleRef);
    if (!scheduleSnap.exists()) return null;
    
    const scheduleData = scheduleSnap.data();
    const status = scheduleData.status || "draft";
    
    // Only check published schedules
    if (status !== "published") return null;
    
    const days = scheduleData.days || {};
    const todaySchedule = days[todayISO];
    
    if (!todaySchedule || !todaySchedule.slots) return null;
    
    // Find the slot where this employee is scheduled
    const slots = todaySchedule.slots;
    
    // Find which slot this employee is assigned to
    for (const [slotId, assignedUid] of Object.entries(slots)) {
      if (assignedUid === employeeUid) {
        const slotDef = SLOT_DEFS.find(s => s.id === slotId);
        if (slotDef && slotDef.endTime) {
          // Parse end time (e.g., "19:00" or "00:00" -> Date object for today at that time)
          const [hours, minutes] = slotDef.endTime.split(':').map(Number);
          const endTime = new Date(today);
          
          // Handle midnight (00:00) - it means next day
          if (hours === 0 && minutes === 0) {
            endTime.setDate(today.getDate() + 1);
            endTime.setHours(0, 0, 0, 0);
          } else {
            endTime.setHours(hours, minutes, 0, 0);
          }
          
          return endTime;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error getting scheduled shift end time:", error);
    return null;
  }
}

/**
 * Check if punch out time is within acceptable range of scheduled end time
 * @param {Date} punchOutTime - Actual punch out time
 * @param {Date} scheduledEndTime - Scheduled shift end time
 * @param {number} graceMinutes - Grace period in minutes (default: 15)
 * @returns {boolean} - True if punched out on time
 */
export function isPunchOutOnTime(punchOutTime, scheduledEndTime, graceMinutes = 15) {
  if (!punchOutTime || !scheduledEndTime) return false;
  
  const graceMs = graceMinutes * 60 * 1000;
  const maxAllowedTime = scheduledEndTime.getTime() + graceMs;
  
  return punchOutTime.getTime() <= maxAllowedTime;
}