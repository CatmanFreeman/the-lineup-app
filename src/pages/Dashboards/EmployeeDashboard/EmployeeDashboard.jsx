// src/pages/Dashboards/EmployeeDashboard/EmployeeDashboard.jsx

import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../../hooks/services/firebase";
import TimeClock from "./TimeClock";
import PointsDisplay from "../../../components/PointsDisplay";
import BadgeGallery from "../../../components/BadgeGallery";
import NotificationBell from "../../../components/NotificationBell";
import WeeklyTotalsCard from "../../../components/WeeklyTotalsCard";
import TipShareWallet from "../../../components/TipShareWallet";
import EmploymentHistory from "../../../components/EmploymentHistory";
import { getEmployeeDocuments, uploadDocument } from "../../../utils/documentService";
import { getUserNotifications } from "../../../utils/notificationService";
import "./EmployeeDashboard.css";
import ScheduleTab from "./ScheduleTab";
import PerformanceTab from "./PerformanceTab";
import CurrentShiftGame from "../../../components/CurrentSiftGame";
import MessageCenter from "../../../components/MessageCenter";
import SkillsExperience from "../../../components/SkillsExperience";
import QuickActionsTab from "./QuickActionsTab";
import HRTab from "./HRTab";
import AlertsAndRemindersModule from "./AlertsAndRemindersModule";
import HRInfoModule from "./HRInfoModule";
import MessagingTab from "./MessagingTab";
import LineupPointsModule from "./LineupPointsModule";
import EmployeeBlastModal from "../../../components/EmployeeBlast/EmployeeBlastModal";
import "./EmployeeDashboard.css";

