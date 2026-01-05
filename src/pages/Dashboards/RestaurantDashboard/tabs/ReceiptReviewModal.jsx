// src/pages/Dashboards/RestaurantDashboard/tabs/ReceiptReviewModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import { doc, updateDoc, serverTimestamp, increment } from "firebase/firestore";
import { db } from "../../../../hooks/services/firebase";
/**
 * ReceiptReviewModal
 * - Purpose: Review an uploaded receipt photo set and allocate items/quantities before confirming inventory.
 * - Fixes: eliminates "hover-only" / flicker behavior by using a fixed overlay + stable z-index + pointer eve *
 * Expected props:
 * open: boolean
 * receipt: object (must contain id + photo URLs array; see normalize below)
 * items: array of item docs (each: { id, name, unit, category } or { id, ...data })
 * companyId: string
 * restaurantId: string
 * onClose: function
 * onConfirmed: function (optional) called after successful confirm
 *
 * Notes:
 * - This modal does NOT create vendors/items. It only displays what you pass in via `items` prop.
 * - Category display in this modal comes from `items` prop. If an item category is missing upstream,
 * the Inventory tab may still show blank unless upstream normalizes fields consistently.
 *
 * This file fixes:
 * - The ESLint / parser error caused by an unterminated JSX prop block near the receipt sidebar.
 * - Makes category/unit always visible per selected item via `getItemMeta` (robust lookups).
 * - Normalizes category text for display to avoid "Protein" vs "protein" surprises.
 *
 * ADDITIONS (NO DELETIONS):
 * - Added toTitleCase() helper and used it for Category/Unit display so you see "Protein" instead of "protein * - Left toDisplayLower() in place (not removed) to satisfy "additions only" requirement.
 */
