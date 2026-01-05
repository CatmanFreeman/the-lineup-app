// src/pages/Dashboards/RestaurantDashboard/tabs/StaffTab.jsx

import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, doc, getDocs, getDoc } from "firebase/firestore";
import { db } from "../../../../hooks/services/firebase";
import HiringOnboarding from "./HiringOnboarding";
import OrientationTests from "./OrientationTests";
import BadgeManager from "../../../../components/BadgeManager";
import "./StaffTab.css";

/**
 * =====================================================
 * StaffTab — Production-Grade Restaurant HR Dashboard
 * =====================================================
 */

const COMPANY_ID = "company-demo";

export default function StaffTab() {
  const { restaurantId: routeRestaurantId } = useParams();
  const restaurantId = routeRestaurantId || "123";
  const navigate = useNavigate();
  
  const [viewMode, setViewMode] = useState("role"); // role | urgency | performance
  const [staff, setStaff] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [performanceData, setPerformanceData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);

  // ================= MODAL STATE =================
  const [showHiringModal, setShowHiringModal] = useState(false);
  const [showOrientationModal, setShowOrientationModal] = useState(false);
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [showBadgesModal, setShowBadgesModal] = useState(false);

  // ================= LOAD STAFF DATA =================
  const loadStaff = useCallback(async () => {
    if (!restaurantId) {
      console.warn("StaffTab: No restaurantId provided");
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
      console.log("StaffTab: Loading staff from:", path);
      console.log("StaffTab: Using restaurantId:", restaurantId);
      
      const snap = await getDocs(staffRef);
      
      console.log("StaffTab: Firestore query result:", {
        empty: snap.empty,
        size: snap.size,
        docs: snap.docs.length,
        path: path,
      });
      
      if (snap.docs.length > 0) {
        console.log("StaffTab: Document IDs found:", snap.docs.map(d => d.id));
      } else {
        console.warn("StaffTab: No documents found at path:", path);
      }
      
      const staffList = snap.docs.map((d) => {
        const data = d.data() || {};
        const staffMember = {
          id: d.id,
          uid: data.uid || d.id,
          name: data.name || d.id,
          role: data.role || "Front of House",
          subRole: data.subRole || "",
          active: data.active !== false,
          imageURL: data.imageURL || "",
        };
        return staffMember;
      });

      const allStaff = staffList;
      
      setDebugInfo({
        path: path,
        restaurantId: restaurantId,
        totalDocs: snap.docs.length,
        processedStaff: allStaff.length,
        staffList: allStaff,
      });
      
      if (allStaff.length === 0) {
        const errorMsg = `No staff found at ${path}. Please verify:\n1. Restaurant ID in URL: ${restaurantId}\n2. Staff collection exists in Firebase\n3. Check browser console for details`;
        setError(errorMsg);
      } else {
        setStaff(allStaff);
        setError(null);
      }
    } catch (err) {
      console.error("StaffTab: Failed to load staff:", err);
      setError(`Failed to load staff data: ${err.message}. Check console for details.`);
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
                updatedAt: data.updatedAt,
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

  // ================= LOAD PERFORMANCE DATA =================
  const loadPerformanceData = useCallback(async () => {
    if (!restaurantId) return;

    try {
      const today = new Date();
      const weekEndingISO = (() => {
        const day = today.getDay();
        const daysToSunday = (7 - day) % 7;
        const sunday = new Date(today);
        sunday.setDate(today.getDate() + daysToSunday);
        const yyyy = sunday.getFullYear();
        const mm = String(sunday.getMonth() + 1).padStart(2, "0");
        const dd = String(sunday.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
      })();

      const rankingRef = doc(
        db,
        "companies",
        COMPANY_ID,
        "restaurants",
        restaurantId,
        "rankingSnapshots",
        weekEndingISO
      );

      const snap = await getDoc(rankingRef);
      if (snap.exists()) {
        const data = snap.data();
        const performanceMap = {};
        
        if (data.bands) {
          Object.entries(data.bands).forEach(([band, employees]) => {
            employees.forEach((emp) => {
              performanceMap[emp.uid] = {
                band,
                score: emp.score || 0,
                role: emp.role || "",
              };
            });
          });
        }

        setPerformanceData(performanceMap);
      }
    } catch (err) {
      console.error("Failed to load performance data:", err);
    }
  }, [restaurantId]);

  // ================= INITIAL LOAD =================
  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  useEffect(() => {
    if (staff.length > 0) {
      loadAttendance();
      loadPerformanceData();
    }
  }, [staff, loadAttendance, loadPerformanceData]);

  // ================= DERIVED DATA =================
  const enrichedStaff = useMemo(() => {
    return staff.map((s) => {
      const att = attendance[s.uid] || {};
      const perf = performanceData[s.uid] || {};
      
      let status = "Off Shift";
      let statusColor = "#9ca3af";
      
      if (att.status === "active") {
        status = "On Shift";
        statusColor = "#4ade80";
      } else if (att.status === "completed") {
        const completedAt = att.punchedOutAt?.toDate ? att.punchedOutAt.toDate() : null;
        if (completedAt) {
          const hoursAgo = (Date.now() - completedAt.getTime()) / (1000 * 60 * 60);
          if (hoursAgo < 1) {
            status = "Just Clocked Out";
            statusColor = "#60a5fa";
          }
        }
      }

      let performanceIcon = "🟢";
      if (perf.band === "elite") performanceIcon = "🔥";
      else if (perf.band === "strong") performanceIcon = "⭐";
      else if (perf.band === "needsTraining") performanceIcon = "⚠️";
      else if (perf.band === "developing") performanceIcon = "🟡";

      return {
        ...s,
        status,
        statusColor,
        performanceIcon,
        performanceScore: perf.score || null,
        performanceBand: perf.band || null,
        attendanceStatus: att.status || "off",
      };
    });
  }, [staff, attendance, performanceData]);

  // ================= PERFORMANCE RANKINGS =================
  const performanceRankings = useMemo(() => {
    return enrichedStaff
      .filter((s) => s.performanceScore !== null)
      .sort((a, b) => (b.performanceScore || 0) - (a.performanceScore || 0))
      .map((s, index) => ({
        ...s,
        rank: index + 1,
      }));
  }, [enrichedStaff]);

  // ================= GROUPING & SORTING =================
  const groupedByRole = useMemo(() => {
    const groups = {};
    enrichedStaff.forEach((s) => {
      const role = s.role || "Other";
      if (!groups[role]) groups[role] = [];
      groups[role].push(s);
    });
    return groups;
  }, [enrichedStaff]);

  const sortedByUrgency = useMemo(() => {
    const urgencyRank = (status) => {
      if (status === "Off Shift") return 1;
      if (status === "Just Clocked Out") return 2;
      if (status === "On Shift") return 3;
      return 4;
    };

    return [...enrichedStaff].sort(
      (a, b) => urgencyRank(a.status) - urgencyRank(b.status)
    );
  }, [enrichedStaff]);

  const sortedByPerformance = useMemo(() => {
    return [...enrichedStaff].sort((a, b) => {
      const aScore = a.performanceScore || 0;
      const bScore = b.performanceScore || 0;
      return bScore - aScore;
    });
  }, [enrichedStaff]);

  // ================= ALERTS =================
  const staffAlerts = useMemo(() => {
    const alerts = [];
    
    enrichedStaff.forEach((s) => {
      if (s.attendanceStatus === "off" && new Date().getHours() >= 10 && new Date().getHours() <= 22) {
        alerts.push({
          type: "attendance",
          severity: "warning",
          message: `${s.name} is not clocked in during business hours`,
          staff: s,
        });
      }

      if (s.performanceBand === "needsTraining") {
        alerts.push({
          type: "performance",
          severity: "warning",
          message: `${s.name} requires training (${s.performanceBand})`,
          staff: s,
        });
      }
    });

    return alerts;
  }, [enrichedStaff]);

  // ================= TOTALS =================
  const totals = useMemo(() => {
    return {
      total: enrichedStaff.length,
      onShift: enrichedStaff.filter((s) => s.status === "On Shift").length,
      offShift: enrichedStaff.filter((s) => s.status === "Off Shift").length,
      justClockedOut: enrichedStaff.filter((s) => s.status === "Just Clocked Out").length,
      foh: enrichedStaff.filter((s) => s.role === "Front of House").length,
      boh: enrichedStaff.filter((s) => s.role === "Back of House").length,
    };
  }, [enrichedStaff]);

  // ================= RENDER =================
  if (loading) {
    return (
      <div className="staff-tab-wrapper">
        <div className="staff-placeholder">Loading staff data...</div>
      </div>
    );
  }

  return (
    <div className="staff-tab-wrapper">
      {/* DEBUG INFO (remove in production) */}
      {debugInfo && (
        <div style={{
          padding: 12,
          marginBottom: 16,
          background: "rgba(74, 144, 226, 0.1)",
          border: "1px solid rgba(74, 144, 226, 0.3)",
          borderRadius: 8,
          fontSize: 12,
        }}>
          <strong>Debug Info:</strong> Path: {debugInfo.path} | Restaurant ID: {debugInfo.restaurantId} | Docs: {debugInfo.totalDocs} | Processed: {debugInfo.processedStaff}
          {debugInfo.staffList.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <strong>Staff Found:</strong> {debugInfo.staffList.map(s => s.name).join(", ")}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="staff-placeholder" style={{ color: "#ef4444", marginBottom: 16, whiteSpace: "pre-line" }}>
          {error}
        </div>
      )}

      {/* LEVEL 1 — STAFF CONTROL CENTER */}
      <section className="staff-section">
        <div className="staff-section-title">Staff Control Center</div>

        <div className="staff-card-grid">
          <div 
            className="staff-card clickable"
            onClick={() => {
              navigate(`/dashboard/restaurant/${restaurantId}?tab=scheduling`);
            }}
          >
            <div className="card-title">Scheduling</div>
            <div className="card-sub">
              FOH & BOH schedules · AI-powered scheduling
            </div>
          </div>

          <div 
            className="staff-card clickable"
            onClick={() => setShowHiringModal(true)}
          >
            <div className="card-title">Hiring & Onboarding</div>
            <div className="card-sub">
              Send employment packages · Track completion
            </div>
          </div>

          <div 
            className="staff-card clickable"
            onClick={() => setShowOrientationModal(true)}
          >
            <div className="card-title">Orientation & Tests</div>
            <div className="card-sub">
              Menu tests · Alcohol compliance · Safety
            </div>
          </div>

          <div 
            className="staff-card clickable"
            onClick={() => setShowPerformanceModal(true)}
          >
            <div className="card-title">Performance Rankings</div>
            <div className="card-sub">
              Performance-based scheduling & fairness
            </div>
          </div>

          <div 
            className="staff-card clickable"
            onClick={() => setShowBadgesModal(true)}
          >
            <div className="card-title">Badges & Awards</div>
            <div className="card-sub">
              Award badges to employees · Track achievements
            </div>
          </div>
        </div>
      </section>

      {/* LEVEL 2 — LIVE SHIFT SNAPSHOT */}
      <section className="staff-section">
        <div className="staff-section-title">Live Shift Snapshot</div>

        <div className="staff-summary">
          <div className="summary-pill info">Total: {totals.total}</div>
          <div className="summary-pill good">On Shift: {totals.onShift}</div>
          <div className="summary-pill warning">Off Shift: {totals.offShift}</div>
          <div className="summary-pill info">FOH: {totals.foh}</div>
          <div className="summary-pill info">BOH: {totals.boh}</div>
        </div>

        <div className="staff-toggle">
          <button
            className={viewMode === "role" ? "active" : ""}
            onClick={() => setViewMode("role")}
          >
            Group by Role
          </button>
          <button
            className={viewMode === "urgency" ? "active" : ""}
            onClick={() => setViewMode("urgency")}
          >
            Sort by Urgency
          </button>
          <button
            className={viewMode === "performance" ? "active" : ""}
            onClick={() => setViewMode("performance")}
          >
            Sort by Performance
          </button>
        </div>

        <div className="staff-roster-card">
          {enrichedStaff.length === 0 ? (
            <div className="staff-placeholder">
              No staff members found. Check console for details.
            </div>
          ) : viewMode === "role" ? (
            Object.entries(groupedByRole).map(([role, members]) => (
              <div key={role} className="staff-group">
                <div className="staff-group-title">{role}</div>
                <div className="staff-rows">
                  {members.map((s) => (
                    <StaffRow key={s.id} staff={s} />
                  ))}
                </div>
              </div>
            ))
          ) : viewMode === "urgency" ? (
            <div className="staff-rows">
              {sortedByUrgency.map((s) => (
                <StaffRow key={s.id} staff={s} />
              ))}
            </div>
          ) : (
            <div className="staff-rows">
              {sortedByPerformance.map((s) => (
                <StaffRow key={s.id} staff={s} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* LEVEL 3 — SCHEDULING & COVERAGE HEALTH */}
      <section className="staff-section">
        <div className="staff-section-title">Scheduling & Coverage Health</div>

        <div className="staff-card-grid">
          <div className="staff-card info">
            <div className="card-title">FOH Coverage</div>
            <div className="card-value">{totals.foh}</div>
            <div className="card-sub">
              {totals.foh >= 4 ? "Adequate coverage" : "May need additional staff"}
            </div>
          </div>

          <div className="staff-card info">
            <div className="card-title">BOH Coverage</div>
            <div className="card-value">{totals.boh}</div>
            <div className="card-sub">
              {totals.boh >= 3 ? "Adequate coverage" : "May need additional staff"}
            </div>
          </div>

          <div className="staff-card clickable">
            <div className="card-title">AI Scheduling</div>
            <div className="card-sub">
              Sales-driven staffing recommendations
            </div>
          </div>
        </div>
      </section>

      {/* LEVEL 4 — STAFF ALERTS */}
      <section className="staff-section">
        <div className="staff-section-title">Staff Alerts</div>

        <div className="staff-alerts-card">
          {staffAlerts.length === 0 ? (
            <div className="staff-alert-muted">
              No staffing issues detected
            </div>
          ) : (
            <ul className="staff-alert-list">
              {staffAlerts.map((alert, idx) => (
                <li key={idx} style={{ 
                  color: alert.severity === "warning" ? "#facc15" : "#ef4444",
                  fontWeight: 600,
                }}>
                  <strong>{alert.staff.role}</strong> — {alert.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ================= MODALS ================= */}
      
      {/* Hiring & Onboarding Modal */}
      {showHiringModal && (
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
          onClick={() => setShowHiringModal(false)}
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
              <h2 style={{ margin: 0, fontSize: "20px" }}>Hiring & Onboarding</h2>
              <button
                onClick={() => setShowHiringModal(false)}
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
            <div style={{ overflowY: "auto", flex: 1 }}>
              <HiringOnboarding onClose={() => setShowHiringModal(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Orientation & Tests Modal */}
      {showOrientationModal && (
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
          onClick={() => setShowOrientationModal(false)}
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
              <h2 style={{ margin: 0, fontSize: "20px" }}>Orientation & Tests</h2>
              <button
                onClick={() => setShowOrientationModal(false)}
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
            <div style={{ overflowY: "auto", flex: 1 }}>
              <OrientationTests onClose={() => setShowOrientationModal(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Performance Rankings Modal */}
      {showPerformanceModal && (
        <Modal
          title="Performance Rankings"
          onClose={() => setShowPerformanceModal(false)}
        >
          <PerformanceRankingsContent rankings={performanceRankings} />
        </Modal>
      )}

      {/* Badges & Awards Modal */}
      {showBadgesModal && (
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
          onClick={() => setShowBadgesModal(false)}
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
              <h2 style={{ margin: 0, fontSize: "20px" }}>Badges & Awards</h2>
              <button
                onClick={() => setShowBadgesModal(false)}
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
                restaurantId={restaurantId}
                companyId={COMPANY_ID}
                staff={enrichedStaff}
                onClose={() => setShowBadgesModal(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =====================================================
   STAFF ROW COMPONENT
   ===================================================== */

function StaffRow({ staff }) {
  return (
    <div className="staff-row staff-row-grid">
      <div className="staff-main">
        <div className="staff-name">{staff.name}</div>
        <div className="staff-sub">
          {staff.role} {staff.subRole ? `· ${staff.subRole}` : ""}
          {staff.performanceScore && (
            <span style={{ marginLeft: 8, opacity: 0.7 }}>
              (Score: {staff.performanceScore})
            </span>
          )}
        </div>
      </div>

      <div className="staff-status">
        <span
          className="status-pill"
          style={{ background: staff.statusColor }}
        >
          {staff.status}
        </span>
      </div>

      <div className="staff-performance staff-performance-col">
        {staff.performanceIcon}
      </div>
    </div>
  );
}

/* =====================================================
   MODAL COMPONENT
   ===================================================== */

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

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
          maxWidth: 800,
          maxHeight: "90vh",
          overflow: "auto",
          width: "100%",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, color: "#fff", fontSize: 20 }}>{title}</h2>
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
        {children}
      </div>
    </div>
  );
}

/* =====================================================
   PERFORMANCE RANKINGS CONTENT
   ===================================================== */

function PerformanceRankingsContent({ rankings }) {
  return (
    <div style={{ color: "#fff" }}>
      <div style={{ marginBottom: 20, padding: 16, background: "rgba(255,255,255,0.05)", borderRadius: 8 }}>
        <h3 style={{ marginTop: 0, fontSize: 16 }}>Current Performance Rankings</h3>
        <p style={{ opacity: 0.8, fontSize: 14 }}>
          Rankings are based on performance scores from the current 2-week period.
        </p>
      </div>

      {rankings.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", opacity: 0.6 }}>
          No performance rankings available yet. Rankings are generated after performance data is collected.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {rankings.map((staff, index) => {
            const bandColors = {
              elite: "#fbbf24",
              strong: "#4ade80",
              needsTraining: "#f87171",
              developing: "#facc15",
            };
            const bandLabels = {
              elite: "Elite",
              strong: "Strong",
              needsTraining: "Training",
              developing: "Developing",
            };

            return (
              <div
                key={staff.id}
                style={{
                  padding: 16,
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  border: index < 3 ? `2px solid ${bandColors[staff.performanceBand] || "#4ade80"}` : "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: index === 0 ? "#fbbf24" : index === 1 ? "#94a3b8" : index === 2 ? "#cd7f32" : "rgba(255,255,255,0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 900,
                      fontSize: 18,
                      color: index < 3 ? "#000" : "#fff",
                    }}
                  >
                    {index + 1}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{staff.name}</div>
                    <div style={{ fontSize: 13, opacity: 0.7 }}>
                      {staff.role} {staff.subRole ? `· ${staff.subRole}` : ""}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: bandColors[staff.performanceBand] || "#fff" }}>
                      {staff.performanceScore}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      {bandLabels[staff.performanceBand] || "N/A"}
                    </div>
                  </div>
                  <div style={{ fontSize: 24 }}>{staff.performanceIcon}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 20, padding: 12, background: "rgba(56, 189, 248, 0.1)", borderRadius: 8, fontSize: 12, opacity: 0.8 }}>
        <strong>Note:</strong> Rankings are updated every 2 weeks based on performance metrics including attendance, 
        shift completion, customer feedback, and operational excellence.
      </div>
    </div>
  );
}