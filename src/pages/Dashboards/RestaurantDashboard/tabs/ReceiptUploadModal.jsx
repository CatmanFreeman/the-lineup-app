// src/pages/Dashboards/RestaurantDashboard/tabs/ReceiptUploadModal.jsx

import React, { useMemo, useState } from "react";
import {
  addDoc,
  collection,
  serverTimestamp,
  updateDoc,
  doc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

import { db, storage } from "../../../../hooks/services/firebase";

/**
 * ReceiptUploadModal (C3.1)
 * - Creates an inventoryReceipt doc with status = pending_review
 * - Uploads 1..N images to Firebase Storage
 * - Writes receiptImageURLs[] back to the receipt doc
 *
 * Note: No parsing here yet. This is ingestion only.
 */
export default function ReceiptUploadModal({
  companyId,
  restaurantId,
  onClose,
  onCreated,
}) {
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => files.length > 0 && !saving, [files, saving]);

  function handlePickFiles(e) {
    const picked = Array.from(e.target.files || []);
    setFiles(picked);
    setError("");
  }

  async function handleUpload(e) {
    e.preventDefault();
    setError("");

    if (files.length === 0) {
      setError("Please select at least one receipt image.");
      return;
    }

    setSaving(true);

    try {
      // 1) Create the receipt doc first (so we have receiptId for Storage paths)
      const receiptRef = await addDoc(
        collection(
          db,
          "companies",
          companyId,
          "restaurants",
          restaurantId,
          "inventoryReceipts"
        ),
        {
          status: "pending_review",
          receiptImageURLs: [],
          createdAt: serverTimestamp(),
          receivedAt: serverTimestamp(),
          // Parsing will fill these later:
          vendorId: "",
          vendorName: "",
          invoiceNumber: "",
          totalCost: 0,
          itemCount: 0,
        }
      );

      const receiptId = receiptRef.id;

      // 2) Upload all images and collect URLs
      const urls = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const storagePath = [
          "companies",
          companyId,
          "restaurants",
          restaurantId,
          "inventoryReceipts",
          receiptId,
          "images",
          `${String(i + 1).padStart(2, "0")}-${Date.now()}-${safeName}`,
        ].join("/");

        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        urls.push(url);
      }

      // 3) Update receipt doc with image URLs
      await updateDoc(
        doc(
          db,
          "companies",
          companyId,
          "restaurants",
          restaurantId,
          "inventoryReceipts",
          receiptId
        ),
        {
          receiptImageURLs: urls,
          updatedAt: serverTimestamp(),
        }
      );

      onCreated?.();
      onClose();
    } catch (err) {
      console.error(err);
      setError(
        "Upload failed. Check Storage permissions and that `storage` is exported from firebase.js."
      );
      setSaving(false);
      return;
    }

    setSaving(false);
  }

  return (
    <div style={overlayStyle}>
      <form onSubmit={handleUpload} style={modalStyle}>
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>
          Upload Receipt Photos
        </h3>

        <div style={{ opacity: 0.85, fontSize: 13, marginBottom: 12 }}>
          Upload front/back or multiple pages. This creates a receipt in{" "}
          <strong>Pending Review</strong> until items are confirmed.
        </div>

        <div style={formRow}>
          <label style={labelStyle}>Receipt Images</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handlePickFiles}
          />
        </div>

        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 8 }}>
          Selected: <strong>{files.length}</strong>
        </div>

        {error && (
          <div style={{ marginTop: 10, color: "#fca5a5", fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={actionsRow}>
          <button type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" disabled={!canSubmit}>
            {saving ? "Uploading…" : "Upload"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ================= STYLES ================= */

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
  padding: 22,
  width: 520,
  color: "#ffffff",
  border: "1px solid rgba(255,255,255,0.12)",
};

const formRow = {
  display: "grid",
  gridTemplateColumns: "140px 1fr",
  gap: "10px 14px",
  alignItems: "center",
};

const labelStyle = {
  fontSize: 13,
  opacity: 0.9,
};

const actionsRow = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  marginTop: 18,
};
