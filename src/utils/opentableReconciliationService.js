// src/utils/opentableReconciliationService.js
//
// OPENTABLE RECONCILIATION SERVICE
//
// Reconciliation worker that syncs OpenTable reservations with Lineup ledger.
// Should run periodically (e.g., every hour) to catch any discrepancies.
//
// Flow:
// 1. Fetch reservations from OpenTable API
// 2. Compare with ledger reservations
// 3. Identify divergences (missing, extra, status mismatches)
// 4. Create/update/cancel reservations as needed
// 5. Mark reservations as reconciled

import {
  getReservationsInWindow,
  markReservationReconciled,
  createReservationInLedger,
  RESERVATION_SOURCE,
  RESERVATION_STATUS,
} from "./reservationLedgerService";
import {
  pollOpenTableReservations,
  normalizeOpenTableReservation,
  getOpenTableConfig,
} from "./opentableService";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../hooks/services/firebase";

/**
 * Run reconciliation for a restaurant
 * 
 * @param {Object} params
 * @param {string} params.restaurantId - Restaurant ID
 * @param {Date|string} params.startDate - Start date for reconciliation window
 * @param {Date|string} params.endDate - End date for reconciliation window
 * @returns {Promise<Object>} Reconciliation report
 */
export async function reconcileOpenTableReservations({
  restaurantId,
  startDate,
  endDate,
}) {
  try {
    // Get OpenTable configuration
    const openTableConfig = await getOpenTableConfig(restaurantId);
    if (!openTableConfig || !openTableConfig.enabled) {
      return {
        success: false,
        error: "OpenTable integration not configured or disabled",
      };
    }

    // 1. Fetch reservations from OpenTable API
    const openTableReservations = await fetchOpenTableReservations({
      restaurantId,
      startDate,
      endDate,
      openTableConfig,
    });

    // 2. Get reservations from ledger
    const ledgerReservations = await getReservationsInWindow({
      restaurantId,
      startDate,
      endDate,
    });

    // Filter for OpenTable reservations only
    const ledgerOpenTableReservations = ledgerReservations.filter(
      (r) => r.source?.system === RESERVATION_SOURCE.OPENTABLE
    );

    // 3. Build maps for comparison
    const openTableMap = new Map();
    openTableReservations.forEach((res) => {
      const externalId = res.reservationId || res.id;
      if (externalId) {
        openTableMap.set(externalId, res);
      }
    });

    const ledgerMap = new Map();
    ledgerOpenTableReservations.forEach((res) => {
      const externalId = res.source?.externalReservationId;
      if (externalId) {
        ledgerMap.set(externalId, res);
      }
    });

    // 4. Identify divergences
    const report = {
      restaurantId,
      startDate,
      endDate,
      reconciledAt: new Date().toISOString(),
      openTableCount: openTableReservations.length,
      ledgerCount: ledgerOpenTableReservations.length,
      created: [],
      updated: [],
      cancelled: [],
      divergences: [],
    };

    // Find missing reservations (in OpenTable but not in ledger)
    for (const [externalId, openTableRes] of openTableMap.entries()) {
      if (!ledgerMap.has(externalId)) {
        // Create missing reservation
        try {
          const normalized = normalizeOpenTableReservation({
            eventType: "reservation.reconciled",
            data: openTableRes,
          });

          const { createReservationFromOpenTable } = await import("./opentableService");
          const reservationId = await createReservationFromOpenTable(normalized);
          report.created.push({
            externalId,
            reservationId,
            reason: "Missing in ledger",
          });
        } catch (error) {
          console.error(`Error creating missing reservation ${externalId}:`, error);
          report.divergences.push({
            type: "CREATE_FAILED",
            externalId,
            error: error.message,
          });
        }
      } else {
        // Check for status mismatches
        const ledgerRes = ledgerMap.get(externalId);
        const normalized = normalizeOpenTableReservation({
          eventType: "reservation.reconciled",
          data: openTableRes,
        });

        if (ledgerRes.status !== normalized.status) {
          try {
            const { updateReservationStatus } = await import("./reservationLedgerService");
            await updateReservationStatus({
              restaurantId,
              reservationId: ledgerRes.id,
              newStatus: normalized.status,
              source: "OPENTABLE_RECONCILIATION",
              metadata: {
                previousStatus: ledgerRes.status,
                openTableStatus: normalized.status,
              },
            });
            report.updated.push({
              externalId,
              reservationId: ledgerRes.id,
              previousStatus: ledgerRes.status,
              newStatus: normalized.status,
            });
          } catch (error) {
            console.error(`Error updating reservation ${externalId}:`, error);
            report.divergences.push({
              type: "UPDATE_FAILED",
              externalId,
              reservationId: ledgerRes.id,
              error: error.message,
            });
          }
        }

        // Mark as reconciled
        await markReservationReconciled({
          restaurantId,
          reservationId: ledgerRes.id,
          reconciliationData: {
            status: "RECONCILED",
            divergenceDetected: false,
            reconciledWith: "OPENTABLE",
            reconciledAt: new Date().toISOString(),
          },
        });
      }
    }

    // Find extra reservations (in ledger but not in OpenTable)
    for (const [externalId, ledgerRes] of ledgerMap.entries()) {
      if (!openTableMap.has(externalId)) {
        // Check if reservation is in the future
        const reservationTime = ledgerRes.startAtTimestamp?.toDate?.() || new Date(ledgerRes.startAt);
        const now = new Date();

        if (reservationTime > now) {
          // Future reservation missing from OpenTable - could be cancelled
          // Don't auto-cancel, just flag as divergence
          report.divergences.push({
            type: "MISSING_IN_OPENTABLE",
            externalId,
            reservationId: ledgerRes.id,
            reason: "Reservation exists in ledger but not in OpenTable",
          });
        } else {
          // Past reservation - might have been cancelled in OpenTable
          // Mark as divergence but don't auto-cancel
          report.divergences.push({
            type: "MISSING_IN_OPENTABLE",
            externalId,
            reservationId: ledgerRes.id,
            reason: "Past reservation missing from OpenTable",
          });
        }
      }
    }

    // Store reconciliation report
    await storeReconciliationReport(restaurantId, report);

    return {
      success: true,
      report,
    };
  } catch (error) {
    console.error("Error reconciling OpenTable reservations:", error);
    throw error;
  }
}

