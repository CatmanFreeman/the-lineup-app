// src/components/NotificationBell.jsx

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { getUserNotifications, markNotificationRead, markAllNotificationsRead } from "../utils/notificationService";
import "./NotificationBell.css";

export default function NotificationBell() {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const notifs = await getUserNotifications(currentUser.uid);
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.read).length);
    } catch (error) {
      console.error("Error loading notifications:", error);
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    loadNotifications();
  }, [currentUser, loadNotifications]);

  async function handleMarkRead(notificationId) {
    try {
      await markNotificationRead(notificationId);
      loadNotifications();
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }

  async function handleMarkAllRead() {
    if (!currentUser) return;
    try {
      await markAllNotificationsRead(currentUser.uid);
      loadNotifications();
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  }

  return (
    <div className="notification-bell-container">
      <button
        className="notification-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="notification-overlay" onClick={() => setIsOpen(false)} />
          <div className="notification-dropdown">
            <div className="notification-header">
              <h3>Notifications</h3>
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} className="mark-all-read-btn">
                  Mark all read
                </button>
              )}
            </div>
            <div className="notification-list">
              {loading ? (
                <div className="notification-loading">Loading...</div>
              ) : notifications.length === 0 ? (
                <div className="notification-empty">No notifications</div>
              ) : (
                notifications.map(notif => (
                  <div
                    key={notif.id}
                    className={`notification-item ${notif.read ? "read" : "unread"}`}
                    onClick={() => {
                      if (!notif.read) handleMarkRead(notif.id);
                      if (notif.actionUrl) window.location.href = notif.actionUrl;
                    }}
                  >
                    <div className="notification-priority" data-priority={notif.priority} />
                    <div className="notification-content">
                      <div className="notification-title">{notif.title}</div>
                      <div className="notification-message">{notif.message}</div>
                      <div className="notification-time">
                        {notif.createdAt?.toDate?.()?.toLocaleString() || "Just now"}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}