// src/pages/Dashboards/ValetDriverDashboard/ValetDriverDashboard.jsx
//
// VALET DRIVER DASHBOARD
//
// Dashboard for valet drivers - matches Employee Dashboard structure

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../hooks/services/firebase";
// Valet-specific imports can be added here if needed for future features
import ValetTimeClock from "./ValetTimeClock";
import EmployeeBlastModal from "../../../components/EmployeeBlast/EmployeeBlastModal";
import WeeklyTotalsCard from "../../../components/WeeklyTotalsCard";
import TipShareWallet from "../../../components/TipShareWallet";
import BadgeGallery from "../../../components/BadgeGallery";
import NotificationBell from "../../../components/NotificationBell";
import MessageCenter from "../../../components/MessageCenter";
import LineupPointsModule from "../EmployeeDashboard/LineupPointsModule";
import HRInfoModule from "../../../pages/Dashboards/EmployeeDashboard/HRInfoModule";
import AlertsAndRemindersModule from "../../../pages/Dashboards/EmployeeDashboard/AlertsAndRemindersModule";
import HRTab from "../../../pages/Dashboards/EmployeeDashboard/HRTab";
import PerformanceTab from "../../../pages/Dashboards/EmployeeDashboard/PerformanceTab";
import MessagingTab from "../../../pages/Dashboards/EmployeeDashboard/MessagingTab";
import { getEmployeeDocuments, uploadDocument } from "../../../utils/documentService";
import { getUserNotifications } from "../../../utils/notificationService";
import { getUpcomingPreBookingsForLocation } from "../../../utils/valetPreBookingService";
import "./ValetDriverDashboard.css";

