// src/pages/Dashboards/RestaurantDashboard/tabs/ValetTab.jsx
//
// VALET TAB - Restaurant Dashboard
//
// Hostess enters valet tickets, valet staff manages retrieval and ready status

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../../../context/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../../hooks/services/firebase";
import {
  getActiveValetTickets,
  getValetTicketByReservation,
  uploadValetTicketPhoto,
  startCarRetrieval,
  markCarReady,
  completeValetTicket,
  VALET_STATUS,
} from "../../../../utils/valetService";
import "./ValetTab.css";

export default function ValetTab() {
  const { restaurantId } = useParams();
  const { currentUser } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all"); // all, pending, check_dropped, retrieving, ready
  const [staffData, setStaffData] = useState(null);

  // Hostess upload ticket form
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketPhoto, setTicketPhoto] = useState(null);
  const [ticketPreview, setTicketPreview] = useState(null);
  const [ticketNumber, setTicketNumber] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef(null);

  // Load valet tickets
  const loadTickets = useCallback(async () => {
    if (!restaurantId) return;

    setLoading(true);
    setError(null);

    try {
      const options = filter !== "all" ? { status: filter } : {};
      const activeTickets = await getActiveValetTickets(restaurantId, options);
      setTickets(activeTickets);
    } catch (err) {
      console.error("Error loading valet tickets:", err);
      setError("Failed to load valet tickets. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, filter]);

  // Load staff data for current user
  useEffect(() => {
    const loadStaffData = async () => {
      if (!restaurantId || !currentUser?.uid) return;
      
      try {
        const staffRef = doc(db, "restaurants", restaurantId, "staff", currentUser.uid);
        const staffSnap = await getDoc(staffRef);
        if (staffSnap.exists()) {
          setStaffData(staffSnap.data());
        }
      } catch (err) {
        console.error("Error loading staff data:", err);
      }
    };
    
    loadStaffData();
  }, [restaurantId, currentUser]);

  useEffect(() => {
    loadTickets();
    // Refresh every 10 seconds for real-time updates
    const interval = setInterval(loadTickets, 10000);
    return () => clearInterval(interval);
  }, [loadTickets]);

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
    if (!selectedTicket || !ticketPhoto) {
      alert("Please select a ticket and photo");
      return;
    }

    setUploading(true);

    try {
      await uploadValetTicketPhoto(
        restaurantId,
        selectedTicket.id,
        ticketPhoto,
        "hostess",
        ticketNumber || null
      );

      // Reset form
      setSelectedTicket(null);
      setTicketPhoto(null);
      setTicketPreview(null);
      setTicketNumber("");
      setShowUploadForm(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await loadTickets();
    } catch (err) {
      console.error("Error uploading ticket:", err);
      alert(`Failed to upload ticket: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const openUploadForm = (ticket) => {
    setSelectedTicket(ticket);
    setShowUploadForm(true);
  };

  const handleStartRetrieval = async (ticketId) => {
    if (!restaurantId) return;

    try {
      // Get actual staff member ID from auth context
      const staffMemberId = currentUser?.uid || "system";
      await startCarRetrieval(restaurantId, ticketId, staffMemberId);
      await loadTickets();
    } catch (err) {
      console.error("Error starting retrieval:", err);
      alert(`Failed to start retrieval: ${err.message}`);
    }
  };

  const handleMarkReady = async (ticketId) => {
    if (!restaurantId) return;

    try {
      // Get actual valet employee ID and name from current user and staff data
      const valetEmployeeId = currentUser?.uid || "system";
      const valetEmployeeName = staffData?.name || currentUser?.displayName || "Valet Driver";
      
      await markCarReady(restaurantId, ticketId, valetEmployeeId, valetEmployeeName);
      await loadTickets();
    } catch (err) {
      console.error("Error marking car ready:", err);
      alert(`Failed to mark car ready: ${err.message}`);
    }
  };

  const handleComplete = async (ticketId) => {
    if (!restaurantId) return;

    try {
      await completeValetTicket(restaurantId, ticketId);
      await loadTickets();
    } catch (err) {
      console.error("Error completing ticket:", err);
      alert(`Failed to complete ticket: ${err.message}`);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case VALET_STATUS.PENDING_UPLOAD:
        return "#ef4444"; // red - needs attention
      case VALET_STATUS.UPLOADED:
        return "#3b82f6"; // blue
      case VALET_STATUS.CHECK_DROPPED:
        return "#f59e0b"; // amber
      case VALET_STATUS.RETRIEVING:
        return "#8b5cf6"; // purple
      case VALET_STATUS.READY:
        return "#10b981"; // green
      default:
        return "#6b7280"; // gray
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case VALET_STATUS.PENDING_UPLOAD:
        return "Need Ticket Photo";
      case VALET_STATUS.UPLOADED:
        return "Waiting for Check";
      case VALET_STATUS.CHECK_DROPPED:
        return "Check Dropped - Ready";
      case VALET_STATUS.RETRIEVING:
        return "Retrieving Car";
      case VALET_STATUS.READY:
        return "Car Ready";
      default:
        return status;
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "—";
    
    let date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else {
      date = new Date(timestamp);
    }

    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (loading && tickets.length === 0) {
    return (
      <div className="valet-container">
        <div className="valet-loading">
          <p>Loading valet tickets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="valet-container">
      <div className="valet-header">
        <div>
          <h2>Valet Management</h2>
          <p className="valet-subtitle">
            Manage valet tickets and car retrieval workflow
          </p>
        </div>
        
        <div className="valet-controls">
          <div className="filter-group">
            <label>Filter:</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Active</option>
              <option value={VALET_STATUS.PENDING_UPLOAD}>Need Ticket Photo</option>
              <option value={VALET_STATUS.UPLOADED}>Waiting for Check</option>
              <option value={VALET_STATUS.CHECK_DROPPED}>Check Dropped</option>
              <option value={VALET_STATUS.RETRIEVING}>Retrieving</option>
              <option value={VALET_STATUS.READY}>Ready</option>
            </select>
          </div>
          
          <button
            onClick={() => {
              // Show tickets that need upload
              setFilter(VALET_STATUS.PENDING_UPLOAD);
            }}
            className="valet-btn valet-btn-primary"
          >
            View Missing Tickets
          </button>
        </div>
      </div>

      {error && (
        <div className="valet-error">
          {error}
        </div>
      )}

      {/* Hostess Upload Form */}
      {showUploadForm && selectedTicket && (
        <div className="valet-form-card">
          <h3>Upload Valet Ticket for {selectedTicket.dinerName}</h3>
          <p className="form-subtitle">
            Take a photo of the guest's valet ticket
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
                className="valet-btn valet-btn-secondary"
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
                className="valet-btn valet-btn-primary"
                style={{ fontSize: "18px", padding: "20px" }}
              >
                📷 Take Photo
              </button>
            </div>
          )}

          <div className="form-group" style={{ marginTop: "20px" }}>
            <label>Ticket Number (Optional)</label>
            <input
              type="text"
              value={ticketNumber}
              onChange={(e) => setTicketNumber(e.target.value)}
              placeholder="Enter ticket number if visible"
            />
          </div>

          <div className="form-actions">
            {ticketPhoto && (
              <button
                onClick={handleUploadTicket}
                disabled={uploading}
                className="valet-btn valet-btn-primary"
              >
                {uploading ? "Uploading..." : "Upload Ticket"}
              </button>
            )}
            <button
              onClick={() => {
                setShowUploadForm(false);
                setSelectedTicket(null);
                setTicketPhoto(null);
                setTicketPreview(null);
                setTicketNumber("");
              }}
              className="valet-btn valet-btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tickets List */}
      {tickets.length === 0 ? (
        <div className="valet-empty">
          <p>No active valet tickets</p>
          <p className="empty-subtitle">
            {filter !== "all" 
              ? `No tickets with status: ${getStatusLabel(filter)}`
              : "Enter a new ticket to get started"}
          </p>
        </div>
      ) : (
        <div className="valet-tickets-grid">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="valet-ticket-card">
              <div className="ticket-header">
                <div className="ticket-number">
                  <span className="ticket-label">Ticket</span>
                  <span className="ticket-value">{ticket.ticketNumber}</span>
                </div>
                <div
                  className="ticket-status"
                  style={{ backgroundColor: getStatusColor(ticket.status) }}
                >
                  {getStatusLabel(ticket.status)}
                </div>
              </div>

              <div className="ticket-details">
                <div className="ticket-detail">
                  <span className="detail-label">Diner:</span>
                  <span className="detail-value">{ticket.dinerName}</span>
                </div>
                <div className="ticket-detail">
                  <span className="detail-label">Table:</span>
                  <span className="detail-value">{ticket.tableId}</span>
                </div>
                {ticket.carDescription && (
                  <div className="ticket-detail">
                    <span className="detail-label">Car:</span>
                    <span className="detail-value">{ticket.carDescription}</span>
                  </div>
                )}
                <div className="ticket-detail">
                  <span className="detail-label">Entered:</span>
                  <span className="detail-value">{formatTime(ticket.enteredAt)}</span>
                </div>
                {ticket.checkDroppedAt && (
                  <div className="ticket-detail">
                    <span className="detail-label">Check Dropped:</span>
                    <span className="detail-value">{formatTime(ticket.checkDroppedAt)}</span>
                  </div>
                )}
              </div>

              {ticket.ticketPhotoUrl && (
                <div className="ticket-photo">
                  <img src={ticket.ticketPhotoUrl} alt="Valet ticket" />
                </div>
              )}

              <div className="ticket-actions">
                {ticket.status === VALET_STATUS.PENDING_UPLOAD && (
                  <button
                    onClick={() => openUploadForm(ticket)}
                    className="valet-btn valet-btn-primary"
                  >
                    📷 Upload Ticket
                  </button>
                )}
                
                {ticket.status === VALET_STATUS.CHECK_DROPPED && (
                  <button
                    onClick={() => handleStartRetrieval(ticket.id)}
                    className="valet-btn valet-btn-action"
                  >
                    🚗 Start Retrieval
                  </button>
                )}
                
                {ticket.status === VALET_STATUS.RETRIEVING && (
                  <button
                    onClick={() => handleMarkReady(ticket.id)}
                    className="valet-btn valet-btn-success"
                  >
                    ✅ Car Ready
                  </button>
                )}
                
                {ticket.status === VALET_STATUS.READY && (
                  <button
                    onClick={() => handleComplete(ticket.id)}
                    className="valet-btn valet-btn-complete"
                  >
                    ✓ Complete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

