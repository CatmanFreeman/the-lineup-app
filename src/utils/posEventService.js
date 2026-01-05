// src/utils/posEventService.js
//
// POS EVENT NORMALIZATION SERVICE
//
// Normalizes POS events (Toast, Square, etc.) into Lineup's internal schema.
// POS events are treated as signals, not truth.
//
// Event types:
// - SEATED: Table was seated
// - FIRST_DRINK: First drink order placed
// - ENTREES_ORDERED: Entrees ordered
// - CHECK_CLOSED: Check closed (meal complete)

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../hooks/services/firebase";
import { updateReservationStatus } from "./reservationLedgerService";

/**
 * POS System Types
 */
export const POS_SYSTEM = {
  TOAST: "TOAST",
  SQUARE: "SQUARE",
  CLOVER: "CLOVER",
  // Future: RESY, OPENTABLE_POS, etc.
};

/**
 * POS Event Types
 */
export const POS_EVENT_TYPE = {
  SEATED: "SEATED",
  FIRST_DRINK: "FIRST_DRINK",
  ENTREES_ORDERED: "ENTREES_ORDERED",
  CHECK_CLOSED: "CHECK_CLOSED",
  TABLE_STATUS_CHANGED: "TABLE_STATUS_CHANGED",
};

/**
 * Normalize POS event to Lineup schema
 * 
 * @param {Object} rawEvent - Raw POS event
 * @param {string} posSystem - POS system (TOAST, SQUARE, etc.)
 * @returns {Object} Normalized event
 */
export function normalizePosEvent(rawEvent, posSystem) {
  // Each POS system will have its own normalization logic
  switch (posSystem) {
    case POS_SYSTEM.TOAST:
      return normalizeToastEvent(rawEvent);
    case POS_SYSTEM.SQUARE:
      return normalizeSquareEvent(rawEvent);
    case POS_SYSTEM.CLOVER:
      return normalizeCloverEvent(rawEvent);
    default:
      throw new Error(`Unsupported POS system: ${posSystem}`);
  }
}

/**
 * Normalize Toast event
 * 
 * Toast webhook events come in various formats.
 * This normalizes them to Lineup's internal schema.
 * 
 * @param {Object} toastEvent - Raw Toast webhook event
 * @returns {Object} Normalized event
 */
function normalizeToastEvent(toastEvent) {
  const eventType = toastEvent.eventType || toastEvent.type;
  const data = toastEvent.data || toastEvent;

  // Map Toast event types to Lineup event types
  let lineupEventType = null;
  let metadata = {};

  switch (eventType) {
    case "order.created":
    case "order.updated":
      // Check if this is first drink or entrees
      const items = data.items || [];
      const hasDrinks = items.some((item) => 
        item.category?.toLowerCase().includes("drink") ||
        item.category?.toLowerCase().includes("beverage") ||
        item.tags?.includes("drink")
      );
      const hasEntrees = items.some((item) =>
        item.category?.toLowerCase().includes("entree") ||
        item.category?.toLowerCase().includes("main") ||
        item.tags?.includes("entree")
      );

      if (hasEntrees) {
        lineupEventType = POS_EVENT_TYPE.ENTREES_ORDERED;
      } else if (hasDrinks) {
        lineupEventType = POS_EVENT_TYPE.FIRST_DRINK;
      }
      metadata = {
        orderId: data.id || data.orderId,
        items: items,
        tableId: data.table?.id || data.tableId,
        checkId: data.check?.id || data.checkId,
      };
      break;

    case "check.closed":
    case "check.paid":
      lineupEventType = POS_EVENT_TYPE.CHECK_CLOSED;
      metadata = {
        checkId: data.id || data.checkId,
        tableId: data.table?.id || data.tableId,
        total: data.total || data.amount,
        paidAt: data.closedAt || data.paidAt || new Date().toISOString(),
      };
      break;

    case "table.status":
    case "table.seated":
      lineupEventType = POS_EVENT_TYPE.SEATED;
      metadata = {
        tableId: data.id || data.tableId,
        tableName: data.name || data.tableName,
        seatedAt: data.seatedAt || new Date().toISOString(),
      };
      break;

    default:
      // Unknown event type, but we'll store it
      lineupEventType = POS_EVENT_TYPE.TABLE_STATUS_CHANGED;
      metadata = {
        originalEventType: eventType,
        originalData: data,
      };
  }

  return {
    posSystem: POS_SYSTEM.TOAST,
    posEventId: toastEvent.id || toastEvent.eventId || `toast_${Date.now()}`,
    eventType: lineupEventType,
    restaurantId: data.restaurantId || data.locationId,
    tableId: metadata.tableId,
    timestamp: toastEvent.timestamp || toastEvent.createdAt || new Date().toISOString(),
    metadata,
    rawEvent: toastEvent, // Store original for debugging
  };
}

