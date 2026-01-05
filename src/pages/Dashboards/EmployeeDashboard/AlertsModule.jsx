// src/pages/Dashboards/EmployeeDashboard/AlertsModule.jsx
//
// ALERTS MODULE - Employee Dashboard Overview
//
// Shows management messages and employee messages as alerts

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "../../../hooks/services/firebase";
import { getConversations } from "../../../utils/messagingService";
import "./AlertsModule.css";

export default function AlertsModule({ employeeUid, restaurantId }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!employeeUid || !restaurantId) {
      setLoading(false);
      return;
    }

    loadAlerts();
  }, [employeeUid, restaurantId]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      
      // Get unread conversations
      const conversations = await getConversations({
        userId: employeeUid,
        userType: "employee",
        restaurantId,
      });

      // Filter for unread messages
      const unreadConversations = conversations.filter((conv) => {
        const unread = conv.unreadCount?.[employeeUid] || 0;
        return unread > 0;
      });

      // Sort by last message time
      unreadConversations.sort((a, b) => {
        const aTime = a.lastMessageAt?.toDate?.() || new Date(0);
        const bTime = b.lastMessageAt?.toDate?.() || new Date(0);
        return bTime - aTime;
      });

      // Get notifications as well
      const notificationsRef = collection(db, "notifications");
      const notificationsQuery = query(
        notificationsRef,
        where("userId", "==", employeeUid),
        where("read", "==", false),
        orderBy("createdAt", "desc"),
        limit(10)
      );
      const notificationsSnap = await getDocs(notificationsQuery);
      const notifications = notificationsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        type: "notification",
      }));

      // Get seating alerts from reservations
      const reservationsRef = collection(db, "restaurants", restaurantId, "reservations");
      const now = new Date();
      const next30Minutes = new Date(now.getTime() + 30 * 60 * 1000);
      const seatingQuery = query(
        reservationsRef,
        where("status", "in", ["CONFIRMED", "CHECKED_IN", "SEATED"]),
        where("startAtTimestamp", ">=", Timestamp.fromDate(now)),
        where("startAtTimestamp", "<=", Timestamp.fromDate(next30Minutes)),
        orderBy("startAtTimestamp", "asc"),
        limit(5)
      );
      
      let seatingAlerts = [];
      try {
        const seatingSnap = await getDocs(seatingQuery);
        seatingAlerts = seatingSnap.docs.map((d) => {
          const data = d.data();
          const startAt = data.startAtTimestamp?.toDate?.() || new Date(data.startAt);
          const minutesUntil = Math.round((startAt - now) / 60000);
          return {
            id: `seating-${d.id}`,
            type: "seating",
            title: minutesUntil <= 0 ? "You've been seated!" : `Seating in ${minutesUntil} minute${minutesUntil !== 1 ? "s" : ""}`,
            message: data.status === "SEATED" 
              ? `Table ready for ${data.dinerName || "Guest"} • Party of ${data.partySize}`
              : `Upcoming reservation: ${data.dinerName || "Guest"} • Party of ${data.partySize}`,
            from: "System",
            timestamp: data.startAtTimestamp || Timestamp.fromDate(startAt),
            priority: minutesUntil <= 5 ? "high" : "normal",
            reservationId: d.id,
          };
        });
      } catch (err) {
        console.warn("Error loading seating alerts:", err);
      }

      // Combine and format alerts (prioritize seating alerts)
      const alertsList = [
        ...seatingAlerts,
        ...unreadConversations.slice(0, 3).map((conv) => ({
          id: conv.id,
          type: "message",
          title: "New Message",
          message: conv.lastMessage || "You have a new message",
          from: Object.values(conv.participantNames || {}).find(
            (name) => name !== employeeUid
          ) || "Management",
          timestamp: conv.lastMessageAt,
          actionUrl: `/dashboard/employee/${restaurantId}?tab=messaging&conversation=${conv.id}`,
          unreadCount: conv.unreadCount?.[employeeUid] || 0,
        })),
        ...notifications.slice(0, 3).map((notif) => ({
          id: notif.id,
          type: "notification",
          title: notif.title || "Notification",
          message: notif.message || "",
          from: "System",
          timestamp: notif.createdAt,
          actionUrl: notif.actionUrl || null,
          priority: notif.priority || "normal",
        })),
      ].sort((a, b) => {
        // Sort by priority first (high priority first), then by timestamp
        if (a.priority === "high" && b.priority !== "high") return -1;
        if (a.priority !== "high" && b.priority === "high") return 1;
        const aTime = a.timestamp?.toDate?.() || new Date(0);
        const bTime = b.timestamp?.toDate?.() || new Date(0);
        return bTime - aTime;
      }).slice(0, 5); // Limit to 5 most recent

      setAlerts(alertsList);
      setUnreadCount(
        unreadConversations.reduce((sum, conv) => sum + (conv.unreadCount?.[employeeUid] || 0), 0) +
        notifications.length
      );
    } catch (error) {
      console.error("Error loading alerts:", error);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
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

  if (loading) {
    return (
      <div className="alerts-module">
        <div className="alerts-header">
          <h3>Alerts</h3>
        </div>
        <div className="alerts-body">
          <div className="alerts-loading">Loading alerts...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="alerts-module">
      <div className="alerts-header">
        <h3>Alerts</h3>
        {unreadCount > 0 && (
          <span className="alerts-badge">{unreadCount}</span>
        )}
      </div>
      <div className="alerts-body">
        {alerts.length === 0 ? (
          <div className="alerts-empty">
            <p>No new alerts</p>
          </div>
        ) : (
          <div className="alerts-list">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`alert-item ${alert.priority === "high" ? "alert-high" : ""}`}
              >
                {alert.actionUrl ? (
                  <Link to={alert.actionUrl} className="alert-link">
                    <div className="alert-icon">
                      {alert.type === "seating" ? "🪑" : alert.type === "message" ? "💬" : "🔔"}
                    </div>
                    <div className="alert-content">
                      <div className="alert-title">{alert.title}</div>
                      <div className="alert-message">{alert.message}</div>
                      <div className="alert-meta">
                        {alert.from} • {formatTime(alert.timestamp)}
                        {alert.unreadCount > 1 && (
                          <span className="alert-unread-count">
                            {" "}• {alert.unreadCount} unread
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ) : (
                  <div className="alert-content">
                    <div className="alert-icon">
                      {alert.type === "seating" ? "🪑" : alert.type === "message" ? "💬" : "🔔"}
                    </div>
                    <div className="alert-content-inner">
                      <div className="alert-title">{alert.title}</div>
                      <div className="alert-message">{alert.message}</div>
                      <div className="alert-meta">
                        {alert.from} • {formatTime(alert.timestamp)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {alerts.length > 0 && (
          <div className="alerts-footer">
            <Link
              to={`/dashboard/employee/${restaurantId}?tab=messaging`}
              className="alerts-view-all"
            >
              View All Messages →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

