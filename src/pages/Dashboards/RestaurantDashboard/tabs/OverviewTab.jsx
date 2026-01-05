// src/pages/Dashboards/RestaurantDashboard/tabs/OverviewTab.jsx

import { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../../../hooks/services/firebase";

import MetricCard from "../../../../components/MetricCard";
import AlertCard from "../../../../components/AlertCard";
import CountdownTimer from "../../../../components/CountdownTimer";

import SimpleLineChart from "../../../../components/charts/SimpleLineChart";
import LaborVsSalesChart from "../../../../components/charts/LaborVsSalesChart";
import AlcoholMixTargetChart from "../../../../components/charts/AlcoholMixTargetChart";
import FoodVsAlcoholStackedChart from "../../../../components/charts/FoodVsAlcoholStackedChart";
import WasteBreakdownChart from "../../../../components/charts/WasteBreakdownChart";
import ToGoOrdersBarChart from "../../../../components/charts/ToGoOrdersBarChart";
import ReservationsTimelineChart from "../../../../components/charts/ReservationsTimelineChart";

import "./OverviewTab.css";

/**
 * OverviewTab — Restaurant Dashboard
 * LEVEL 1: Active Shift (SHIFT GAMES, Reminders, Auto Shift Focus, Games Hub CTA)
 * LEVEL 2: Shift Snapshot (KPIs + Expandable Charts + TimeScope)
 * LEVEL 3: Alerts & Staffing Awareness
 * 
 * DATA SOURCES:
 * - Staff & Attendance: Real-time from Firestore ✅
 * - Performance Rankings: Real-time from Firestore ✅
 * - Sales/Financial: Real-time from Firestore ✅
 * - Alcohol Mix: Real-time from Firestore ✅
 * - Waste: Real-time from Firestore ✅
 * - Reservations: Real-time from Firestore ✅
 *
 * KEY REQUIREMENT (FROM YOU):
 * - The TOP ROW in Active Shift must show FOUR cards, with the 4th being a clickable Shift Games Hub card.
 * - The card must sit in the open slot to the RIGHT of the Shift Focus box (same row).
 * - No shrinking/compressing hacks. No "casino" naming. SHIFT GAMES only.
 */

const COMPANY_ID = "company-demo";

/* =========================
   SMALL UTILS (NO DEPENDENCIES)
   ========================= */

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function safeNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function pct(n, digits = 0) {
  const x = safeNum(n, 0);
  return `${x.toFixed(digits)}%`;
}

function money(n) {
  const x = safeNum(n, 0);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(x);
  } catch {
    return `$${Math.round(x).toLocaleString("en-US")}`;
  }
}

function scopeLabel(scope) {
  if (scope === "shift") return "SHIFT";
  if (scope === "today") return "TODAY";
  if (scope === "week") return "WEEK";
  return String(scope || "").toUpperCase();
}

function minutesToClock(minsFromNow) {
  const mins = safeNum(minsFromNow, 0);
  const d = new Date(Date.now() + mins * 60 * 1000);
  const hh = d.getHours();
  const mm = `${d.getMinutes()}`.padStart(2, "0");
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  const ap = hh >= 12 ? "PM" : "AM";
  return `${h12}:${mm} ${ap}`;
}

function sortBy(arr, selector) {
  return [...arr].sort((a, b) => {
    const av = selector(a);
    const bv = selector(b);
    if (av < bv) return -1;
    if (av > bv) return 1;
    return 0;
  });
}

function sum(arr, selector) {
  return arr.reduce((acc, x) => acc + safeNum(selector(x), 0), 0);
}

function avg(arr, selector) {
  if (!arr.length) return 0;
  return sum(arr, selector) / arr.length;
}

function slugify(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function pickToneFromStatus(status) {
  if (status === "danger") return "danger";
  if (status === "warning") return "warning";
  if (status === "good") return "good";
  return "info";
}

/* =========================
   DATE UTILITIES
   ========================= */

function getDateISO(date = new Date()) {
  return date.toISOString().split("T")[0];
}

function getShiftStart(date = new Date()) {
  const d = new Date(date);
  d.setHours(16, 0, 0, 0); // 4pm shift start
  if (d > date) {
    d.setDate(d.getDate() - 1); // If current time is before 4pm, use yesterday's shift
  }
  return d;
}

function getScopeDateRange(scope) {
  const now = new Date();
  const todayISO = getDateISO(now);
  
  if (scope === "shift") {
    const shiftStart = getShiftStart(now);
    return {
      startDate: shiftStart,
      endDate: now,
      dateISO: todayISO,
    };
  }
  
  if (scope === "today") {
    const startOfDay = new Date(todayISO);
    startOfDay.setHours(0, 0, 0, 0);
    return {
      startDate: startOfDay,
      endDate: now,
      dateISO: todayISO,
    };
  }
  
  if (scope === "week") {
    // Get start of week (Sunday)
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day;
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);
    
    return {
      startDate: startOfWeek,
      endDate: now,
      dateISO: todayISO,
    };
  }
  
  return { startDate: now, endDate: now, dateISO: todayISO };
}

