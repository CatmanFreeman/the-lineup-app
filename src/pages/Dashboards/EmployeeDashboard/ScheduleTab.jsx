// src/pages/Dashboards/EmployeeDashboard/ScheduleTab.jsx

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { collection, doc, getDoc, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "../../../hooks/services/firebase";
import { requestTimeOff, requestShiftSwap, getEmployeeScheduleRequests } from "../../../utils/scheduleRequestService";
import { createNotification, NOTIFICATION_TYPES, NOTIFICATION_PRIORITY } from "../../../utils/notificationService";
import "./ScheduleTab.css";

const COMPANY_ID = "company-demo";

// Slot definitions (must match SchedulingTab.jsx)
const SLOT_DEFS = [
  { id: "foh-host", label: "Host", side: "foh", startTime: "10:00", endTime: "18:00", hours: 8 },
  { id: "foh-server-1", label: "Server 1", side: "foh", startTime: "11:00", endTime: "19:00", hours: 8 },
  { id: "foh-server-2", label: "Server 2", side: "foh", startTime: "11:00", endTime: "19:00", hours: 8 },
  { id: "foh-bartender", label: "Bartender", side: "foh", startTime: "16:00", endTime: "00:00", hours: 8 },
  { id: "boh-grill", label: "Grill", side: "boh", startTime: "10:00", endTime: "18:00", hours: 8 },
  { id: "boh-fry", label: "Fry", side: "boh", startTime: "11:00", endTime: "19:00", hours: 8 },
  { id: "boh-saute", label: "Saute", side: "boh", startTime: "11:00", endTime: "19:00", hours: 8 },
  { id: "boh-salad", label: "Salad", side: "boh", startTime: "10:00", endTime: "18:00", hours: 8 },
];

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

function upcomingSundayISO(fromDate = new Date()) {
  const d = new Date(fromDate.getTime());
  const day = d.getDay();
  const daysToSunday = (7 - day) % 7;
  if (daysToSunday === 0) {
    return toISODate(addDays(d, 7));
  }
  return toISODate(addDays(d, daysToSunday));
}

function startOfWeekFromWeekEndingSunday(weekEndingISO) {
  const sunday = parseISODate(weekEndingISO);
  if (!sunday) return null;
  return addDays(sunday, -6);
}

function dayNameShort(d) {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return names[d.getDay()];
}

function dayNameFull(d) {
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return names[d.getDay()];
}

function formatMMDD(d) {
  return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
}

function formatTime(timeStr) {
  if (!timeStr) return "";
  const [hours, minutes] = timeStr.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${pad2(minutes)} ${period}`;
}

function getWeekEndingISO(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  const sunday = new Date(d.setDate(diff));
  sunday.setHours(23, 59, 59, 999);
  return sunday.toISOString().split("T")[0];
}

export default function ScheduleTab({ employeeUid, restaurantId, employeeName }) {
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState([]);
  const [viewMode, setViewMode] = useState("upcoming");
  const [displayMode, setDisplayMode] = useState("list"); // "list" | "calendar"
  const [showDraft, setShowDraft] = useState(false);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0); // 0 = current week, -1 = last week, +1 = next week
  const [error, setError] = useState("");
  const [scheduleRequests, setScheduleRequests] = useState([]);
  
  // Modals
  const [showTimeOffModal, setShowTimeOffModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState(null);
  const [timeOffDate, setTimeOffDate] = useState("");
  const [timeOffReason, setTimeOffReason] = useState("");
  const [swapTargetDate, setSwapTargetDate] = useState("");
  const [swapTargetSlot, setSwapTargetSlot] = useState("");
  const [swapReason, setSwapReason] = useState("");

  // Load shifts for the employee
  const loadShifts = useCallback(async () => {
    if (!employeeUid || !restaurantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const allShifts = [];
      const today = new Date();
      
      // Calculate week range based on currentWeekOffset
      const startWeek = addDays(today, currentWeekOffset * 7);
      const weeksToLoad = [];
      
      // Load current week and surrounding weeks
      for (let i = -2; i <= 4; i++) {
        const weekDate = addDays(startWeek, i * 7);
        const weekEnding = upcomingSundayISO(weekDate);
        weeksToLoad.push(weekEnding);
      }

      const uniqueWeeks = [...new Set(weeksToLoad)];

      await Promise.all(
        uniqueWeeks.map(async (weekEndingISO) => {
          try {
            const scheduleRef = doc(
              db,
              "companies",
              COMPANY_ID,
              "restaurants",
              restaurantId,
              "schedules",
              weekEndingISO
            );

            const scheduleSnap = await getDoc(scheduleRef);
            if (!scheduleSnap.exists()) return;

            const scheduleData = scheduleSnap.data();
            const status = scheduleData.status || "draft";

            // Load published OR draft if showDraft is true
            if (status === "published" || (showDraft && status === "draft")) {
              const days = scheduleData.days || {};
              const weekStart = startOfWeekFromWeekEndingSunday(weekEndingISO);
              if (!weekStart) return;

              for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
                const dayDate = addDays(weekStart, dayOffset);
                const dayISO = toISODate(dayDate);
                const dayData = days[dayISO];

                if (!dayData || !dayData.slots) continue;

                const slots = dayData.slots || {};

                Object.keys(slots).forEach((slotId) => {
                  const assignedUid = slots[slotId];
                  if (assignedUid === employeeUid) {
                    const slotDef = SLOT_DEFS.find((s) => s.id === slotId);
                    if (slotDef) {
                      allShifts.push({
                        id: `${dayISO}_${slotId}`,
                        dateISO: dayISO,
                        date: dayDate,
                        slotId: slotId,
                        slotLabel: slotDef.label,
                        side: slotDef.side,
                        startTime: slotDef.startTime,
                        endTime: slotDef.endTime,
                        hours: slotDef.hours,
                        weekEndingISO,
                        status: status,
                        notes: dayData.notes || null,
                        slotNotes: dayData.slotNotes?.[slotId] || null,
                      });
                    }
                  }
                });
              }
            }
          } catch (weekErr) {
            console.warn(`Error loading week ${weekEndingISO}:`, weekErr);
          }
        })
      );

      allShifts.sort((a, b) => {
        const dateA = a.date.getTime();
        const dateB = b.date.getTime();
        return dateA - dateB;
      });

      setShifts(allShifts);
    } catch (err) {
      console.error("Error loading shifts:", err);
      setError("Failed to load schedule. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [employeeUid, restaurantId, currentWeekOffset, showDraft]);

  // Load schedule requests
  const loadScheduleRequests = useCallback(async () => {
    if (!employeeUid || !restaurantId) return;
    
    try {
      const requests = await getEmployeeScheduleRequests(employeeUid, restaurantId);
      setScheduleRequests(requests);
    } catch (err) {
      console.error("Error loading schedule requests:", err);
    }
  }, [employeeUid, restaurantId]);

  useEffect(() => {
    loadShifts();
    loadScheduleRequests();
  }, [loadShifts, loadScheduleRequests]);

  // Filter shifts based on view mode
  const filteredShifts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (viewMode) {
      case "upcoming":
        return shifts.filter((shift) => {
          const shiftDate = new Date(shift.date);
          shiftDate.setHours(0, 0, 0, 0);
          return shiftDate >= today;
        });
      case "past":
        return shifts.filter((shift) => {
          const shiftDate = new Date(shift.date);
          shiftDate.setHours(0, 0, 0, 0);
          return shiftDate < today;
        });
      case "all":
      default:
        return shifts;
    }
  }, [shifts, viewMode]);

  // Group shifts by date
  const shiftsByDate = useMemo(() => {
    const grouped = {};
    filteredShifts.forEach((shift) => {
      const key = shift.dateISO;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(shift);
    });
    return grouped;
  }, [filteredShifts]);

  // Calendar view data
  const calendarData = useMemo(() => {
    if (displayMode !== "calendar") return null;

    const today = new Date();
    const startDate = addDays(today, currentWeekOffset * 7);
    const startOfMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const endOfMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
    
    const weeks = [];
    let currentWeek = [];
    let currentDate = new Date(startOfMonth);
    
    // Start from Sunday of the week containing the 1st
    const firstDay = currentDate.getDay();
    currentDate = addDays(currentDate, -firstDay);

    while (currentDate <= endOfMonth || currentWeek.length < 7) {
      currentWeek.push({
        date: new Date(currentDate),
        dateISO: toISODate(currentDate),
        shifts: shiftsByDate[toISODate(currentDate)] || [],
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      currentDate = addDays(currentDate, 1);
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({
          date: new Date(currentDate),
          dateISO: toISODate(currentDate),
          shifts: [],
        });
        currentDate = addDays(currentDate, 1);
      }
      weeks.push(currentWeek);
    }

    return {
      weeks,
      month: startDate.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    };
  }, [displayMode, currentWeekOffset, shiftsByDate]);

  const sortedDates = useMemo(() => {
    return Object.keys(shiftsByDate).sort();
  }, [shiftsByDate]);

  // Handle time-off request
  const handleRequestTimeOff = async () => {
    if (!timeOffDate) {
      alert("Please select a date");
      return;
    }

    try {
      const weekEnding = getWeekEndingISO(new Date(timeOffDate));
      await requestTimeOff({
        employeeUid,
        employeeName: employeeName || "Employee",
        restaurantId,
        dateISO: timeOffDate,
        weekEndingISO: weekEnding,
        reason: timeOffReason,
      });

      await createNotification({
        userId: employeeUid,
        restaurantId,
        companyId: COMPANY_ID,
        type: NOTIFICATION_TYPES.SCHEDULE_PUBLISHED,
        priority: NOTIFICATION_PRIORITY.LOW,
        title: "Time-Off Request Submitted",
        message: `Your time-off request for ${formatMMDD(parseISODate(timeOffDate))} has been submitted.`,
        actionUrl: `/dashboard/employee/${restaurantId}?tab=schedule`,
      });

      setShowTimeOffModal(false);
      setTimeOffDate("");
      setTimeOffReason("");
      await loadScheduleRequests();
      alert("Time-off request submitted successfully!");
    } catch (err) {
      console.error("Error submitting time-off request:", err);
      alert("Failed to submit request. Please try again.");
    }
  };

  // Handle shift swap request
  const handleRequestShiftSwap = async () => {
    if (!selectedShift || !swapTargetDate || !swapTargetSlot) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      await requestShiftSwap({
        employeeUid,
        employeeName: employeeName || "Employee",
        restaurantId,
        fromDateISO: selectedShift.dateISO,
        fromSlotId: selectedShift.slotId,
        toDateISO: swapTargetDate,
        toSlotId: swapTargetSlot,
        targetEmployeeUid: null, // Would need to select employee
        targetEmployeeName: null,
        reason: swapReason,
      });

      setShowSwapModal(false);
      setSelectedShift(null);
      setSwapTargetDate("");
      setSwapTargetSlot("");
      setSwapReason("");
      await loadScheduleRequests();
      alert("Shift swap request submitted successfully!");
    } catch (err) {
      console.error("Error submitting shift swap request:", err);
      alert("Failed to submit request. Please try again.");
    }
  };

  // Export schedule to text
  const handleExportSchedule = () => {
    const lines = ["MY SCHEDULE", "==========\n"];
    
    sortedDates.forEach((dateISO) => {
      const dayShifts = shiftsByDate[dateISO];
      const date = parseISODate(dateISO);
      lines.push(`${dayNameFull(date)} - ${formatMMDD(date)}`);
      
      dayShifts.forEach((shift) => {
        lines.push(`  ${shift.slotLabel}: ${formatTime(shift.startTime)} - ${formatTime(shift.endTime)} (${shift.hours} hours)`);
      });
      lines.push("");
    });

    const text = lines.join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `schedule-${toISODate(new Date())}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Print schedule
  const handlePrintSchedule = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="ed-schedule-tab">
        <div className="ed-schedule-loading">Loading your schedule...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ed-schedule-tab">
        <div className="ed-schedule-error">{error}</div>
        <button onClick={loadShifts} className="ed-btn ed-btn-primary" style={{ marginTop: 16 }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="ed-schedule-tab">
      <div className="ed-schedule-header">
        <h2>My Schedule</h2>
        <div className="ed-schedule-controls">
          <div className="ed-schedule-view-toggle">
            <button
              className={`ed-view-btn ${viewMode === "upcoming" ? "ed-view-btn-active" : ""}`}
              onClick={() => setViewMode("upcoming")}
            >
              Upcoming
            </button>
            <button
              className={`ed-view-btn ${viewMode === "past" ? "ed-view-btn-active" : ""}`}
              onClick={() => setViewMode("past")}
            >
              Past
            </button>
            <button
              className={`ed-view-btn ${viewMode === "all" ? "ed-view-btn-active" : ""}`}
              onClick={() => setViewMode("all")}
            >
              All
            </button>
          </div>
          
          <div className="ed-schedule-display-toggle">
            <button
              className={`ed-display-btn ${displayMode === "list" ? "ed-display-btn-active" : ""}`}
              onClick={() => setDisplayMode("list")}
            >
              📋 List
            </button>
            <button
              className={`ed-display-btn ${displayMode === "calendar" ? "ed-display-btn-active" : ""}`}
              onClick={() => setDisplayMode("calendar")}
            >
              📅 Calendar
            </button>
          </div>
        </div>
      </div>

      <div className="ed-schedule-toolbar">
        <div className="ed-schedule-toolbar-left">
          <button
            className="ed-toolbar-btn"
            onClick={() => setCurrentWeekOffset(currentWeekOffset - 1)}
          >
            ← Previous Week
          </button>
          <span className="ed-week-indicator">
            Week {currentWeekOffset === 0 ? "(Current)" : currentWeekOffset > 0 ? `+${currentWeekOffset}` : currentWeekOffset}
          </span>
          <button
            className="ed-toolbar-btn"
            onClick={() => setCurrentWeekOffset(currentWeekOffset + 1)}
          >
            Next Week →
          </button>
          <button
            className="ed-toolbar-btn"
            onClick={() => setCurrentWeekOffset(0)}
          >
            Today
          </button>
        </div>
        
        <div className="ed-schedule-toolbar-right">
          <label className="ed-draft-toggle">
            <input
              type="checkbox"
              checked={showDraft}
              onChange={(e) => setShowDraft(e.target.checked)}
            />
            Show Draft
          </label>
          <button className="ed-toolbar-btn" onClick={handleExportSchedule}>
            📥 Export
          </button>
          <button className="ed-toolbar-btn" onClick={handlePrintSchedule}>
            🖨️ Print
          </button>
          <button
            className="ed-toolbar-btn ed-toolbar-btn-primary"
            onClick={() => setShowTimeOffModal(true)}
          >
            + Request Time Off
          </button>
        </div>
      </div>

      {/* Schedule Requests Status */}
      {scheduleRequests.filter(r => r.status === "pending").length > 0 && (
        <div className="ed-schedule-requests-banner">
          <strong>Pending Requests:</strong>{" "}
          {scheduleRequests.filter(r => r.status === "pending").length} request(s) awaiting manager approval
        </div>
      )}

      {displayMode === "calendar" && calendarData ? (
        <div className="ed-schedule-calendar">
          <div className="ed-calendar-header">
            <h3>{calendarData.month}</h3>
          </div>
          <div className="ed-calendar-grid">
            <div className="ed-calendar-weekdays">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="ed-calendar-weekday">
                  {day}
                </div>
              ))}
            </div>
            {calendarData.weeks.map((week, weekIdx) => (
              <div key={weekIdx} className="ed-calendar-week">
                {week.map((day, dayIdx) => {
                  const isToday = day.dateISO === toISODate(new Date());
                  const isPast = day.date < new Date() && !isToday;
                  
                  return (
                    <div
                      key={dayIdx}
                      className={`ed-calendar-day ${isToday ? "ed-calendar-day-today" : ""} ${isPast ? "ed-calendar-day-past" : ""}`}
                    >
                      <div className="ed-calendar-day-number">
                        {day.date.getDate()}
                        {isToday && <span className="ed-calendar-today-badge">Today</span>}
                      </div>
                      <div className="ed-calendar-day-shifts">
                        {day.shifts.map((shift) => (
                          <div key={shift.id} className="ed-calendar-shift">
                            <div className="ed-calendar-shift-time">
                              {formatTime(shift.startTime)}
                            </div>
                            <div className="ed-calendar-shift-role">{shift.slotLabel}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {filteredShifts.length === 0 ? (
            <div className="ed-schedule-empty">
              <div className="ed-empty-icon">📅</div>
              <h3>No shifts found</h3>
              <p>
                {viewMode === "upcoming"
                  ? "You don't have any upcoming shifts scheduled."
                  : viewMode === "past"
                  ? "You don't have any past shifts."
                  : "You don't have any shifts scheduled."}
              </p>
              <p className="ed-empty-subtext">
                Shifts will appear here once your manager publishes the schedule.
              </p>
            </div>
          ) : (
            <div className="ed-schedule-list">
              {sortedDates.map((dateISO) => {
                const dayShifts = shiftsByDate[dateISO];
                const date = parseISODate(dateISO);
                const isToday = dateISO === toISODate(new Date());
                const isPast = date && date < new Date() && !isToday;

                return (
                  <div key={dateISO} className={`ed-schedule-day ${isToday ? "ed-schedule-day-today" : ""} ${isPast ? "ed-schedule-day-past" : ""}`}>
                    <div className="ed-schedule-day-header">
                      <div className="ed-schedule-day-date">
                        <div className="ed-schedule-day-name">{dayNameFull(date)}</div>
                        <div className="ed-schedule-day-number">{formatMMDD(date)}</div>
                      </div>
                      <div className="ed-schedule-day-actions">
                        {isToday && <span className="ed-schedule-day-badge">Today</span>}
                        {dayShifts[0]?.status === "draft" && (
                          <span className="ed-schedule-draft-badge">Draft</span>
                        )}
                      </div>
                    </div>

                    <div className="ed-schedule-shifts">
                      {dayShifts.map((shift) => (
                        <div key={shift.id} className="ed-schedule-shift">
                          <div className="ed-schedule-shift-main">
                            <div>
                              <div className="ed-schedule-shift-role">{shift.slotLabel}</div>
                              <div className="ed-schedule-shift-time">
                                {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                              </div>
                            </div>
                            <div className="ed-schedule-shift-actions">
                              {!isPast && (
                                <button
                                  className="ed-shift-action-btn"
                                  onClick={() => {
                                    setSelectedShift(shift);
                                    setShowSwapModal(true);
                                  }}
                                  title="Request shift swap"
                                >
                                  🔄
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="ed-schedule-shift-meta">
                            <span className="ed-schedule-shift-side">
                              {shift.side === "foh" ? "Front of House" : "Back of House"}
                            </span>
                            <span className="ed-schedule-shift-hours">{shift.hours} hours</span>
                          </div>
                          {(shift.notes || shift.slotNotes) && (
                            <div className="ed-schedule-shift-notes">
                              <strong>Notes:</strong> {shift.notes || shift.slotNotes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <div className="ed-schedule-footer">
        <p className="ed-schedule-note">
          Showing {filteredShifts.length} shift{filteredShifts.length !== 1 ? "s" : ""} ({viewMode} view)
          {showDraft && " • Including draft schedules"}
        </p>
        <p className="ed-schedule-note-sub">
          Schedules are updated when your manager publishes the weekly schedule.
        </p>
      </div>

      {/* Time-Off Request Modal */}
      {showTimeOffModal && (
        <div className="ed-modal-overlay" onClick={() => setShowTimeOffModal(false)}>
          <div className="ed-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ed-modal-header">
              <h3>Request Time Off</h3>
              <button className="ed-close-btn" onClick={() => setShowTimeOffModal(false)}>
                ×
              </button>
            </div>
            <div className="ed-modal-body">
              <div className="ed-form-group">
                <label>Date</label>
                <input
                  type="date"
                  value={timeOffDate}
                  onChange={(e) => setTimeOffDate(e.target.value)}
                  min={toISODate(new Date())}
                  className="ed-form-input"
                />
              </div>
              <div className="ed-form-group">
                <label>Reason (Optional)</label>
                <textarea
                  value={timeOffReason}
                  onChange={(e) => setTimeOffReason(e.target.value)}
                  placeholder="e.g., Personal appointment, Family event..."
                  className="ed-form-textarea"
                  rows={3}
                />
              </div>
              <div className="ed-modal-footer">
                <button
                  className="ed-btn ed-btn-secondary"
                  onClick={() => setShowTimeOffModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="ed-btn ed-btn-primary"
                  onClick={handleRequestTimeOff}
                >
                  Submit Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shift Swap Request Modal */}
      {showSwapModal && selectedShift && (
        <div className="ed-modal-overlay" onClick={() => setShowSwapModal(false)}>
          <div className="ed-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ed-modal-header">
              <h3>Request Shift Swap</h3>
              <button className="ed-close-btn" onClick={() => setShowSwapModal(false)}>
                ×
              </button>
            </div>
            <div className="ed-modal-body">
              <div className="ed-form-group">
                <label>Current Shift</label>
                <div className="ed-form-readonly">
                  {dayNameFull(selectedShift.date)} - {selectedShift.slotLabel} ({formatTime(selectedShift.startTime)} - {formatTime(selectedShift.endTime)})
                </div>
              </div>
              <div className="ed-form-group">
                <label>Swap To Date</label>
                <input
                  type="date"
                  value={swapTargetDate}
                  onChange={(e) => setSwapTargetDate(e.target.value)}
                  min={toISODate(new Date())}
                  className="ed-form-input"
                />
              </div>
              <div className="ed-form-group">
                <label>Swap To Position</label>
                <select
                  value={swapTargetSlot}
                  onChange={(e) => setSwapTargetSlot(e.target.value)}
                  className="ed-form-select"
                >
                  <option value="">Select position...</option>
                  {SLOT_DEFS.map((slot) => (
                    <option key={slot.id} value={slot.id}>
                      {slot.label} ({formatTime(slot.startTime)} - {formatTime(slot.endTime)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="ed-form-group">
                <label>Reason (Optional)</label>
                <textarea
                  value={swapReason}
                  onChange={(e) => setSwapReason(e.target.value)}
                  placeholder="Explain why you need to swap..."
                  className="ed-form-textarea"
                  rows={3}
                />
              </div>
              <div className="ed-modal-footer">
                <button
                  className="ed-btn ed-btn-secondary"
                  onClick={() => setShowSwapModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="ed-btn ed-btn-primary"
                  onClick={handleRequestShiftSwap}
                  disabled={!swapTargetDate || !swapTargetSlot}
                >
                  Submit Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}