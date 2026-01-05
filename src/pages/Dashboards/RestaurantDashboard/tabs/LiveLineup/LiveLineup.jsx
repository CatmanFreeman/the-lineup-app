// src/pages/Dashboards/RestaurantDashboard/tabs/LiveLineup/LiveLineup.jsx
// ============================================================================
// THE LINEUP — LIVE LINEUP (RESTAURANT DASHBOARD TAB)
//
// Purpose
// - Read the PUBLISHED schedule week from Firestore.
// - Determine "today" within that week (Mon..Sun).
// - Display who is working today, grouped Front of House / Back of House.
// - Provide a Lunch / Dinner toggle that affects DISPLAY ONLY (no schema changes).
//
// Firestore Assumptions (matches your SchedulingTab.jsx implementation)
// - schedules live at:
// companies/{companyId}/restaurants/{restaurantId}/schedules/{weekEndingISO}
//
// - Each schedules doc has:
// status: "draft" | "published"
// days: {
// "YYYY-MM-DD": { slots: { [slotId]: uid|null }, updatedAt? }
// }
//
// - Staff lives at:
// companies/{companyId}/restaurants/{restaurantId}/staff/{docId}
// Each staff doc should contain at least:
// uid: string (your canonical id; drag/drop key)
// name: string
// role: string ("Front of House" / "Back of House")
// subRole: string
// rating?: number
// imageURL?: string
//
// Notes
// - We do not write anything here. Read-only view.
// - If week is not published, we show a clean empty state.
// - If today is not inside the published week, we default to Monday of that week,
// but show a banner stating what day we're looking at.
//
// ============================================================================
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { db } from "../../../../../hooks/services/firebase";
import "./LiveLineup.css";

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------
const COMPANY_ID = "company-demo";

// Slot definitions must match SchedulingTab.jsx exactly.
// If you later make this dynamic, we can read slots from config.
const SLOT_DEFS = [
  // FOH
  { id: "foh-host", label: "Host", side: "foh" },
  { id: "foh-server-1", label: "Server 1", side: "foh" },
  { id: "foh-server-2", label: "Server 2", side: "foh" },
  { id: "foh-bartender", label: "Bartender", side: "foh" },
  // BOH
  { id: "boh-grill", label: "Grill", side: "boh" },
  { id: "boh-fry", label: "Fry", side: "boh" },
  { id: "boh-saute", label: "Saute", side: "boh" },
  { id: "boh-salad", label: "Salad", side: "boh" },
];

// Lunch/Dinner affects DISPLAY ONLY.
// You can adjust these to match your actual operations.
const SHIFT_SLOT_FILTERS = {
  lunch: new Set([
    "foh-host",
    "foh-server-1",
    "foh-server-2",
    // bartender typically not shown at lunch unless desired
    // "foh-bartender",
    "boh-grill",
    "boh-fry",
    "boh-saute",
    "boh-salad",
  ]),
  dinner: new Set([
    "foh-host",
    "foh-server-1",
    "foh-server-2",
    "foh-bartender",
    "boh-grill",
    "boh-fry",
    "boh-saute",
    "boh-salad",
  ]),
};

// ----------------------------------------------------------------------------
// Date utilities (local time)
// ----------------------------------------------------------------------------
function pad2(n) {
  return String(n).padStart(2, "0");
}