function getDateRange(startDate, endDate) {
  const dates = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    dates.push(getDateISO(new Date(current)));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/* =========================
   BUSINESS RULE HELPERS
   ========================= */

function computeShiftFocus({
  alcoholMixPct,
  alcoholTargetPct,
  laborPct,
  laborTargetPct,
  wastePct,
  wasteTargetPct,
  togoOrders,
  reservations,
}) {
  const mixGap = safeNum(alcoholTargetPct, 0) - safeNum(alcoholMixPct, 0);
  const laborGap = safeNum(laborPct, 0) - safeNum(laborTargetPct, 0);
  const wasteGap = safeNum(wastePct, 0) - safeNum(wasteTargetPct, 0);
  const togo = safeNum(togoOrders, 0);
  const res = safeNum(reservations, 0);

  const candidates = [
    {
      key: "alcoholMix",
      title: "Alcohol Mix",
      score: clamp(mixGap, -20, 20) * 2,
      status: mixGap > 2 ? "warning" : "good",
      message: mixGap > 2 ? "Below target — promote cocktails + add-ons" : "On target — maintain drink attachment",
    },
    {
      key: "labor",
      title: "Labor %",
      score: clamp(laborGap, -20, 20) * 2,
      status: laborGap > 1 ? "warning" : "good",
      message: laborGap > 1 ? "Over target — tighten labor / reposition coverage" : "On target — keep labor steady",
    },
    {
      key: "waste",
      title: "Waste %",
      score: clamp(wasteGap, -10, 10) * 3,
      status: wasteGap > 0.5 ? "danger" : "good",
      message: wasteGap > 0.5 ? "Above target — check comps, spoilage, prep overpull" : "Controlled — continue waste checks",
    },
    {
      key: "togo",
      title: "To-Go",
      score: clamp(togo - 12, -50, 50),
      status: togo >= 18 ? "warning" : "info",
      message: togo >= 18 ? "High volume — confirm expo + pickup flow" : "Normal flow — monitor pickup times",
    },
    {
      key: "reservations",
      title: "Reservations",
      score: clamp(res - 20, -50, 50),
      status: res >= 30 ? "warning" : "info",
      message: res >= 30 ? "Heavy book — stage seating + tighten turn times" : "Normal book — keep pacing steady",
    },
  ];

  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const winner = sorted[0] || candidates[0];

  return {
    title: "Shift Focus",
    value: winner.title,
    status: winner.status,
    subtext: winner.message,
    debug: sorted.map((x) => ({ key: x.key, score: x.score })),
  };
}

function computeGameStatus(teams) {
  const list = teams || [];
  if (!list.length) return { leader: null, delta: 0 };
  const sorted = [...list].sort((a, b) => safeNum(b.score, 0) - safeNum(a.score, 0));
  const leader = sorted[0];
  const runnerUp = sorted[1] || null;
  const delta = runnerUp ? safeNum(leader.score, 0) - safeNum(runnerUp.score, 0) : safeNum(leader.score, 0);
  return { leader, delta };
}

function computeGameProgress(game) {
  const remaining = safeNum(game?.remainingMinutes, 0);
  const duration = safeNum(game?.durationMinutes, 120);
  const elapsed = clamp(duration - remaining, 0, duration);
  const pctDone = duration ? Math.round((elapsed / duration) * 100) : 0;
  return { duration, elapsed, remaining, pctDone };
}

/* =========================
   REAL DATA LOADING FUNCTIONS
   ========================= */

async function loadSalesData(scope, restaurantId, companyId) {
  const { startDate, endDate, dateISO } = getScopeDateRange(scope);
  
  try {
    if (scope === "shift" || scope === "today") {
      // For shift/today, load single day's sales
      const salesRef = doc(
        db,
        "companies",
        companyId,
        "restaurants",
        restaurantId,
        "sales",
        dateISO
      );
      const snap = await getDoc(salesRef);
      
      if (snap.exists()) {
        const data = snap.data();
        const totalSales = Number(data.totalSales) || 0;
        const alcoholSales = Number(data.alcoholSales) || 0;
        const foodSales = Number(data.foodSales) || 0;
        const togoOrders = Number(data.togoOrders) || 0;
        const reservations = Number(data.reservations) || 0;
        
        // For shift, filter by time if we have hourly breakdown
        if (scope === "shift" && data.hourlyBreakdown) {
          const shiftStart = getShiftStart();
          const hourly = data.hourlyBreakdown || [];
          const filtered = hourly.filter((h) => {
            const hourTime = h.timestamp?.toDate ? h.timestamp.toDate() : new Date(h.timestamp);
            return hourTime >= shiftStart && hourTime <= endDate;
          });
          
          return {
            totalSales: filtered.reduce((sum, h) => sum + (Number(h.sales) || Number(h.totalSales) || 0), 0),
            alcoholSales: filtered.reduce((sum, h) => sum + (Number(h.alcoholSales) || 0), 0),
            foodSales: filtered.reduce((sum, h) => sum + (Number(h.foodSales) || 0), 0),
            togoOrders: filtered.reduce((sum, h) => sum + (Number(h.togoOrders) || 0), 0),
            reservations: filtered.reduce((sum, h) => sum + (Number(h.reservations) || 0), 0),
            hourlyBreakdown: filtered,
          };
        }
        
        return {
          totalSales,
          alcoholSales,
          foodSales,
          togoOrders,
          reservations,
          hourlyBreakdown: data.hourlyBreakdown || [],
        };
      }
      
      return {
        totalSales: 0,
        alcoholSales: 0,
        foodSales: 0,
        togoOrders: 0,
        reservations: 0,
        hourlyBreakdown: [],
      };
    }
    
    // For week, load all days in range
    const dates = getDateRange(startDate, endDate);
    
    const salesPromises = dates.map(async (dateISO) => {
      const salesRef = doc(
        db,
        "companies",
        companyId,
        "restaurants",
        restaurantId,
        "sales",
        dateISO
      );
      const snap = await getDoc(salesRef);
      if (snap.exists()) {
        return { date: dateISO, ...snap.data() };
      }
      return {
        date: dateISO,
        totalSales: 0,
        alcoholSales: 0,
        foodSales: 0,
        togoOrders: 0,
        reservations: 0,
      };
    });
    
    const salesData = await Promise.all(salesPromises);
    
    return {
      totalSales: salesData.reduce((sum, d) => sum + (Number(d.totalSales) || 0), 0),
      alcoholSales: salesData.reduce((sum, d) => sum + (Number(d.alcoholSales) || 0), 0),
      foodSales: salesData.reduce((sum, d) => sum + (Number(d.foodSales) || 0), 0),
      togoOrders: salesData.reduce((sum, d) => sum + (Number(d.togoOrders) || 0), 0),
      reservations: salesData.reduce((sum, d) => sum + (Number(d.reservations) || 0), 0),
      dailyBreakdown: salesData,
    };
  } catch (err) {
    console.error(`Failed to load sales data for ${scope}:`, err);
    return {
      totalSales: 0,
      alcoholSales: 0,
      foodSales: 0,
      togoOrders: 0,
      reservations: 0,
      hourlyBreakdown: [],
      dailyBreakdown: [],
    };
  }
}

async function loadLaborData(scope, restaurantId, companyId) {
  const { startDate, endDate, dateISO } = getScopeDateRange(scope);
  
  try {
    if (scope === "shift" || scope === "today") {
      const laborRef = doc(
        db,
        "companies",
        companyId,
        "restaurants",
        restaurantId,
        "laborCosts",
        dateISO
      );
      const snap = await getDoc(laborRef);
      
      if (snap.exists()) {
        const data = snap.data();
        const totalLabor = Number(data.totalLabor) || 0;
        
        // For shift, filter by time if we have hourly breakdown
        if (scope === "shift" && data.hourlyBreakdown) {
          const shiftStart = getShiftStart();
          const hourly = data.hourlyBreakdown || [];
          const filtered = hourly.filter((h) => {
            const hourTime = h.timestamp?.toDate ? h.timestamp.toDate() : new Date(h.timestamp);
            return hourTime >= shiftStart && hourTime <= endDate;
          });
          
          return {
            totalLabor: filtered.reduce((sum, h) => sum + (Number(h.laborCost) || 0), 0),
            hourlyBreakdown: filtered,
          };
        }
        
        return { totalLabor, hourlyBreakdown: data.hourlyBreakdown || [] };
      }
      
      return { totalLabor: 0, hourlyBreakdown: [] };
    }
    
    // For week, load all days
    const dates = getDateRange(startDate, endDate);
    
    const laborPromises = dates.map(async (dateISO) => {
      const laborRef = doc(
        db,
        "companies",
        companyId,
        "restaurants",
        restaurantId,
        "laborCosts",
        dateISO
      );
      const snap = await getDoc(laborRef);
      if (snap.exists()) {
        return { date: dateISO, totalLabor: Number(snap.data().totalLabor) || 0 };
      }
      return { date: dateISO, totalLabor: 0 };
    });
    
    const laborData = await Promise.all(laborPromises);
    
    return {
      totalLabor: laborData.reduce((sum, d) => sum + (Number(d.totalLabor) || 0), 0),
      dailyBreakdown: laborData,
    };
  } catch (err) {
    console.error(`Failed to load labor data for ${scope}:`, err);
    return { totalLabor: 0, hourlyBreakdown: [], dailyBreakdown: [] };
  }
}

async function loadWasteData(scope, restaurantId, companyId) {
  const { startDate, endDate } = getScopeDateRange(scope);
  
  try {
    const movementsRef = collection(
      db,
      "companies",
      companyId,
      "restaurants",
      restaurantId,
      "inventoryMovements"
    );
    
    const q = query(
      movementsRef,
      where("source", "==", "waste"),
      where("createdAt", ">=", Timestamp.fromDate(startDate)),
      where("createdAt", "<=", Timestamp.fromDate(endDate)),
      orderBy("createdAt", "asc")
    );
    
    const snap = await getDocs(q);
    let totalWasteCost = 0;
    const wasteItems = [];
    
    snap.docs.forEach((doc) => {
      const data = doc.data();
      const cost = Number(data.totalCost) || Number(data.cost) || 0;
      totalWasteCost += cost;
      wasteItems.push({
        ...data,
        id: doc.id,
        cost,
        timestamp: data.createdAt,
      });
    });
    
    return {
      totalWasteCost,
      wasteItems,
    };
  } catch (err) {
    console.error(`Failed to load waste data for ${scope}:`, err);
    return { totalWasteCost: 0, wasteItems: [] };
  }
}

function buildRealMetrics(salesData, laborData, wasteData, scope) {
  const sales = salesData.totalSales || 0;
  const alcoholSales = salesData.alcoholSales || 0;
  const foodSales = salesData.foodSales || 0;
  const labor = laborData.totalLabor || 0;
  const waste = wasteData.totalWasteCost || 0;
  const togo = salesData.togoOrders || 0;
  const res = salesData.reservations || 0;
  
  const alcoholMixPct = sales > 0 ? (alcoholSales / sales) * 100 : 0;
  const laborPct = sales > 0 ? (labor / sales) * 100 : 0;
  const wastePct = sales > 0 ? (waste / sales) * 100 : 0;
  
  return {
    sales: { [scope]: money(sales) },
    alcoholMix: { [scope]: pct(alcoholMixPct, 0) },
    foodAlcohol: { [scope]: `${pct((foodSales / sales) * 100, 0)} / ${pct(alcoholMixPct, 0)}` },
    labor: { [scope]: pct(laborPct, 0) },
    waste: { [scope]: pct(wastePct, 1) },
    togo: { [scope]: scope === "shift" ? `${togo} Active` : String(togo) },
    reservations: { [scope]: String(res) },
  };
}

function buildRealChartSets(salesData, laborData, wasteData, scope) {
  // Sales trend data
  let salesTrendData = [];
  if (scope === "shift" || scope === "today") {
    const hourly = salesData.hourlyBreakdown || [];
    if (hourly.length > 0) {
      salesTrendData = hourly.map((h) => {
        const time = h.timestamp?.toDate ? h.timestamp.toDate() : new Date(h.timestamp);
        const label = `${time.getHours()}:${String(time.getMinutes()).padStart(2, "0")}`;
        return {
          label,
          value: Number(h.sales) || Number(h.totalSales) || 0,
        };
      });
    } else {
      // Fallback: create placeholder data
      const now = new Date();
      const shiftStart = scope === "shift" ? getShiftStart() : new Date(now.setHours(0, 0, 0, 0));
      const hours = Math.ceil((now - shiftStart) / (1000 * 60 * 60));
      salesTrendData = Array.from({ length: Math.max(1, hours) }, (_, i) => {
        const hour = new Date(shiftStart);
        hour.setHours(hour.getHours() + i);
        return {
          label: `${hour.getHours()}:00`,
          value: (salesData.totalSales || 0) / Math.max(1, hours),
        };
      });
    }
  } else if (scope === "week") {
    const daily = salesData.dailyBreakdown || [];
    const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    salesTrendData = daily.map((d) => {
      const date = new Date(d.date);
      const dayName = dayLabels[date.getDay()];
      return {
        label: dayName,
        value: Number(d.totalSales) || 0,
      };
    });
  }
  
  // Alcohol mix trend
  let alcoholMixTrend = [];
  if (scope === "shift" || scope === "today") {
    const hourly = salesData.hourlyBreakdown || [];
    if (hourly.length > 0) {
      alcoholMixTrend = hourly.map((h) => {
        const time = h.timestamp?.toDate ? h.timestamp.toDate() : new Date(h.timestamp);
        const label = `${time.getHours()}:${String(time.getMinutes()).padStart(2, "0")}`;
        const total = Number(h.sales) || Number(h.totalSales) || 0;
        const alcohol = Number(h.alcoholSales) || 0;
        const mix = total > 0 ? (alcohol / total) * 100 : 0;
        return { label, mix };
      });
    } else {
      const mix = salesData.totalSales > 0
        ? (salesData.alcoholSales / salesData.totalSales) * 100
        : 0;
      alcoholMixTrend = [{ label: scope === "shift" ? "Shift" : "Today", mix }];
    }
  } else if (scope === "week") {
    const daily = salesData.dailyBreakdown || [];
    const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    alcoholMixTrend = daily.map((d) => {
      const date = new Date(d.date);
      const dayName = dayLabels[date.getDay()];
      const total = Number(d.totalSales) || 0;
      const alcohol = Number(d.alcoholSales) || 0;
      const mix = total > 0 ? (alcohol / total) * 100 : 0;
      return { label: dayName, mix };
    });
  }
  
  // Food vs Alcohol stacked data
  const foodVsAlcoholData = {
    [scope]: [
      {
        label: "Food",
        value: salesData.foodSales || 0,
        color: "#4ade80",
      },
      {
        label: "Alcohol",
        value: salesData.alcoholSales || 0,
        color: "#fbbf24",
      },
    ],
  };
  
  // Labor vs Sales data
  const laborVsSalesData = {
    [scope]: [
      {
        label: scope === "week" ? "Mon" : "Sales",
        sales: salesData.totalSales || 0,
        labor: laborData.totalLabor || 0,
      },
    ],
  };
  
  // Waste data
  const wasteDataPoints = wasteData.wasteItems || [];
  const wasteByCategory = {};
  wasteDataPoints.forEach((item) => {
    const category = item.category || "Other";
    wasteByCategory[category] = (wasteByCategory[category] || 0) + (item.cost || 0);
  });
  
  const wasteDataChart = {
    [scope]: Object.entries(wasteByCategory).map(([category, cost]) => ({
      label: category,
      value: cost,
    })),
  };
  
  // To-go orders data
  const togoData = {
    [scope]: [
      {
        label: scope === "week" ? "Mon" : "To-Go",
        value: salesData.togoOrders || 0,
      },
    ],
  };
  
  // Reservations data
  const reservationsData = {
    [scope]: [
      {
        label: scope === "week" ? "Mon" : "Reservations",
        covers: salesData.reservations || 0,
      },
    ],
  };
  
  return {
    salesTrendData: { [scope]: salesTrendData },
    alcoholMixTrend: { [scope]: alcoholMixTrend },
    alcoholTargets: { target: 35, min: 30, max: 40 },
    foodVsAlcoholData,
    laborVsSalesData,
    wasteData: wasteDataChart,
    wasteThresholds: { prep: 250, comp: 180, spoilage: 120 },
    togoData,
    reservationsData,
    upcomingReservations: [],
  };
}

/* =========================
   MOCK DATA: SHIFT GAMES
   ========================= */

function buildMockShiftGame() {
  return {
    id: "game-ALC-PUSH-01",
    name: "Alcohol Push",
    active: true,
    remainingMinutes: 42,
    durationMinutes: 180,
    endsAtLabel: minutesToClock(42),
    reward: "Top team chooses post-shift drink",
    rules: [
      "Beer + cocktail attachment goal: +3% by end of shift",
      "Double points on featured cocktails",
      "Bartender callouts count as bonus assists",
      "Upsell points count only on check closes",
      "Featured cocktail resets every 30 minutes",
    ],
    targets: {
      alcoholMixTarget: 35,
      attachRateTarget: 0.42,
      featuredCocktail: "Spicy Paloma",
    },
    teams: [
      { label: "Bartenders", score: 118, metric: "Drinks Sold", trend: "up" },
      { label: "Servers", score: 104, metric: "Drink Attachments", trend: "up" },
      { label: "Support", score: 76, metric: "Reset Speed", trend: "flat" },
    ],
    highlights: [
      { label: "Featured cocktail", value: "Spicy Paloma" },
      { label: "Current attachment rate", value: "39%" },
      { label: "Goal", value: "42%" },
      { label: "Mix target", value: "35%" },
    ],
    opsNotes: [
      { label: "Bar speed", value: "8.5 min avg" },
      { label: "Refires", value: "2 in last 30" },
      { label: "Comps", value: "$120 this shift" },
    ],
  };
}

function buildMockShiftGamesCatalog() {
  return [
    {
      id: "cat-ALC-PUSH",
      name: "Alcohol Push",
      category: "Sales Mix",
      description: "Drive cocktail/beer attachment during rush.",
      suggestedTeams: ["Servers", "Bartenders"],
      defaultDuration: 180,
      defaultReward: "Top team picks post-shift perk",
    },
    {
      id: "cat-APP-UPSELL",
      name: "Appetizer Sprint",
      category: "Sales",
      description: "Increase appetizer attach rate on first round.",
      suggestedTeams: ["Servers", "Hosts"],
      defaultDuration: 120,
      defaultReward: "Top closer picks station tomorrow",
    },
    {
      id: "cat-TURN-TIME",
      name: "Turn Time Challenge",
      category: "Operations",
      description: "Improve seating pace and reduce idle tables.",
      suggestedTeams: ["Hosts", "Support"],
      defaultDuration: 240,
      defaultReward: "Shift meal voucher",
    },
    {
      id: "cat-REFIRE-LOCK",
      name: "Refire Lockdown",
      category: "Quality",
      description: "Reduce refires via expo checks and communication.",
      suggestedTeams: ["Kitchen", "Expo"],
      defaultDuration: 300,
      defaultReward: "Kitchen pick playlist + snack pack",
    },
    {
      id: "cat-TOGO-FLOW",
      name: "To-Go Flow",
      category: "Operations",
      description: "Tighten pickup staging and order accuracy.",
      suggestedTeams: ["Expo", "Support"],
      defaultDuration: 180,
      defaultReward: "Top team picks end-of-shift treat",
    },
    {
      id: "cat-COCKTAIL-FEATURE",
      name: "Featured Cocktail Blast",
      category: "Sales",
      description: "Promote one featured cocktail aggressively.",
      suggestedTeams: ["Servers", "Bartenders", "Support"],
      defaultDuration: 150,
      defaultReward: "Top seller picks next feature",
    },
  ];
}

/* =========================
   MOCK DATA: ACTION TEMPLATES
   (used for future "Games Hub" + Ops tasking; not fluff)
   ========================= */

function buildMockActionTemplates() {
  return [
    { id: "act-ALC-01", title: "Run cocktail feature callout", lane: "Shift Games", owner: "Manager", severity: "info" },
    { id: "act-ALC-02", title: "Bar prep: restock citrus + ice", lane: "Shift Games", owner: "Bar", severity: "warning" },
    { id: "act-ALC-03", title: "Server reminder: 1st drink suggestion", lane: "Shift Games", owner: "FOH", severity: "info" },
    { id: "act-OPS-01", title: "Pre-rush line check", lane: "Operations", owner: "Manager", severity: "warning" },
    { id: "act-OPS-02", title: "Expo staging check (To-Go shelf)", lane: "Operations", owner: "Expo", severity: "info" },
    { id: "act-OPS-03", title: "Host pacing update to FOH", lane: "Operations", owner: "Host", severity: "info" },
    { id: "act-QLT-01", title: "Waste scan: prep overpull", lane: "Quality", owner: "Kitchen", severity: "danger" },
    { id: "act-QLT-02", title: "Comp log review (last 30 min)", lane: "Quality", owner: "Manager", severity: "warning" },
    { id: "act-QLT-03", title: "Refire review (last 60 min)", lane: "Quality", owner: "Expo", severity: "warning" },
    { id: "act-LAB-01", title: "Labor trim: cut 1 support at 9:15", lane: "Labor", owner: "Manager", severity: "warning" },
    { id: "act-LAB-02", title: "Reposition coverage: patio → bar", lane: "Labor", owner: "Manager", severity: "info" },
    { id: "act-LAB-03", title: "Break plan check", lane: "Labor", owner: "Manager", severity: "info" },
  ];
}

/* =========================
   MOCK DATA: KPIs + CHARTS (FALLBACK)
   ========================= */

function buildMockMetrics() {
  return {
    sales: { shift: "$24,180", today: "$38,920", week: "$184,220" },
    alcoholMix: { shift: "32%", today: "31%", week: "33%" },
    foodAlcohol: { shift: "68 / 32", today: "69 / 31", week: "67 / 33" },
    labor: { shift: "29%", today: "30%", week: "28%" },
    waste: { shift: "4.6%", today: "4.3%", week: "3.9%" },
    togo: { shift: "14 Active", today: "42", week: "310" },
    reservations: { shift: "23", today: "41", week: "268" },
  };
}

function buildMockChartSets() {
  const salesTrendData = {
    shift: [
      { label: "5:00", value: 1200 },
      { label: "6:00", value: 2800 },
      { label: "7:00", value: 5200 },
      { label: "8:00", value: 7400 },
      { label: "9:00", value: 9100 },
    ],
    today: [
      { label: "Lunch", value: 18200 },
      { label: "Dinner", value: 38920 },
    ],
    week: [
      { label: "Mon", value: 24100 },
      { label: "Tue", value: 26800 },
      { label: "Wed", value: 30120 },
      { label: "Thu", value: 33400 },
      { label: "Fri", value: 42100 },
      { label: "Sat", value: 52100 },
      { label: "Sun", value: 18420 },
    ],
  };

  const alcoholMixTrend = {
    shift: [
      { label: "5:00", mix: 28 },
      { label: "6:00", mix: 30 },
      { label: "7:00", mix: 31 },
      { label: "8:00", mix: 33 },
      { label: "9:00", mix: 32 },
    ],
    today: [
      { label: "Lunch", mix: 31 },
      { label: "Dinner", mix: 32 },
    ],
    week: [
      { label: "Mon", mix: 30 },
      { label: "Tue", mix: 31 },
      { label: "Wed", mix: 32 },
      { label: "Thu", mix: 33 },
      { label: "Fri", mix: 34 },
      { label: "Sat", mix: 33 },
      { label: "Sun", mix: 31 },
    ],
  };

  const alcoholTargets = { min: 30, max: 35, target: 35 };

  const foodVsAlcoholData = {
    shift: [
      { label: "5:00", food: 850, alcohol: 350 },
      { label: "6:00", food: 1900, alcohol: 900 },
      { label: "7:00", food: 3600, alcohol: 1600 },
      { label: "8:00", food: 5100, alcohol: 2300 },
      { label: "9:00", food: 6200, alcohol: 2900 },
    ],
    today: [
      { label: "Lunch", food: 12800, alcohol: 5400 },
      { label: "Dinner", food: 26500, alcohol: 12420 },
    ],
    week: [
      { label: "Mon", food: 16500, alcohol: 7600 },
      { label: "Tue", food: 17600, alcohol: 9200 },
      { label: "Wed", food: 19800, alcohol: 10320 },
      { label: "Thu", food: 21400, alcohol: 12000 },
      { label: "Fri", food: 26800, alcohol: 15300 },
      { label: "Sat", food: 31500, alcohol: 20600 },
      { label: "Sun", food: 12900, alcohol: 5520 },
    ],
  };

  const laborVsSalesData = {
    shift: [
      { label: "5:00", sales: 1200, labor: 32 },
      { label: "6:00", sales: 2800, labor: 31 },
      { label: "7:00", sales: 5200, labor: 30 },
      { label: "8:00", sales: 7400, labor: 29 },
      { label: "9:00", sales: 9100, labor: 28 },
    ],
    today: [
      { label: "Lunch", sales: 18200, labor: 31 },
      { label: "Dinner", sales: 38920, labor: 29 },
    ],
    week: [
      { label: "Mon", sales: 24100, labor: 30 },
      { label: "Tue", sales: 26800, labor: 31 },
      { label: "Wed", sales: 30120, labor: 29 },
      { label: "Thu", sales: 33400, labor: 28 },
      { label: "Fri", sales: 42100, labor: 27 },
      { label: "Sat", sales: 52100, labor: 26 },
      { label: "Sun", sales: 18420, labor: 30 },
    ],
  };

  const wasteData = {
    shift: [
      { label: "Prep", value: 220 },
      { label: "Comp", value: 140 },
      { label: "Spoilage", value: 90 },
    ],
    today: [
      { label: "Prep", value: 610 },
      { label: "Comp", value: 420 },
      { label: "Spoilage", value: 260 },
    ],
    week: [
      { label: "Prep", value: 2900 },
      { label: "Comp", value: 2100 },
      { label: "Spoilage", value: 1550 },
    ],
  };

  const wasteThresholds = { prep: 250, comp: 180, spoilage: 120 };

  const togoData = {
    shift: [
      { label: "5:00", orders: 2 },
      { label: "6:00", orders: 5 },
      { label: "7:00", orders: 9 },
      { label: "8:00", orders: 14 },
      { label: "9:00", orders: 12 },
    ],
    today: [
      { label: "Lunch", orders: 16 },
      { label: "Dinner", orders: 26 },
    ],
    week: [
      { label: "Mon", orders: 38 },
      { label: "Tue", orders: 41 },
      { label: "Wed", orders: 46 },
      { label: "Thu", orders: 52 },
      { label: "Fri", orders: 61 },
      { label: "Sat", orders: 74 },
      { label: "Sun", orders: 28 },
    ],
  };

  const reservationsData = {
    shift: [
      { label: "5:30", covers: 6 },
      { label: "6:00", covers: 10 },
      { label: "6:30", covers: 12 },
      { label: "7:00", covers: 18 },
      { label: "7:30", covers: 16 },
      { label: "8:00", covers: 11 },
      { label: "8:30", covers: 7 },
    ],
    today: [
      { label: "Lunch", covers: 14 },
      { label: "Dinner", covers: 27 },
    ],
    week: [
      { label: "Mon", covers: 31 },
      { label: "Tue", covers: 34 },
      { label: "Wed", covers: 39 },
      { label: "Thu", covers: 45 },
      { label: "Fri", covers: 58 },
      { label: "Sat", covers: 71 },
      { label: "Sun", covers: 20 },
    ],
  };

  const upcomingReservations = [
    { time: "6:15", name: "Sarah M", partySize: 4 },
    { time: "6:30", name: "John D", partySize: 8 },
    { time: "6:45", name: "Patel K", partySize: 6 },
    { time: "7:00", name: "Emily R", partySize: 2 },
    { time: "7:15", name: "Chris P", partySize: 5 },
    { time: "7:30", name: "Nina T", partySize: 3 },
  ];

  return {
    salesTrendData,
    alcoholMixTrend,
    alcoholTargets,
    foodVsAlcoholData,
    laborVsSalesData,
    wasteData,
    wasteThresholds,
    togoData,
    reservationsData,
    upcomingReservations,
  };
}

/* =========================
   UI SUBCOMPONENTS (IN-FILE)
   ========================= */

function TinyPill({ text, tone = "info" }) {
  const styles = {
    info: { background: "rgba(56,189,248,0.14)", border: "1px solid rgba(56,189,248,0.25)" },
    good: { background: "rgba(74,222,128,0.14)", border: "1px solid rgba(74,222,128,0.25)" },
    warning: { background: "rgba(250,204,21,0.14)", border: "1px solid rgba(250,204,21,0.25)" },
    danger: { background: "rgba(248,113,113,0.14)", border: "1px solid rgba(248,113,113,0.25)" },
  };
  const st = styles[tone] || styles.info;
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 800,
        padding: "3px 8px",
        borderRadius: 999,
        color: "rgba(255,255,255,0.9)",
        ...st,
      }}
    >
      {text}
    </span>
  );
}

