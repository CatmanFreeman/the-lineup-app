// src/components/GuestCheckIn.jsx
//
// GUEST CHECK-IN COMPONENT
//
// Guest checks in and can select valet parking
// If valet selected, prompts for ticket photo upload

import React, { useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { createValetEntryOnCheckIn, uploadValetTicketPhoto } from "../utils/valetService";
import "./GuestCheckIn.css";

export default function GuestCheckIn({
  reservationId,
  restaurantId,
  dinerName,
  dinerPhone,
  onCheckInComplete,
}) {
  const { currentUser } = useAuth();
  const [isValetParking, setIsValetParking] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [showTicketUpload, setShowTicketUpload] = useState(false);
  const [uploadingTicket, setUploadingTicket] = useState(false);
  const [ticketPhoto, setTicketPhoto] = useState(null);
  const [ticketPreview, setTicketPreview] = useState(null);
  const [ticketNumber, setTicketNumber] = useState("");
  const fileInputRef = useRef(null);

  const handleCheckIn = async () => {
    if (!currentUser) {
      alert("Please log in to check in");
      return;
    }

    setCheckingIn(true);

    try {
      // Check in immediately (don't delay)
      // This would call your check-in service
      // For now, we'll handle valet after check-in

      if (isValetParking) {
        // Create valet entry
        await createValetEntryOnCheckIn({
          restaurantId,
          reservationId,
          dinerId: currentUser.uid,
          dinerName,
          dinerPhone,
        });

        // Show ticket upload prompt
        setShowTicketUpload(true);
      } else {
        // Regular check-in, no valet
        if (onCheckInComplete) {
          onCheckInComplete({ valetParking: false });
        }
      }
    } catch (error) {
      console.error("Error checking in:", error);
      alert("Failed to check in. Please try again.");
    } finally {
      setCheckingIn(false);
    }
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setTicketPhoto(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setTicketPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadTicket = async () => {
    if (!ticketPhoto) {
      alert("Please select a photo of your valet ticket");
      return;
    }

    setUploadingTicket(true);

    try {
      // Get valet ticket ID (would need to fetch it)
      // For now, we'll need to get it from the valet entry we just created
      const { getValetTicketByReservation } = await import("../utils/valetService");
      const ticket = await getValetTicketByReservation(restaurantId, reservationId);
      
      if (!ticket) {
        throw new Error("Valet ticket not found");
      }

      await uploadValetTicketPhoto(
        restaurantId,
        ticket.id,
        ticketPhoto,
        "guest",
        ticketNumber || null
      );

      // Complete check-in
      if (onCheckInComplete) {
        onCheckInComplete({ valetParking: true, ticketUploaded: true });
      }

      setShowTicketUpload(false);
    } catch (error) {
      console.error("Error uploading ticket:", error);
      alert("Failed to upload ticket. You can upload it later or ask the hostess for help.");
      // Still complete check-in even if upload fails
      if (onCheckInComplete) {
        onCheckInComplete({ valetParking: true, ticketUploaded: false });
      }
    } finally {
      setUploadingTicket(false);
    }
  };

  const handleSkipUpload = () => {
    // Guest can skip upload, hostess will be notified
    if (onCheckInComplete) {
      onCheckInComplete({ valetParking: true, ticketUploaded: false });
    }
    setShowTicketUpload(false);
  };

  if (showTicketUpload) {
    return (
      <div className="guest-checkin-container">
        <div className="checkin-card">
          <h2>Upload Valet Ticket</h2>
          <p className="checkin-subtitle">
            Take a photo of your valet ticket
          </p>

          {ticketPreview ? (
            <div className="ticket-preview">
              <img src={ticketPreview} alt="Ticket preview" />
              <button
                onClick={() => {
                  setTicketPhoto(null);
                  setTicketPreview(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
                className="btn-secondary"
              >
                Take Another Photo
              </button>
            </div>
          ) : (
            <div className="upload-area">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoSelect}
                style={{ display: "none" }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-camera"
              >
                📷 Take Photo
              </button>
            </div>
          )}

          <div className="ticket-number-input">
            <label>Ticket Number (Optional)</label>
            <input
              type="text"
              value={ticketNumber}
              onChange={(e) => setTicketNumber(e.target.value)}
              placeholder="Enter ticket number if visible"
            />
          </div>

          <div className="checkin-actions">
            {ticketPhoto && (
              <button
                onClick={handleUploadTicket}
                disabled={uploadingTicket}
                className="btn-primary"
              >
                {uploadingTicket ? "Uploading..." : "Upload Ticket"}
              </button>
            )}
            <button
              onClick={handleSkipUpload}
              className="btn-secondary"
            >
              Skip for Now
            </button>
          </div>

          <p className="help-text">
            Don't worry if you can't upload now. The hostess can help you upload it later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="guest-checkin-container">
      <div className="checkin-card">
        <h2>Check In</h2>
        <p className="checkin-subtitle">
          Welcome! Please check in for your reservation.
        </p>

        <div className="valet-option">
          <label className="valet-checkbox">
            <input
              type="checkbox"
              checked={isValetParking}
              onChange={(e) => setIsValetParking(e.target.checked)}
            />
            <span>I'm using valet parking</span>
          </label>
        </div>

        <button
          onClick={handleCheckIn}
          disabled={checkingIn}
          className="btn-primary btn-checkin"
        >
          {checkingIn ? "Checking In..." : "Check In"}
        </button>

        {isValetParking && (
          <p className="valet-info">
            After checking in, you'll be asked to upload a photo of your valet ticket.
          </p>
        )}
      </div>
    </div>
  );
}