/**
 * Fetch reservations from OpenTable API
 * 
 * @param {Object} params
 * @returns {Promise<Array>}
 */
async function fetchOpenTableReservations({ restaurantId, startDate, endDate, openTableConfig }) {
  try {
    // Use polling service to fetch reservations
    const reservations = await pollOpenTableReservations({
      restaurantId,
      startDate,
      endDate,
      openTableConfig,
    });

    return reservations;
  } catch (error) {
    console.error("Error fetching OpenTable reservations:", error);
    // Return empty array on error to continue reconciliation
    return [];
  }
}

/**
 * Store reconciliation report
 * 
 * @param {string} restaurantId
 * @param {Object} report
 */
async function storeReconciliationReport(restaurantId, report) {
  try {
    const reportsRef = collection(db, "restaurants", restaurantId, "reconciliationReports");
    const reportDoc = doc(reportsRef);
    await setDoc(reportDoc, {
      ...report,
      id: reportDoc.id,
      storedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error storing reconciliation report:", error);
  }
}

/**
 * Get latest reconciliation report for a restaurant
 * 
 * @param {string} restaurantId
 * @returns {Promise<Object|null>}
 */
export async function getLatestReconciliationReport(restaurantId) {
  try {
    const reportsRef = collection(db, "restaurants", restaurantId, "reconciliationReports");
    const q = query(reportsRef, where("restaurantId", "==", restaurantId));

    const snap = await getDocs(q);
    if (snap.empty) {
      return null;
    }

    // Get most recent report
    const reports = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    reports.sort((a, b) => {
      const aTime = a.reconciledAt || a.storedAt?.toDate?.() || new Date(0);
      const bTime = b.reconciledAt || b.storedAt?.toDate?.() || new Date(0);
      return bTime - aTime;
    });

    return reports[0] || null;
  } catch (error) {
    console.error("Error getting latest reconciliation report:", error);
    return null;
  }
}









