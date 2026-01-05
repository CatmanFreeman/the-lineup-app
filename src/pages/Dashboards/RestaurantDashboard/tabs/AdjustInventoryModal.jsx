// src/pages/Dashboards/RestaurantDashboard/tabs/AdjustInventoryModal.jsx
//
// Purpose:
// Manual inventory correction modal.
// - Allows + / - adjustments to on-hand inventory
// - Writes adjustment to onHand collection
// - Logs movement into inventory history
// - NO receipt logic
// - NO PAR edits
// - NO item catalog edits
//
// This is a LOCAL modal (Option A).
// Triggered from ItemCatalog "Adjust" button.
//

import React, { useState } from "react";
import {
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../../hooks/services/firebase";

export default function AdjustInventoryModal({
  open,
  onClose,
  companyId,
  restaurantId,
  item,
}) {
  if (!open || !item) return null;

  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // -----------------------------------
  // Save adjustment
  // -----------------------------------
  async function handleSave() {
    setError(null);

    const qtyDelta = Number(delta);

    if (!Number.isFinite(qtyDelta) || qtyDelta === 0) {
      setError("Adjustment quantity must be a non-zero number.");
      return;
    }

    if (!reason.trim()) {
      setError("Adjustment reason is required.");
      return;
    }

    setSaving(true);

    const onHandRef = doc(
      db,
      "companies",
      companyId,
      "restaurants",
      restaurantId,
      "onHand",
      item.id
    );

    const historyRef = doc(
      db,
      "companies",
      companyId,
      "restaurants",
      restaurantId,
      "inventoryHistory",
      crypto.randomUUID()
    );

    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(onHandRef);
        const currentQty = snap.exists() ? snap.data().qty || 0 : 0;
        const newQty = currentQty + qtyDelta;

        if (newQty < 0) {
          throw new Error("Resulting on-hand quantity cannot be negative.");
        }

        // Update on-hand quantity
        tx.set(
          onHandRef,
          {
            itemId: item.id,
            qty: newQty,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        // Log movement
        tx.set(historyRef, {
          itemId: item.id,
          itemName: item.name,
          category: item.category,
          unit: item.unit,
          delta: qtyDelta,
          previousQty: currentQty,
          newQty,
          reason,
          type: "manual_adjustment",
          createdAt: serverTimestamp(),
        });
      });

      onClose(true);
    } catch (err) {
      setError(err.message || "Failed to adjust inventory.");
    } finally {
      setSaving(false);
    }
  }

  // -----------------------------------
  // Render
  // -----------------------------------
  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 480 }}>
        <h3 style={{ marginBottom: 12 }}>Adjust Inventory</h3>

        <div style={{ marginBottom: 8 }}>
          <strong>{item.name}</strong>
        </div>

        <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 16 }}>
          Category: {item.category} • Unit: {item.unit}
        </div>

        {/* Quantity */}
        <div style={{ marginBottom: 12 }}>
          <label>Adjustment Amount</label>
          <input
            type="number"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="+5 or -3"
            style={{ width: "100%" }}
          />
        </div>

        {/* Reason */}
        <div style={{ marginBottom: 12 }}>
          <label>Reason</label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Cycle count correction, transfer, error fix…"
            style={{ width: "100%" }}
          />
        </div>

        {error && (
          <div style={{ color: "#ff6b6b", marginBottom: 10 }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={() => onClose(false)} disabled={saving}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Confirm Adjustment"}
          </button>
        </div>
      </div>
    </div>
  );
}
