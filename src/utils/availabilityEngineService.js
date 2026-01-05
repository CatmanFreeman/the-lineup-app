// src/utils/availabilityEngineService.js
//
// AVAILABILITY ENGINE MVP
//
// Core Principle: Availability is computed, not declared.
// Static slot systems lie. Lineup computes truth from load.
//
// Features:
// - 15-minute slot generation
// - Load mapping from ledger
// - Capacity caps (protect kitchen)
// - Slot scoring and tiering
// - Confidence levels

import { getReservationsInWindow } from "./reservationLedgerService";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../hooks/services/firebase";

/**
 * Slot Tiers
 */
export const SLOT_TIER = {
  RECOMMENDED: "RECOMMENDED", // Best option
  AVAILABLE: "AVAILABLE",     // Available but not ideal
  FLEXIBLE: "FLEXIBLE",       // Available with flexibility needed
};

/**
 * Confidence Levels
 */
export const CONFIDENCE = {
  HIGH: "HIGH",
  MED: "MED",
  LOW: "LOW",
};

/**
 * Compute availability for a restaurant on a given date
 * 
 * @param {Object} params
 * @param {string} params.restaurantId - Restaurant ID
 * @param {Date|string} params.date - Date to check availability
 * @param {Object} params.restaurantData - Restaurant data (hours, capacity, etc.)
 * @param {Object} params.options - Options
 * @param {number} params.options.maxCoversPer15Min - Override capacity cap (default: floor(totalSeats * 0.35))
 * @param {number} params.options.avgDiningDuration - Average dining duration in minutes (default: 90)
 * @returns {Promise<Array>} Array of available slots
 */
export async function computeAvailability({
  restaurantId,
  date,
  restaurantData,
  options = {},
}) {
  try {
    // Parse date
    const targetDate = date instanceof Date ? date : new Date(date);
    const dateISO = targetDate.toISOString().split("T")[0];

    // Get restaurant configuration
    const totalSeats = restaurantData.totalSeats || restaurantData.capacity || 50;
    const maxCoversPer15Min = options.maxCoversPer15Min || Math.floor(totalSeats * 0.35);
    const avgDiningDuration = options.avgDiningDuration || 90; // 90 minutes default

    // Get service hours for this date
    const serviceHours = await getServiceHoursForDate(restaurantId, targetDate, restaurantData);
    if (!serviceHours || !serviceHours.open || !serviceHours.close) {
      return []; // No service hours, no availability
    }

    // Generate 15-minute slots within service hours
    const slots = generateSlots({
      date: targetDate,
      openTime: serviceHours.open,
      closeTime: serviceHours.close,
      avgDiningDuration,
    });

    // Get all reservations for this date
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const reservations = await getReservationsInWindow({
      restaurantId,
      startDate: startOfDay.toISOString(),
      endDate: endOfDay.toISOString(),
    });

    // Filter out cancelled and completed
    const activeReservations = reservations.filter(
      (r) => r.status !== "CANCELLED" && r.status !== "COMPLETED" && r.status !== "NO_SHOW"
    );

    // Build load map
    const loadMap = buildLoadMap({
      slots,
      reservations: activeReservations,
      avgDiningDuration,
    });

    // Score and tier slots
    const scoredSlots = scoreSlots({
      slots,
      loadMap,
      maxCoversPer15Min,
      totalSeats,
      avgDiningDuration,
    });

    return scoredSlots;
  } catch (error) {
    console.error("Error computing availability:", error);
    throw error;
  }
}

/**
 * Generate 15-minute slots within service hours
 * 
 * @param {Object} params
 * @param {Date} params.date - Target date
 * @param {string} params.openTime - Opening time (HH:MM format)
 * @param {string} params.closeTime - Closing time (HH:MM format)
 * @param {number} params.avgDiningDuration - Average dining duration in minutes
 * @returns {Array} Array of slot objects
 */
