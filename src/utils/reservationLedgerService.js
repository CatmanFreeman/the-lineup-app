// src/utils/reservationLedgerService.js
//
// CANONICAL RESERVATIONS LEDGER SERVICE
// 
// This is the system of record for all reservations.
// Path: restaurants/{restaurantId}/reservations/{reservationId}
//
// Rules:
// - Append-only by clients
// - Mutated only by backend services
// - Source-agnostic (native or external)
// - All reservations normalized to this schema

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { db } from "../hooks/services/firebase";

/**
 * Reservation Status Enum
 */
export const RESERVATION_STATUS = {
  BOOKED: "BOOKED",           // Initial booking
  CONFIRMED: "CONFIRMED",      // Confirmed (phone verified for native)
  CHECKED_IN: "CHECKED_IN",   // Guest has checked in
  SEATED: "SEATED",           // Table has been seated
  CANCELLED: "CANCELLED",     // Cancelled
  NO_SHOW: "NO_SHOW",         // No-show
  COMPLETED: "COMPLETED",     // Meal completed
};

/**
 * Reservation Source System
 */
export const RESERVATION_SOURCE = {
  LINEUP: "LINEUP",
  OPENTABLE: "OPENTABLE",
  // Future: TOAST, RESY, etc.
};

/**
 * Create a reservation in the canonical ledger
 * 
 * This is the ONLY way reservations enter the ledger.
 * All reservations (native or external) go through this.
 * 
 * @param {Object} params
 * @param {string} params.restaurantId - Restaurant ID
 * @param {string} params.reservationId - Unique reservation ID (generated if not provided)
 * @param {Date|string} params.startAt - Reservation start time (ISO string or Date)
 * @param {number} params.partySize - Party size
 * @param {string} params.sourceSystem - LINEUP | OPENTABLE
 * @param {string} params.sourceExternalId - External reservation ID (if from external system)
 * @param {string} params.dinerId - Diner user ID (if known)
 * @param {string} params.dinerName - Diner name
 * @param {string} params.phone - Phone number (required for LINEUP)
 * @param {string} params.email - Email (optional)
 * @param {Object} params.metadata - Additional metadata
 * @returns {Promise<string>} Reservation ID
 */