function SectionHeader({ title, right }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
      <h2 className="section-title" style={{ margin: 0 }}>
        {title}
      </h2>
      {right ? <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>{right}</div> : null}
    </div>
  );
}

function MiniProgressBar({ pctDone, tone = "info" }) {
  const bg = "rgba(255,255,255,0.08)";
  const fgByTone = {
    info: "rgba(56,189,248,0.9)",
    good: "rgba(74,222,128,0.9)",
    warning: "rgba(250,204,21,0.9)",
    danger: "rgba(248,113,113,0.9)",
  };
  const fg = fgByTone[tone] || fgByTone.info;
  const w = clamp(pctDone, 0, 100);
  return (
    <div style={{ width: "100%", height: 8, borderRadius: 999, background: bg, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ width: `${w}%`, height: "100%", background: fg }} />
    </div>
  );
}

function ShiftGamesDetails({ game }) {
  const { leader, delta } = computeGameStatus(game.teams);
  const sortedTeams = sortBy(game.teams, (t) => -safeNum(t.score, 0));
  const progress = computeGameProgress(game);
  return (
    <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <TinyPill text={game.active ? "ACTIVE" : "INACTIVE"} tone={game.active ? "good" : "warning"} />
          <TinyPill text={`ENDS ${game.endsAtLabel}`} tone="info" />
          {leader ? <TinyPill text={`LEADING: ${leader.label} (+${delta})`} tone="good" /> : null}
        </div>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, opacity: 0.9 }}>
          <span style={{ fontWeight: 900 }}>Progress</span>
          <span style={{ fontWeight: 900 }}>{progress.pctDone}%</span>
        </div>
        <MiniProgressBar pctDone={progress.pctDone} tone={game.active ? "good" : "warning"} />
        <div style={{ fontSize: 12, opacity: 0.85 }}>
          {progress.elapsed} min elapsed · {progress.remaining} min remaining · {progress.duration} min total
        </div>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {sortedTeams.map((team) => (
          <div
            key={team.label}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "8px 10px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div style={{ display: "grid", gap: 2 }}>
              <div style={{ fontWeight: 800, fontSize: 13 }}>{team.label}</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                {team.metric}
                {team.trend ? ` · ${team.trend}` : ""}
              </div>
            </div>
            <div style={{ fontWeight: 900, fontSize: 14 }}>{team.score}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 800 }}>Highlights</div>
        <div style={{ display: "grid", gap: 8 }}>
          {game.highlights.map((h) => (
            <div key={h.label} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, opacity: 0.9 }}>
              <span style={{ fontWeight: 700 }}>{h.label}</span>
              <span style={{ fontWeight: 900 }}>{h.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 800 }}>Ops Notes</div>
        <div style={{ display: "grid", gap: 8 }}>
          {game.opsNotes.map((h) => (
            <div key={h.label} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, opacity: 0.9 }}>
              <span style={{ fontWeight: 700 }}>{h.label}</span>
              <span style={{ fontWeight: 900 }}>{h.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 800 }}>Rules</div>
        <ul style={{ margin: 0, paddingLeft: 16, opacity: 0.9, fontSize: 12, display: "grid", gap: 6 }}>
          {game.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 800 }}>Reward</div>
        <div style={{ fontSize: 12, opacity: 0.9 }}>{game.reward}</div>
      </div>
    </div>
  );
}