/**
 * Normalize Square event
 * 
 * Square webhook events come in various formats.
 * This normalizes them to Lineup's internal schema.
 * 
 * @param {Object} squareEvent - Raw Square webhook event
 * @returns {Object} Normalized event
 */
function normalizeSquareEvent(squareEvent) {
  const eventType = squareEvent.type || squareEvent.event_type;
  const data = squareEvent.data || squareEvent.object || squareEvent;

  // Map Square event types to Lineup event types
  let lineupEventType = null;
  let metadata = {};

  switch (eventType) {
    case "order.created":
    case "order.updated":
    case "order.fulfillment.updated":
      // Check if this is first drink or entrees
      const lineItems = data.line_items || data.items || [];
      const hasDrinks = lineItems.some((item) => 
        item.item_type === "ITEM" && (
          item.name?.toLowerCase().includes("drink") ||
          item.name?.toLowerCase().includes("beverage") ||
          item.catalog_object_id?.includes("drink")
        )
      );
      const hasEntrees = lineItems.some((item) =>
        item.item_type === "ITEM" && (
          item.name?.toLowerCase().includes("entree") ||
          item.name?.toLowerCase().includes("main") ||
          item.catalog_object_id?.includes("entree")
        )
      );

      if (hasEntrees) {
        lineupEventType = POS_EVENT_TYPE.ENTREES_ORDERED;
      } else if (hasDrinks) {
        lineupEventType = POS_EVENT_TYPE.FIRST_DRINK;
      }
      metadata = {
        orderId: data.id || data.order_id,
        items: lineItems,
        tableId: data.tender?.tender_id || data.table_id,
        locationId: data.location_id,
      };
      break;

    case "payment.created":
    case "payment.updated":
      // Check if payment is complete (check closed)
      if (data.status === "COMPLETED" || data.status === "APPROVED") {
        lineupEventType = POS_EVENT_TYPE.CHECK_CLOSED;
        metadata = {
          paymentId: data.id || data.payment_id,
          orderId: data.order_id,
          total: data.amount_money?.amount ? (data.amount_money.amount / 100) : data.total_amount,
          paidAt: data.created_at || new Date().toISOString(),
        };
      }
      break;

    case "table.updated":
    case "table.status.updated":
      // Check if table was seated
      if (data.status === "SEATED" || data.status === "ACTIVE") {
        lineupEventType = POS_EVENT_TYPE.SEATED;
        metadata = {
          tableId: data.id || data.table_id,
          tableName: data.name || data.table_name,
          seatedAt: data.updated_at || data.created_at || new Date().toISOString(),
        };
      }
      break;

    default:
      // Unknown event type, but we'll store it
      lineupEventType = POS_EVENT_TYPE.TABLE_STATUS_CHANGED;
      metadata = {
        originalEventType: eventType,
        originalData: data,
      };
  }

  return {
    posSystem: POS_SYSTEM.SQUARE,
    posEventId: squareEvent.id || squareEvent.event_id || `square_${Date.now()}`,
    eventType: lineupEventType,
    restaurantId: data.location_id || data.restaurant_id,
    tableId: metadata.tableId,
    timestamp: squareEvent.created_at || squareEvent.timestamp || new Date().toISOString(),
    metadata,
    rawEvent: squareEvent, // Store original for debugging
  };
}

/**
 * Normalize Clover event
 * 
 * Clover webhook events come in various formats.
 * This normalizes them to Lineup's internal schema.
 * 
 * @param {Object} cloverEvent - Raw Clover webhook event
 * @returns {Object} Normalized event
 */
