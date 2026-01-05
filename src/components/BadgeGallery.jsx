// src/components/BadgeGallery.jsx

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getUserBadges,
  getDinerBadges,
  getEmployeeBadges,
} from "../utils/badgeService";
import BadgeDisplay from "./BadgeDisplay";
import "./BadgeGallery.css";

export default function BadgeGallery({
  userId = null,
  restaurantId = null,
  viewMode = "all", // "all" | "diner" | "employee"
  maxDisplay = null,
  showEmpty = true,
}) {
  const { currentUser } = useAuth();
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBadge, setSelectedBadge] = useState(null);

  const targetUserId = userId || currentUser?.uid;

  const loadBadges = useCallback(async () => {
    if (!targetUserId) return;

    setLoading(true);
    try {
      let loadedBadges = [];

      if (viewMode === "diner") {
        loadedBadges = await getDinerBadges(targetUserId);
      } else if (viewMode === "employee") {
        loadedBadges = await getEmployeeBadges(targetUserId, restaurantId);
      } else {
        loadedBadges = await getUserBadges(targetUserId, { restaurantId });
      }

      setBadges(loadedBadges);
    } catch (error) {
      console.error("Error loading badges:", error);
      setBadges([]);
    } finally {
      setLoading(false);
    }
  }, [targetUserId, restaurantId, viewMode]);

  useEffect(() => {
    if (!targetUserId) {
      setLoading(false);
      return;
    }

    loadBadges();
  }, [targetUserId, restaurantId, viewMode, loadBadges]);

  const displayBadges = maxDisplay ? badges.slice(0, maxDisplay) : badges;

  if (loading) {
    return (
      <div className="badge-gallery-loading">
        <div className="badge-gallery-spinner">Loading badges...</div>
      </div>
    );
  }

  if (badges.length === 0 && showEmpty) {
    return (
      <div className="badge-gallery-empty">
        <div className="badge-gallery-empty-icon">🏆</div>
        <div className="badge-gallery-empty-text">No badges yet</div>
        <div className="badge-gallery-empty-subtext">
          Start earning badges by using The Lineup!
        </div>
      </div>
    );
  }

  return (
    <div className="badge-gallery">
      {displayBadges.length > 0 && (
        <div className="badge-gallery-grid">
          {displayBadges.map((badge) => (
            <div
              key={badge.id}
              className="badge-gallery-item"
              onClick={() => setSelectedBadge(badge)}
            >
              <BadgeDisplay badge={badge} size="medium" showTooltip={true} />
            </div>
          ))}
        </div>
      )}

      {maxDisplay && badges.length > maxDisplay && (
        <div className="badge-gallery-more">
          +{badges.length - maxDisplay} more badges
        </div>
      )}

      {selectedBadge && (
        <BadgeDetailModal
          badge={selectedBadge}
          onClose={() => setSelectedBadge(null)}
        />
      )}
    </div>
  );
}

function BadgeDetailModal({ badge, onClose }) {
  const rarityLabels = {
    1: "Common",
    2: "Uncommon",
    3: "Rare",
    4: "Epic",
    5: "Legendary",
  };

  return (
    <div className="badge-modal-overlay" onClick={onClose}>
      <div className="badge-modal" onClick={(e) => e.stopPropagation()}>
        <div className="badge-modal-header">
          <h3>Badge Details</h3>
          <button className="badge-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="badge-modal-body">
          <div className="badge-modal-badge">
            <BadgeDisplay badge={badge} size="large" />
          </div>
          <div className="badge-modal-info">
            <h4>{badge.name}</h4>
            <p className="badge-modal-description">{badge.description}</p>
            <div className="badge-modal-meta">
              <div className="badge-modal-meta-item">
                <span className="badge-modal-label">Rarity:</span>
                <span className="badge-modal-value">
                  {rarityLabels[badge.rarity] || "Common"}
                </span>
              </div>
              {badge.pointsValue > 0 && (
                <div className="badge-modal-meta-item">
                  <span className="badge-modal-label">Points:</span>
                  <span className="badge-modal-value">+{badge.pointsValue}</span>
                </div>
              )}
              {badge.awardedAt && (
                <div className="badge-modal-meta-item">
                  <span className="badge-modal-label">Earned:</span>
                  <span className="badge-modal-value">
                    {badge.awardedAt.toDate
                      ? badge.awardedAt.toDate().toLocaleDateString()
                      : new Date(badge.awardedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}