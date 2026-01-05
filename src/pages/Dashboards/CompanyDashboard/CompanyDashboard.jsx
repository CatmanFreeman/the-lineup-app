// src/pages/Dashboards/CompanyDashboard/CompanyDashboard.jsx
import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import BadgeManager from "../../../components/BadgeManager";
import { getRestaurantBadges } from "../../../utils/badgeService";
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../hooks/services/firebase";
import SimpleLineChart from "../../../components/charts/SimpleLineChart";
import FoodVsAlcoholStackedChart from "../../../components/charts/FoodVsAlcoholStackedChart";
import "./CompanyDashboard.css";

/**
 * COMPANY DASHBOARD (Corporate level)
 * Option A: Executive Overview + Restaurant snapshot cards + Alerts + Trends
 * Badge management for restaurants added.
 * Now wired to Firestore for real data.
 * Includes: Real labor % calculation, month-over-month deltas, export functionality, and real trend charts.
 */

const TABS = ["overview", "restaurants", "staff", "settings"];
const COMPANY_ID = "company-demo";

export default function CompanyDashboard() {
  const { companyId: routeCompanyId } = useParams();
  const companyId = routeCompanyId || COMPANY_ID;
  const [activeTab, setActiveTab] = useState("overview");
  const [showBadgesModal, setShowBadgesModal] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [restaurantBadges, setRestaurantBadges] = useState({});
  const [restaurantsList, setRestaurantsList] = useState([]);

  // Load restaurant badges
  const loadRestaurantBadges = useCallback(async () => {
    if (restaurantsList.length === 0) return;
    
    const badgesMap = {};
    
    // Load badges for each restaurant
    for (const restaurant of restaurantsList) {
      try {
        const badges = await getRestaurantBadges(restaurant.id);
        badgesMap[restaurant.id] = badges;
      } catch (err) {
        console.error(`Failed to load badges for ${restaurant.id}:`, err);
        badgesMap[restaurant.id] = [];
      }
    }
    
    setRestaurantBadges(badgesMap);
  }, [restaurantsList]);

  useEffect(() => {
    loadRestaurantBadges();
  }, [loadRestaurantBadges]);

  const handleAwardBadge = (restaurantId) => {
    const restaurant = restaurantsList.find(r => r.id === restaurantId);
    if (restaurant) {
    setSelectedRestaurant(restaurant);
    setShowBadgesModal(true);
    }
  };

  return (
    <div className="companyDash">
      <Link to="/" className="companyDash-back-link-top">← Back</Link>
      <header className="companyDash__header">
        <div className="companyDash__titleRow">
          <img 
            src="/logo.svg" 
            alt="Company Logo" 
            className="companyDash__headerLogo"
          />
          <div className="companyDash__titleGroup">
            <h1 className="companyDash__title">Company Dashboard</h1>
            <div className="companyDash__subtitle">
              Corporate overview snapshot KPIs and performance
            </div>
          </div>
        </div>

        <nav className="companyDash__tabs" role="tablist" aria-label="Company dashboard tabs">
          <TabButton
            id="overview"
            label="Overview"
            active={activeTab === "overview"}
            onClick={() => setActiveTab("overview")}
          />
          <TabButton
            id="restaurants"
            label="Restaurants"
            active={activeTab === "restaurants"}
            onClick={() => setActiveTab("restaurants")}
          />
          <TabButton
            id="staff"
            label="Staff"
            active={activeTab === "staff"}
            onClick={() => setActiveTab("staff")}
          />
          <TabButton
            id="settings"
            label="Settings"
            active={activeTab === "settings"}
            onClick={() => setActiveTab("settings")}
          />
        </nav>
      </header>

      <main className="companyDash__main">
        {activeTab === "overview" && (
          <OverviewTab 
            onAwardBadge={handleAwardBadge} 
            restaurantBadges={restaurantBadges} 
            companyId={companyId}
            onRestaurantsLoaded={setRestaurantsList}
            onTabChange={setActiveTab}
          />
        )}
        {activeTab === "restaurants" && (
          <RestaurantsTab 
            onAwardBadge={handleAwardBadge} 
            restaurantBadges={restaurantBadges} 
            companyId={companyId}
            onRestaurantsLoaded={setRestaurantsList}
          />
        )}
        {activeTab === "staff" && <StaffTab />}
        {activeTab === "settings" && <SettingsTab companyId={companyId} />}
      </main>

      {/* Badges Modal */}
      {showBadgesModal && selectedRestaurant && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.8)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => {
            setShowBadgesModal(false);
            setSelectedRestaurant(null);
          }}
        >
          <div 
            style={{
              background: "rgba(15, 23, 42, 0.95)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "1200px",
              maxHeight: "90vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: "16px 20px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <h2 style={{ margin: 0, fontSize: "20px" }}>
                Badges & Awards — {selectedRestaurant.name || selectedRestaurant.id}
              </h2>
              <button
                onClick={() => {
                  setShowBadgesModal(false);
                  setSelectedRestaurant(null);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#fff",
                  fontSize: "24px",
                  cursor: "pointer",
                  padding: "8px",
                  minWidth: "44px",
                  minHeight: "44px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>
            <div style={{ overflowY: "auto", flex: 1, padding: "20px" }}>
              <BadgeManager
                restaurantId={selectedRestaurant.id}
                companyId={companyId}
                staff={[]} // Empty for restaurant-level badges
                isRestaurantLevel={true}
                onClose={() => {
                  setShowBadgesModal(false);
                  setSelectedRestaurant(null);
                  loadRestaurantBadges(); // Reload badges after awarding
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ id, label, active, onClick }) {
  return (
    <button
      type="button"
      className={`companyDash__tab ${active ? "is-active" : ""}`}
      role="tab"
      aria-selected={active}
      aria-controls={`panel-${id}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

/* ==============================
   OVERVIEW TAB (Option A)
================================ */

function OverviewTab({ onAwardBadge, restaurantBadges, companyId, onRestaurantsLoaded, onTabChange }) {
  const { restaurantsSorted, kpis, alerts, loading, error, trendData } = useCompanyData(companyId, onRestaurantsLoaded);

  const handleExport = () => {
    exportCompanyReport({
      restaurants: restaurantsSorted,
      kpis,
      alerts,
      companyId,
    });
  };

  if (loading) {
    return (
      <section className="companyDash__panel" id="panel-overview" role="tabpanel">
        <div className="companyDash__sectionHeader">
          <h2 className="companyDash__sectionTitle">Company Overview</h2>
        </div>
        <div className="panelCard">
          <div className="emptyState">
            <div className="emptyState__title">Loading company data...</div>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="companyDash__panel" id="panel-overview" role="tabpanel">
        <div className="companyDash__sectionHeader">
          <h2 className="companyDash__sectionTitle">Company Overview</h2>
        </div>
        <div className="panelCard">
          <div className="emptyState">
            <div className="emptyState__title" style={{ color: "#ef4444" }}>{error}</div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="companyDash__panel" id="panel-overview" role="tabpanel">
      <div className="companyDash__sectionHeader">
        <h2 className="companyDash__sectionTitle">Company Overview</h2>
        <div className="companyDash__sectionHint">
          Snapshot view of all restaurants. KPIs, alerts, and performance cards live here.
        </div>
      </div>

      {/* 1) Executive KPI Strip */}
      <div className="kpiStrip" aria-label="Executive KPIs">
        {kpis.map((k) => (
          <KpiCard key={k.key} kpi={k} />
        ))}
      </div>

      {/* Alerts & Exceptions - Mobile Only (above Quick Actions) */}
      <div className="panelCard mobile-only" style={{ marginBottom: "14px" }}>
            <div className="panelCard__header">
              <div className="panelCard__title">Alerts & Exceptions</div>
              <div className="panelCard__sub">Auto-generated. Click later to drill down.</div>
            </div>

            <ul className="alertsList">
              {alerts.map((a, idx) => (
                <li key={`mobile-${a.type}-${idx}`} className={`alertItem alertItem--${a.severity}`}>
                  <div className="alertItem__icon" aria-hidden="true">
                    {a.severity === "red" ? "●" : a.severity === "yellow" ? "●" : "●"}
                  </div>
                  <div className="alertItem__body">
                    <div className="alertItem__title">{a.title}</div>
                    <div className="alertItem__meta">{a.meta}</div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="panelCard__divider" />

            {/* Company Trends - Mobile Only */}
            <div className="panelCard__header">
              <div className="panelCard__title">Company Trends</div>
              <div className="panelCard__sub">30-day historical data across all locations</div>
            </div>

            <div className="trendStack">
              {/* Revenue Trend Chart */}
              <div className="trendCard">
                <div className="trendCard__title">Revenue Trend (30 days)</div>
                {trendData.revenue.length > 0 ? (
                  <SimpleLineChart
                    data={trendData.revenue}
                    dataKey="revenue"
                    color="#4ade80"
                    valueFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                ) : (
                  <div className="trendCard__hint">No revenue data available</div>
                )}
              </div>

              {/* Food vs Alcohol Mix Chart */}
              <div className="trendCard">
                <div className="trendCard__title">Food vs Alcohol Mix</div>
                {trendData.foodAlcohol.length > 0 ? (
                  <FoodVsAlcoholStackedChart data={trendData.foodAlcohol} />
                ) : (
                  <div className="trendCard__hint">No sales mix data available</div>
                )}
              </div>

              {/* Waste Trend Chart */}
              <div className="trendCard">
                <div className="trendCard__title">Waste Trend</div>
                {trendData.waste.length > 0 ? (
                  <SimpleLineChart
                    data={trendData.waste}
                    dataKey="wastePct"
                    color="#f87171"
                    valueFormatter={(v) => `${v.toFixed(1)}%`}
                  />
                ) : (
                  <div className="trendCard__hint">No waste data available</div>
                )}
              </div>
            </div>
          </div>

      {/* Quick Actions - Moved before Restaurant Performance Snapshot */}
      <div className="panelCard panelCard--tight" style={{ marginBottom: "14px" }}>
        <div className="panelCard__header">
          <div className="panelCard__title">Quick Actions</div>
        </div>

        <div className="quickActions">
          <button 
            type="button" 
            className="dashBtn dashBtn--primary"
            onClick={() => onTabChange && onTabChange("restaurants")}
          >
            View All Restaurants
          </button>
          <button 
            type="button" 
            className="dashBtn"
            onClick={handleExport}
          >
            Export Company Report
          </button>
          <button 
            type="button" 
            className="dashBtn"
            onClick={() => onTabChange && onTabChange("staff")}
          >
            Manage Staff
          </button>
          <button 
            type="button" 
            className="dashBtn"
            onClick={() => onTabChange && onTabChange("settings")}
          >
            Company Settings
          </button>
        </div>
      </div>

      {/* 2) Primary: Restaurant performance snapshot + 3) Alerts */}
      <div className="overviewGrid">
        <div className="overviewGrid__left">
          <div className="panelCard">
            <div className="panelCard__header">
              <div className="panelCard__title">Restaurant Performance Snapshot</div>
              <div className="panelCard__sub">Sorted by health (worst first)</div>
            </div>

            <div className="restaurantList">
              {restaurantsSorted.length === 0 ? (
                <div className="emptyState">
                  <div className="emptyState__title">No restaurants found</div>
                  <div className="emptyState__sub">Add restaurants to Firebase to see them here</div>
                </div>
              ) : (
                restaurantsSorted.map((r) => (
                <RestaurantSummaryCard 
                  key={r.id} 
                  r={r} 
                  badges={restaurantBadges[r.id] || []}
                  onAwardBadge={() => onAwardBadge(r.id)}
                />
                ))
              )}
            </div>
          </div>
        </div>

        <div className="overviewGrid__right desktop-only">
          <div className="panelCard">
            <div className="panelCard__header">
              <div className="panelCard__title">Alerts & Exceptions</div>
              <div className="panelCard__sub">Auto-generated. Click later to drill down.</div>
            </div>

            <ul className="alertsList">
              {alerts.map((a, idx) => (
                <li key={`desktop-${a.type}-${idx}`} className={`alertItem alertItem--${a.severity}`}>
                  <div className="alertItem__icon" aria-hidden="true">
                    {a.severity === "red" ? "●" : a.severity === "yellow" ? "●" : "●"}
                  </div>
                  <div className="alertItem__body">
                    <div className="alertItem__title">{a.title}</div>
                    <div className="alertItem__meta">{a.meta}</div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="panelCard__divider" />

            {/* 4) Trends - Real Charts */}
            <div className="panelCard__header">
              <div className="panelCard__title">Company Trends</div>
              <div className="panelCard__sub">30-day historical data across all locations</div>
            </div>

            <div className="trendStack">
              {/* Revenue Trend Chart */}
              <div className="trendCard">
                <div className="trendCard__title">Revenue Trend (30 days)</div>
                {trendData.revenue.length > 0 ? (
                  <SimpleLineChart
                    data={trendData.revenue}
                    dataKey="revenue"
                    color="#4ade80"
                    valueFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                ) : (
                  <div className="trendCard__hint">No revenue data available</div>
                )}
              </div>

              {/* Food vs Alcohol Mix Chart */}
              <div className="trendCard">
                <div className="trendCard__title">Food vs Alcohol Mix</div>
                {trendData.foodAlcohol.length > 0 ? (
                  <FoodVsAlcoholStackedChart data={trendData.foodAlcohol} />
                ) : (
                  <div className="trendCard__hint">No sales mix data available</div>
                )}
              </div>

              {/* Waste Trend Chart */}
              <div className="trendCard">
                <div className="trendCard__title">Waste Trend</div>
                {trendData.waste.length > 0 ? (
                  <SimpleLineChart
                    data={trendData.waste}
                    dataKey="wastePct"
                    color="#f87171"
                    valueFormatter={(v) => `${v.toFixed(1)}%`}
                  />
                ) : (
                  <div className="trendCard__hint">No waste data available</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function KpiCard({ kpi }) {
  return (
    <div className={`kpiCard ${kpi.intent ? `kpiCard--${kpi.intent}` : ""}`}>
      <div className="kpiCard__top">
        <div className="kpiCard__label">{kpi.label}</div>
        {kpi.badge ? <div className={`kpiBadge kpiBadge--${kpi.badgeTone}`}>{kpi.badge}</div> : null}
      </div>

      <div className="kpiCard__valueRow">
        <div className="kpiCard__value">{kpi.value}</div>
      </div>

      <div className="kpiCard__bottom">
        <div className="kpiCard__sub">{kpi.sub}</div>
        <div className={`kpiCard__delta ${kpi.deltaTone ? `is-${kpi.deltaTone}` : ""}`}>
          {kpi.delta}
        </div>
      </div>
    </div>
  );
}

function RestaurantSummaryCard({ r, badges = [], onAwardBadge }) {
  const restaurantLogo = r.logoURL || r.imageURL || r.logo || null;
  
  return (
    <div className="restCard">
      <div className="restCard__left">
        <div className="restCard__nameRow">
          {restaurantLogo && (
            <img 
              src={restaurantLogo} 
              alt={r.name}
              className="restCard__logo"
            />
          )}
          <div className="restCard__name">{r.name}</div>
        </div>

        {/* Restaurant Badges */}
        {badges.length > 0 && (
          <div style={{ 
            display: "flex", 
            gap: "8px", 
            flexWrap: "wrap", 
            marginTop: "8px",
            marginBottom: "8px"
          }}>
            {badges.slice(0, 5).map((badge, idx) => (
              <span
                key={idx}
                style={{
                  padding: "4px 8px",
                  background: "rgba(255, 255, 255, 0.1)",
                  borderRadius: "12px",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: badge.color || "#fff",
                }}
                title={badge.name}
              >
                {badge.icon || "🏆"} {badge.name}
              </span>
            ))}
            {badges.length > 5 && (
              <span style={{ 
                padding: "4px 8px",
                background: "rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
                fontSize: "11px",
                opacity: 0.7
              }}>
                +{badges.length - 5} more
              </span>
            )}
          </div>
        )}

        <div className="restCard__meta">
          <span className="restChip">
            Sales (MTD): <strong>{formatMoney(r.salesMtd)}</strong>
          </span>
          <span className="restChip">
            Food %: <strong>{r.foodPct}%</strong>
          </span>
          <span className="restChip">
            Alcohol %: <strong>{r.alcoholPct}%</strong>
          </span>
          <span className={`restChip ${r.wastePct >= 4 ? "restChip--danger" : ""}`}>
            Waste %: <strong>{r.wastePct}%</strong>
          </span>
          {r.laborPct !== undefined && (
            <span className="restChip">
              Labor %: <strong>{r.laborPct.toFixed(1)}%</strong>
            </span>
          )}
          <span className="restChip">
            Staff: <strong>{r.staffCount}</strong>
          </span>
        </div>
      </div>

      <div className="restCard__right">
        <HealthBadge status={r.health} />
        <button 
          type="button" 
          className="dashBtn dashBtn--small"
          onClick={onAwardBadge}
        >
          Award Badge
        </button>
        <button 
          type="button" 
          className="linkBtn"
          onClick={() => window.location.href = `/restaurant/${r.id}`}
        >
          Open →
        </button>
      </div>
    </div>
  );
}

function HealthBadge({ status }) {
  const map = {
    green: { label: "Healthy", cls: "health--green" },
    yellow: { label: "Watch", cls: "health--yellow" },
    red: { label: "Action Needed", cls: "health--red" },
  };
  const s = map[status] || map.yellow;

  return <span className={`healthBadge ${s.cls}`}>{s.label}</span>;
}


/* ==============================
   EXPORT FUNCTION
================================ */

function exportCompanyReport({ restaurants, kpis, alerts, companyId }) {
  const now = new Date();
  const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });
  const fileName = `Company_Report_${monthName.replace(/\s+/g, '_')}.csv`;

  // Build CSV content
  const csvRows = [];

  // Header
  csvRows.push(`Company Dashboard Report - ${monthName}`);
  csvRows.push('');

  // KPIs Section
  csvRows.push('KEY PERFORMANCE INDICATORS (MTD)');
  csvRows.push('Metric,Value,Change vs Last Month');
  kpis.forEach(kpi => {
    csvRows.push(`"${kpi.label}","${kpi.value}","${kpi.delta}"`);
  });
  csvRows.push('');

  // Restaurant Performance
  csvRows.push('RESTAURANT PERFORMANCE');
  csvRows.push('Restaurant,Sales (MTD),Food %,Alcohol %,Waste %,Labor %,Staff Count,Health Status');
  restaurants.forEach(r => {
    csvRows.push(
      `"${r.name}",` +
      `"${formatMoney(r.salesMtd)}",` +
      `"${r.foodPct}%",` +
      `"${r.alcoholPct}%",` +
      `"${r.wastePct}%",` +
      `"${r.laborPct !== undefined ? r.laborPct.toFixed(1) : 0}%",` +
      `"${r.staffCount}",` +
      `"${r.health}"`
    );
  });
  csvRows.push('');

  // Alerts
  csvRows.push('ALERTS & EXCEPTIONS');
  csvRows.push('Severity,Title,Details');
  alerts.forEach(alert => {
    csvRows.push(`"${alert.severity}","${alert.title}","${alert.meta}"`);
  });

  // Create CSV blob and download
  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/* ==============================
   RESTAURANTS TAB
================================ */

function RestaurantsTab({ onAwardBadge, restaurantBadges, companyId, onRestaurantsLoaded }) {
  const { restaurantsSorted, loading, error } = useCompanyData(companyId, onRestaurantsLoaded);

  if (loading) {
    return (
      <section className="companyDash__panel" id="panel-restaurants" role="tabpanel">
        <div className="companyDash__sectionHeader">
          <h2 className="companyDash__sectionTitle">Restaurants</h2>
        </div>
        <div className="panelCard">
          <div className="emptyState">
            <div className="emptyState__title">Loading restaurants...</div>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="companyDash__panel" id="panel-restaurants" role="tabpanel">
        <div className="companyDash__sectionHeader">
          <h2 className="companyDash__sectionTitle">Restaurants</h2>
        </div>
        <div className="panelCard">
          <div className="emptyState">
            <div className="emptyState__title" style={{ color: "#ef4444" }}>{error}</div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="companyDash__panel" id="panel-restaurants" role="tabpanel">
      <div className="companyDash__sectionHeader">
        <h2 className="companyDash__sectionTitle">Restaurants</h2>
        <div className="companyDash__sectionHint">
          Restaurant cards will live here. This tab becomes the corporate "all locations" directory.
        </div>
      </div>

      <div className="panelCard">
        <div className="panelCard__header">
          <div className="panelCard__title">All Locations</div>
          <div className="panelCard__sub">{restaurantsSorted.length} restaurant{restaurantsSorted.length !== 1 ? "s" : ""}</div>
        </div>

        <div className="restaurantList">
          {restaurantsSorted.length === 0 ? (
            <div className="emptyState">
              <div className="emptyState__title">No restaurants found</div>
              <div className="emptyState__sub">Add restaurants to Firebase to see them here</div>
            </div>
          ) : (
            restaurantsSorted.map((r) => {
              const restaurantLogo = r.logoURL || r.imageURL || r.logo || null;
              // Get city and state from various possible fields
              const city = r.city || r.address?.city || "";
              const state = r.state || r.address?.state || "";
              const cityState = [city, state].filter(Boolean).join(", ") || "";
              
              return (
                <div key={r.id} className="restCardTab">
                  {/* Row 1: Logo + Name (underlined) + Location below */}
                  <div className="restCardTab__row1">
                    {restaurantLogo && (
                      <img 
                        src={restaurantLogo} 
                        alt={r.name}
                        className="restCardTab__logo"
                      />
                    )}
                    <div className="restCardTab__nameGroup">
                      <div className="restCardTab__name">{r.name}</div>
                      {cityState && (
                        <div className="restCardTab__location">{cityState}</div>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Sales, Alcohol, Labor (3 columns) */}
                  <div className="restCardTab__row2">
                    <div className="restCardTab__metric">
                      <span className="restCardTab__metricLabel">Sales:</span>
                      <span className="restCardTab__metricValue">{formatMoney(r.salesMtd)}</span>
                    </div>
                    <div className="restCardTab__metric">
                      <span className="restCardTab__metricLabel">Alcohol:</span>
                      <span className="restCardTab__metricValue">{r.alcoholPct}%</span>
                    </div>
                    <div className="restCardTab__metric">
                      <span className="restCardTab__metricLabel">Labor:</span>
                      <span className="restCardTab__metricValue">
                        {r.laborPct !== undefined ? `${r.laborPct.toFixed(1)}%` : "—"}
                      </span>
                    </div>
                  </div>

                  {/* Row 3: Waste, Staff, (empty) */}
                  <div className="restCardTab__row3">
                    <div className="restCardTab__metric">
                      <span className="restCardTab__metricLabel">Waste:</span>
                      <span className="restCardTab__metricValue">{r.wastePct}%</span>
                    </div>
                    <div className="restCardTab__metric">
                      <span className="restCardTab__metricLabel">Staff:</span>
                      <span className="restCardTab__metricValue">{r.staffCount}</span>
                    </div>
                    <div className="restCardTab__metric">
                      {/* Empty space for future use */}
                    </div>
                  </div>

                  {/* Row 4: Watch + Award Badge + Open */}
                  <div className="restCardTab__row5">
                    <HealthBadge status={r.health} />
                    <button 
                      type="button" 
                      className="dashBtn dashBtn--small"
                      onClick={() => onAwardBadge(r.id)}
                    >
                      Award Badge
                    </button>
                    <button 
                      type="button" 
                      className="linkBtn"
                      onClick={() => window.location.href = `/restaurant/${r.id}`}
                    >
                      Open →
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

/* ==============================
   STAFF TAB
================================ */

function StaffTab() {
  const companyId = COMPANY_ID;
  const [loading, setLoading] = useState(true);
  const [restaurants, setRestaurants] = useState([]);
  const [allStaff, setAllStaff] = useState([]);
  const [corporateStaff, setCorporateStaff] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterRestaurant, setFilterRestaurant] = useState("all");
  const [viewMode, setViewMode] = useState("grouped"); // "grouped" or "flat"
  const [error, setError] = useState(null);

  // Load all restaurants for the company
  const loadRestaurants = useCallback(async () => {
    try {
      // Try both paths
      let restaurantsList = [];
      
      // Path 1: Top-level restaurants collection
      try {
        const restaurantsRef = collection(db, "restaurants");
        const snap = await getDocs(restaurantsRef);
        restaurantsList = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || d.id,
          ...d.data(),
        }));
      } catch (err) {
        console.warn("Failed to load from top-level restaurants:", err);
      }

      // Path 2: companies/{companyId}/restaurants (if Path 1 is empty)
      if (restaurantsList.length === 0) {
        try {
          const companyRestaurantsRef = collection(db, "companies", companyId, "restaurants");
          const snap = await getDocs(companyRestaurantsRef);
          restaurantsList = snap.docs.map((d) => ({
            id: d.id,
            name: d.data().name || d.id,
            ...d.data(),
          }));
        } catch (err) {
          console.warn("Failed to load from company restaurants:", err);
        }
      }

      setRestaurants(restaurantsList);
      return restaurantsList;
    } catch (err) {
      console.error("Error loading restaurants:", err);
      setError("Failed to load restaurants");
      return [];
    }
  }, [companyId]);

  // Load staff from a specific restaurant
  const loadStaffFromRestaurant = useCallback(async (restaurantId, restaurantName) => {
    try {
      // Try path: restaurants/{restaurantId}/staff
      let staffList = [];
      
      try {
        const staffRef = collection(db, "restaurants", restaurantId, "staff");
        const snap = await getDocs(staffRef);
        staffList = snap.docs.map((d) => {
          const data = d.data() || {};
          return {
            id: d.id,
            uid: data.uid || d.id,
            name: data.name || d.id,
            role: data.role || "Front of House",
            subRole: data.subRole || "",
            active: data.active !== false,
            imageURL: data.imageURL || "",
            email: data.email || "",
            phone: data.phone || "",
            restaurantId,
            restaurantName,
            staffType: "location", // location staff
          };
        });
      } catch (err) {
        console.warn(`Failed to load staff from restaurants/${restaurantId}/staff:`, err);
      }

      // Fallback: companies/{companyId}/restaurants/{restaurantId}/staff
      if (staffList.length === 0) {
        try {
          const companyStaffRef = collection(db, "companies", companyId, "restaurants", restaurantId, "staff");
          const snap = await getDocs(companyStaffRef);
          staffList = snap.docs.map((d) => {
            const data = d.data() || {};
            return {
              id: d.id,
              uid: data.uid || d.id,
              name: data.name || d.id,
              role: data.role || "Front of House",
              subRole: data.subRole || "",
              active: data.active !== false,
              imageURL: data.imageURL || "",
              email: data.email || "",
              phone: data.phone || "",
              restaurantId,
              restaurantName,
              staffType: "location",
            };
          });
        } catch (err) {
          console.warn(`Failed to load staff from company path:`, err);
        }
      }

      return staffList;
    } catch (err) {
      console.error(`Error loading staff from ${restaurantId}:`, err);
      return [];
    }
  }, [companyId]);

  // Load corporate staff (if stored separately)
  const loadCorporateStaff = useCallback(async () => {
    try {
      // Try path: companies/{companyId}/corporateStaff
      try {
        const corporateStaffRef = collection(db, "companies", companyId, "corporateStaff");
        const snap = await getDocs(corporateStaffRef);
        const staffList = snap.docs.map((d) => {
          const data = d.data() || {};
          return {
            id: d.id,
            uid: data.uid || d.id,
            name: data.name || d.id,
            role: data.role || "Corporate",
            subRole: data.subRole || data.title || "",
            active: data.active !== false,
            imageURL: data.imageURL || "",
            email: data.email || "",
            phone: data.phone || "",
            restaurantId: null,
            restaurantName: "Corporate",
            staffType: "corporate",
            permissions: data.permissions || [],
          };
        });
        setCorporateStaff(staffList);
        return staffList;
      } catch (err) {
        // Corporate staff collection doesn't exist yet - that's okay
        console.log("No corporate staff collection found (this is normal)");
        setCorporateStaff([]);
        return [];
      }
    } catch (err) {
      console.error("Error loading corporate staff:", err);
      return [];
    }
  }, [companyId]);

  // Load all staff
  const loadAllStaff = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const restaurantsList = await loadRestaurants();
      const corporateStaffList = await loadCorporateStaff();

      // Load staff from all restaurants in parallel
      const staffPromises = restaurantsList.map((restaurant) =>
        loadStaffFromRestaurant(restaurant.id, restaurant.name)
      );

      const allLocationStaff = await Promise.all(staffPromises);
      const flattenedStaff = allLocationStaff.flat();

      // Combine location and corporate staff
      const combinedStaff = [...flattenedStaff, ...corporateStaffList];

      setAllStaff(combinedStaff);
    } catch (err) {
      console.error("Error loading all staff:", err);
      setError("Failed to load staff data");
    } finally {
      setLoading(false);
    }
  }, [loadRestaurants, loadCorporateStaff, loadStaffFromRestaurant]);

  useEffect(() => {
    loadAllStaff();
  }, [loadAllStaff]);

  // Filter and search staff
  const filteredStaff = useMemo(() => {
    let filtered = allStaff;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (staff) =>
          staff.name.toLowerCase().includes(query) ||
          staff.role.toLowerCase().includes(query) ||
          staff.subRole.toLowerCase().includes(query) ||
          (staff.email && staff.email.toLowerCase().includes(query)) ||
          (staff.restaurantName && staff.restaurantName.toLowerCase().includes(query))
      );
    }

    // Role filter
    if (filterRole !== "all") {
      filtered = filtered.filter((staff) => {
        if (filterRole === "corporate") return staff.staffType === "corporate";
        if (filterRole === "foh") return staff.role === "Front of House";
        if (filterRole === "boh") return staff.role === "Back of House";
        return staff.role === filterRole;
      });
    }

    // Restaurant filter
    if (filterRestaurant !== "all") {
      if (filterRestaurant === "corporate") {
        filtered = filtered.filter((staff) => staff.staffType === "corporate");
      } else {
        filtered = filtered.filter((staff) => staff.restaurantId === filterRestaurant);
      }
    }

    return filtered;
  }, [allStaff, searchQuery, filterRole, filterRestaurant]);

  // Group staff by restaurant
  const groupedStaff = useMemo(() => {
    const groups = {};

    // Corporate staff group
    const corporate = filteredStaff.filter((s) => s.staffType === "corporate");
    if (corporate.length > 0) {
      groups.corporate = {
        name: "Corporate Staff",
        restaurantId: "corporate",
        staff: corporate,
      };
    }

    // Location staff groups
    filteredStaff
      .filter((s) => s.staffType === "location")
      .forEach((staff) => {
        const key = staff.restaurantId || "unknown";
        if (!groups[key]) {
          groups[key] = {
            name: staff.restaurantName || "Unknown Restaurant",
            restaurantId: key,
            staff: [],
          };
        }
        groups[key].staff.push(staff);
      });

    return groups;
  }, [filteredStaff]);

  // Get unique roles for filter
  const uniqueRoles = useMemo(() => {
    const roles = new Set();
    allStaff.forEach((staff) => {
      if (staff.role) roles.add(staff.role);
    });
    return Array.from(roles).sort();
  }, [allStaff]);

  if (loading) {
  return (
    <section className="companyDash__panel" id="panel-staff" role="tabpanel">
      <div className="companyDash__sectionHeader">
        <h2 className="companyDash__sectionTitle">Company Staff</h2>
        </div>
        <div className="panelCard">
          <div className="emptyState">
            <div className="emptyState__title">Loading staff directory...</div>
      </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="companyDash__panel" id="panel-staff" role="tabpanel">
        <div className="companyDash__sectionHeader">
          <h2 className="companyDash__sectionTitle">Company Staff</h2>
        </div>
      <div className="panelCard">
          <div className="emptyState">
            <div className="emptyState__title" style={{ color: "#ef4444" }}>{error}</div>
            <button
              type="button"
              className="dashBtn dashBtn--primary"
              onClick={loadAllStaff}
              style={{ marginTop: 16 }}
            >
              Retry
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="companyDash__panel" id="panel-staff" role="tabpanel">
      <div className="companyDash__sectionHeader">
        <h2 className="companyDash__sectionTitle">Company Staff</h2>
        <div className="companyDash__sectionHint">
          View and manage all staff across all restaurant locations and corporate offices.
        </div>
      </div>

      {/* Controls */}
      <div className="panelCard" style={{ marginBottom: 24 }}>
        <div className="panelCard__header">
          <div className="panelCard__title">Filters & Search</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Search */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Search by name, role, email, or restaurant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="dashInput"
              style={{ flex: "1 1 300px", minWidth: 200 }}
            />
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="dashSelect"
              style={{ minWidth: 150 }}
            >
              <option value="all">All Roles</option>
              <option value="corporate">Corporate</option>
              <option value="foh">Front of House</option>
              <option value="boh">Back of House</option>
              {uniqueRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <select
              value={filterRestaurant}
              onChange={(e) => setFilterRestaurant(e.target.value)}
              className="dashSelect"
              style={{ minWidth: 150 }}
            >
              <option value="all">All Locations</option>
              <option value="corporate">Corporate</option>
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className={`dashBtn dashBtn--small ${viewMode === "grouped" ? "dashBtn--primary" : ""}`}
                onClick={() => setViewMode("grouped")}
              >
                Grouped
              </button>
              <button
                type="button"
                className={`dashBtn dashBtn--small ${viewMode === "flat" ? "dashBtn--primary" : ""}`}
                onClick={() => setViewMode("flat")}
              >
                Flat
              </button>
            </div>
        </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 14, color: "#9ca3af" }}>
            <span>
              <strong style={{ color: "#fff" }}>{filteredStaff.length}</strong> staff member{filteredStaff.length !== 1 ? "s" : ""}
            </span>
            <span>
              <strong style={{ color: "#fff" }}>{Object.keys(groupedStaff).length}</strong> location{Object.keys(groupedStaff).length !== 1 ? "s" : ""}
            </span>
            <span>
              <strong style={{ color: "#fff" }}>
                {filteredStaff.filter((s) => s.active).length}
              </strong> active
            </span>
          </div>
        </div>
      </div>

      {/* Staff List */}
      {filteredStaff.length === 0 ? (
        <div className="panelCard">
        <div className="emptyState">
            <div className="emptyState__title">No staff found</div>
          <div className="emptyState__sub">
              {searchQuery || filterRole !== "all" || filterRestaurant !== "all"
                ? "Try adjusting your filters or search query."
                : "No staff members have been added yet."}
          </div>
        </div>
      </div>
      ) : viewMode === "grouped" ? (
        // Grouped View
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {Object.values(groupedStaff).map((group) => {
            // Find restaurant logo if not corporate
            const restaurant = group.restaurantId !== "corporate" 
              ? restaurants.find(r => r.id === group.restaurantId)
              : null;
            const restaurantLogo = restaurant 
              ? (restaurant.logoURL || restaurant.imageURL || restaurant.logo || null)
              : null;
            
            return (
              <div key={group.restaurantId} className="panelCard">
                <div className="panelCard__header">
                  <div className="panelCard__headerContent">
                    {restaurantLogo && (
                      <img 
                        src={restaurantLogo} 
                        alt={group.name}
                        className="panelCard__restaurantLogo"
                      />
                    )}
                    <div>
                      <div className="panelCard__title">{group.name}</div>
                      <div className="panelCard__sub">
                        {group.staff.length} staff member{group.staff.length !== 1 ? "s" : ""}
                        {group.restaurantId !== "corporate" && (
                          <span> • <a href={`/restaurant/${group.restaurantId}`} style={{ color: "#3b82f6" }}>View Restaurant →</a></span>
                        )}
                      </div>
                    </div>
                  </div>
              </div>
              <div className="staffGrid">
                {group.staff.map((staff) => (
                  <StaffCard key={staff.id} staff={staff} />
                ))}
              </div>
            </div>
            );
          })}
        </div>
      ) : (
        // Flat View
        <div className="panelCard">
          <div className="panelCard__header">
            <div className="panelCard__title">All Staff ({filteredStaff.length})</div>
          </div>
          <div className="staffGrid">
            {filteredStaff.map((staff) => (
              <StaffCard key={staff.id} staff={staff} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// Staff Card Component
function StaffCard({ staff }) {
  const roleColors = {
    "Front of House": "#3b82f6",
    "Back of House": "#f59e0b",
    "Corporate": "#8b5cf6",
  };

  const roleColor = roleColors[staff.role] || "#6b7280";

  return (
    <div className="staffCard">
      <div className="staffCard__header">
        {staff.imageURL ? (
          <img src={staff.imageURL} alt={staff.name} className="staffCard__avatar" />
        ) : (
          <div className="staffCard__avatar staffCard__avatar--placeholder">
            {staff.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="staffCard__info">
          <div className="staffCard__name">{staff.name}</div>
          <div className="staffCard__role" style={{ color: roleColor }}>
            {staff.role}
            {staff.subRole && ` • ${staff.subRole}`}
          </div>
        </div>
        {!staff.active && (
          <span className="staffCard__badge staffCard__badge--inactive">Inactive</span>
        )}
        {staff.staffType === "corporate" && (
          <span className="staffCard__badge staffCard__badge--corporate">Corporate</span>
        )}
      </div>
      <div className="staffCard__details">
        {staff.restaurantName && staff.staffType !== "corporate" && (
          <div className="staffCard__detail">
            <span className="staffCard__detailLabel">📍 Location:</span>
            <span className="staffCard__detailValue">{staff.restaurantName}</span>
          </div>
        )}
        {staff.email && (
          <div className="staffCard__detail">
            <span className="staffCard__detailLabel">✉️ Email:</span>
            <span className="staffCard__detailValue">
              <a href={`mailto:${staff.email}`} style={{ color: "#3b82f6" }}>
                {staff.email}
              </a>
            </span>
          </div>
        )}
        {staff.phone && (
          <div className="staffCard__detail">
            <span className="staffCard__detailLabel">📞 Phone:</span>
            <span className="staffCard__detailValue">
              <a href={`tel:${staff.phone}`} style={{ color: "#3b82f6" }}>
                {staff.phone}
              </a>
            </span>
          </div>
        )}
        {staff.staffType === "corporate" && staff.permissions && staff.permissions.length > 0 && (
          <div className="staffCard__detail">
            <span className="staffCard__detailLabel">🔐 Permissions:</span>
            <span className="staffCard__detailValue">
              {staff.permissions.join(", ")}
            </span>
          </div>
        )}
      </div>
      {staff.restaurantId && staff.staffType !== "corporate" && (
        <div className="staffCard__actions">
          <a
            href={`/restaurant/${staff.restaurantId}`}
            className="dashBtn dashBtn--small dashBtn--secondary"
          >
            View Restaurant →
          </a>
        </div>
      )}
    </div>
  );
}

/* ==============================
   SETTINGS TAB
================================ */

function SettingsTab({ companyId }) {
  const [activeSection, setActiveSection] = useState("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Company Profile State
  const [profile, setProfile] = useState({
    name: "",
    logoURL: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    phone: "",
    email: "",
    website: "",
    taxId: "",
  });

  // Permissions State
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [roleForm, setRoleForm] = useState({
    name: "",
    permissions: [],
    restaurantAccess: [], // Array of restaurant IDs
  });

  // Billing State
  const [billing, setBilling] = useState({
    plan: "Professional",
    status: "active",
    nextBillingDate: "",
    paymentMethod: "",
    invoices: [],
  });

  // Integrations State
  const [integrations, setIntegrations] = useState({
    pos: { enabled: false, system: "", apiKey: "" },
    inventory: { enabled: false, system: "", apiKey: "" },
    accounting: { enabled: false, system: "", exportFormat: "CSV" },
  });

  // Load company settings
  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const companyRef = doc(db, "companies", companyId);
      const companySnap = await getDoc(companyRef);

      if (companySnap.exists()) {
        const data = companySnap.data();
        
        // Load profile
        setProfile({
          name: data.name || "",
          logoURL: data.logoURL || "",
          address: data.address || "",
          city: data.city || "",
          state: data.state || "",
          zipCode: data.zipCode || "",
          phone: data.phone || "",
          email: data.email || "",
          website: data.website || "",
          taxId: data.taxId || "",
        });

        // Load integrations
        if (data.integrations) {
          setIntegrations(data.integrations);
        }

        // Load billing (if exists)
        if (data.billing) {
          setBilling(data.billing);
        }
      } else {
        // Create default company document
        await setDoc(companyRef, {
          name: "",
          createdAt: new Date(),
        });
      }

      // Load roles
      try {
        const rolesRef = collection(db, "companies", companyId, "roles");
        const rolesSnap = await getDocs(rolesRef);
        const rolesList = rolesSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setRoles(rolesList);
      } catch (err) {
        console.log("No roles collection found (this is normal)");
        setRoles([]);
      }

      // Load invoices
      try {
        const invoicesRef = collection(db, "companies", companyId, "invoices");
        const invoicesSnap = await getDocs(invoicesRef);
        const invoicesList = invoicesSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setBilling((prev) => ({ ...prev, invoices: invoicesList }));
      } catch (err) {
        console.log("No invoices collection found (this is normal)");
      }
    } catch (err) {
      console.error("Error loading settings:", err);
      setError("Failed to load company settings");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Save profile
  const saveProfile = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const companyRef = doc(db, "companies", companyId);
      await updateDoc(companyRef, {
        ...profile,
        updatedAt: new Date(),
      });
      setSuccess("Company profile updated successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error saving profile:", err);
      setError("Failed to save company profile");
    } finally {
      setSaving(false);
    }
  };

  // Save integrations
  const saveIntegrations = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const companyRef = doc(db, "companies", companyId);
      await updateDoc(companyRef, {
        integrations,
        updatedAt: new Date(),
      });
      setSuccess("Integrations updated successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error saving integrations:", err);
      setError("Failed to save integrations");
    } finally {
      setSaving(false);
    }
  };

  // Save role
  const saveRole = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (selectedRole) {
        // Update existing role
        const roleRef = doc(db, "companies", companyId, "roles", selectedRole.id);
        await updateDoc(roleRef, {
          ...roleForm,
          updatedAt: new Date(),
        });
        setSuccess("Role updated successfully");
      } else {
        // Create new role
        const rolesRef = collection(db, "companies", companyId, "roles");
        await setDoc(doc(rolesRef), {
          ...roleForm,
          createdAt: new Date(),
        });
        setSuccess("Role created successfully");
      }
      
      setRoleForm({ name: "", permissions: [], restaurantAccess: [] });
      setSelectedRole(null);
      await loadSettings();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error saving role:", err);
      setError("Failed to save role");
    } finally {
      setSaving(false);
    }
  };

  // Delete role
  const deleteRole = async (roleId) => {
    if (!window.confirm("Are you sure you want to delete this role?")) return;

    try {
      const roleRef = doc(db, "companies", companyId, "roles", roleId);
      await updateDoc(roleRef, { deleted: true });
      await loadSettings();
      setSuccess("Role deleted successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error deleting role:", err);
      setError("Failed to delete role");
    }
  };

  const permissionOptions = [
    "view_dashboard",
    "edit_schedules",
    "manage_staff",
    "view_finances",
    "manage_inventory",
    "manage_settings",
    "award_badges",
    "manage_restaurants",
  ];

  if (loading) {
    return (
      <section className="companyDash__panel" id="panel-settings" role="tabpanel">
        <div className="companyDash__sectionHeader">
          <h2 className="companyDash__sectionTitle">Company Settings</h2>
        </div>
        <div className="panelCard">
          <div className="emptyState">
            <div className="emptyState__title">Loading settings...</div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="companyDash__panel" id="panel-settings" role="tabpanel">
      <div className="companyDash__sectionHeader">
        <h2 className="companyDash__sectionTitle">Company Settings</h2>
        <div className="companyDash__sectionHint">
          Manage company profile, permissions, billing, and integrations.
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div style={{
          padding: "12px 16px",
          background: "rgba(34, 197, 94, 0.1)",
          border: "1px solid rgba(34, 197, 94, 0.3)",
          borderRadius: "8px",
          color: "#22c55e",
          marginBottom: 16,
        }}>
          {success}
        </div>
      )}
      {error && (
        <div style={{
          padding: "12px 16px",
          background: "rgba(239, 68, 68, 0.1)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          borderRadius: "8px",
          color: "#ef4444",
          marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {/* Section Navigation */}
      <div className="panelCard" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className={`dashBtn dashBtn--small ${activeSection === "profile" ? "dashBtn--primary" : ""}`}
            onClick={() => setActiveSection("profile")}
          >
            Company Profile
          </button>
          <button
            type="button"
            className={`dashBtn dashBtn--small ${activeSection === "permissions" ? "dashBtn--primary" : ""}`}
            onClick={() => setActiveSection("permissions")}
          >
            Permissions
          </button>
          <button
            type="button"
            className={`dashBtn dashBtn--small ${activeSection === "billing" ? "dashBtn--primary" : ""}`}
            onClick={() => setActiveSection("billing")}
          >
            Billing
          </button>
          <button
            type="button"
            className={`dashBtn dashBtn--small ${activeSection === "integrations" ? "dashBtn--primary" : ""}`}
            onClick={() => setActiveSection("integrations")}
          >
            Integrations
          </button>
        </div>
      </div>

      {/* Company Profile Section */}
      {activeSection === "profile" && (
      <div className="panelCard">
        <div className="panelCard__header">
            <div className="panelCard__title">Company Profile</div>
            <div className="panelCard__sub">Update company information and contact details</div>
        </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
              <div>
                <label className="dashLabel">Company Name *</label>
                <input
                  type="text"
                  className="dashInput"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  placeholder="Company Name"
                />
              </div>
              <div>
                <label className="dashLabel">Logo URL</label>
                <input
                  type="url"
                  className="dashInput"
                  value={profile.logoURL}
                  onChange={(e) => setProfile({ ...profile, logoURL: e.target.value })}
                  placeholder="https://example.com/logo.png"
                />
              </div>
              <div>
                <label className="dashLabel">Phone</label>
                <input
                  type="tel"
                  className="dashInput"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <label className="dashLabel">Email</label>
                <input
                  type="email"
                  className="dashInput"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  placeholder="contact@company.com"
                />
              </div>
              <div>
                <label className="dashLabel">Website</label>
                <input
                  type="url"
                  className="dashInput"
                  value={profile.website}
                  onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                  placeholder="https://www.company.com"
                />
              </div>
              <div>
                <label className="dashLabel">Tax ID</label>
                <input
                  type="text"
                  className="dashInput"
                  value={profile.taxId}
                  onChange={(e) => setProfile({ ...profile, taxId: e.target.value })}
                  placeholder="XX-XXXXXXX"
                />
              </div>
            </div>

            <div>
              <label className="dashLabel">Address</label>
              <input
                type="text"
                className="dashInput"
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                placeholder="Street Address"
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              <div>
                <label className="dashLabel">City</label>
                <input
                  type="text"
                  className="dashInput"
                  value={profile.city}
                  onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                  placeholder="City"
                />
              </div>
              <div>
                <label className="dashLabel">State</label>
                <input
                  type="text"
                  className="dashInput"
                  value={profile.state}
                  onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                  placeholder="State"
                />
              </div>
              <div>
                <label className="dashLabel">Zip Code</label>
                <input
                  type="text"
                  className="dashInput"
                  value={profile.zipCode}
                  onChange={(e) => setProfile({ ...profile, zipCode: e.target.value })}
                  placeholder="12345"
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button
                type="button"
                className="dashBtn dashBtn--primary"
                onClick={saveProfile}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
          </div>
        </div>
      )}

      {/* Permissions Section */}
      {activeSection === "permissions" && (
        <div className="panelCard">
          <div className="panelCard__header">
            <div className="panelCard__title">Roles & Permissions</div>
            <div className="panelCard__sub">Manage user roles and access levels</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Roles List */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 18 }}>Existing Roles</h3>
                <button
                  type="button"
                  className="dashBtn dashBtn--small dashBtn--primary"
                  onClick={() => {
                    setSelectedRole(null);
                    setRoleForm({ name: "", permissions: [], restaurantAccess: [] });
                  }}
                >
                  + New Role
            </button>
          </div>

              {roles.length === 0 ? (
                <div className="emptyState">
                  <div className="emptyState__title">No roles created yet</div>
                  <div className="emptyState__sub">Create your first role to get started</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {roles.map((role) => (
                    <div
                      key={role.id}
                      style={{
                        padding: 16,
                        background: "rgba(255, 255, 255, 0.05)",
                        borderRadius: "8px",
                        border: selectedRole?.id === role.id ? "1px solid #3b82f6" : "1px solid rgba(255, 255, 255, 0.1)",
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        setSelectedRole(role);
                        setRoleForm({
                          name: role.name || "",
                          permissions: role.permissions || [],
                          restaurantAccess: role.restaurantAccess || [],
                        });
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>{role.name}</div>
                          <div style={{ fontSize: 14, color: "#9ca3af" }}>
                            {role.permissions?.length || 0} permission{role.permissions?.length !== 1 ? "s" : ""}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="dashBtn dashBtn--small"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteRole(role.id);
                          }}
                        >
                          Delete
            </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>

            {/* Role Form */}
            <div style={{
              padding: 20,
              background: "rgba(255, 255, 255, 0.05)",
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}>
              <h3 style={{ margin: "0 0 16px 0", fontSize: 18 }}>
                {selectedRole ? "Edit Role" : "Create New Role"}
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label className="dashLabel">Role Name *</label>
                  <input
                    type="text"
                    className="dashInput"
                    value={roleForm.name}
                    onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                    placeholder="e.g., Manager, Admin, Viewer"
                  />
                </div>

                <div>
                  <label className="dashLabel">Permissions</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                    {permissionOptions.map((perm) => (
                      <label key={perm} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={roleForm.permissions.includes(perm)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setRoleForm({
                                ...roleForm,
                                permissions: [...roleForm.permissions, perm],
                              });
                            } else {
                              setRoleForm({
                                ...roleForm,
                                permissions: roleForm.permissions.filter((p) => p !== perm),
                              });
                            }
                          }}
                        />
                        <span style={{ fontSize: 14 }}>
                          {perm.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    type="button"
                    className="dashBtn dashBtn--primary"
                    onClick={saveRole}
                    disabled={saving || !roleForm.name}
                  >
                    {saving ? "Saving..." : selectedRole ? "Update Role" : "Create Role"}
                  </button>
                  {selectedRole && (
                    <button
                      type="button"
                      className="dashBtn"
                      onClick={() => {
                        setSelectedRole(null);
                        setRoleForm({ name: "", permissions: [], restaurantAccess: [] });
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Billing Section */}
      {activeSection === "billing" && (
        <div className="panelCard">
          <div className="panelCard__header">
            <div className="panelCard__title">Billing & Subscription</div>
            <div className="panelCard__sub">Manage your subscription and payment methods</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Current Plan */}
            <div style={{
              padding: 20,
              background: "rgba(255, 255, 255, 0.05)",
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}>
              <h3 style={{ margin: "0 0 16px 0", fontSize: 18 }}>Current Plan</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#9ca3af" }}>Plan:</span>
                  <strong>{billing.plan}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#9ca3af" }}>Status:</span>
                  <span style={{
                    padding: "4px 12px",
                    borderRadius: "12px",
                    background: billing.status === "active" ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)",
                    color: billing.status === "active" ? "#22c55e" : "#ef4444",
                    fontSize: 14,
                    fontWeight: 600,
                  }}>
                    {billing.status === "active" ? "Active" : "Inactive"}
                  </span>
                </div>
                {billing.nextBillingDate && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#9ca3af" }}>Next Billing Date:</span>
                    <strong>{billing.nextBillingDate}</strong>
                  </div>
                )}
                {billing.paymentMethod && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#9ca3af" }}>Payment Method:</span>
                    <strong>{billing.paymentMethod}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Invoices */}
            <div>
              <h3 style={{ margin: "0 0 16px 0", fontSize: 18 }}>Invoice History</h3>
              {billing.invoices.length === 0 ? (
                <div className="emptyState">
                  <div className="emptyState__title">No invoices yet</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {billing.invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      style={{
                        padding: 16,
                        background: "rgba(255, 255, 255, 0.05)",
                        borderRadius: "8px",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>
                          Invoice #{invoice.id}
                        </div>
                        <div style={{ fontSize: 14, color: "#9ca3af" }}>
                          {invoice.date} • {invoice.amount}
                        </div>
                      </div>
            <button type="button" className="dashBtn dashBtn--small">
                        Download
            </button>
          </div>
                  ))}
        </div>
              )}
      </div>
          </div>
        </div>
      )}

      {/* Integrations Section */}
      {activeSection === "integrations" && (
        <div className="panelCard">
          <div className="panelCard__header">
            <div className="panelCard__title">Integrations</div>
            <div className="panelCard__sub">Connect with POS, inventory, and accounting systems</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* POS Integration */}
            <div style={{
              padding: 20,
              background: "rgba(255, 255, 255, 0.05)",
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 18 }}>POS System</h3>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={integrations.pos.enabled}
                    onChange={(e) =>
                      setIntegrations({
                        ...integrations,
                        pos: { ...integrations.pos, enabled: e.target.checked },
                      })
                    }
                  />
                  <span>Enable</span>
                </label>
              </div>
              {integrations.pos.enabled && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label className="dashLabel">POS System</label>
                    <select
                      className="dashSelect"
                      value={integrations.pos.system}
                      onChange={(e) =>
                        setIntegrations({
                          ...integrations,
                          pos: { ...integrations.pos, system: e.target.value },
                        })
                      }
                    >
                      <option value="">Select POS System</option>
                      <option value="toast">Toast</option>
                      <option value="square">Square</option>
                      <option value="clover">Clover</option>
                      <option value="revel">Revel</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="dashLabel">API Key</label>
                    <input
                      type="password"
                      className="dashInput"
                      value={integrations.pos.apiKey}
                      onChange={(e) =>
                        setIntegrations({
                          ...integrations,
                          pos: { ...integrations.pos, apiKey: e.target.value },
                        })
                      }
                      placeholder="Enter API key"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Inventory Integration */}
            <div style={{
              padding: 20,
              background: "rgba(255, 255, 255, 0.05)",
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 18 }}>Inventory System</h3>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={integrations.inventory.enabled}
                    onChange={(e) =>
                      setIntegrations({
                        ...integrations,
                        inventory: { ...integrations.inventory, enabled: e.target.checked },
                      })
                    }
                  />
                  <span>Enable</span>
                </label>
              </div>
              {integrations.inventory.enabled && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label className="dashLabel">Inventory System</label>
                    <select
                      className="dashSelect"
                      value={integrations.inventory.system}
                      onChange={(e) =>
                        setIntegrations({
                          ...integrations,
                          inventory: { ...integrations.inventory, system: e.target.value },
                        })
                      }
                    >
                      <option value="">Select Inventory System</option>
                      <option value="marketman">MarketMan</option>
                      <option value="crunchtime">CrunchTime</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="dashLabel">API Key</label>
                    <input
                      type="password"
                      className="dashInput"
                      value={integrations.inventory.apiKey}
                      onChange={(e) =>
                        setIntegrations({
                          ...integrations,
                          inventory: { ...integrations.inventory, apiKey: e.target.value },
                        })
                      }
                      placeholder="Enter API key"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Accounting Integration */}
            <div style={{
              padding: 20,
              background: "rgba(255, 255, 255, 0.05)",
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 18 }}>Accounting Export</h3>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={integrations.accounting.enabled}
                    onChange={(e) =>
                      setIntegrations({
                        ...integrations,
                        accounting: { ...integrations.accounting, enabled: e.target.checked },
                      })
                    }
                  />
                  <span>Enable</span>
                </label>
              </div>
              {integrations.accounting.enabled && (
                <div>
                  <label className="dashLabel">Export Format</label>
                  <select
                    className="dashSelect"
                    value={integrations.accounting.exportFormat}
                    onChange={(e) =>
                      setIntegrations({
                        ...integrations,
                        accounting: { ...integrations.accounting, exportFormat: e.target.value },
                      })
                    }
                  >
                    <option value="CSV">CSV</option>
                    <option value="XLSX">Excel (XLSX)</option>
                    <option value="QuickBooks">QuickBooks</option>
                    <option value="Xero">Xero</option>
                  </select>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                type="button"
                className="dashBtn dashBtn--primary"
                onClick={saveIntegrations}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Integrations"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ==============================
   REAL DATA HOOK (REPLACES MOCK)
================================ */

function useCompanyData(companyId, onRestaurantsLoaded) {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState(null);
  const [previousMonthData, setPreviousMonthData] = useState(null);
  const [trendData, setTrendData] = useState({
    revenue: [],
    foodAlcohol: [],
    waste: [],
  });
  const [restaurantsListCache, setRestaurantsListCache] = useState([]);
  const BATCH_SIZE = 20; // Load 20 restaurants at a time

  // Load restaurant list first (fast)
  useEffect(() => {
    const loadRestaurantList = async () => {
      if (!companyId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Load restaurants from top-level collection
        const restaurantsRef = collection(db, "restaurants");
        const restaurantsSnap = await getDocs(restaurantsRef);
        const restaurantsList = restaurantsSnap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || d.id,
          ...d.data(),
          // Set default values for immediate display
          salesMtd: 0,
          foodPct: 0,
          alcoholPct: 0,
          wastePct: 0,
          laborPct: 0,
          totalLabor: 0,
          staffCount: 0,
          health: "green",
        }));

        setRestaurantsListCache(restaurantsList);
        setRestaurants(restaurantsList);
        setLoading(false);
        setLoadingDetails(true);

        // Load detailed data progressively
        if (onRestaurantsLoaded) {
          onRestaurantsLoaded(restaurantsList);
        }

        // Start loading detailed data in batches
        loadDetailedDataInBatches(restaurantsList, companyId);
      } catch (err) {
        console.error("Error loading restaurant list:", err);
        setError("Failed to load restaurants");
        setLoading(false);
      }
    };

    loadRestaurantList();
  }, [companyId, onRestaurantsLoaded]);

  // Load detailed data in batches
  const loadDetailedDataInBatches = async (restaurantsList, companyId) => {
    try {

      // Process restaurants in batches
      for (let i = 0; i < restaurantsList.length; i += BATCH_SIZE) {
        const batch = restaurantsList.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(restaurant => loadRestaurantDetails(restaurant, companyId))
        );

        // Update restaurants state progressively
        setRestaurants(prev => {
          const updated = [...prev];
          batchResults.forEach((result, idx) => {
            const originalIndex = prev.findIndex(r => r.id === result.id);
            if (originalIndex !== -1) {
              updated[originalIndex] = result;
            }
          });
          return updated;
        });

        // Small delay between batches to prevent overwhelming Firestore
        if (i + BATCH_SIZE < restaurantsList.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      setLoadingDetails(false);
    } catch (err) {
      console.error("Error loading detailed data:", err);
      setLoadingDetails(false);
    }
  };

  // Load detailed data for a single restaurant
  const loadRestaurantDetails = async (restaurant, companyId) => {
    try {
      // Get current month dates
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const today = new Date();
      
      const monthDates = [];
      for (let d = new Date(firstDayOfMonth); d <= today; d.setDate(d.getDate() + 1)) {
        const dateISO = d.toISOString().split('T')[0];
        monthDates.push(dateISO);
      }

      // Load sales and labor data in parallel (batch the date queries)
      const salesPromises = monthDates.map(async (dateISO) => {
              try {
                const salesRef = doc(
                  db,
                  "companies",
                  companyId,
                  "restaurants",
                  restaurant.id,
                  "sales",
                  dateISO
                );
                const salesSnap = await getDoc(salesRef);
                if (salesSnap.exists()) {
                  return salesSnap.data();
                }
                return null;
              } catch (err) {
                return null;
              }
            });

      const laborPromises = monthDates.map(async (dateISO) => {
        try {
          const laborRef = doc(
            db,
            "companies",
            companyId,
            "restaurants",
            restaurant.id,
            "laborCosts",
            dateISO
          );
          const laborSnap = await getDoc(laborRef);
          return laborSnap.exists() ? laborSnap.data() : null;
        } catch (err) {
          return null;
        }
      });

      const [salesDataArray, laborDataArray] = await Promise.all([
        Promise.all(salesPromises),
        Promise.all(laborPromises),
      ]);
      
      // Calculate sales totals
      const totalSales = salesDataArray.reduce((sum, data) => {
        if (!data) return sum;
        return sum + (Number(data.totalSales) || 0);
      }, 0);

      const alcoholSales = salesDataArray.reduce((sum, data) => {
        if (!data) return sum;
        return sum + (Number(data.alcoholSales) || 0);
      }, 0);

      const foodSales = salesDataArray.reduce((sum, data) => {
        if (!data) return sum;
        return sum + (Number(data.foodSales) || 0);
      }, 0);

      // Calculate labor totals
      const totalLabor = laborDataArray.reduce((sum, data) => {
        if (!data) return sum;
        return sum + (Number(data.totalLabor) || 0);
      }, 0);

      // Calculate percentages
      const alcoholPct = totalSales > 0 ? (alcoholSales / totalSales) * 100 : 0;
      const foodPct = totalSales > 0 ? (foodSales / totalSales) * 100 : 0;
      const laborPct = totalSales > 0 ? (totalLabor / totalSales) * 100 : 0;

      // Load waste data (only last 7 days for performance)
      let wastePct = 0;
      try {
        const recentDates = monthDates.slice(-7);
        const wastePromises = recentDates.map(async (dateISO) => {
          try {
            const expenseRef = doc(
              db,
              "companies",
              companyId,
              "restaurants",
              restaurant.id,
              "expenses",
              dateISO
            );
            const expenseSnap = await getDoc(expenseRef);
            if (expenseSnap.exists()) {
              const data = expenseSnap.data();
              if (data.waste !== undefined) {
                return Number(data.waste) || 0;
              }
            }
            
            const inventoryRef = collection(
              db,
              "companies",
              companyId,
              "restaurants",
              restaurant.id,
              "inventoryMovements"
            );
            const wasteQuery = query(
              inventoryRef,
              where("type", "==", "waste"),
              where("dateISO", "==", dateISO)
            );
            const wasteSnap = await getDocs(wasteQuery);
            if (!wasteSnap.empty) {
              const wasteTotal = wasteSnap.docs.reduce((sum, d) => {
                const data = d.data();
                return sum + (Number(data.cost) || 0);
              }, 0);
              const daySales = salesDataArray.find(s => s && s.dateISO === dateISO);
              const dayTotalSales = daySales ? (Number(daySales.totalSales) || 0) : 0;
              return dayTotalSales > 0 ? (wasteTotal / dayTotalSales) * 100 : 0;
            }
          } catch (err) {
            // Ignore errors
          }
          return null;
        });

        const wasteValues = (await Promise.all(wastePromises)).filter(v => v !== null && v !== undefined);
        if (wasteValues.length > 0) {
          wastePct = wasteValues.reduce((sum, v) => sum + v, 0) / wasteValues.length;
        }
      } catch (err) {
        console.warn(`Failed to load waste data for ${restaurant.id}:`, err);
      }

      // Load staff count
      let staffCount = 0;
      try {
        const staffRef = collection(db, "restaurants", restaurant.id, "staff");
        const staffSnap = await getDocs(staffRef);
        staffCount = staffSnap.size;
      } catch (err) {
        console.warn(`Failed to load staff count for ${restaurant.id}:`, err);
      }

      return {
        ...restaurant,
        salesMtd: totalSales,
        foodPct: Math.round(foodPct * 10) / 10,
        alcoholPct: Math.round(alcoholPct * 10) / 10,
        wastePct: Math.round(wastePct * 10) / 10,
        laborPct: Math.round(laborPct * 10) / 10,
        totalLabor,
        staffCount,
      };
    } catch (err) {
      console.error(`Error loading data for restaurant ${restaurant.id}:`, err);
      return {
        ...restaurant,
        salesMtd: 0,
        foodPct: 0,
        alcoholPct: 0,
        wastePct: 0,
        laborPct: 0,
        totalLabor: 0,
        staffCount: 0,
      };
    }
  };

  // Load trend data (only once, after restaurants are loaded)
  useEffect(() => {
    if (restaurants.length === 0 || loadingDetails) return;

    const loadTrendData = async () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const trendDates = [];
      for (let d = new Date(thirtyDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
        trendDates.push(d.toISOString().split('T')[0]);
      }

      const revenueData = [];
      const foodAlcoholData = [];
      const wasteData = [];

      // Sample dates for trends (every 3 days to reduce queries)
      const sampledDates = trendDates.filter((_, idx) => idx % 3 === 0);

      for (const dateISO of sampledDates) {
        let dailyRevenue = 0;
        let dailyFood = 0;
        let dailyAlcohol = 0;
        let dailyWaste = 0;

        // Sample restaurants (every 5th restaurant) for faster trend loading
        const sampledRestaurants = restaurants.filter((_, idx) => idx % 5 === 0);

        for (const restaurant of sampledRestaurants) {
          try {
            const salesRef = doc(
              db,
              "companies",
              companyId,
              "restaurants",
              restaurant.id,
              "sales",
              dateISO
            );
            const salesSnap = await getDoc(salesRef);
            if (salesSnap.exists()) {
              const sales = salesSnap.data();
              dailyRevenue += Number(sales.totalSales) || 0;
              dailyFood += Number(sales.foodSales) || 0;
              dailyAlcohol += Number(sales.alcoholSales) || 0;
            }
          } catch (err) {
            // Ignore errors
          }
        }

        const date = new Date(dateISO);
        const label = `${date.getMonth() + 1}/${date.getDate()}`;

        revenueData.push({ label, revenue: dailyRevenue });
        foodAlcoholData.push({ label, food: dailyFood, alcohol: dailyAlcohol });
        wasteData.push({ label, wastePct: 0 }); // Simplified for performance
      }

      setTrendData({
        revenue: revenueData,
        foodAlcohol: foodAlcoholData,
        waste: wasteData,
      });
    };

    loadTrendData();
  }, [restaurants.length, companyId, loadingDetails]);

  const restaurantsWithHealth = useMemo(() => {
    return restaurants.map((r) => {
      let health = "green";
      if (r.wastePct >= 4.5) health = "red";
      else if (r.alcoholPct > 0 && r.alcoholPct < 25) health = "yellow";
      else if (r.salesMtd === 0) health = "yellow";

      return { ...r, health };
    });
  }, [restaurants]);

  const restaurantsSorted = useMemo(() => {
    const rank = { red: 0, yellow: 1, green: 2 };
    return [...restaurantsWithHealth].sort((a, b) => rank[a.health] - rank[b.health]);
  }, [restaurantsWithHealth]);

  const totals = useMemo(() => {
    const totalRevenue = restaurants.reduce((sum, r) => sum + (Number(r.salesMtd) || 0), 0);
    const foodSales = Math.round(
      restaurants.reduce((sum, r) => sum + (Number(r.salesMtd) || 0) * (Number(r.foodPct) || 0) / 100, 0)
    );
    const alcoholSales = Math.round(
      restaurants.reduce((sum, r) => sum + (Number(r.salesMtd) || 0) * (Number(r.alcoholPct) || 0) / 100, 0)
    );

    const totalLabor = restaurants.reduce((sum, r) => sum + (Number(r.totalLabor) || 0), 0);

    const avgAlcoholPct = safeAvg(restaurants.filter((r) => r.salesMtd > 0).map((r) => r.alcoholPct));
    const avgWastePct = safeAvg(restaurants.filter((r) => r.salesMtd > 0).map((r) => r.wastePct));
    const avgLaborPct = totalRevenue > 0 ? (totalLabor / totalRevenue) * 100 : 0;
    const activeStaff = restaurants.reduce((sum, r) => sum + (Number(r.staffCount) || 0), 0);
    const locations = restaurants.length;

    return {
      totalRevenue,
      foodSales,
      alcoholSales,
      totalLabor,
      avgAlcoholPct,
      avgWastePct,
      avgLaborPct,
      activeStaff,
      locations,
    };
  }, [restaurants]);

  const kpis = useMemo(() => {
    if (!previousMonthData) {
      // Return KPIs without deltas if previous month data not loaded yet
    return [
      {
        key: "totalRevenue",
        label: "Total Revenue",
        value: formatMoney(totals.totalRevenue),
        sub: "MTD",
          delta: "—",
          deltaTone: "neutral",
      },
      {
        key: "foodSales",
        label: "Food Sales",
        value: formatMoney(totals.foodSales),
        sub: "% of total",
          delta: "—",
        deltaTone: "neutral",
      },
      {
        key: "alcoholSales",
        label: "Alcohol Sales",
        value: formatMoney(totals.alcoholSales),
        sub: "% of total",
          delta: "—",
          deltaTone: "neutral",
      },
      {
        key: "avgAlcoholPct",
        label: "Avg Alcohol %",
        value: `${Math.round(totals.avgAlcoholPct)}%`,
        sub: "Target: 28%+",
        delta: totals.avgAlcoholPct >= 28 ? "On target" : "Below target",
        deltaTone: totals.avgAlcoholPct >= 28 ? "good" : "bad",
        badge: totals.avgAlcoholPct >= 28 ? "Good" : "Watch",
        badgeTone: totals.avgAlcoholPct >= 28 ? "green" : "yellow",
        intent: totals.avgAlcoholPct >= 28 ? "good" : "warn",
      },
      {
        key: "avgWastePct",
        label: "Avg Waste %",
        value: `${totals.avgWastePct.toFixed(1)}%`,
        sub: "Threshold: 4.0%",
        delta: totals.avgWastePct <= 4 ? "Within threshold" : "Over threshold",
        deltaTone: totals.avgWastePct <= 4 ? "good" : "bad",
        badge: totals.avgWastePct <= 4 ? "OK" : "High",
        badgeTone: totals.avgWastePct <= 4 ? "green" : "red",
        intent: totals.avgWastePct <= 4 ? "good" : "danger",
      },
      {
        key: "avgLaborPct",
        label: "Avg Labor %",
          value: `${totals.avgLaborPct.toFixed(1)}%`,
          sub: "All locations",
          delta: "—",
        deltaTone: "neutral",
      },
      {
        key: "activeStaff",
        label: "Active Staff",
        value: String(totals.activeStaff),
        sub: "All locations",
        delta: "—",
        deltaTone: "neutral",
      },
      {
        key: "locations",
        label: "Locations",
        value: String(totals.locations),
        sub: "All restaurants",
        delta: "—",
        deltaTone: "neutral",
      },
    ];
    }

    // Calculate month-over-month deltas
    const revenueDelta = previousMonthData.totalRevenue > 0
      ? ((totals.totalRevenue - previousMonthData.totalRevenue) / previousMonthData.totalRevenue) * 100
      : 0;
    
    const foodSalesDelta = previousMonthData.foodSales > 0
      ? ((totals.foodSales - previousMonthData.foodSales) / previousMonthData.foodSales) * 100
      : 0;
    
    const alcoholSalesDelta = previousMonthData.alcoholSales > 0
      ? ((totals.alcoholSales - previousMonthData.alcoholSales) / previousMonthData.alcoholSales) * 100
      : 0;

    const laborDelta = previousMonthData.totalLabor > 0
      ? ((totals.totalLabor - previousMonthData.totalLabor) / previousMonthData.totalLabor) * 100
      : 0;

    const formatDelta = (value, isPercent = false) => {
      if (value === 0 || !Number.isFinite(value)) return "—";
      const sign = value > 0 ? "↑" : "↓";
      const absValue = Math.abs(value);
      if (isPercent) {
        return `${sign} ${absValue.toFixed(1)}%`;
      }
      return `${sign} ${absValue.toFixed(1)}%`;
    };

    const getDeltaTone = (value) => {
      if (value === 0 || !Number.isFinite(value)) return "neutral";
      return value > 0 ? "good" : "bad";
    };

    return [
      {
        key: "totalRevenue",
        label: "Total Revenue",
        value: formatMoney(totals.totalRevenue),
        sub: "MTD",
        delta: formatDelta(revenueDelta),
        deltaTone: getDeltaTone(revenueDelta),
      },
      {
        key: "foodSales",
        label: "Food Sales",
        value: formatMoney(totals.foodSales),
        sub: "% of total",
        delta: formatDelta(foodSalesDelta),
        deltaTone: getDeltaTone(foodSalesDelta),
      },
      {
        key: "alcoholSales",
        label: "Alcohol Sales",
        value: formatMoney(totals.alcoholSales),
        sub: "% of total",
        delta: formatDelta(alcoholSalesDelta),
        deltaTone: getDeltaTone(alcoholSalesDelta),
      },
      {
        key: "avgAlcoholPct",
        label: "Avg Alcohol %",
        value: `${Math.round(totals.avgAlcoholPct)}%`,
        sub: "Target: 28%+",
        delta: totals.avgAlcoholPct >= 28 ? "On target" : "Below target",
        deltaTone: totals.avgAlcoholPct >= 28 ? "good" : "bad",
        badge: totals.avgAlcoholPct >= 28 ? "Good" : "Watch",
        badgeTone: totals.avgAlcoholPct >= 28 ? "green" : "yellow",
        intent: totals.avgAlcoholPct >= 28 ? "good" : "warn",
      },
      {
        key: "avgWastePct",
        label: "Avg Waste %",
        value: `${totals.avgWastePct.toFixed(1)}%`,
        sub: "Threshold: 4.0%",
        delta: totals.avgWastePct <= 4 ? "Within threshold" : "Over threshold",
        deltaTone: totals.avgWastePct <= 4 ? "good" : "bad",
        badge: totals.avgWastePct <= 4 ? "OK" : "High",
        badgeTone: totals.avgWastePct <= 4 ? "green" : "red",
        intent: totals.avgWastePct <= 4 ? "good" : "danger",
      },
      {
        key: "avgLaborPct",
        label: "Avg Labor %",
        value: `${totals.avgLaborPct.toFixed(1)}%`,
        sub: "All locations",
        delta: formatDelta(laborDelta),
        deltaTone: getDeltaTone(laborDelta),
      },
      {
        key: "activeStaff",
        label: "Active Staff",
        value: String(totals.activeStaff),
        sub: "All locations",
        delta: "—",
        deltaTone: "neutral",
      },
      {
        key: "locations",
        label: "Locations",
        value: String(totals.locations),
        sub: "All restaurants",
        delta: "—",
        deltaTone: "neutral",
      },
    ];
  }, [totals, previousMonthData]);

  const alerts = useMemo(() => {
    const highWaste = restaurantsWithHealth.filter((r) => r.wastePct >= 4.0);
    const lowAlcohol = restaurantsWithHealth.filter((r) => r.salesMtd > 0 && r.alcoholPct < 25);

    const list = [];

    if (highWaste.length) {
      list.push({
        severity: "red",
        type: "waste",
        title: `${highWaste.length} restaurant(s) above waste threshold`,
        meta: highWaste.map((r) => `${r.name} (${r.wastePct}%)`).join(" • "),
      });
    }

    if (lowAlcohol.length) {
      list.push({
        severity: "yellow",
        type: "alcohol",
        title: `${lowAlcohol.length} restaurant(s) below alcohol mix target`,
        meta: lowAlcohol.map((r) => `${r.name} (${r.alcoholPct}%)`).join(" • "),
      });
    }

    if (!list.length) {
      list.push({
        severity: "green",
        type: "none",
        title: "No critical alerts detected",
        meta: "All locations within threshold.",
      });
    }

    return list;
  }, [restaurantsWithHealth]);

  return {
    restaurantsSorted,
    kpis,
    alerts,
    loading,
    error,
    previousMonthData,
    trendData,
  };
}

/* ==============================
   HELPERS
================================ */

function safeAvg(arr) {
  const nums = (arr || []).map((n) => Number(n)).filter((n) => Number.isFinite(n));
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function formatMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "$0";
  return num.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}