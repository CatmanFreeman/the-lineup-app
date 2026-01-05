import React, { useState } from "react";
import {
  addDoc,
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../../hooks/services/firebase";

/**
 * InventoryWasteInline
 * - Inline waste logger for a single item row
 * - Decrements on-hand qty atomically
 * - Creates waste record
 * - Creates inventory movement record
 *
 * Props:
 *  companyId
 *  restaurantId
 *  item { id, name, qty }
 *  onDone()  // callback to refresh on-hand + history
 */

export default function InventoryWasteInline({
  companyId,
  restaurantId,
  item,
  onDone,
}) {
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("spoilage");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function confirmWaste() {
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Enter a valid quantity.");
      return;
    }
    if (n > item.qty) {
      setError("Waste cannot exceed on-hand quantity.");
      return;
    }

    setSaving(true);
    setError("");

    const onHandRef = doc(
      db,
      "companies",
      companyId,
      "restaurants",
      restaurantId,
      "onHand",
      item.id
    );

    const wasteRef = collection(
      db,
      "companies",
      companyId,
      "restaurants",
      restaurantId,
      "waste"
    );

    const movementRef = collection(
      db,
      "companies",
      companyId,
      "restaurants",
      restaurantId,
      "inventoryMovements"
    );

    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(onHandRef);
        if (!snap.exists()) {
          throw new Error("On-hand record not found.");
        }

        const currentQty = Number(snap.data().qty || 0);
        if (currentQty < n) {
          throw new Error("Insufficient on-hand quantity.");
        }

        // Decrement on-hand
        tx.update(onHandRef, {
          qty: currentQty - n,
          updatedAt: serverTimestamp(),
        });

        // Waste record
        const wasteDoc = doc(wasteRef);
        tx.set(wasteDoc, {
          itemId: item.id,
          qty: n,
          reason,
          createdAt: serverTimestamp(),
        });

        // Movement record
        const moveDoc = doc(movementRef);
        tx.set(moveDoc, {
          type: "waste",
          itemId: item.id,
          qty: n,
          reason,
          createdAt: serverTimestamp(),
        });
      });

      if (typeof onDone === "function") onDone();
    } catch (e) {
      setError(e.message || "Failed to log waste.");
    } finally {
      setSaving(false);
      setQty("");
    }
  }

  return (
    <div
      style={{
        marginTop: 8,
        padding: 10,
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.04)",
        display: "flex",
        gap: 10,
        alignItems: "center",
      }}
    >
      <strong style={{ minWidth: 120 }}>Log Waste</strong>

      <input
        type="number"
        min="0"
        placeholder="Qty"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        style={{ width: 80 }}
        disabled={saving}
      />

      <select
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        disabled={saving}
      >
        <option value="spoilage">Spoilage</option>
        <option value="prep">Prep</option>
        <option value="comp">Comp</option>
        <option value="theft">Theft</option>
        <option value="other">Other</option>
      </select>

      <button onClick={confirmWaste} disabled={saving}>
        Confirm
      </button>

      {error && (
        <span style={{ color: "#fecaca", fontSize: 12 }}>{error}</span>
      )}
    </div>
  );
}
