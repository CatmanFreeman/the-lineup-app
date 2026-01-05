// src/pages/Dashboards/RestaurantDashboard/tabs/ItemCatalog.jsx
//
// =============================================================================
// ITEM CATALOG
// =============================================================================
//
// Responsibilities
// -----------------------------------------------------------------------------
// • Company-level item metadata (name, category, unit, par, cost)
// • Restaurant-level on-hand quantities
// • Inventory status engine (OK / Low / Critical)
// • Manual inventory adjustments (C2-A)
// • Waste & spoilage logging with $ loss (C4-A)
// • Inline per-item inventory movement history (C3-A)
// • Threshold editor (Low / Critical per item) (C5-B / A)
// • Correct spacing and column separation (UX fix)
//
// Data Sources
// -----------------------------------------------------------------------------
// • /companies/{companyId}/items
// • /companies/{companyId}/restaurants/{restaurantId}/onHand/{itemId}
// • /companies/{companyId}/restaurants/{restaurantId}/inventoryMovements
//
// Threshold Fields (Restaurant-level /onHand/{itemId})
// -----------------------------------------------------------------------------
// • lowThreshold: number (0..1)  -> fraction of PAR considered "Low boundary"
// • criticalThreshold: number (0..1) -> fraction of PAR considered "Critical boundary"
// Defaults if missing:
// • lowThreshold = 0.5
// • criticalThreshold = 0.25
//
// Status Logic
// -----------------------------------------------------------------------------
// If PAR <= 0: status "—"
// Else:
// • qty >= PAR * lowThreshold -> OK
// • qty >= PAR * criticalThreshold -> Low
// • otherwise -> Critical
//
// Design Notes
// -----------------------------------------------------------------------------
// • ItemCatalog is NOT receipt-driven
// • All item metadata comes from company items
// • On-hand + thresholds are restaurant scoped
// • History is read-only and derived
// • Status logic is deterministic and centralized
//
// =============================================================================

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";

import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  updateDoc, // ✅ ADDITION — threshold editor + inline updates
} from "firebase/firestore";

import { db } from "../../../../hooks/services/firebase";

import {
  adjustInventory,
  logWaste,
} from "../../../../hooks/services/inventoryService";

// =============================================================================
// CONSTANTS
// =============================================================================

const STATUS = {
  OK: "OK",
  LOW: "Low",
  CRITICAL: "Critical",
};

const STATUS_COLORS = {
  OK: "#22c55e",
  LOW: "#facc15",
  CRITICAL: "#ef4444",
};

const WASTE_REASONS = [
  "Spoilage",
  "Over-prep",
  "Expired",
  "Comp",
  "Other",
];

// Threshold defaults (fractions of PAR)
const DEFAULT_THRESHOLDS = {
  low: 0.5,
  critical: 0.25,
};

const THRESHOLD_LIMITS = {
  min: 0.01,
  max: 0.99,
};

// =============================================================================
// SMALL UI HELPERS (kept local for a single-file drop-in)
// =============================================================================

