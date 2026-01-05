// src/pages/Dashboards/EmployeeDashboard/HRTab.jsx
//
// HR TAB - Employee Dashboard
//
// Combines Schedule, Documents, Onboarding, and Resume into one Human Resources tab

import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "../../../hooks/services/firebase";
import ScheduleTab from "./ScheduleTab";
import EmploymentHistory from "../../../components/EmploymentHistory";
import SkillsExperience from "../../../components/SkillsExperience";
import "./HRTab.css";

export default function HRTab({
  employeeUid,
  restaurantId,
  employeeName,
  employeeData,
  userProfile,
  employmentHistory,
  onboardingPackage,
  documents,
  onUploadDocument,
  showUploadModal,
  setShowUploadModal,
  selectedDocType,
  setSelectedDocType,
  DOCUMENT_TYPES,
}) {
  const [activeSection, setActiveSection] = useState("schedule"); // schedule, documents, onboarding, resume, alerts
  const [hrAlerts, setHrAlerts] = useState([]);
  const [hrAlertsLoading, setHrAlertsLoading] = useState(true);

  useEffect(() => {
    if (!employeeUid || !restaurantId) {
      setHrAlertsLoading(false);
      return;
    }

    loadHRAlerts();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadHRAlerts, 30000);
    return () => clearInterval(interval);
  }, [employeeUid, restaurantId]);

  async function loadHRAlerts() {
    try {
      // Get HR-related notifications
      const notificationsRef = collection(db, "notifications");
      const hrNotificationsQuery = query(
        notificationsRef,
        where("userId", "==", employeeUid),
        where("read", "==", false),
        orderBy("createdAt", "desc"),
        limit(20)
      );
      const notificationsSnap = await getDocs(hrNotificationsQuery);
      const notifications = notificationsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        type: "notification",
      }));

      // Filter for HR-related notifications
      const hrNotifications = notifications.filter((n) => {
        const type = n.type || n.notificationType || "";
        const title = (n.title || "").toLowerCase();
        const message = (n.message || "").toLowerCase();
        return (
          type.includes("HR") ||
          type.includes("SCHEDULE") ||
          type.includes("EMPLOYMENT") ||
          type.includes("ONBOARDING") ||
          type.includes("DOCUMENT") ||
          title.includes("hr") ||
          title.includes("schedule") ||
          title.includes("employment") ||
          title.includes("onboarding") ||
          title.includes("document") ||
          message.includes("hr") ||
          message.includes("schedule") ||
          message.includes("employment")
        );
      });

      setHrAlerts(hrNotifications);
    } catch (error) {
      console.error("Error loading HR alerts:", error);
    } finally {
      setHrAlertsLoading(false);
    }
  }

  const renderSection = () => {
    switch (activeSection) {
      case "schedule":
        return (
          <ScheduleTab
            employeeUid={employeeUid}
            restaurantId={restaurantId}
            employeeName={employeeName}
          />
        );

      case "documents":
        return (
          <div>
            <div className="hr-section-header">
              <h2>My Documents</h2>
              {employeeUid && (
                <button
                  className="ed-btn ed-btn-primary"
                  onClick={() => {
                    setSelectedDocType(null);
                    setShowUploadModal(true);
                  }}
                >
                  Upload Document
                </button>
              )}
            </div>

            {documents.length === 0 ? (
              <div className="ed-empty-state">
                <h3>No Documents</h3>
                <p>You haven't uploaded any documents yet.</p>
              </div>
            ) : (
              <div className="ed-documents-list">
                {DOCUMENT_TYPES.map((type) => {
                  const typeDocs = documents.filter((d) => d.type === type);
                  if (typeDocs.length === 0) return null;

                  return (
                    <div key={type} className="ed-document-group">
                      <h3>{type}</h3>
                      {typeDocs.map((doc) => (
                        <div key={doc.id} className="ed-document-item">
                          <div>
                            <div className="ed-document-name">{doc.fileName}</div>
                            <div className="ed-document-meta">
                              Uploaded: {doc.uploadedAt?.toDate?.()?.toLocaleDateString() || "N/A"}
                              {doc.status === "approved" && " • Approved"}
                              {doc.status === "pending" && " • Pending Review"}
                              {doc.status === "rejected" && " • Rejected"}
                            </div>
                          </div>
                          <div className="ed-document-item-right">
                            {doc.status === "pending" && (
                              <span className="ed-status-badge ed-status-badge-warning">
                                Pending
                              </span>
                            )}
                            {doc.status === "approved" && (
                              <span className="ed-status-badge ed-status-badge-success">
                                Approved
                              </span>
                            )}
                            {doc.status === "rejected" && (
                              <span className="ed-status-badge ed-status-badge-error">
                                Rejected
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      case "onboarding":
        if (!onboardingPackage) {
          return (
            <div className="ed-empty-state">
              <h3>No Onboarding Package</h3>
              <p>You don't have any pending onboarding tasks.</p>
            </div>
          );
        }

        return (
          <div>
            <div className="ed-onboarding-header">
              <h2>{onboardingPackage.name || "Onboarding Package"}</h2>
              <div className="ed-progress-display">
                <div className="ed-progress-bar">
                  <div
                    className="ed-progress-fill"
                    style={{
                      width: `${onboardingPackage.completionPercent || 0}%`,
                    }}
                  />
                  <div className="ed-progress-text">
                    {onboardingPackage.completionPercent || 0}% Complete
                  </div>
                </div>
              </div>
            </div>

            <div className="ed-checklist">
              {onboardingPackage.checklist?.map((item, idx) => {
                const doc = documents.find(d => d.type === item.documentType);
                const isCompleted = doc?.status === "approved";
                const isRequired = item.required;

                return (
                  <div
                    key={idx}
                    className={`ed-checklist-item ${
                      isRequired ? "ed-checklist-item-required" : ""
                    } ${isCompleted ? "ed-checklist-item-completed" : ""}`}
                  >
                    <div className="ed-checklist-item-header">
                      <div className="ed-checklist-item-left">
                        <input
                          type="checkbox"
                          className="ed-checklist-checkbox"
                          checked={isCompleted}
                          disabled
                        />
                        <div>
                          <div className="ed-checklist-item-title">
                            {item.title}
                            {isRequired && (
                              <span className="ed-required-badge">REQUIRED</span>
                            )}
                          </div>
                          <div className="ed-checklist-item-desc">{item.description}</div>
                          <div className="ed-checklist-item-type">
                            Type: {item.documentType || "N/A"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {!isCompleted && employeeUid && (
                      <div className="ed-upload-form">
                        <button
                          className="ed-btn ed-btn-primary ed-btn-small"
                          onClick={() => {
                            setSelectedDocType(item.documentType);
                            setShowUploadModal(true);
                          }}
                        >
                          Upload {item.documentType}
                        </button>
                      </div>
                    )}

                    {isCompleted && doc && (
                      <div style={{ marginTop: 8, fontSize: 12, color: "#059669" }}>
                        ✓ Approved on {doc.approvedAt?.toDate?.()?.toLocaleDateString() || "N/A"}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );

      case "resume":
        return (
          <div className="ed-resume-container">
            {/* Basic Info */}
            <div className="ed-resume-section">
              <h2 className="ed-resume-section-title">Profile</h2>
              <div className="ed-resume-info-grid">
                <div className="ed-resume-info-item">
                  <span className="ed-resume-label">Name</span>
                  <span className="ed-resume-value">{employeeData?.name || userProfile?.fullName || "N/A"}</span>
                </div>
                {userProfile?.bio && (
                  <div className="ed-resume-info-item ed-resume-bio">
                    <span className="ed-resume-label">Bio</span>
                    <span className="ed-resume-value">{userProfile.bio}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Employment History */}
            <div className="ed-resume-section">
              <EmploymentHistory
                employment={employmentHistory}
                currentRestaurant={restaurantId ? { id: restaurantId, name: employeeData?.restaurantName || restaurantId } : null}
                currentRole={employeeData?.role || employeeData?.subRole}
                viewMode="resume"
                employeeUid={employeeUid}
                employeeName={employeeName || employeeData?.name}
              />
            </div>

            {/* Skills & Experience */}
            <div className="ed-resume-section">
              <SkillsExperience employeeId={employeeUid} viewMode="edit" />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="hr-tab-container">
      {/* Section Navigation */}
      <div className="hr-section-nav">
        <button
          className={`hr-nav-btn ${activeSection === "schedule" ? "active" : ""}`}
          onClick={() => setActiveSection("schedule")}
        >
          📅 Schedule
        </button>
        <button
          className={`hr-nav-btn ${activeSection === "alerts" ? "active" : ""}`}
          onClick={() => setActiveSection("alerts")}
        >
          🔔 Alerts {hrAlerts.length > 0 && <span className="hr-nav-badge">{hrAlerts.length}</span>}
        </button>
        <button
          className={`hr-nav-btn ${activeSection === "documents" ? "active" : ""}`}
          onClick={() => setActiveSection("documents")}
        >
          📄 Documents
        </button>
        <button
          className={`hr-nav-btn ${activeSection === "onboarding" ? "active" : ""}`}
          onClick={() => setActiveSection("onboarding")}
        >
          📋 Onboarding
        </button>
        <button
          className={`hr-nav-btn ${activeSection === "resume" ? "active" : ""}`}
          onClick={() => setActiveSection("resume")}
        >
          📄 Resume
        </button>
      </div>

      {/* Section Content */}
      <div className="hr-section-content">
        {renderSection()}
      </div>
    </div>
  );
}

