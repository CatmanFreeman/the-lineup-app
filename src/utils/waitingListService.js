// src/utils/waitingListService.js
//
// WAITING LIST SERVICE
//
// The waitingList is an operational materialization of reservations
// within the next 24 hours. It is:
// - Mutable (hosts can reorder)
// - Ephemeral (not historical truth)
// - Optimized for speed and clarity
// - Only contains reservations within 24h window
//
// Path: restaurants/{restaurantId}/waitingList/{entryId}

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
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../hooks/services/firebase";
import { getReservationsInWindow } from "./reservationLedgerService";

/**
 * Materialize waitingList from ledger
 * 
 * This should be called periodically (e.g., every 5-10 minutes)
 * to keep waitingList in sync with ledger.
 * 
 * Only includes reservations within next 24 hours.
 * 
 * @param {string} restaurantId
 */
export async function materializeWaitingList(restaurantId) {
  try {
    const now = new Date();
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Get all reservations in next 24 hours
    const reservations = await getReservationsInWindow({
      restaurantId,
      startDate: now.toISOString(),
      endDate: twentyFourHoursFromNow.toISOString(),
    });

    // Filter out cancelled and completed
    const activeReservations = reservations.filter(
      (r) => r.status !== "CANCELLED" && r.status !== "COMPLETED"
    );

    const waitingListRef = collection(db, "restaurants", restaurantId, "waitingList");

    // Get existing waitingList entries
    const existingSnap = await getDocs(waitingListRef);
    const existingEntries = new Map();
    existingSnap.docs.forEach((d) => {
      existingEntries.set(d.data().reservationId, d.id);
    });

    // Materialize each reservation
    for (const reservation of activeReservations) {
      const entryId = existingEntries.get(reservation.id) || `wl_${reservation.id}`;
      const entryRef = doc(waitingListRef, entryId);

      // Calculate priority score (lower = higher priority)
      const priorityScore = calculatePriorityScore(reservation);

      await setDoc(
        entryRef,
        {
          reservationId: reservation.id,
          startAt: reservation.startAt,
          startAtTimestamp: reservation.startAtTimestamp,
          partySize: reservation.partySize,
          dinerName: reservation.dinerName || "Guest",
          phone: reservation.phone,
          status: reservation.status,
          isCheckedIn: reservation.status === "CHECKED_IN",
          priorityScore,
          externallySeated: false, // Set by POS events
          source: reservation.source,
          // Timestamps
          materializedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          // Host overrides
          hostOverride: null,
          hostNotes: null,
        },
        { merge: true }
      );
    }

    // Remove entries that are no longer in the 24h window or are cancelled/completed
    const activeReservationIds = new Set(activeReservations.map((r) => r.id));
    for (const [reservationId, entryId] of existingEntries.entries()) {
      if (!activeReservationIds.has(reservationId)) {
        const entryRef = doc(waitingListRef, entryId);
        await deleteDoc(entryRef);
      }
    }

    return activeReservations.length;
  } catch (error) {
    console.error("Error materializing waitingList:", error);
    throw error;
  }
}

/**
 * Calculate priority score for waitingList ordering
 * 
 * Lower score = higher priority
 * 
 * Factors:
 * - Reservation time (earlier = higher priority)
 * - Party size (larger = slightly higher priority)
 * - Status (checked in = higher priority)
 * 
 * @param {Object} reservation
 * @returns {number}
 */
function calculatePriorityScore(reservation) {
  const startTime = reservation.startAtTimestamp?.toDate?.() || new Date(reservation.startAt);
  const now = new Date();
  
  // Base score: minutes until reservation time
  const minutesUntil = (startTime - now) / (1000 * 60);
  
  // Adjust for status
  let statusMultiplier = 1.0;
  if (reservation.status === "CHECKED_IN") {
    statusMultiplier = 0.5; // Checked-in guests get priority
  } else if (reservation.status === "SEATED") {
    statusMultiplier = 2.0; // Already seated, lower priority
  }
  
  // Adjust for party size (larger parties slightly higher priority)
  const partySizeAdjustment = reservation.partySize * 0.1;
  
  return (minutesUntil * statusMultiplier) - partySizeAdjustment;
}

/**
 * Get waitingList for a restaurant
 * 
 * @param {string} restaurantId
 * @param {Object} options
 * @param {boolean} options.includeSeated - Include already-seated reservations
 * @returns {Promise<Array>}
 */
export async function getWaitingList(restaurantId, options = {}) {
  try {
    const { includeSeated = false } = options;
    
    const waitingListRef = collection(db, "restaurants", restaurantId, "waitingList");
    
    let q = query(waitingListRef, orderBy("priorityScore", "asc"));
    
    if (!includeSeated) {
      q = query(q, where("status", "!=", "SEATED"));
    }
    
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
  } catch (error) {
    console.error("Error getting waitingList:", error);
    throw error;
  }
}

/**
 * Update waitingList entry (host override)
 * 
 * Hosts can reorder or add notes to waitingList entries
 * 
 * @param {string} restaurantId
 * @param {string} entryId
 * @param {Object} updates
 * @param {number} updates.priorityScore - Override priority score
 * @param {string} updates.hostNotes - Host notes
 * @param {string} updates.hostOverride - Override reason
 */