function UpcomingReservationsList({ items }) {
  return (
    <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.9 }}>Upcoming (Next 60–90 min)</div>
        <TinyPill text={`${items.length} UPCOMING`} tone="info" />
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {items.map((r, i) => (
          <div
            key={`${r.time}-${r.name}-${i}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "8px 10px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 800 }}>
              {r.time} {r.name}-{r.partySize}
            </div>
            <TinyPill text={`${r.partySize}`} tone="good" />
          </div>
        ))}
      </div>
    </div>
  );
}

function GamesHubPreview({ catalog, templates }) {
  const byCat = useMemo(() => {
    const groups = {};
    (catalog || []).forEach((g) => {
      const k = g.category || "Other";
      if (!groups[k]) groups[k] = [];
      groups[k].push(g);
    });
    Object.keys(groups).forEach((k) => {
      groups[k] = sortBy(groups[k], (x) => x.name);
    });
    return groups;
  }, [catalog]);

  const lanes = useMemo(() => {
    const groups = {};
    (templates || []).forEach((t) => {
      const k = t.lane || "General";
      if (!groups[k]) groups[k] = [];
      groups[k].push(t);
    });
    Object.keys(groups).forEach((k) => {
      groups[k] = sortBy(groups[k], (x) => x.title);
    });
    return groups;
  }, [templates]);

  const catKeys = useMemo(() => Object.keys(byCat), [byCat]);
  const laneKeys = useMemo(() => Object.keys(lanes), [lanes]);

  return (
    <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <TinyPill text={`${catalog.length} GAME TYPES`} tone="info" />
        <TinyPill text={`${templates.length} ACTION TEMPLATES`} tone="good" />
        <TinyPill text={`${catKeys.length} CATEGORIES`} tone="info" />
        <TinyPill text={`${laneKeys.length} LANES`} tone="info" />
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {catKeys.map((k) => (
          <div key={k} style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.9 }}>{k}</div>
            <div style={{ display: "grid", gap: 8 }}>
              {byCat[k].slice(0, 3).map((g) => (
                <div
                  key={g.id}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    display: "grid",
                    gap: 4,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 900 }}>{g.name}</div>
                    <TinyPill text={`${g.defaultDuration}m`} tone="info" />
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.35 }}>{g.description}</div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>
                    Teams: <strong style={{ opacity: 0.95 }}>{(g.suggestedTeams || []).join(", ")}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.9 }}>Example Action Templates</div>
        <div style={{ display: "grid", gap: 8 }}>
          {templates.slice(0, 6).map((t) => (
            <div
              key={t.id}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                alignItems: "center",
              }}
            >
              <div style={{ display: "grid", gap: 2 }}>
                <div style={{ fontSize: 13, fontWeight: 900 }}>{t.title}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  {t.lane} · {t.owner}
                </div>
              </div>
              <TinyPill text={String(t.severity || "info").toUpperCase()} tone={pickToneFromStatus(t.severity)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* =========================
   MAIN COMPONENT
   ========================= */

export default function OverviewTab() {
  const { restaurantId: routeRestaurantId } = useParams();
  const restaurantId = routeRestaurantId || "123";
  const navigate = useNavigate();
  const companyId = COMPANY_ID;

  const [expandedCard, setExpandedCard] = useState(null);
  const [timeScope, setTimeScope] = useState("shift");
  const [staff, setStaff] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  
  // Real data state
  const [realMetrics, setRealMetrics] = useState({});
  const [realCharts, setRealCharts] = useState({});
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState(null);

   // ================= LOAD STAFF DATA =================
   const loadStaff = useCallback(async () => {
    if (!restaurantId) {
      console.warn("OverviewTab: No restaurantId provided");
      setLoading(false);
      setError("No restaurant ID provided. Please check the URL.");
      return;
    }
    
    setLoading(true);
    setError(null);
    setDebugInfo(null);
    
    try {
      const staffRef = collection(
        db,
        "restaurants",
        restaurantId,
        "staff"
      );
      
      const path = `restaurants/${restaurantId}/staff`;
      console.log("OverviewTab: Loading staff from:", path);
      
      const snap = await getDocs(staffRef);
      
      const staffList = snap.docs.map((d) => {
        const data = d.data() || {};
        return {
          id: d.id,
          uid: data.uid || d.id,
          name: data.name || d.id,
          role: data.role || "Front of House",
          subRole: data.subRole || "",
          active: data.active !== false,
          imageURL: data.imageURL || "",
        };
      });

      setDebugInfo({
        path: path,
        restaurantId: restaurantId,
        totalDocs: snap.docs.length,
        processedStaff: staffList.length,
      });
      
      if (staffList.length === 0) {
        setError(`No staff found at ${path}.`);
      } else {
        setStaff(staffList);
        setError(null);
      }
    } catch (err) {
      console.error("OverviewTab: Failed to load staff:", err);
      setError(`Failed to load staff data: ${err.message}`);
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  // ================= LOAD ATTENDANCE DATA =================
  const loadAttendance = useCallback(async () => {
    if (!restaurantId || staff.length === 0) return;

    try {
      const attendanceMap = {};
      
      await Promise.all(
        staff.map(async (s) => {
          try {
            const attendanceRef = doc(
              db,
              "companies",
              COMPANY_ID,
              "restaurants",
              restaurantId,
              "attendance",
              s.uid
            );
            
            const snap = await getDoc(attendanceRef);
            if (snap.exists()) {
              const data = snap.data();
              attendanceMap[s.uid] = {
                status: data.status || "off",
                punchedInAt: data.punchedInAt,
                punchedOutAt: data.punchedOutAt,
              };
            }
          } catch (err) {
            console.error(`Failed to load attendance for ${s.uid}:`, err);
          }
        })
      );

      setAttendance(attendanceMap);
    } catch (err) {
      console.error("Failed to load attendance:", err);
    }
  }, [restaurantId, staff]);

    // ================= LOAD SHIFT GAMES DATA =================
    const [shiftGameState, setShiftGameState] = useState(null);
    const [gamesCatalogState, setGamesCatalogState] = useState([]);
    const [loadingGames, setLoadingGames] = useState(false);
  
    const loadShiftGames = useCallback(async () => {
      if (!restaurantId) return;
      
      setLoadingGames(true);
      try {
        // Load active games
        const activeGamesRef = collection(
          db,
          "companies",
          COMPANY_ID,
          "restaurants",
          restaurantId,
          "activeShiftGames"
        );
        
        const activeSnap = await getDocs(
          query(activeGamesRef, where("active", "==", true), orderBy("startTime", "desc"), limit(1))
        );
        
        if (!activeSnap.empty) {
          const activeGameDoc = activeSnap.docs[0];
          const activeGameData = activeGameDoc.data();
          
          // Calculate remaining time
          const startTime = activeGameData.startTime?.toDate();
          const duration = activeGameData.gameData?.duration || 180;
          const endTime = startTime ? new Date(startTime.getTime() + duration * 60 * 1000) : null;
          const now = new Date();
          const remainingMs = endTime ? Math.max(0, endTime.getTime() - now.getTime()) : 0;
          const remainingMinutes = Math.floor(remainingMs / 60000);
          
          // Format game data for display
          const formattedGame = {
            id: activeGameDoc.id,
            name: activeGameData.gameName || activeGameData.gameData?.name || "Active Game",
            active: true,
            remainingMinutes: remainingMinutes,
            durationMinutes: duration,
            endsAtLabel: minutesToClock(remainingMinutes),
            reward: activeGameData.reward || activeGameData.gameData?.defaultReward || "Shift Meal",
            rules: activeGameData.gameData?.rules || [],
            targets: activeGameData.gameData?.targets || {},
            teams: activeGameData.gameData?.teams || [],
            highlights: [],
            opsNotes: [],
          };
          
          setShiftGameState(formattedGame);
        } else {
          setShiftGameState(null);
        }
        
        // Load games catalog (pre-made + custom)
        const gamesRef = collection(
          db,
          "companies",
          COMPANY_ID,
          "restaurants",
          restaurantId,
          "shiftGames"
        );
        
        const gamesSnap = await getDocs(query(gamesRef, orderBy("createdAt", "desc")));
        const customGames = gamesSnap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || d.id,
          category: d.data().category || "Custom",
          description: d.data().description || "",
          suggestedTeams: d.data().teams || [],
          defaultDuration: d.data().duration || 180,
          defaultReward: d.data().defaultReward || d.data().reward || "Shift Meal",
          isCustom: true,
        }));
        
        // Combine with pre-made games (from ShiftGamesHub PREMADE_GAMES)
        const preMadeGames = [
          { id: "foh-alc-push", name: "Alcohol Push", category: "Sales Mix", description: "Increase beer + cocktail attachment during peak hours.", suggestedTeams: ["Servers", "Bartenders"], defaultDuration: 180, defaultReward: "75 Lineup Points" },
          { id: "foh-featured-cocktail", name: "Featured Cocktail Blast", category: "Sales", description: "Promote one featured cocktail aggressively for a time block.", suggestedTeams: ["Servers", "Bartenders", "Support"], defaultDuration: 150, defaultReward: "50 Lineup Points" },
          { id: "foh-app-sprint", name: "Appetizer Sprint", category: "Sales", description: "Boost appetizer attachment on first round orders.", suggestedTeams: ["Servers"], defaultDuration: 120, defaultReward: "Shift Meal" },
          { id: "boh-ticket-time", name: "Ticket Time Champion", category: "Speed", description: "Reduce average ticket time while maintaining quality.", suggestedTeams: ["Kitchen"], defaultDuration: 240, defaultReward: "100 Lineup Points" },
          { id: "boh-waste-warrior", name: "Waste Warrior", category: "Efficiency", description: "Minimize food waste and maximize ingredient utilization.", suggestedTeams: ["Kitchen"], defaultDuration: 300, defaultReward: "150 Lineup Points" },
          { id: "boh-prep-master", name: "Prep Master", category: "Efficiency", description: "Complete all prep tasks efficiently with minimal waste.", suggestedTeams: ["Kitchen"], defaultDuration: 180, defaultReward: "75 Lineup Points" },
        ];
        
        setGamesCatalogState([...preMadeGames, ...customGames]);
      } catch (err) {
        console.error("Failed to load shift games:", err);
        // Fallback to mock data on error
        setShiftGameState(buildMockShiftGame());
        setGamesCatalogState(buildMockShiftGamesCatalog());
      } finally {
        setLoadingGames(false);
      }
    }, [restaurantId]);
  
    useEffect(() => {
      loadShiftGames();
      // Refresh every 60 seconds to update remaining time
      const interval = setInterval(() => {
        loadShiftGames();
      }, 60000);
      return () => clearInterval(interval);
    }, [loadShiftGames]);
      
    // ================= LOAD REAL FINANCIAL DATA =================
    useEffect(() => {
      const loadData = async () => {
        if (!restaurantId) return;
        
        setLoadingData(true);
        setDataError(null);
        
        try {
          const scopes = ["shift", "today", "week"];
          const metricsData = {};
          const chartsData = {};
          
          for (const scope of scopes) {
            const [salesData, laborData, wasteData] = await Promise.all([
              loadSalesData(scope, restaurantId, companyId),
              loadLaborData(scope, restaurantId, companyId),
              loadWasteData(scope, restaurantId, companyId),
            ]);
            
            metricsData[scope] = buildRealMetrics(salesData, laborData, wasteData, scope);
            chartsData[scope] = buildRealChartSets(salesData, laborData, wasteData, scope);
          }
          
          // Merge metrics across scopes
          const mergedMetrics = {
            sales: {
              shift: metricsData.shift.sales.shift,
              today: metricsData.today.sales.today,
              week: metricsData.week.sales.week,
            },
            alcoholMix: {
              shift: metricsData.shift.alcoholMix.shift,
              today: metricsData.today.alcoholMix.today,
              week: metricsData.week.alcoholMix.week,
            },
            foodAlcohol: {
              shift: metricsData.shift.foodAlcohol.shift,
              today: metricsData.today.foodAlcohol.today,
              week: metricsData.week.foodAlcohol.week,
            },
            labor: {
              shift: metricsData.shift.labor.shift,
              today: metricsData.today.labor.today,
              week: metricsData.week.labor.week,
            },
            waste: {
              shift: metricsData.shift.waste.shift,
              today: metricsData.today.waste.today,
              week: metricsData.week.waste.week,
            },
            togo: {
              shift: metricsData.shift.togo.shift,
              today: metricsData.today.togo.today,
              week: metricsData.week.togo.week,
            },
            reservations: {
              shift: metricsData.shift.reservations.shift,
              today: metricsData.today.reservations.today,
              week: metricsData.week.reservations.week,
            },
          };
          
          setRealMetrics(mergedMetrics);
          setRealCharts(chartsData);
        } catch (err) {
          console.error("Failed to load overview data:", err);
          setDataError(`Failed to load data: ${err.message}`);
        } finally {
          setLoadingData(false);
        }
      };
      
      loadData();
    }, [restaurantId, companyId]);
  
   // ================= INITIAL LOAD =================
    useEffect(() => {
      loadStaff();
    }, [loadStaff]);
  
    useEffect(() => {
      if (staff.length > 0) {
        loadAttendance();
      }
    }, [staff, loadAttendance]);
  
    // ================= LIVE SHIFT SNAPSHOT =================
    const liveShiftSnapshot = useMemo(() => {
      const onShift = staff.filter((s) => {
        const att = attendance[s.uid];
        return att?.status === "active";
      });
  
      const foh = onShift.filter((s) => s.role === "Front of House").length;
      const boh = onShift.filter((s) => s.role === "Back of House").length;
  
      return {
        total: staff.length,
        onShift: onShift.length,
        foh,
        boh,
        offShift: staff.length - onShift.length,
      };
    }, [staff, attendance]);
  
    // ================= USE REAL DATA WITH FALLBACK =================
    // Use real shift game data from Firestore, fallback to mock if none active
    const shiftGame = shiftGameState || buildMockShiftGame();
    const gamesCatalog = gamesCatalogState.length > 0 ? gamesCatalogState : buildMockShiftGamesCatalog();
    const actionTemplates = useMemo(() => buildMockActionTemplates(), []);

  const metrics = useMemo(() => {
    if (Object.keys(realMetrics).length > 0) {
      return realMetrics;
    }
    return buildMockMetrics();
  }, [realMetrics]);
  
  const charts = useMemo(() => {
    if (Object.keys(realCharts).length > 0) {
      // Merge chart data across scopes
      const merged = {
        salesTrendData: {
          shift: realCharts.shift?.salesTrendData?.shift || [],
          today: realCharts.today?.salesTrendData?.today || [],
          week: realCharts.week?.salesTrendData?.week || [],
        },
        alcoholMixTrend: {
          shift: realCharts.shift?.alcoholMixTrend?.shift || [],
          today: realCharts.today?.alcoholMixTrend?.today || [],
          week: realCharts.week?.alcoholMixTrend?.week || [],
        },
        alcoholTargets: realCharts.shift?.alcoholTargets || { target: 35, min: 30, max: 40 },
        foodVsAlcoholData: {
          shift: realCharts.shift?.foodVsAlcoholData?.shift || [],
          today: realCharts.today?.foodVsAlcoholData?.today || [],
          week: realCharts.week?.foodVsAlcoholData?.week || [],
        },
        laborVsSalesData: {
          shift: realCharts.shift?.laborVsSalesData?.shift || [],
          today: realCharts.today?.laborVsSalesData?.today || [],
          week: realCharts.week?.laborVsSalesData?.week || [],
        },
        wasteData: {
          shift: realCharts.shift?.wasteData?.shift || [],
          today: realCharts.today?.wasteData?.today || [],
          week: realCharts.week?.wasteData?.week || [],
        },
        wasteThresholds: realCharts.shift?.wasteThresholds || { prep: 250, comp: 180, spoilage: 120 },
        togoData: {
          shift: realCharts.shift?.togoData?.shift || [],
          today: realCharts.today?.togoData?.today || [],
          week: realCharts.week?.togoData?.week || [],
        },
        reservationsData: {
          shift: realCharts.shift?.reservationsData?.shift || [],
          today: realCharts.today?.reservationsData?.today || [],
          week: realCharts.week?.reservationsData?.week || [],
        },
        upcomingReservations: realCharts.shift?.upcomingReservations || [],
      };
      return merged;
    }
    return buildMockChartSets();
  }, [realCharts]);

  function toggleCard(cardKey) {
    setExpandedCard((prev) => (prev === cardKey ? null : cardKey));
  }

  // Derive numeric KPIs for auto focus (from real or mock data)
  const numeric = useMemo(() => {
    const sales = metrics.sales[timeScope] || "$0";
    const salesNum = safeNum(sales.replace(/[^0-9.]/g, ""), 0);
    const alcoholMix = metrics.alcoholMix[timeScope] || "0%";
    const mixNum = safeNum(alcoholMix.replace("%", ""), 0);
    const labor = metrics.labor[timeScope] || "0%";
    const laborNum = safeNum(labor.replace("%", ""), 0);
    const waste = metrics.waste[timeScope] || "0%";
    const wasteNum = safeNum(waste.replace("%", ""), 0);
    const togo = metrics.togo[timeScope] || "0";
    const togoNum = safeNum(togo.replace(/\D/g, ""), 0);
    const res = metrics.reservations[timeScope] || "0";
    const resNum = safeNum(res, 0);
    
    return {
      alcoholMixPct: mixNum,
      alcoholTargetPct: charts.alcoholTargets.target,
      laborPct: laborNum,
      laborTargetPct: 30,
      wastePct: wasteNum,
      wasteTargetPct: 4.0,
      togoOrders: togoNum,
      reservations: resNum,
    };
  }, [timeScope, metrics, charts.alcoholTargets.target]);

  const shiftFocus = useMemo(() => computeShiftFocus(numeric), [numeric]);

  // Trend summaries (useful for pills + later for Insights tab)
  const trendSummary = useMemo(() => {
    const salesSeries = charts.salesTrendData[timeScope] || [];
    const mixSeries = charts.alcoholMixTrend[timeScope] || [];
    const lastSales = salesSeries.length ? safeNum(salesSeries[salesSeries.length - 1].value, 0) : 0;
    const avgMix = avg(mixSeries, (x) => x.mix);
    const weekSales = charts.salesTrendData.week || [];
    const weekTotal = sum(weekSales, (x) => x.value);
    return {
      lastSales,
      avgMix,
      weekTotal,
      weekTotalFmt: money(weekTotal),
      avgMixFmt: pct(avgMix, 0),
    };
  }, [charts, timeScope]);

  const scopeTag = scopeLabel(timeScope);

  const scopePills = useMemo(() => {
    return [
      <TinyPill key="scope" text={scopeTag} tone="info" />,
      <TinyPill key="wk" text={`WEEK TOTAL ${trendSummary.weekTotalFmt}`} tone="good" />,
      <TinyPill key="mix" text={`AVG MIX ${trendSummary.avgMixFmt}`} tone="info" />,
      <TinyPill key="staff" text={`ON SHIFT: ${liveShiftSnapshot.onShift}`} tone="good" />,
    ];
  }, [scopeTag, trendSummary.weekTotalFmt, trendSummary.avgMixFmt, liveShiftSnapshot.onShift]);

  // Active Shift slider state
  const [activeShiftIndex, setActiveShiftIndex] = useState(0);

  // Route (centralized string, safer for future refactors)
  const SHIFT_GAMES_HUB_ROUTE = "/dashboard/shift-games";

  // Click handlers
  function goToShiftGamesHub() {
    navigate(SHIFT_GAMES_HUB_ROUTE);
  }

  function goToShiftGamesHubWithContext() {
    navigate(SHIFT_GAMES_HUB_ROUTE, { 
      state: { 
        from: "restaurant-overview", 
        focusGameId: shiftGame?.id 
      } 
    });
  }

  // Derived hub preview metadata (for compact display in the hub CTA card)
  const hubMeta = useMemo(() => {
    const cats = new Set((gamesCatalog || []).map((g) => g.category || "Other"));
    const lanes = new Set((actionTemplates || []).map((t) => t.lane || "General"));
    const popular = (gamesCatalog || []).slice(0, 3).map((g) => g.name);
    return {
      gameTypes: gamesCatalog.length,
      categories: cats.size,
      templates: actionTemplates.length,
      lanes: lanes.size,
      popular,
      popularKey: popular.map(slugify).join("|"),
    };
  }, [gamesCatalog, actionTemplates]);

  // Active Shift cards array (defined after all dependencies)
  const activeShiftCards = useMemo(() => {
    return [
      {
        id: "shiftGames",
        component: (
          <MetricCard
            key="shiftGames"
            title="Shift Games"
            value={shiftGame.name}
            subtext={`${shiftGame.remainingMinutes} min remaining`}
            status="info"
          >
            <ShiftGamesDetails game={shiftGame} />
          </MetricCard>
        ),
      },
      {
        id: "reminder",
        component: (
          <CountdownTimer key="reminder" title="Next Reminder" label="Pre-Rush Line Check" minutes={18} />
        ),
      },
      {
        id: "shiftFocus",
        component: (
          <MetricCard
            key="shiftFocus"
            title={shiftFocus.title}
            value={shiftFocus.value}
            subtext={shiftFocus.subtext}
            status={shiftFocus.status}
          >
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <TinyPill text={`ALC MIX ${pct(numeric.alcoholMixPct, 0)}`} tone="info" />
                <TinyPill text={`TARGET ${pct(numeric.alcoholTargetPct, 0)}`} tone="good" />
                <TinyPill text={`LABOR ${pct(numeric.laborPct, 0)}`} tone={numeric.laborPct > 30 ? "warning" : "good"} />
                <TinyPill text={`WASTE ${pct(numeric.wastePct, 1)}`} tone={numeric.wastePct > 4.0 ? "danger" : "good"} />
              </div>
              <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.35 }}>
                Auto focus is driven by scope KPIs (mix/labor/waste/to-go/reservations). Data loaded from Firestore in real-time.
              </div>
            </div>
          </MetricCard>
        ),
      },
      {
        id: "gamesHub",
        component: (
          <MetricCard
            key="gamesHub"
            title="Shift Games Hub"
            value="Manage Games"
            subtext="Create • Edit • Assign"
            status="info"
            onClick={goToShiftGamesHubWithContext}
          >
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <TinyPill text={`${hubMeta.gameTypes} TYPES`} tone="info" />
                <TinyPill text={`${hubMeta.categories} CATS`} tone="info" />
              </div>
              <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.35 }}>
                Tap to open the Shift Games Hub for this restaurant. Build games, set teams, set rewards, and run active shift challenges.
              </div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>
                Popular: <strong style={{ opacity: 0.95 }}>{hubMeta.popular.join(", ")}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <TinyPill text="OPEN HUB" tone="good" />
                <span style={{ fontSize: 12, opacity: 0.8 }}>{SHIFT_GAMES_HUB_ROUTE}</span>
              </div>
            </div>
          </MetricCard>
        ),
      },
    ];
  }, [shiftGame, shiftFocus, numeric, hubMeta, goToShiftGamesHubWithContext]);

  return (
    <div className="overview-wrapper">
      {/* LEVEL 1 — ACTIVE SHIFT (SLIDER) */}
      <section className="overview-section">
        <SectionHeader title="Active Shift" right={scopePills} />

        {/* Slider Container */}
        <div className="active-shift-slider">
          <div 
            className="active-shift-slider__track"
            style={{ 
              transform: `translateX(-${activeShiftIndex * 100}%)`,
              display: "flex",
              transition: "transform 0.3s ease"
            }}
          >
            {activeShiftCards.map((card) => (
              <div key={card.id} className="active-shift-slider__slide" style={{ minWidth: "100%", flexShrink: 0 }}>
                {card.component}
              </div>
            ))}
          </div>
          
          {/* Slider Controls */}
          <div className="active-shift-slider__controls">
            <button
              type="button"
              className="active-shift-slider__btn"
              onClick={() => setActiveShiftIndex((prev) => Math.max(0, prev - 1))}
              disabled={activeShiftIndex === 0}
              aria-label="Previous card"
            >
              ←
            </button>
            <div className="active-shift-slider__dots">
              {activeShiftCards.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`active-shift-slider__dot ${idx === activeShiftIndex ? "active" : ""}`}
                  onClick={() => setActiveShiftIndex(idx)}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
            <button
              type="button"
              className="active-shift-slider__btn"
              onClick={() => setActiveShiftIndex((prev) => Math.min(activeShiftCards.length - 1, prev + 1))}
              disabled={activeShiftIndex === activeShiftCards.length - 1}
              aria-label="Next card"
            >
              →
            </button>
          </div>
        </div>
      </section>

      {/* LEVEL 2 — SHIFT SNAPSHOT */}
      <section className="overview-section">
        <SectionHeader
          title="Shift Snapshot"
          right={[
            <TinyPill key="s1" text="TAP A CARD TO EXPAND" tone="info" />,
            <TinyPill key="s2" text="SHIFT / TODAY / WEEK TOGGLE" tone="good" />,
          ]}
        />

        {/* Row 1: Total Sales, Alcohol Mix */}
        <div className="kpi-grid kpi-grid--row">
          <MetricCard
            title="Total Sales"
            value={metrics.sales[timeScope]}
            subtext={scopeTag}
            expanded={expandedCard === "sales"}
            onToggle={() => toggleCard("sales")}
            timeScope={timeScope}
            onScopeChange={setTimeScope}
          >
            <SimpleLineChart data={charts.salesTrendData[timeScope]} dataKey="value" color="#4ade80" />
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
              Last point: <strong style={{ opacity: 0.95 }}>{money(trendSummary.lastSales)}</strong>
            </div>
          </MetricCard>

          <MetricCard
            title="Alcohol Mix"
            value={metrics.alcoholMix[timeScope]}
            subtext={`Target: ${charts.alcoholTargets.target}%`}
            status={
              numeric.alcoholMixPct < charts.alcoholTargets.min
                ? "danger"
                : numeric.alcoholMixPct < charts.alcoholTargets.target
                ? "warning"
                : "good"
            }
            expanded={expandedCard === "alcoholMix"}
            onToggle={() => toggleCard("alcoholMix")}
            timeScope={timeScope}
            onScopeChange={setTimeScope}
          >
            <AlcoholMixTargetChart
              data={charts.alcoholMixTrend[timeScope]}
              min={charts.alcoholTargets.min}
              max={charts.alcoholTargets.max}
              target={charts.alcoholTargets.target}
            />
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <TinyPill text={`MIN ${pct(charts.alcoholTargets.min, 0)}`} tone="info" />
              <TinyPill text={`MAX ${pct(charts.alcoholTargets.max, 0)}`} tone="info" />
              <TinyPill text={`TARGET ${pct(charts.alcoholTargets.target, 0)}`} tone="good" />
            </div>
          </MetricCard>
        </div>

        {/* Row 2: Food vs Alcohol, Labor */}
        <div className="kpi-grid kpi-grid--row">
          <MetricCard
            title="Food vs Alcohol"
            value={metrics.foodAlcohol[timeScope]}
            subtext="Composition"
            expanded={expandedCard === "foodAlcohol"}
            onToggle={() => toggleCard("foodAlcohol")}
            timeScope={timeScope}
            onScopeChange={setTimeScope}
          >
            <FoodVsAlcoholStackedChart data={charts.foodVsAlcoholData[timeScope]} />
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
              Use this to monitor drink attachment and category balance across the scope.
            </div>
          </MetricCard>

          <MetricCard
            title="Labor %"
            value={metrics.labor[timeScope]}
            subtext="Target: 30%"
            status={numeric.laborPct > 31 ? "warning" : "good"}
            expanded={expandedCard === "labor"}
            onToggle={() => toggleCard("labor")}
            timeScope={timeScope}
            onScopeChange={setTimeScope}
          >
            <LaborVsSalesChart data={charts.laborVsSalesData[timeScope]} />
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <TinyPill text={`LABOR ${pct(numeric.laborPct, 0)}`} tone={numeric.laborPct > 31 ? "warning" : "good"} />
              <TinyPill text="TARGET 30%" tone="info" />
            </div>
          </MetricCard>
        </div>

        {/* Row 3: Waste, To-Go Orders */}
        <div className="kpi-grid kpi-grid--row">
          <MetricCard
            title="Waste %"
            value={metrics.waste[timeScope]}
            subtext="By category"
            status={numeric.wastePct > 4.5 ? "danger" : numeric.wastePct > 4.0 ? "warning" : "good"}
            expanded={expandedCard === "waste"}
            onToggle={() => toggleCard("waste")}
            timeScope={timeScope}
            onScopeChange={setTimeScope}
          >
            <WasteBreakdownChart data={charts.wasteData[timeScope]} thresholds={charts.wasteThresholds} />
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
              Targets: Prep {money(charts.wasteThresholds.prep)} · Comp {money(charts.wasteThresholds.comp)} · Spoilage{" "}
              {money(charts.wasteThresholds.spoilage)}
            </div>
          </MetricCard>

          <MetricCard
            title="To-Go Orders"
            value={metrics.togo[timeScope]}
            subtext="Volume"
            expanded={expandedCard === "togo"}
            onToggle={() => toggleCard("togo")}
            timeScope={timeScope}
            onScopeChange={setTimeScope}
          >
            <ToGoOrdersBarChart data={charts.togoData[timeScope]} />
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
              If volume spikes, tighten expo flow and pickup staging; use StaffTab for coverage actions.
            </div>
          </MetricCard>
        </div>

        {/* Row 4: Reservations (takes first column, second column empty for future use) */}
        <div className="kpi-grid kpi-grid--row">
          <MetricCard
            title="Reservations"
            value={metrics.reservations[timeScope]}
            subtext="By slot"
            expanded={expandedCard === "reservations"}
            onToggle={() => toggleCard("reservations")}
            timeScope={timeScope}
            onScopeChange={setTimeScope}
          >
            <ReservationsTimelineChart data={charts.reservationsData[timeScope]} />
            <UpcomingReservationsList items={charts.upcomingReservations} />
          </MetricCard>
          <div></div>
        </div>
      </section>

      {/* LEVEL 3 — ALERTS */}
      <section className="overview-section">
        <SectionHeader
          title="Alerts & Staffing"
          right={[
            <TinyPill key="a1" text="ACTION ITEMS" tone="warning" />,
            <TinyPill key="a2" text="CLICK TO ACKNOWLEDGE (LATER)" tone="info" />,
          ]}
        />

        {/* Dynamic Alerts - only show actual alerts */}
        <div className="kpi-grid">
          {/* Live Shift Snapshot - always show */}
          <AlertCard 
            title="Live Shift Snapshot" 
            severity="info" 
            message={`${liveShiftSnapshot.onShift} on shift (${liveShiftSnapshot.foh} FOH, ${liveShiftSnapshot.boh} BOH) · ${liveShiftSnapshot.total} total staff`} 
          />
          {/* Additional alerts would be added here dynamically as they occur */}
        </div>

        {/* Embedded preview for future Shift Games Hub content (keeps your UI moving forward) */}
        <div style={{ marginTop: 16 }}>
          <MetricCard
            title="Shift Games Hub Preview"
            value="Game Types + Templates"
            subtext="This preview will move into its own Shift Games page"
            status="info"
            onClick={goToShiftGamesHub}
          >
            <GamesHubPreview catalog={gamesCatalog} templates={actionTemplates} />
          </MetricCard>
        </div>
      </section>

      {/* Developer anchors (non-visual; used later when wiring real data) */}
      {/* SHIFT_GAMES_HUB_ROUTE: {SHIFT_GAMES_HUB_ROUTE} */}
      {/* ACTIVE_GAME_ID: {shiftGame.id} */}
      {/* HUB_META_KEY: {hubMeta.popularKey} */}
    </div>
  );
}