function generateSlots({ date, openTime, closeTime, avgDiningDuration }) {
  const slots = [];

  // Parse open/close times
  const [openHour, openMin] = openTime.split(":").map(Number);
  const [closeHour, closeMin] = closeTime.split(":").map(Number);

  // Create date objects for open/close
  const openDateTime = new Date(date);
  openDateTime.setHours(openHour, openMin, 0, 0);

  const closeDateTime = new Date(date);
  closeDateTime.setHours(closeHour, closeMin, 0, 0);

  // Adjust close time to account for dining duration
  // Last reservation should be able to finish before closing
  const lastSlotTime = new Date(closeDateTime.getTime() - avgDiningDuration * 60 * 1000);

  // Generate 15-minute slots
  let currentSlot = new Date(openDateTime);
  while (currentSlot <= lastSlotTime) {
    const slotEnd = new Date(currentSlot.getTime() + 15 * 60 * 1000);

    slots.push({
      startAt: new Date(currentSlot),
      endAt: slotEnd,
      startAtISO: currentSlot.toISOString(),
      covers: 0, // Will be populated by load map
      loadPercentage: 0, // Will be populated by scoring
    });

    // Move to next 15-minute slot
    currentSlot = new Date(currentSlot.getTime() + 15 * 60 * 1000);
  }

  return slots;
}

/**
 * Build load map from reservations
 * 
 * For each slot, count how many covers are "active" during that slot.
 * A reservation covers a slot if:
 * - Reservation starts during the slot, OR
 * - Reservation started before but is still active (within dining duration)
 * 
 * @param {Object} params
 * @param {Array} params.slots - Generated slots
 * @param {Array} params.reservations - Active reservations
 * @param {number} params.avgDiningDuration - Average dining duration in minutes
 * @returns {Map} Load map (slot index -> covers count)
 */
function buildLoadMap({ slots, reservations, avgDiningDuration }) {
  const loadMap = new Map();

  // Initialize all slots to 0
  slots.forEach((slot, index) => {
    loadMap.set(index, 0);
  });

  // For each reservation, add its covers to all slots it covers
  reservations.forEach((reservation) => {
    const reservationStart = new Date(reservation.startAt);
    const reservationEnd = new Date(reservationStart.getTime() + avgDiningDuration * 60 * 1000);
    const partySize = reservation.partySize || 1;

    // Find all slots this reservation covers
    slots.forEach((slot, index) => {
      const slotStart = new Date(slot.startAt);
      const slotEnd = new Date(slot.endAt);

      // Reservation covers this slot if:
      // - Reservation starts during slot, OR
      // - Reservation started before slot but is still active during slot
      const coversSlot =
        (reservationStart >= slotStart && reservationStart < slotEnd) ||
        (reservationStart < slotStart && reservationEnd > slotStart);

      if (coversSlot) {
        const currentLoad = loadMap.get(index) || 0;
        loadMap.set(index, currentLoad + partySize);
      }
    });
  });

  return loadMap;
}

/**
 * Score and tier slots
 * 
 * @param {Object} params
 * @param {Array} params.slots - Generated slots
 * @param {Map} params.loadMap - Load map
 * @param {number} params.maxCoversPer15Min - Maximum covers per 15-minute slot
 * @param {number} params.totalSeats - Total restaurant capacity
 * @param {number} params.avgDiningDuration - Average dining duration
 * @returns {Array} Scored and tiered slots
 */
