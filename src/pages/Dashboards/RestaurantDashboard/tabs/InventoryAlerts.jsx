// src/pages/Dashboards/RestaurantDashboard/tabs/InventoryAlerts.jsx

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../../hooks/services/firebase";

/**
 * InventoryAlerts
 *
 * RESPONSIBILITY
 * --------------
 * - Read-only alert computation (LOW / CRITICAL)
 * - Restaurant-level threshold loading + editing
 * - Sorting, filtering, acknowledgement (local-only)
 * - Safe rendering states (loading / error / empty)
 *
 * DATA CONTRACT
 * -------------
 * rows[] items must include:
 *  id, name, category, qty, par
 *
 * SETTINGS LOCATION
 * -----------------
 * /companies/{companyId}/restaurants/{restaurantId}/settings/inventory
 *
 * SETTINGS SHAPE
 * --------------
 * {
 *   lowPercent: number,
 *   criticalPercent: number,
 *   updatedAt: Timestamp
 * }
 */

export default function InventoryAlerts({
  rows = [],
  companyId = "company-demo",
  restaurantId = "123",
}) {
  // ---------------------------------------------------------------------------
  // Threshold state
  // ---------------------------------------------------------------------------
  const [thresholds, setThresholds] = useState({
    lowPercent: 0.5,
    criticalPercent: 0.25,
  });

  const [editingThresholds, setEditingThresholds] = useState(false);
  const [draftLow, setDraftLow] = useState(0.5);
  const [draftCritical, setDraftCritical] = useState(0.25);

  // ---------------------------------------------------------------------------
  // UI state
  // ---------------------------------------------------------------------------
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [sortKey, setSortKey] = useState("severity"); // severity | qty | name
  const [sortDir, setSortDir] = useState("asc"); // asc | desc
  const [filter, setFilter] = useState("ALL"); // ALL | CRITICAL | LOW

  const [acknowledged, setAcknowledged] = useState(() => new Set());

  const savingRef = useRef(false);

  // ---------------------------------------------------------------------------
  // Load thresholds
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let mounted = true;

    async function loadThresholds() {
      setLoading(true);
      setLoadError(null);

      try {
        const ref = doc(
          db,
          "companies",
          companyId,
          "restaurants",
          restaurantId,
          "settings",
          "inventory"
        );

        const snap = await getDoc(ref);

        if (!mounted) return;

        if (snap.exists()) {
          const data = snap.data() || {};
          const low =
            typeof data.lowPercent === "number" ? data.lowPercent : 0.5;
          const critical =
            typeof data.criticalPercent === "number"
              ? data.criticalPercent
              : 0.25;

          setThresholds({ lowPercent: low, criticalPercent: critical });
          setDraftLow(low);
          setDraftCritical(critical);
        } else {
          setThresholds({ lowPercent: 0.5, criticalPercent: 0.25 });
          setDraftLow(0.5);
          setDraftCritical(0.25);
        }
      } catch (err) {
        console.error(err);
        if (mounted) {
          setLoadError("Failed to load inventory alert thresholds");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadThresholds();
    return () => {
      mounted = false;
    };
  }, [companyId, restaurantId]);

  // ---------------------------------------------------------------------------
  // Save thresholds
  // ---------------------------------------------------------------------------
  const saveThresholds = useCallback(async () => {
    if (savingRef.current) return;

    const low = Number(draftLow);
    const critical = Number(draftCritical);

    if (!Number.isFinite(low) || !Number.isFinite(critical)) return;
    if (critical <= 0 || low <= 0 || critical >= low) return;

    savingRef.current = true;

    const ref = doc(
      db,
      "companies",
      companyId,
      "restaurants",
      restaurantId,
      "settings",
      "inventory"
    );

    await setDoc(
      ref,
      {
        lowPercent: low,
        criticalPercent: critical,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    setThresholds({ lowPercent: low, criticalPercent: critical });
    setEditingThresholds(false);
    savingRef.current = false;
  }, [companyId, restaurantId, draftLow, draftCritical]);

  // ---------------------------------------------------------------------------
  // Alert computation
  // ---------------------------------------------------------------------------
  const alerts = useMemo(() => {
    if (!Array.isArray(rows) || rows.length === 0) return [];

    return rows
      .map((row) => {
        const par = Number(row.par || 0);
        const qty = Number(row.qty || 0);

        if (!Number.isFinite(par) || par <= 0) return null;

        const lowLevel = par * thresholds.lowPercent;
        const criticalLevel = par * thresholds.criticalPercent;

        if (qty <= criticalLevel) {
          return { ...row, status: "CRITICAL", severity: 2 };
        }

        if (qty <= lowLevel) {
          return { ...row, status: "LOW", severity: 1 };
        }

        return null;
      })
      .filter(Boolean);
  }, [rows, thresholds]);

  // ---------------------------------------------------------------------------
  // Derived counts
  // ---------------------------------------------------------------------------
  const counts = useMemo(() => {
    let low = 0;
    let critical = 0;

    alerts.forEach((a) => {
      if (a.status === "LOW") low += 1;
      if (a.status === "CRITICAL") critical += 1;
    });

    return { low, critical, total: alerts.length };
  }, [alerts]);

  // ---------------------------------------------------------------------------
  // Filter + sort
  // ---------------------------------------------------------------------------
  const visibleAlerts = useMemo(() => {
    let list = alerts;

    if (filter !== "ALL") {
      list = list.filter((a) => a.status === filter);
    }

    if (sortKey === "severity") {
      list = [...list].sort((a, b) =>
        sortDir === "asc"
          ? a.severity - b.severity
          : b.severity - a.severity
      );
    }

    if (sortKey === "qty") {
      list = [...list].sort((a, b) =>
        sortDir === "asc" ? a.qty - b.qty : b.qty - a.qty
      );
    }

    if (sortKey === "name") {
      list = [...list].sort((a, b) =>
        sortDir === "asc"
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name)
      );
    }

    return list;
  }, [alerts, filter, sortKey, sortDir]);

  // ---------------------------------------------------------------------------
  // Acknowledge handling (local-only)
  // ---------------------------------------------------------------------------
  const toggleAck = useCallback((id) => {
    setAcknowledged((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Render: loading
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="metric-card warning" style={{ marginTop: 16 }}>
        <div className="metric-title">Inventory Alerts</div>
        <div className="metric-subtext">Loading alert thresholds…</div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: error
  // ---------------------------------------------------------------------------
  if (loadError) {
    return (
      <div className="metric-card danger" style={{ marginTop: 16 }}>
        <div className="metric-title">Inventory Alerts</div>
        <div className="metric-subtext">{loadError}</div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: empty
  // ---------------------------------------------------------------------------
  if (alerts.length === 0) {
    return (
      <div className="metric-card info" style={{ marginTop: 16 }}>
        <div className="metric-title">Inventory Alerts</div>
        <div className="metric-subtext">
          All inventory is within safe thresholds
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="metric-card danger" style={{ marginTop: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div className="metric-title">Inventory Alerts</div>
        <button onClick={() => setEditingThresholds((v) => !v)}>
          Thresholds
        </button>
      </div>

      {editingThresholds && (
        <div style={{ marginTop: 10, display: "flex", gap: 12 }}>
          <label>
            Low %
            <input
              type="number"
              step="0.05"
              value={draftLow}
              onChange={(e) => setDraftLow(e.target.value)}
            />
          </label>
          <label>
            Critical %
            <input
              type="number"
              step="0.05"
              value={draftCritical}
              onChange={(e) => setDraftCritical(e.target.value)}
            />
          </label>
          <button onClick={saveThresholds}>Save</button>
          <button onClick={() => setEditingThresholds(false)}>
            Cancel
          </button>
        </div>
      )}

      <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
        <span>Critical: {counts.critical}</span>
        <span>Low: {counts.low}</span>
        <span>Total: {counts.total}</span>
      </div>

      <table style={{ width: "100%", marginTop: 12 }}>
        <thead>
          <tr>
            <th align="left">Item</th>
            <th align="left">Category</th>
            <th align="right">Qty</th>
            <th align="right">PAR</th>
            <th align="left">Status</th>
            <th align="center">Ack</th>
          </tr>
        </thead>
        <tbody>
          {visibleAlerts.map((item) => (
            <tr
              key={item.id}
              style={{
                opacity: acknowledged.has(item.id) ? 0.5 : 1,
              }}
            >
              <td>{item.name}</td>
              <td>{item.category}</td>
              <td align="right">{item.qty}</td>
              <td align="right">{item.par}</td>
              <td
                style={{
                  fontWeight: 800,
                  color:
                    item.status === "CRITICAL"
                      ? "#ef4444"
                      : "#f59e0b",
                }}
              >
                {item.status}
              </td>
              <td align="center">
                <input
                  type="checkbox"
                  checked={acknowledged.has(item.id)}
                  onChange={() => toggleAck(item.id)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
