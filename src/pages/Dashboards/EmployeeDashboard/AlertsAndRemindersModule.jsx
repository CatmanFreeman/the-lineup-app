// src/pages/Dashboards/EmployeeDashboard/AlertsAndRemindersModule.jsx
//
// ALERTS AND REMINDERS MODULE - Employee Dashboard Overview
//
// Shows system alerts (messages, notifications, seating alerts) and personal reminders

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "../../../hooks/services/firebase";
import { getConversations } from "../../../utils/messagingService";
import {
  getEmployeeReminders,
  createEmployeeReminder,
  updateEmployeeReminder,
  deleteEmployeeReminder,
  completeEmployeeReminder,
} from "../../../utils/reminderService";
import "./AlertsAndRemindersModule.css";

export default function AlertsAndRemindersModule({ employeeUid, restaurantId }) {
  const [alerts, setAlerts] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [editingReminder, setEditingReminder] = useState(null);
  
  // Form state
  const [formLabel, setFormLabel] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formTime, setFormTime] = useState("");

  useEffect(() => {
    if (!employeeUid || !restaurantId) {
      setLoading(false);
      return;
    }

    loadAlerts();
    loadReminders();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadAlerts();
      loadReminders();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [employeeUid, restaurantId]);

  const loadAlerts = async () => {
    try {
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
      });

      setAlerts(alertsList);
      setUnreadCount(
        unreadConversations.reduce((sum, conv) => sum + (conv.unreadCount?.[employeeUid] || 0), 0) +
        notifications.length
      );
    } catch (error) {
      console.error("Error loading alerts:", error);
      setAlerts([]);
    }
  };

  const loadReminders = async () => {
    try {
      const allReminders = await getEmployeeReminders(employeeUid, {
        includeCompleted: false,
      });
      setReminders(allReminders);
    } catch (err) {
      console.error("Error loading reminders:", err);
      setReminders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReminder = async (e) => {
    e.preventDefault();
    if (!formLabel.trim() || !formDate || !formTime) {
      alert("Please fill in all fields");
      return;
    }

    try {
      const scheduledDateTime = new Date(`${formDate}T${formTime}`);
      
      if (editingReminder) {
        await updateEmployeeReminder(employeeUid, editingReminder.id, {
          label: formLabel.trim(),
          scheduledAt: scheduledDateTime,
        });
      } else {
        await createEmployeeReminder(employeeUid, {
          label: formLabel.trim(),
          scheduledAt: scheduledDateTime,
        });
      }

      // Reset form
      setFormLabel("");
      setFormDate("");
      setFormTime("");
      setEditingReminder(null);
      setShowReminderForm(false);
      
      await loadReminders();
    } catch (err) {
      console.error("Error saving reminder:", err);
      alert("Failed to save reminder");
    }
  };

  const handleComplete = async (reminderId) => {
    try {
      await completeEmployeeReminder(employeeUid, reminderId);
      await loadReminders();
    } catch (err) {
      console.error("Error completing reminder:", err);
      alert("Failed to complete reminder");
    }
  };

  const handleDelete = async (reminderId) => {
    if (!window.confirm("Are you sure you want to delete this reminder?")) {
      return;
    }

    try {
      await deleteEmployeeReminder(employeeUid, reminderId);
      await loadReminders();
    } catch (err) {
      console.error("Error deleting reminder:", err);
      alert("Failed to delete reminder");
    }
  };

  const startEdit = (reminder) => {
    setEditingReminder(reminder);
    setFormLabel(reminder.label);
    
    const scheduledAt = reminder.scheduledAtTimestamp?.toDate?.() || new Date(reminder.scheduledAt);
    setFormDate(scheduledAt.toISOString().split("T")[0]);
    setFormTime(scheduledAt.toTimeString().slice(0, 5));
    setShowReminderForm(true);
  };

  const cancelEdit = () => {
    setEditingReminder(null);
    setFormLabel("");
    setFormDate("");
    setFormTime("");
    setShowReminderForm(false);
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

  const getMinutesUntil = (timestamp) => {
    if (!timestamp) return null;
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = date - now;
    const diffMins = Math.round(diffMs / 60000);
    return diffMins;
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return "—";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // Get today's date for min date
  const today = new Date().toISOString().split("T")[0];

  if (loading) {
    return (
      <div className="alerts-reminders-module">
        <div className="alerts-reminders-header">
          <h3>Alerts & Reminders</h3>
        </div>
        <div className="alerts-reminders-body">
          <div className="alerts-reminders-loading">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="alerts-reminders-module">
      <div className="alerts-reminders-header">
        <h3>Alerts & Reminders</h3>
        {unreadCount > 0 && (
          <span className="alerts-reminders-badge">{unreadCount}</span>
        )}
      </div>
      
      <div className="alerts-reminders-body">
        {/* System Alerts Section */}
        {alerts.length > 0 && (
          <div className="alerts-reminders-section">
            <div className="alerts-reminders-section-title">System Alerts</div>
            <div className="alerts-reminders-list">
              {alerts.slice(0, 3).map((alert) => (
                <div
                  key={alert.id}
                  className={`alerts-reminders-item alerts-reminders-item--alert ${
                    alert.priority === "high" ? "alerts-reminders-item--high" : ""
                  }`}
                >
                  {alert.actionUrl ? (
                    <Link to={alert.actionUrl} className="alerts-reminders-link">
                      <div className="alerts-reminders-icon">
                        {alert.type === "seating" ? "🪑" : alert.type === "message" ? "💬" : "🔔"}
                      </div>
                      <div className="alerts-reminders-content">
                        <div className="alerts-reminders-title">{alert.title}</div>
                        <div className="alerts-reminders-message">{alert.message}</div>
                        <div className="alerts-reminders-meta">
                          {alert.from} • {formatTime(alert.timestamp)}
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <div className="alerts-reminders-content">
                      <div className="alerts-reminders-icon">
                        {alert.type === "seating" ? "🪑" : alert.type === "message" ? "💬" : "🔔"}
                      </div>
                      <div className="alerts-reminders-content-inner">
                        <div className="alerts-reminders-title">{alert.title}</div>
                        <div className="alerts-reminders-message">{alert.message}</div>
                        <div className="alerts-reminders-meta">
                          {alert.from} • {formatTime(alert.timestamp)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Personal Reminders Section */}
        <div className="alerts-reminders-section">
          <div className="alerts-reminders-section-header">
            <div className="alerts-reminders-section-title">My Reminders</div>
            <button
              className="alerts-reminders-add-btn"
              onClick={() => {
                setEditingReminder(null);
                setFormLabel("");
                setFormDate("");
                setFormTime("");
                setShowReminderForm(true);
              }}
            >
              + Add
            </button>
          </div>

          {showReminderForm && (
            <div className="alerts-reminders-form">
              <form onSubmit={handleCreateReminder}>
                <input
                  type="text"
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  placeholder="What needs to be done?"
                  className="alerts-reminders-form-input"
                  required
                />
                <div className="alerts-reminders-form-row">
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    min={today}
                    className="alerts-reminders-form-input"
                    required
                  />
                  <input
                    type="time"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="alerts-reminders-form-input"
                    required
                  />
                </div>
                <div className="alerts-reminders-form-actions">
                  <button type="submit" className="alerts-reminders-form-submit">
                    {editingReminder ? "Update" : "Create"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="alerts-reminders-form-cancel"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {reminders.length === 0 ? (
            <div className="alerts-reminders-empty">
              No reminders yet. Create one to get started!
            </div>
          ) : (
            <div className="alerts-reminders-list">
              {reminders.map((reminder) => {
                const minutesUntil = getMinutesUntil(reminder.scheduledAtTimestamp || reminder.scheduledAt);
                const isPast = minutesUntil !== null && minutesUntil < 0;
                const isSoon = minutesUntil !== null && minutesUntil >= 0 && minutesUntil <= 15;

                return (
                  <div
                    key={reminder.id}
                    className={`alerts-reminders-item alerts-reminders-item--reminder ${
                      isSoon ? "alerts-reminders-item--soon" : ""
                    } ${isPast ? "alerts-reminders-item--past" : ""}`}
                  >
                    <div className="alerts-reminders-content">
                      <div className="alerts-reminders-icon">⏰</div>
                      <div className="alerts-reminders-content-inner">
                        <div className="alerts-reminders-title">{reminder.label}</div>
                        <div className="alerts-reminders-meta">
                          {formatDateTime(reminder.scheduledAtTimestamp || reminder.scheduledAt)}
                          {minutesUntil !== null && !isPast && (
                            <span className="alerts-reminders-countdown">
                              {" "}• {minutesUntil === 0 ? "Now" : `${minutesUntil}m until`}
                            </span>
                          )}
                          {isPast && <span className="alerts-reminders-overdue"> • Overdue</span>}
                        </div>
                      </div>
                    </div>
                    <div className="alerts-reminders-actions">
                      <button
                        onClick={() => handleComplete(reminder.id)}
                        className="alerts-reminders-action-btn alerts-reminders-action-btn--complete"
                        title="Complete"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => startEdit(reminder)}
                        className="alerts-reminders-action-btn alerts-reminders-action-btn--edit"
                        title="Edit"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => handleDelete(reminder.id)}
                        className="alerts-reminders-action-btn alerts-reminders-action-btn--delete"
                        title="Delete"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {alerts.length === 0 && reminders.length === 0 && !showReminderForm && (
          <div className="alerts-reminders-empty">
            <p>No alerts or reminders</p>
          </div>
        )}
      </div>
    </div>
  );
}








