// src/pages/BowlingReservationExtension/BowlingReservationExtension.jsx
//
// BOWLING RESERVATION EXTENSION PAGE
//
// Handles extension requests from push notifications
// Shows when parent clicks on expiration notification

import React, { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../hooks/services/firebase";
import { requestReservationExtension } from "../../utils/bowlingReservationNotificationService";
import "./BowlingReservationExtension.css";

export default function BowlingReservationExtension() {
  const { reservationId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedExtension, setSelectedExtension] = useState(null); // 30 or 60
  const [extending, setExtending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const restaurantId = searchParams.get("restaurantId");
  const minutesRemaining = parseInt(searchParams.get("minutesRemaining") || "0");
  const isParent = searchParams.get("isParent") === "true";

  useEffect(() => {
    if (!reservationId || !restaurantId) {
      setError("Missing reservation information");
      setLoading(false);
      return;
    }

    loadReservation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId, restaurantId]);

  const loadReservation = async () => {
    try {
      const reservationRef = doc(db, "restaurants", restaurantId, "bowlingReservations", reservationId);
      const reservationSnap = await getDoc(reservationRef);

      if (!reservationSnap.exists()) {
        setError("Reservation not found");
        setLoading(false);
        return;
      }

      const data = reservationSnap.data();
      setReservation({
        id: reservationSnap.id,
        ...data,
        startTime: data.startTime?.toDate ? data.startTime.toDate() : new Date(data.startTime),
        endTime: data.endTime?.toDate ? data.endTime.toDate() : new Date(data.endTime),
      });
      setLoading(false);
    } catch (err) {
      console.error("Error loading reservation:", err);
      setError("Failed to load reservation");
      setLoading(false);
    }
  };

  const handleDecline = () => {
    // Just close/redirect - no extension requested
    navigate(-1);
  };

  const handleExtend = async () => {
    if (!selectedExtension) {
      setError("Please select an extension time");
      return;
    }

    if (!isParent) {
      setError("Only the reservation owner can extend the reservation");
      return;
    }

    setExtending(true);
    setError(null);

    try {
      await requestReservationExtension(reservationId, restaurantId, selectedExtension);
      setSuccess(true);
      
      // Auto-close after 3 seconds
      setTimeout(() => {
        navigate(-1);
      }, 3000);
    } catch (err) {
      console.error("Error requesting extension:", err);
      setError(err.message || "Failed to request extension");
      setExtending(false);
    }
  };

  if (loading) {
    return (
      <div className="bowling-extension-page">
        <div className="bowling-extension-container">
          <p>Loading reservation...</p>
        </div>
      </div>
    );
  }

  if (error && !reservation) {
    return (
      <div className="bowling-extension-page">
        <div className="bowling-extension-container">
          <div className="bowling-extension-error">
            <p>{error}</p>
            <button onClick={() => navigate(-1)}>Go Back</button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="bowling-extension-page">
        <div className="bowling-extension-container">
          <div className="bowling-extension-success">
            <h2>Extension Request Sent!</h2>
            <p>Your request to extend the reservation by {selectedExtension} minutes has been sent to the bowling desk.</p>
            <p>You'll receive a notification once it's processed.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bowling-extension-page">
      <div className="bowling-extension-container">
        <div className="bowling-extension-header">
          <h2>Reservation Expiring Soon</h2>
          {reservation && (
            <div className="bowling-extension-info">
              <p><strong>Lane {reservation.laneId}</strong></p>
              <p>{reservation.guestName}</p>
              <p>
                Expires in <strong>{minutesRemaining} minutes</strong>
              </p>
              <p>
                Current end time: {reservation.endTime?.toLocaleTimeString()}
              </p>
            </div>
          )}
        </div>

        {!isParent ? (
          <div className="bowling-extension-message">
            <p>Only the reservation owner can extend this reservation.</p>
            <button onClick={handleDecline} className="bowling-extension-btn bowling-extension-btn--primary">
              OK
            </button>
          </div>
        ) : (
          <>
            <div className="bowling-extension-options">
              <p>Would you like to extend your reservation?</p>
              
              <button
                onClick={handleDecline}
                className="bowling-extension-btn bowling-extension-btn--decline"
              >
                No, That's Fine
              </button>

              <div className="bowling-extension-time-options">
                <button
                  onClick={() => setSelectedExtension(30)}
                  className={`bowling-extension-time-btn ${selectedExtension === 30 ? 'selected' : ''}`}
                >
                  Extend 30 Minutes
                </button>
                <button
                  onClick={() => setSelectedExtension(60)}
                  className={`bowling-extension-time-btn ${selectedExtension === 60 ? 'selected' : ''}`}
                >
                  Extend 1 Hour
                </button>
              </div>

              {selectedExtension && (
                <button
                  onClick={handleExtend}
                  disabled={extending}
                  className="bowling-extension-btn bowling-extension-btn--extend"
                >
                  {extending ? "Sending Request..." : "Extend Reservation"}
                </button>
              )}
            </div>

            {error && (
              <div className="bowling-extension-error">
                <p>{error}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

