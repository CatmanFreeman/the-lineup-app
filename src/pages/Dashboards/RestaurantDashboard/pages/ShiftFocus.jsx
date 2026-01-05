// src/pages/Dashboards/RestaurantDashboard/pages/ShiftFocus.jsx

import React from "react";
import { useNavigate } from "react-router-dom";

import MetricCard from "../../../../components/MetricCard";
import "./ShiftFocus.css";

export default function ShiftFocus() {
  const navigate = useNavigate();

  return (
    <div className="shift-focus-wrapper">
      {/* Header */}
      <div className="shift-focus-header">
        <h1>Shift Focus</h1>
        <button className="back-link" onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>

      {/* Focus Summary */}
      <MetricCard
        title="Primary Focus"
        value="Alcohol Mix"
        subtext="Below target — promote cocktails + add-ons"
        status="warning"
      >
        <div className="focus-description">
          <p>
            Alcohol mix is currently trending below target. Recommended actions
            include server drink callouts, featured cocktail reminders, and bar
            pacing checks.
          </p>
        </div>
      </MetricCard>

      {/* Targets */}
      <div className="focus-grid">
        <MetricCard title="Alcohol Mix" value="32%" subtext="Target: 35%" status="warning" />
        <MetricCard title="Labor %" value="29%" subtext="Target: 30%" status="good" />
        <MetricCard title="Waste %" value="4.6%" subtext="Target: 4.0%" status="danger" />
        <MetricCard title="To-Go Orders" value="14" subtext="Normal Range" status="info" />
      </div>

      {/* Suggested Actions */}
      <MetricCard title="Suggested Actions" value="Manager + FOH">
        <ul className="focus-actions">
          <li>Run cocktail feature callout to servers</li>
          <li>Highlight featured cocktail on POS</li>
          <li>Confirm bar citrus + ice prep</li>
          <li>Remind servers to suggest first-round drinks</li>
        </ul>
      </MetricCard>
    </div>
  );
}
