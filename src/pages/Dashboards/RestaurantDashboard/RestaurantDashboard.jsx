//src/pages/Dashboards/RestaurantDashboard/RestaurantDashboard.jsx
import React, { useState, useEffect, useCallback } from "react";
import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom";

// Import Tab Components
import OverviewTab from "./tabs/OverviewTab";
import StaffTab from "./tabs/StaffTab";
import InventoryTab from "./tabs/InventoryTab";
import SchedulingTab from "./tabs/Scheduling/SchedulingTab";
import FinanceTab from "./tabs/FinanceTab";
import LiveLineup from "./tabs/LiveLineup/LiveLineup";
import MessagingTab from "./tabs/MessagingTab";
import ReservationsTab from "./tabs/ReservationsTab";
import LiveOperationsTab from "./tabs/LiveOperationsTab";
import ValetTab from "./tabs/ValetTab";
import VerificationsTab from "./tabs/VerificationsTab";
import RemindersTab from "./tabs/RemindersTab";
import ValetAuthorizationsTab from "./tabs/ValetAuthorizationsTab";
import ToGoOrdersTab from "./tabs/ToGoOrdersTab";
import BowlingLaneManagementTab from "./tabs/BowlingLaneManagementTab";

// Safely import Firebase - wrap in try-catch
let db = null;
try {
  const firebaseModule = require("../../../hooks/services/firebase");
  db = firebaseModule.db;
} catch (err) {
  console.error("Firebase import failed:", err);
}

// Safely import CSS - wrap in try-catch
try {
  require("./RestaurantDashboard.css");
} catch (err) {
  console.warn("CSS import failed:", err);
}

