// src/utils/bowlingReservationService.js
//
// BOWLING RESERVATION SERVICE
//
// Handles bowling lane reservations separately from restaurant table reservations
// - Checks lane availability
// - Creates bowling reservations with shoe rentals
// - Integrates with POS system (listening only, no payment collection)

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../hooks/services/firebase";
import { createNotification, NOTIFICATION_TYPES, NOTIFICATION_PRIORITY } from "./notificationService";

/**
 * Check lane availability for a given time range
 * @param {string} restaurantId - Restaurant ID
 * @param {Date} startTime - Start time
 * @param {Date} endTime - End time
 * @param {number} partySize - Party size
 * @returns {Promise<Array>} Array of available lane numbers
 */
export async function checkLaneAvailability(restaurantId, startTime, endTime, partySize = 1) {
  try {
    // Get all lanes for the restaurant
    const lanesRef = collection(db, "restaurants", restaurantId, "bowlingLanes");
    const lanesSnap = await getDocs(lanesRef);
    const allLanes = lanesSnap.docs.map((d) => ({
      id: d.id,
      laneNumber: parseInt(d.data().laneNumber) || 0,
      status: d.data().status,
      ...d.data(),
    }));

    // Filter to lanes 1-12
    const lanes = allLanes.filter(l => l.laneNumber >= 1 && l.laneNumber <= 12);

    // Get existing reservations that overlap with the requested time
    const reservationsRef = collection(db, "restaurants", restaurantId, "bowlingReservations");
    const reservationsQuery = query(
      reservationsRef,
      where("status", "in", ["upcoming", "in_progress"])
    );
    const reservationsSnap = await getDocs(reservationsQuery);

    const conflictingReservations = reservationsSnap.docs
      .map((d) => {
        const data = d.data();
        return {
          laneId: data.laneId,
          startTime: data.startTime?.toDate ? data.startTime.toDate() : new Date(data.startTime),
          endTime: data.endTime?.toDate ? data.endTime.toDate() : new Date(data.endTime),
        };
      })
      .filter((res) => {
        // Check if reservation overlaps with requested time
        return (
          (res.startTime < endTime && res.endTime > startTime)
        );
      });

    const reservedLaneNumbers = new Set(
      conflictingReservations.map((res) => String(res.laneId))
    );

    // Return available lanes
    const availableLanes = lanes
      .filter((lane) => {
        const laneNumStr = String(lane.laneNumber);
        return (
          lane.status === "available" &&
          !reservedLaneNumbers.has(laneNumStr)
        );
      })
      .map((lane) => lane.laneNumber)
      .sort((a, b) => a - b);

    return availableLanes;
  } catch (error) {
    console.error("Error checking lane availability:", error);
    throw error;
  }
}

/**
 * Get alternative available times around a requested time
 * @param {string} restaurantId - Restaurant ID
 * @param {Date} requestedTime - Requested start time
 * @param {number} duration - Duration in minutes
 * @param {number} partySize - Party size
 * @param {number} windowMinutes - Time window to search (default 2 hours before/after)
 * @returns {Promise<Array>} Array of available time slots
 */
export async function getAlternativeLaneTimes(
  restaurantId,
  requestedTime,
  duration,
  partySize = 1,
  windowMinutes = 120
) {
  try {
    const alternatives = [];
    const slotDuration = 30; // 30-minute slots
    const startWindow = new Date(requestedTime.getTime() - windowMinutes * 60000);
    const endWindow = new Date(requestedTime.getTime() + windowMinutes * 60000);

    // Check every 30 minutes within the window
    for (let time = new Date(startWindow); time <= endWindow; time = new Date(time.getTime() + slotDuration * 60000)) {
      const slotEnd = new Date(time.getTime() + duration * 60000);
      const availableLanes = await checkLaneAvailability(restaurantId, time, slotEnd, partySize);
      
      if (availableLanes.length > 0) {
        alternatives.push({
          startTime: new Date(time),
          endTime: slotEnd,
          availableLanes: availableLanes.length,
        });
      }
    }

    return alternatives;
  } catch (error) {
    console.error("Error getting alternative times:", error);
    return [];
  }
}

