// src/pages/Dashboards/RestaurantDashboard/tabs/InventoryTab.jsx

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  Fragment,
} from "react";
import { useParams } from "react-router-dom";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../../../hooks/services/firebase";
import SimpleLineChart from "../../../../components/charts/SimpleLineChart";

// ==============================
// UI / Components
// ==============================
import InventoryAlerts from "./InventoryAlerts";
import ReceiveInvoiceModal from "./ReceiveInvoiceModal";
import ReceiptUploadModal from "./ReceiptUploadModal";
import ItemCatalog from "./ItemCatalog";
import ReceiptReviewModal from "./ReceiptReviewModal";
import InventoryMovementHistory from "./InventoryMovementHistory";
import { getBowlingInventorySummary } from "../../../../utils/bowlingInventoryService";

import "./OverviewTab.css";

// ==============================
// Constants / Helpers
// ==============================

const COMPANY_ID = "company-demo";
const EMPTY_TEXT = "—";

// ==============================
// Formatting Utilities
// ==============================

function formatCurrency(value) {
  const n = Number(value || 0);
  return `$${n.toFixed(2)}`;
}

function formatDate(ts) {
  if (!ts || !ts.toDate) return EMPTY_TEXT;
  return ts.toDate().toLocaleDateString();
}

function clampNumber(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function safeLower(s) {
  return String(s || "").toLowerCase();
}

// ==============================
// Data Utilities
// ==============================

function mapById(arr = []) {
  const map = {};
  arr.forEach((item) => {
    if (item?.id) map[item.id] = item;
  });
  return map;
}

function normalizeItem(item, fallbackId) {
  return {
    id: fallbackId,
    name: item?.name || fallbackId,
    category: item?.category || EMPTY_TEXT,
    unit: item?.unit || EMPTY_TEXT,
  };
}

// ==============================
// Inventory Status Logic
// ==============================

function computeStatus(qty, par) {
  const q = Number(qty ?? 0);
  const p = Number(par ?? 0);

  if (!p || p <= 0) return "UNSET";
  if (q >= p) return "OK";
  if (q >= p * 0.5) return "LOW";
  return "CRITICAL";
}

function statusColor(status) {
  if (status === "OK") return "#22c55e";
  if (status === "LOW") return "#facc15";
  if (status === "CRITICAL") return "#ef4444";
  return "#9ca3af";
}

function statusLabel(status) {
  if (status === "OK") return "OK";
  if (status === "LOW") return "Low";
  if (status === "CRITICAL") return "Critical";
  return "Unset";
}

// ==============================
// Hooks
// ==============================

function useWindowWidth() {
  const [width, setWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 0
  );

  useEffect(() => {
    function onResize() {
      setWidth(window.innerWidth);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return width;
}

function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function useKeyboardShortcut(key, handler) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === key) handler();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key, handler]);
}

// ==============================
// Derived UI Components
// ==============================

function InventoryHealthSummary({ rows }) {
  const summary = useMemo(() => {
    let ok = 0;
    let low = 0;
    let critical = 0;
    let unset = 0;

    rows.forEach((r) => {
      if (r.status === "OK") ok += 1;
      else if (r.status === "LOW") low += 1;
      else if (r.status === "CRITICAL") critical += 1;
      else unset += 1;
    });

    return { ok, low, critical, unset, total: rows.length };
  }, [rows]);

  return (
    <>
      {/* Health Summary - 2 cards per row */}
      <div className="kpi-grid kpi-grid--row" style={{ marginTop: 16 }}>
        <div className="metric-card info">
          <div className="metric-title">Total</div>
          <div className="metric-value">{summary.total}</div>
        </div>
        <div className="metric-card info">
          <div className="metric-title">OK</div>
          <div className="metric-value">{summary.ok}</div>
        </div>
      </div>
      <div className="kpi-grid kpi-grid--row">
        <div className="metric-card warning">
          <div className="metric-title">Low</div>
          <div className="metric-value">{summary.low}</div>
        </div>
        <div className="metric-card danger">
          <div className="metric-title">Critical</div>
          <div className="metric-value">{summary.critical}</div>
        </div>
      </div>
      <div className="kpi-grid kpi-grid--row">
        <div className="metric-card info">
          <div className="metric-title">Unset PAR</div>
          <div className="metric-value">{summary.unset}</div>
        </div>
        <div></div>
      </div>
    </>
  );
}

