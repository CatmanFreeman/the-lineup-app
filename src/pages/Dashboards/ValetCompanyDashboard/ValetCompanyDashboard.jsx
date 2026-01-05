// src/pages/Dashboards/ValetCompanyDashboard/ValetCompanyDashboard.jsx
//
// VALET COMPANY DASHBOARD
//
// Manages valet company with multiple locations
// Each location has its own drivers, finances, and HR info

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../hooks/services/firebase";
import {
  getValetCompany,
  VALET_COMPANY_PLAN,
  createOrUpdateValetCompany,
} from "../../../utils/valetCompanyService";
import {
  getValetCompanyLocations,
  addValetCompanyLocation,
  removeValetCompanyLocation,
  upgradeValetCompanyToPaid,
} from "../../../utils/valetCompanyLocationService";
import {
  getLocationsWithDriverCounts,
  getDriversForLocation,
  addDriverToLocation,
  removeDriverFromLocation,
} from "../../../utils/valetCompanyLocationDriverService";
import { getAllLocationMetrics, getAllCompanyFinancials } from "../../../utils/valetCompanyMetricsService";
import { getValetCompanyPreBookings, VALET_PRE_BOOKING_STATUS } from "../../../utils/valetPreBookingService";
import ClaimsTab from "./ClaimsTab";
import "./ValetCompanyDashboard.css";