function scoreSlots({ slots, loadMap, maxCoversPer15Min, totalSeats, avgDiningDuration }) {
  const now = new Date();
  const scoredSlots = [];

  slots.forEach((slot, index) => {
    const covers = loadMap.get(index) || 0;
    const availableCovers = maxCoversPer15Min - covers;
    const loadPercentage = (covers / maxCoversPer15Min) * 100;
    const utilizationPercentage = (covers / totalSeats) * 100;

    // Calculate time until slot
    const minutesUntil = (slot.startAt - now) / (1000 * 60);

    // Determine tier
    let tier = SLOT_TIER.AVAILABLE;
    let confidence = CONFIDENCE.MED;

    if (availableCovers <= 0) {
      // Over capacity - not available
      return; // Skip this slot
    } else if (availableCovers >= maxCoversPer15Min * 0.5 && loadPercentage < 50) {
      // Plenty of capacity, low load
      tier = SLOT_TIER.RECOMMENDED;
      confidence = CONFIDENCE.HIGH;
    } else if (availableCovers >= maxCoversPer15Min * 0.3 && loadPercentage < 70) {
      // Good capacity, moderate load
      tier = SLOT_TIER.AVAILABLE;
      confidence = minutesUntil > 120 ? CONFIDENCE.HIGH : CONFIDENCE.MED;
    } else {
      // Limited capacity or high load
      tier = SLOT_TIER.FLEXIBLE;
      confidence = minutesUntil > 60 ? CONFIDENCE.MED : CONFIDENCE.LOW;
    }

    // Adjust confidence for same-day bookings
    if (minutesUntil < 120) {
      // Same-day booking - lower confidence
      if (confidence === CONFIDENCE.HIGH) {
        confidence = CONFIDENCE.MED;
      } else if (confidence === CONFIDENCE.MED) {
        confidence = CONFIDENCE.LOW;
      }
    }

    // Adjust for very early or very late slots
    const slotHour = slot.startAt.getHours();
    if (slotHour < 11 || slotHour > 21) {
      // Early morning or late night - lower confidence
      if (confidence === CONFIDENCE.HIGH) {
        confidence = CONFIDENCE.MED;
      }
    }

    scoredSlots.push({
      ...slot,
      covers,
      availableCovers,
      loadPercentage: Math.round(loadPercentage * 10) / 10,
      utilizationPercentage: Math.round(utilizationPercentage * 10) / 10,
      tier,
      confidence,
      minutesUntil: Math.round(minutesUntil),
      // Additional metadata
      metadata: {
        maxCoversPerSlot: maxCoversPer15Min,
        totalSeats,
        avgDiningDuration,
      },
    });
  });

  // Sort by tier (RECOMMENDED first), then by time
  scoredSlots.sort((a, b) => {
    const tierOrder = {
      [SLOT_TIER.RECOMMENDED]: 0,
      [SLOT_TIER.AVAILABLE]: 1,
      [SLOT_TIER.FLEXIBLE]: 2,
    };

    if (tierOrder[a.tier] !== tierOrder[b.tier]) {
      return tierOrder[a.tier] - tierOrder[b.tier];
    }

    return a.startAt - b.startAt;
  });

  return scoredSlots;
}

/**
 * Get service hours for a specific date
 * 
 * @param {string} restaurantId
 * @param {Date} date
 * @param {Object} restaurantData
 * @returns {Promise<Object>} { open: "HH:MM", close: "HH:MM" }
 */
async function getServiceHoursForDate(restaurantId, date, restaurantData) {
  try {
    // First, try to get from restaurantData if provided
    if (restaurantData) {
      // Check for hoursOfOperation (new format from SignupCompany)
      if (restaurantData.hoursOfOperation) {
        const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const dayName = dayNames[dayOfWeek];

        const dayHours = restaurantData.hoursOfOperation[dayName];
        if (dayHours && dayHours.openTime && dayHours.closeTime) {
          // Convert from 12-hour format to 24-hour format
          const open = convertTo24Hour(dayHours.openTime, dayHours.openMeridiem || "AM");
          const close = convertTo24Hour(dayHours.closeTime, dayHours.closeMeridiem || "PM");
          return { open, close };
        }
      }

      // Check for legacy hours format
      if (restaurantData.hours) {
        const dayOfWeek = date.getDay();
        const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        const dayName = dayNames[dayOfWeek];

        const dayHours = restaurantData.hours[dayName];
        if (dayHours && dayHours.open && dayHours.close) {
          return {
            open: dayHours.open,
            close: dayHours.close,
          };
        }
      }
    }

    // Try to fetch from Firestore if restaurantData not provided
    try {
      const restaurantRef = doc(db, "restaurants", restaurantId);
      const restaurantSnap = await getDoc(restaurantRef);
      if (restaurantSnap.exists()) {
        const data = restaurantSnap.data();
        const dayOfWeek = date.getDay();
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const dayName = dayNames[dayOfWeek];

        if (data.hoursOfOperation && data.hoursOfOperation[dayName]) {
          const dayHours = data.hoursOfOperation[dayName];
          if (dayHours.openTime && dayHours.closeTime) {
            const open = convertTo24Hour(dayHours.openTime, dayHours.openMeridiem || "AM");
            const close = convertTo24Hour(dayHours.closeTime, dayHours.closeMeridiem || "PM");
            return { open, close };
          }
        }
      }
    } catch (err) {
      console.warn("Could not fetch restaurant hours from Firestore:", err);
    }

    // Default fallback
    return {
      open: "11:00",
      close: "22:00",
    };
  } catch (error) {
    console.error("Error getting service hours:", error);
    // Default fallback
    return {
      open: "11:00",
      close: "22:00",
    };
  }
}