function InventoryTrendsChart({ rows, restaurantId, companyId }) {
  const [trendData, setTrendData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTrendData = async () => {
      if (!restaurantId || !companyId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Load last 30 days of inventory movements
        const movementsRef = collection(
          db,
          "companies",
          companyId,
          "restaurants",
          restaurantId,
          "inventoryMovements"
        );

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoISO = thirtyDaysAgo.toISOString().split('T')[0];
        
        try {
          const q = query(
            movementsRef,
            where("date", ">=", thirtyDaysAgoISO),
            orderBy("date", "desc"),
            limit(200)
          );

          const snap = await getDocs(q);
          
          // Group by date and calculate daily totals
          const dailyData = {};
          snap.docs.forEach((doc) => {
            const data = doc.data();
            const date = data.date || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString().split('T')[0] : null);
            if (!date) return;

            if (!dailyData[date]) {
              dailyData[date] = { date, totalQty: 0, itemCount: 0, items: new Set() };
            }

            // Sum quantities (assuming movements have qtyAfter or quantity)
            const qty = Number(data.qtyAfter || data.quantity || data.qty || 0);
            dailyData[date].totalQty += qty;
            dailyData[date].itemCount += 1;
            
            // Track unique items
            if (data.itemId) {
              dailyData[date].items.add(data.itemId);
            }
          });

          // Convert to array and calculate coverage
          const chartData = Object.values(dailyData)
            .map((day) => {
              // Get average PAR for items on this day
              const dayItems = Array.from(day.items);
              const dayPar = rows
                .filter((r) => dayItems.includes(r.id))
                .reduce((sum, r) => sum + Number(r.par || 0), 0);
              
              const coverage = dayPar > 0 
                ? Math.round((day.totalQty / dayPar) * 100) 
                : 0;

              return {
                date: day.date,
                label: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                value: coverage,
                qty: day.totalQty,
                par: dayPar,
              };
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date));

          setTrendData(chartData);
        } catch (queryError) {
          // If query fails (e.g., no index), try without date filter
          console.warn("Date-filtered query failed, trying without filter:", queryError);
          const q = query(
            movementsRef,
            orderBy("date", "desc"),
            limit(200)
          );
          const snap = await getDocs(q);
          
          const dailyData = {};
          snap.docs.forEach((doc) => {
            const data = doc.data();
            const date = data.date || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString().split('T')[0] : null);
            if (!date) return;

            if (!dailyData[date]) {
              dailyData[date] = { date, totalQty: 0, itemCount: 0, items: new Set() };
            }

            const qty = Number(data.qtyAfter || data.quantity || data.qty || 0);
            dailyData[date].totalQty += qty;
            dailyData[date].itemCount += 1;
            
            if (data.itemId) {
              dailyData[date].items.add(data.itemId);
            }
          });

          // Filter to last 30 days in memory
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          
          const chartData = Object.values(dailyData)
            .filter(day => new Date(day.date) >= thirtyDaysAgo)
            .map((day) => {
              const dayItems = Array.from(day.items);
              const dayPar = rows
                .filter((r) => dayItems.includes(r.id))
                .reduce((sum, r) => sum + Number(r.par || 0), 0);
              
              const coverage = dayPar > 0 
                ? Math.round((day.totalQty / dayPar) * 100) 
                : 0;

              return {
                date: day.date,
                label: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                value: coverage,
                qty: day.totalQty,
                par: dayPar,
              };
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date));

          setTrendData(chartData);
        }
      } catch (error) {
        console.error("Error loading inventory trends:", error);
        setTrendData([]);
      } finally {
        setLoading(false);
      }
    };

    loadTrendData();
  }, [rows, restaurantId, companyId]);

  const totals = useMemo(() => {
    let totalQty = 0;
    let totalPar = 0;

    rows.forEach((r) => {
      totalQty += Number(r.qty || 0);
      totalPar += Number(r.par || 0);
    });

    const coverage = totalPar > 0 ? Math.round((totalQty / totalPar) * 100) : 0;

    return { totalQty, totalPar, coverage };
  }, [rows]);

  if (loading) {
    return (
      <div className="metric-card info" style={{ marginTop: 16 }}>
        <div className="metric-title">Inventory Trends</div>
        <div className="metric-subtext" style={{ marginTop: 6 }}>
          Loading trend data...
        </div>
      </div>
    );
  }

  return (
    <div className="metric-card info" style={{ marginTop: 16 }}>
      <div className="metric-title">Inventory Trends (30 Days)</div>
      {trendData.length > 0 ? (
        <div style={{ marginTop: 12, height: 200 }}>
          <SimpleLineChart
            data={trendData}
            dataKey="value"
            nameKey="label"
            stroke="#4caf50"
            label="PAR Coverage %"
          />
        </div>
      ) : (
        <div className="metric-subtext" style={{ marginTop: 6 }}>
          No trend data available yet. Start tracking inventory movements to see trends.
        </div>
      )}
      <div style={{ marginTop: 12, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div className="metric-subtext">
          Total Units On Hand: {totals.totalQty}
        </div>
        <div className="metric-subtext">
          Total PAR Units: {totals.totalPar}
        </div>
        <div className="metric-subtext">
          PAR Coverage: {totals.coverage}%
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const bg = statusColor(status);
  const label = statusLabel(status);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 10px",
        borderRadius: 999,
        border: `1px solid ${bg}`,
        color: "#fff",
        background: "rgba(255,255,255,0.03)",
        fontWeight: 800,
        fontSize: 12,
        letterSpacing: 0.2,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: bg,
          display: "inline-block",
        }}
      />
      {label}
    </span>
  );
}

