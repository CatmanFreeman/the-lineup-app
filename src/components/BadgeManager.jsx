// src/components/BadgeManager.jsx

import React, { useState, useEffect, useCallback } from "react";
import {
  awardBadge,
  awardRestaurantBadge,
  getUserBadges,
  getRestaurantBadges,
  approveBadge,
} from "../utils/badgeService";
import {
  getManagerAwardableBadges,
  getRestaurantBadgeTemplates,
} from "../utils/badgeLibrary";
import BadgeDisplay from "./BadgeDisplay";
import "./BadgeManager.css";

export default function BadgeManager({
  mode = "employee", // "employee" | "restaurant"
  restaurantId,
  companyId,
  employeeId = null,
  onAwarded = null,
}) {
  const [availableBadges, setAvailableBadges] = useState([]);
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [awarding, setAwarding] = useState(false);
  const [pendingBadges, setPendingBadges] = useState([]);

  const loadAvailableBadges = useCallback(() => {
    if (mode === "employee") {
      const badges = getManagerAwardableBadges();
      setAvailableBadges(badges);
    } else if (mode === "restaurant") {
      const badges = getRestaurantBadgeTemplates();
      setAvailableBadges(badges);
    }
  }, [mode]);

  const loadPendingBadges = useCallback(async () => {
    if (!employeeId) return;

    try {
      const allBadges = await getUserBadges(employeeId, { restaurantId });
      const pending = allBadges.filter((b) => b.status === "pending");
      setPendingBadges(pending);
    } catch (error) {
      console.error("Error loading pending badges:", error);
    }
  }, [employeeId, restaurantId]);

  useEffect(() => {
    loadAvailableBadges();
    if (mode === "employee" && employeeId) {
      loadPendingBadges();
    }
  }, [mode, employeeId, loadAvailableBadges, loadPendingBadges]);

  const handleAwardClick = (badge) => {
    setSelectedBadge(badge);
    setShowAwardModal(true);
  };

  const handleAward = async () => {
    if (!selectedBadge) return;

    setAwarding(true);
    try {
      if (mode === "employee" && employeeId) {
        await awardBadge({
          badgeId: selectedBadge.id,
          badgeData: selectedBadge,
          userId: employeeId,
          restaurantId,
          companyId,
          awardedBy: "manager",
          requiresApproval: selectedBadge.requiresApproval || false,
        });
      } else if (mode === "restaurant" && restaurantId) {
        await awardRestaurantBadge({
          badgeId: selectedBadge.id,
          badgeData: selectedBadge,
          restaurantId,
          companyId,
          awardedBy: "company",
        });
      }

      setShowAwardModal(false);
      setSelectedBadge(null);
      onAwarded?.();
    } catch (error) {
      console.error("Error awarding badge:", error);
      alert(`Failed to award badge: ${error.message}`);
    } finally {
      setAwarding(false);
    }
  };

  const handleApprove = async (badgeId) => {
    try {
      await approveBadge(employeeId, badgeId, "manager");
      await loadPendingBadges();
      onAwarded?.();
    } catch (error) {
      console.error("Error approving badge:", error);
      alert(`Failed to approve badge: ${error.message}`);
    }
  };

  return (
    <div className="badge-manager">
      {pendingBadges.length > 0 && (
        <div className="badge-manager-pending">
          <h4>Pending Approval</h4>
          <div className="badge-manager-pending-list">
            {pendingBadges.map((badge) => (
              <div key={badge.id} className="badge-manager-pending-item">
                <BadgeDisplay badge={badge} size="small" />
                <div className="badge-manager-pending-info">
                  <div className="badge-manager-pending-name">{badge.name}</div>
                  <div className="badge-manager-pending-desc">
                    {badge.description}
                  </div>
                </div>
                <button
                  className="badge-manager-approve-btn"
                  onClick={() => handleApprove(badge.id)}
                >
                  Approve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="badge-manager-available">
        <h4>Award Badge</h4>
        <div className="badge-manager-grid">
          {availableBadges.map((badge) => (
            <div
              key={badge.id}
              className="badge-manager-item"
              onClick={() => handleAwardClick(badge)}
            >
              <BadgeDisplay badge={badge} size="medium" />
              <div className="badge-manager-item-name">{badge.name}</div>
              {badge.requiresApproval && (
                <div className="badge-manager-requires-approval">
                  Requires Approval
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {showAwardModal && selectedBadge && (
        <div
          className="badge-manager-modal-overlay"
          onClick={() => setShowAwardModal(false)}
        >
          <div
            className="badge-manager-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="badge-manager-modal-header">
              <h3>Award Badge</h3>
              <button
                className="badge-manager-modal-close"
                onClick={() => setShowAwardModal(false)}
              >
                ×
              </button>
            </div>
            <div className="badge-manager-modal-body">
              <div className="badge-manager-modal-badge">
                <BadgeDisplay badge={selectedBadge} size="large" />
              </div>
              <div className="badge-manager-modal-info">
                <h4>{selectedBadge.name}</h4>
                <p>{selectedBadge.description}</p>
                {selectedBadge.requiresApproval && (
                  <div className="badge-manager-modal-warning">
                    ⚠️ This badge requires approval before it becomes active.
                  </div>
                )}
              </div>
            </div>
            <div className="badge-manager-modal-footer">
              <button
                className="badge-manager-btn badge-manager-btn-secondary"
                onClick={() => setShowAwardModal(false)}
                disabled={awarding}
              >
                Cancel
              </button>
              <button
                className="badge-manager-btn badge-manager-btn-primary"
                onClick={handleAward}
                disabled={awarding}
              >
                {awarding ? "Awarding..." : "Award Badge"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}