export async function createReservationInLedger({
  restaurantId,
  reservationId = null,
  startAt,
  partySize,
  sourceSystem,
  sourceExternalId = null,
  dinerId = null,
  dinerName = null,
  phone = null,
  email = null,
  metadata = {},
}) {
  try {
    // Validate required fields
    if (!restaurantId || !startAt || !partySize || !sourceSystem) {
      throw new Error("Missing required fields: restaurantId, startAt, partySize, sourceSystem");
    }

    // Validate phone for LINEUP reservations
    if (sourceSystem === RESERVATION_SOURCE.LINEUP && !phone) {
      throw new Error("Phone verification required for LINEUP reservations");
    }

    // Normalize startAt to ISO string
    const startAtISO = startAt instanceof Date ? startAt.toISOString() : startAt;
    const startAtDate = new Date(startAtISO);

    // Generate reservation ID if not provided
    const finalReservationId = reservationId || `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const reservationsRef = collection(db, "restaurants", restaurantId, "reservations");
    const reservationDoc = doc(reservationsRef, finalReservationId);

    // Build reservation data
    const reservationData = {
      // Core fields
      id: finalReservationId,
      restaurantId,
      startAt: startAtISO,
      startAtTimestamp: startAtDate,
      partySize: Number(partySize),
      
      // Source tracking
      source: {
        system: sourceSystem,
        externalReservationId: sourceExternalId || null,
      },
      
      // Guest information
      dinerId: dinerId || null,
      dinerName: dinerName || null,
      phone: phone || null,
      email: email || null,
      
      // Status tracking
      status: sourceSystem === RESERVATION_SOURCE.LINEUP 
        ? RESERVATION_STATUS.BOOKED  // LINEUP starts as BOOKED, requires confirmation
        : RESERVATION_STATUS.CONFIRMED, // External systems are pre-confirmed
      
      // Timestamps
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      
      // Reconciliation metadata
      reconciliation: {
        lastReconciledAt: null,
        reconciliationStatus: "PENDING",
        divergenceDetected: false,
      },
      
      // Additional metadata
      metadata: {
        ...metadata,
        // Store original source data for reconciliation
        originalSourceData: metadata.originalSourceData || null,
      },
      
      // Status history (append-only)
      statusHistory: [
        {
          status: sourceSystem === RESERVATION_SOURCE.LINEUP 
            ? RESERVATION_STATUS.BOOKED 
            : RESERVATION_STATUS.CONFIRMED,
          timestamp: serverTimestamp(),
          source: "LEDGER_CREATE",
        },
      ],
    };

    // Use transaction to ensure atomic write
    await runTransaction(db, async (transaction) => {
      // Check for duplicate external ID if provided
      if (sourceExternalId) {
        const duplicateQuery = query(
          reservationsRef,
          where("source.externalReservationId", "==", sourceExternalId),
          where("restaurantId", "==", restaurantId)
        );
        const duplicateSnap = await getDocs(duplicateQuery);
        if (!duplicateSnap.empty) {
          throw new Error(`Duplicate external reservation ID: ${sourceExternalId}`);
        }
      }

      // Write to ledger
      transaction.set(reservationDoc, reservationData);
    });

    return finalReservationId;
  } catch (error) {
    console.error("Error creating reservation in ledger:", error);
    throw error;
  }
}

/**
 * Update reservation status in ledger
 * 
 * Only backend services should call this.
 * Clients should not mutate ledger directly.
 * 
 * @param {string} restaurantId
 * @param {string} reservationId
 * @param {string} newStatus - One of RESERVATION_STATUS
 * @param {string} source - Source of status change (e.g., "HOST_SEATED", "POS_EVENT")
 * @param {Object} metadata - Additional metadata for status change
 */
export async function updateReservationStatus({
  restaurantId,
  reservationId,
  newStatus,
  source,
  metadata = {},
}) {
  try {
    const reservationRef = doc(
      db,
      "restaurants",
      restaurantId,
      "reservations",
      reservationId
    );

    const reservationSnap = await getDoc(reservationRef);
    if (!reservationSnap.exists()) {
      throw new Error(`Reservation ${reservationId} not found`);
    }

    const currentData = reservationSnap.data();
    const currentStatus = currentData.status;

    // Don't update if status hasn't changed
    if (currentStatus === newStatus) {
      return;
    }

    // Append to status history
    const statusHistory = currentData.statusHistory || [];
    statusHistory.push({
      status: newStatus,
      previousStatus: currentStatus,
      timestamp: serverTimestamp(),
      source: source || "SYSTEM",
      metadata,
    });

    // Update reservation
    await updateDoc(reservationRef, {
      status: newStatus,
      updatedAt: serverTimestamp(),
      statusHistory,
      [`metadata.lastStatusChange.${newStatus}`]: {
        timestamp: serverTimestamp(),
        source,
      },
    });
  } catch (error) {
    console.error("Error updating reservation status:", error);
    throw error;
  }
}

/**
 * Get reservation from ledger
 * 
 * @param {string} restaurantId
 * @param {string} reservationId
 * @returns {Promise<Object|null>}
 */
export async function getReservationFromLedger(restaurantId, reservationId) {
  try {
    const reservationRef = doc(
      db,
      "restaurants",
      restaurantId,
      "reservations",
      reservationId
    );

    const reservationSnap = await getDoc(reservationRef);
    if (!reservationSnap.exists()) {
      return null;
    }

    return {
      id: reservationSnap.id,
      ...reservationSnap.data(),
    };
  } catch (error) {
    console.error("Error getting reservation from ledger:", error);
    throw error;
  }
}

/**
 * Get reservations for a restaurant within a time window
 * 
 * @param {string} restaurantId
 * @param {Date|string} startDate - Start of window
 * @param {Date|string} endDate - End of window
 * @param {string} status - Optional status filter
 * @returns {Promise<Array>}
 */
export async function getReservationsInWindow({
  restaurantId,
  startDate,
  endDate,
  status = null,
}) {
  try {
    const startISO = startDate instanceof Date ? startDate.toISOString() : startDate;
    const endISO = endDate instanceof Date ? endDate.toISOString() : endDate;

    const reservationsRef = collection(db, "restaurants", restaurantId, "reservations");
    
    let q = query(
      reservationsRef,
      where("startAt", ">=", startISO),
      where("startAt", "<=", endISO),
      orderBy("startAt", "asc")
    );

    // Add status filter if provided
    if (status) {
      q = query(q, where("status", "==", status));
    }

    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
  } catch (error) {
    console.error("Error getting reservations in window:", error);
    throw error;
  }
}

/**
 * Cancel a reservation
 * 
 * @param {string} restaurantId
 * @param {string} reservationId
 * @param {string} source - Source of cancellation
 * @param {string} reason - Cancellation reason
 */
export async function cancelReservationInLedger({
  restaurantId,
  reservationId,
  source,
  reason = null,
}) {
  try {
    await updateReservationStatus({
      restaurantId,
      reservationId,
      newStatus: RESERVATION_STATUS.CANCELLED,
      source,
      metadata: {
        cancellationReason: reason,
        cancelledAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error cancelling reservation:", error);
    throw error;
  }
}

/**
 * Mark reservation as reconciled
 * 
 * Used by reconciliation workers
 * 
 * @param {string} restaurantId
 * @param {string} reservationId
 * @param {Object} reconciliationData
 */
export async function markReservationReconciled({
  restaurantId,
  reservationId,
  reconciliationData,
}) {
  try {
    const reservationRef = doc(
      db,
      "restaurants",
      restaurantId,
      "reservations",
      reservationId
    );

    await updateDoc(reservationRef, {
      "reconciliation.lastReconciledAt": serverTimestamp(),
      "reconciliation.reconciliationStatus": reconciliationData.status || "RECONCILED",
      "reconciliation.divergenceDetected": reconciliationData.divergenceDetected || false,
      "reconciliation.lastReconciliationData": reconciliationData,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error marking reservation as reconciled:", error);
    throw error;
  }
}

/**
 * Get all reservations for a diner
 * 
 * Note: This queries across all restaurants to find diner's reservations.
 * For better performance, consider maintaining a diner's reservation index.
 * 
 * @param {string} dinerId
 * @param {string} status - Optional status filter
 * @returns {Promise<Array>}
 */
export async function getDinerReservationsFromLedger(dinerId, status = null) {
  try {
    // Get all restaurants
    const restaurantsRef = collection(db, "restaurants");
    const restaurantsSnap = await getDocs(restaurantsRef);
    
    const allReservations = [];
    
    // Query each restaurant's reservations
    for (const restaurantDoc of restaurantsSnap.docs) {
      const restaurantId = restaurantDoc.id;
      const reservationsRef = collection(db, "restaurants", restaurantId, "reservations");
      
      let q = query(
        reservationsRef,
        where("dinerId", "==", dinerId),
        orderBy("startAt", "desc")
      );
      
      if (status) {
        q = query(q, where("status", "==", status));
      }
      
      try {
        const snap = await getDocs(q);
        snap.docs.forEach((d) => {
          allReservations.push({
            id: d.id,
            restaurantId,
            restaurantName: restaurantDoc.data().name || restaurantId,
            ...d.data(),
          });
        });
      } catch (error) {
        // Skip restaurants without proper indexes
        console.warn(`Could not query reservations for restaurant ${restaurantId}:`, error);
      }
    }
    
    // Sort by startAt descending
    allReservations.sort((a, b) => {
      const aTime = a.startAtTimestamp?.toDate?.() || new Date(a.startAt);
      const bTime = b.startAtTimestamp?.toDate?.() || new Date(b.startAt);
      return bTime - aTime;
    });
    
    return allReservations;
  } catch (error) {
    console.error("Error getting diner reservations from ledger:", error);
    throw error;
  }
}

/**
 * Get current (upcoming) reservations for a diner
 * 
 * @param {string} dinerId
 * @returns {Promise<Array>}
 */
export async function getCurrentDinerReservationsFromLedger(dinerId) {
  try {
    const now = new Date();
    const nowISO = now.toISOString();
    
    const allReservations = await getDinerReservationsFromLedger(dinerId);
    
    // Filter for upcoming and active reservations
    return allReservations.filter((r) => {
      const startTime = r.startAtTimestamp?.toDate?.() || new Date(r.startAt);
      return (
        startTime >= now &&
        r.status !== "CANCELLED" &&
        r.status !== "COMPLETED" &&
        r.status !== "NO_SHOW"
      );
    });
  } catch (error) {
    console.error("Error getting current diner reservations:", error);
    throw error;
  }
}

/**
 * Get past reservations for a diner
 * 
 * @param {string} dinerId
 * @param {number} limit - Maximum number of reservations to return
 * @returns {Promise<Array>}
 */
export async function getPastDinerReservationsFromLedger(dinerId, limit = 10) {
  try {
    const now = new Date();
    
    const allReservations = await getDinerReservationsFromLedger(dinerId);
    
    // Filter for past reservations
    const pastReservations = allReservations.filter((r) => {
      const startTime = r.startAtTimestamp?.toDate?.() || new Date(r.startAt);
      return startTime < now;
    });
    
    return pastReservations.slice(0, limit);
  } catch (error) {
    console.error("Error getting past diner reservations:", error);
    throw error;
  }
}

/**
 * Update reservation metadata (e.g., add server selection)
 * 
 * @param {string} restaurantId
 * @param {string} reservationId
 * @param {Object} metadataUpdates - Metadata fields to update
 * @returns {Promise<void>}
 */
export async function updateReservationMetadata(restaurantId, reservationId, metadataUpdates) {
  try {
    const reservationRef = doc(
      db,
      "restaurants",
      restaurantId,
      "reservations",
      reservationId
    );

    const reservationSnap = await getDoc(reservationRef);
    if (!reservationSnap.exists()) {
      throw new Error(`Reservation ${reservationId} not found`);
    }

    const currentData = reservationSnap.data();
    const currentMetadata = currentData.metadata || {};

    // Merge new metadata with existing
    const updatedMetadata = {
      ...currentMetadata,
      ...metadataUpdates,
    };

    await updateDoc(reservationRef, {
      metadata: updatedMetadata,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating reservation metadata:", error);
    throw error;
  }
}

