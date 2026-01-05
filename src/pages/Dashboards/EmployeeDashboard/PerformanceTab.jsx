// src/pages/Dashboards/EmployeeDashboard/PerformanceTab.jsx

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "../../../hooks/services/firebase";
import "./PerformanceTab.css";

const COMPANY_ID = "company-demo";

// Date utilities
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

function getWeekEndingISO(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  const sunday = new Date(d.setDate(diff));
  sunday.setHours(23, 59, 59, 999);
  return sunday.toISOString().split("T")[0];
}

export default function PerformanceTab({ employeeUid, restaurantId, employeeName }) {
  const [loading, setLoading] = useState(true);
  const [currentRanking, setCurrentRanking] = useState(null);
  const [previousRanking, setPreviousRanking] = useState(null);
  const [attendanceData, setAttendanceData] = useState(null);
  const [allRankings, setAllRankings] = useState([]);
  const [error, setError] = useState("");

  // Load current ranking snapshot
  const loadCurrentRanking = useCallback(async () => {
    try {
      const today = new Date();
      const weekEndingISO = getWeekEndingISO(today);

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
        setCurrentRanking(data);

        // Find employee in ranking
        let employeeRanking = null;
        let position = 0;

        if (data.bands) {
          const bandOrder = ["elite", "strong", "developing", "needsTraining"];
          for (const band of bandOrder) {
            const employees = data.bands[band] || [];
            const idx = employees.findIndex((e) => e.uid === employeeUid);
            if (idx !== -1) {
              employeeRanking = {
                ...employees[idx],
                band,
                position: position + idx + 1,
                totalEmployees: Object.values(data.bands).flat().length,
              };
              break;
            }
            position += employees.length;
          }
        }

        return employeeRanking;
      }
      return null;
    } catch (err) {
      console.error("Error loading current ranking:", err);
      return null;
    }
  }, [employeeUid, restaurantId]);

  // Load previous ranking for trend
  const loadPreviousRanking = useCallback(async () => {
    try {
      const today = new Date();
      const twoWeeksAgo = addDays(today, -14);
      const weekEndingISO = getWeekEndingISO(twoWeeksAgo);

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
        setPreviousRanking(data);

        // Find employee in previous ranking
        if (data.bands) {
          const bandOrder = ["elite", "strong", "developing", "needsTraining"];
          let position = 0;
          for (const band of bandOrder) {
            const employees = data.bands[band] || [];
            const idx = employees.findIndex((e) => e.uid === employeeUid);
            if (idx !== -1) {
              return {
                ...employees[idx],
                band,
                position: position + idx + 1,
              };
            }
            position += employees.length;
          }
        }
      }
      return null;
    } catch (err) {
      console.error("Error loading previous ranking:", err);
      return null;
    }
  }, [employeeUid, restaurantId]);

  // Load attendance reliability
  const loadAttendanceData = useCallback(async () => {
    try {
      const today = new Date();
      const fourWeeksAgo = addDays(today, -28);
      const startDateISO = toISODate(fourWeeksAgo);

      // Try attendanceRecords subcollection
      const recordsRef = collection(
        db,
        "companies",
        COMPANY_ID,
        "restaurants",
        restaurantId,
        "attendanceRecords",
        employeeUid,
        "records"
      );

      const q = query(
        recordsRef,
        where("dateISO", ">=", startDateISO),
        where("dateISO", "<=", toISODate(today)),
        orderBy("dateISO", "desc")
      );

      const snap = await getDocs(q);

      if (!snap.empty) {
        const records = snap.docs.map((d) => d.data());
        let totalShifts = 0;
        let attendedShifts = 0;
        let onTimeShifts = 0;
        let lateShifts = 0;
        let noShows = 0;

        records.forEach((record) => {
          totalShifts += 1;
          const status = String(record.status || "").toLowerCase();

          if (status === "completed" || status === "active") {
            attendedShifts += 1;

            if (record.scheduledStartTime && record.punchedInAt) {
              const scheduledTime = new Date(record.scheduledStartTime);
              const actualTime = record.punchedInAt.toDate
                ? record.punchedInAt.toDate()
                : new Date(record.punchedInAt);
              const diffMinutes = (actualTime - scheduledTime) / (1000 * 60);

              if (diffMinutes <= 15) {
                onTimeShifts += 1;
              } else {
                lateShifts += 1;
              }
            } else {
              onTimeShifts += 1;
            }
          } else if (status === "no-show" || status === "absent") {
            noShows += 1;
          }
        });

        let reliability = totalShifts > 0
          ? Math.round((attendedShifts / totalShifts) * 100)
          : 100;

        const onTimeRate = attendedShifts > 0
          ? onTimeShifts / attendedShifts
          : 0;

        if (onTimeRate > 0.8) {
          reliability = Math.min(100, reliability + 5);
        }

        reliability = Math.max(0, reliability - (noShows * 10));

        setAttendanceData({
          totalShifts,
          attendedShifts,
          onTimeShifts,
          lateShifts,
          noShows,
          onTimeRate: Math.round(onTimeRate * 100),
          reliability,
        });
      } else {
        // Fallback: check main attendance document
        const attendanceRef = doc(
          db,
          "companies",
          COMPANY_ID,
          "restaurants",
          restaurantId,
          "attendance",
          employeeUid
        );

        const attendanceSnap = await getDoc(attendanceRef);
        if (attendanceSnap.exists()) {
          const data = attendanceSnap.data();
          setAttendanceData({
            totalShifts: 0,
            attendedShifts: 0,
            onTimeShifts: 0,
            lateShifts: 0,
            noShows: 0,
            onTimeRate: 0,
            reliability: data.status === "active" ? 100 : 0,
            lastStatus: data.status,
          });
        }
      }
    } catch (err) {
      console.error("Error loading attendance data:", err);
    }
  }, [employeeUid, restaurantId]);

  // Load all rankings for historical view
  const loadAllRankings = useCallback(async () => {
    try {
      const rankingRef = collection(
        db,
        "companies",
        COMPANY_ID,
        "restaurants",
        restaurantId,
        "rankingSnapshots"
      );

      const q = query(rankingRef, orderBy("periodLabel", "desc"), limit(10));
      const snap = await getDocs(q);

      const rankings = [];
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.bands) {
          let position = 0;
          const bandOrder = ["elite", "strong", "developing", "needsTraining"];
          for (const band of bandOrder) {
            const employees = data.bands[band] || [];
            const idx = employees.findIndex((e) => e.uid === employeeUid);
            if (idx !== -1) {
              rankings.push({
                periodLabel: data.periodLabel || docSnap.id,
                weekEndingISO: docSnap.id,
                band,
                score: employees[idx].score || 0,
                position: position + idx + 1,
                totalEmployees: Object.values(data.bands).flat().length,
              });
              break;
            }
            position += employees.length;
          }
        }
      });

      setAllRankings(rankings);
    } catch (err) {
      console.error("Error loading all rankings:", err);
    }
  }, [employeeUid, restaurantId]);

  // Load all data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError("");

      try {
        await Promise.all([
          loadCurrentRanking(),
          loadPreviousRanking(),
          loadAttendanceData(),
          loadAllRankings(),
        ]);
      } catch (err) {
        console.error("Error loading performance data:", err);
        setError("Failed to load performance data");
      } finally {
        setLoading(false);
      }
    };

    if (employeeUid && restaurantId) {
      loadData();
    }
  }, [employeeUid, restaurantId, loadCurrentRanking, loadPreviousRanking, loadAttendanceData, loadAllRankings]);

  // Calculate current employee ranking
  const currentEmployeeRanking = useMemo(() => {
    if (!currentRanking?.bands) return null;

    let position = 0;
    const bandOrder = ["elite", "strong", "developing", "needsTraining"];
    for (const band of bandOrder) {
      const employees = currentRanking.bands[band] || [];
      const idx = employees.findIndex((e) => e.uid === employeeUid);
      if (idx !== -1) {
        return {
          ...employees[idx],
          band,
          position: position + idx + 1,
          totalEmployees: Object.values(currentRanking.bands).flat().length,
        };
      }
      position += employees.length;
    }
    return null;
  }, [currentRanking, employeeUid]);

  // Calculate previous employee ranking
  const previousEmployeeRanking = useMemo(() => {
    if (!previousRanking?.bands) return null;

    let position = 0;
    const bandOrder = ["elite", "strong", "developing", "needsTraining"];
    for (const band of bandOrder) {
      const employees = previousRanking.bands[band] || [];
      const idx = employees.findIndex((e) => e.uid === employeeUid);
      if (idx !== -1) {
        return {
          ...employees[idx],
          band,
          position: position + idx + 1,
        };
      }
      position += employees.length;
    }
    return null;
  }, [previousRanking, employeeUid]);

  // Calculate performance trend
  const performanceTrend = useMemo(() => {
    if (!currentEmployeeRanking || !previousEmployeeRanking) return null;

    const scoreDiff = (currentEmployeeRanking.score || 0) - (previousEmployeeRanking.score || 0);
    const positionDiff = previousEmployeeRanking.position - currentEmployeeRanking.position;

    let trend = "stable";
    if (scoreDiff > 5 || positionDiff > 0) {
      trend = "improving";
    } else if (scoreDiff < -5 || positionDiff < 0) {
      trend = "declining";
    }

    return {
      trend,
      scoreDiff,
      positionDiff,
      currentScore: currentEmployeeRanking.score || 0,
      previousScore: previousEmployeeRanking.score || 0,
      currentPosition: currentEmployeeRanking.position,
      previousPosition: previousEmployeeRanking.position,
    };
  }, [currentEmployeeRanking, previousEmployeeRanking]);

  // Band configuration
  const bandConfig = {
    elite: { label: "Elite", color: "#fbbf24", icon: "🔥", description: "Top performers" },
    strong: { label: "Strong", color: "#4ade80", icon: "⭐", description: "Consistent high performance" },
    developing: { label: "Developing", color: "#facc15", icon: "🌱", description: "Growing and improving" },
    needsTraining: { label: "Needs Training", color: "#f87171", icon: "⚠️", description: "Additional support needed" },
  };

  if (loading) {
    return (
      <div className="ed-performance-tab">
        <div className="ed-performance-loading">Loading performance data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ed-performance-tab">
        <div className="ed-performance-error">{error}</div>
      </div>
    );
  }

  const band = currentEmployeeRanking?.band || "developing";
  const config = bandConfig[band] || bandConfig.developing;

  return (
    <div className="ed-performance-tab">
      <div className="ed-performance-header">
        <h2>Performance</h2>
        {currentRanking?.periodLabel && (
          <div className="ed-performance-period">
            Period: {currentRanking.periodLabel}
          </div>
        )}
      </div>

      {/* Current Performance Card */}
      {currentEmployeeRanking ? (
        <div className="ed-performance-main-card">
          <div className="ed-performance-band-display">
            <div className="ed-performance-band-icon" style={{ color: config.color }}>
              {config.icon}
            </div>
            <div className="ed-performance-band-info">
              <div className="ed-performance-band-label" style={{ color: config.color }}>
                {config.label}
              </div>
              <div className="ed-performance-band-desc">{config.description}</div>
            </div>
            <div className="ed-performance-score-display">
              <div className="ed-performance-score-value" style={{ color: config.color }}>
                {currentEmployeeRanking.score || 0}
              </div>
              <div className="ed-performance-score-label">Performance Score</div>
            </div>
          </div>

          <div className="ed-performance-rank-display">
            <div className="ed-performance-rank-item">
              <div className="ed-performance-rank-label">Rank</div>
              <div className="ed-performance-rank-value">
                #{currentEmployeeRanking.position} of {currentEmployeeRanking.totalEmployees}
              </div>
            </div>
            {performanceTrend && (
              <div className="ed-performance-rank-item">
                <div className="ed-performance-rank-label">Trend</div>
                <div className={`ed-performance-trend ed-performance-trend-${performanceTrend.trend}`}>
                  {performanceTrend.trend === "improving" && "📈 Improving"}
                  {performanceTrend.trend === "declining" && "📉 Declining"}
                  {performanceTrend.trend === "stable" && "➡️ Stable"}
                  {performanceTrend.scoreDiff !== 0 && (
                    <span className="ed-performance-trend-detail">
                      {" "}({performanceTrend.scoreDiff > 0 ? "+" : ""}{performanceTrend.scoreDiff} pts)
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="ed-performance-empty">
          <div className="ed-empty-icon">📊</div>
          <h3>No Performance Data</h3>
          <p>Performance rankings are generated every 2 weeks. Check back soon!</p>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="ed-performance-metrics-grid">
        {/* Attendance Reliability */}
        <div className="ed-performance-metric-card">
          <div className="ed-metric-header">
            <div className="ed-metric-icon">✅</div>
            <div className="ed-metric-title">Attendance</div>
          </div>
          <div className="ed-metric-value">
            {attendanceData?.reliability !== undefined ? `${attendanceData.reliability}%` : "N/A"}
          </div>
          {attendanceData && (
            <div className="ed-metric-details">
              <div className="ed-metric-detail-item">
                <span>Attended:</span>
                <span>{attendanceData.attendedShifts}/{attendanceData.totalShifts} shifts</span>
              </div>
              {attendanceData.onTimeRate > 0 && (
                <div className="ed-metric-detail-item">
                  <span>On-Time:</span>
                  <span>{attendanceData.onTimeRate}%</span>
                </div>
              )}
              {attendanceData.lateShifts > 0 && (
                <div className="ed-metric-detail-item">
                  <span>Late:</span>
                  <span>{attendanceData.lateShifts}</span>
                </div>
              )}
              {attendanceData.noShows > 0 && (
                <div className="ed-metric-detail-item ed-metric-detail-warning">
                  <span>No-Shows:</span>
                  <span>{attendanceData.noShows}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Performance Score */}
        {currentEmployeeRanking && (
          <div className="ed-performance-metric-card">
            <div className="ed-metric-header">
              <div className="ed-metric-icon">⭐</div>
              <div className="ed-metric-title">Performance Score</div>
            </div>
            <div className="ed-metric-value" style={{ color: config.color }}>
              {currentEmployeeRanking.score || 0}
            </div>
            <div className="ed-metric-details">
              <div className="ed-metric-detail-item">
                <span>Band:</span>
                <span style={{ color: config.color }}>{config.label}</span>
              </div>
              <div className="ed-metric-detail-item">
                <span>Position:</span>
                <span>#{currentEmployeeRanking.position}</span>
              </div>
            </div>
          </div>
        )}

        {/* Performance Trend */}
        {performanceTrend && (
          <div className="ed-performance-metric-card">
            <div className="ed-metric-header">
              <div className="ed-metric-icon">
                {performanceTrend.trend === "improving" ? "📈" : performanceTrend.trend === "declining" ? "📉" : "➡️"}
              </div>
              <div className="ed-metric-title">Trend</div>
            </div>
            <div className={`ed-metric-value ed-metric-trend-${performanceTrend.trend}`}>
              {performanceTrend.trend === "improving" ? "Improving" : performanceTrend.trend === "declining" ? "Declining" : "Stable"}
            </div>
            <div className="ed-metric-details">
              <div className="ed-metric-detail-item">
                <span>Score Change:</span>
                <span className={performanceTrend.scoreDiff >= 0 ? "ed-positive" : "ed-negative"}>
                  {performanceTrend.scoreDiff > 0 ? "+" : ""}{performanceTrend.scoreDiff} pts
                </span>
              </div>
              {performanceTrend.positionDiff !== 0 && (
                <div className="ed-metric-detail-item">
                  <span>Rank Change:</span>
                  <span className={performanceTrend.positionDiff > 0 ? "ed-positive" : "ed-negative"}>
                    {performanceTrend.positionDiff > 0 ? "+" : ""}{performanceTrend.positionDiff} positions
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Historical Performance */}
      {allRankings.length > 0 && (
        <div className="ed-performance-history">
          <h3 className="ed-performance-section-title">Performance History</h3>
          <div className="ed-performance-history-list">
            {allRankings.map((ranking, idx) => {
              const histConfig = bandConfig[ranking.band] || bandConfig.developing;
              const isCurrent = ranking.weekEndingISO === getWeekEndingISO(new Date());

              return (
                <div key={idx} className={`ed-performance-history-item ${isCurrent ? "ed-performance-history-current" : ""}`}>
                  <div className="ed-history-period">{ranking.periodLabel || ranking.weekEndingISO}</div>
                  <div className="ed-history-details">
                    <div className="ed-history-band" style={{ color: histConfig.color }}>
                      {histConfig.icon} {histConfig.label}
                    </div>
                    <div className="ed-history-score">Score: {ranking.score}</div>
                    <div className="ed-history-rank">Rank: #{ranking.position} of {ranking.totalEmployees}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Performance Breakdown Info */}
      <div className="ed-performance-info">
        <h3 className="ed-performance-section-title">How Performance is Calculated</h3>
        <div className="ed-performance-info-content">
          <p>
            Your performance score is calculated every 2 weeks based on multiple factors:
          </p>
          <ul className="ed-performance-factors">
            <li><strong>Performance Score (30%):</strong> Overall job performance and quality</li>
            <li><strong>Attendance Reliability (20%):</strong> Showing up on time and completing shifts</li>
            <li><strong>Hours Balance (15%):</strong> Fair distribution of scheduled hours</li>
            <li><strong>Availability (15%):</strong> Flexibility and availability match</li>
            <li><strong>Team Chemistry (10%):</strong> Working well with scheduled team</li>
            <li><strong>Training (5%):</strong> Training needs and opportunities</li>
            <li><strong>Preferences (5%):</strong> Shift preferences and requests</li>
          </ul>
          <p className="ed-performance-info-note">
            Rankings are updated every 2 weeks. Keep up the great work!
          </p>
        </div>
      </div>
    </div>
  );
}