/**
 * Create a bowling reservation
 * @param {Object} params
 * @param {string} params.restaurantId - Restaurant ID
 * @param {string} params.laneId - Lane number (1-12)
 * @param {Date} params.startTime - Start time
 * @param {number} params.duration - Duration in minutes
 * @param {number} params.partySize - Party size
 * @param {string} params.guestName - Guest name
 * @param {string} params.guestPhone - Guest phone
 * @param {string} params.guestEmail - Guest email (optional)
 * @param {string} params.dinerId - Diner user ID (optional)
 * @param {boolean} params.needsShoes - Whether group needs shoe rentals
 * @param {Array} params.shoeRentals - Array of {name, size} for shoe rentals
 * @param {string} params.paymentType - Payment type (cash, card, pos, other)
 * @param {string} params.notes - Additional notes
 * @returns {Promise<string>} Reservation ID
 */
export async function createBowlingReservation({
  restaurantId,
  laneId,
  startTime,
  duration,
  partySize,
  guestName,
  guestPhone,
  guestEmail = null,
  dinerId = null,
  needsShoes = false,
  shoeRentals = [],
  paymentType = "",
  notes = "",
}) {
  try {
    if (!restaurantId || !laneId || !startTime || !guestName) {
      throw new Error("Missing required fields");
    }

    const endTime = new Date(startTime.getTime() + duration * 60000);

    // Create reservation document
    const reservationRef = doc(collection(db, "restaurants", restaurantId, "bowlingReservations"));
    const reservationId = reservationRef.id;

    await setDoc(reservationRef, {
      id: reservationId,
      laneId: String(laneId),
      startTime: Timestamp.fromDate(startTime),
      endTime: Timestamp.fromDate(endTime),
      duration,
      partySize,
      guestName,
      guestPhone,
      guestEmail,
      dinerId,
      needsShoes,
      shoeRentals: needsShoes ? shoeRentals : [],
      paymentType,
      notes,
      status: "upcoming",
      type: "bowling", // Distinguish from table reservations
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Update lane status
    const laneRef = doc(db, "restaurants", restaurantId, "bowlingLanes", String(laneId));
    await updateDoc(laneRef, {
      status: "reserved",
      currentReservationId: reservationId,
      updatedAt: serverTimestamp(),
    });

    // Notify restaurant
    await createNotification({
      userId: null, // Will notify restaurant admins
      restaurantId,
      type: NOTIFICATION_TYPES.BOWLING_RESERVATION,
      priority: NOTIFICATION_PRIORITY.MEDIUM,
      title: "New Bowling Reservation",
      message: `${guestName} - Lane ${laneId} at ${startTime.toLocaleTimeString()}`,
      actionUrl: `/restaurant/${restaurantId}?tab=bowling`,
      metadata: {
        reservationId,
        laneId,
        guestName,
        startTime: startTime.toISOString(),
      },
    });

    return reservationId;
  } catch (error) {
    console.error("Error creating bowling reservation:", error);
    throw error;
  }
}

/**
 * Get bowling reservations for a restaurant
 * @param {string} restaurantId - Restaurant ID
 * @param {Date} startDate - Start date (optional)
 * @param {Date} endDate - End date (optional)
 * @returns {Promise<Array>} Array of reservations
 */
export async function getBowlingReservations(restaurantId, startDate = null, endDate = null) {
  try {
    const reservationsRef = collection(db, "restaurants", restaurantId, "bowlingReservations");
    let reservationsQuery = query(reservationsRef, orderBy("startTime", "asc"));

    if (startDate && endDate) {
      reservationsQuery = query(
        reservationsRef,
        where("startTime", ">=", Timestamp.fromDate(startDate)),
        where("startTime", "<=", Timestamp.fromDate(endDate)),
        orderBy("startTime", "asc")
      );
    }

    const snap = await getDocs(reservationsQuery);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      startTime: d.data().startTime?.toDate ? d.data().startTime.toDate() : new Date(d.data().startTime),
      endTime: d.data().endTime?.toDate ? d.data().endTime.toDate() : new Date(d.data().endTime),
    }));
  } catch (error) {
    console.error("Error getting bowling reservations:", error);
    return [];
  }
}