// Format money utility
function formatMoney(n) {
  if (typeof n !== "number" || !isFinite(n)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

// TabButton component
function TabButton({ id, label, active, onClick }) {
  return (
    <button
      id={id}
      className={`companyDash__tab ${active ? "is-active" : ""}`}
      onClick={onClick}
      role="tab"
      aria-selected={active}
      aria-controls={`panel-${id}`}
    >
      {label}
    </button>
  );
}

export default function ValetCompanyDashboard() {
  const { companyId: routeCompanyId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const isTestMode = searchParams.get("test") === "true";
  // Default to valet-company-123 in test mode if no companyId provided
  const companyId = routeCompanyId || (isTestMode ? "valet-company-123" : null);
  const [company, setCompany] = useState(null);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationDrivers, setLocationDrivers] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [locationMetrics, setLocationMetrics] = useState([]);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [preBookings, setPreBookings] = useState([]);
  const [loadingPreBookings, setLoadingPreBookings] = useState(false);
  const [financials, setFinancials] = useState(null);
  const [loadingFinancials, setLoadingFinancials] = useState(false);
  const [showAddLocationForm, setShowAddLocationForm] = useState(false);
  const [showAddDriverForm, setShowAddDriverForm] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [newLocation, setNewLocation] = useState({
    name: "",
    type: "restaurant",
    lat: "",
    lng: "",
    address: "",
    restaurantId: "",
  });
  const [newDriver, setNewDriver] = useState({
    name: "",
    email: "",
    phone: "",
    restaurantId: "",
  });

  useEffect(() => {
    // In test mode, allow access without login
    if (!isTestMode && !currentUser) {
      navigate("/login");
      return;
    }
    
    if (!companyId) {
      if (isTestMode) {
        // Default to valet-company-123 in test mode
        navigate("/dashboard/valet-company/valet-company-123?test=true", { replace: true });
      } else {
        navigate("/login");
      }
      return;
    }

    loadCompany();
    loadRestaurants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, companyId, navigate, isTestMode]);

  useEffect(() => {
    if (selectedLocation) {
      loadLocationDrivers(selectedLocation.id);
    }
  }, [selectedLocation]);

  useEffect(() => {
    if (activeTab === "overview" && companyId) {
      loadLocationMetrics();
      loadPreBookings();
      loadFinancials();
    } else if (activeTab === "financials" && companyId) {
      loadFinancials();
    }
  }, [activeTab, companyId]);

  async function loadFinancials() {
    try {
      setLoadingFinancials(true);
      const data = await getAllCompanyFinancials(companyId);
      setFinancials(data);
    } catch (error) {
      console.error("Error loading financials:", error);
      setFinancials(null);
    } finally {
      setLoadingFinancials(false);
    }
  }

  async function loadPreBookings() {
    try {
      setLoadingPreBookings(true);
      const bookings = await getValetCompanyPreBookings(companyId);
      setPreBookings(bookings);
    } catch (error) {
      console.error("Error loading pre-bookings:", error);
      setPreBookings([]);
    } finally {
      setLoadingPreBookings(false);
    }
  }

  async function loadLocationMetrics() {
    try {
      setLoadingMetrics(true);
      const metrics = await getAllLocationMetrics(companyId);
      setLocationMetrics(metrics);
    } catch (error) {
      console.error("Error loading location metrics:", error);
      setLocationMetrics([]);
    } finally {
      setLoadingMetrics(false);
    }
  }

  async function loadRestaurants() {
    try {
      const restaurantsRef = collection(db, "restaurants");
      const snap = await getDocs(restaurantsRef);
      setRestaurants(snap.docs.map((d) => ({ id: d.id, name: d.data().name || d.id, ...d.data() })));
    } catch (error) {
      console.error("Error loading restaurants:", error);
    }
  }

  async function loadCompany() {
    try {
      setLoading(true);
      let companyData;
      
      try {
        console.log(`Loading valet company: ${companyId}`);
        companyData = await getValetCompany(companyId);
        console.log("Company loaded successfully:", companyData);
      } catch (error) {
        console.error("Error loading company:", error);
        if (isTestMode && (error.message === "Valet company not found" || error.message.includes("not found"))) {
          // If trying to load valet-company-123 and it doesn't exist, that's unexpected
          // Otherwise, create a test company
          if (companyId === "valet-company-123") {
            console.error("Valet Company 123 not found. Attempting to load directly from Firestore...");
            // Try loading directly
            try {
              const companyRef = doc(db, "valetCompanies", "valet-company-123");
              const companySnap = await getDoc(companyRef);
              if (companySnap.exists()) {
                companyData = { id: companySnap.id, ...companySnap.data() };
                console.log("Loaded company directly from Firestore:", companyData);
              } else {
                throw new Error("Valet Company 123 not found in Firestore. Please run the setup script.");
              }
            } catch (directError) {
              console.error("Direct load failed:", directError);
              throw new Error("Valet Company 123 not found. Please ensure the mock data has been created.");
            }
          } else {
            console.log("Creating test valet company...");
            await createOrUpdateValetCompany({
              companyId: companyId,
              name: "Test Valet Company",
              contactName: currentUser?.displayName || "Test Admin",
              contactEmail: currentUser?.email || "test@example.com",
              contactPhone: "",
              address: "",
            });
            
            const companyRef = doc(db, "valetCompanies", companyId);
            await setDoc(companyRef, {
              adminUserId: currentUser?.uid || "test-admin",
              updatedAt: serverTimestamp(),
            }, { merge: true });
            
            companyData = await getValetCompany(companyId);
          }
        } else {
          throw error;
        }
      }

      setCompany(companyData);

      if (!isTestMode && companyData.adminUserId !== currentUser.uid) {
        alert("Access denied. This dashboard is for valet company admins only.");
        navigate("/");
        return;
      }

      if (isTestMode && currentUser && companyData.adminUserId !== currentUser.uid) {
        const companyRef = doc(db, "valetCompanies", companyId);
        await setDoc(companyRef, {
          adminUserId: currentUser.uid,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        companyData.adminUserId = currentUser.uid;
        setCompany(companyData);
      }

      // Load locations with driver counts
      const locationsWithCounts = await getLocationsWithDriverCounts(companyId);
      setLocations(locationsWithCounts);
    } catch (error) {
      console.error("Error loading valet company:", error);
      if (isTestMode) {
        // In test mode, if company not found, try to load valet-company-123
        if (companyId === "valet-company-123") {
          console.log("Attempting to load valet-company-123...");
          try {
            const companyData = await getValetCompany("valet-company-123");
            setCompany(companyData);
            const locationsWithCounts = await getLocationsWithDriverCounts("valet-company-123");
            setLocations(locationsWithCounts);
            setLoading(false);
            return;
          } catch (loadError) {
            console.error("Could not load valet-company-123:", loadError);
            setCompany(null);
            setLocations([]);
          }
        } else {
          try {
            await createOrUpdateValetCompany({
              companyId: companyId,
              name: "Test Valet Company",
              contactName: currentUser?.displayName || "Test Admin",
              contactEmail: currentUser?.email || "test@example.com",
              contactPhone: "",
              address: "",
            });
            
            const companyRef = doc(db, "valetCompanies", companyId);
            await setDoc(companyRef, {
              adminUserId: currentUser?.uid || "test-admin",
              plan: VALET_COMPANY_PLAN.FREE,
              locations: [],
              updatedAt: serverTimestamp(),
            }, { merge: true });
            
            const companyData = await getValetCompany(companyId);
            setCompany(companyData);
            setLocations([]);
          } catch (createError) {
            console.error("Error creating test company:", createError);
            setCompany(null);
            setLocations([]);
          }
        }
      } else {
        setCompany(null);
        setLocations([]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadLocationDrivers(locationId) {
    try {
      const drivers = await getDriversForLocation(companyId, locationId);
      setLocationDrivers(drivers);
    } catch (error) {
      console.error("Error loading location drivers:", error);
      setLocationDrivers([]);
    }
  }

  const handleAddLocation = async (e) => {
    e.preventDefault();

    const isRestaurant = newLocation.type === "restaurant" || newLocation.restaurantId;

    if (!isRestaurant && company.plan === VALET_COMPANY_PLAN.FREE) {
      setShowUpgradeModal(true);
      return;
    }

    try {
      let lat = parseFloat(newLocation.lat);
      let lng = parseFloat(newLocation.lng);

      if (!lat || !lng) {
        alert("Please provide valid coordinates");
        return;
      }

      const result = await addValetCompanyLocation({
        valetCompanyId: companyId,
        location: {
          name: newLocation.name,
          type: newLocation.type,
          lat,
          lng,
          address: newLocation.address,
          restaurantId: newLocation.restaurantId || null,
        },
      });

      if (result.requiresUpgrade) {
        setShowUpgradeModal(true);
        return;
      }

      if (result.success) {
        alert("Location added successfully!");
        setShowAddLocationForm(false);
        setNewLocation({
          name: "",
          type: "restaurant",
          lat: "",
          lng: "",
          address: "",
          restaurantId: "",
        });
        await loadCompany();
      }
    } catch (error) {
      console.error("Error adding location:", error);
      alert("Failed to add location. Please try again.");
    }
  };

  const handleAddDriver = async (e) => {
    e.preventDefault();
    if (!selectedLocation) return;

    try {
      // For now, we'll need to create a user account first
      // In production, this would be done through proper signup flow
      alert("Driver signup flow coming soon. For now, drivers should sign up through the app.");
      
      // TODO: Implement proper driver addition flow
      // await addDriverToLocation({
      //   companyId,
      //   locationId: selectedLocation.id,
      //   userId: newDriver.userId,
      //   restaurantId: selectedLocation.restaurantId || newDriver.restaurantId,
      //   name: newDriver.name,
      //   email: newDriver.email,
      //   phone: newDriver.phone,
      // });
      
      setShowAddDriverForm(false);
      setNewDriver({
        name: "",
        email: "",
        phone: "",
        restaurantId: "",
      });
    } catch (error) {
      console.error("Error adding driver:", error);
      alert("Failed to add driver. Please try again.");
    }
  };

  const handleRemoveLocation = async (locationId) => {
    if (!window.confirm("Remove this location? All drivers will be unassigned.")) return;

    try {
      await removeValetCompanyLocation(companyId, locationId);
      await loadCompany();
      if (selectedLocation?.id === locationId) {
        setSelectedLocation(null);
      }
    } catch (error) {
      console.error("Error removing location:", error);
      alert("Failed to remove location. Please try again.");
    }
  };

  const handleRemoveDriver = async (userId) => {
    if (!selectedLocation || !window.confirm("Remove this driver from this location?")) return;

    try {
      await removeDriverFromLocation(companyId, selectedLocation.id, userId);
      await loadLocationDrivers(selectedLocation.id);
    } catch (error) {
      console.error("Error removing driver:", error);
      alert("Failed to remove driver. Please try again.");
    }
  };

  const handleUpgrade = async () => {
    try {
      await upgradeValetCompanyToPaid(companyId);
      alert("Upgraded to paid plan! You can now add non-restaurant locations.");
      setShowUpgradeModal(false);
      await loadCompany();
    } catch (error) {
      console.error("Error upgrading:", error);
      alert("Failed to upgrade. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="companyDash">
        <header className="companyDash__header">
          <div className="companyDash__titleRow">
            <img src="/logo.svg" alt="Company Logo" className="companyDash__headerLogo" />
            <div className="companyDash__titleGroup">
              <h1 className="companyDash__title">Valet Company Dashboard</h1>
              <div className="companyDash__subtitle">Valet company management and overview</div>
            </div>
          </div>
        </header>
        <main className="companyDash__main">
          <section className="companyDash__panel">
            <div className="panelCard">
              <div className="emptyState">
                <div className="emptyState__title">Loading company data...</div>
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (!company && !loading) {
    return (
      <div className="companyDash">
        <header className="companyDash__header">
          <div className="companyDash__titleRow">
            <img src="/logo.svg" alt="Company Logo" className="companyDash__headerLogo" />
            <div className="companyDash__titleGroup">
              <h1 className="companyDash__title">Valet Company Dashboard</h1>
              <div className="companyDash__subtitle">Valet company management and overview</div>
            </div>
          </div>
        </header>
        <main className="companyDash__main">
          <section className="companyDash__panel">
            <div className="panelCard">
              <div className="emptyState">
                <div className="emptyState__title">Company not found</div>
                <div className="emptyState__sub">
                  {isTestMode ? (
                    <>
                      Company ID: {companyId || "none"}<br />
                      Make sure you're accessing: /dashboard/valet-company/valet-company-123?test=true
                    </>
                  ) : (
                    "Please check the company ID in the URL."
                  )}
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="companyDash">
      <Link to="/" className="companyDash-back-link-top">← Back</Link>
      <header className="companyDash__header">
        <div className="companyDash__titleRow">
          <img src="/logo.svg" alt="Company Logo" className="companyDash__headerLogo" />
          <div className="companyDash__titleGroup">
            <h1 className="companyDash__title">Valet Company Dashboard</h1>
            <div className="companyDash__subtitle">Manage locations, drivers, and finances</div>
          </div>
        </div>

        <nav className="companyDash__tabs" role="tablist">
          <TabButton id="overview" label="Overview" active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
          <TabButton id="financials" label="Financials" active={activeTab === "financials"} onClick={() => setActiveTab("financials")} />
          <TabButton id="locations" label="Locations" active={activeTab === "locations"} onClick={() => setActiveTab("locations")} />
          <TabButton id="hr" label="HR" active={activeTab === "hr"} onClick={() => setActiveTab("hr")} />
          <TabButton id="claims" label="Claims" active={activeTab === "claims"} onClick={() => setActiveTab("claims")} />
          <TabButton id="settings" label="Settings" active={activeTab === "settings"} onClick={() => setActiveTab("settings")} />
        </nav>
      </header>

      <main className="companyDash__main">
        {activeTab === "overview" && (
          <section className="companyDash__panel" id="panel-overview" role="tabpanel">
            <div className="companyDash__sectionHeader">
              <h2 className="companyDash__sectionTitle">Company Overview</h2>
            </div>
            
            {/* Company-wide KPIs */}
            <div className="kpiStrip">
              <div className="kpiCard">
                <div className="kpiCard__top">
                  <div className="kpiCard__label">Total Locations</div>
                </div>
                <div className="kpiCard__valueRow">
                  <div className="kpiCard__value">{locations.length}</div>
                </div>
              </div>
              <div className="kpiCard">
                <div className="kpiCard__top">
                  <div className="kpiCard__label">Total Drivers</div>
                </div>
                <div className="kpiCard__valueRow">
                  <div className="kpiCard__value">{locations.reduce((sum, loc) => sum + (loc.driverCount || 0), 0)}</div>
                </div>
              </div>
              <div className="kpiCard">
                <div className="kpiCard__top">
                  <div className="kpiCard__label">Total Shift Revenue</div>
                </div>
                <div className="kpiCard__valueRow">
                  <div className="kpiCard__value">{formatMoney(locationMetrics.reduce((sum, m) => sum + (m.totalRevenue || 0), 0))}</div>
                </div>
              </div>
              <div className="kpiCard">
                <div className="kpiCard__top">
                  <div className="kpiCard__label">Cars in Inventory</div>
                </div>
                <div className="kpiCard__valueRow">
                  <div className="kpiCard__value">{locationMetrics.reduce((sum, m) => sum + (m.carsInInventory || 0), 0)}</div>
                </div>
              </div>
            </div>

            {/* Daily & Weekly Revenue Summary */}
            <div className="companyDash__sectionHeader" style={{ marginTop: "24px" }}>
              <h2 className="companyDash__sectionTitle">Revenue Summary</h2>
            </div>
            {loadingFinancials ? (
              <div className="panelCard">
                <div className="emptyState">
                  <div className="emptyState__title">Loading revenue data...</div>
                </div>
              </div>
            ) : financials ? (
              <div className="kpiStrip">
                <div className="kpiCard">
                  <div className="kpiCard__top">
                    <div className="kpiCard__label">Today's Revenue</div>
                  </div>
                  <div className="kpiCard__valueRow">
                    <div className="kpiCard__value">{formatMoney(financials.daily?.totalCompanyAmount || 0)}</div>
                  </div>
                  <div className="kpiCard__subtext">{financials.daily?.transactionCount || 0} transactions</div>
                </div>
                <div className="kpiCard">
                  <div className="kpiCard__top">
                    <div className="kpiCard__label">This Week's Revenue</div>
                  </div>
                  <div className="kpiCard__valueRow">
                    <div className="kpiCard__value">{formatMoney(financials.weekly?.totalCompanyAmount || 0)}</div>
                  </div>
                  <div className="kpiCard__subtext">{financials.weekly?.transactionCount || 0} transactions</div>
                </div>
              </div>
            ) : null}


            {/* Location Performance Cards */}
            <div className="companyDash__sectionHeader" style={{ marginTop: "24px" }}>
              <h2 className="companyDash__sectionTitle">Location Performance</h2>
            </div>

            {loadingMetrics ? (
              <div className="panelCard">
                <div className="emptyState">
                  <div className="emptyState__title">Loading metrics...</div>
                </div>
              </div>
            ) : locationMetrics.length === 0 ? (
              <div className="panelCard">
                <div className="emptyState">
                  <div className="emptyState__title">No location metrics available</div>
                  <div className="emptyState__sub">Metrics will appear once locations have activity</div>
                </div>
              </div>
            ) : (
              <div className="valet-location-metrics-grid">
                {locationMetrics.map((metric) => (
                  <div key={metric.locationId} className="valet-location-metric-card">
                    <div className="valet-location-metric-header">
                      <h3>{metric.locationName}</h3>
                    </div>
                    <div className="valet-location-metric-stats">
                      <div className="valet-location-metric-stat">
                        <div className="valet-location-metric-stat-label">Shift Revenue</div>
                        <div className="valet-location-metric-stat-value">{formatMoney(metric.totalRevenue || 0)}</div>
                      </div>
                      <div className="valet-location-metric-stat">
                        <div className="valet-location-metric-stat-label">Cars Received</div>
                        <div className="valet-location-metric-stat-value">{metric.carsReceived || 0}</div>
                      </div>
                      <div className="valet-location-metric-stat">
                        <div className="valet-location-metric-stat-label">Cars in Inventory</div>
                        <div className="valet-location-metric-stat-value">{metric.carsInInventory || 0}</div>
                      </div>
                    </div>
                    <div className="valet-location-metric-drivers">
                      <div className="valet-location-metric-drivers-label">Drivers on Shift ({metric.driverCount || 0})</div>
                      {metric.activeDrivers && metric.activeDrivers.length > 0 ? (
                        <div className="valet-location-metric-drivers-list">
                          {metric.activeDrivers.map((driver) => (
                            <div key={driver.id} className="valet-location-metric-driver">
                              <div className="valet-location-metric-driver-name">{driver.name || driver.email}</div>
                              {driver.phone && (
                                <div className="valet-location-metric-driver-phone">{driver.phone}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="valet-location-metric-drivers-empty">No drivers currently on shift</div>
                      )}
                    </div>

                    {/* Upcoming Cars Section */}
                    <div className="valet-location-upcoming-cars">
                      <div className="valet-location-upcoming-cars-header">
                        <div className="valet-location-upcoming-cars-label">Next Cars Arriving</div>
                        {metric.upcomingCars && metric.upcomingCars.length > 0 && (
                          <div className="valet-location-upcoming-cars-count">{metric.upcomingCars.length}</div>
                        )}
                      </div>
                      {metric.upcomingCars && metric.upcomingCars.length > 0 ? (
                        <div className="valet-location-upcoming-cars-list">
                          {metric.upcomingCars.map((car) => {
                            const arrivalTime = car.estimatedArrival?.toDate 
                              ? car.estimatedArrival.toDate() 
                              : new Date(car.estimatedArrival);
                            const timeStr = arrivalTime.toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            });
                            const dateStr = arrivalTime.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            });
                            
                            return (
                              <div key={car.id} className="valet-location-upcoming-car">
                                <div className="valet-location-upcoming-car-header">
                                  <div className="valet-location-upcoming-car-name">{car.dinerName}</div>
                                  <div className="valet-location-upcoming-car-time">
                                    {dateStr === new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }) 
                                      ? `Today ${timeStr}` 
                                      : `${dateStr} ${timeStr}`}
                                  </div>
                                </div>
                                <div className="valet-location-upcoming-car-details">
                                  <div className="valet-location-upcoming-car-plate">{car.carInfo?.licensePlate}</div>
                                  <div className="valet-location-upcoming-car-info">
                                    {car.carInfo?.color} {car.carInfo?.make} {car.carInfo?.model}
                                  </div>
                                </div>
                                {car.payment && car.payment.status === "succeeded" && (
                                  <div className="valet-location-upcoming-car-paid">✓ Paid</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="valet-location-upcoming-cars-empty">No upcoming arrivals</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pre-Bookings Section */}
            <div className="companyDash__sectionHeader" style={{ marginTop: "24px" }}>
              <h2 className="companyDash__sectionTitle">Recent Pre-Bookings</h2>
            </div>

            {loadingPreBookings ? (
              <div className="panelCard">
                <div className="emptyState">
                  <div className="emptyState__title">Loading pre-bookings...</div>
                </div>
              </div>
            ) : preBookings.length === 0 ? (
              <div className="panelCard">
                <div className="emptyState">
                  <div className="emptyState__title">No pre-bookings yet</div>
                  <div className="emptyState__sub">Pre-bookings with payment will appear here</div>
                </div>
              </div>
            ) : (
              <div className="valet-pre-bookings-list">
                {preBookings.slice(0, 10).map((booking) => (
                  <div key={booking.id} className="valet-pre-booking-card">
                    <div className="valet-pre-booking-header">
                      <div className="valet-pre-booking-title">
                        <strong>{booking.dinerName}</strong>
                        <span className="valet-pre-booking-status" data-status={booking.status}>
                          {booking.status === VALET_PRE_BOOKING_STATUS.PENDING && "Pending"}
                          {booking.status === VALET_PRE_BOOKING_STATUS.ARRIVED && "Arrived"}
                          {booking.status === VALET_PRE_BOOKING_STATUS.ACTIVE && "Active"}
                        </span>
                      </div>
                      {booking.payment && (
                        <div className="valet-pre-booking-payment">
                          <span className="valet-pre-booking-payment-amount">
                            ${(booking.payment.amount || 0).toFixed(2)}
                          </span>
                          <span className="valet-pre-booking-payment-status" data-status={booking.payment.status}>
                            {booking.payment.status === "succeeded" ? "✓ Paid" : booking.payment.status}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="valet-pre-booking-details">
                      <div className="valet-pre-booking-detail">
                        <span className="valet-pre-booking-detail-label">Location:</span>
                        <span className="valet-pre-booking-detail-value">
                          {booking.restaurantId ? "Restaurant" : booking.locationId || "Unknown"}
                        </span>
                      </div>
                      <div className="valet-pre-booking-detail">
                        <span className="valet-pre-booking-detail-label">Car:</span>
                        <span className="valet-pre-booking-detail-value">
                          {booking.carInfo?.licensePlate} - {booking.carInfo?.color} {booking.carInfo?.make} {booking.carInfo?.model}
                        </span>
                      </div>
                      {booking.estimatedArrival && (
                        <div className="valet-pre-booking-detail">
                          <span className="valet-pre-booking-detail-label">ETA:</span>
                          <span className="valet-pre-booking-detail-value">
                            {booking.estimatedArrival.toDate ? 
                              booking.estimatedArrival.toDate().toLocaleString() : 
                              new Date(booking.estimatedArrival).toLocaleString()}
                          </span>
                        </div>
                      )}
                      {booking.dinerPhone && (
                        <div className="valet-pre-booking-detail">
                          <span className="valet-pre-booking-detail-label">Phone:</span>
                          <span className="valet-pre-booking-detail-value">{booking.dinerPhone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === "financials" && (
          <section className="companyDash__panel" id="panel-financials" role="tabpanel">
            <div className="companyDash__sectionHeader">
              <h2 className="companyDash__sectionTitle">Financial Reports</h2>
              <div className="companyDash__sectionSubtitle">For tax and accounting purposes</div>
            </div>

            {loadingFinancials ? (
              <div className="panelCard">
                <div className="emptyState">
                  <div className="emptyState__title">Loading financial data...</div>
                </div>
              </div>
            ) : financials ? (
              <div className="valet-financial-periods-grid">
                <div className="valet-financial-period-card">
                  <div className="valet-financial-period-header">
                    <h3>This Week</h3>
                    <div className="valet-financial-period-date">
                      {financials.weekly?.startDate && financials.weekly?.endDate && (
                        <>
                          {new Date(financials.weekly.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} - {new Date(financials.weekly.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="valet-financial-period-metrics">
                    <div className="valet-financial-period-metric">
                      <div className="valet-financial-period-metric-label">Total Revenue</div>
                      <div className="valet-financial-period-metric-value">{formatMoney(financials.weekly?.totalRevenue || 0)}</div>
                    </div>
                    <div className="valet-financial-period-metric">
                      <div className="valet-financial-period-metric-label">Platform Fees</div>
                      <div className="valet-financial-period-metric-value">{formatMoney(financials.weekly?.totalPlatformFees || 0)}</div>
                    </div>
                    <div className="valet-financial-period-metric">
                      <div className="valet-financial-period-metric-label">Company Amount</div>
                      <div className="valet-financial-period-metric-value valet-financial-period-metric-value--primary">{formatMoney(financials.weekly?.totalCompanyAmount || 0)}</div>
                    </div>
                    <div className="valet-financial-period-metric">
                      <div className="valet-financial-period-metric-label">Transactions</div>
                      <div className="valet-financial-period-metric-value">{financials.weekly?.transactionCount || 0}</div>
                    </div>
                  </div>
                </div>

                <div className="valet-financial-period-card">
                  <div className="valet-financial-period-header">
                    <h3>This Month</h3>
                    <div className="valet-financial-period-date">
                      {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </div>
                  </div>
                  <div className="valet-financial-period-metrics">
                    <div className="valet-financial-period-metric">
                      <div className="valet-financial-period-metric-label">Total Revenue</div>
                      <div className="valet-financial-period-metric-value">{formatMoney(financials.monthly?.totalRevenue || 0)}</div>
                    </div>
                    <div className="valet-financial-period-metric">
                      <div className="valet-financial-period-metric-label">Platform Fees</div>
                      <div className="valet-financial-period-metric-value">{formatMoney(financials.monthly?.totalPlatformFees || 0)}</div>
                    </div>
                    <div className="valet-financial-period-metric">
                      <div className="valet-financial-period-metric-label">Company Amount</div>
                      <div className="valet-financial-period-metric-value valet-financial-period-metric-value--primary">{formatMoney(financials.monthly?.totalCompanyAmount || 0)}</div>
                    </div>
                    <div className="valet-financial-period-metric">
                      <div className="valet-financial-period-metric-label">Transactions</div>
                      <div className="valet-financial-period-metric-value">{financials.monthly?.transactionCount || 0}</div>
                    </div>
                  </div>
                </div>

                <div className="valet-financial-period-card">
                  <div className="valet-financial-period-header">
                    <h3>This Year</h3>
                    <div className="valet-financial-period-date">
                      {new Date().getFullYear()}
                    </div>
                  </div>
                  <div className="valet-financial-period-metrics">
                    <div className="valet-financial-period-metric">
                      <div className="valet-financial-period-metric-label">Total Revenue</div>
                      <div className="valet-financial-period-metric-value">{formatMoney(financials.yearly?.totalRevenue || 0)}</div>
                    </div>
                    <div className="valet-financial-period-metric">
                      <div className="valet-financial-period-metric-label">Platform Fees</div>
                      <div className="valet-financial-period-metric-value">{formatMoney(financials.yearly?.totalPlatformFees || 0)}</div>
                    </div>
                    <div className="valet-financial-period-metric">
                      <div className="valet-financial-period-metric-label">Company Amount</div>
                      <div className="valet-financial-period-metric-value valet-financial-period-metric-value--primary">{formatMoney(financials.yearly?.totalCompanyAmount || 0)}</div>
                    </div>
                    <div className="valet-financial-period-metric">
                      <div className="valet-financial-period-metric-label">Transactions</div>
                      <div className="valet-financial-period-metric-value">{financials.yearly?.transactionCount || 0}</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="panelCard">
                <div className="emptyState">
                  <div className="emptyState__title">No financial data available</div>
                  <div className="emptyState__sub">Financial data will appear once payments are processed</div>
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === "locations" && (
          <section className="companyDash__panel" id="panel-locations" role="tabpanel">
            <div className="companyDash__sectionHeader">
              <h2 className="companyDash__sectionTitle">Locations</h2>
              <button className="companyDash__btn companyDash__btn--primary" onClick={() => setShowAddLocationForm(!showAddLocationForm)}>
                {showAddLocationForm ? "Cancel" : "+ Add Location"}
              </button>
            </div>

            {showAddLocationForm && (
              <div className="panelCard">
                <form onSubmit={handleAddLocation} className="valet-company-location-form">
                  <div className="valet-company-form-group">
                    <label>Location Name *</label>
                    <input type="text" value={newLocation.name} onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })} required placeholder="Bravo Kitchen" />
                  </div>

                  <div className="valet-company-form-group">
                    <label>Location Type *</label>
                    <select value={newLocation.type} onChange={(e) => setNewLocation({ ...newLocation, type: e.target.value })} required>
                      <option value="restaurant">Restaurant</option>
                      <option value="venue">Venue</option>
                      <option value="nightclub">Nightclub</option>
                      <option value="event">Event</option>
                      <option value="other">Other</option>
                    </select>
                    {newLocation.type !== "restaurant" && company.plan === VALET_COMPANY_PLAN.FREE && (
                      <p className="valet-company-upgrade-hint">⚠️ Non-restaurant locations require a paid plan</p>
                    )}
                  </div>

                  {newLocation.type === "restaurant" && (
                    <div className="valet-company-form-group">
                      <label>Restaurant</label>
                      <select value={newLocation.restaurantId} onChange={(e) => setNewLocation({ ...newLocation, restaurantId: e.target.value })}>
                        <option value="">Select Restaurant</option>
                        {restaurants.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="valet-company-form-group">
                    <label>Address</label>
                    <input type="text" value={newLocation.address} onChange={(e) => setNewLocation({ ...newLocation, address: e.target.value })} placeholder="123 Main St, City, State ZIP" />
                  </div>

                  <div className="valet-company-form-row">
                    <div className="valet-company-form-group">
                      <label>Latitude *</label>
                      <input type="number" step="any" value={newLocation.lat} onChange={(e) => setNewLocation({ ...newLocation, lat: e.target.value })} required placeholder="30.2672" />
                    </div>
                    <div className="valet-company-form-group">
                      <label>Longitude *</label>
                      <input type="number" step="any" value={newLocation.lng} onChange={(e) => setNewLocation({ ...newLocation, lng: e.target.value })} required placeholder="-97.7431" />
                    </div>
                  </div>

                  <button type="submit" className="companyDash__btn companyDash__btn--primary">Add Location</button>
                </form>
              </div>
            )}

            {locations.length === 0 ? (
              <div className="panelCard">
                <div className="emptyState">
                  <div className="emptyState__title">No locations added yet</div>
                  <div className="emptyState__sub">Add your first location to get started</div>
                </div>
              </div>
            ) : (
              <div className="valet-locations-grid">
                {locations.map((location) => (
                  <div key={location.id} className="valet-location-card">
                    <div className="valet-location-card-header">
                      <div>
                        <h3>{location.name}</h3>
                        <p className="valet-company-location-type">{location.type}</p>
                        {location.address && <p className="valet-company-location-address">{location.address}</p>}
                      </div>
                      <button className="companyDash__btn companyDash__btn--danger" onClick={() => handleRemoveLocation(location.id)}>
                        Remove
                      </button>
                    </div>
                    <div className="valet-location-card-stats">
                      <div className="valet-location-stat">
                        <span className="valet-location-stat-label">Drivers</span>
                        <span className="valet-location-stat-value">{location.driverCount || 0}</span>
                      </div>
                    </div>
                    <button className="companyDash__btn companyDash__btn--secondary" onClick={() => { setSelectedLocation(location); setActiveTab("drivers"); }}>
                      Manage Location
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === "hr" && (
          <section className="companyDash__panel" id="panel-hr" role="tabpanel">
            <div className="companyDash__sectionHeader">
              <h2 className="companyDash__sectionTitle">HR Management</h2>
              <div className="companyDash__sectionSubtitle">Manage driver schedules, time off requests, and complaints</div>
            </div>

            {/* Schedule Requests Section */}
            <div className="companyDash__sectionHeader" style={{ marginTop: "24px" }}>
              <h3 className="companyDash__sectionTitle" style={{ fontSize: "18px" }}>Schedule Requests</h3>
            </div>
            <div className="panelCard">
              <div className="emptyState">
                <div className="emptyState__title">Schedule Request System</div>
                <div className="emptyState__sub">Schedule requests from drivers will appear here. Drivers can request specific shifts or time off through their dashboard.</div>
                <p style={{ marginTop: "16px", color: "rgba(255,255,255,0.7)", fontSize: "14px" }}>
                  This feature allows drivers to submit schedule change requests, which you can approve or deny.
                </p>
              </div>
            </div>

            {/* Time Off Requests Section */}
            <div className="companyDash__sectionHeader" style={{ marginTop: "24px" }}>
              <h3 className="companyDash__sectionTitle" style={{ fontSize: "18px" }}>Time Off Requests</h3>
            </div>
            <div className="panelCard">
              <div className="emptyState">
                <div className="emptyState__title">Time Off Management</div>
                <div className="emptyState__sub">Time off requests from drivers will appear here. Review and approve or deny requests.</div>
                <p style={{ marginTop: "16px", color: "rgba(255,255,255,0.7)", fontSize: "14px" }}>
                  Drivers can request time off through their dashboard, and you'll receive notifications for pending requests.
                </p>
              </div>
            </div>

            {/* Driver Complaints Section */}
            <div className="companyDash__sectionHeader" style={{ marginTop: "24px" }}>
              <h3 className="companyDash__sectionTitle" style={{ fontSize: "18px" }}>Driver Complaints</h3>
            </div>
            <div className="panelCard">
              <div className="emptyState">
                <div className="emptyState__title">Complaint Management</div>
                <div className="emptyState__sub">Complaints from diners about drivers will appear here. Review complaints and take appropriate action.</div>
                <p style={{ marginTop: "16px", color: "rgba(255,255,255,0.7)", fontSize: "14px" }}>
                  When diners submit complaints about driver behavior or service quality, they will be displayed here for review.
                </p>
              </div>
            </div>

            {/* Driver Management Section */}
            <div className="companyDash__sectionHeader" style={{ marginTop: "24px" }}>
              <h3 className="companyDash__sectionTitle" style={{ fontSize: "18px" }}>
                {selectedLocation ? `Drivers - ${selectedLocation.name}` : "All Drivers"}
              </h3>
              {selectedLocation && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <button className="companyDash__btn companyDash__btn--secondary" onClick={() => setSelectedLocation(null)}>
                    View All
                  </button>
                  <button className="companyDash__btn companyDash__btn--primary" onClick={() => setShowAddDriverForm(!showAddDriverForm)}>
                    {showAddDriverForm ? "Cancel" : "+ Add Driver"}
                  </button>
                </div>
              )}
            </div>

            {!selectedLocation && (
              <div className="panelCard">
                <p style={{ marginBottom: "16px" }}>Select a location from the Locations tab to manage its drivers, or view all drivers below.</p>
                <div className="valet-drivers-list">
                  {locations.map((loc) => {
                    const drivers = locationDrivers.filter(d => d.locationId === loc.id);
                    return (
                      <div key={loc.id} className="valet-driver-location-group">
                        <h4>{loc.name} ({drivers.length} drivers)</h4>
                        {drivers.length === 0 ? (
                          <p>No drivers assigned</p>
                        ) : (
                          <div className="valet-drivers-grid">
                            {drivers.map((driver) => (
                              <div key={driver.id} className="valet-driver-card">
                                <div className="valet-driver-card-name">{driver.name || driver.email}</div>
                                <div className="valet-driver-card-email">{driver.email}</div>
                                <div className="valet-driver-card-phone">{driver.phone || "No phone"}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedLocation && (
              <>
                {showAddDriverForm && (
                  <div className="panelCard">
                    <form onSubmit={handleAddDriver} className="valet-company-location-form">
                      <div className="valet-company-form-group">
                        <label>Driver Name *</label>
                        <input type="text" value={newDriver.name} onChange={(e) => setNewDriver({ ...newDriver, name: e.target.value })} required />
                      </div>
                      <div className="valet-company-form-group">
                        <label>Email *</label>
                        <input type="email" value={newDriver.email} onChange={(e) => setNewDriver({ ...newDriver, email: e.target.value })} required />
                      </div>
                      <div className="valet-company-form-group">
                        <label>Phone</label>
                        <input type="tel" value={newDriver.phone} onChange={(e) => setNewDriver({ ...newDriver, phone: e.target.value })} />
                      </div>
                      <button type="submit" className="companyDash__btn companyDash__btn--primary">Add Driver</button>
                    </form>
                  </div>
                )}

                <div className="panelCard">
                  <h3>Drivers at {selectedLocation.name}</h3>
                  {locationDrivers.length === 0 ? (
                    <div className="emptyState">
                      <div className="emptyState__title">No drivers assigned to this location</div>
                      <div className="emptyState__sub">Add drivers using the form above</div>
                    </div>
                  ) : (
                    <div className="valet-drivers-grid">
                      {locationDrivers.map((driver) => (
                        <div key={driver.id} className="valet-driver-card">
                          <div className="valet-driver-card-name">{driver.name || driver.email}</div>
                          <div className="valet-driver-card-email">{driver.email}</div>
                          <div className="valet-driver-card-phone">{driver.phone || "No phone"}</div>
                          <button className="companyDash__btn companyDash__btn--danger" style={{ marginTop: "8px" }} onClick={() => handleRemoveDriver(driver.userId || driver.id)}>
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        )}

        {activeTab === "claims" && (
          <section className="companyDash__panel" id="panel-claims" role="tabpanel">
            <div className="companyDash__sectionHeader">
              <h2 className="companyDash__sectionTitle">Claims Management</h2>
              <div className="companyDash__sectionSubtitle">Review and manage claims submitted by diners</div>
            </div>
            <ClaimsTab valetCompanyId={companyId} />
          </section>
        )}

        {activeTab === "settings" && (
          <section className="companyDash__panel" id="panel-settings" role="tabpanel">
            <div className="companyDash__sectionHeader">
              <h2 className="companyDash__sectionTitle">Company Settings</h2>
            </div>
            <div className="panelCard">
              <h3>Company Information</h3>
              <p><strong>Name:</strong> {company.name}</p>
              <p><strong>Contact:</strong> {company.contactName}</p>
              <p><strong>Email:</strong> {company.contactEmail}</p>
              <p><strong>Plan:</strong> {company.plan === VALET_COMPANY_PLAN.PAID ? "Paid" : "Free"}</p>
              {company.plan === VALET_COMPANY_PLAN.FREE && (
                <div className="valet-company-upgrade-card" style={{ marginTop: "16px" }}>
                  <h3>Upgrade to Paid Plan</h3>
                  <p>Unlock the ability to add non-restaurant locations (venues, nightclubs, events, etc.)</p>
                  <button className="companyDash__btn companyDash__btn--primary" onClick={() => setShowUpgradeModal(true)}>
                    Upgrade Now
                  </button>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {showUpgradeModal && (
        <div className="valet-company-modal-overlay" onClick={() => setShowUpgradeModal(false)}>
          <div className="valet-company-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Upgrade to Paid Plan</h2>
            <p>To add non-restaurant locations (venues, nightclubs, events, etc.), you need to upgrade to a paid plan.</p>
            <div className="valet-company-modal-actions">
              <button className="companyDash__btn companyDash__btn--secondary" onClick={() => setShowUpgradeModal(false)}>Cancel</button>
              <button className="companyDash__btn companyDash__btn--primary" onClick={handleUpgrade}>Upgrade Now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
