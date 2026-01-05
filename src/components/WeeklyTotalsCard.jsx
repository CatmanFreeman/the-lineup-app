// src/components/WeeklyTotalsCard.jsx

import React, { useState, useEffect } from "react";
import { getEmployeeWeeklyHours, getWeekEndingISO } from "../utils/hoursService";
import { getEmployeeWeeklyTipShare } from "../utils/tipshareService";
import "./WeeklyTotalsCard.css";

export default function WeeklyTotalsCard({ employeeId, restaurantId }) {
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(0);
  const [shiftCount, setShiftCount] = useState(0);
  const [tipShare, setTipShare] = useState(0);
  const [weekRange, setWeekRange] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!employeeId || !restaurantId) {
      setLoading(false);
      return;
    }

    async function loadWeeklyTotals() {
      setLoading(true);
      setError(null);

      try {
        const weekEndingISO = getWeekEndingISO();
        const weekEnd = new Date(weekEndingISO);
        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() - 6);

        // Load hours
        const hoursData = await getEmployeeWeeklyHours(
          employeeId,
          restaurantId,
          weekEndingISO
        );
        setHours(hoursData.totalHours);
        setShiftCount(hoursData.shiftCount);

        // Load TipShare
        const tipShareData = await getEmployeeWeeklyTipShare(
          employeeId,
          weekEndingISO
        );
        setTipShare(tipShareData);

        // Set week range
        setWeekRange(
          `${weekStart.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })} - ${weekEnd.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}`
        );
      } catch (err) {
        console.error("Error loading weekly totals:", err);
        setError("Failed to load weekly totals");
      } finally {
        setLoading(false);
      }
    }

    loadWeeklyTotals();
  }, [employeeId, restaurantId]);

  if (loading) {
    return (
      <div className="wt-card">
        <div className="wt-card-header">
          <h3>Weekly Totals</h3>
        </div>
        <div className="wt-card-body">
          <div className="wt-loading">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wt-card">
        <div className="wt-card-header">
          <h3>Weekly Totals</h3>
        </div>
        <div className="wt-card-body">
          <div className="wt-error">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="wt-card">
      <div className="wt-card-header">
        <h3>Weekly Totals</h3>
        <div className="wt-week-range">{weekRange}</div>
      </div>
      <div className="wt-card-body">
        <div className="wt-metrics">
          <div className="wt-metric">
            <div className="wt-metric-label">Hours Worked</div>
            <div className="wt-metric-value">{hours.toFixed(1)}</div>
            <div className="wt-metric-sub">{shiftCount} shift{shiftCount !== 1 ? "s" : ""}</div>
          </div>
          <div className="wt-divider" />
          <div className="wt-metric">
            <div className="wt-metric-label">TipShare Collected</div>
            <div className="wt-metric-value">${tipShare.toFixed(2)}</div>
            <div className="wt-metric-sub">This week</div>
          </div>
        </div>
      </div>
    </div>
  );
}