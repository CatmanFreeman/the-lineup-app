// src/pages/Dashboards/EmployeeDashboard/QuickActionsTab.jsx
//
// QUICK ACTIONS TAB
//
// Server-focused quick actions module
// Minimal interaction needed - flow happens automatically
// Shows upcoming reservations, quick check-ins, status updates

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import {
  getReservationsInWindow,
  RESERVATION_STATUS,
} from "../../../utils/reservationLedgerService";
import "./QuickActionsTab.css";

export default function QuickActionsTab() {
  const { restaurantId, employeeId } = useParams();
  const { currentUser } = useAuth();
  const employeeUid = employeeId || currentUser?.uid;

  const [myReservations, setMyReservations] = useState([]);
  const [upcomingReservations, setUpcomingReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Load my reservations (where I'm the requested server)
  const loadMyReservations = useCallback(async () => {
    if (!restaurantId || !employeeUid) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const now = new Date();
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      // Load all reservations for today
      const reservations = await getReservationsInWindow({
        restaurantId,
        startDate: now.toISOString(),
        endDate: endOfDay.toISOString(),
      });

      // Filter for my reservations (where I'm requested server)
      const myRes = reservations.filter(
        (r) =>
          r.metadata?.serverId === employeeUid &&
          r.status !== RESERVATION_STATUS.CANCELLED &&
          r.status !== RESERVATION_STATUS.COMPLETED
      );

      // Sort by time
      myRes.sort((a, b) => {
        const aTime = a.startAtTimestamp?.toDate?.() || new Date(a.startAt);
        const bTime = b.startAtTimestamp?.toDate?.() || new Date(b.startAt);
        return aTime - bTime;
      });

      setMyReservations(myRes);

      // Get next 3 upcoming (within 2 hours)
      const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const upcoming = myRes
        .filter((r) => {
          const resTime = r.startAtTimestamp?.toDate?.() || new Date(r.startAt);
          return resTime >= now && resTime <= twoHoursFromNow;
        })
        .slice(0, 3);

      setUpcomingReservations(upcoming);
      setLastUpdate(new Date());
    } catch (err) {
      console.error("Error loading my reservations:", err);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, employeeUid]);

  useEffect(() => {
    loadMyReservations();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadMyReservations, 30000);
    return () => clearInterval(interval);
  }, [loadMyReservations]);

  const formatTime = (dateISO) => {
    const date = new Date(dateISO);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getMinutesUntil = (dateISO) => {
    const resTime = new Date(dateISO);
    const now = new Date();
    return Math.round((resTime - now) / (1000 * 60));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case RESERVATION_STATUS.CONFIRMED:
        return "#4da3ff";
      case RESERVATION_STATUS.CHECKED_IN:
        return "#fbbf24";
      case RESERVATION_STATUS.SEATED:
        return "#4ade80";
      default:
        return "#888";
    }
  };

  if (loading && myReservations.length === 0) {
    return (
      <div className="quick-actions">
        <div className="quick-actions-loading">Loading your reservations...</div>
      </div>
    );
  }

  return (
    <div className="quick-actions">
      <div className="quick-actions-header">
        <div>
          <h2>Quick Actions</h2>
          <p className="quick-actions-subtitle">
            Your reservations and quick updates • Last updated: {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
        <button className="refresh-btn" onClick={loadMyReservations} disabled={loading}>
          {loading ? "Refreshing..." : "🔄 Refresh"}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="quick-actions-summary">
        <div className="summary-card">
          <div className="summary-icon">📅</div>
          <div className="summary-content">
            <div className="summary-value">{myReservations.length}</div>
            <div className="summary-label">Today's Reservations</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon">⏰</div>
          <div className="summary-content">
            <div className="summary-value">{upcomingReservations.length}</div>
            <div className="summary-label">Upcoming (Next 2 Hours)</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon">✅</div>
          <div className="summary-content">
            <div className="summary-value">
              {myReservations.filter((r) => r.status === RESERVATION_STATUS.SEATED).length}
            </div>
            <div className="summary-label">Seated</div>
          </div>
        </div>
      </div>

      {/* Upcoming Reservations */}
      {upcomingReservations.length > 0 ? (
        <div className="upcoming-section">
          <h3>Upcoming Reservations</h3>
          <div className="reservations-list">
            {upcomingReservations.map((reservation) => {
              const minutesUntil = getMinutesUntil(reservation.startAt);
              const isSoon = minutesUntil <= 30;

              return (
                <div
                  key={reservation.id}
                  className={`reservation-card ${isSoon ? "soon" : ""}`}
                >
                  <div className="reservation-time">
                    <div className="time-display">{formatTime(reservation.startAt)}</div>
                    <div className="time-meta">
                      {minutesUntil > 0 ? `in ${minutesUntil}m` : `${Math.abs(minutesUntil)}m ago`}
                    </div>
                  </div>
                  <div className="reservation-info">
                    <div className="reservation-header">
                      <h4>{reservation.dinerName || "Guest"}</h4>
                      <span
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(reservation.status) }}
                      >
                        {reservation.status.replace("_", " ")}
                      </span>
                    </div>
                    <div className="reservation-details">
                      <span>Party of {reservation.partySize}</span>
                      {reservation.metadata?.specialRequests && (
                        <span className="has-notes">📝 Has special requests</span>
                      )}
                    </div>
                    {reservation.metadata?.preferences && reservation.metadata.preferences.length > 0 && (
                      <div className="reservation-preferences">
                        {reservation.metadata.preferences.slice(0, 3).map((pref, idx) => (
                          <span key={idx} className="preference-tag">
                            {pref}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="no-upcoming">
          <p>No upcoming reservations in the next 2 hours.</p>
        </div>
      )}

      {/* All Today's Reservations */}
      {myReservations.length > 0 && (
        <div className="all-reservations-section">
          <h3>All Today's Reservations</h3>
          <div className="reservations-list">
            {myReservations.map((reservation) => {
              const minutesUntil = getMinutesUntil(reservation.startAt);
              const isPast = minutesUntil < 0;

              return (
                <div
                  key={reservation.id}
                  className={`reservation-card ${isPast ? "past" : ""}`}
                >
                  <div className="reservation-time">
                    <div className="time-display">{formatTime(reservation.startAt)}</div>
                    <div className="time-meta">
                      {minutesUntil > 0 ? `in ${minutesUntil}m` : `${Math.abs(minutesUntil)}m ago`}
                    </div>
                  </div>
                  <div className="reservation-info">
                    <div className="reservation-header">
                      <h4>{reservation.dinerName || "Guest"}</h4>
                      <span
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(reservation.status) }}
                      >
                        {reservation.status.replace("_", " ")}
                      </span>
                    </div>
                    <div className="reservation-details">
                      <span>Party of {reservation.partySize}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Info Message */}
      <div className="quick-actions-info">
        <p>
          💡 <strong>Automatic Updates:</strong> Reservation status updates automatically when guests check in or get seated. 
          No action needed from you - just be ready when your guests arrive!
        </p>
      </div>
    </div>
  );
}