function normalizeCloverEvent(cloverEvent) {
  const eventType = cloverEvent.type || cloverEvent.eventType;
  const data = cloverEvent.data || cloverEvent.object || cloverEvent;

  // Map Clover event types to Lineup event types
  let lineupEventType = null;
  let metadata = {};

  switch (eventType) {
    case "ORDER_CREATED":
    case "ORDER_UPDATED":
    case "LINE_ITEM_ADDED":
      // Check if this is first drink or entrees
      const lineItems = data.lineItems || data.items || [];
      const hasDrinks = lineItems.some((item) => 
        item.name?.toLowerCase().includes("drink") ||
        item.name?.toLowerCase().includes("beverage") ||
        item.tags?.some(tag => tag.toLowerCase().includes("drink"))
      );
      const hasEntrees = lineItems.some((item) =>
        item.name?.toLowerCase().includes("entree") ||
        item.name?.toLowerCase().includes("main") ||
        item.tags?.some(tag => tag.toLowerCase().includes("entree"))
      );

      if (hasEntrees) {
        lineupEventType = POS_EVENT_TYPE.ENTREES_ORDERED;
      } else if (hasDrinks) {
        lineupEventType = POS_EVENT_TYPE.FIRST_DRINK;
      }
      metadata = {
        orderId: data.id || data.orderId,
        items: lineItems,
        tableId: data.table?.id || data.tableId,
        merchantId: data.merchantId || data.merchant_id,
      };
      break;

    case "PAYMENT_CREATED":
    case "PAYMENT_UPDATED":
      // Check if payment is complete (check closed)
      if (data.status === "PAID" || data.status === "AUTHORIZED") {
        lineupEventType = POS_EVENT_TYPE.CHECK_CLOSED;
        metadata = {
          paymentId: data.id || data.paymentId,
          orderId: data.order?.id || data.orderId,
          total: data.amount ? (data.amount / 100) : data.totalAmount,
          paidAt: data.createdTime || data.timestamp || new Date().toISOString(),
        };
      }
      break;

    case "TABLE_UPDATED":
    case "TABLE_SEATED":
      lineupEventType = POS_EVENT_TYPE.SEATED;
      metadata = {
        tableId: data.id || data.tableId,
        tableName: data.name || data.tableName,
        seatedAt: data.seatedTime || data.timestamp || new Date().toISOString(),
      };
      break;

    default:
      // Unknown event type, but we'll store it
      lineupEventType = POS_EVENT_TYPE.TABLE_STATUS_CHANGED;
      metadata = {
        originalEventType: eventType,
        originalData: data,
      };
  }

  return {
    posSystem: POS_SYSTEM.CLOVER,
    posEventId: cloverEvent.id || cloverEvent.eventId || `clover_${Date.now()}`,
    eventType: lineupEventType,
    restaurantId: data.merchantId || data.merchant_id || data.restaurantId,
    tableId: metadata.tableId,
    timestamp: cloverEvent.timestamp || cloverEvent.createdTime || new Date().toISOString(),
    metadata,
    rawEvent: cloverEvent, // Store original for debugging
  };
}

/**
 * Store POS event in Firestore
 * 
 * Events are stored for reconciliation and learning.
 * Path: restaurants/{restaurantId}/posEvents/{eventId}
 * 
 * @param {Object} normalizedEvent - Normalized POS event
 * @returns {Promise<string>} Event ID
 */
export async function storePosEvent(normalizedEvent) {
  try {
    const { restaurantId, posEventId } = normalizedEvent;

    if (!restaurantId || !posEventId) {
      throw new Error("Missing restaurantId or posEventId");
    }

    // Check for duplicate
    const posEventsRef = collection(db, "restaurants", restaurantId, "posEvents");
    const duplicateQuery = query(
      posEventsRef,
      where("posEventId", "==", posEventId),
      where("posSystem", "==", normalizedEvent.posSystem)
    );
    const duplicateSnap = await getDocs(duplicateQuery);

    if (!duplicateSnap.empty) {
      // Duplicate event, return existing ID
      return duplicateSnap.docs[0].id;
    }

    // Store new event
    const eventDoc = doc(posEventsRef);
    await setDoc(eventDoc, {
      ...normalizedEvent,
      id: eventDoc.id,
      storedAt: serverTimestamp(),
      processed: false,
    });

    return eventDoc.id;
  } catch (error) {
    console.error("Error storing POS event:", error);
    throw error;
  }
}

/**
 * Process POS event and update meal lifecycle
 * 
 * This links POS events to reservations and updates meal timeline.
 * 
 * @param {Object} normalizedEvent - Normalized POS event
 * @param {string} reservationId - Optional reservation ID (if known)
 */
