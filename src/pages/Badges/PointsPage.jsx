// src/pages/Badges/PointsPage.jsx
// LINEUP POINTS & BADGES PAGE

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "../../hooks/services/firebase";
import { getPointsBalance, getPointTransactions, POINT_ACTION, POINT_VALUES } from "../../utils/pointsService";
import { getUserBadges } from "../../utils/badgeService";
import PointsDisplay from "../../components/PointsDisplay";
import BadgeGallery from "../../components/BadgeGallery";
import "./PointsPage.css";

export default function PointsPage() {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState("points"); // "points" or "badges"
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    loadPointsData();
    loadTransactions();
    loadOpportunities();
    loadNotifications();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadPointsData();
      loadTransactions();
      loadNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, [currentUser]);

  const loadPointsData = async () => {
    try {
      const balance = await getPointsBalance(currentUser.uid);
      setPoints(balance.total || 0);
    } catch (err) {
      console.error("Error loading points:", err);
      setPoints(0);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      const txn = await getPointTransactions(currentUser.uid, 50);
      setTransactions(txn);
    } catch (err) {
      console.error("Error loading transactions:", err);
      setTransactions([]);
    }
  };

  const loadOpportunities = async () => {
    try {
      // All point opportunities
      const opps = [
        {
          id: "review",
          action: POINT_ACTION.REVIEW,
          label: "Write a Review",
          points: POINT_VALUES[POINT_ACTION.REVIEW],
          description: "Earn points by reviewing restaurants",
        },
        {
          id: "check_in",
          action: POINT_ACTION.CHECK_IN,
          label: "Check In",
          points: POINT_VALUES[POINT_ACTION.CHECK_IN],
          description: "Earn points when you check in at restaurants",
        },
        {
          id: "photo_upload",
          action: POINT_ACTION.PHOTO_UPLOAD,
          label: "Upload Photos",
          points: POINT_VALUES[POINT_ACTION.PHOTO_UPLOAD],
          description: "Earn points by uploading restaurant photos",
        },
        {
          id: "tip",
          action: POINT_ACTION.TIP,
          label: "Tip Staff",
          points: POINT_VALUES[POINT_ACTION.TIP],
          description: "Earn points when you tip staff members",
        },
        {
          id: "reservation",
          action: POINT_ACTION.RESERVATION,
          label: "Make Reservations",
          points: POINT_VALUES[POINT_ACTION.RESERVATION],
          description: "Earn points for making reservations",
        },
        {
          id: "punch_in",
          action: POINT_ACTION.PUNCH_IN,
          label: "Punch In",
          points: POINT_VALUES[POINT_ACTION.PUNCH_IN],
          description: "Earn points when you punch in for your shift",
        },
        {
          id: "shift_complete",
          action: POINT_ACTION.SHIFT_COMPLETE,
          label: "Complete Shift",
          points: POINT_VALUES[POINT_ACTION.SHIFT_COMPLETE],
          description: "Earn points when you complete a full shift",
        },
        {
          id: "shift_game",
          action: POINT_ACTION.SHIFT_GAME,
          label: "Participate in Shift Games",
          points: POINT_VALUES[POINT_ACTION.SHIFT_GAME],
          description: "Earn points by participating in active shift games",
        },
      ];

      setOpportunities(opps);
    } catch (err) {
      console.error("Error loading opportunities:", err);
      setOpportunities([]);
    }
  };

  const loadNotifications = async () => {
    try {
      const notificationsRef = collection(db, "notifications");
      const notificationsQuery = query(
        notificationsRef,
        where("userId", "==", currentUser.uid),
        where("type", "in", ["points_earned", "badge_earned"]),
        orderBy("createdAt", "desc"),
        limit(10)
      );
      const notificationsSnap = await getDocs(notificationsQuery);
      const notifs = notificationsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setNotifications(notifs);
    } catch (err) {
      // If query fails (e.g., missing index), try without orderBy
      try {
        const notificationsRef = collection(db, "notifications");
        const notificationsQuery = query(
          notificationsRef,
          where("userId", "==", currentUser.uid),
          limit(50)
        );
        const notificationsSnap = await getDocs(notificationsQuery);
        const notifs = notificationsSnap.docs
          .map((d) => ({
            id: d.id,
            ...d.data(),
          }))
          .filter((n) => n.type === "points_earned" || n.type === "badge_earned")
          .sort((a, b) => {
            const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
            const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
            return bTime - aTime;
          })
          .slice(0, 10);

        setNotifications(notifs);
      } catch (fallbackErr) {
        console.error("Error loading notifications:", fallbackErr);
        setNotifications([]);
      }
    }
  };

  const getNextMilestone = (currentPoints) => {
    const milestones = [500, 1000, 1500, 2000, 2500, 3000, 5000, 10000];
    const nextMilestone = milestones.find((m) => m > currentPoints);
    
    if (!nextMilestone) return null;

    const progress = (currentPoints / nextMilestone) * 100;
    const pointsNeeded = nextMilestone - currentPoints;

    return {
      target: nextMilestone,
      progress: Math.min(progress, 100),
      pointsNeeded,
    };
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const milestone = getNextMilestone(points);

  if (!currentUser) {
    return (
      <div className="points-page">
        <div className="points-container">
          <div className="points-login-prompt">
            <h2>Please log in to view your Lineup Points & Badges</h2>
            <Link to="/login" className="points-login-btn">Log In</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="points-page">
      <Link to="/" className="points-back-link">← Back</Link>
      <div className="points-container">
        <div className="points-header">
          <h1>Lineup Points & Badges</h1>
        </div>

        {/* Tabs */}
        <div className="points-tabs">
          <button
            className={`points-tab ${activeTab === "points" ? "active" : ""}`}
            onClick={() => setActiveTab("points")}
          >
            Points
          </button>
          <button
            className={`points-tab ${activeTab === "badges" ? "active" : ""}`}
            onClick={() => setActiveTab("badges")}
          >
            Badges
          </button>
        </div>

        {/* Points Tab */}
        {activeTab === "points" && (
          <div className="points-content">
            {loading ? (
              <div className="points-loading">Loading...</div>
            ) : (
              <>
                {/* Current Points Display */}
                <div className="points-display-section">
                  <div className="points-current">
                    <PointsDisplay userId={currentUser.uid} size="large" showLabel={true} />
                  </div>

                  {/* Next Milestone Progress */}
                  {milestone && (
                    <div className="points-milestone">
                      <div className="points-milestone-message">
                        {milestone.pointsNeeded <= 50 ? (
                          <span className="points-milestone-message--close">
                            🎯 Almost there! Just {milestone.pointsNeeded} more points to reach {milestone.target.toLocaleString()}!
                          </span>
                        ) : milestone.pointsNeeded <= 100 ? (
                          <span className="points-milestone-message--close">
                            💪 You're {milestone.pointsNeeded} points away from {milestone.target.toLocaleString()}!
                          </span>
                        ) : (
                          <span className="points-milestone-message--normal">
                            Next milestone: {milestone.target.toLocaleString()} pts
                          </span>
                        )}
                      </div>
                      <div className="points-milestone-header">
                        <span className="points-milestone-label">
                          {milestone.pointsNeeded.toLocaleString()} more needed
                        </span>
                        <span className="points-milestone-progress-text">
                          {Math.round(milestone.progress)}%
                        </span>
                      </div>
                      <div className="points-progress-bar">
                        <div
                          className="points-progress-fill"
                          style={{ width: `${milestone.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Recent Activity */}
                {notifications.length > 0 && (
                  <div className="points-section">
                    <div className="points-section-title">Recent Activity</div>
                    <div className="points-notifications">
                      {notifications.map((notif) => (
                        <div key={notif.id} className="points-notification">
                          <div className="points-notification-icon">
                            {notif.type === "badge_earned" ? "🏆" : "⭐"}
                          </div>
                          <div className="points-notification-content">
                            <div className="points-notification-title">
                              {notif.title || (notif.type === "badge_earned" ? "Badge Earned!" : "Points Earned!")}
                            </div>
                            <div className="points-notification-message">
                              {notif.message || (notif.type === "badge_earned" 
                                ? `You earned the "${notif.metadata?.badgeName || "Unknown"}" badge!`
                                : `You earned ${notif.metadata?.points || 0} points`)}
                            </div>
                            <div className="points-notification-time">
                              {formatTime(notif.createdAt)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Earn More Points */}
                <div className="points-section">
                  <div className="points-section-title">Earn More Points</div>
                  <div className="points-opportunities">
                    {opportunities.map((opp) => (
                      <div key={opp.id} className="points-opportunity">
                        <div className="points-opportunity-content">
                          <div className="points-opportunity-label">{opp.label}</div>
                          <div className="points-opportunity-description">{opp.description}</div>
                        </div>
                        <div className="points-opportunity-points">
                          +{opp.points} pts
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Transaction History */}
                {transactions.length > 0 && (
                  <div className="points-section">
                    <div className="points-section-title">Transaction History</div>
                    <div className="points-transactions">
                      {transactions.map((txn) => (
                        <div key={txn.id} className="points-transaction">
                          <div className="points-transaction-icon">
                            {txn.type === "earned" ? "➕" : "➖"}
                          </div>
                          <div className="points-transaction-content">
                            <div className="points-transaction-reason">
                              {txn.reason || txn.action || "Points transaction"}
                            </div>
                            <div className="points-transaction-time">
                              {formatTime(txn.createdAt)}
                            </div>
                          </div>
                          <div
                            className={`points-transaction-amount ${
                              txn.type === "earned" ? "points-transaction-amount--earned" : ""
                            }`}
                          >
                            {txn.type === "earned" ? "+" : "-"}
                            {Math.abs(txn.points).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Link to Store */}
                <div className="points-section">
                  <div className="points-store-link">
                    <Link to="/store" className="points-store-btn">
                      Visit The Lineup Store →
                    </Link>
                    <p className="points-store-description">
                      Exchange your Lineup Points for gift cards, experiences, and more!
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Badges Tab */}
        {activeTab === "badges" && (
          <div className="points-content">
            <div className="points-badges-section">
              <h2>My Badges</h2>
              <BadgeGallery userId={currentUser.uid} viewMode="all" showEmpty={true} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

