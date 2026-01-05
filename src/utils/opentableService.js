// src/utils/opentableService.js
//
// OPENTABLE SERVICE
//
// Handles OpenTable reservation integration:
// - Normalizes OpenTable reservations to Lineup schema
// - Creates reservations in canonical ledger
// - Polls OpenTable API for reservations
// - Handles reconciliation

import {
  createReservationInLedger,
  RESERVATION_SOURCE,
  RESERVATION_STATUS,
  getReservationFromLedger,
  updateReservationStatus,
  cancelReservationInLedger,
} from "./reservationLedgerService";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../hooks/services/firebase";

/**
 * Normalize OpenTable reservation to Lineup schema
 * 
 * @param {Object} openTableReservation - Raw OpenTable reservation data
 * @returns {Object} Normalized reservation
 */
export function normalizeOpenTableReservation(openTableReservation) {
  const data = openTableReservation.data || openTableReservation;
  const eventType = openTableReservation.eventType || "reservation.created";

  // Extract reservation data
  const reservationId = data.reservationId || data.id;
  const restaurantId = data.restaurantId || data.restaurant_id;
  const restaurantName = data.restaurantName || data.restaurant_name;
  const dinerName = data.dinerName || data.guest_name || data.name;
  const dinerEmail = data.dinerEmail || data.email;
  const dinerPhone = data.dinerPhone || data.phone;
  const partySize = data.partySize || data.guest_count || data.party_size || 1;
  const reservationDateTime = data.reservationDateTime || data.reservation_date_time || data.datetime;
  const status = data.status || "confirmed";
  const specialRequests = data.specialRequests || data.special_requests || data.notes;

  // Normalize status
  let normalizedStatus = RESERVATION_STATUS.CONFIRMED;
  if (status === "cancelled" || status === "canceled") {
    normalizedStatus = RESERVATION_STATUS.CANCELLED;
  } else if (status === "seated") {
    normalizedStatus = RESERVATION_STATUS.SEATED;
  } else if (status === "checked_in") {
    normalizedStatus = RESERVATION_STATUS.CHECKED_IN;
  } else if (status === "completed") {
    normalizedStatus = RESERVATION_STATUS.COMPLETED;
  }

  return {
    restaurantId,
    restaurantName,
    externalReservationId: reservationId,
    startAt: reservationDateTime,
    partySize: Number(partySize),
    dinerName: dinerName || "OpenTable Guest",
    dinerEmail: dinerEmail || null,
    dinerPhone: dinerPhone || null,
    status: normalizedStatus,
    specialRequests: specialRequests || null,
    eventType,
    rawData: data, // Store original for debugging
  };
}

/**
 * Create reservation in ledger from OpenTable data
 * 
 * This is idempotent - will not create duplicates if called multiple times
 * with the same external reservation ID.
 * 
 * @param {Object} normalizedReservation - Normalized reservation from OpenTable
 * @returns {Promise<string>} Reservation ID in ledger
 */
export async function createReservationFromOpenTable(normalizedReservation) {
  try {
    const {
      restaurantId,
      externalReservationId,
      startAt,
      partySize,
      dinerName,
      dinerEmail,
      dinerPhone,
      status,
      specialRequests,
      rawData,
    } = normalizedReservation;

    if (!restaurantId || !externalReservationId || !startAt) {
      throw new Error("Missing required fields: restaurantId, externalReservationId, startAt");
    }

    // Check if reservation already exists
    const existingReservation = await findReservationByExternalId(
      restaurantId,
      externalReservationId
    );

    if (existingReservation) {
      // Update existing reservation if status changed
      if (status !== existingReservation.status) {
        await updateReservationStatus({
          restaurantId,
          reservationId: existingReservation.id,
          newStatus: status,
          source: "OPENTABLE_WEBHOOK",
          metadata: {
            openTableEventType: normalizedReservation.eventType,
            rawData,
          },
        });
      }
      return existingReservation.id;
    }

    // Create new reservation in ledger
    const reservationId = await createReservationInLedger({
      restaurantId,
      startAt,
      partySize,
      sourceSystem: RESERVATION_SOURCE.OPENTABLE,
      sourceExternalId: externalReservationId,
      dinerName,
      email: dinerEmail,
      phone: dinerPhone,
      metadata: {
        specialRequests,
        openTableRawData: rawData,
        importedAt: new Date().toISOString(),
      },
    });

    // If status is not CONFIRMED, update it
    if (status !== RESERVATION_STATUS.CONFIRMED) {
      await updateReservationStatus({
        restaurantId,
        reservationId,
        newStatus: status,
        source: "OPENTABLE_WEBHOOK",
        metadata: {
          openTableEventType: normalizedReservation.eventType,
        },
      });
    }

    return reservationId;
  } catch (error) {
    console.error("Error creating reservation from OpenTable:", error);
    throw error;
  }
}

/**
 * Find reservation by external OpenTable ID
 * 
 * @param {string} restaurantId
 * @param {string} externalReservationId
 * @returns {Promise<Object|null>}
 */
