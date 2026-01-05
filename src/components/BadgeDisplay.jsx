// src/components/BadgeDisplay.jsx

import React from "react";
import "./BadgeDisplay.css";

/**
 * BadgeDisplay - Individual badge component
 * Supports tenure badges with number overlay
 */
export default function BadgeDisplay({
  badge,
  size = "medium", // "small" | "medium" | "large"
  showName = false,
  showTooltip = true,
  onClick = null,
}) {
  const sizeClasses = {
    small: "badge-display-small",
    medium: "badge-display-medium",
    large: "badge-display-large",
  };

  const badgeClass = `badge-display ${sizeClasses[size]} ${onClick ? "badge-display-clickable" : ""}`;

  // For tenure badges, show number overlay
  const isTenureBadge = badge?.category === "tenure" || badge?.yearsOfService !== undefined;
  const tenureNumber = badge?.yearsOfService !== undefined 
    ? badge.yearsOfService 
    : badge?.name?.match(/\d+/)?.[0];

  const tooltipText = showTooltip
    ? `${badge?.name || "Badge"}\n${badge?.description || ""}`
    : null;

  return (
    <div
      className={badgeClass}
      style={{
        backgroundColor: badge?.color || "#6b7280",
      }}
      onClick={onClick}
      title={tooltipText}
    >
      <div className="badge-icon">{badge?.icon || "🏆"}</div>
      
      {isTenureBadge && tenureNumber !== undefined && (
        <div className="badge-number-overlay">
          {tenureNumber === 0 ? "NEW" : tenureNumber}
        </div>
      )}

      {showName && (
        <div className="badge-name">{badge?.name || "Badge"}</div>
      )}

      {/* Rarity indicator */}
      {badge?.rarity >= 4 && (
        <div className="badge-glow" data-rarity={badge.rarity} />
      )}
    </div>
  );
}