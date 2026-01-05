// src/pages/Dashboards/RestaurantDashboard/tabs/SeatingModule.jsx

import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from "firebase/firestore";
import { db } from "../../../../hooks/services/firebase";
import { getReservationsInWindow, RESERVATION_STATUS } from "../../../../utils/reservationLedgerService";
import "./SeatingModule.css";

/**
 * Seating Module
 * Communicates with host and manager about seating and upcoming seating
 * Includes AI chat interface for asking questions about seating
 */
export default function SeatingModule() {
  const { restaurantId } = useParams();
  const [upcomingReservations, setUpcomingReservations] = useState([]);
  const [recentSeatings, setRecentSeatings] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading] = useState(true);

  // Load upcoming reservations and recent seatings
  useEffect(() => {
    const loadSeatingData = async () => {
      if (!restaurantId) return;

      try {
        const now = new Date();
        const nextHour = new Date(now.getTime() + 60 * 60 * 1000);

        // Get upcoming reservations (next hour)
        const reservations = await getReservationsInWindow({
          restaurantId,
          startDate: now.toISOString(),
          endDate: nextHour.toISOString(),
        });

        const upcoming = reservations
          .filter((r) => r.status === RESERVATION_STATUS.CONFIRMED || r.status === RESERVATION_STATUS.CHECKED_IN)
          .sort((a, b) => {
            const aTime = a.startAtTimestamp?.toDate?.() || new Date(a.startAt);
            const bTime = b.startAtTimestamp?.toDate?.() || new Date(b.startAt);
            return aTime - bTime;
          })
          .slice(0, 5);

        setUpcomingReservations(upcoming);

        // Get recent seatings (last 30 minutes)
        const recent = reservations
          .filter((r) => {
            if (r.status !== RESERVATION_STATUS.SEATED) return false;
            const seatedAt = r.metadata?.seatedAtTimestamp?.toDate?.() || new Date(r.metadata?.seatedAt || 0);
            const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
            return seatedAt > thirtyMinutesAgo;
          })
          .sort((a, b) => {
            const aTime = a.metadata?.seatedAtTimestamp?.toDate?.() || new Date(a.metadata?.seatedAt || 0);
            const bTime = b.metadata?.seatedAtTimestamp?.toDate?.() || new Date(b.metadata?.seatedAt || 0);
            return bTime - aTime;
          })
          .slice(0, 3);

        setRecentSeatings(recent);
      } catch (err) {
        console.error("Error loading seating data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadSeatingData();
    const interval = setInterval(loadSeatingData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [restaurantId]);

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = {
      type: "user",
      text: chatInput,
      timestamp: new Date(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");

    // TODO: Integrate with AI service for seating questions
    // For now, provide a simple response
    setTimeout(() => {
      const aiResponse = {
        type: "ai",
        text: `I'm analyzing seating data. You have ${upcomingReservations.length} upcoming reservations in the next hour. Would you like specific details about any reservation?`,
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, aiResponse]);
    }, 1000);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "—";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const h12 = hours % 12 === 0 ? 12 : hours % 12;
    const ampm = hours >= 12 ? "PM" : "AM";
    return `${h12}:${minutes.toString().padStart(2, "0")} ${ampm}`;
  };

  return (
    <div className="seating-module">
      <div className="seating-module__header">
        <h3 className="seating-module__title">Seating</h3>
        <div className="seating-module__status">
          <span className="seating-module__status-dot"></span>
          Active
        </div>
      </div>

      <div className="seating-module__content">
        {/* Upcoming Reservations */}
        <div className="seating-module__section">
          <div className="seating-module__section-title">Upcoming (Next Hour)</div>
          {loading ? (
            <div className="seating-module__loading">Loading...</div>
          ) : upcomingReservations.length > 0 ? (
            <div className="seating-module__list">
              {upcomingReservations.map((res) => {
                const time = res.startAtTimestamp?.toDate?.() || new Date(res.startAt);
                const minutesUntil = Math.round((time - new Date()) / 60000);
                return (
                  <div key={res.id} className="seating-module__item">
                    <div className="seating-module__item-time">{formatTime(res.startAtTimestamp || res.startAt)}</div>
                    <div className="seating-module__item-details">
                      <strong>{res.dinerName || "Guest"}</strong> • Party of {res.partySize}
                    </div>
                    <div className="seating-module__item-status">
                      {minutesUntil > 0 ? `in ${minutesUntil}m` : "Now"}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="seating-module__empty">No upcoming reservations</div>
          )}
        </div>

        {/* Recent Seatings */}
        {recentSeatings.length > 0 && (
          <div className="seating-module__section">
            <div className="seating-module__section-title">Recently Seated</div>
            <div className="seating-module__list">
              {recentSeatings.map((res) => (
                <div key={res.id} className="seating-module__item seating-module__item--seated">
                  <div className="seating-module__item-details">
                    <strong>{res.dinerName || "Guest"}</strong> • Party of {res.partySize}
                  </div>
                  <div className="seating-module__item-time">
                    {formatTime(res.metadata?.seatedAtTimestamp || res.metadata?.seatedAt)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Chat Interface */}
        <div className="seating-module__chat">
          <div className="seating-module__chat-title">Ask about seating</div>
          <div className="seating-module__chat-messages">
            {chatMessages.length === 0 && (
              <div className="seating-module__chat-empty">
                Ask questions about upcoming reservations, table availability, or seating patterns.
              </div>
            )}
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`seating-module__chat-message seating-module__chat-message--${msg.type}`}>
                <div className="seating-module__chat-text">{msg.text}</div>
              </div>
            ))}
          </div>
          <form onSubmit={handleChatSubmit} className="seating-module__chat-form">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type your question..."
              className="seating-module__chat-input"
            />
            <button type="submit" className="seating-module__chat-submit">
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}








