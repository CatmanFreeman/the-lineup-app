// src/components/FCMProvider/FCMProvider.jsx
//
// FCM PROVIDER COMPONENT
//
// Wraps the app to handle FCM initialization and foreground messages
// - Registers device token on login
// - Handles foreground push notifications
// - Shows notification UI when message received

import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { initializeFCM, onForegroundMessage } from "../../utils/fcmService";
import "./FCMProvider.css";

export default function FCMProvider({ children }) {
  const { currentUser } = useAuth();
  const [notification, setNotification] = useState(null);

  // Initialize FCM when user logs in
  useEffect(() => {
    if (currentUser) {
      initializeFCM(currentUser.uid).catch((error) => {
        console.error("Error initializing FCM:", error);
      });
    }
  }, [currentUser]);

  // Set up foreground message handler
  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = onForegroundMessage((payload) => {
      // Show notification UI
      setNotification({
        title: payload.notification?.title || payload.data?.title || "New Notification",
        body: payload.notification?.body || payload.data?.message || "",
        actionUrl: payload.data?.actionUrl || null,
      });

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setNotification(null);
      }, 5000);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleNotificationClick = () => {
    if (notification?.actionUrl) {
      window.location.href = notification.actionUrl;
    }
    setNotification(null);
  };

  return (
    <>
      {children}
      {notification && (
        <div className="fcm-notification" onClick={handleNotificationClick}>
          <div className="fcm-notification-content">
            <div className="fcm-notification-title">{notification.title}</div>
            <div className="fcm-notification-body">{notification.body}</div>
          </div>
          <button
            className="fcm-notification-close"
            onClick={(e) => {
              e.stopPropagation();
              setNotification(null);
            }}
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}