// ==============================
// Main Component
// ==============================

export default function InventoryTab() {
  const { restaurantId } = useParams();
  const windowWidth = useWindowWidth();

  // -----------------------------
  // Receipt State
  // -----------------------------
  const [receipts, setReceipts] = useState([]);
  const [loadingReceipts, setLoadingReceipts] = useState(true);

  // -----------------------------
  // Inventory State
  // -----------------------------
  const [items, setItems] = useState([]);
  const [onHand, setOnHand] = useState([]);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [bowlingInventory, setBowlingInventory] = useState(null);
  const [loadingBowlingInventory, setLoadingBowlingInventory] = useState(false);
  const [hasBowling, setHasBowling] = useState(false);

  // -----------------------------
  // UI State
  // -----------------------------
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [reviewReceipt, setReviewReceipt] = useState(null);

  const [healthFilter, setHealthFilter] = useState("ALL"); // ALL | OK | LOW | CRITICAL | UNSET
  const [searchText, setSearchText] = useState("");
  const [sortKey, setSortKey] = useState("NAME"); // NAME | STATUS | QTY | PAR | UPDATED
  const [sortDir, setSortDir] = useState("ASC"); // ASC | DESC

  // -----------------------------
  // Inline PAR Editing State
  // -----------------------------
  const [editingPar, setEditingPar] = useState({});
  const [savingPar, setSavingPar] = useState({});

  // -----------------------------
  // Keyboard shortcuts
  // -----------------------------
  useKeyboardShortcut("n", () => setShowReceiveModal(true));
  useKeyboardShortcut("u", () => setShowUploadModal(true));
  useKeyboardShortcut("Escape", () => {
    setShowReceiveModal(false);
    setShowUploadModal(false);
    setReviewReceipt(null);
  });

  // -----------------------------
  // Data Loaders
  // -----------------------------

  const loadReceipts = useCallback(async () => {
    setLoadingReceipts(true);
    const ref = collection(
      db,
      "companies",
      COMPANY_ID,
      "restaurants",
      restaurantId,
      "inventoryReceipts"
    );
    const q = query(ref, orderBy("receivedAt", "desc"), limit(10));
    const snap = await getDocs(q);
    setReceipts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoadingReceipts(false);
  }, [restaurantId]);

  const loadItems = useCallback(async () => {
    const ref = collection(db, "companies", COMPANY_ID, "items");
    const snap = await getDocs(ref);
    setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, []);

  const loadOnHand = useCallback(async () => {
    setLoadingInventory(true);

    const ref = collection(
      db,
      "companies",
      COMPANY_ID,
      "restaurants",
      restaurantId,
      "onHand"
    );

    const snap = await getDocs(ref);
    setOnHand(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoadingInventory(false);
  }, [restaurantId]);

  // Load bowling inventory if restaurant has bowling
  const loadBowlingInventory = useCallback(async () => {
    if (!restaurantId) return;
    
    try {
      // Check if restaurant has bowling enabled
      const restaurantRef = doc(db, "restaurants", restaurantId);
      const restaurantSnap = await getDoc(restaurantRef);
      
      if (restaurantSnap.exists()) {
        const restaurantData = restaurantSnap.data();
        const hasBowlingAttraction = restaurantData.attractions?.bowling === true;
        setHasBowling(hasBowlingAttraction);
        
        if (hasBowlingAttraction) {
          setLoadingBowlingInventory(true);
          const summary = await getBowlingInventorySummary(restaurantId);
          setBowlingInventory(summary);
          setLoadingBowlingInventory(false);
        }
      }
    } catch (error) {
      console.error("Error loading bowling inventory:", error);
      setLoadingBowlingInventory(false);
    }
  }, [restaurantId]);

  // -----------------------------
  // Initial Load
  // -----------------------------
  useEffect(() => {
    if (!restaurantId) return;
    loadReceipts();
    loadItems();
    loadOnHand();
    loadBowlingInventory();
  }, [restaurantId, loadReceipts, loadItems, loadOnHand, loadBowlingInventory]);

  // -----------------------------
  // Derived Metrics
  // -----------------------------
  const totals = useMemo(() => {
    let spend = 0;
    receipts.forEach((r) => (spend += Number(r.totalCost || 0)));
    return { count: receipts.length, spend };
  }, [receipts]);

  const onHandRows = useMemo(() => {
    const itemMap = mapById(items);

    return onHand.map((row) => {
      const meta = normalizeItem(itemMap[row.id], row.id);
      const qty = Number(row.qty ?? 0);
      const par = Number(row.par ?? 0);

      return {
        id: row.id,
        name: meta.name,
        category: meta.category,
        unit: meta.unit,
        qty,
        par,
        status: computeStatus(qty, par),
        updatedAt: row.updatedAt,
      };
    });
  }, [onHand, items]);

  const debouncedSearch = useDebouncedValue(searchText, 150);

  // -----------------------------
  // Filtering / Sorting
  // -----------------------------
  const filteredRows = useMemo(() => {
    const s = safeLower(debouncedSearch).trim();

    let rows = [...onHandRows];

    if (healthFilter && healthFilter !== "ALL") {
      rows = rows.filter((r) => r.status === healthFilter);
    }

    if (s) {
      rows = rows.filter((r) => {
        const hay =
          `${r.name} ${r.category} ${r.unit} ${r.id}`.toLowerCase();
        return hay.includes(s);
      });
    }

    const dir = sortDir === "DESC" ? -1 : 1;

    rows.sort((a, b) => {
      if (sortKey === "NAME") {
        return a.name.localeCompare(b.name) * dir;
      }
      if (sortKey === "STATUS") {
        return a.status.localeCompare(b.status) * dir;
      }
      if (sortKey === "QTY") {
        return (a.qty - b.qty) * dir;
      }
      if (sortKey === "PAR") {
        return (a.par - b.par) * dir;
      }
      if (sortKey === "UPDATED") {
        const ad = a.updatedAt?.toDate ? a.updatedAt.toDate().getTime() : 0;
        const bd = b.updatedAt?.toDate ? b.updatedAt.toDate().getTime() : 0;
        return (ad - bd) * dir;
      }
      return 0;
    });

    return rows;
  }, [onHandRows, healthFilter, debouncedSearch, sortKey, sortDir]);

  const filteredRowsDebounced = useDebouncedValue(filteredRows, 120);

  // -----------------------------
  // PAR Save Handler
  // -----------------------------
  const savePar = useCallback(
    async (itemId, value) => {
      const parValue = clampNumber(value, 0, 999999);
      setSavingPar((p) => ({ ...p, [itemId]: true }));

      const ref = doc(
        db,
        "companies",
        COMPANY_ID,
        "restaurants",
        restaurantId,
        "onHand",
        itemId
      );

      await updateDoc(ref, { par: parValue });

      setSavingPar((p) => ({ ...p, [itemId]: false }));
      loadOnHand();
    },
    [restaurantId, loadOnHand]
  );

  // -----------------------------
  // Export (CSV)
  // -----------------------------
  const exportCsv = useCallback(() => {
    const headers = [
      "ItemId",
      "Item",
      "Category",
      "Unit",
      "OnHand",
      "PAR",
      "Status",
      "Updated",
    ];

    const lines = [
      headers.join(","),
      ...filteredRows.map((r) => {
        const updated = r.updatedAt?.toDate
          ? r.updatedAt.toDate().toISOString()
          : "";
        const vals = [
          r.id,
          r.name,
          r.category,
          r.unit,
          String(r.qty),
          String(r.par),
          r.status,
          updated,
        ];
        return vals
          .map((v) => `"${String(v || "").replaceAll(`"`, `""`)}"`)
          .join(",");
      }),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory_${restaurantId || "restaurant"}_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }, [filteredRows, restaurantId]);

  // -----------------------------
  // Render Helpers
  // -----------------------------
  const renderReceiptsTable = () => {
    if (loadingReceipts) {
      return <div className="metric-subtext">Loading…</div>;
    }
    if (receipts.length === 0) {
      return <div className="metric-subtext">No receipts yet</div>;
    }
    return (
      <table style={{ width: "100%", marginTop: 10 }}>
        <thead>
          <tr>
            <th align="left">Date</th>
            <th align="left">Vendor</th>
            <th align="left">Status</th>
            <th align="right">Items</th>
            <th align="right">Total</th>
          </tr>
        </thead>
        <tbody>
          {receipts.map((r) => (
            <tr key={r.id}>
              <td>{formatDate(r.receivedAt)}</td>
              <td>{r.vendorName || EMPTY_TEXT}</td>
              <td>
                {r.status === "pending_review" ? (
                  <button onClick={() => setReviewReceipt(r)}>Review</button>
                ) : (
                  r.status
                )}
              </td>
              <td align="right">{r.itemCount ?? EMPTY_TEXT}</td>
              <td align="right">{formatCurrency(r.totalCost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const toggleSort = (key) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("ASC");
      return;
    }
    setSortDir((d) => (d === "ASC" ? "DESC" : "ASC"));
  };

  const renderOnHandTable = () => {
    if (loadingInventory) {
      return <div className="metric-subtext">Loading inventory…</div>;
    }
    if (filteredRows.length === 0) {
      return <div className="metric-subtext">No inventory rows match</div>;
    }

    const showCategory = windowWidth >= 780;
    const showUnit = windowWidth >= 640;
    const showUpdated = windowWidth >= 880;

    return (
      <table style={{ width: "100%", marginTop: 10 }}>
        <thead>
          <tr>
            <th align="left" style={{ cursor: "pointer" }} onClick={() => toggleSort("NAME")}>
              Item
            </th>

            {showCategory ? (
              <th
                align="left"
                style={{ cursor: "pointer" }}
                onClick={() => toggleSort("STATUS")}
              >
                Category
              </th>
            ) : null}

            {showUnit ? (
              <th align="left">Unit</th>
            ) : null}

            {/* SPACING FIX: On-Hand / PAR / Status */}
            <th
              align="right"
              style={{ paddingRight: 30, cursor: "pointer", whiteSpace: "nowrap" }}
              onClick={() => toggleSort("QTY")}
            >
              On-Hand
            </th>

            <th
              align="right"
              style={{ paddingRight: 30, cursor: "pointer", whiteSpace: "nowrap" }}
              onClick={() => toggleSort("PAR")}
            >
              PAR
            </th>

            <th
              align="left"
              style={{
                paddingLeft: 30,
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
              onClick={() => toggleSort("STATUS")}
            >
              Status
            </th>

            {showUpdated ? (
              <th
                align="right"
                style={{ cursor: "pointer", whiteSpace: "nowrap" }}
                onClick={() => toggleSort("UPDATED")}
              >
                Updated
              </th>
            ) : null}
          </tr>
        </thead>

        <tbody>
          {filteredRows.map((row) => (
            <tr key={row.id}>
              <td style={{ whiteSpace: "nowrap" }}>{row.name}</td>

              {showCategory ? <td>{row.category}</td> : null}

              {showUnit ? <td>{row.unit}</td> : null}

              <td align="right" style={{ paddingRight: 30 }}>
                {row.qty}
              </td>

              <td align="right" style={{ paddingRight: 30 }}>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, alignItems: "center" }}>
                  <input
                    type="number"
                    min="0"
                    value={editingPar[row.id] ?? row.par}
                    onChange={(e) =>
                      setEditingPar((prev) => ({
                        ...prev,
                        [row.id]: e.target.value,
                      }))
                    }
                    onBlur={(e) => savePar(row.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") {
                        setEditingPar((p) => ({ ...p, [row.id]: row.par }));
                        e.currentTarget.blur();
                      }
                    }}
                    style={{
                      width: 78,
                      padding: "6px 8px",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.14)",
                      background: "rgba(255,255,255,0.06)",
                      color: "#fff",
                      outline: "none",
                    }}
                  />

                  {savingPar[row.id] ? (
                    <span style={{ fontSize: 12, opacity: 0.85 }}>Saving…</span>
                  ) : null}
                </div>
              </td>

              <td align="left" style={{ paddingLeft: 30 }}>
                <StatusPill status={row.status} />
              </td>

              {showUpdated ? (
                <td align="right" style={{ whiteSpace: "nowrap" }}>
                  {formatDate(row.updatedAt)}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const filterChipStyle = (active) => ({
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: active ? "rgba(125,211,252,0.18)" : "rgba(255,255,255,0.06)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 12,
    whiteSpace: "nowrap",
  });

  const sortBadge = useMemo(() => {
    const arrow = sortDir === "DESC" ? "↓" : "↑";
    return `${sortKey} ${arrow}`;
  }, [sortKey, sortDir]);

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <div className="overview-wrapper">
      <section className="overview-section">
        {/* HEADER */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <h2 className="section-title">Inventory</h2>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Shortcuts: <strong>N</strong> Receive Inventory,{" "}
              <strong>U</strong> Upload Receipt, <strong>Esc</strong> Close Modal
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => exportCsv()}>Export CSV</button>
            <button onClick={() => setShowUploadModal(true)}>
              Upload Receipt Photos
            </button>
            <button onClick={() => setShowReceiveModal(true)}>
              + Receive Inventory
            </button>
          </div>
        </div>

        {/* KPI - 2 cards per row */}
        <div className="kpi-grid kpi-grid--row">
          <div className="metric-card info">
            <div className="metric-title">Invoices</div>
            <div className="metric-value">{totals.count}</div>
          </div>
          <div className="metric-card info">
            <div className="metric-title">Total Spend</div>
            <div className="metric-value">{formatCurrency(totals.spend)}</div>
          </div>
        </div>
        <div className="kpi-grid kpi-grid--row">
          <div className="metric-card info">
            <div className="metric-title">Sort</div>
            <div className="metric-value" style={{ fontSize: 16 }}>
              {sortBadge}
            </div>
          </div>
          <div></div>
        </div>

        {/* Health Summary + Trends Chart */}
        <InventoryHealthSummary rows={filteredRowsDebounced} />
        <InventoryTrendsChart rows={filteredRowsDebounced} restaurantId={restaurantId} companyId={COMPANY_ID} />

        {/* Bowling Inventory Snapshot (if restaurant has bowling) */}
        {hasBowling && (
          <div className="metric-card info" style={{ marginTop: 16 }}>
            <div className="metric-title">Bowling Inventory Snapshot</div>
            {loadingBowlingInventory ? (
              <div className="metric-subtext">Loading bowling inventory...</div>
            ) : bowlingInventory ? (
              <div style={{ marginTop: 16 }}>
                <div className="kpi-grid kpi-grid--row">
                  <div className="metric-card info">
                    <div className="metric-title">Bowling Balls</div>
                    <div className="metric-value">{bowlingInventory.balls.total}</div>
                    {bowlingInventory.balls.needsReplacement > 0 && (
                      <div style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>
                        {bowlingInventory.balls.needsReplacement} need replacement
                      </div>
                    )}
                  </div>
                  <div className="metric-card info">
                    <div className="metric-title">Bowling Shoes</div>
                    <div className="metric-value">{bowlingInventory.shoes.total}</div>
                    {bowlingInventory.shoes.needsReplacement > 0 && (
                      <div style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>
                        {bowlingInventory.shoes.needsReplacement} need replacement
                      </div>
                    )}
                  </div>
                </div>
                <div className="kpi-grid kpi-grid--row" style={{ marginTop: 16 }}>
                  <div className="metric-card info">
                    <div className="metric-title">Bowling Pins</div>
                    <div className="metric-value">{bowlingInventory.pins.total}</div>
                  </div>
                  <div></div>
                </div>
                <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
                  <p>Bowling inventory is managed in the <strong>Bowling Lanes</strong> tab.</p>
                  <p>This snapshot reflects current counts and items needing replacement.</p>
                </div>
              </div>
            ) : (
              <div className="metric-subtext">No bowling inventory data available</div>
            )}
          </div>
        )}

        {/* Purchase Ledger */}
        <div className="metric-card info" style={{ marginTop: 16 }}>
          <div className="metric-title">Purchase Ledger</div>
          {renderReceiptsTable()}
        </div>

        {/* Alerts (existing component) */}
        <InventoryAlerts
          rows={onHandRows}
          onSelectStatus={(value) => {
            // support both casing styles from existing UI implementations
            const v = String(value || "ALL").toUpperCase();
            if (v === "LOW") setHealthFilter("LOW");
            else if (v === "CRITICAL") setHealthFilter("CRITICAL");
            else if (v === "OK") setHealthFilter("OK");
            else if (v === "UNSET") setHealthFilter("UNSET");
            else setHealthFilter("ALL");
          }}
        />

        {/* FILTER BAR (added, real functionality) */}
        <div
          className="metric-card info"
          style={{
            marginTop: 16,
            padding: 14,
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              style={filterChipStyle(healthFilter === "ALL")}
              onClick={() => setHealthFilter("ALL")}
            >
              All
            </button>
            <button
              type="button"
              style={filterChipStyle(healthFilter === "OK")}
              onClick={() => setHealthFilter("OK")}
            >
              OK
            </button>
            <button
              type="button"
              style={filterChipStyle(healthFilter === "LOW")}
              onClick={() => setHealthFilter("LOW")}
            >
              Low
            </button>
            <button
              type="button"
              style={filterChipStyle(healthFilter === "CRITICAL")}
              onClick={() => setHealthFilter("CRITICAL")}
            >
              Critical
            </button>
            <button
              type="button"
              style={filterChipStyle(healthFilter === "UNSET")}
              onClick={() => setHealthFilter("UNSET")}
            >
              Unset PAR
            </button>
          </div>

          <div style={{ flex: 1, minWidth: 220 }}>
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search items (name, category, unit)…"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.06)",
                color: "#fff",
                outline: "none",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ fontSize: 12, opacity: 0.85 }}>Rows:</div>
            <div style={{ fontWeight: 800 }}>{filteredRows.length}</div>
          </div>
        </div>

        {/* On-Hand Inventory */}
        <div className="metric-card info" style={{ marginTop: 16 }}>
          <div
            className="metric-title"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span>Current Inventory (On-Hand)</span>

            <Fragment>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 12, opacity: 0.85 }}>
                  View: <strong>{healthFilter}</strong>
                </span>

                <button
                  onClick={() => {
                    setHealthFilter("ALL");
                    setSearchText("");
                    setSortKey("NAME");
                    setSortDir("ASC");
                  }}
                >
                  Reset View
                </button>
              </div>
            </Fragment>
          </div>

          {renderOnHandTable()}
        </div>

        {/* Item Catalog (kept) */}
        <ItemCatalog companyId={COMPANY_ID} restaurantId={restaurantId} />
      </section>

      {/* Movement History (kept) */}
      <InventoryMovementHistory companyId={COMPANY_ID} />

      {/* MODALS */}
      {showReceiveModal && (
        <ReceiveInvoiceModal
          companyId={COMPANY_ID}
          restaurantId={restaurantId}
          onClose={() => setShowReceiveModal(false)}
          onSaved={() => {
            loadReceipts();
            loadOnHand();
          }}
        />
      )}

      {showUploadModal && (
        <ReceiptUploadModal
          companyId={COMPANY_ID}
          restaurantId={restaurantId}
          onClose={() => setShowUploadModal(false)}
          onCreated={loadReceipts}
        />
      )}

      {reviewReceipt && (
        <ReceiptReviewModal
          open={true}
          companyId={COMPANY_ID}
          restaurantId={restaurantId}
          receipt={reviewReceipt}
          items={items}
          onClose={() => setReviewReceipt(null)}
          onConfirmed={() => {
            loadReceipts();
            loadOnHand();
          }}
        />
      )}
    </div>
  );
}