/**
 * Convert 12-hour time to 24-hour format
 * 
 * @param {string} time - Time string (e.g., "11:30")
 * @param {string} meridiem - "AM" or "PM"
 * @returns {string} 24-hour format (e.g., "11:30")
 */
function convertTo24Hour(time, meridiem) {
  if (!time) return "11:00";
  
  const [hours, minutes = "00"] = time.split(":");
  let hour24 = parseInt(hours, 10);

  if (meridiem === "PM" && hour24 !== 12) {
    hour24 += 12;
  } else if (meridiem === "AM" && hour24 === 12) {
    hour24 = 0;
  }

  return `${hour24.toString().padStart(2, "0")}:${minutes.padStart(2, "0")}`;
}

/**
 * Get availability for a date range
 * 
 * @param {Object} params
 * @param {string} params.restaurantId
 * @param {Date|string} params.startDate
 * @param {Date|string} params.endDate
 * @param {Object} params.restaurantData
 * @param {Object} params.options
 * @returns {Promise<Object>} Map of date -> slots
 */
export async function getAvailabilityForDateRange({
  restaurantId,
  startDate,
  endDate,
  restaurantData,
  options = {},
}) {
  try {
    const start = startDate instanceof Date ? startDate : new Date(startDate);
    const end = endDate instanceof Date ? endDate : new Date(endDate);

    const availabilityMap = {};

    // Iterate through each date
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dateISO = currentDate.toISOString().split("T")[0];
      const slots = await computeAvailability({
        restaurantId,
        date: new Date(currentDate),
        restaurantData,
        options,
      });

      availabilityMap[dateISO] = slots;

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return availabilityMap;
  } catch (error) {
    console.error("Error getting availability for date range:", error);
    throw error;
  }
}

/**
 * Check if a specific time slot is available
 * 
 * @param {Object} params
 * @param {string} params.restaurantId
 * @param {Date|string} params.requestedTime - Requested reservation time
 * @param {number} params.partySize - Party size
 * @param {Object} params.restaurantData
 * @param {Object} params.options
 * @returns {Promise<Object>} { available: boolean, slot: Object, reason: string }
 */
export async function checkSlotAvailability({
  restaurantId,
  requestedTime,
  partySize,
  restaurantData,
  options = {},
}) {
  try {
    const requestedDate = requestedTime instanceof Date ? requestedTime : new Date(requestedTime);
    const dateISO = requestedDate.toISOString().split("T")[0];

    // Get all slots for this date
    const slots = await computeAvailability({
      restaurantId,
      date: requestedDate,
      restaurantData,
      options,
    });

    // Find the slot that contains the requested time
    const requestedSlot = slots.find((slot) => {
      const slotStart = new Date(slot.startAt);
      const slotEnd = new Date(slot.endAt);
      return requestedDate >= slotStart && requestedDate < slotEnd;
    });

    if (!requestedSlot) {
      return {
        available: false,
        slot: null,
        reason: "Time slot not within service hours",
      };
    }

    // Check if party size fits
    if (requestedSlot.availableCovers < partySize) {
      return {
        available: false,
        slot: requestedSlot,
        reason: `Only ${requestedSlot.availableCovers} covers available, need ${partySize}`,
      };
    }

    return {
      available: true,
      slot: requestedSlot,
      reason: null,
    };
  } catch (error) {
    console.error("Error checking slot availability:", error);
    throw error;
  }
}

