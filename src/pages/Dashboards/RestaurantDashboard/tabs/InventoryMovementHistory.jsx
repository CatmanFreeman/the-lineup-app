import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import { db } from "../../../../hooks/services/firebase";

export default function InventoryMovementHistory({ companyId }) {
  const { restaurantId } = useParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId || !restaurantId) return;

    async function load() {
      setLoading(true);

      const ref = collection(
        db,
        "companies",
        companyId,
        "restaurants",
        restaurantId,
        "inventoryMovements"
      );

      const q = query(ref, orderBy("createdAt", "desc"), limit(50));
      const snap = await getDocs(q);

      setRows(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );

      setLoading(false);
    }

    load();
  }, [companyId, restaurantId]);

  return (
    <div className="metric-card info" style={{ marginTop: 16 }}>
      <div className="metric-title">Inventory Activity</div>

      {loading ? (
        <div className="metric-subtext">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="metric-subtext">No inventory activity yet</div>
      ) : (
        <table style={{ width: "100%", marginTop: 10 }}>
          <thead>
            <tr>
              <th align="left">Item</th>
              <th align="right">Change</th>
              <th align="left">Reason</th>
              <th align="left">Source</th>
              <th align="right">Before → After</th>
              <th align="right">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.itemId}</td>
                <td align="right">
                  {r.delta > 0 ? `+${r.delta}` : r.delta}
                </td>
                <td>{r.reason}</td>
                <td>{r.sourceId || "—"}</td>
                <td align="right">
                  {r.beforeQty} → {r.afterQty}
                </td>
                <td align="right">
                  {r.createdAt?.toDate
                    ? r.createdAt.toDate().toLocaleDateString()
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