export default function RestaurantDashboard() {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  
  const [activeTab, setActiveTab] = useState(() => {
    return tabFromUrl || "overview";
  });
  const [restaurants, setRestaurants] = useState([]);
  const [currentRestaurant, setCurrentRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [restaurantLogoURL, setRestaurantLogoURL] = useState(null);
  
  // ================= LOAD ALL RESTAURANTS =================
  const loadRestaurants = useCallback(async () => {
    if (!db) {
      console.error("Firebase not available");
      setLoading(false);
      return;
    }
    
    try {
      const { collection, getDocs } = await import("firebase/firestore");
      const restaurantsRef = collection(db, "restaurants");
      const snap = await getDocs(restaurantsRef);
      
      const restaurantsList = snap.docs.map((d) => ({
        id: d.id,
        name: d.data().name || d.id,
        ...d.data(),
      }));

      console.log("Loaded restaurants:", restaurantsList.length, restaurantsList.map(r => r.id));
      setRestaurants(restaurantsList);
      
      // Find current restaurant
      const current = restaurantsList.find((r) => r.id === restaurantId);
      console.log("Current restaurantId from URL:", restaurantId);
      console.log("Found current restaurant:", current ? current.name : "NOT FOUND");
      setCurrentRestaurant(current || null);
      
      // If restaurantId doesn't exist and we have restaurants, redirect to first one
      if (!current && restaurantsList.length > 0) {
        console.warn(`Restaurant ID "${restaurantId}" not found. Redirecting to first restaurant.`);
        navigate(`/restaurant/${restaurantsList[0].id}`, { replace: true });
      }
    } catch (err) {
      console.error("Failed to load restaurants:", err);
      setLoading(false);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, navigate]);

  useEffect(() => {
    loadRestaurants();
  }, [loadRestaurants]);

  // ================= LOAD RESTAURANT LOGO =================
  useEffect(() => {
    const loadRestaurantLogo = async () => {
      if (!currentRestaurant || !db) return;
      
      try {
        const { doc, getDoc } = await import("firebase/firestore");
        const restaurantRef = doc(db, "restaurants", currentRestaurant.id);
        const restaurantSnap = await getDoc(restaurantRef);
        
        if (restaurantSnap.exists()) {
          const data = restaurantSnap.data();
          const logoURL = data.imageURL || data.logoURL || data.logo || null;
          
          if (logoURL && typeof logoURL === 'string' && logoURL.trim().length > 0) {
            setRestaurantLogoURL(logoURL.trim());
          } else {
            setRestaurantLogoURL(null);
          }
        } else {
          setRestaurantLogoURL(null);
        }
      } catch (err) {
        console.error("Failed to load restaurant logo:", err);
        setRestaurantLogoURL(null);
      }
    };
    
    loadRestaurantLogo();
  }, [currentRestaurant]);

  // ================= SYNC TAB FROM URL =================
  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl, activeTab]);

  // ================= HANDLE TAB CHANGE =================
  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    navigate(`/restaurant/${restaurantId}?tab=${tabKey}`);
  };

  // ================= RENDER TAB CONTENT =================
  const renderTabContent = () => {
    if (!restaurantId) {
      return (
        <div style={{ padding: 40, color: "#fff", textAlign: "center" }}>
          <p>No restaurant selected.</p>
        </div>
      );
    }

    switch (activeTab) {
      case "overview":
        return <OverviewTab />;
      
      case "staff":
        return <StaffTab />;
      
      case "inventory":
        return <InventoryTab />;
      
      case "scheduling":
        return <SchedulingTab />;
      
      case "finance":
        return <FinanceTab />;
      
      case "live-lineup":
        return <LiveLineup />;
      
      case "messaging":
        return <MessagingTab />;
      
      case "reservations":
        return <ReservationsTab />;
      
      case "live-operations":
        return <LiveOperationsTab />;
      
      
      case "verifications":
        return <VerificationsTab />;
      
      case "reminders":
        return <RemindersTab />;
      
      case "valet-authorizations":
        return <ValetAuthorizationsTab />;
      
      case "togo-orders":
        return <ToGoOrdersTab />;
      
      case "bowling-lanes":
        return <BowlingLaneManagementTab />;
      
      default:
        return (
          <div style={{ padding: 40, color: "#fff", textAlign: "center" }}>
            <h2>Tab: {activeTab}</h2>
            <p>Tab component not found.</p>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#fff", minHeight: "100vh", background: "radial-gradient(circle at center, #001836 0%, #000c1b 100%)" }}>
        <h1>Loading restaurant dashboard...</h1>
      </div>
    );
  }

  if (!currentRestaurant && restaurants.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#fff", minHeight: "100vh", background: "radial-gradient(circle at center, #001836 0%, #000c1b 100%)", position: "relative" }}>
        <Link to="/" className="rd-back-link-top">← Back</Link>
        <h2>No Restaurants Found</h2>
        <p style={{ marginTop: 16, opacity: 0.8 }}>
          Please add restaurants to Firebase to access the dashboard.
        </p>
      </div>
    );
  }

  if (!currentRestaurant) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#fff", minHeight: "100vh", background: "radial-gradient(circle at center, #001836 0%, #000c1b 100%)", position: "relative" }}>
        <Link to="/" className="rd-back-link-top">← Back</Link>
        <h2>Restaurant Not Found</h2>
        <p style={{ marginTop: 16, opacity: 0.8 }}>
          Restaurant ID "{restaurantId}" does not exist in Firebase.
        </p>
        {restaurants.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <p style={{ marginBottom: 12, opacity: 0.8 }}>Available restaurants:</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
              {restaurants.map((r) => (
                <Link
                  key={r.id}
                  to={`/restaurant/${r.id}`}
                  style={{
                    padding: "8px 16px",
                    background: "rgba(77, 163, 255, 0.2)",
                    border: "1px solid rgba(77, 163, 255, 0.4)",
                    borderRadius: 6,
                    color: "#fff",
                    textDecoration: "none",
                    display: "inline-block",
                  }}
                >
                  {r.name} ({r.id})
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Build tabs array - conditionally include attractions tabs
  const attractions = currentRestaurant?.attractions || {};
  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "reservations", label: "Reservations" },
    { key: "live-operations", label: "Live Operations" },
    { key: "staff", label: "Staff" },
    { key: "verifications", label: "Verifications" },
    { key: "valet-authorizations", label: "Valet Companies" },
    { key: "reminders", label: "Reminders" },
    { key: "inventory", label: "Inventory" },
    { key: "scheduling", label: "Scheduling" },
    { key: "finance", label: "Finance" },
    { key: "live-lineup", label: "Live Lineup" },
    { key: "messaging", label: "Messaging" },
    { key: "togo-orders", label: "To-Go Orders" },
    // Attractions tabs - only show if enabled
    ...(attractions.bowling ? [{ key: "bowling-lanes", label: "Bowling Lanes" }] : []),
  ];

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at center, #001836 0%, #000c1b 100%)", padding: 20, color: "#fff", position: "relative" }}>
      <Link to="/" className="rd-back-link-top">← Back</Link>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* ================= HEADER ================= */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
            {restaurantLogoURL && (
              <img 
                src={restaurantLogoURL} 
                alt="Restaurant logo" 
                className="rd-header-logo"
                style={{ width: "50px", height: "50px", maxWidth: "50px", maxHeight: "50px", objectFit: "contain" }}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <h1 className="rd-title-main" style={{ fontSize: "20px", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Restaurant Dashboard</h1>
              <div style={{ marginTop: 4, opacity: 0.7, fontSize: "14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                <span>{currentRestaurant.name}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ================= TABS ================= */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, borderBottom: "1px solid rgba(255,255,255,0.2)", flexWrap: "wrap" }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                style={{
                  padding: "12px 24px",
                  background: isActive ? "rgba(77, 163, 255, 0.2)" : "transparent",
                  border: "none",
                  borderBottom: isActive ? "2px solid #4da3ff" : "2px solid transparent",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: isActive ? 600 : 400,
                  whiteSpace: "nowrap",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ================= CONTENT ================= */}
        <div>
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}