async function findReservationByExternalId(restaurantId, externalReservationId) {
  try {
    const reservationsRef = collection(db, "restaurants", restaurantId, "reservations");
    const q = query(
      reservationsRef,
      where("source.externalReservationId", "==", externalReservationId),
      where("source.system", "==", RESERVATION_SOURCE.OPENTABLE)
    );

    const snap = await getDocs(q);
    if (!snap.empty) {
      const doc = snap.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
      };
    }

    return null;
  } catch (error) {
    console.error("Error finding reservation by external ID:", error);
    return null;
  }
}

/**
 * Poll OpenTable API for reservations
 * 
 * This is a fallback mechanism when webhooks are not available or reliable.
 * Should be called periodically (e.g., every 15 minutes).
 * 
 * @param {Object} params
 * @param {string} params.restaurantId - Restaurant ID
 * @param {Date|string} params.startDate - Start date for polling
 * @param {Date|string} params.endDate - End date for polling
 * @param {Object} params.openTableConfig - OpenTable API configuration
 * @returns {Promise<Array>} Array of created/updated reservation IDs
 */
export async function pollOpenTableReservations({
  restaurantId,
  startDate,
  endDate,
  openTableConfig,
}) {
  try {
    // TODO: Implement actual OpenTable API call
    // For now, this is a placeholder structure
    
    // Example API call structure:
    // const response = await fetch(
    //   `https://api.opentable.com/v1/restaurants/${openTableConfig.restaurantId}/reservations?start_date=${startDate}&end_date=${endDate}`,
    //   {
    //     headers: {
    //       "Authorization": `Bearer ${openTableConfig.apiKey}`,
    //       "Content-Type": "application/json",
    //     },
    //   }
    // );
    // const reservations = await response.json();

    // For now, return empty array
    const reservations = [];

    const createdReservationIds = [];

    for (const reservation of reservations) {
      try {
        const normalized = normalizeOpenTableReservation({
          eventType: "reservation.polled",
          data: reservation,
        });

        const reservationId = await createReservationFromOpenTable(normalized);
        createdReservationIds.push(reservationId);
      } catch (error) {
        console.error("Error processing polled reservation:", error);
        // Continue with next reservation
      }
    }

    // Store last poll timestamp
    await storeLastPollTimestamp(restaurantId, endDate);

    return createdReservationIds;
  } catch (error) {
    console.error("Error polling OpenTable reservations:", error);
    throw error;
  }
}

/**
 * Store last poll timestamp for a restaurant
 * 
 * @param {string} restaurantId
 * @param {Date|string} timestamp
 */
async function storeLastPollTimestamp(restaurantId, timestamp) {
  try {
    const configRef = doc(db, "restaurants", restaurantId, "integrations", "opentable");
    await setDoc(
      configRef,
      {
        lastPolledAt: serverTimestamp(),
        lastPolledTimestamp: timestamp instanceof Date ? timestamp.toISOString() : timestamp,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error("Error storing last poll timestamp:", error);
  }
}

/**
 * Get OpenTable integration configuration for a restaurant
 * 
 * @param {string} restaurantId
 * @returns {Promise<Object|null>}
 */
export async function getOpenTableConfig(restaurantId) {
  try {
    const configRef = doc(db, "restaurants", restaurantId, "integrations", "opentable");
    const configSnap = await getDoc(configRef);

    if (!configSnap.exists()) {
      return null;
    }

    return configSnap.data();
  } catch (error) {
    console.error("Error getting OpenTable config:", error);
    return null;
  }
}

/**
 * Update OpenTable integration configuration
 * 
 * @param {string} restaurantId
 * @param {Object} config
 * @param {string} config.apiKey - OpenTable API key
 * @param {string} config.restaurantId - OpenTable restaurant ID
 * @param {string} config.webhookSecret - Webhook secret for signature verification
 * @param {boolean} config.enabled - Whether integration is enabled
 */
export async function updateOpenTableConfig(restaurantId, config) {
  try {
    const configRef = doc(db, "restaurants", restaurantId, "integrations", "opentable");
    await setDoc(
      configRef,
      {
        ...config,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error("Error updating OpenTable config:", error);
    throw error;
  }
}

/**
 * Handle OpenTable reservation cancellation
 * 
 * @param {Object} params
 * @param {string} params.restaurantId
 * @param {string} params.externalReservationId - OpenTable reservation ID
 * @param {string} params.reason - Cancellation reason
 */
export async function handleOpenTableCancellation({
  restaurantId,
  externalReservationId,
  reason = null,
}) {
  try {
    const reservation = await findReservationByExternalId(restaurantId, externalReservationId);

    if (!reservation) {
      console.warn(`Reservation not found for OpenTable ID: ${externalReservationId}`);
      return null;
    }

    await cancelReservationInLedger({
      restaurantId,
      reservationId: reservation.id,
      source: "OPENTABLE_WEBHOOK",
      reason: reason || "Cancelled via OpenTable",
    });

    return reservation.id;
  } catch (error) {
    console.error("Error handling OpenTable cancellation:", error);
    throw error;
  }
}









