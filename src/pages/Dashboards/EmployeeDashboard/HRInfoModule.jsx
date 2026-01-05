// src/pages/Dashboards/EmployeeDashboard/HRInfoModule.jsx
//
// HR INFO MODULE - Employee Dashboard Overview
//
// Shows next shift and other HR-related information

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from "firebase/firestore";
import { db } from "../../../hooks/services/firebase";
import "./HRInfoModule.css";

export default function HRInfoModule({ employeeUid, restaurantId, employeeName }) {
  const [nextShift, setNextShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingTasks, setPendingTasks] = useState(0);

  useEffect(() => {
    if (!employeeUid || !restaurantId) {
      setLoading(false);
      return;
    }

    loadHRInfo();
  }, [employeeUid, restaurantId]);

  const loadHRInfo = async () => {
    try {
      setLoading(true);

      // Get upcoming schedules
      const schedulesRef = collection(db, "restaurants", restaurantId, "schedules");
      const now = new Date();
      const schedulesQuery = query(
        schedulesRef,
        where("status", "==", "published"),
        orderBy("weekStartDate", "asc")
      );
      const schedulesSnap = await getDocs(schedulesQuery);

      let foundShift = null;
      const allShifts = [];

      schedulesSnap.docs.forEach((scheduleDoc) => {
        const scheduleData = scheduleDoc.data();
        const weekStart = scheduleData.weekStartDate?.toDate?.() || new Date(scheduleData.weekStartDate);
        
        // Check each day in the schedule
        if (scheduleData.days) {
          Object.keys(scheduleData.days).forEach((dayKey) => {
            const dayData = scheduleData.days[dayKey];
            if (dayData.slots) {
              Object.keys(dayData.slots).forEach((slotId) => {
                const slot = dayData.slots[slotId];
                if (slot.assignedEmployees && slot.assignedEmployees.includes(employeeUid)) {
                  // Calculate the actual date for this shift
                  const dayIndex = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].indexOf(dayKey.toLowerCase());
                  if (dayIndex !== -1) {
                    const shiftDate = new Date(weekStart);
                    shiftDate.setDate(shiftDate.getDate() + dayIndex);
                    
                    // Parse time
                    const [startHour, startMin] = slot.startTime?.split(":") || [0, 0];
                    const shiftDateTime = new Date(shiftDate);
                    shiftDateTime.setHours(parseInt(startHour), parseInt(startMin), 0, 0);

                    if (shiftDateTime > now) {
                      allShifts.push({
                        date: shiftDateTime,
                        day: dayKey,
                        startTime: slot.startTime,
                        endTime: slot.endTime,
                        slotLabel: slot.label || slotId,
                        scheduleId: scheduleDoc.id,
                      });
                    }
                  }
                }
              });
            }
          });
        }
      });

      // Sort by date and get the next one
      allShifts.sort((a, b) => a.date - b.date);
      if (allShifts.length > 0) {
        foundShift = allShifts[0];
      }

      setNextShift(foundShift);

      // Count pending onboarding tasks
      try {
        const staffRef = collection(db, "restaurants", restaurantId, "staff");
        const staffQuery = query(staffRef, where("uid", "==", employeeUid), limit(1));
        const staffSnap = await getDocs(staffQuery);
        
        if (!staffSnap.empty) {
          const staffData = staffSnap.docs[0].data();
          if (staffData.onboardingPackageId) {
            const onboardingRef = doc(db, "restaurants", restaurantId, "onboardingPackages", staffData.onboardingPackageId);
            const onboardingSnap = await getDoc(onboardingRef);
            if (onboardingSnap.exists()) {
              const onboardingData = onboardingSnap.data();
              // Count incomplete tasks
              const incomplete = (onboardingData.checklist || []).filter(
                (item) => !item.completed
              ).length;
              setPendingTasks(incomplete);
            }
          }
        }
      } catch (err) {
        console.warn("Could not load pending tasks:", err);
      }
    } catch (error) {
      console.error("Error loading HR info:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return "";
    const d = date instanceof Date ? date : date.toDate();
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (d.toDateString() === today.toDateString()) {
      return "Today";
    } else if (d.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow";
    } else {
      return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    const [hour, min] = timeStr.split(":");
    const h = parseInt(hour);
    const period = h >= 12 ? "PM" : "AM";
    const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${displayHour}:${min} ${period}`;
  };

  if (loading) {
    return (
      <div className="hr-info-module">
        <div className="hr-info-header">
          <h3>HR Info</h3>
        </div>
        <div className="hr-info-body">
          <div className="hr-info-loading">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="hr-info-module">
      <div className="hr-info-header">
        <h3>HR Info</h3>
        <Link
          to={`/dashboard/employee/${restaurantId}?tab=hr`}
          className="hr-info-link"
        >
          View All →
        </Link>
      </div>
      <div className="hr-info-body">
        {nextShift ? (
          <div className="hr-info-section">
            <div className="hr-info-label">Next Shift</div>
            <div className="hr-info-next-shift">
              <div className="next-shift-date">{formatDate(nextShift.date)}</div>
              <div className="next-shift-time">
                {formatTime(nextShift.startTime)} - {formatTime(nextShift.endTime)}
              </div>
              <div className="next-shift-role">{nextShift.slotLabel}</div>
            </div>
          </div>
        ) : (
          <div className="hr-info-section">
            <div className="hr-info-label">Next Shift</div>
            <div className="hr-info-empty">No upcoming shifts scheduled</div>
          </div>
        )}

        {pendingTasks > 0 && (
          <div className="hr-info-section hr-info-section-warning">
            <div className="hr-info-label">Pending Tasks</div>
            <div className="hr-info-pending">
              <span className="pending-count">{pendingTasks}</span>
              <span className="pending-label">onboarding task{pendingTasks !== 1 ? "s" : ""} remaining</span>
            </div>
            <Link
              to={`/dashboard/employee/${restaurantId}?tab=hr&section=onboarding`}
              className="hr-info-action"
            >
              Complete Tasks →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

