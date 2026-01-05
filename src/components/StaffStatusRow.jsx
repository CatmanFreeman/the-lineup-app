import React from "react";
import "./StaffStatusRow.css";

/**
 * Props:
 * - name (string)
 * - role (string)
 * - statusLabel (string)  // "On Shift", "Late", "No Show", etc.
 * - statusType (string)   // "onShift" | "late" | "noShow" | "onBreak" | "calledOut"
 * - icon (image / svg)
 */

export default function StaffStatusRow({
  name,
  role,
  statusLabel,
  statusType,
  icon,
}) {
  return (
    <div className="staff-status-row">
      <div className="staff-info">
        <div className="staff-name">{name}</div>
        <div className="staff-role">{role}</div>
      </div>

      <div className="status-pill-col">
        <span className={`status-pill ${statusType}`}>
          {statusLabel}
        </span>
      </div>

      <div className="status-icon-col">
        {icon && <img src={icon} alt={statusLabel} />}
      </div>
    </div>
  );
}
