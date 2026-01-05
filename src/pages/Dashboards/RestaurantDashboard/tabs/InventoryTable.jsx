import React, { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../../../hooks/services/firebase";

/**
 * InventoryTable
 *
 * - Displays inventory per restaurant
 * - + / – controls update onHand in Firestore
 * - Status is computed (OK / LOW / OUT)
 *
 * Firestore:
 * - Company items: /companies/{companyId}/items
 * - Restaurant inventory: /companies/{companyId}/restaurants/{restaurantId}/items/{itemId}
 */

export default function InventoryTable({ companyId, restaurantId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);

  useEffect(() => {
    if (!companyId || !restaurantId) return;
    loadInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, restaurantId]);

  async function loadInventory() {
    setLoading(true);

    // 1️⃣ Company items
    const itemsSnap = await getDocs(
      collection(db, "companies", companyId, "items")
    );

    const items = {};
    itemsSnap.forEach((d) => {
      const data = d.data() || {};
      items[d.id] = {
        id: d.id,
        name: data.name || d.id,
        category: normalizeCategory(data.category),
        unit: data.unit || "—",
        parLevel: Number(data.parLevel ?? 0),
      };
    });

    // 2️⃣ Restaurant inventory
    const invSnap = await getDocs(
      collection(
        db,
        "companies",
        companyId,
        "restaurants",
        restaurantId,
        "items"
      )
    );

    const inventory = {};
    invSnap.forEach((d) => {
      inventory[d.id] = Number(d.data()?.onHand ?? 0);
    });

    // 3️⃣ Merge
    const merged = Object.values(items).map((item) => {
      const onHand = inventory[item.id] ?? 0;
      return {
        ...item,
        onHand,
        status: computeStatus(onHand, item.parLevel),
      };
    });

    setRows(merged);
    setLoading(false);
  }

  // -------------------------
  // Inventory update
  // -------------------------

  async function changeOnHand(itemId, delta) {
    if (updating === itemId) return;
    setUpdating(itemId);

    const ref = doc(
      db,
      "companies",
      companyId,
      "restaurants",
      restaurantId,
      "items",
      itemId
    );

    const row = rows.find((r) => r.id === itemId);
    const nextValue = Math.max(0, (row?.onHand ?? 0) + delta);

    try {
      await setDoc(
        ref,
        { onHand: nextValue },
        { merge: true }
      );

      setRows((prev) =>
        prev.map((r) =>
          r.id === itemId
            ? {
                ...r,
                onHand: nextValue,
                status: computeStatus(nextValue, r.parLevel),
              }
            : r
        )
      );
    } finally {
      setUpdating(null);
    }
  }

  // -------------------------
  // Helpers
  // -------------------------

  function normalizeCategory(value) {
    if (!value) return "—";
    const s = String(value).trim();
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }

  function computeStatus(onHand, par) {
    if (onHand <= 0) return "OUT";
    if (onHand < par) return "LOW";
    return "OK";
  }

  // -------------------------
  // Render
  // -------------------------

  if (loading) {
    return (
      <div className="metric-card info" style={{ marginTop: 16 }}>
        <div className="metric-title">Inventory Status</div>
        <div className="metric-subtext">Loading…</div>
      </div>
    );
  }

  return (
    <div className="metric-card info" style={{ marginTop: 16 }}>
      <div className="metric-title">Inventory Status</div>

      <table style={{ width: "100%", marginTop: 10 }}>
        <thead>
          <tr>
            <th align="left">Item</th>
            <th align="left">Category</th>
            <th align="right">On Hand</th>
            <th align="right">Par</th>
            <th align="center">Status</th>
            <th align="center">Adjust</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.name}</td>
              <td>{row.category}</td>
              <td align="right">
                {row.onHand} {row.unit}
              </td>
              <td align="right">
                {row.parLevel} {row.unit}
              </td>
              <td align="center">
                <StatusPill status={row.status} />
              </td>
              <td align="center">
                <button
                  onClick={() => changeOnHand(row.id, -1)}
                  disabled={updating === row.id}
                  style={{ marginRight: 6 }}
                >
                  −
                </button>
                <button
                  onClick={() => changeOnHand(row.id, +1)}
                  disabled={updating === row.id}
                >
                  +
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// -------------------------
// Status Pill
// -------------------------

function StatusPill({ status }) {
  const colors = {
    OK: "#16a34a",
    LOW: "#f59e0b",
    OUT: "#dc2626",
  };

  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        color: "#fff",
        background: colors[status] || "#6b7280",
      }}
    >
      {status}
    </span>
  );
}