function clampNumber(n, min, max) {
  if (!Number.isFinite(n)) return min;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function isFiniteNumber(n) {
  return Number.isFinite(n) && !Number.isNaN(n);
}

function toNumberOrEmpty(value) {
  if (value === "" || value === null || value === undefined) return "";
  const n = Number(value);
  return Number.isFinite(n) ? n : "";
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function safeMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `$${n.toFixed(2)}`;
}

function safeDate(ts) {
  if (!ts?.toDate) return "—";
  try {
    return ts.toDate().toLocaleDateString();
  } catch {
    return "—";
  }
}

function TableSectionCard({ title, children }) {
  return (
    <div className="metric-card info" style={{ marginTop: 16 }}>
      <div className="metric-title">{title}</div>
      {children}
    </div>
  );
}

function InlineHint({ children }) {
  return (
    <div
      style={{
        marginTop: 6,
        fontSize: 12,
        opacity: 0.85,
        lineHeight: 1.35,
      }}
    >
      {children}
    </div>
  );
}

function SmallDangerText({ children }) {
  return (
    <div
      style={{
        marginTop: 8,
        padding: "10px 12px",
        borderRadius: 10,
        background: "rgba(239,68,68,0.12)",
        border: "1px solid rgba(239,68,68,0.22)",
        color: "#fecaca",
        fontSize: 12,
      }}
    >
      {children}
    </div>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function ItemCatalog({ companyId, restaurantId, healthFilter = "ALL" }) {

  // ---------------------------------------------------------------------------
  // State: Data
  // ---------------------------------------------------------------------------
  const [items, setItems] = useState([]);
  const [onHand, setOnHand] = useState({});
  const [thresholdsByItem, setThresholdsByItem] = useState({});
  const [loading, setLoading] = useState(true);

  // ---------------------------------------------------------------------------
  // State: Adjustment UI
  // ---------------------------------------------------------------------------
  const [editingItemId, setEditingItemId] = useState(null);
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [savingAdjust, setSavingAdjust] = useState(false);

  // ---------------------------------------------------------------------------
  // State: Waste UI
  // ---------------------------------------------------------------------------
  const [wasteItem, setWasteItem] = useState(null);
  const [wasteQty, setWasteQty] = useState("");
  const [wasteReason, setWasteReason] = useState("");
  const [wasteNote, setWasteNote] = useState("");

  // ---------------------------------------------------------------------------
  // State: Threshold Editor (C5-B / A)
  // ---------------------------------------------------------------------------
  const [editingThresholdItemId, setEditingThresholdItemId] = useState(null);
  const [thresholdLowDraft, setThresholdLowDraft] = useState("");
  const [thresholdCriticalDraft, setThresholdCriticalDraft] = useState("");
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [thresholdError, setThresholdError] = useState("");

  // ---------------------------------------------------------------------------
  // State: History UI
  // ---------------------------------------------------------------------------
  const [expandedItemId, setExpandedItemId] = useState(null);
  const [historyByItem, setHistoryByItem] = useState({});
  const [historyLoading, setHistoryLoading] = useState(false);

  // =============================================================================
  // DATA LOADING
  // =============================================================================

  // ---------------------------------------------------------------------------
  // Load company-level items
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!companyId) return;

    async function loadItems() {
      setLoading(true);

      const ref = collection(db, "companies", companyId, "items");
      const snap = await getDocs(ref);

      const normalized = snap.docs.map((d) => {
        const data = d.data() || {};

        return {
          id: d.id,
          name: data.name || d.id,
          category: normalizeCategory(
            data.category ??
              data.Category ??
              data.itemCategory ??
              data.cat
          ),
          unit: normalizeUnit(
            data.unit ??
              data.Unit ??
              data.uom ??
              data.UOM
          ),
          parLevel: Number(data.parLevel ?? data.par ?? 0),
          unitCost: Number(
            data.unitCost ??
              data.cost ??
              data.avgCost ??
              0
          ),
        };
      });

      setItems(normalized);
      setLoading(false);
    }

    loadItems();
  }, [companyId]);

  // ---------------------------------------------------------------------------
  // Load restaurant-level on-hand quantities + thresholds
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!companyId || !restaurantId || items.length === 0) return;

    async function loadOnHandAndThresholds() {
      const qtyMap = {};
      const tMap = {};

      for (const item of items) {
        const ref = doc(
          db,
          "companies",
          companyId,
          "restaurants",
          restaurantId,
          "onHand",
          item.id
        );

        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data() || {};
          qtyMap[item.id] = Number(data.qty || 0);

          const low =
            Number(
              data.lowThreshold ??
                data.low ??
                data.lowPct ??
                DEFAULT_THRESHOLDS.low
            );

          const critical =
            Number(
              data.criticalThreshold ??
                data.critical ??
                data.criticalPct ??
                DEFAULT_THRESHOLDS.critical
            );

          tMap[item.id] = {
            low: isFiniteNumber(low) ? low : DEFAULT_THRESHOLDS.low,
            critical: isFiniteNumber(critical)
              ? critical
              : DEFAULT_THRESHOLDS.critical,
            source: snap.id,
          };
        } else {
          qtyMap[item.id] = 0;
          tMap[item.id] = {
            low: DEFAULT_THRESHOLDS.low,
            critical: DEFAULT_THRESHOLDS.critical,
            source: "default",
          };
        }
      }

      setOnHand(qtyMap);
      setThresholdsByItem(tMap);
    }

    loadOnHandAndThresholds();
  }, [companyId, restaurantId, items]);

  // =============================================================================
  // HELPERS
  // =============================================================================

  function normalizeCategory(value) {
    if (!value) return "—";
    const s = String(value).trim();
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }

  function normalizeUnit(value) {
    if (!value) return "—";
    return String(value).trim();
  }

  function resolveThresholds(itemId) {
    const t = thresholdsByItem[itemId];
    const low = isFiniteNumber(t?.low) ? t.low : DEFAULT_THRESHOLDS.low;
    const critical = isFiniteNumber(t?.critical)
      ? t.critical
      : DEFAULT_THRESHOLDS.critical;
    return { low, critical };
  }

  function getStatus(qty, par, lowThreshold, criticalThreshold) {
    if (!par || par <= 0) return "—";

    const low = isFiniteNumber(lowThreshold)
      ? lowThreshold
      : DEFAULT_THRESHOLDS.low;

    const critical = isFiniteNumber(criticalThreshold)
      ? criticalThreshold
      : DEFAULT_THRESHOLDS.critical;

    const lowAt = par * low;
    const criticalAt = par * critical;

    if (qty >= lowAt) return STATUS.OK;
    if (qty >= criticalAt) return STATUS.LOW;
    return STATUS.CRITICAL;
  }

  function getStatusStyle(status) {
    if (!STATUS_COLORS[status]) return {};
    return {
      color: STATUS_COLORS[status],
      fontWeight: 700,
      whiteSpace: "nowrap",
    };
  }

  function validateThresholdDrafts(lowDraft, criticalDraft) {
    const low = Number(lowDraft);
    const critical = Number(criticalDraft);

    if (!isFiniteNumber(low) || !isFiniteNumber(critical)) {
      return "Low and Critical must be valid numbers (e.g., 0.50 and 0.25).";
    }

    if (
      low < THRESHOLD_LIMITS.min ||
      low > THRESHOLD_LIMITS.max ||
      critical < THRESHOLD_LIMITS.min ||
      critical > THRESHOLD_LIMITS.max
    ) {
      return "Thresholds must be between 0.01 and 0.99.";
    }

    if (critical >= low) {
      return "Critical must be LESS than Low (example: Low 0.50, Critical 0.25).";
    }

    return "";
  }

  // =============================================================================
  // ACTIONS
  // =============================================================================

  const handleAdjustSave = useCallback(
    async (itemId) => {
      const delta = Number(adjustDelta);
      if (!delta || !adjustReason) return;

      setSavingAdjust(true);

      await adjustInventory({
        companyId,
        restaurantId,
        itemId,
        delta,
        reason: adjustReason,
      });

      setOnHand((prev) => ({
        ...prev,
        [itemId]: (prev[itemId] || 0) + delta,
      }));

      setEditingItemId(null);
      setAdjustDelta("");
      setAdjustReason("");
      setSavingAdjust(false);
    },
    [
      adjustDelta,
      adjustReason,
      companyId,
      restaurantId,
    ]
  );

  const handleWasteSave = useCallback(
    async (item) => {
      const qty = Number(wasteQty);
      if (!qty || !wasteReason) return;

      await logWaste({
        companyId,
        restaurantId,
        itemId: item.id,
        qty,
        reason: wasteReason,
        note: wasteNote,
        unitCost: item.unitCost,
      });

      setOnHand((prev) => ({
        ...prev,
        [item.id]: (prev[item.id] || 0) - qty,
      }));

      setWasteItem(null);
      setWasteQty("");
      setWasteReason("");
      setWasteNote("");
    },
    [
      wasteQty,
      wasteReason,
      wasteNote,
      companyId,
      restaurantId,
    ]
  );

  const toggleHistory = async (itemId) => {
    if (expandedItemId === itemId) {
      setExpandedItemId(null);
      return;
    }

    setExpandedItemId(itemId);

    if (historyByItem[itemId]) return;

    setHistoryLoading(true);

    const ref = collection(
      db,
      "companies",
      companyId,
      "restaurants",
      restaurantId,
      "inventoryMovements"
    );

    const q = query(
      ref,
      where("itemId", "==", itemId),
      orderBy("createdAt", "desc")
    );

    const snap = await getDocs(q);

    setHistoryByItem((prev) => ({
      ...prev,
      [itemId]: snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })),
    }));

    setHistoryLoading(false);
  };

  // ---------------------------------------------------------------------------
  // Threshold Editor open/close + save
  // ---------------------------------------------------------------------------

  const openThresholdEditor = useCallback(
    (itemId) => {
      const current = resolveThresholds(itemId);
      setEditingThresholdItemId(itemId);
      setThresholdLowDraft(toNumberOrEmpty(current.low));
      setThresholdCriticalDraft(toNumberOrEmpty(current.critical));
      setThresholdError("");
    },
    // resolveThresholds is stable via closure usage; ok for UI convenience
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [thresholdsByItem]
  );

  const closeThresholdEditor = useCallback(() => {
    setEditingThresholdItemId(null);
    setThresholdLowDraft("");
    setThresholdCriticalDraft("");
    setThresholdError("");
    setSavingThreshold(false);
  }, []);

  const saveThresholdEditor = useCallback(
    async (itemId) => {
      const msg = validateThresholdDrafts(
        thresholdLowDraft,
        thresholdCriticalDraft
      );

      if (msg) {
        setThresholdError(msg);
        return;
      }

      const low = clampNumber(
        Number(thresholdLowDraft),
        THRESHOLD_LIMITS.min,
        THRESHOLD_LIMITS.max
      );

      const critical = clampNumber(
        Number(thresholdCriticalDraft),
        THRESHOLD_LIMITS.min,
        THRESHOLD_LIMITS.max
      );

      setSavingThreshold(true);
      setThresholdError("");

      try {
        const ref = doc(
          db,
          "companies",
          companyId,
          "restaurants",
          restaurantId,
          "onHand",
          itemId
        );

        await updateDoc(ref, {
          lowThreshold: low,
          criticalThreshold: critical,
        });

        // Update local map immediately (no extra round trip)
        setThresholdsByItem((prev) => ({
          ...prev,
          [itemId]: {
            ...(prev[itemId] || {}),
            low,
            critical,
            source: "saved",
          },
        }));

        closeThresholdEditor();
      } catch (e) {
        setThresholdError(
          e?.message ||
            "Failed to save thresholds. Check Firestore rules + document exists."
        );
        setSavingThreshold(false);
      }
    },
    [
      thresholdLowDraft,
      thresholdCriticalDraft,
      companyId,
      restaurantId,
      closeThresholdEditor,
    ]
  );

  // =============================================================================
  // DERIVED ROWS
  // =============================================================================

  const rows = useMemo(() => {
    return items.map((item) => {
      const qty = onHand[item.id] ?? 0;
      const t = resolveThresholds(item.id);
      const status = getStatus(qty, item.parLevel, t.low, t.critical);

      return {
        ...item,
        qty,
        status,
        thresholds: t,
      };
    });
    // resolveThresholds reads thresholdsByItem; included implicitly via closure
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, onHand, thresholdsByItem]);

  // =============================================================================
  // RENDER: LOADING
  // =============================================================================

  if (loading) {
    return (
      <TableSectionCard title="Item Catalog">
        <div className="metric-subtext">Loading…</div>
      </TableSectionCard>
    );
  }

  // =============================================================================
  // RENDER: MAIN
  // =============================================================================

  return (
    <div className="metric-card info item-catalog-wrapper" style={{ marginTop: 16 }}>
      <div className="metric-title">Item Catalog</div>

      <div style={{ 
        overflowX: "auto", 
        WebkitOverflowScrolling: "touch",
        width: "100%"
      }}>
        <table
          className="item-catalog-table"
          style={{
            width: "100%",
            marginTop: 12,
            tableLayout: "fixed",
            minWidth: "100%",
          }}
        >
          <colgroup>
            <col style={{ width: "20%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "28%" }} />
          </colgroup>

          <thead>
            <tr>
              <th align="left" style={{ padding: "10px 8px 10px 8px", fontSize: "13px" }}>
                Item
              </th>
              <th align="left" style={{ padding: "10px 6px", fontSize: "12px" }}>
                Category
              </th>
              <th align="left" style={{ padding: "10px 4px", fontSize: "12px" }}>
                Unit
              </th>
              <th align="right" style={{ padding: "10px 6px", fontSize: "12px" }}>
                Par
              </th>
              <th align="right" style={{ padding: "10px 12px", fontSize: "12px" }}>
                On Hand
              </th>
              <th align="left" style={{ padding: "10px 12px", fontSize: "12px" }}>
                Status
              </th>
              <th align="right" style={{ padding: "10px 8px 10px 8px", fontSize: "12px" }}>
                Actions
              </th>
            </tr>
          </thead>

        <tbody>
          {rows.map((item) => {
            const isEditingAdjust = editingItemId === item.id;
            const isExpandedHistory = expandedItemId === item.id;
            const isEditingThresholds =
              editingThresholdItemId === item.id;

            return (
              <React.Fragment key={item.id}>
                {/* ============================================================
                    MAIN ROW
                   ============================================================ */}
                <tr>
                  <td style={{ padding: "10px 8px", fontSize: "14px", wordBreak: "break-word" }}>{item.name}</td>
                  <td style={{ padding: "10px 8px", fontSize: "13px" }}>{item.category}</td>
                  <td style={{ padding: "10px 8px", fontSize: "12px" }}>{item.unit}</td>
                  <td align="right" style={{ padding: "10px 8px", fontSize: "13px" }}>
                    {item.parLevel || "—"}
                  </td>
                  <td align="right" style={{ padding: "8px 12px", fontSize: "13px" }}>
                    {item.qty}
                  </td>
                  <td style={{
                    color: STATUS_COLORS[item.status] || "#ffffff",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    padding: "8px 12px",
                    fontSize: "13px"
                  }}>{item.status}</td>
                  <td align="right" style={{ padding: "8px 8px" }}>
                    {!isEditingAdjust ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", justifyContent: "flex-end" }}>
                        <button 
                          onClick={() => setEditingItemId(item.id)}
                          style={{ fontSize: "11px", padding: "4px 8px" }}
                        >
                          Adjust
                        </button>
                        <button 
                          onClick={() => setWasteItem(item)}
                          style={{ fontSize: "11px", padding: "4px 8px" }}
                        >
                          Waste
                        </button>
                        <button 
                          onClick={() => toggleHistory(item.id)}
                          style={{ fontSize: "11px", padding: "4px 8px" }}
                        >
                          {isExpandedHistory ? "Hide" : "Hist"}
                        </button>
                        <button 
                          onClick={() => openThresholdEditor(item.id)}
                          style={{ fontSize: "11px", padding: "4px 8px" }}
                        >
                          Thresh
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", justifyContent: "flex-end" }}>
                        <input
                          type="number"
                          value={adjustDelta}
                          onChange={(e) => setAdjustDelta(e.target.value)}
                          style={{ width: 50, fontSize: "12px", padding: "4px" }}
                        />
                        <input
                          type="text"
                          placeholder="Reason"
                          value={adjustReason}
                          onChange={(e) => setAdjustReason(e.target.value)}
                          style={{ width: 80, fontSize: "12px", padding: "4px" }}
                        />
                        <button
                          disabled={savingAdjust}
                          onClick={() => handleAdjustSave(item.id)}
                          style={{ fontSize: "11px", padding: "4px 8px" }}
                        >
                          Save
                        </button>
                        <button 
                          onClick={() => setEditingItemId(null)}
                          style={{ fontSize: "11px", padding: "4px 8px" }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </td>
                </tr>

                {/* ============================================================
                    THRESHOLD EDITOR ROW (C5-B / A)
                   ============================================================ */}
                {isEditingThresholds && (
                  <tr>
                    <td colSpan={7} style={{ padding: "0 14px 12px" }}>
                      <div
                        style={{
                          marginTop: 10,
                          borderRadius: 14,
                          border: "1px solid rgba(255,255,255,0.10)",
                          background: "rgba(255,255,255,0.04)",
                          padding: 14,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: 12,
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800, fontSize: 14 }}>
                              Thresholds — {item.name}
                            </div>

                            <InlineHint>
                              Set Low/Critical as fractions of PAR. Example: Low 0.50 (50%), Critical 0.25 (25%).
                              Critical must be less than Low.
                            </InlineHint>
                          </div>

                          <div style={{ textAlign: "right", minWidth: 220 }}>
                            <div style={{ fontSize: 12, opacity: 0.85 }}>
                              Current: Low {formatPercent(item.thresholds.low)} / Critical {formatPercent(item.thresholds.critical)}
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
                              With PAR {item.parLevel || "—"} → Low at{" "}
                              {item.parLevel ? Math.round(item.parLevel * item.thresholds.low) : "—"} / Critical at{" "}
                              {item.parLevel ? Math.round(item.parLevel * item.thresholds.critical) : "—"}
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            marginTop: 12,
                            flexWrap: "wrap",
                          }}
                        >
                          <label style={{ fontSize: 12, opacity: 0.9 }}>
                            Low
                            <input
                              type="number"
                              step="0.01"
                              min={THRESHOLD_LIMITS.min}
                              max={THRESHOLD_LIMITS.max}
                              value={thresholdLowDraft}
                              onChange={(e) => setThresholdLowDraft(e.target.value)}
                              style={{ width: 90, marginLeft: 8 }}
                            />
                          </label>

                          <label style={{ fontSize: 12, opacity: 0.9 }}>
                            Critical
                            <input
                              type="number"
                              step="0.01"
                              min={THRESHOLD_LIMITS.min}
                              max={THRESHOLD_LIMITS.max}
                              value={thresholdCriticalDraft}
                              onChange={(e) => setThresholdCriticalDraft(e.target.value)}
                              style={{ width: 90, marginLeft: 8 }}
                            />
                          </label>

                          <div style={{ flex: 1 }} />

                          <button
                            disabled={savingThreshold}
                            onClick={() => saveThresholdEditor(item.id)}
                          >
                            {savingThreshold ? "Saving..." : "Save Thresholds"}
                          </button>

                          <button onClick={closeThresholdEditor}>
                            Close
                          </button>
                        </div>

                        {thresholdError ? (
                          <SmallDangerText>{thresholdError}</SmallDangerText>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )}

                {/* ============================================================
                    HISTORY ROW (C3-A)
                   ============================================================ */}
                {isExpandedHistory && (
                  <tr>
                    <td colSpan={7} style={{ padding: "0 14px 14px" }}>
                      {historyLoading ? (
                        <div style={{ padding: 10 }}>Loading history…</div>
                      ) : (
                        <div
                          style={{
                            marginTop: 10,
                            borderRadius: 14,
                            border: "1px solid rgba(255,255,255,0.10)",
                            background: "rgba(255,255,255,0.03)",
                            padding: 12,
                          }}
                        >
                          <div style={{ fontWeight: 800, marginBottom: 10 }}>
                            Movement History — {item.name}
                          </div>

                          <table style={{ width: "100%" }}>
                            <thead>
                              <tr>
                                <th align="left">Date</th>
                                <th align="left">Source</th>
                                <th align="right">Δ</th>
                                <th align="left">Before → After</th>
                                <th align="left">Reason</th>
                                <th align="right">$ Loss</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(historyByItem[item.id] || []).length === 0 ? (
                                <tr>
                                  <td colSpan={6} style={{ padding: "10px 0", opacity: 0.85 }}>
                                    No movements found for this item.
                                  </td>
                                </tr>
                              ) : (
                                (historyByItem[item.id] || []).map((m) => (
                                  <tr key={m.id}>
                                    <td>{safeDate(m.createdAt)}</td>
                                    <td>{m.source || "—"}</td>
                                    <td align="right">{m.delta ?? "—"}</td>
                                    <td>
                                      {m.beforeQty ?? "—"} → {m.afterQty ?? "—"}
                                    </td>
                                    <td>{m.reason || "—"}</td>
                                    <td align="right">
                                      {m.totalLoss ? safeMoney(m.totalLoss) : "—"}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>

                          <InlineHint>
                            History is read-only. Adjustments, receipts, and waste logs write movement records.
                          </InlineHint>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      </div>

      {/* ================================================================
          WASTE CARD (C4-A)
         ================================================================ */}
      {wasteItem && (
        <div className="metric-card warning" style={{ marginTop: 16 }}>
          <div className="metric-title">Log Waste — {wasteItem.name}</div>

          <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
            <input
              type="number"
              placeholder="Qty"
              value={wasteQty}
              onChange={(e) => setWasteQty(e.target.value)}
              style={{ width: 120 }}
            />

            <select
              value={wasteReason}
              onChange={(e) => setWasteReason(e.target.value)}
              style={{ width: 160 }}
            >
              <option value="">Reason</option>
              {WASTE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Note (optional)"
              value={wasteNote}
              onChange={(e) => setWasteNote(e.target.value)}
              style={{ minWidth: 220, flex: 1 }}
            />
          </div>

          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
            Estimated Loss:{" "}
            {safeMoney(
              (Number(wasteQty) || 0) * (Number(wasteItem.unitCost) || 0)
            )}
          </div>

          <div style={{ marginTop: 10 }}>
            <button onClick={() => handleWasteSave(wasteItem)}>
              Confirm Waste
            </button>{" "}
            <button onClick={() => setWasteItem(null)}>Cancel</button>
          </div>

          <InlineHint>
            Waste decreases on-hand and writes an inventory movement record with total loss.
          </InlineHint>
        </div>
      )}
    </div>
  );
}
