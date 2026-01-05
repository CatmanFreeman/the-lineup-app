// src/hooks/services/inventoryService.js
// Purpose: Confirm receipts, manual adjustments, and waste logging
// Inventory ledger is the single source of truth

import {
  doc,
  runTransaction,
  serverTimestamp,
  increment,
  collection,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * confirmInventoryReceipt
 * (UNCHANGED — included here in full as requested)
 */
export async function confirmInventoryReceipt({
  companyId,
  restaurantId,
  receiptId,
  lineItems,
}) {
  if (!companyId || !restaurantId || !receiptId) {
    throw new Error("confirmInventoryReceipt: missing identifiers");
  }

  const cleaned = (Array.isArray(lineItems) ? lineItems : [])
    .map((r) => ({
      itemId: String(r?.itemId || "").trim(),
      qty: Number(r?.qty || 0),
    }))
    .filter((r) => r.itemId && Number.isFinite(r.qty) && r.qty > 0);

  if (cleaned.length === 0) {
    throw new Error("confirmInventoryReceipt: no valid line items");
  }

  const receiptRef = doc(
    db,
    "companies",
    companyId,
    "restaurants",
    restaurantId,
    "inventoryReceipts",
    receiptId
  );

  const movementsColRef = collection(
    db,
    "companies",
    companyId,
    "restaurants",
    restaurantId,
    "inventoryMovements"
  );

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(receiptRef);
    if (!snap.exists()) throw new Error("Receipt not found");

    const data = snap.data() || {};
    if (data.status === "confirmed") return;

    tx.update(receiptRef, {
      status: "confirmed",
      allocations: cleaned,
      confirmedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    for (const { itemId, qty } of cleaned) {
      const onHandRef = doc(
        db,
        "companies",
        companyId,
        "restaurants",
        restaurantId,
        "onHand",
        itemId
      );

      const onHandSnap = await tx.get(onHandRef);
      const beforeQty = onHandSnap.exists()
        ? Number(onHandSnap.data().qty || 0)
        : 0;
      const afterQty = beforeQty + qty;

      tx.set(
        onHandRef,
        {
          itemId,
          qty: increment(qty),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      tx.set(doc(movementsColRef), {
        itemId,
        delta: qty,
        beforeQty,
        afterQty,
        source: "receipt",
        reason: data.vendorName || "Inventory Receipt",
        receiptId,
        createdAt: serverTimestamp(),
      });
    }
  });
}

/**
 * adjustInventory
 * (UNCHANGED)
 */
export async function adjustInventory({
  companyId,
  restaurantId,
  itemId,
  delta,
  reason,
}) {
  if (!companyId || !restaurantId || !itemId) {
    throw new Error("adjustInventory: missing identifiers");
  }
  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error("adjustInventory: invalid delta");
  }

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

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(onHandRef);
    const beforeQty = snap.exists() ? Number(snap.data().qty || 0) : 0;
    const afterQty = beforeQty + delta;

    tx.set(
      onHandRef,
      {
        itemId,
        qty: afterQty,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    tx.set(movementRef, {
      itemId,
      delta,
      beforeQty,
      afterQty,
      reason,
      source: "manual_adjustment",
      createdAt: serverTimestamp(),
    });
  });
}

/**
 * logWaste
 * NEW — C4 Waste & Spoilage logging with $ loss
 */
export async function logWaste({
  companyId,
  restaurantId,
  itemId,
  qty,
  reason,
  note,
  unitCost = 0,
}) {
  if (!companyId || !restaurantId || !itemId) {
    throw new Error("logWaste: missing identifiers");
  }
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error("logWaste: qty must be positive");
  }

  const delta = -Math.abs(qty);
  const totalLoss = Math.abs(delta) * Number(unitCost || 0);

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

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(onHandRef);
    const beforeQty = snap.exists() ? Number(snap.data().qty || 0) : 0;
    const afterQty = beforeQty + delta;

    tx.set(
      onHandRef,
      {
        itemId,
        qty: afterQty,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    tx.set(movementRef, {
      itemId,
      delta,
      beforeQty,
      afterQty,
      source: "waste",
      reason,
      note: note || "",
      unitCost: Number(unitCost || 0),
      totalLoss,
      createdAt: serverTimestamp(),
    });
  });
}
