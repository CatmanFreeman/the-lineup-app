// src/pages/Dashboards/RestaurantDashboard/tabs/FinanceTab.jsx

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../../../hooks/services/firebase";
import "./OverviewTab.css";
import SimpleLineChart from "../../../../components/charts/SimpleLineChart";
import LaborVsSalesChart from "../../../../components/charts/LaborVsSalesChart";

/**
 * =====================================================
 * FinanceTab — Production-Grade Financial Dashboard
 * =====================================================
 * 
 * Features:
 * - Multi-period view (Today, Week, Month, Quarter, Year)
 * - Comprehensive KPIs (Sales, Labor, Food Cost, Prime Cost, Profit)
 * - Expense tracking and categorization
 * - Period-over-period comparisons
 * - Export functionality
 * - Full Firestore integration
 * - Manual data entry for missing periods
 */

const PERIODS = ["today", "week", "month", "quarter", "year"];
const COMPANY_ID = "company-demo";

// Utility functions
function formatCurrency(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatPercent(value, decimals = 1) {
  const n = Number(value || 0);
  return `${n.toFixed(decimals)}%`;
}

function getStatusColor(value, thresholds) {
  if (value <= thresholds.good) return "#22c55e"; // green
  if (value <= thresholds.warning) return "#facc15"; // yellow
  return "#ef4444"; // red
}

function getStatusClass(value, thresholds) {
  if (value <= thresholds.good) return "good";
  if (value <= thresholds.warning) return "warning";
  return "danger";
}

// Date utilities
function getDateISO(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getPeriodDates(period) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  let startDate, endDate;
  
  switch (period) {
    case "today":
      startDate = new Date(today);
      endDate = new Date(today);
      endDate.setHours(23, 59, 59, 999);
      break;
    case "week":
      const dayOfWeek = today.getDay();
      const daysFromSunday = dayOfWeek === 0 ? 0 : dayOfWeek;
      startDate = new Date(today);
      startDate.setDate(today.getDate() - daysFromSunday);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
      break;
    case "month":
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case "quarter":
      const quarter = Math.floor(today.getMonth() / 3);
      startDate = new Date(today.getFullYear(), quarter * 3, 1);
      endDate = new Date(today.getFullYear(), (quarter + 1) * 3, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case "year":
      startDate = new Date(today.getFullYear(), 0, 1);
      endDate = new Date(today.getFullYear(), 11, 31);
      endDate.setHours(23, 59, 59, 999);
      break;
    default:
      startDate = today;
      endDate = today;
  }
  
  return { startDate, endDate };
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

export default function FinanceTab() {
  const { restaurantId } = useParams();
  const companyId = COMPANY_ID;
  
  const [selectedPeriod, setSelectedPeriod] = useState("week");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [financialData, setFinancialData] = useState({});
  const [showDataEntry, setShowDataEntry] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getDateISO());

  // ================= LOAD FINANCIAL DATA =================
  const loadFinancialData = useCallback(async (period) => {
    if (!restaurantId) return;

    try {
      const { startDate, endDate } = getPeriodDates(period);
      const dateRange = getDateRange(startDate, endDate);

      // Load sales data
      const salesPromises = dateRange.map(async (dateISO) => {
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
        return { date: dateISO, totalSales: 0, alcoholSales: 0, foodSales: 0, togoOrders: 0, reservations: 0 };
      });

      // Load labor costs
      const laborPromises = dateRange.map(async (dateISO) => {
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
          return { date: dateISO, ...snap.data() };
        }
        return { date: dateISO, totalLabor: 0, hourlyWages: 0, overtime: 0 };
      });

      // Load expenses
      const expensePromises = dateRange.map(async (dateISO) => {
        const expenseRef = doc(
          db,
          "companies",
          companyId,
          "restaurants",
          restaurantId,
          "expenses",
          dateISO
        );
        const snap = await getDoc(expenseRef);
        if (snap.exists()) {
          return { date: dateISO, ...snap.data() };
        }
        return {
          date: dateISO,
          rent: 0,
          utilities: 0,
          marketing: 0,
          maintenance: 0,
          insurance: 0,
          other: 0,
        };
      });

      // Load food costs from inventory movements (waste + purchases)
      const foodCostPromises = dateRange.map(async (dateISO) => {
        const movementsRef = collection(
          db,
          "companies",
          companyId,
          "restaurants",
          restaurantId,
          "inventoryMovements"
        );
        
        const startOfDay = new Date(dateISO);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(dateISO);
        endOfDay.setHours(23, 59, 59, 999);
        
        try {
          const q = query(
            movementsRef,
            where("createdAt", ">=", Timestamp.fromDate(startOfDay)),
            where("createdAt", "<=", Timestamp.fromDate(endOfDay)),
            where("source", "in", ["receipt", "purchase"])
          );
          const snap = await getDocs(q);
          
          let totalCost = 0;
          snap.docs.forEach((doc) => {
            const data = doc.data();
            // Calculate cost from inventory movements
            // This is simplified - you may need to track unit costs separately
            if (data.totalCost) {
              totalCost += Number(data.totalCost || 0);
            }
          });
          
          return { date: dateISO, foodCost: totalCost };
        } catch (err) {
          console.warn(`Failed to load food cost for ${dateISO}:`, err);
          return { date: dateISO, foodCost: 0 };
        }
      });

      const [salesData, laborData, expenseData, foodCostData] = await Promise.all([
        Promise.all(salesPromises),
        Promise.all(laborPromises),
        Promise.all(expensePromises),
        Promise.all(foodCostPromises),
      ]);

      // Aggregate data
      const aggregated = {
        period,
        sales: salesData.reduce((sum, d) => sum + (Number(d.totalSales) || 0), 0),
        labor: laborData.reduce((sum, d) => sum + (Number(d.totalLabor) || 0), 0),
        foodCost: foodCostData.reduce((sum, d) => sum + (Number(d.foodCost) || 0), 0),
        expenses: expenseData.reduce((sum, d) => {
          return (
            sum +
            (Number(d.rent) || 0) +
            (Number(d.utilities) || 0) +
            (Number(d.marketing) || 0) +
            (Number(d.maintenance) || 0) +
            (Number(d.insurance) || 0) +
            (Number(d.other) || 0)
          );
        }, 0),
        dailyBreakdown: dateRange.map((dateISO, idx) => {
          const sales = salesData[idx] || { totalSales: 0 };
          const labor = laborData[idx] || { totalLabor: 0 };
          const foodCost = foodCostData[idx] || { foodCost: 0 };
          return {
            day: idx + 1,
            date: dateISO,
            sales: Number(sales.totalSales) || 0,
            labor: Number(labor.totalLabor) || 0,
            foodCost: Number(foodCost.foodCost) || 0,
          };
        }),
        expenseCategories: (() => {
          const totals = expenseData.reduce(
            (acc, d) => ({
              rent: acc.rent + (Number(d.rent) || 0),
              utilities: acc.utilities + (Number(d.utilities) || 0),
              marketing: acc.marketing + (Number(d.marketing) || 0),
              maintenance: acc.maintenance + (Number(d.maintenance) || 0),
              insurance: acc.insurance + (Number(d.insurance) || 0),
              other: acc.other + (Number(d.other) || 0),
            }),
            { rent: 0, utilities: 0, marketing: 0, maintenance: 0, insurance: 0, other: 0 }
          );
          return [
            { category: "Rent", amount: totals.rent },
            { category: "Utilities", amount: totals.utilities },
            { category: "Marketing", amount: totals.marketing },
            { category: "Maintenance", amount: totals.maintenance },
            { category: "Insurance", amount: totals.insurance },
            { category: "Other", amount: totals.other },
          ].filter((cat) => cat.amount > 0);
        })(),
      };

      // Calculate derived metrics
      const primeCost = aggregated.labor + aggregated.foodCost;
      const grossProfit = aggregated.sales - primeCost;
      const netProfit = grossProfit - aggregated.expenses;

      const laborPct = aggregated.sales > 0 ? (aggregated.labor / aggregated.sales) * 100 : 0;
      const foodCostPct = aggregated.sales > 0 ? (aggregated.foodCost / aggregated.sales) * 100 : 0;
      const primeCostPct = aggregated.sales > 0 ? (primeCost / aggregated.sales) * 100 : 0;
      const grossMargin = aggregated.sales > 0 ? (grossProfit / aggregated.sales) * 100 : 0;
      const netMargin = aggregated.sales > 0 ? (netProfit / aggregated.sales) * 100 : 0;

      return {
        ...aggregated,
        primeCost,
        grossProfit,
        netProfit,
        laborPct,
        foodCostPct,
        primeCostPct,
        grossMargin,
        netMargin,
      };
    } catch (err) {
      console.error(`Failed to load financial data for ${period}:`, err);
      throw err;
    }
  }, [restaurantId, companyId]);

  // Load all periods
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = {};
        for (const period of PERIODS) {
          try {
            data[period] = await loadFinancialData(period);
          } catch (err) {
            console.error(`Failed to load ${period}:`, err);
            // Use empty data as fallback
            data[period] = {
              period,
              sales: 0,
              labor: 0,
              foodCost: 0,
              expenses: 0,
              primeCost: 0,
              grossProfit: 0,
              netProfit: 0,
              laborPct: 0,
              foodCostPct: 0,
              primeCostPct: 0,
              grossMargin: 0,
              netMargin: 0,
              dailyBreakdown: [],
              expenseCategories: [],
            };
          }
        }
        setFinancialData(data);
      } catch (err) {
        console.error("Failed to load financial data:", err);
        setError(`Failed to load financial data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    if (restaurantId) {
      loadAll();
    }
  }, [restaurantId, loadFinancialData]);

  const currentData = useMemo(() => {
    return financialData[selectedPeriod] || {
      period: selectedPeriod,
      sales: 0,
      labor: 0,
      foodCost: 0,
      expenses: 0,
      primeCost: 0,
      grossProfit: 0,
      netProfit: 0,
      laborPct: 0,
      foodCostPct: 0,
      primeCostPct: 0,
      grossMargin: 0,
      netMargin: 0,
      dailyBreakdown: [],
      expenseCategories: [],
    };
  }, [selectedPeriod, financialData]);

  const previousPeriodData = useMemo(() => {
    const periodIndex = PERIODS.indexOf(selectedPeriod);
    if (periodIndex <= 0) return null;
    const prevPeriod = PERIODS[periodIndex - 1];
    return financialData[prevPeriod] || null;
  }, [selectedPeriod, financialData]);

  // Calculate period-over-period changes
  const comparisons = useMemo(() => {
    if (!previousPeriodData) return null;

    const calcChange = (current, previous) => {
      if (previous === 0) return { value: 0, pct: 0 };
      const change = current - previous;
      const pct = (change / previous) * 100;
      return { value: change, pct };
    };

    return {
      sales: calcChange(currentData.sales, previousPeriodData.sales),
      labor: calcChange(currentData.labor, previousPeriodData.labor),
      foodCost: calcChange(currentData.foodCost, previousPeriodData.foodCost),
      primeCost: calcChange(currentData.primeCost, previousPeriodData.primeCost),
      netProfit: calcChange(currentData.netProfit, previousPeriodData.netProfit),
    };
  }, [currentData, previousPeriodData]);

  // Export to CSV
  const exportToCSV = useCallback(() => {
    const headers = [
      "Period",
      "Sales",
      "Labor Cost",
      "Labor %",
      "Food Cost",
      "Food Cost %",
      "Prime Cost",
      "Prime Cost %",
      "Expenses",
      "Gross Profit",
      "Gross Margin %",
      "Net Profit",
      "Net Margin %",
    ];

    const rows = PERIODS.map((period) => {
      const data = financialData[period] || {};
      return [
        period.toUpperCase(),
        data.sales || 0,
        data.labor || 0,
        (data.laborPct || 0).toFixed(2),
        data.foodCost || 0,
        (data.foodCostPct || 0).toFixed(2),
        data.primeCost || 0,
        (data.primeCostPct || 0).toFixed(2),
        data.expenses || 0,
        data.grossProfit || 0,
        (data.grossMargin || 0).toFixed(2),
        data.netProfit || 0,
        (data.netMargin || 0).toFixed(2),
      ];
    });

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finance_report_${restaurantId || "restaurant"}_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [financialData, restaurantId]);

  // Chart data transformations
  const salesChartData = useMemo(() => {
    if (!currentData.dailyBreakdown || currentData.dailyBreakdown.length === 0) {
      return [{ label: "No Data", value: 0 }];
    }
    return currentData.dailyBreakdown.map((d, i) => ({
      label: selectedPeriod === "today" ? `Hour ${i + 1}` : `Day ${i + 1}`,
      value: d.sales,
    }));
  }, [currentData, selectedPeriod]);

  const laborVsSalesChartData = useMemo(() => {
    if (!currentData.dailyBreakdown || currentData.dailyBreakdown.length === 0) {
      return [{ label: "No Data", sales: 0, labor: 0 }];
    }
    return currentData.dailyBreakdown.map((d, i) => ({
      label: selectedPeriod === "today" ? `Hour ${i + 1}` : `Day ${i + 1}`,
      sales: d.sales,
      labor: d.labor,
    }));
  }, [currentData, selectedPeriod]);

  const expenseChartData = useMemo(() => {
    if (!currentData.expenseCategories || currentData.expenseCategories.length === 0) {
      return [{ label: "No Expenses", value: 0 }];
    }
    return currentData.expenseCategories.map((cat) => ({
      label: cat.category,
      value: cat.amount,
    }));
  }, [currentData]);

  // Refresh data
  const handleRefresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = {};
      for (const period of PERIODS) {
        try {
          data[period] = await loadFinancialData(period);
        } catch (err) {
          console.error(`Failed to load ${period}:`, err);
          data[period] = financialData[period] || {
            period,
            sales: 0,
            labor: 0,
            foodCost: 0,
            expenses: 0,
            primeCost: 0,
            grossProfit: 0,
            netProfit: 0,
            laborPct: 0,
            foodCostPct: 0,
            primeCostPct: 0,
            grossMargin: 0,
            netMargin: 0,
            dailyBreakdown: [],
            expenseCategories: [],
          };
        }
      }
      setFinancialData(data);
      setError(null);
    } catch (err) {
      setError(`Failed to refresh: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [loadFinancialData, financialData]);

  if (loading && Object.keys(financialData).length === 0) {
    return (
      <div className="overview-wrapper">
        <div style={{ padding: 40, textAlign: "center", color: "#fff" }}>
          Loading financial data...
        </div>
      </div>
    );
  }

  return (
    <div className="overview-wrapper">
      <section className="overview-section">
        {/* HEADER */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 20,
          }}
        >
          <h2 className="section-title">Finance Dashboard</h2>
          
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={handleRefresh}
              disabled={loading}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.1)",
                color: "#fff",
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: 600,
                fontSize: 13,
                opacity: loading ? 0.5 : 1,
              }}
            >
              {loading ? "Refreshing..." : "🔄 Refresh"}
            </button>
            <button
              onClick={() => setShowDataEntry(true)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid rgba(74, 222, 128, 0.4)",
                background: "rgba(74, 222, 128, 0.2)",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              + Enter Data
            </button>
            <button
              onClick={exportToCSV}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.1)",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              📥 Export CSV
            </button>
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: 12,
              marginBottom: 16,
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: 8,
              color: "#ef4444",
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        {/* PERIOD SELECTOR */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          {PERIODS.map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => setSelectedPeriod(period)}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.2)",
                background:
                  selectedPeriod === period
                    ? "rgba(74, 144, 226, 0.3)"
                    : "rgba(255,255,255,0.05)",
                color: "#fff",
                cursor: "pointer",
                fontWeight: selectedPeriod === period ? 700 : 500,
                fontSize: 13,
                textTransform: "capitalize",
                transition: "all 0.2s",
              }}
            >
              {period}
            </button>
          ))}
        </div>

        {/* DATA AVAILABILITY WARNING */}
        {currentData.sales === 0 && currentData.labor === 0 && (
          <div
            style={{
              padding: 16,
              marginBottom: 20,
              background: "rgba(250, 204, 21, 0.1)",
              border: "1px solid rgba(250, 204, 21, 0.3)",
              borderRadius: 8,
              color: "#facc15",
            }}
          >
            <strong>No financial data found for this period.</strong> Click "Enter Data" to add sales, labor, and expense information.
          </div>
        )}

        {/* PRIMARY KPIs - 2 cards per row */}
        <div style={{ marginBottom: 20 }}>
          {/* Row 1: Total Sales | Labor Cost */}
          <div className="kpi-grid kpi-grid--row">
            <div className="metric-card info">
              <div className="metric-title">Total Sales</div>
              <div className="metric-value">{formatCurrency(currentData.sales)}</div>
              <div className="metric-subtext">
                {selectedPeriod === "today" ? "Today" : `This ${selectedPeriod}`}
                {comparisons?.sales && (
                  <span
                    style={{
                      marginLeft: 8,
                      color: comparisons.sales.pct >= 0 ? "#22c55e" : "#ef4444",
                    }}
                  >
                    {comparisons.sales.pct >= 0 ? "↑" : "↓"} {Math.abs(comparisons.sales.pct).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>

            <div
              className={`metric-card ${getStatusClass(
                currentData.laborPct,
                { good: 25, warning: 30 }
              )}`}
            >
              <div className="metric-title">Labor Cost</div>
              <div className="metric-value">{formatCurrency(currentData.labor)}</div>
              <div className="metric-subtext">
                {formatPercent(currentData.laborPct)} of sales
                {comparisons?.labor && (
                  <span
                    style={{
                      marginLeft: 8,
                      color: comparisons.labor.pct <= 0 ? "#22c55e" : "#ef4444",
                    }}
                  >
                    {comparisons.labor.pct <= 0 ? "↓" : "↑"} {Math.abs(comparisons.labor.pct).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Food Cost | Prime Cost */}
          <div className="kpi-grid kpi-grid--row">
            <div
              className={`metric-card ${getStatusClass(
                currentData.foodCostPct,
                { good: 28, warning: 32 }
              )}`}
            >
              <div className="metric-title">Food Cost</div>
              <div className="metric-value">{formatCurrency(currentData.foodCost)}</div>
              <div className="metric-subtext">
                {formatPercent(currentData.foodCostPct)} of sales
                {comparisons?.foodCost && (
                  <span
                    style={{
                      marginLeft: 8,
                      color: comparisons.foodCost.pct <= 0 ? "#22c55e" : "#ef4444",
                    }}
                  >
                    {comparisons.foodCost.pct <= 0 ? "↓" : "↑"} {Math.abs(comparisons.foodCost.pct).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>

            <div
              className={`metric-card ${getStatusClass(
                currentData.primeCostPct,
                { good: 55, warning: 60 }
              )}`}
            >
              <div className="metric-title">Prime Cost</div>
              <div className="metric-value">{formatCurrency(currentData.primeCost)}</div>
              <div className="metric-subtext">
                {formatPercent(currentData.primeCostPct)} of sales (Target ≤ 55%)
              </div>
            </div>
          </div>

          {/* Row 3: Gross Profit | Operating Expenses */}
          <div className="kpi-grid kpi-grid--row">
            <div className="metric-card info">
              <div className="metric-title">Gross Profit</div>
              <div className="metric-value">{formatCurrency(currentData.grossProfit)}</div>
              <div className="metric-subtext">
                {formatPercent(currentData.grossMargin)} margin
              </div>
            </div>

            <div className="metric-card info">
              <div className="metric-title">Operating Expenses</div>
              <div className="metric-value">{formatCurrency(currentData.expenses)}</div>
              <div className="metric-subtext">Rent, utilities, marketing, etc.</div>
            </div>
          </div>

          {/* Row 4: Net Profit */}
          <div className="kpi-grid kpi-grid--row">
            <div
              className={`metric-card ${
                currentData.netProfit >= 0 ? "good" : "danger"
              }`}
            >
              <div className="metric-title">Net Profit</div>
              <div className="metric-value">{formatCurrency(currentData.netProfit)}</div>
              <div className="metric-subtext">
                {formatPercent(currentData.netMargin)} margin
                {comparisons?.netProfit && (
                  <span
                    style={{
                      marginLeft: 8,
                      color: comparisons.netProfit.pct >= 0 ? "#22c55e" : "#ef4444",
                    }}
                  >
                    {comparisons.netProfit.pct >= 0 ? "↑" : "↓"} {Math.abs(comparisons.netProfit.pct).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
            <div>{/* Empty space for spacing */}</div>
          </div>
        </div>

        {/* CHARTS ROW 1 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div className="metric-card info">
            <div className="metric-title">Sales Trend</div>
            {salesChartData.length > 0 && salesChartData[0].value > 0 ? (
              <SimpleLineChart
                data={salesChartData}
                dataKey="value"
                color="#4ade80"
                valueFormatter={(v) => formatCurrency(v)}
              />
            ) : (
              <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.5)" }}>
                No sales data available
              </div>
            )}
          </div>

          <div className="metric-card info">
            <div className="metric-title">Labor vs Sales</div>
            {laborVsSalesChartData.length > 0 && laborVsSalesChartData[0].sales > 0 ? (
              <LaborVsSalesChart data={laborVsSalesChartData} />
            ) : (
              <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.5)" }}>
                No data available
              </div>
            )}
          </div>
        </div>

        {/* CHARTS ROW 2 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div className="metric-card warning">
            <div className="metric-title">Prime Cost Trend</div>
            {currentData.dailyBreakdown && currentData.dailyBreakdown.length > 0 ? (
              <SimpleLineChart
                data={currentData.dailyBreakdown.map((d, i) => ({
                  label: selectedPeriod === "today" ? `Hour ${i + 1}` : `Day ${i + 1}`,
                  value: d.sales > 0 ? ((d.labor + d.foodCost) / d.sales) * 100 : 0,
                }))}
                dataKey="value"
                color="#facc15"
                valueFormatter={(v) => `${v.toFixed(1)}%`}
              />
            ) : (
              <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.5)" }}>
                No data available
              </div>
            )}
          </div>

          <div className="metric-card info">
            <div className="metric-title">Expense Breakdown</div>
            {currentData.expenseCategories && currentData.expenseCategories.length > 0 ? (
              <div style={{ marginTop: 16 }}>
                {currentData.expenseCategories.map((cat, idx) => {
                  const pct = (cat.amount / currentData.expenses) * 100;
                  return (
                    <div
                      key={cat.category}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 0",
                        borderBottom:
                          idx < currentData.expenseCategories.length - 1
                            ? "1px solid rgba(255,255,255,0.1)"
                            : "none",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 2,
                            background: [
                              "#4ade80",
                              "#22c55e",
                              "#facc15",
                              "#f59e0b",
                              "#ef4444",
                              "#8b5cf6",
                            ][idx % 6],
                          }}
                        />
                        <span style={{ fontSize: 13 }}>{cat.category}</span>
                      </div>
                      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                        <span style={{ fontSize: 13, opacity: 0.8 }}>
                          {formatPercent(pct)}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>
                          {formatCurrency(cat.amount)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.5)" }}>
                No expenses recorded
              </div>
            )}
          </div>
        </div>

        {/* EXPENSE DETAILS TABLE */}
        {currentData.expenseCategories && currentData.expenseCategories.length > 0 && (
          <div className="metric-card info" style={{ marginTop: 16 }}>
            <div className="metric-title">Expense Details</div>
            <div style={{ marginTop: 12, overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                    <th align="left" style={{ padding: "8px 0" }}>Category</th>
                    <th align="right" style={{ padding: "8px 0" }}>Amount</th>
                    <th align="right" style={{ padding: "8px 0" }}>% of Expenses</th>
                    <th align="right" style={{ padding: "8px 0" }}>% of Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {currentData.expenseCategories.map((cat) => {
                    const expensePct = (cat.amount / currentData.expenses) * 100;
                    const salesPct = (cat.amount / currentData.sales) * 100;
                    return (
                      <tr
                        key={cat.category}
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                      >
                        <td style={{ padding: "8px 0" }}>{cat.category}</td>
                        <td align="right" style={{ padding: "8px 0" }}>
                          {formatCurrency(cat.amount)}
                        </td>
                        <td align="right" style={{ padding: "8px 0" }}>
                          {formatPercent(expensePct)}
                        </td>
                        <td align="right" style={{ padding: "8px 0" }}>
                          {formatPercent(salesPct)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr style={{ borderTop: "2px solid rgba(255,255,255,0.2)", fontWeight: 700 }}>
                    <td style={{ padding: "12px 0" }}>Total Expenses</td>
                    <td align="right" style={{ padding: "12px 0" }}>
                      {formatCurrency(currentData.expenses)}
                    </td>
                    <td align="right" style={{ padding: "12px 0" }}>100%</td>
                    <td align="right" style={{ padding: "12px 0" }}>
                      {formatPercent((currentData.expenses / currentData.sales) * 100)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* DATA ENTRY MODAL */}
      {showDataEntry && (
        <FinancialDataEntryModal
          restaurantId={restaurantId}
          companyId={companyId}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          onClose={() => {
            setShowDataEntry(false);
            handleRefresh();
          }}
        />
      )}
    </div>
  );
}

/* =====================================================
   FINANCIAL DATA ENTRY MODAL
   ===================================================== */

function FinancialDataEntryModal({ restaurantId, companyId, selectedDate, onDateChange, onClose }) {
  const [saving, setSaving] = useState(false);
  const [sales, setSales] = useState({
    totalSales: "",
    alcoholSales: "",
    foodSales: "",
    togoOrders: "",
    reservations: "",
  });
  const [labor, setLabor] = useState({
    totalLabor: "",
    hourlyWages: "",
    overtime: "",
  });
  const [expenses, setExpenses] = useState({
    rent: "",
    utilities: "",
    marketing: "",
    maintenance: "",
    insurance: "",
    other: "",
  });

  const handleSave = async () => {
    if (!selectedDate) {
      alert("Please select a date");
      return;
    }

    setSaving(true);
    try {
      const dateISO = selectedDate;

      // Save sales data
      const salesRef = doc(
        db,
        "companies",
        companyId,
        "restaurants",
        restaurantId,
        "sales",
        dateISO
      );
      await setDoc(
        salesRef,
        {
          totalSales: Number(sales.totalSales) || 0,
          alcoholSales: Number(sales.alcoholSales) || 0,
          foodSales: Number(sales.foodSales) || 0,
          togoOrders: Number(sales.togoOrders) || 0,
          reservations: Number(sales.reservations) || 0,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Save labor data
      const laborRef = doc(
        db,
        "companies",
        companyId,
        "restaurants",
        restaurantId,
        "laborCosts",
        dateISO
      );
      await setDoc(
        laborRef,
        {
          totalLabor: Number(labor.totalLabor) || 0,
          hourlyWages: Number(labor.hourlyWages) || 0,
          overtime: Number(labor.overtime) || 0,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Save expenses
      const expenseRef = doc(
        db,
        "companies",
        companyId,
        "restaurants",
        restaurantId,
        "expenses",
        dateISO
      );
      await setDoc(
        expenseRef,
        {
          rent: Number(expenses.rent) || 0,
          utilities: Number(expenses.utilities) || 0,
          marketing: Number(expenses.marketing) || 0,
          maintenance: Number(expenses.maintenance) || 0,
          insurance: Number(expenses.insurance) || 0,
          other: Number(expenses.other) || 0,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      alert("Financial data saved successfully!");
      onClose();
    } catch (err) {
      console.error("Failed to save financial data:", err);
      alert(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "rgba(15, 23, 42, 0.95)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 16,
          padding: 24,
          maxWidth: 700,
          maxHeight: "90vh",
          overflow: "auto",
          width: "100%",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, color: "#fff", fontSize: 20 }}>Enter Financial Data</h2>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#fff",
              fontSize: 24,
              cursor: "pointer",
              padding: 0,
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", marginBottom: 8, color: "#fff", fontSize: 14, fontWeight: 500 }}>
            Date
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: 6,
              color: "#fff",
              fontSize: 14,
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <h3 style={{ color: "#fff", fontSize: 16, marginBottom: 12 }}>Sales</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", marginBottom: 6, color: "rgba(255,255,255,0.8)", fontSize: 12 }}>
                Total Sales ($)
              </label>
              <input
                type="number"
                value={sales.totalSales}
                onChange={(e) => setSales({ ...sales, totalSales: e.target.value })}
                placeholder="0"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 14,
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 6, color: "rgba(255,255,255,0.8)", fontSize: 12 }}>
                Alcohol Sales ($)
              </label>
              <input
                type="number"
                value={sales.alcoholSales}
                onChange={(e) => setSales({ ...sales, alcoholSales: e.target.value })}
                placeholder="0"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 14,
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 6, color: "rgba(255,255,255,0.8)", fontSize: 12 }}>
                Food Sales ($)
              </label>
              <input
                type="number"
                value={sales.foodSales}
                onChange={(e) => setSales({ ...sales, foodSales: e.target.value })}
                placeholder="0"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 14,
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 6, color: "rgba(255,255,255,0.8)", fontSize: 12 }}>
                To-Go Orders
              </label>
              <input
                type="number"
                value={sales.togoOrders}
                onChange={(e) => setSales({ ...sales, togoOrders: e.target.value })}
                placeholder="0"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 14,
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 6, color: "rgba(255,255,255,0.8)", fontSize: 12 }}>
                Reservations
              </label>
              <input
                type="number"
                value={sales.reservations}
                onChange={(e) => setSales({ ...sales, reservations: e.target.value })}
                placeholder="0"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 14,
                }}
              />
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <h3 style={{ color: "#fff", fontSize: 16, marginBottom: 12 }}>Labor Costs</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", marginBottom: 6, color: "rgba(255,255,255,0.8)", fontSize: 12 }}>
                Total Labor ($)
              </label>
              <input
                type="number"
                value={labor.totalLabor}
                onChange={(e) => setLabor({ ...labor, totalLabor: e.target.value })}
                placeholder="0"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 14,
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 6, color: "rgba(255,255,255,0.8)", fontSize: 12 }}>
                Hourly Wages ($)
              </label>
              <input
                type="number"
                value={labor.hourlyWages}
                onChange={(e) => setLabor({ ...labor, hourlyWages: e.target.value })}
                placeholder="0"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 14,
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 6, color: "rgba(255,255,255,0.8)", fontSize: 12 }}>
                Overtime ($)
              </label>
              <input
                type="number"
                value={labor.overtime}
                onChange={(e) => setLabor({ ...labor, overtime: e.target.value })}
                placeholder="0"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 14,
                }}
              />
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <h3 style={{ color: "#fff", fontSize: 16, marginBottom: 12 }}>Operating Expenses</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", marginBottom: 6, color: "rgba(255,255,255,0.8)", fontSize: 12 }}>
                Rent ($)
              </label>
              <input
                type="number"
                value={expenses.rent}
                onChange={(e) => setExpenses({ ...expenses, rent: e.target.value })}
                placeholder="0"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 14,
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 6, color: "rgba(255,255,255,0.8)", fontSize: 12 }}>
                Utilities ($)
              </label>
              <input
                type="number"
                value={expenses.utilities}
                onChange={(e) => setExpenses({ ...expenses, utilities: e.target.value })}
                placeholder="0"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 14,
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 6, color: "rgba(255,255,255,0.8)", fontSize: 12 }}>
                Marketing ($)
              </label>
              <input
                type="number"
                value={expenses.marketing}
                onChange={(e) => setExpenses({ ...expenses, marketing: e.target.value })}
                placeholder="0"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 14,
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 6, color: "rgba(255,255,255,0.8)", fontSize: 12 }}>
                Maintenance ($)
              </label>
              <input
                type="number"
                value={expenses.maintenance}
                onChange={(e) => setExpenses({ ...expenses, maintenance: e.target.value })}
                placeholder="0"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 14,
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 6, color: "rgba(255,255,255,0.8)", fontSize: 12 }}>
                Insurance ($)
              </label>
              <input
                type="number"
                value={expenses.insurance}
                onChange={(e) => setExpenses({ ...expenses, insurance: e.target.value })}
                placeholder="0"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 14,
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 6, color: "rgba(255,255,255,0.8)", fontSize: 12 }}>
                Other ($)
              </label>
              <input
                type="number"
                value={expenses.other}
                onChange={(e) => setExpenses({ ...expenses, other: e.target.value })}
                placeholder="0"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 14,
                }}
              />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(255,255,255,0.1)",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "1px solid rgba(74, 222, 128, 0.4)",
              background: "rgba(74, 222, 128, 0.2)",
              color: "#fff",
              cursor: saving ? "not-allowed" : "pointer",
              fontWeight: 600,
              fontSize: 14,
              opacity: saving ? 0.5 : 1,
            }}
          >
            {saving ? "Saving..." : "Save Data"}
          </button>
        </div>
      </div>
    </div>
  );
}