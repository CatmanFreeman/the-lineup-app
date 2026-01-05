//src/pages/Dashboards/RestaurantDashboard/tabs/Scheduling/EmployeePool.jsx
import React from "react";
/**
 * EmployeePool
 * - Enhanced employee cards with scheduling decision info
 * - Shows: availability, performance, hours, attendance, trends, training, preferences
 */
export default function EmployeePool({ 
  title, 
  side, 
  employees = [],
  selectedDate,
  isBlocked,
  employeeStats = {},
  rankingSnapshot = null,
  previousRankingSnapshot = null,
  employeePreferences = {},
}) {
  // Helper to get employee stats
  const getEmployeeStats = (emp) => {
    return employeeStats[emp.uid] || {
      hoursScheduled: 0,
      shiftsScheduled: 0,
      attendanceReliability: null,
      performanceBand: null,
      performanceScore: null,
      rankingPosition: null,
      performanceTrend: null,
      needsTraining: false,
      trainingStatus: null,
    };
  };

  // Helper to get performance band from ranking snapshot
  const getPerformanceBand = (uid) => {
    if (!rankingSnapshot?.bands) return null;
    for (const [band, employees] of Object.entries(rankingSnapshot.bands)) {
      const found = employees.find((e) => e.uid === uid);
      if (found) return { band, score: found.score, employees: employees.length };
    }
    return null;
  };

  // Helper to get ranking position
  const getRankingPosition = (uid) => {
    if (!rankingSnapshot?.bands) return null;
    let position = 0;
    const bandOrder = ["elite", "strong", "developing", "needsTraining"];
    for (const band of bandOrder) {
      const employees = rankingSnapshot.bands[band] || [];
      const idx = employees.findIndex((e) => e.uid === uid);
      if (idx !== -1) {
        return position + idx + 1;
      }
      position += employees.length;
    }
    return null;
  };

  // Helper to calculate performance trend
  const getPerformanceTrend = (uid) => {
    if (!rankingSnapshot || !previousRankingSnapshot) return null;
    
    const current = getPerformanceBand(uid);
    const previous = (() => {
      if (!previousRankingSnapshot?.bands) return null;
      for (const [band, employees] of Object.entries(previousRankingSnapshot.bands)) {
        const found = employees.find((e) => e.uid === uid);
        if (found) return { band, score: found.score };
      }
      return null;
    })();

    if (!current || !previous) return null;

    const bandOrder = { elite: 4, strong: 3, developing: 2, needsTraining: 1 };
    const currentLevel = bandOrder[current.band] || 0;
    const previousLevel = bandOrder[previous.band] || 0;

    if (currentLevel > previousLevel) return "↑";
    if (currentLevel < previousLevel) return "↓";
    if (current.score > previous.score) return "↑";
    if (current.score < previous.score) return "↓";
    return "→";
  };

  // Helper to get band color
  const getBandColor = (band) => {
    const colors = {
      elite: "#10b981", // green
      strong: "#3b82f6", // blue
      developing: "#f59e0b", // amber
      needsTraining: "#ef4444", // red
    };
    return colors[band] || "#6b7280";
  };

  // Helper to get attendance reliability badge
  const getAttendanceBadge = (reliability) => {
    if (!reliability) return null;
    if (reliability >= 95) return { text: "Excellent", color: "#10b981" };
    if (reliability >= 85) return { text: "Good", color: "#3b82f6" };
    if (reliability >= 75) return { text: "Fair", color: "#f59e0b" };
    return { text: "Needs Attention", color: "#ef4444" };
  };

  // Helper to format day abbreviations
  const formatDayAbbr = (day) => {
    const abbrs = {
      Monday: "Mon",
      Tuesday: "Tue",
      Wednesday: "Wed",
      Thursday: "Thu",
      Friday: "Fri",
      Saturday: "Sat",
      Sunday: "Sun",
    };
    return abbrs[day] || day;
  };

  // Helper to format time range
  const formatTimeRange = (start, end) => {
    if (!start || !end) return null;
    const formatTime = (time) => {
      if (typeof time === "string") {
        const [hours, minutes] = time.split(":");
        const h = parseInt(hours, 10);
        const ampm = h >= 12 ? "PM" : "AM";
        const h12 = h % 12 || 12;
        return `${h12}:${minutes} ${ampm}`;
      }
      return time;
    };
    return `${formatTime(start)} - ${formatTime(end)}`;
  };

  return (
    <div className={`sched-pool sched-pool--${side}`}>
      <div className="sched-poolHead">
        <div className="sched-poolTitle">{title}</div>
        <div className="sched-poolSub">{employees.length} available</div>
      </div>
      <div className="sched-poolList">
        {employees.length === 0 ? (
          <div className="sched-empty">No available staff</div>
        ) : (
          employees.map((e) => {
            const stats = getEmployeeStats(e);
            const perfData = getPerformanceBand(e.uid);
            const rankingPos = getRankingPosition(e.uid);
            const trend = getPerformanceTrend(e.uid);
            const isUnavailable = selectedDate && isBlocked(selectedDate, e.uid);
            const attendanceBadge = getAttendanceBadge(stats.attendanceReliability);
            const prefs = employeePreferences[e.uid] || {
              preferredDays: [],
              preferredTimes: [],
              avoidDays: [],
              preferredStartTime: null,
              preferredEndTime: null,
            };
            const hasPreferences = 
              prefs.preferredDays.length > 0 || 
              prefs.preferredTimes.length > 0 || 
              prefs.avoidDays.length > 0 ||
              (prefs.preferredStartTime && prefs.preferredEndTime);

            return (
              <div
                key={e.id}
                className={`sched-emp ${isUnavailable ? "sched-emp--unavailable" : ""}`}
                draggable={!isUnavailable}
                onDragStart={(ev) => {
                  if (isUnavailable) {
                    ev.preventDefault();
                    return;
                  }
                  ev.dataTransfer.setData(
                    "application/json",
                    JSON.stringify({
                      employee: { ...e, side },
                      fromSlotId: null,
                    })
                  );
                  ev.dataTransfer.effectAllowed = "move";
                }}
                title={isUnavailable ? "Unavailable - Approved time off" : "Drag to schedule"}
              >
                {/* Top row: Name and Performance Badge */}
                <div className="sched-empTop">
                  <div className="sched-empName">{e.name}</div>
                  {perfData && (
                    <div
                      className="sched-empBadge"
                      style={{
                        backgroundColor: getBandColor(perfData.band),
                        color: "#ffffff",
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: 4,
                        textTransform: "uppercase",
                      }}
                      title={`Performance: ${perfData.band} (Score: ${perfData.score})`}
                    >
                      {perfData.band === "needsTraining" ? "Training" : perfData.band.slice(0, 4)}
                    </div>
                  )}
                </div>

                {/* Second row: SubRole and Availability Status */}
                <div className="sched-empRow">
                  <div className="sched-empSub">{e.subRole}</div>
                  {isUnavailable && (
                    <div
                      className="sched-empStatus"
                      style={{
                        color: "#ef4444",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      ⚠ Unavailable
                    </div>
                  )}
                </div>

                {/* Third row: Hours/Shifts and Ranking */}
                <div className="sched-empRow" style={{ marginTop: 4 }}>
                  <div className="sched-empMeta" style={{ fontSize: 11, opacity: 0.8 }}>
                    {stats.hoursScheduled > 0 ? `${stats.hoursScheduled}h` : "0h"} / {stats.shiftsScheduled} shifts
                  </div>
                  {rankingPos && (
                    <div className="sched-empMeta" style={{ fontSize: 11, opacity: 0.8 }}>
                      #{rankingPos}
                    </div>
                  )}
                </div>

                {/* Fourth row: Performance Trend and Attendance */}
                <div className="sched-empRow" style={{ marginTop: 2, gap: 6 }}>
                  {trend && (
                    <div
                      className="sched-empTrend"
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color:
                          trend === "↑"
                            ? "#10b981"
                            : trend === "↓"
                            ? "#ef4444"
                            : "#6b7280",
                      }}
                      title="Performance trend"
                    >
                      {trend}
                    </div>
                  )}
                  {attendanceBadge && (
                    <div
                      className="sched-empAttendance"
                      style={{
                        fontSize: 10,
                        color: attendanceBadge.color,
                        fontWeight: 600,
                      }}
                      title={`Attendance: ${attendanceBadge.text} (${stats.attendanceReliability}%)`}
                    >
                      {attendanceBadge.text}
                    </div>
                  )}
                  {stats.needsTraining && (
                    <div
                      className="sched-empTraining"
                      style={{
                        fontSize: 10,
                        color: "#f59e0b",
                        fontWeight: 600,
                      }}
                      title="Training required"
                    >
                      🎓 Training
                    </div>
                  )}
                </div>

                {/* Fifth row: Preferences */}
                {hasPreferences && (
                  <div className="sched-empPreferences">
                    {prefs.preferredDays.length > 0 && (
                      <div className="sched-prefRow">
                        <span className="sched-prefLabel">Prefers:</span>
                        <div className="sched-prefValue">
                          {prefs.preferredDays.map((day) => (
                            <span key={day} className="sched-prefTag sched-prefTag--preferred">
                              {formatDayAbbr(day)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {prefs.avoidDays.length > 0 && (
                      <div className="sched-prefRow">
                        <span className="sched-prefLabel">Avoids:</span>
                        <div className="sched-prefValue">
                          {prefs.avoidDays.map((day) => (
                            <span key={day} className="sched-prefTag sched-prefTag--avoid">
                              {formatDayAbbr(day)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {(prefs.preferredTimes.length > 0 || (prefs.preferredStartTime && prefs.preferredEndTime)) && (
                      <div className="sched-prefRow">
                        <span className="sched-prefLabel">Times:</span>
                        <div className="sched-prefValue">
                          {prefs.preferredTimes.map((time) => (
                            <span key={time} className="sched-prefTag sched-prefTag--time">
                              {time}
                            </span>
                          ))}
                          {prefs.preferredStartTime && prefs.preferredEndTime && (
                            <span className="sched-prefTag sched-prefTag--time">
                              {formatTimeRange(prefs.preferredStartTime, prefs.preferredEndTime)}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}