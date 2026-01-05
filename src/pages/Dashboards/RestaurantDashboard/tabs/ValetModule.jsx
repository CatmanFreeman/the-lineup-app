// src/pages/Dashboards/RestaurantDashboard/tabs/ValetModule.jsx

import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../../../../hooks/services/firebase";
import { getActiveValetTickets, VALET_STATUS } from "../../../../utils/valetService";
import "./ValetModule.css";

/**
 * Valet Module
 * Communicates with valet attendant and manager about car status
 * Includes lookup functionality to check car status by receipt
 */
export default function ValetModule() {
  const { restaurantId } = useParams();
  const [activeTickets, setActiveTickets] = useState([]);
  const [lookupInput, setLookupInput] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load active valet tickets
  useEffect(() => {
    const loadValetTickets = async () => {
      if (!restaurantId) return;

      try {
        const tickets = await getActiveValetTickets(restaurantId);
        setActiveTickets(tickets);
      } catch (err) {
        console.error("Error loading valet tickets:", err);
      } finally {
        setLoading(false);
      }
    };

    loadValetTickets();
    const interval = setInterval(loadValetTickets, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [restaurantId]);

  const handleLookup = async (e) => {
    e.preventDefault();
    if (!lookupInput.trim()) return;

    try {
      // Search for ticket by receipt number or reservation ID
      const ticketsRef = collection(db, "restaurants", restaurantId, "valetTickets");
      const q = query(
        ticketsRef,
        where("receiptNumber", "==", lookupInput.trim()),
        limit(1)
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const ticket = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
        setLookupResult({
          success: true,
          ticket,
        });
      } else {
        // Try searching by reservation ID
        const resQuery = query(
          ticketsRef,
          where("reservationId", "==", lookupInput.trim()),
          limit(1)
        );
        const resSnapshot = await getDocs(resQuery);

        if (!resSnapshot.empty) {
          const ticket = { id: resSnapshot.docs[0].id, ...resSnapshot.docs[0].data() };
          setLookupResult({
            success: true,
            ticket,
          });
        } else {
          setLookupResult({
            success: false,
            message: "No ticket found with that receipt number.",
          });
        }
      }
    } catch (err) {
      console.error("Error looking up ticket:", err);
      setLookupResult({
        success: false,
        message: "Error searching for ticket. Please try again.",
      });
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      [VALET_STATUS.PENDING_UPLOAD]: "Pending Upload",
      [VALET_STATUS.UPLOADED]: "Uploaded",
      [VALET_STATUS.CHECK_DROPPED]: "Check Dropped",
      [VALET_STATUS.RETRIEVING]: "Retrieving",
      [VALET_STATUS.READY]: "Ready",
      [VALET_STATUS.COMPLETED]: "Completed",
    };
    return labels[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      [VALET_STATUS.PENDING_UPLOAD]: "#f59e0b",
      [VALET_STATUS.UPLOADED]: "#3b82f6",
      [VALET_STATUS.CHECK_DROPPED]: "#8b5cf6",
      [VALET_STATUS.RETRIEVING]: "#f97316",
      [VALET_STATUS.READY]: "#10b981",
      [VALET_STATUS.COMPLETED]: "#6b7280",
    };
    return colors[status] || "#6b7280";
  };

  return (
    <div className="valet-module">
      <div className="valet-module__header">
        <h3 className="valet-module__title">Valet</h3>
        <div className="valet-module__status">
          <span className="valet-module__status-dot"></span>
          {activeTickets.length} Active
        </div>
      </div>

      <div className="valet-module__content">
        {/* Active Tickets */}
        <div className="valet-module__section">
          <div className="valet-module__section-title">Active Tickets</div>
          {loading ? (
            <div className="valet-module__loading">Loading...</div>
          ) : activeTickets.length > 0 ? (
            <div className="valet-module__list">
              {activeTickets.map((ticket) => (
                <div key={ticket.id} className="valet-module__item">
                  <div className="valet-module__item-header">
                    <div className="valet-module__item-diner">
                      <strong>{ticket.dinerName || "Guest"}</strong>
                    </div>
                    <div
                      className="valet-module__item-status"
                      style={{ color: getStatusColor(ticket.status) }}
                    >
                      {getStatusLabel(ticket.status)}
                    </div>
                  </div>
                  {ticket.receiptNumber && (
                    <div className="valet-module__item-receipt">
                      Receipt: {ticket.receiptNumber}
                    </div>
                  )}
                  {ticket.carDetails && (
                    <div className="valet-module__item-car">
                      {ticket.carDetails.make} {ticket.carDetails.model} • {ticket.carDetails.color}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="valet-module__empty">No active valet tickets</div>
          )}
        </div>

        {/* Lookup Section */}
        <div className="valet-module__lookup">
          <div className="valet-module__lookup-title">Lookup Car Status</div>
          <form onSubmit={handleLookup} className="valet-module__lookup-form">
            <input
              type="text"
              value={lookupInput}
              onChange={(e) => {
                setLookupInput(e.target.value);
                setLookupResult(null);
              }}
              placeholder="Enter receipt number..."
              className="valet-module__lookup-input"
            />
            <button type="submit" className="valet-module__lookup-submit">
              Lookup
            </button>
          </form>

          {lookupResult && (
            <div
              className={`valet-module__lookup-result valet-module__lookup-result--${
                lookupResult.success ? "success" : "error"
              }`}
            >
              {lookupResult.success ? (
                <div>
                  <div className="valet-module__lookup-result-header">
                    <strong>Ticket Found</strong>
                    <span
                      className="valet-module__lookup-status"
                      style={{ color: getStatusColor(lookupResult.ticket.status) }}
                    >
                      {getStatusLabel(lookupResult.ticket.status)}
                    </span>
                  </div>
                  <div className="valet-module__lookup-result-details">
                    <div>Diner: {lookupResult.ticket.dinerName || "Guest"}</div>
                    {lookupResult.ticket.carDetails && (
                      <div>
                        Car: {lookupResult.ticket.carDetails.make} {lookupResult.ticket.carDetails.model}
                      </div>
                    )}
                    {lookupResult.ticket.status === VALET_STATUS.RETRIEVING && (
                      <div className="valet-module__lookup-message">
                        Car is being retrieved and will be ready shortly.
                      </div>
                    )}
                    {lookupResult.ticket.status === VALET_STATUS.READY && (
                      <div className="valet-module__lookup-message valet-module__lookup-message--ready">
                        Car is ready at the front!
                      </div>
                    )}
                    {lookupResult.ticket.status === VALET_STATUS.UPLOADED && (
                      <div className="valet-module__lookup-message">
                        Ticket uploaded. Waiting for check to be presented.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div>{lookupResult.message}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}