export default function EmployeeDashboard() {
  console.log("EmployeeDashboard: Component rendering");
  
  const { restaurantId } = useParams();
  console.log("EmployeeDashboard: restaurantId =", restaurantId);
  
  const { currentUser, loading: authLoading } = useAuth();
  console.log("EmployeeDashboard: authLoading =", authLoading, "currentUser =", currentUser);
  
  const employeeUid = currentUser?.uid;
  
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [employeeData, setEmployeeData] = useState(null);
  const [onboardingPackage, setOnboardingPackage] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const [demoMode, setDemoMode] = useState(false);
  const [employmentHistory, setEmploymentHistory] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [profilePictureURL, setProfilePictureURL] = useState(null);
  const [showBlastModal, setShowBlastModal] = useState(false);
  const [restaurantName, setRestaurantName] = useState("");

  // ================= LOAD EMPLOYEE DATA =================
  const loadEmployeeData = useCallback(async () => {
    // Wait for auth to load
    if (authLoading) {
      return;
    }

    // If not logged in, use demo mode
    if (!currentUser) {
      console.log("EmployeeDashboard: No user logged in, using demo mode");
      setDemoMode(true);
      setEmployeeData({
        uid: "demo-user",
        id: "demo-user",
        name: "Demo Employee",
        role: "Server",
        status: "active",
      });
      setLoading(false);
      return;
    }

    if (!restaurantId) {
      console.warn("EmployeeDashboard: No restaurantId provided");
      setLoading(false);
      return;
    }

    setLoading(true);
    setDebugInfo(null);
    setDemoMode(false);

    try {
      // Load user profile for employment history first
      try {
        const userRef = doc(db, "users", employeeUid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setUserProfile(userData);
          setEmploymentHistory(userData.employment || null);
          
          // Load profile picture from user document or Firebase Auth
          // Priority: userData.imageURL > currentUser.photoURL
          const photoURL = userData.imageURL || currentUser.photoURL || null;
          console.log("EmployeeDashboard: Profile picture URL from user doc:", photoURL);
          console.log("EmployeeDashboard: userData.imageURL:", userData.imageURL);
          console.log("EmployeeDashboard: currentUser.photoURL:", currentUser.photoURL);
          setProfilePictureURL(photoURL);
        } else {
          // Fallback to Firebase Auth photoURL
          console.log("EmployeeDashboard: User doc not found, using Firebase Auth photoURL:", currentUser.photoURL);
          setProfilePictureURL(currentUser.photoURL || null);
        }
      } catch (userErr) {
        console.warn("Failed to load user profile:", userErr);
        // Fallback to Firebase Auth photoURL
        setProfilePictureURL(currentUser?.photoURL || null);
      }

      // Load restaurant name
      try {
        const restaurantRef = doc(db, "restaurants", restaurantId);
        const restaurantSnap = await getDoc(restaurantRef);
        if (restaurantSnap.exists()) {
          setRestaurantName(restaurantSnap.data().name || "");
        }
      } catch (restErr) {
        console.warn("Failed to load restaurant name:", restErr);
      }

      const path = `restaurants/${restaurantId}/staff/${employeeUid}`;
      console.log("EmployeeDashboard: Loading from:", path);
      console.log("EmployeeDashboard: User UID:", employeeUid);
      console.log("EmployeeDashboard: Restaurant ID:", restaurantId);

      // Try loading employee from staff collection
      const staffRef = doc(db, "restaurants", restaurantId, "staff", employeeUid);
      const staffSnap = await getDoc(staffRef);
      
      console.log("EmployeeDashboard: Document exists:", staffSnap.exists());
      
      if (staffSnap.exists()) {
        const data = staffSnap.data();
        setEmployeeData({
          uid: employeeUid,
          id: staffSnap.id,
          name: data.name || currentUser.displayName || "Employee",
          role: data.role || "Employee",
          ...data,
        });
        console.log("EmployeeDashboard: Loaded employee data:", data);
        
        // Check staff document for imageURL first, then fall back to user profile
        if (data.imageURL) {
          console.log("EmployeeDashboard: Profile picture URL from staff doc:", data.imageURL);
          setProfilePictureURL(data.imageURL);
        } else {
          console.log("EmployeeDashboard: No imageURL in staff doc, keeping user profile photoURL");
        }
      } else {
        // Employee not found - try to find by searching all staff
        console.log("EmployeeDashboard: Document not found, searching all staff...");
        const staffCollectionRef = collection(db, "restaurants", restaurantId, "staff");
        const allStaffSnap = await getDocs(staffCollectionRef);
        
        console.log("EmployeeDashboard: Found", allStaffSnap.docs.length, "staff members");
        console.log("EmployeeDashboard: Staff IDs:", allStaffSnap.docs.map(d => d.id));
        
        // Try to find by uid field
        const foundByUid = allStaffSnap.docs.find(d => {
          const data = d.data();
          return data.uid === employeeUid || d.id === employeeUid;
        });
        
        if (foundByUid) {
          const data = foundByUid.data();
          setEmployeeData({
            uid: employeeUid,
            id: foundByUid.id,
            name: data.name || currentUser.displayName || "Employee",
            role: data.role || "Employee",
            ...data,
          });
          console.log("EmployeeDashboard: Found employee by searching:", foundByUid.id);
          
          // Check staff document for imageURL first, then fall back to user profile
          if (data.imageURL) {
            console.log("EmployeeDashboard: Profile picture URL from staff doc (found by search):", data.imageURL);
            setProfilePictureURL(data.imageURL);
          } else {
            console.log("EmployeeDashboard: No imageURL in staff doc (found by search), keeping user profile photoURL");
          }
        } else {
          // Still not found - create a basic employee data object
          console.warn("EmployeeDashboard: Employee not found in staff collection. Using basic profile.");
          setEmployeeData({
            uid: employeeUid,
            id: employeeUid,
            name: currentUser.displayName || currentUser.email?.split("@")[0] || "Employee",
            role: "Employee",
            status: "active",
          });
          setDebugInfo({
            message: "Employee document not found in Firestore. Using basic profile.",
            path: path,
            availableStaff: allStaffSnap.docs.map(d => ({ id: d.id, uid: d.data().uid, name: d.data().name })),
          });
        }
      }

      // Load onboarding package (optional - don't fail if this fails)
      try {
        const packagesRef = collection(db, "companies", "company-demo", "restaurants", restaurantId, "employmentPackages");
        const packagesQuery = query(packagesRef, where("assignedTo", "==", employeeUid), where("status", "==", "pending"));
        const packagesSnap = await getDocs(packagesQuery);
        
        if (!packagesSnap.empty) {
          const pkg = packagesSnap.docs[0].data();
          setOnboardingPackage({
            id: packagesSnap.docs[0].id,
            ...pkg,
          });
        }
      } catch (pkgErr) {
        console.warn("Failed to load onboarding package:", pkgErr);
      }

      // Load documents (optional)
      try {
        const docs = await getEmployeeDocuments(employeeUid, restaurantId);
        setDocuments(docs);
      } catch (docErr) {
        console.warn("Failed to load documents:", docErr);
        setDocuments([]);
      }

      // Load notifications (optional)
      try {
        const notifs = await getUserNotifications(employeeUid);
        setUnreadCount(notifs.filter(n => !n.read).length);
      } catch (notifErr) {
        console.warn("Failed to load notifications:", notifErr);
        setUnreadCount(0);
      }

    } catch (err) {
      console.error("Error loading employee data:", err);
      // Even on error, set employee data to allow demo mode
      if (!employeeData) {
        setEmployeeData({
          uid: employeeUid || "demo-user",
          id: employeeUid || "demo-user",
          name: currentUser?.displayName || currentUser?.email?.split("@")[0] || "Employee",
          role: "Employee",
          status: "active",
        });
        setDemoMode(true);
      }
    } finally {
      setLoading(false);
    }
  }, [employeeUid, restaurantId, currentUser, authLoading]);

  useEffect(() => {
    if (!authLoading) {
      loadEmployeeData();
    }
  }, [loadEmployeeData, authLoading]);

  // ================= HANDLE DOCUMENT UPLOAD =================
  const handleDocumentUpload = async (file, documentType) => {
    if (!file || !documentType || !employeeUid || demoMode) {
      if (demoMode) {
        alert("Demo mode: Document upload disabled. Please log in to upload documents.");
      }
      return;
    }

    try {
      await uploadDocument({
        employeeUid,
        restaurantId,
        documentType,
        file,
      });
      
      // Reload documents
      const docs = await getEmployeeDocuments(employeeUid, restaurantId);
      setDocuments(docs);
      setShowUploadModal(false);
      setSelectedDocType(null);
      
      // Reload notifications
      const notifs = await getUserNotifications(employeeUid);
      setUnreadCount(notifs.filter(n => !n.read).length);
    } catch (err) {
      console.error("Error uploading document:", err);
      alert(`Upload failed: ${err.message}`);
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

  const tabs = [
    { key: "overview", label: "Overview", icon: "📊" },
    { key: "quick-actions", label: "Quick Actions", icon: "⚡" },
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

  // ================= RENDER TAB CONTENT =================
  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return (
          <div className="ed-overview-grid">
            {/* Demo Mode Banner */}
            {demoMode && (
              <div className="ed-card ed-card-warning" style={{ gridColumn: "1 / -1" }}>
                <div className="ed-card-body">
                  <strong>Demo Mode</strong>
                  <p style={{ margin: "8px 0 0 0", fontSize: 14 }}>
                    You're viewing in demo mode. <Link to="/login" style={{ color: "#3b82f6" }}>Log in</Link> to access full features.
                  </p>
                </div>
              </div>
            )}

            {/* Weekly Totals Card - Side by side (hours worked | tip share collected) */}
            {employeeUid && !demoMode && (
              <div style={{ gridColumn: "1 / -1" }}>
                <WeeklyTotalsCard
                  employeeId={employeeUid}
                  restaurantId={restaurantId}
                />
              </div>
            )}

            {/* Row 1: Time Clock | HR Info - Side by side */}
            {employeeUid && !demoMode && (
              <>
                {/* Time Clock */}
                <div className="ed-card ed-card-timeclock">
                  <div className="ed-card-header">
                    <h3>Time Clock</h3>
                  </div>
                  <div className="ed-card-body">
                    <TimeClock
                      employeeUid={employeeUid}
                      restaurantId={restaurantId}
                      role={employeeData?.role || "Employee"}
                      companyId={userProfile?.companyId || null}
                      profileMode={userProfile?.profileMode || "diner"}
                      onPunchInSuccess={() => {
                        if (userProfile?.profileMode === "work") {
                          setShowBlastModal(true);
                        }
                      }}
                    />
                  </div>
                </div>

                {/* HR Info Module */}
                <div className="ed-card">
                  <HRInfoModule
                    employeeUid={employeeUid}
                    restaurantId={restaurantId}
                    employeeName={employeeData?.name}
                  />
                </div>
              </>
            )}

            {/* Row 2: Alerts & Reminders */}
            {employeeUid && !demoMode && (
              <div className="ed-card-alerts" style={{ gridColumn: "1 / -1" }}>
                <AlertsAndRemindersModule
                  employeeUid={employeeUid}
                  restaurantId={restaurantId}
                />
              </div>
            )}

            {/* Row 3: Current Shift Game */}
            {employeeUid && !demoMode && (
              <div className="ed-card-hr-info" style={{ gridColumn: "1 / -1" }}>
                <CurrentShiftGame
                  employeeUid={employeeUid}
                  restaurantId={restaurantId}
                />
              </div>
            )}

            {/* Row 4: Messages */}
            {employeeUid && !demoMode && (
              <div className="ed-card" style={{ gridColumn: "1 / -1" }}>
                <MessageCenter
                  employeeUid={employeeUid}
                  restaurantId={restaurantId}
                  employeeName={employeeData?.name}
                />
              </div>
            )}

            {/* Row 5: Quick Info | Recent Badges | Lineup Points */}
            {employeeUid && !demoMode && (
              <>
                {/* Quick Info */}
                <div className="ed-card">
                  <div className="ed-card-header">
                    <h3>Quick Info</h3>
                  </div>
                  <div className="ed-card-body">
                    <div className="ed-info-row">
                      <span className="ed-info-label">Name</span>
                      <span className="ed-info-value">{employeeData?.name || "—"}</span>
                    </div>
                    <div className="ed-info-row">
                      <span className="ed-info-label">Role</span>
                      <span className="ed-info-value">{employeeData?.role || "—"}</span>
                    </div>
                    <div className="ed-info-row">
                      <span className="ed-info-label">Status</span>
                      <span className="ed-info-value">{employeeData?.status || "Active"}</span>
                    </div>
                    <div className="ed-info-row">
                      <span className="ed-info-label">Restaurant</span>
                      <span className="ed-info-value">{restaurantId}</span>
                    </div>
                    {onboardingPackage && (
                      <div className="ed-info-row">
                        <span className="ed-info-label">Onboarding</span>
                        <span className="ed-info-value">In Progress</span>
                      </div>
                    )}
                    {debugInfo && (
                      <div className="ed-info-row">
                        <span className="ed-info-label">Note</span>
                        <span className="ed-info-value" style={{ color: "#f59e0b", fontSize: 12 }}>
                          Employee document not in Firestore
                        </span>
                      </div>
                    )}
                    {demoMode && (
                      <div className="ed-info-row">
                        <span className="ed-info-label">Mode</span>
                        <span className="ed-info-value" style={{ color: "#f59e0b" }}>
                          Demo Mode
                        </span>
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
                        userId={employeeUid}
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
                    employeeUid={employeeUid}
                    restaurantId={restaurantId}
                  />
                </div>
              </>
            )}

            {/* Notifications */}
            {unreadCount > 0 && !demoMode && (
              <div className="ed-card ed-card-warning" style={{ gridColumn: "1 / -1" }}>
                <div className="ed-card-header">
                  <h3>Notifications</h3>
                </div>
                <div className="ed-card-body">
                  <div className="ed-quick-actions">
                    <div className="ed-action-btn ed-action-btn-notification">
                      <span className="ed-action-icon">🔔</span>
                      <span>{unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case "quick-actions":
        return (
          <div>
            {employeeUid && !demoMode ? (
              <QuickActionsTab />
            ) : (
              <div className="ed-empty-state">
                <h3>Quick Actions</h3>
                <p>Please <Link to="/login" style={{ color: "#3b82f6" }}>log in</Link> to view your quick actions.</p>
              </div>
            )}
          </div>
        );

      case "hr":
        return (
          <div>
            {employeeUid && !demoMode ? (
              <HRTab
                employeeUid={employeeUid}
                restaurantId={restaurantId}
                employeeName={employeeData?.name}
                employeeData={employeeData}
                userProfile={userProfile}
                employmentHistory={employmentHistory}
                onboardingPackage={onboardingPackage}
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
            {employeeUid && !demoMode ? (
              <TipShareWallet
                employeeId={employeeUid}
                restaurantId={restaurantId}
                userRole={userProfile?.role || employeeData?.role || null}
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
              {employeeUid && !demoMode ? (
                <BadgeGallery
                  userId={employeeUid}
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
            {employeeUid && !demoMode ? (
              <PerformanceTab
                employeeUid={employeeUid}
                restaurantId={restaurantId}
                employeeName={employeeData?.name}
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
            {employeeUid && !demoMode ? (
              <MessagingTab
                employeeUid={employeeUid}
                restaurantId={restaurantId}
                employeeName={employeeData?.name}
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
                <h1>Employee Dashboard</h1>
                <div className="ed-subtitle">
                  {employeeData?.name || "Employee"} • {restaurantId}
                  {demoMode && " • Demo Mode"}
                </div>
              </div>
            </div>
          </div>
          <div className="ed-header-right">
            {!demoMode && <NotificationBell />}
            {demoMode && (
              <Link to="/login" className="ed-btn ed-btn-primary" style={{ marginRight: 8 }}>
                Log In
              </Link>
            )}
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
                  <span className="ed-tab-icon">{tab.icon}</span>
                  <span>{tab.label}</span>
                </>
              )}
            </button>
          ))}
        </div>

        {/* ================= CONTENT ================= */}
        <div className="ed-content">{renderTabContent()}</div>

        {/* ================= UPLOAD MODAL ================= */}
        {showUploadModal && employeeUid && !demoMode && (
          <div className="ed-modal-overlay" onClick={() => setShowUploadModal(false)}>
            <div className="ed-modal" onClick={(e) => e.stopPropagation()}>
              <div className="ed-modal-header">
                <h3>Upload Document</h3>
                <button
                  className="ed-close-btn"
                  onClick={() => {
                    setShowUploadModal(false);
                    setSelectedDocType(null);
                  }}
                >
                  ×
                </button>
              </div>
              <div className="ed-modal-body">
                {!selectedDocType ? (
                  <div className="ed-document-type-list">
                    {DOCUMENT_TYPES.map((type) => (
                      <button
                        key={type}
                        className="ed-document-type-btn"
                        onClick={() => setSelectedDocType(type)}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div>
                    <p style={{ marginBottom: 16 }}>
                      Upload: <strong>{selectedDocType}</strong>
                    </p>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          handleDocumentUpload(file, selectedDocType);
                        }
                      }}
                      style={{ marginBottom: 16 }}
                    />
                    <button
                      className="ed-btn ed-btn-secondary"
                      onClick={() => setSelectedDocType(null)}
                    >
                      Back
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Employee Blast Modal */}
      {showBlastModal && employeeUid && (
        <EmployeeBlastModal
          isOpen={showBlastModal}
          onClose={() => setShowBlastModal(false)}
          employeeId={employeeUid}
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          employeeName={employeeData?.name || currentUser?.displayName || "Employee"}
          onBlastCreated={(blastId) => {
            console.log("Blast created:", blastId);
            setShowBlastModal(false);
          }}
        />
      )}
    </div>
  );
}