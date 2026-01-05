// src/pages/Signup/SignupSelection.jsx
//
// SIGNUP SELECTION PAGE
//
// First step in signup - user selects Restaurant or Valet Company

import React from "react";
import { Link, useNavigate } from "react-router-dom";
import lineupLogo from "../../assets/logos/the_lineup_logo.png";
import "./SignupSelection.css";

export default function SignupSelection() {
  const navigate = useNavigate();

  return (
    <div className="signup-selection-page">
      <img src={lineupLogo} className="signup-selection-logo" alt="The Lineup" />
      
      <div className="signup-selection-card">
        <h1 className="signup-selection-title">Create Account</h1>
        <p className="signup-selection-subtitle">Select your account type</p>

        <div className="signup-selection-options">
          <button
            className="signup-selection-option"
            onClick={() => navigate("/signup/restaurant")}
          >
            <div className="signup-selection-option-icon">🏢</div>
            <div className="signup-selection-option-content">
              <h3>Restaurant</h3>
              <p>For restaurant owners and operators</p>
            </div>
          </button>

          <button
            className="signup-selection-option"
            onClick={() => navigate("/signup/valet-company")}
          >
            <div className="signup-selection-option-icon">🚗</div>
            <div className="signup-selection-option-content">
              <h3>Valet Company</h3>
              <p>For valet service providers</p>
            </div>
          </button>
        </div>

        <div className="signup-selection-footer">
          <p>
            Already have an account?{" "}
            <Link to="/login" className="signup-selection-link">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}








