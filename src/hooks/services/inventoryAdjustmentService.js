// src/hooks/services/inventoryAdjustmentService.js
//
// PURPOSE
// Centralized, atomic inventory adjustment engine.
//
// WHAT THIS FILE DOES
// 1) Adjusts on-hand inventory using a signed delta (+ / -)
// 2) Writes a durable inventory movement record
// 3) Guarantees consistency via Firestore transaction
// 4) Serves as the ONLY write-path for inventory changes
//
// USED BY (now or later)
// - Manual inventory adjustments
// - Waste logging
// - Spoilage logging
// - Corrections
// - Transfers (future)
// - Any admin override
//
// DESIGN PRINCIPLES
// - Single source of truth
// - Append-only history (never mutate movements)
// - Read models (alerts, reports) derive from this
//
// ------------------------------------------------------

import {
  doc,
  collection,
  runTransaction,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * adjustInventory
 *
 * @param {Object} args
 * @param {string} args.companyId
 * @param {string} args.restaurantId
 * @param {string} args.itemId
 * @param {number} args.deltaQty        // SIGNED number (+5, -2)
 * @param {string} args.reason          // e.g. "waste", "spoilage", "adjustment"
 * @param {string} args.source          // e.g. "manual", "receipt", "system"
 * @param {string} [args.note]          // optional free-text note
 */
export async function adjustInventory({
  companyId,
  restaurantId,
  itemId,
  deltaQty,
  reason,
  source,
  note = "",
}) {
  // --------------------------------------------------
  // Validation
  // --------------------------------------------------
  if (!companyId || !restaurantId || !itemId) {
    throw new Error(
      "adjustInventory: missing companyId, restaurantId, or itemId"
    );
  }

  const qty = Number(deltaQty);

  if (!Number.isFinite(qty) || qty === 0) {
    throw new Error(
      "adjustInventory: deltaQty must be a non-zero signed number"
    );
  }

  if (!reason || !source) {
    throw new Error(
      "adjustInventory: reason and source are required"
    );
  }

  // --------------------------------------------------
  // Firestore refs
  // --------------------------------------------------
  const onHandRef = doc(
    db,
    "companies",
    companyId,
    "restaurants",
    restaurantId,
    "onHand",
    itemId
  );

  const movementRef = doc(
    collection(
      db,
      "companies",
      companyId,
      "restaurants",
      restaurantId,
      "inventoryMovements"
    )
  );

  // --------------------------------------------------
  // Transaction
  // --------------------------------------------------
  await runTransaction(db, async (tx) => {
    const onHandSnap = await tx.get(onHandRef);
    const currentQty = onHandSnap.exists()
      ? Number(onHandSnap.data()?.qty || 0)
      : 0;

    const newQty = currentQty + qty;

    if (newQty < 0) {
      throw new Error(
        `adjustInventory: cannot reduce inventory below zero (current: ${currentQty}, delta: ${qty})`
      );
    }

    // -----------------------------
    // Update on-hand inventory
    // -----------------------------
    tx.set(
      onHandRef,
      {
        itemId,
        qty: increment(qty),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // -----------------------------
    // Write movement record
    // -----------------------------
    tx.set(movementRef, {
      itemId,
      deltaQty: qty,
      beforeQty: currentQty,
      afterQty: newQty,

      reason,          // waste | spoilage | adjustment | receipt | etc
      source,          // manual | system | import | api
      note: note || "",

      createdAt: serverTimestamp(),
    });
  });
}

// ------------------------------------------------------
// END OF FILE
// ------------------------------------------------------