export async function processPosEvent(normalizedEvent, reservationId = null) {
  try {
    const { restaurantId, eventType, tableId, metadata } = normalizedEvent;

    // If reservationId not provided, try to find it by table
    if (!reservationId && tableId) {
      reservationId = await findReservationByTable(restaurantId, tableId);
    }

    if (!reservationId) {
      // Can't link to reservation, but store event anyway
      console.warn("POS event cannot be linked to reservation:", normalizedEvent);
      return;
    }

    // Update reservation status based on event type
    switch (eventType) {
      case POS_EVENT_TYPE.SEATED:
        await updateReservationStatus({
          restaurantId,
          reservationId,
          newStatus: "SEATED",
          source: "POS_EVENT",
          metadata: {
            posSystem: normalizedEvent.posSystem,
            tableId,
            seatedAt: metadata.seatedAt || normalizedEvent.timestamp,
          },
        });
        break;

      case POS_EVENT_TYPE.CHECK_CLOSED:
        await updateReservationStatus({
          restaurantId,
          reservationId,
          newStatus: "COMPLETED",
          source: "POS_EVENT",
          metadata: {
            posSystem: normalizedEvent.posSystem,
            checkId: metadata.checkId,
            total: metadata.total,
            completedAt: metadata.paidAt || normalizedEvent.timestamp,
          },
        });
        
        // Trigger valet check dropped notification if valet ticket exists
        try {
          const { handleCheckDropped } = await import("./valetService");
          await handleCheckDropped(restaurantId, tableId, reservationId);
        } catch (valetError) {
          console.warn("Error handling valet check dropped:", valetError);
          // Don't fail the whole POS event processing if valet fails
        }
        break;

      // FIRST_DRINK and ENTREES_ORDERED don't change status,
      // but we can store them in meal timeline
      default:
        // Store in meal timeline (separate collection)
        await storeMealLifecycleEvent({
          restaurantId,
          reservationId,
          eventType,
          metadata: {
            ...metadata,
            posSystem: normalizedEvent.posSystem,
          },
        });
    }

    // Mark event as processed
    const posEventsRef = collection(db, "restaurants", restaurantId, "posEvents");
    const eventQuery = query(
      posEventsRef,
      where("posEventId", "==", normalizedEvent.posEventId),
      where("posSystem", "==", normalizedEvent.posSystem)
    );
    const eventSnap = await getDocs(eventQuery);
    if (!eventSnap.empty) {
      const eventDoc = eventSnap.docs[0];
      await updateDoc(eventDoc.ref, {
        processed: true,
        processedAt: serverTimestamp(),
        linkedReservationId: reservationId,
      });
    }
  } catch (error) {
    console.error("Error processing POS event:", error);
    throw error;
  }
}

/**
 * Find reservation by table ID
 * 
 * @param {string} restaurantId
 * @param {string} tableId
 * @returns {Promise<string|null>} Reservation ID or null
 */
async function findReservationByTable(restaurantId, tableId) {
  try {
    // This is a simplified lookup - in reality, we'd need to track
    // table assignments when seating reservations
    // For now, we'll check recent seated reservations
    
    const { getReservationsInWindow } = await import("./reservationLedgerService");
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    const reservations = await getReservationsInWindow({
      restaurantId,
      startDate: oneHourAgo.toISOString(),
      endDate: oneHourFromNow.toISOString(),
      status: "SEATED",
    });

    // Find reservation that matches table (would need table assignment tracking)
    // For MVP, we'll return first seated reservation
    // TODO: Implement proper table assignment tracking
    if (reservations.length > 0) {
      return reservations[0].id;
    }

    return null;
  } catch (error) {
    console.error("Error finding reservation by table:", error);
    return null;
  }
}

/**
 * Store meal lifecycle event
 * 
 * Tracks the meal timeline: first drink, entrees, etc.
 * Path: restaurants/{restaurantId}/reservations/{reservationId}/mealLifecycle/{eventId}
 * 
 * @param {Object} params
 */
async function storeMealLifecycleEvent({
  restaurantId,
  reservationId,
  eventType,
  metadata,
}) {
  try {
    const lifecycleRef = collection(
      db,
      "restaurants",
      restaurantId,
      "reservations",
      reservationId,
      "mealLifecycle"
    );

    const eventDoc = doc(lifecycleRef);
    await setDoc(eventDoc, {
      id: eventDoc.id,
      reservationId,
      eventType,
      timestamp: serverTimestamp(),
      metadata,
    });
  } catch (error) {
    console.error("Error storing meal lifecycle event:", error);
    throw error;
  }
}