export async function updateWaitingListEntry({
  restaurantId,
  entryId,
  priorityScore = null,
  hostNotes = null,
  hostOverride = null,
}) {
  try {
    const entryRef = doc(
      db,
      "restaurants",
      restaurantId,
      "waitingList",
      entryId
    );

    const updates = {
      updatedAt: serverTimestamp(),
    };

    if (priorityScore !== null) {
      updates.priorityScore = priorityScore;
    }

    if (hostNotes !== null) {
      updates.hostNotes = hostNotes;
    }

    if (hostOverride !== null) {
      updates.hostOverride = hostOverride;
      updates.hostOverrideAt = serverTimestamp();
    }

    await updateDoc(entryRef, updates);
  } catch (error) {
    console.error("Error updating waitingList entry:", error);
    throw error;
  }
}

/**
 * Mark reservation as checked in (updates both ledger and waitingList)
 * 
 * @param {string} restaurantId
 * @param {string} reservationId
 * @param {Object} options
 * @param {boolean} options.isValetParking - If guest is using valet
 * @param {string} options.dinerId - Diner ID (for valet entry)
 * @param {string} options.dinerName - Diner name (for valet entry)
 * @param {string} options.dinerPhone - Diner phone (for valet entry)
 */
export async function checkInReservation(restaurantId, reservationId, options = {}) {
  try {
    // Update ledger
    const { updateReservationStatus } = await import("./reservationLedgerService");
    await updateReservationStatus({
      restaurantId,
      reservationId,
      newStatus: "CHECKED_IN",
      source: "HOST_CHECK_IN",
    });

    // Update waitingList
    const waitingListRef = collection(db, "restaurants", restaurantId, "waitingList");
    const entryQuery = query(waitingListRef, where("reservationId", "==", reservationId));
    const entrySnap = await getDocs(entryQuery);
    
    if (!entrySnap.empty) {
      const entryDoc = entrySnap.docs[0];
      await updateDoc(entryDoc.ref, {
        isCheckedIn: true,
        status: "CHECKED_IN",
        updatedAt: serverTimestamp(),
      });
    }

    // If valet parking, create valet entry
    if (options.isValetParking && options.dinerId) {
      try {
        const { createValetEntryOnCheckIn } = await import("./valetService");
        await createValetEntryOnCheckIn({
          restaurantId,
          reservationId,
          dinerId: options.dinerId,
          dinerName: options.dinerName || "Guest",
          dinerPhone: options.dinerPhone || null,
        });
      } catch (valetError) {
        console.error("Error creating valet entry on check-in:", valetError);
        // Don't fail check-in if valet entry fails
      }
    }
  } catch (error) {
    console.error("Error checking in reservation:", error);
    throw error;
  }
}

/**
 * Mark reservation as seated (updates both ledger and waitingList)
 * 
 * @param {string} restaurantId
 * @param {string} reservationId
 * @param {string} tableId - Optional table ID
 */
export async function seatReservation(restaurantId, reservationId, tableId = null) {
  try {
    // Update ledger
    const { updateReservationStatus } = await import("./reservationLedgerService");
    await updateReservationStatus({
      restaurantId,
      reservationId,
      newStatus: "SEATED",
      source: "HOST_SEATED",
      metadata: {
        tableId,
        seatedAt: new Date().toISOString(),
      },
    });

    // Update waitingList
    const waitingListRef = collection(db, "restaurants", restaurantId, "waitingList");
    const entryQuery = query(waitingListRef, where("reservationId", "==", reservationId));
    const entrySnap = await getDocs(entryQuery);
    
    if (!entrySnap.empty) {
      const entryDoc = entrySnap.docs[0];
      await updateDoc(entryDoc.ref, {
        status: "SEATED",
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error("Error seating reservation:", error);
    throw error;
  }
}

/**
 * Add walk-up guest to waiting list
 * Creates a temporary reservation entry for walk-up guests
 * 
 * @param {Object} params
 * @param {string} params.restaurantId
 * @param {string} params.dinerId
 * @param {string} params.dinerName
 * @param {number} params.partySize
 * @param {string} params.phone - Optional phone number
 * @param {string} params.source - Source of the waiting list entry (default: "WALK_UP")
 * @returns {Promise<string>} Reservation ID
 */
export async function addToWaitingList({
  restaurantId,
  dinerId,
  dinerName,
  partySize,
  phone = null,
  source = "WALK_UP",
}) {
  try {
    // Create a reservation entry in the ledger for the walk-up
    const { createReservationInLedger } = await import("./reservationLedgerService");
    const { RESERVATION_SOURCE } = await import("./reservationLedgerService");
    
    // Set reservation time to now (walk-up)
    const now = new Date();
    
    const reservationId = await createReservationInLedger({
      restaurantId,
      startAt: now.toISOString(),
      partySize,
      sourceSystem: RESERVATION_SOURCE.LINEUP,
      dinerId,
      dinerName,
      phone,
      metadata: {
        walkUp: true,
        source,
        addedAt: now.toISOString(),
      },
    });

    // The waiting list will be materialized automatically by the scheduled function
    // But we can also trigger it manually if needed
    
    return reservationId;
  } catch (error) {
    console.error("Error adding to waiting list:", error);
    throw error;
  }
}