function toISODate(dateObj) {
  const yyyy = dateObj.getFullYear();
  const mm = pad2(dateObj.getMonth() + 1);
  const dd = pad2(dateObj.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

function parseISODate(iso) {
  const [y, m, d] = String(iso || "").split("-").map((x) => Number(x));
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function addDays(dateObj, n) {
  const d = new Date(dateObj.getTime());
  d.setDate(d.getDate() + n);
  return d;
}

function upcomingSundayISO(fromDate = new Date()) {
  const d = new Date(fromDate.getTime());
  const day = d.getDay(); // 0 = Sun
  const daysToSunday = (7 - day) % 7;
  return toISODate(addDays(d, daysToSunday));
}

function startOfWeekFromWeekEndingSunday(weekEndingISO) {
  const sunday = parseISODate(weekEndingISO);
  if (!sunday) return null;
  return addDays(sunday, -6); // Monday
}

function dayNameShort(d) {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return names[d.getDay()];
}

function formatMMDD(d) {
  return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
}

function formatPrettyISO(iso) {
  const d = parseISODate(iso);
  if (!d) return iso || "—";
  return `${dayNameShort(d)} ${formatMMDD(d)} (${iso})`;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------
export default function LiveLineup() {
  const { restaurantId: routeRestaurantId } = useParams();
  const restaurantId = routeRestaurantId || "123";

  // Shift toggle (UI only)
  const [shift, setShift] = useState(() => {
    // Simple default: before 4pm => lunch, else dinner
    const hour = new Date().getHours();
    return hour < 16 ? "lunch" : "dinner";
  });

  // Loading / error
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Published week data
  const [weekEndingISO, setWeekEndingISO] = useState(() => upcomingSundayISO());
  const [weekStatus, setWeekStatus] = useState("draft"); // draft | published
  const [daysObj, setDaysObj] = useState({}); // { iso: { slots: { slotId: uid|null } } }

  // Staff index
  const [staffIndex, setStaffIndex] = useState({}); // { uid: {uid,id,name,role,subRole,rating,imageURL} }

  // Derived: todayISO and which day we're viewing
  const todayISO = useMemo(() => toISODate(new Date()), []);

  const weekStartISO = useMemo(() => {
    const start = startOfWeekFromWeekEndingSunday(weekEndingISO);
    return start ? toISODate(start) : null;
  }, [weekEndingISO]);

  const weekDays = useMemo(() => {
    const start = startOfWeekFromWeekEndingSunday(weekEndingISO);
    if (!start) return [];
    return Array.from({ length: 7 }).map((_, i) => {
      const d = addDays(start, i);
      return {
        iso: toISODate(d),
        label: `${dayNameShort(d)} ${formatMMDD(d)}`,
      };
    });
  }, [weekEndingISO]);

  const isTodayInsideWeek = useMemo(() => {
    if (!weekDays.length) return false;
    return weekDays.some((d) => d.iso === todayISO);
  }, [weekDays, todayISO]);

  const viewedISO = useMemo(() => {
    // If today is inside the published week, show today.
    // Otherwise default to Monday of that week so it still "shows something."
    if (isTodayInsideWeek) return todayISO;
    return weekDays[0]?.iso || todayISO;
  }, [isTodayInsideWeek, todayISO, weekDays]);

  // ----------------------------------------------------------------------------
  // Firestore load: schedule doc + staff docs
  // ----------------------------------------------------------------------------
  const scheduleDocRef = useMemo(() => {
    return doc(
      db,
      "companies",
      COMPANY_ID,
      "restaurants",
      restaurantId,
      "schedules",
      weekEndingISO
    );
  }, [restaurantId, weekEndingISO]);

  const loadStaff = useCallback(async () => {
    const ref = collection(
      db,
      "companies",
      COMPANY_ID,
      "restaurants",
      restaurantId,
      "staff"
    );
    const snap = await getDocs(ref);

    const idx = {};
    snap.docs.forEach((d) => {
      const data = d.data() || {};
      const uid = String(data.uid || d.id || "").trim();
      if (!uid) return;

      idx[uid] = {
        uid,
        id: uid,
        name: String(data.name || uid).trim() || uid,
        role: String(data.role || "").trim(),
        subRole: String(data.subRole || "—").trim() || "—",
        rating: typeof data.rating === "number" ? data.rating : null,
        imageURL: String(data.imageURL || "").trim() || "",
      };
    });

    return idx;
  }, [restaurantId]);

  const loadPublishedWeek = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");

    try {
      // 1) Load schedule doc
      const snap = await getDoc(scheduleDocRef);

      if (!snap.exists()) {
        setWeekStatus("draft");
        setDaysObj({});
        setStaffIndex(await loadStaff());
        setLoading(false);
        return;
      }

      const data = snap.data() || {};
      const status = String(data.status || "draft");
      setWeekStatus(status);

      // Important: Live Lineup reflects only PUBLISHED schedules.
      // If not published, show empty-state rather than draft contents.
      if (status !== "published") {
        setDaysObj({});
        setStaffIndex(await loadStaff());
        setLoading(false);
        return;
      }

      // 2) Load staff index
      const idx = await loadStaff();
      setStaffIndex(idx);

      // 3) Save days payload
      setDaysObj(data.days || {});
      setLoading(false);
    } catch (e) {
      setErrorMsg("Unable to load Live Lineup data (Firestore error)");
      setLoading(false);
    }
  }, [scheduleDocRef, loadStaff]);

  // Auto-refresh when restaurant changes or weekEnding changes
  useEffect(() => {
    loadPublishedWeek();
  }, [loadPublishedWeek]);

  // ----------------------------------------------------------------------------
  // Derived: schedule for viewedISO
  // ----------------------------------------------------------------------------
  const rawSlotsForViewedDay = useMemo(() => {
    const day = daysObj?.[viewedISO];
    const slots =
      day?.slots && typeof day.slots === "object" ? day.slots : {};
    return slots;
  }, [daysObj, viewedISO]);

  const visibleSlots = useMemo(() => {
    const allowed = SHIFT_SLOT_FILTERS[shift] || SHIFT_SLOT_FILTERS.dinner;
    return SLOT_DEFS.filter((s) => allowed.has(s.id));
  }, [shift]);

  const lineupRows = useMemo(() => {
    // Build rows: [{slotId,label,side,uid,person}]
    return visibleSlots.map((slot) => {
      const uid = rawSlotsForViewedDay?.[slot.id] || null;
      const person = uid ? staffIndex[uid] : null;
      return {
        slotId: slot.id,
        slotLabel: slot.label,
        side: slot.side,
        uid,
        person,
      };
    });
  }, [visibleSlots, rawSlotsForViewedDay, staffIndex]);

  const fohRows = useMemo(
    () => lineupRows.filter((r) => r.side === "foh"),
    [lineupRows]
  );

  const bohRows = useMemo(
    () => lineupRows.filter((r) => r.side === "boh"),
    [lineupRows]
  );

  const hasAnyAssignments = useMemo(() => {
    return lineupRows.some((r) => Boolean(r.uid));
  }, [lineupRows]);

  // ----------------------------------------------------------------------------
  // Render helpers
  // ----------------------------------------------------------------------------
  const renderPersonCell = (row) => {
    const p = row.person;

    if (!row.uid) {
      return (
        <div className="ll-person ll-person--empty">
          <div className="ll-person-name">Unfilled</div>
          <div className="ll-person-sub">Drop in Scheduler</div>
        </div>
      );
    }

    // If UID exists but staff record missing, show UID.
    const displayName = p?.name || row.uid;
    const subRole = p?.subRole || "—";
    const rating = typeof p?.rating === "number" ? p.rating : null;

    return (
      <div className="ll-person">
        {p?.imageURL ? (
          <img className="ll-avatar" src={p.imageURL} alt={displayName} />
        ) : (
          <div className="ll-avatar ll-avatar--fallback">
            {displayName?.[0]?.toUpperCase() || "?"}
          </div>
        )}

        <div className="ll-person-meta">
          <div className="ll-person-name">{displayName}</div>

          <div className="ll-person-sub">
            {subRole}
            {rating !== null ? (
              <span className="ll-rating">{" "}■ {Number(rating).toFixed(1)}</span>
            ) : (
              <span className="ll-rating ll-rating--none">{" "}— No rating yet</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderSlotRow = (row) => {
    return (
      <div key={row.slotId} className="ll-row">
        <div className="ll-slot">
          <div className="ll-slot-label">{row.slotLabel}</div>
          <div className="ll-slot-id">{row.slotId}</div>
        </div>

        <div className="ll-cell">{renderPersonCell(row)}</div>
      </div>
    );
  };

  // ----------------------------------------------------------------------------
  // UI
  // ----------------------------------------------------------------------------
  return (
    <div className="ll-wrap">
      <div className="ll-top">
        <div className="ll-title">
          <div className="ll-h2">Live Lineup</div>

          <div className="ll-sub">
            Week Ending: <strong>{formatPrettyISO(weekEndingISO)}</strong>
            {weekStartISO ? (
              <span className="ll-sub-muted">
                {" "}• Week Start: {formatPrettyISO(weekStartISO)}
              </span>
            ) : null}
          </div>

          {weekStatus !== "published" ? (
            <div className="ll-banner ll-banner--warn">
              No published schedule for this week yet. Publish the week in Scheduling to populate Live Lineup.
            </div>
          ) : null}

          {weekStatus === "published" && !isTodayInsideWeek ? (
            <div className="ll-banner ll-banner--info">
              Today ({todayISO}) is not inside the selected week. Showing Monday of the week instead:{" "}
              <strong>{viewedISO}</strong>
            </div>
          ) : null}

          {errorMsg ? (
            <div className="ll-banner ll-banner--danger">{errorMsg}</div>
          ) : null}
        </div>

        <div className="ll-controls">
          <div className="ll-shift-toggle">
            <button
              type="button"
              className={["ll-btn", shift === "lunch" ? "ll-btn--active" : ""]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setShift("lunch")}
              disabled={loading}
            >
              Lunch
            </button>

            <button
              type="button"
              className={["ll-btn", shift === "dinner" ? "ll-btn--active" : ""]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setShift("dinner")}
              disabled={loading}
            >
              Dinner
            </button>
          </div>

          <div className="ll-meta">
            <div className="ll-meta-line">
              Viewing: <strong>{formatPrettyISO(viewedISO)}</strong>
            </div>

            <div className="ll-meta-line">
              Restaurant: <strong>{restaurantId}</strong>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="ll-card">
          <div className="ll-card-title">Loading…</div>
          <div className="ll-muted">Fetching published schedule and staff.</div>
        </div>
      ) : weekStatus !== "published" ? (
        <div className="ll-card">
          <div className="ll-card-title">No Live Lineup Yet</div>
          <div className="ll-muted">
            Go to <strong>Scheduling</strong>, complete each day, then{" "}
            <strong>Publish Week</strong>.
          </div>
        </div>
      ) : !hasAnyAssignments ? (
        <div className="ll-card">
          <div className="ll-card-title">Published, but Empty</div>
          <div className="ll-muted">
            This week is published, but there are no assignments saved for{" "}
            <strong>{viewedISO}</strong>.
          </div>
        </div>
      ) : (
        <div className="ll-grid">
          <div className="ll-col">
            <div className="ll-col-head">
              <div className="ll-col-title">Front of House</div>
              <div className="ll-col-sub">
                {shift === "lunch" ? "Lunch view" : "Dinner view"}
              </div>
            </div>

            <div className="ll-col-body">{fohRows.map(renderSlotRow)}</div>
          </div>

          <div className="ll-col">
            <div className="ll-col-head">
              <div className="ll-col-title">Back of House</div>
              <div className="ll-col-sub">Kitchen stations</div>
            </div>

            <div className="ll-col-body">{bohRows.map(renderSlotRow)}</div>
          </div>
        </div>
      )}

      <div className="ll-footnote">
        Live Lineup reads <strong>published</strong> schedules only. Draft schedules will not show here.
      </div>
    </div>
  );
}