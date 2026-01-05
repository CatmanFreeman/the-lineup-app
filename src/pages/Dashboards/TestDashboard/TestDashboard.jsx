// src/pages/Dashboards/TestDashboard/TestDashboard.jsx
import React from "react";
import { Link } from "react-router-dom";
import "./TestDashboard.css";

export default function TestDashboard() {
  // Test IDs - always available for testing
  const COMPANY_ID = "company-demo";
  const RESTAURANT_ID = "restaurant-demo"; // Use a demo restaurant ID or first available
  const VALET_COMPANY_ID = "valet-company-123"; // Valet company ID for testing

  return (
    <div className="test-dashboard">
      <div className="test-dashboard-container">
        <h1>Test Dashboard</h1>
        <p className="test-dashboard-subtitle">Access all available dashboards</p>
        
        <div className="dashboard-links">
          <div className="dashboard-link-card">
            <h2>Company Dashboard</h2>
            <p>Corporate level dashboard for managing multiple restaurants</p>
            <Link 
              to={`/dashboard/company/${COMPANY_ID}`}
              className="dashboard-link-btn"
            >
              Test Company Dashboard
            </Link>
          </div>

          <div className="dashboard-link-card">
            <h2>Restaurant Dashboard</h2>
            <p>Restaurant management dashboard</p>
            <Link 
              to={`/restaurant/${RESTAURANT_ID}`}
              className="dashboard-link-btn"
            >
              Test Restaurant Dashboard
            </Link>
          </div>

          <div className="dashboard-link-card">
            <h2>Employee Dashboard</h2>
            <p>Employee/staff dashboard</p>
            <Link 
              to={`/dashboard/employee/${RESTAURANT_ID}`}
              className="dashboard-link-btn"
            >
              Test Employee Dashboard
            </Link>
          </div>

          <div className="dashboard-link-card">
            <h2>Valet Driver Dashboard</h2>
            <p>Valet driver dashboard</p>
            <Link 
              to={`/dashboard/valet/${RESTAURANT_ID}?test=true`}
              className="dashboard-link-btn"
            >
              Test Valet Driver Dashboard
            </Link>
          </div>

          <div className="dashboard-link-card">
            <h2>Valet Company Dashboard</h2>
            <p>Valet company management dashboard</p>
            <Link 
              to={`/dashboard/valet-company/${VALET_COMPANY_ID}?test=true`}
              className="dashboard-link-btn"
            >
              Test Valet Company Dashboard
            </Link>
          </div>

          <div className="dashboard-link-card">
            <h2>Fulton Alley Dashboard</h2>
            <p>Bowling restaurant dashboard</p>
            <Link 
              to="/restaurant/fulton-alley"
              className="dashboard-link-btn"
            >
              View Fulton Alley Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

