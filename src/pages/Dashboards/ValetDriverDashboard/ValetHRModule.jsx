// src/pages/Dashboards/ValetDriverDashboard/ValetHRModule.jsx
//
// VALET HR MODULE
//
// Shows HR information for valet drivers from their valet company
// - Next shift (if scheduled)
// - HR alerts and notifications
// - Company messages

import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs, onSnapshot, orderBy, limit, doc, getDoc } from "firebase/firestore";
import { db } from "../../../hooks/services/firebase";
import "./ValetHRModule.css";

export default function ValetHRModule({ driverId, valetCompanyId }) {
  const [hrAlerts, setHrAlerts] = useState([]);
  const [companyMessages, setCompanyMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!driverId || !valetCompanyId) {
      setLoading(false);
      return;
    }

    loadHRInfo();

    // Set up real-time listener for HR notifications
    const notificationsRef = collection(db, "notifications");
    const hrNotificationsQuery = query(
      notificationsRef,
      where("userId", "==", driverId),
      where("read", "==", false),
      orderBy("createdAt", "desc"),
      limit(10)
    );
    
    const unsubscribe = onSnapshot(hrNotificationsQuery, (snapshot) => {
      const notifications = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        type: "notification",
      }));

      const hrNotifications = notifications.filter((n) => {
        const type = n.type || n.notificationType || "";
        return (
          type.includes("HR") ||
          type.includes("SCHEDULE") ||
          type.includes("COMPANY") ||
          type.includes("EMPLOYMENT") ||
          n.title?.toLowerCase().includes("hr") ||
          n.title?.toLowerCase().includes("schedule") ||
          n.title?.toLowerCase().includes("company")
        );
      });

      setHrAlerts(hrNotifications);
    });

    return () => unsubscribe();
  }, [driverId, valetCompanyId]);

  async function loadHRInfo() {
    try {
      setLoading(true);

      // Get HR-related notifications
      const notificationsRef = collection(db, "notifications");
      const hrNotificationsQuery = query(
        notificationsRef,
        where("userId", "==", driverId),
        where("read", "==", false),
        orderBy("createdAt", "desc"),
        limit(10)
      );
      const notificationsSnap = await getDocs(hrNotificationsQuery);
      const notifications = notificationsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        type: "notification",
      }));

      // Filter for HR-related notifications
      const hrNotifications = notifications.filter((n) => {
        const type = n.type || n.notificationType || "";
        return (
          type.includes("HR") ||
          type.includes("SCHEDULE") ||
          type.includes("COMPANY") ||
          type.includes("EMPLOYMENT") ||
          n.title?.toLowerCase().includes("hr") ||
          n.title?.toLowerCase().includes("schedule") ||
          n.title?.toLowerCase().includes("company")
        );
      });

      setHrAlerts(hrNotifications);

      // Get company messages (if stored in a messages collection)
      // This would be messages from valet company admin to drivers
      try {
        const messagesRef = collection(db, "valetCompanies", valetCompanyId, "messages");
        const messagesQuery = query(
          messagesRef,
          where("recipientId", "==", driverId),
          where("read", "==", false),
          orderBy("createdAt", "desc"),
          limit(5)
        );
        const messagesSnap = await getDocs(messagesQuery);
        const messages = messagesSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          type: "message",
        }));
        setCompanyMessages(messages);
      } catch (error) {
        // Messages collection might not exist yet
        console.warn("Could not load company messages:", error);
      }
    } catch (error) {
      console.error("Error loading HR info:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="valet-hr-module">
        <div className="valet-hr-loading">Loading HR information...</div>
      </div>
    );
  }

  const totalAlerts = hrAlerts.length + companyMessages.length;

  return (
    <div className="valet-hr-module">
      <div className="valet-hr-header">
        <h3>HR Information</h3>
        {totalAlerts > 0 && (
          <span className="valet-hr-alert-badge">{totalAlerts}</span>
        )}
      </div>

      <div className="valet-hr-body">
        {totalAlerts === 0 ? (
          <div className="valet-hr-empty">
            <p>No HR alerts or notifications</p>
          </div>
        ) : (
          <>
            {hrAlerts.length > 0 && (
              <div className="valet-hr-section">
                <h4>Notifications</h4>
                {hrAlerts.map((alert) => (
                  <div key={alert.id} className="valet-hr-alert-item">
                    <div className="valet-hr-alert-title">{alert.title}</div>
                    <div className="valet-hr-alert-message">{alert.message}</div>
                    {alert.createdAt && (
                      <div className="valet-hr-alert-time">
                        {alert.createdAt.toDate?.()?.toLocaleDateString() || "Recently"}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {companyMessages.length > 0 && (
              <div className="valet-hr-section">
                <h4>Company Messages</h4>
                {companyMessages.map((message) => (
                  <div key={message.id} className="valet-hr-alert-item">
                    <div className="valet-hr-alert-title">
                      {message.subject || "Company Message"}
                    </div>
                    <div className="valet-hr-alert-message">{message.body || message.message}</div>
                    {message.createdAt && (
                      <div className="valet-hr-alert-time">
                        {message.createdAt.toDate?.()?.toLocaleDateString() || "Recently"}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

