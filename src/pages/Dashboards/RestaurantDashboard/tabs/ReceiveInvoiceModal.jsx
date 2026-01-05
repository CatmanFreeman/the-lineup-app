// src/pages/Dashboards/RestaurantDashboard/tabs/ReceiveInvoiceModal.jsx

import React, { useState } from "react";
import { addDoc, collection, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { db } from "../../../../hooks/services/firebase";
import VendorSelect from "./VendorSelect";

export default function ReceiveInvoiceModal({
  companyId,
  restaurantId,
  onClose,
  onSaved,
}) {
  const [vendorId, setVendorId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [itemCount, setItemCount] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!vendorId || !totalCost) return;

    setSaving(true);

    const vendorSnap = await getDoc(
      doc(db, "companies", companyId, "vendors", vendorId)
    );

    const vendorName = vendorSnap.exists()
      ? vendorSnap.data().name
      : "Unknown";

    await addDoc(
      collection(
        db,
        "companies",
        companyId,
        "restaurants",
        restaurantId,
        "inventoryReceipts"
      ),
      {
        vendorId,
        vendorName,
        invoiceNumber,
        totalCost: Number(totalCost),
        itemCount: Number(itemCount || 0),
        receivedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      }
    );

    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div style={overlayStyle}>
      <form onSubmit={handleSubmit} style={modalStyle}>
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>
          Receive Inventory
        </h3>

        <div style={formGrid}>
          <label>Vendor</label>
          <VendorSelect
            companyId={companyId}
            value={vendorId}
            onChange={setVendorId}
          />

          <label>Invoice #</label>
          <input
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
          />

          <label>Total Cost</label>
          <input
            type="number"
            step="0.01"
            value={totalCost}
            onChange={(e) => setTotalCost(e.target.value)}
            required
          />

          <label>Item Count</label>
          <input
            type="number"
            value={itemCount}
            onChange={(e) => setItemCount(e.target.value)}
          />
        </div>

        <div style={actionsRow}>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save Invoice"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ===== styles (unchanged) ===== */

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.7)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
};

const modalStyle = {
  background: "#020617",
  borderRadius: 14,
  padding: 24,
  width: 420,
  color: "#ffffff",
  border: "1px solid rgba(255,255,255,0.12)",
};

const formGrid = {
  display: "grid",
  gridTemplateColumns: "120px 1fr",
  gap: "10px 14px",
  alignItems: "center",
};

const actionsRow = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  marginTop: 20,
};