export default function ReceiptReviewModal({
 open,
 receipt,
 items = [],
 companyId,
 restaurantId,
 onClose,
 onConfirmed,
}) {
 const [allocations, setAllocations] = useState([{ itemId: "", qty: 1 }]);
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState("");
 // Reset allocations each time a new receipt is opened
 useEffect(() => {
 if (open) {
 setError("");
 setSaving(false);
 setAllocations([{ itemId: "", qty: 1 }]);
 }
 }, [open, receipt?.id]);
 const renderDate = (val) => {
 if (!val) return "—";
 if (val?.toDate) return val.toDate().toLocaleString();
 if (val?.seconds) return new Date(val.seconds * 1000).toLocaleString();
 return String(val);
 };
 /**
 * Normalizes the incoming items for dropdown display.
 * Accepts multiple shapes:
 * - { id, name, unit, category }
 * - { id, ...data }
 * - { itemId, itemName, uom, Category, etc. }
 */
 const normalizedItems = useMemo(() => {
 return (items || [])
 .map((it) => {
 // Support both shapes: {id, name,...} OR Firestore doc-like {id, ...data}
 const id = it?.id || it?.itemId || it?.docId || "";
 const name = it?.name || it?.itemName || it?.title || id;
 const unit = it?.unit || it?.uom || it?.UOM || it?.Unit || "";
 const category = it?.category || it?.Category || it?.itemCategory || it?.cat || "";
 return { id, name, unit, category };
 })
 .filter((x) => x.id && x.name);
 }, [items]);
 // -----------------------------
 // Display normalization helpers
 // -----------------------------
 const toDisplayLower = (val) => {
 if (val === null || val === undefined) return "";
 const s = String(val).trim();
 if (!s) return "";
 return s.toLowerCase();
 };
 //  ADDITION — Title Case display (Protein, Chicken Breast, etc.)
 const toTitleCase = (val) => {
 if (val === null || val === undefined) return "";
 const s = String(val).trim();
 if (!s) return "";
 return s
 .toLowerCase()
 .split(" ")
 .filter(Boolean)
 .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
 .join(" ");
 };
 const safeText = (val, fallback = "—") => {
 if (val === null || val === undefined) return fallback;
 const s = String(val).trim();
 return s ? s : fallback;
 };
 //  ADDITION — robust metadata map (handles category casing + variants)
 const itemMetaById = useMemo(() => {
 const map = {};
 (items || []).forEach((it) => {
 const id = it?.id || it?.itemId || it?.docId || "";
 if (!id) return;
 map[id] = {
 name: it?.name || it?.itemName || it?.title || id,
 unit: it?.unit || it?.uom || it?.UOM || it?.Unit || "",
 category: it?.category || it?.Category || it?.itemCategory || it?.cat || "",
 };
 });
 // seed from normalizedItems if needed
 (normalizedItems || []).forEach((it) => {
 if (!it?.id) return;
 map[it.id] = map[it.id] || {};
 map[it.id].name = map[it.id].name || it.name;
 map[it.id].unit = map[it.id].unit || it.unit;
 map[it.id].category = map[it.id].category || it.category;
 });
 return map;
 }, [items, normalizedItems]);
 //  ADDITION — safe getter
 const getItemMeta = (itemId) => {
 if (!itemId) return { name: "", unit: "", category: "" };
 return itemMetaById[itemId] || { name: "", unit: "", category: "" };
 };
 const receiptId = receipt?.id || receipt?.receiptId || receipt?.docId || "";
 const photos = useMemo(() => {
 const p =
 receipt?.photoURLs ||
 receipt?.photoUrls ||
 receipt?.photos ||
 receipt?.images ||
 receipt?.receiptPhotos ||
 [];
 return Array.isArray(p) ? p : [];
 }, [receipt]);
 if (!open) return null;
 const addRow = () => setAllocations((prev) => [...prev, { itemId: "", qty: 1 }]);
 const removeRow = (idx) => setAllocations((prev) => prev.filter((_, i) => i !== idx));
 const updateRow = (idx, patch) =>
 setAllocations((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
 const validate = () => {
 if (!companyId || !restaurantId) return "Missing companyId or restaurantId.";
 if (!receiptId) return "Missing receipt id.";
 const cleaned = allocations
 .map((r) => ({ itemId: (r.itemId || "").trim(), qty: Number(r.qty || 0) }))
 .filter((r) => r.itemId && r.qty > 0);
 if (cleaned.length === 0) return "Add at least one item allocation.";
 return "";
 };
 const handleConfirm = async () => {
 const msg = validate();
 if (msg) {
 setError(msg);
 return;
 }
 setSaving(true);
 setError("");
 try {
 const cleaned = allocations
 .map((r) => ({ itemId: (r.itemId || "").trim(), qty: Number(r.qty || 0) }))
 .filter((r) => r.itemId && r.qty > 0);
 // 1) Mark receipt as confirmed + attach allocations
 const receiptRef = doc(
 db,
 "companies",
 companyId,
 "restaurants",
 restaurantId,
 "inventoryReceipts",
 receiptId
 );
 await updateDoc(receiptRef, {
 status: "confirmed",
 allocations: cleaned,
 confirmedAt: serverTimestamp(),
 updatedAt: serverTimestamp(),
 });
 // 2) Apply inventory onHand increments
 // Path: /companies/{companyId}/restaurants/{restaurantId}/onHand/{itemId}
 // Each item doc keeps: qty (number), updatedAt (timestamp)
 await Promise.all(
 cleaned.map(({ itemId, qty }) => {
 const onHandRef = doc(
 db,
 "companies",
 companyId,
 "restaurants",
 restaurantId,
 "onHand",
 itemId
 );
 // NOTE: updateDoc requires the doc to exist.
 // If your onHand doc doesn't exist yet, you must create it upstream (setDoc) before confirming.
 // We keep updateDoc here exactly as your logic indicates.
 return updateDoc(onHandRef, {
 qty: increment(qty),
 updatedAt: serverTimestamp(),
 });
 })
 );
 if (typeof onConfirmed === "function") onConfirmed();
 if (typeof onClose === "function") onClose();
 } catch (e) {
 console.error("Confirm inventory failed:", e);
 setError(e?.message || "Confirm failed. Check console.");
 setSaving(false);
 }
 };
 // ------------------------------------
 // UI style constants (no empty fluff)
 // ------------------------------------
 const styles = {
 overlay: {
 position: "fixed",
 inset: 0,
 zIndex: 999999,
 background: "rgba(0,0,0,0.65)",
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 padding: 18,
 pointerEvents: "auto",
 },
 modal: {
 width: "min(980px, 96vw)",
 background: "rgba(10, 14, 24, 0.96)",
 border: "1px solid rgba(255,255,255,0.12)",
 borderRadius: 18,
 boxShadow: "0 18px 60px rgba(0,0,0,0.7)",
 color: "#fff",
 padding: 18,
 },
 title: {
 fontSize: 22,
 fontWeight: 800,
 marginBottom: 10,
 },
 sectionTitle: {
 fontSize: 14,
 fontWeight: 800,
 marginBottom: 8,
 },
 thumbWrap: {
 display: "flex",
 gap: 10,
 flexWrap: "wrap",
 marginBottom: 14,
 },
 thumb: {
 width: 120,
 height: 90,
 borderRadius: 10,
 overflow: "hidden",
 background: "rgba(255,255,255,0.06)",
 border: "1px solid rgba(255,255,255,0.10)",
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 },
 gridRows: {
 display: "grid",
 gap: 10,
 },
 rowGrid: {
 display: "grid",
 gridTemplateColumns: "1fr 120px 44px",
 gap: 10,
 alignItems: "center",
 },
 select: {
 width: "100%",
 padding: "10px 12px",
 borderRadius: 10,
 border: "1px solid rgba(255,255,255,0.14)",
 background: "rgba(255,255,255,0.06)",
 color: "#fff",
 outline: "none",
 },
 input: {
 width: "100%",
 padding: "10px 12px",
 borderRadius: 10,
 border: "1px solid rgba(255,255,255,0.14)",
 background: "rgba(255,255,255,0.06)",
 color: "#fff",
 outline: "none",
 },
 removeBtn: {
 height: 40,
 borderRadius: 10,
 border: "1px solid rgba(255,255,255,0.16)",
 background: "transparent",
 color: "#fff",
 cursor: "pointer",
 },
 metaBar: {
 marginTop: 6,
 padding: "8px 10px",
 borderRadius: 10,
 border: "1px solid rgba(255,255,255,0.10)",
 background: "rgba(255,255,255,0.03)",
 display: "flex",
 justifyContent: "space-between",
 gap: 10,
 fontSize: 12,
 },
 addBtn: {
 marginTop: 12,
 background: "transparent",
 border: "none",
 color: "#7dd3fc",
 cursor: "pointer",
 padding: 0,
 fontWeight: 700,
 textAlign: "left",
 },
 errorBox: {
 marginTop: 10,
 padding: "10px 12px",
 borderRadius: 12,
 background: "rgba(239,68,68,0.12)",
 border: "1px solid rgba(239,68,68,0.26)",
 color: "#fecaca",
 fontSize: 13,
 },
 sidebar: {
 width: 260,
 },
 sidebarCard: {
 padding: 12,
 borderRadius: 14,
 border: "1px solid rgba(255,255,255,0.10)",
 background: "rgba(255,255,255,0.04)",
 marginBottom: 12,
 },
 sidebarLabel: {
 fontSize: 12,
 opacity: 0.85,
 },
 sidebarValue: {
 fontSize: 14,
 fontWeight: 800,
 },
 sidebarLine: {
 fontSize: 12,
 opacity: 0.85,
 marginTop: 6,
 },
 footer: {
 display: "flex",
 gap: 10,
 justifyContent: "flex-end",
 marginTop: 12,
 alignItems: "center",
 },
 btnGhost: {
 borderRadius: 12,
 border: "1px solid rgba(255,255,255,0.16)",
 background: "transparent",
 color: "#fff",
 padding: "10px 14px",
 cursor: "pointer",
 fontWeight: 800,
 minWidth: 110,
 },
 btnPrimary: {
 borderRadius: 12,
 border: "1px solid rgba(125, 211, 252, 0.65)",
 background: "rgba(125, 211, 252, 0.20)",
 color: "#e0f2fe",
 padding: "10px 14px",
 cursor: "pointer",
 fontWeight: 900,
 minWidth: 150,
 },
 tip: {
 fontSize: 11,
 opacity: 0.78,
 marginTop: 8,
 lineHeight: 1.35,
 },
 divider: {
 height: 1,
 background: "rgba(255,255,255,0.10)",
 margin: "12px 0",
 },
 savingTag: {
 fontSize: 12,
 opacity: 0.85,
 marginRight: "auto",
 },
 };
 // -------------------------------------------------------
 // Render
 // -------------------------------------------------------
 return (
 <div
 role="dialog"
 aria-modal="true"
 onMouseDown={(e) => {
 // Click outside closes
 if (e.target === e.currentTarget && typeof onClose === "function") onClose();
 }}
 style={styles.overlay}
 >
 <div onMouseDown={(e) => e.stopPropagation()} style={styles.modal}>
 <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
 {/* LEFT MAIN */}
 <div style={{ flex: 1 }}>
 <div style={styles.title}>Review Receipt</div>
 <div style={styles.thumbWrap}>
 {(photos.length ? photos : [""]).slice(0, 6).map((url, idx) => (
 <div key={idx} style={styles.thumb} title={url || "No photo URL"}>
 {url ? (
 <img
 src={url}
 alt={`Receipt ${idx + 1}`}
 style={{ width: "100%", height: "100%", objectFit: "cover" }}
 draggable={false}
 />
 ) : (
 <div style={{ opacity: 0.8, fontSize: 12 }}>No photo</div>
 )}
 </div>
 ))}
 </div>
 <div style={styles.sectionTitle}>Allocate Items</div>
 <div style={styles.gridRows}>
 {allocations.map((row, idx) => (
 <div key={idx}>
 <div style={styles.rowGrid}>
 <select
 value={row.itemId}
 onChange={(e) => updateRow(idx, { itemId: e.target.value })}
 style={styles.select}
 >
 <option value="">Select item...</option>
 {normalizedItems.map((it) => (
 <option key={it.id} value={it.id}>
 {it.name}
 {it.unit ? ` (${it.unit})` : ""}
 {it.category ? ` - ${it.category}` : ""}
 </option>
 ))}
 </select>
 <input
 type="number"
 min="0"
 step="1"
 value={row.qty}
 onChange={(e) => updateRow(idx, { qty: e.target.value })}
 style={styles.input}
 />
 <button
 type="button"
 onClick={() => removeRow(idx)}
 title="Remove"
 style={styles.removeBtn}
 >
 ✕
 </button>
 </div>
 {/*  ADDITION — ALWAYS VISIBLE CATEGORY / UNIT (TITLE CASE) */}
 <div style={styles.metaBar}>
 {(() => {
 const meta = getItemMeta(row.itemId);
 const metaName = safeText(meta.name, "—");
 const metaCategory = safeText(toTitleCase(meta.category), "—");
 const metaUnit = safeText(toTitleCase(meta.unit), "—");
 return (
 <>
 <span>
 <strong>Item:</strong> {metaName}
 </span>
 <span>
 <strong>Category:</strong> {metaCategory}
 </span>
 <span>
 <strong>Unit:</strong> {metaUnit}
 </span>
 </>
 );
 })()}
 </div>
 </div>
 ))}
 </div>
 <button type="button" onClick={addRow} style={styles.addBtn}>
 + Add Item
 </button>
 {error ? <div style={styles.errorBox}>{error}</div> : null}
 </div>
 {/* RIGHT SIDEBAR */}
 <div style={styles.sidebar}>
 <div style={styles.sidebarCard}>
 <div style={styles.sidebarLabel}>Receipt</div>
 <div style={styles.sidebarValue}>
 {receipt?.vendorName || receipt?.vendor || "Vendor: (none)"}
 </div>
 <div style={styles.sidebarLine}>
 Invoice: {receipt?.invoiceNumber || receipt?.invoice || "—"}
 </div>
 <div style={styles.sidebarLine}>Items: {receipt?.itemCount ?? "—"}</div>
 <div style={styles.sidebarLine}>Total: {receipt?.totalCost ?? "—"}</div>
 <div style={styles.sidebarLine}>
 Date: {renderDate(receipt?.date || receipt?.receivedAt || receipt?.createdAt)}
 </div>
 <div style={styles.sidebarLine}>
 Status: {receipt?.status || "pending_review"}
 </div>
 <div style={styles.divider} />
 <div style={styles.tip}>
 Tip: Click outside the modal to close. This overlay is fixed to prevent flicker/hover
 artifacts. Categories shown in the allocation bar come from the passed-in `items` list.
 </div>
 </div>
 <div style={styles.footer}>
 {saving ? <div style={styles.savingTag}>Saving…</div> : <div style={styles.savingTag} />}
 <button
 type="button"
 onClick={() => {
 if (!saving && typeof onClose === "function") onClose();
 }}
 style={styles.btnGhost}
 disabled={saving}
 >
 Cancel
 </button>
 <button
 type="button"
 onClick={() => {
 if (!saving) handleConfirm();
 }}
 style={{
 ...styles.btnPrimary,
 opacity: saving ? 0.7 : 1,
 cursor: saving ? "not-allowed" : "pointer",
 }}
 disabled={saving}
 >
 {saving ? "Confirming…" : "Confirm Inventory"}
 </button>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}