// src/hooks/services/inventoryMovementService.js
// Purpose: Append-only audit log for every inventory change.
// NOTE: This file ADDS functionality. It does not replace anything.

import {
  collection,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * logInventoryMovement
 *
 * @param {Object} args
 * @param {string} args.companyId
 * @param {string} args.restaurantId
 * @param {string} args.itemId
 * @param {number} args.delta
 * @param {string} args.reason        // "receipt" | "adjustment" | "waste"
 * @param {string} args.sourceId      // receiptId, adjustmentId, etc
 * @param {number} args.beforeQty
 * @param {number} args.afterQty
 * @param {string} [args.createdBy]   // userId later
 */
export async function logInventoryMovement({
  companyId,
  restaurantId,
  itemId,
  delta,
  reason,
  sourceId,
  beforeQty,
  afterQty,
  createdBy = "system",
}) {
  if (!companyId || !restaurantId || !itemId) {
    throw new Error("logInventoryMovement: missing identifiers");
  }

  const movementsRef = collection(
    db,
    "companies",
    companyId,
    "restaurants",
    restaurantId,
    "inventoryMovements"
  );

  const movementRef = doc(movementsRef);

  await movementRef.set({
    itemId,
    delta: Number(delta),
    reason,
    sourceId: sourceId || null,
    beforeQty: Number(beforeQty),
    afterQty: Number(afterQty),
    createdBy,
    createdAt: serverTimestamp(),
  });
}
