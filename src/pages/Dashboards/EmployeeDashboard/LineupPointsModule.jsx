// src/pages/Dashboards/EmployeeDashboard/LineupPointsModule.jsx
//
// LINEUP POINTS MODULE - Employee Dashboard Overview
//
// Comprehensive module showing points, progress, opportunities, and notifications

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "../../../hooks/services/firebase";
import { getPointsBalance, getPointTransactions, POINT_ACTION, POINT_VALUES } from "../../../utils/pointsService";
import PointsDisplay from "../../../components/PointsDisplay";
import "./LineupPointsModule.css";

export default function LineupPointsModule({ employeeUid, restaurantId }) {
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [opportunities, setOpportunities] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!employeeUid) {
      setLoading(false);
      return;
    }

    loadPointsData();
    loadOpportunities();
    loadRecentTransactions();
    loadNotifications();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadPointsData();
      loadOpportunities();
      loadRecentTransactions();
      loadNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, [employeeUid, restaurantId]);

  const loadPointsData = async () => {
    try {
      const balance = await getPointsBalance(employeeUid);
      setPoints(balance.total || 0);
    } catch (err) {
      console.error("Error loading points:", err);
      setPoints(0);
    } finally {
      setLoading(false);
    }
  };

  const loadOpportunities = async () => {
    try {
      // Employee-specific point opportunities
      const opps = [
        {
          id: "punch_in",
          action: POINT_ACTION.PUNCH_IN,
          label: "Punch In",
          points: POINT_VALUES[POINT_ACTION.PUNCH_IN],
          description: "Earn points when you punch in for your shift",
          available: true,
        },
        {
          id: "punch_out",
          action: POINT_ACTION.PUNCH_OUT,
          label: "Punch Out",
          points: POINT_VALUES[POINT_ACTION.PUNCH_OUT],
          description: "Earn points when you punch out",
          available: true,
        },
        {
          id: "punch_out_on_time",
          action: POINT_ACTION.PUNCH_OUT_ON_TIME,
          label: "Punch Out On Time",
          points: POINT_VALUES[POINT_ACTION.PUNCH_OUT_ON_TIME],
          description: "Earn bonus points for punching out on time",
          available: true,
        },
        {
          id: "shift_complete",
          action: POINT_ACTION.SHIFT_COMPLETE,
          label: "Complete Shift",
          points: POINT_VALUES[POINT_ACTION.SHIFT_COMPLETE],
          description: "Earn points when you complete a full shift",
          available: true,
        },
        {
          id: "shift_game",
          action: POINT_ACTION.SHIFT_GAME,
          label: "Participate in Shift Games",
          points: POINT_VALUES[POINT_ACTION.SHIFT_GAME],
          description: "Earn points by participating in active shift games",
          available: true,
        },
        {
          id: "attendance",
          action: POINT_ACTION.ATTENDANCE,
          label: "Perfect Attendance",
          points: POINT_VALUES[POINT_ACTION.ATTENDANCE],
          description: "Earn points for consistent attendance",
          available: true,
        },
        {
          id: "performance",
          action: POINT_ACTION.PERFORMANCE,
          label: "Performance Recognition",
          points: POINT_VALUES[POINT_ACTION.PERFORMANCE],
          description: "Earn points for outstanding performance",
          available: true,
        },
      ];

      setOpportunities(opps);
    } catch (err) {
      console.error("Error loading opportunities:", err);
      setOpportunities([]);
    }
  };

  const loadRecentTransactions = async () => {
    try {
      const transactions = await getPointTransactions(employeeUid, 5);
      setRecentTransactions(transactions);
    } catch (err) {
      console.error("Error loading transactions:", err);
      setRecentTransactions([]);
    }
  };

  const loadNotifications = async () => {
    try {
      // Get points-related notifications
      const notificationsRef = collection(db, "notifications");
      const notificationsQuery = query(
        notificationsRef,
        where("userId", "==", employeeUid),
        where("type", "==", "points_earned"),
        orderBy("createdAt", "desc"),
        limit(3)
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
          where("userId", "==", employeeUid),
          where("type", "==", "points_earned"),
          limit(10)
        );
        const notificationsSnap = await getDocs(notificationsQuery);
        const notifs = notificationsSnap.docs
          .map((d) => ({
            id: d.id,
            ...d.data(),
          }))
          .sort((a, b) => {
            const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
            const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
            return bTime - aTime;
          })
          .slice(0, 3);

        setNotifications(notifs);
      } catch (fallbackErr) {
        console.error("Error loading notifications:", fallbackErr);
        setNotifications([]);
      }
    }
  };

  const getNextMilestone = (currentPoints) => {
    // Define milestones (every 500 points)
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

  if (loading) {
    return (
      <div className="lineup-points-module">
        <div className="lineup-points-header">
          <h3>Lineup Points</h3>
        </div>
        <div className="lineup-points-body">
          <div className="lineup-points-loading">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="lineup-points-module">
      <div className="lineup-points-header">
        <h3>Lineup Points</h3>
        <Link to={`/badges`} className="lineup-points-link">
          View All →
        </Link>
      </div>

      <div className="lineup-points-body">
        {/* Current Points Display */}
        <div className="lineup-points-display-section">
          <div className="lineup-points-current">
            <PointsDisplay userId={employeeUid} size="large" showLabel={true} />
          </div>

          {/* Next Milestone Progress */}
          {milestone && (
            <div className="lineup-points-milestone">
              <div className="lineup-points-milestone-message">
                {milestone.pointsNeeded <= 50 ? (
                  <span className="lineup-points-milestone-message--close">
                    🎯 Almost there! Just {milestone.pointsNeeded} more points to reach {milestone.target.toLocaleString()}!
                  </span>
                ) : milestone.pointsNeeded <= 100 ? (
                  <span className="lineup-points-milestone-message--close">
                    💪 You're {milestone.pointsNeeded} points away from {milestone.target.toLocaleString()}!
                  </span>
                ) : (
                  <span className="lineup-points-milestone-message--normal">
                    Next milestone: {milestone.target.toLocaleString()} pts
                  </span>
                )}
              </div>
              <div className="lineup-points-milestone-header">
                <span className="lineup-points-milestone-label">
                  {milestone.pointsNeeded.toLocaleString()} more needed
                </span>
                <span className="lineup-points-milestone-progress-text">
                  {Math.round(milestone.progress)}%
                </span>
              </div>
              <div className="lineup-points-progress-bar">
                <div
                  className="lineup-points-progress-fill"
                  style={{ width: `${milestone.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Notifications Section */}
        {notifications.length > 0 && (
          <div className="lineup-points-section">
            <div className="lineup-points-section-title">Recent Points</div>
            <div className="lineup-points-notifications">
              {notifications.map((notif) => (
                <div key={notif.id} className="lineup-points-notification">
                  <div className="lineup-points-notification-icon">⭐</div>
                  <div className="lineup-points-notification-content">
                    <div className="lineup-points-notification-title">
                      {notif.title || "Points Earned!"}
                    </div>
                    <div className="lineup-points-notification-message">
                      {notif.message || `You earned ${notif.metadata?.points || 0} points`}
                    </div>
                    <div className="lineup-points-notification-time">
                      {formatTime(notif.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Opportunities Section */}
        <div className="lineup-points-section">
          <div className="lineup-points-section-title">Earn More Points</div>
          <div className="lineup-points-opportunities">
            {opportunities.slice(0, 4).map((opp) => (
              <div key={opp.id} className="lineup-points-opportunity">
                <div className="lineup-points-opportunity-content">
                  <div className="lineup-points-opportunity-label">{opp.label}</div>
                  <div className="lineup-points-opportunity-description">{opp.description}</div>
                </div>
                <div className="lineup-points-opportunity-points">
                  +{opp.points} pts
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Transactions */}
        {recentTransactions.length > 0 && (
          <div className="lineup-points-section">
            <div className="lineup-points-section-title">Recent Activity</div>
            <div className="lineup-points-transactions">
              {recentTransactions.slice(0, 3).map((txn) => (
                <div key={txn.id} className="lineup-points-transaction">
                  <div className="lineup-points-transaction-icon">
                    {txn.type === "earned" ? "➕" : "➖"}
                  </div>
                  <div className="lineup-points-transaction-content">
                    <div className="lineup-points-transaction-reason">
                      {txn.reason || txn.action || "Points transaction"}
                    </div>
                    <div className="lineup-points-transaction-time">
                      {formatTime(txn.createdAt)}
                    </div>
                  </div>
                  <div
                    className={`lineup-points-transaction-amount ${
                      txn.type === "earned" ? "lineup-points-transaction-amount--earned" : ""
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
      </div>
    </div>
  );
}

