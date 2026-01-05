// src/pages/Dashboards/CompanyDashboard/AlertKeyModule.jsx
//
// ALERT KEY MODULE - Command Center
//
// Shows what the status colors mean

import React, { useState } from "react";
import "./AlertKeyModule.css";

export default function AlertKeyModule() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="alert-key-module">
      <div className="alert-key-header" onClick={() => setExpanded(!expanded)}>
        <h3>Status Key</h3>
        <span className="alert-key-toggle">{expanded ? "−" : "+"}</span>
      </div>
      {expanded && (
        <div className="alert-key-body">
          <div className="alert-key-item">
            <span className="status-badge operational"></span>
            <div className="alert-key-info">
              <div className="alert-key-label">Operational</div>
              <div className="alert-key-desc">Restaurant is running normally</div>
            </div>
          </div>
          <div className="alert-key-item">
            <span className="status-badge warning"></span>
            <div className="alert-key-info">
              <div className="alert-key-label">Warning</div>
              <div className="alert-key-desc">Restaurant needs attention</div>
            </div>
          </div>
          <div className="alert-key-item">
            <span className="status-badge error"></span>
            <div className="alert-key-info">
              <div className="alert-key-label">Error</div>
              <div className="alert-key-desc">Restaurant has an issue</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}








