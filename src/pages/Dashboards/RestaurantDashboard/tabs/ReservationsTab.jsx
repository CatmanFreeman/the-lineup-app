// src/pages/Dashboards/RestaurantDashboard/tabs/ReservationsTab.jsx
//
// RESERVATIONS TAB - Restaurant Dashboard
//
// Host/Manager view of reservations with waiting list, check-in, and seating

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  getWaitingList,
  checkInReservation,
  seatReservation,
  materializeWaitingList,
} from "../../../../utils/waitingListService";
import {
  RESERVATION_STATUS,
  RESERVATION_SOURCE,
} from "../../../../utils/reservationLedgerService";
import "./ReservationsTab.css";

export default function ReservationsTab() {
  const { restaurantId } = useParams();
  const [waitingList, setWaitingList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all"); // all, confirmed, checked_in, seated
  const [sourceFilter, setSourceFilter] = useState("all"); // all, lineup, opentable

  // Load waiting list
  const loadWaitingList = useCallback(async () => {
    if (!restaurantId) return;

    setLoading(true);
    setError(null);

    try {
      // First, materialize the waiting list (ensures it's up to date)
      await materializeWaitingList(restaurantId);

      // Then load it
      const list = await getWaitingList(restaurantId, { includeSeated: false });
      setWaitingList(list);
    } catch (err) {
      console.error("Error loading waiting list:", err);
      setError("Failed to load reservations. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    loadWaitingList();
    // Refresh every 30 seconds
    const interval = setInterval(loadWaitingList, 30000);
    return () => clearInterval(interval);
  }, [loadWaitingList]);

  const handleCheckIn = async (reservationId) => {
    try {
      await checkInReservation(restaurantId, reservationId);
      await loadWaitingList();
    } catch (err) {
      console.error("Error checking in reservation:", err);
      alert("Failed to check in reservation. Please try again.");
    }
  };

  const handleSeat = async (reservationId) => {
    try {
      await seatReservation(restaurantId, reservationId);
      await loadWaitingList();
    } catch (err) {
      console.error("Error seating reservation:", err);
      alert("Failed to seat reservation. Please try again.");
    }
  };

  // Filter waiting list
  const filteredList = waitingList.filter((entry) => {
    if (filter !== "all" && entry.status !== filter.toUpperCase()) return false;
    if (sourceFilter !== "all") {
      const source = entry.source?.system;
      if (sourceFilter === "lineup" && source !== RESERVATION_SOURCE.LINEUP) return false;
      if (sourceFilter === "opentable" && source !== RESERVATION_SOURCE.OPENTABLE) return false;
    }
    return true;
  });

  // Sort by priority score (lower = higher priority)
  const sortedList = [...filteredList].sort((a, b) => {
    return (a.priorityScore || 999) - (b.priorityScore || 999);
  });

  const formatTime = (dateISO) => {
    const date = new Date(dateISO);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (dateISO) => {
    const date = new Date(dateISO);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
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

  if (loading && waitingList.length === 0) {
    return (
      <div className="reservations-tab">
        <div className="reservations-loading">Loading reservations...</div>
      </div>
    );
  }

  return (
    <div className="reservations-tab">
      <div className="reservations-header">
        <div>
          <h2>Reservations</h2>
          <p className="reservations-subtitle">
            {waitingList.length} reservation{waitingList.length !== 1 ? "s" : ""} in next 24 hours
          </p>
        </div>
        <button className="refresh-btn" onClick={loadWaitingList} disabled={loading}>
          {loading ? "Refreshing..." : "🔄 Refresh"}
        </button>
      </div>

      {error && (
        <div className="reservations-error">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="reservations-filters">
        <div className="filter-group">
          <label>Status:</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="confirmed">Confirmed</option>
            <option value="checked_in">Checked In</option>
            <option value="seated">Seated</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Source:</label>
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="lineup">LINEUP</option>
            <option value="opentable">OpenTable</option>
          </select>
        </div>
      </div>

      {/* Waiting List */}
      {sortedList.length === 0 ? (
        <div className="reservations-empty">
          <p>No reservations found for the selected filters.</p>
        </div>
      ) : (
        <div className="waiting-list">
          {sortedList.map((entry) => {
            const reservationTime = new Date(entry.startAt);
            const now = new Date();
            const minutesUntil = Math.round((reservationTime - now) / (1000 * 60));
            const isUpcoming = minutesUntil > 0;
            const isOverdue = minutesUntil < -15;

            return (
              <div
                key={entry.id}
                className={`waiting-list-item ${entry.isCheckedIn ? "checked-in" : ""} ${isOverdue ? "overdue" : ""}`}
              >
                <div className="waiting-list-item-main">
                  <div className="waiting-list-time">
                    <div className="time-display">{formatTime(entry.startAt)}</div>
                    <div className="time-meta">
                      {isUpcoming ? `in ${minutesUntil}m` : `${Math.abs(minutesUntil)}m ago`}
                    </div>
                  </div>

                  <div className="waiting-list-info">
                    <div className="waiting-list-header">
                      <h3>{entry.dinerName || "Guest"}</h3>
                      <div className="waiting-list-badges">
                        {entry.source?.system === RESERVATION_SOURCE.OPENTABLE && (
                          <span className="source-badge ot">OT</span>
                        )}
                        <span
                          className="status-badge"
                          style={{ backgroundColor: getStatusColor(entry.status) }}
                        >
                          {entry.status.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                    <div className="waiting-list-details">
                      <span>Party of {entry.partySize}</span>
                      {entry.phone && <span>• {entry.phone}</span>}
                    </div>
                    {entry.hostNotes && (
                      <div className="waiting-list-notes">
                        <strong>Notes:</strong> {entry.hostNotes}
                      </div>
                    )}
                  </div>
                </div>

                <div className="waiting-list-actions">
                  {entry.status === RESERVATION_STATUS.CONFIRMED && (
                    <button
                      className="action-btn check-in-btn"
                      onClick={() => handleCheckIn(entry.reservationId)}
                    >
                      ✓ Check In
                    </button>
                  )}
                  {entry.status === RESERVATION_STATUS.CHECKED_IN && (
                    <button
                      className="action-btn seat-btn"
                      onClick={() => handleSeat(entry.reservationId)}
                    >
                      🪑 Seat
                    </button>
                  )}
                  {entry.status === RESERVATION_STATUS.SEATED && (
                    <span className="seated-indicator">Seated</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