export default function ValetDriverDashboard() {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser, loading: authLoading } = useAuth();
  const isTestMode = searchParams.get("test") === "true";
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [valetCompanyId, setValetCompanyId] = useState(null);
  const [userData, setUserData] = useState(null);
  const [showBlastModal, setShowBlastModal] = useState(false);
  const [restaurantName, setRestaurantName] = useState("");
  const [profilePictureURL, setProfilePictureURL] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [upcomingCars, setUpcomingCars] = useState([]);
  const [showAllCars, setShowAllCars] = useState(false);
  const [loadingUpcomingCars, setLoadingUpcomingCars] = useState(false);

  const tabs = [
    { key: "overview", label: "Overview", icon: "📊" },
    { key: "hr", label: "HR", icon: "👔" },
    { key: "tipshare", label: "TipShare", icon: "tipshare", isTipshareLogo: true },
    { key: "badges", label: "Badges", icon: "🏆" },
    { key: "performance", label: "Performance", icon: "📈" },
    { key: "messaging", label: "Messaging", icon: "💬" },
  ];

  const DOCUMENT_TYPES = [
    "I-9",
    "W-4",
    "Direct Deposit",
    "Emergency Contact",
    "Legal ID",
    "Social Security Card",
    "Orientation Video",
    "Safety Training",
  ];

  useEffect(() => {
    if (!currentUser || !restaurantId) {
      navigate("/login");
      return;
    }

    // Check if user is a valet driver (skip in test mode)
    if (!isTestMode && currentUser.role !== "VALET") {
      alert("Access denied. This dashboard is for valet drivers only.");
      navigate("/");
      return;
    }

    loadData();
  }, [currentUser, restaurantId, navigate, isTestMode]);

  const loadUpcomingCars = useCallback(async () => {
    if (!valetCompanyId || !restaurantId) return;
    
    try {
      setLoadingUpcomingCars(true);
      const limit = showAllCars ? 50 : 3;
      const cars = await getUpcomingPreBookingsForLocation(valetCompanyId, restaurantId, null, limit);
      setUpcomingCars(cars);
    } catch (error) {
      console.error("Error loading upcoming cars:", error);
      setUpcomingCars([]);
    } finally {
      setLoadingUpcomingCars(false);
    }
  }, [valetCompanyId, restaurantId, showAllCars]);

  useEffect(() => {
    if (valetCompanyId && restaurantId) {
      loadUpcomingCars();
    }
  }, [valetCompanyId, restaurantId, loadUpcomingCars]);

  const loadData = useCallback(async () => {
    if (authLoading) {
      return;
    }

    setLoading(true);
    try {
      // Load user data to get valet company ID
      const userRef = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        setUserData(userData);
        setUserProfile(userData);
        setProfilePictureURL(userData.imageURL || userData.profilePictureURL || null);
        const companyId = userData.valetCompanyId || userData.organization;
        setValetCompanyId(companyId);
        
        // If no valet company ID found, try to get it from valetCompanies/{companyId}/drivers/{driverId}
        if (!companyId) {
          const valetCompaniesRef = collection(db, "valetCompanies");
          const companiesSnap = await getDocs(valetCompaniesRef);
          for (const companyDoc of companiesSnap.docs) {
            const companyData = companyDoc.data();
            if (companyData.drivers && companyData.drivers.includes(currentUser.uid)) {
              setValetCompanyId(companyDoc.id);
              break;
            }
          }
        }
      } else if (isTestMode) {
        // In test mode, create a basic user profile if it doesn't exist
        await setDoc(userRef, {
          role: "VALET",
          name: currentUser.displayName || "Test Valet Driver",
          email: currentUser.email || "",
          restaurantId: restaurantId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
        setUserData({
          role: "VALET",
          name: currentUser.displayName || "Test Valet Driver",
          email: currentUser.email || "",
          restaurantId: restaurantId,
        });
        setUserProfile({
          role: "VALET",
          name: currentUser.displayName || "Test Valet Driver",
          email: currentUser.email || "",
          restaurantId: restaurantId,
        });
      }

      // Load restaurant name
      try {
        const restaurantRef = doc(db, "restaurants", restaurantId);
        const restaurantSnap = await getDoc(restaurantRef);
        if (restaurantSnap.exists()) {
          setRestaurantName(restaurantSnap.data().name || restaurantId);
        }
      } catch (error) {
        console.warn("Error loading restaurant name:", error);
      }

      // Load notifications
      try {
        const notifs = await getUserNotifications(currentUser.uid);
        // Notifications loaded but not displayed in current tabs
      } catch (error) {
        console.warn("Error loading notifications:", error);
        if (!isTestMode) throw error;
      }

      // Load documents
      try {
        const docs = await getEmployeeDocuments(currentUser.uid, restaurantId);
        setDocuments(docs);
      } catch (error) {
        console.warn("Error loading documents:", error);
        setDocuments([]);
      }

      // Real-time listeners can be added here if needed for future features
    } catch (error) {
      console.error("Error loading valet driver data:", error);
    } finally {
      setLoading(false);
    }
  }, [currentUser, restaurantId, authLoading, isTestMode]);

  useEffect(() => {
    if (!authLoading) {
      loadData();
    }
  }, [loadData, authLoading]);

  const handleDocumentUpload = async (file, documentType) => {
    if (!file || !documentType || !currentUser?.uid) {
      return;
    }

    try {
      await uploadDocument({
        employeeUid: currentUser.uid,
        restaurantId,
        documentType,
        file,
      });
      
      const docs = await getEmployeeDocuments(currentUser.uid, restaurantId);
      setDocuments(docs);
      setShowUploadModal(false);
      setSelectedDocType(null);
      
      // Notifications loaded for future use
      await getUserNotifications(currentUser.uid);
    } catch (err) {
      console.error("Error uploading document:", err);
      alert(`Upload failed: ${err.message}`);
    }
  };

  // Valet-specific handlers can be added here if needed for future features

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return (
          <div className="ed-overview-grid">
            {/* Alerts & Reminders - TOP PRIORITY */}
            {currentUser?.uid && (
              <div className="ed-card-alerts" style={{ gridColumn: "1 / -1" }}>
                <AlertsAndRemindersModule
                  employeeUid={currentUser.uid}
                  restaurantId={restaurantId}
                />
              </div>
            )}

            {/* Time Clock - Second Priority */}
            {currentUser?.uid && (
              <div className="ed-card ed-card-timeclock" style={{ gridColumn: "1 / -1" }}>
                <div className="ed-card-header">
                  <h3>Time Clock</h3>
                </div>
                <div className="ed-card-body">
                  <ValetTimeClock
                    driverId={currentUser.uid}
                    valetCompanyId={valetCompanyId}
                    restaurantId={restaurantId}
                  />
                </div>
              </div>
            )}

            {/* Weekly Totals Card - Third */}
            {currentUser?.uid && (
              <div style={{ gridColumn: "1 / -1" }}>
                <WeeklyTotalsCard
                  employeeId={currentUser.uid}
                  restaurantId={restaurantId}
                />
              </div>
            )}

            {/* Upcoming Cars */}
            {currentUser?.uid && valetCompanyId && restaurantId && (
              <div className="ed-card" style={{ gridColumn: "1 / -1" }}>
                <div className="ed-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3>Next Cars Arriving</h3>
                  {upcomingCars.length > 3 && (
                    <button
                      className="ed-card-header-action"
                      onClick={() => setShowAllCars(!showAllCars)}
                      style={{ fontSize: "12px", padding: "4px 8px", background: "rgba(59, 130, 246, 0.2)", border: "1px solid rgba(59, 130, 246, 0.3)", color: "#3b82f6", borderRadius: "4px", cursor: "pointer" }}
                    >
                      {showAllCars ? "Show Less" : `See All (${upcomingCars.length})`}
                    </button>
                  )}
                </div>
                <div className="ed-card-body">
                  {loadingUpcomingCars ? (
                    <div style={{ padding: "20px", textAlign: "center", color: "rgba(255,255,255,0.6)" }}>
                      Loading upcoming cars...
                    </div>
                  ) : upcomingCars.length === 0 ? (
                    <div style={{ padding: "20px", textAlign: "center", color: "rgba(255,255,255,0.6)" }}>
                      No upcoming arrivals
                    </div>
                  ) : (
                    <div className="valet-driver-upcoming-cars-list">
                      {upcomingCars.map((car) => {
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
                          <div key={car.id} className="valet-driver-upcoming-car">
                            <div className="valet-driver-upcoming-car-header">
                              <div className="valet-driver-upcoming-car-name">{car.dinerName}</div>
                              <div className="valet-driver-upcoming-car-time">
                                {dateStr === new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }) 
                                  ? `Today ${timeStr}` 
                                  : `${dateStr} ${timeStr}`}
                              </div>
                            </div>
                            <div className="valet-driver-upcoming-car-details">
                              <div className="valet-driver-upcoming-car-plate">{car.carInfo?.licensePlate}</div>
                              <div className="valet-driver-upcoming-car-info">
                                {car.carInfo?.color} {car.carInfo?.make} {car.carInfo?.model}
                              </div>
                            </div>
                            {car.payment && car.payment.status === "succeeded" && (
                              <div className="valet-driver-upcoming-car-paid">✓ Paid</div>
                            )}
                            {car.dinerPhone && (
                              <div className="valet-driver-upcoming-car-phone">{car.dinerPhone}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Row 3: Messages */}
            {currentUser?.uid && (
              <div className="ed-card" style={{ gridColumn: "1 / -1" }}>
                <MessageCenter
                  employeeUid={currentUser.uid}
                  restaurantId={restaurantId}
                  employeeName={userData?.name || currentUser.displayName}
                />
              </div>
            )}

            {/* Row 4: Quick Info | Recent Badges | Lineup Points */}
            {currentUser?.uid && (
              <>
                {/* Quick Info */}
                <div className="ed-card">
                  <div className="ed-card-header">
                    <h3>Quick Info</h3>
                  </div>
                  <div className="ed-card-body">
                    <div className="ed-info-row">
                      <span className="ed-info-label">Name</span>
                      <span className="ed-info-value">{userData?.name || currentUser.displayName || "—"}</span>
                    </div>
                    <div className="ed-info-row">
                      <span className="ed-info-label">Role</span>
                      <span className="ed-info-value">Valet Driver</span>
                    </div>
                    <div className="ed-info-row">
                      <span className="ed-info-label">Status</span>
                      <span className="ed-info-value">{userData?.status || "Active"}</span>
                    </div>
                    <div className="ed-info-row">
                      <span className="ed-info-label">Restaurant</span>
                      <span className="ed-info-value">{restaurantName || restaurantId}</span>
                    </div>
                    {valetCompanyId && (
                      <div className="ed-info-row">
                        <span className="ed-info-label">Valet Company</span>
                        <span className="ed-info-value">{valetCompanyId}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Recent Badges */}
                <div className="ed-card">
                  <div className="ed-card-header">
                    <h3>Recent Badges</h3>
                  </div>
                  <div className="ed-card-body">
                    <div className="ed-badges-preview">
                      <BadgeGallery
                        userId={currentUser.uid}
                        restaurantId={restaurantId}
                        viewMode="employee"
                        maxDisplay={6}
                      />
                    </div>
                  </div>
                </div>

                {/* Lineup Points Module */}
                <div className="ed-card">
                  <LineupPointsModule
                    employeeUid={currentUser.uid}
                    restaurantId={restaurantId}
                  />
                </div>
              </>
            )}
          </div>
        );

      case "hr":
        return (
          <div>
            {currentUser?.uid ? (
              <HRTab
                employeeUid={currentUser.uid}
                restaurantId={restaurantId}
                employeeName={userData?.name || currentUser.displayName}
                employeeData={userData}
                userProfile={userProfile}
                employmentHistory={userProfile?.employment || null}
                onboardingPackage={null}
                documents={documents}
                onUploadDocument={handleDocumentUpload}
                showUploadModal={showUploadModal}
                setShowUploadModal={setShowUploadModal}
                selectedDocType={selectedDocType}
                setSelectedDocType={setSelectedDocType}
                DOCUMENT_TYPES={DOCUMENT_TYPES}
              />
            ) : (
              <div className="ed-empty-state">
                <h3>Human Resources</h3>
                <p>Please <Link to="/login" style={{ color: "#3b82f6" }}>log in</Link> to access HR resources.</p>
              </div>
            )}
          </div>
        );

      case "tipshare":
        return (
          <div>
            {currentUser?.uid ? (
              <TipShareWallet
                employeeId={currentUser.uid}
                restaurantId={restaurantId}
                userRole={userProfile?.role || userData?.role || "VALET"}
              />
            ) : (
              <div className="ed-empty-state">
                <h3>TipShare Account</h3>
                <p>Please <Link to="/login" style={{ color: "#3b82f6" }}>log in</Link> to access your TipShare account.</p>
              </div>
            )}
          </div>
        );

      case "badges":
        return (
          <div className="ed-badges-tab">
            <div className="ed-badges-tab-header">
              <h2>My Badges</h2>
            </div>
            <div className="ed-badges-tab-content">
              {currentUser?.uid ? (
                <BadgeGallery
                  userId={currentUser.uid}
                  restaurantId={restaurantId}
                  viewMode="all"
                  showEmpty={true}
                />
              ) : (
                <div className="ed-empty-state">
                  <p>Please <Link to="/login" style={{ color: "#3b82f6" }}>log in</Link> to view your badges.</p>
                </div>
              )}
            </div>
          </div>
        );

      case "performance":
        return (
          <div>
            {currentUser?.uid ? (
              <PerformanceTab
                employeeUid={currentUser.uid}
                restaurantId={restaurantId}
                employeeName={userData?.name || currentUser.displayName}
              />
            ) : (
              <div className="ed-empty-state">
                <h3>Performance</h3>
                <p>Please <Link to="/login" style={{ color: "#3b82f6" }}>log in</Link> to view your performance metrics.</p>
              </div>
            )}
          </div>
        );

      case "messaging":
        return (
          <div>
            {currentUser?.uid ? (
              <MessagingTab
                employeeUid={currentUser.uid}
                restaurantId={restaurantId}
                employeeName={userData?.name || currentUser.displayName}
              />
            ) : (
              <div className="ed-empty-state">
                <h3>Messaging</h3>
                <p>Please <Link to="/login" style={{ color: "#3b82f6" }}>log in</Link> to access messaging.</p>
              </div>
            )}
          </div>
        );

      default:
        return <div>Tab not found</div>;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="ed-page" style={{ minHeight: "100vh", background: "radial-gradient(circle at center, #001836 0%, #000c1b 100%)", padding: 40, color: "#fff" }}>
        <div className="ed-container">
          <div className="ed-loading" style={{ textAlign: "center", fontSize: 18, color: "#fff" }}>Loading your dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="ed-page">
      <Link to="/" className="ed-back-link-top">← Back</Link>
      <div className="ed-container">
        {/* ================= HEADER ================= */}
        <div className="ed-header">
          <div className="ed-header-left">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {profilePictureURL && (
                <img 
                  src={profilePictureURL} 
                  alt="Profile" 
                  className="ed-header-profile-pic"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              )}
              <div>
                <h1>Valet Driver Dashboard</h1>
                <div className="ed-subtitle">
                  {userData?.name || currentUser.displayName || "Valet Driver"} • {restaurantName || restaurantId}
                </div>
              </div>
            </div>
          </div>
          <div className="ed-header-right">
            <NotificationBell />
          </div>
        </div>

        {/* ================= TABS ================= */}
        <div className="ed-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`ed-tab ${activeTab === tab.key ? "ed-tab-active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.isTipshareLogo ? (
                <div className="ed-tab-tipshare-logo">
                  TIP<span className="ed-tab-tipshare-dollar">$</span>HARE
                </div>
              ) : (
                <>
                  {tab.icon && <span className="ed-tab-icon">{tab.icon}</span>}
                  <span>{tab.label}</span>
                </>
              )}
            </button>
          ))}
        </div>

        {/* ================= TAB CONTENT ================= */}
        <div className="ed-content">
          {renderTabContent()}
        </div>
      </div>

      {/* Employee Blast Modal */}
      {showBlastModal && (
        <EmployeeBlastModal
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          onClose={() => setShowBlastModal(false)}
        />
      )}
    </div>
  );
}
