import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { collection, getDocs, query, where, orderBy, doc, getDoc } from "firebase/firestore";
import { db } from "../../hooks/services/firebase";
import {
  cancelReservationInLedger,
  getCurrentDinerReservationsFromLedger,
  getPastDinerReservationsFromLedger,
  RESERVATION_SOURCE,
} from "../../utils/reservationLedgerService";
import {
  getDinerValetPreBookings,
  VALET_PRE_BOOKING_STATUS,
} from "../../utils/valetPreBookingService";
import {
  getDinerGamingVenueGroups,
} from "../../utils/gamingVenueReservationService";
import NewReservationModal from "../../components/NewReservationModal/NewReservationModal";
import "./MyReservations.css";

export default function MyReservations() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [currentReservations, setCurrentReservations] = useState([]);
  const [pastReservations, setPastReservations] = useState([]);
  const [bowlingReservations, setBowlingReservations] = useState([]);
  const [currentValetReservations, setCurrentValetReservations] = useState([]);
  const [pastValetReservations, setPastValetReservations] = useState([]);
  const [currentVenueReservations, setCurrentVenueReservations] = useState([]);
  const [pastVenueReservations, setPastVenueReservations] = useState([]);
  const [activeTab, setActiveTab] = useState("current"); // current, valet, venues, bowling, past
  const [cancellingId, setCancellingId] = useState(null);
  const [showNewReservationModal, setShowNewReservationModal] = useState(false);

  // Load reservations
  const loadReservations = useCallback(async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Load table reservations
      const [current, past] = await Promise.all([
        getCurrentDinerReservationsFromLedger(currentUser.uid),
        getPastDinerReservationsFromLedger(currentUser.uid, 20),
      ]);
      setCurrentReservations(current);
      setPastReservations(past);

      // Load bowling reservations
      try {
        const restaurantsRef = collection(db, "restaurants");
        const restaurantsSnap = await getDocs(restaurantsRef);
        const allBowlingReservations = [];

        for (const restaurantDoc of restaurantsSnap.docs) {
          const restaurantId = restaurantDoc.id;
          const restaurantData = restaurantDoc.data();
          
          // Only check restaurants with bowling enabled
          if (restaurantData.attractions?.bowling) {
            try {
              const bowlingReservationsRef = collection(
                db,
                "restaurants",
                restaurantId,
                "bowlingReservations"
              );
              const bowlingQuery = query(
                bowlingReservationsRef,
                where("dinerId", "==", currentUser.uid),
                orderBy("startTime", "desc")
              );
              const bowlingSnap = await getDocs(bowlingQuery);
              
              bowlingSnap.docs.forEach((doc) => {
                const data = doc.data();
                allBowlingReservations.push({
                  id: doc.id,
                  restaurantId,
                  restaurantName: restaurantData.name || restaurantId,
                  ...data,
                });
              });
            } catch (error) {
              // Skip restaurants without proper indexes
              console.warn(`Could not query bowling reservations for restaurant ${restaurantId}:`, error);
            }
          }
        }

        // Separate current and past bowling reservations
        const now = new Date();
        const currentBowling = allBowlingReservations.filter((r) => {
          const endTime = r.endTime?.toDate?.() || new Date(r.endTime);
          return endTime >= now && r.status !== "cancelled" && r.status !== "completed";
        });
        
        setBowlingReservations(currentBowling);
      } catch (error) {
        console.error("Error loading bowling reservations:", error);
      }

      // Load valet pre-bookings
      try {
        const allValetPreBookings = await getDinerValetPreBookings(currentUser.uid);
        
        // Enrich with restaurant names
        const enrichedValetPreBookings = await Promise.all(
          allValetPreBookings.map(async (preBooking) => {
            let restaurantName = preBooking.restaurantName || preBooking.valetCompanyName || "Location";
            
            // If we have restaurantId but no name, fetch it
            if (preBooking.restaurantId && !preBooking.restaurantName) {
              try {
                const restaurantRef = doc(db, "restaurants", preBooking.restaurantId);
                const restaurantSnap = await getDoc(restaurantRef);
                if (restaurantSnap.exists()) {
                  restaurantName = restaurantSnap.data().name || restaurantName;
                }
              } catch (error) {
                console.warn(`Could not fetch restaurant name for ${preBooking.restaurantId}:`, error);
              }
            }
            
            return {
              ...preBooking,
              restaurantName,
            };
          })
        );

        // Separate current and past valet reservations
        const now = new Date();
        const currentValet = enrichedValetPreBookings.filter((r) => {
          const arrivalTime = r.estimatedArrival?.toDate?.() || new Date(r.estimatedArrival);
          return (
            arrivalTime >= now &&
            r.status !== VALET_PRE_BOOKING_STATUS.COMPLETED &&
            r.status !== VALET_PRE_BOOKING_STATUS.CANCELLED
          );
        });
        
        const pastValet = enrichedValetPreBookings.filter((r) => {
          const arrivalTime = r.estimatedArrival?.toDate?.() || new Date(r.estimatedArrival);
          return (
            arrivalTime < now ||
            r.status === VALET_PRE_BOOKING_STATUS.COMPLETED ||
            r.status === VALET_PRE_BOOKING_STATUS.CANCELLED
          );
        });
        
        setCurrentValetReservations(currentValet);
        setPastValetReservations(pastValet);
      } catch (error) {
        console.error("Error loading valet pre-bookings:", error);
      }

      // Load gaming venue groups using service
      try {
        const allVenueGroups = await getDinerGamingVenueGroups(
          currentUser.uid,
          currentUser.email
        );

        // Separate current and past venue groups
        const now = new Date();
        const currentVenue = allVenueGroups.filter((g) => {
          const endTime = g.endTime?.toDate?.() || new Date(g.endTime);
          const extendedUntil = g.extendedUntil?.toDate?.() || null;
          const finalEndTime = extendedUntil || endTime;
          return (
            finalEndTime >= now &&
            g.status !== "completed" &&
            g.status !== "expired"
          );
        });
        
        const pastVenue = allVenueGroups.filter((g) => {
          const endTime = g.endTime?.toDate?.() || new Date(g.endTime);
          const extendedUntil = g.extendedUntil?.toDate?.() || null;
          const finalEndTime = extendedUntil || endTime;
          return (
            finalEndTime < now ||
            g.status === "completed" ||
            g.status === "expired"
          );
        });
        
        setCurrentVenueReservations(currentVenue);
        setPastVenueReservations(pastVenue);
      } catch (error) {
        console.error("Error loading gaming venue groups:", error);
      }
    } catch (error) {
      console.error("Error loading reservations:", error);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadReservations();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadReservations, 30000);
    return () => clearInterval(interval);
  }, [loadReservations]);

  // Check if reservation can be modified/cancelled (2-hour cutoff)
  const canModifyReservation = (reservation) => {
    const reservationTime = reservation.startAtTimestamp?.toDate?.() || new Date(reservation.startAt);
    const now = new Date();
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    return reservationTime > twoHoursFromNow;
  };

  const handleCancelReservation = async (reservation) => {
    if (!canModifyReservation(reservation)) {
      alert("Reservations cannot be cancelled within 2 hours of the reservation time");
      return;
    }

    if (!window.confirm(`Are you sure you want to cancel your reservation at ${reservation.restaurantName}?`)) {
      return;
    }

    setCancellingId(reservation.id);
    try {
      await cancelReservationInLedger({
        restaurantId: reservation.restaurantId,
        reservationId: reservation.id,
        source: "DINER_CANCELLATION",
        reason: "Cancelled by diner",
      });
      alert("Reservation cancelled successfully");
      loadReservations();
    } catch (error) {
      console.error("Error cancelling reservation:", error);
      alert("Failed to cancel reservation. Please try again.");
    } finally {
      setCancellingId(null);
    }
  };

  const formatDate = (dateISO) => {
    try {
      const date = dateISO?.toDate ? dateISO.toDate() : new Date(dateISO);
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateISO || "N/A";
    }
  };

  const formatTime = (dateISO) => {
    try {
      const date = dateISO?.toDate ? dateISO.toDate() : new Date(dateISO);
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return dateISO || "N/A";
    }
  };

  const formatDateTime = (dateISO) => {
    try {
      const date = dateISO?.toDate ? dateISO.toDate() : new Date(dateISO);
      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return dateISO || "N/A";
    }
  };

  if (!currentUser) {
    return (
      <div className="my-reservations-page">
        <div className="my-reservations-container">
          <h1>My Reservations</h1>
          <p>Please sign in to view your reservations.</p>
          <Link to="/login" className="login-link">Sign In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="my-reservations-page">
      <Link to="/" className="my-reservations-back-link">← Back</Link>
      <div className="my-reservations-container">
        <div className="my-reservations-header">
          <h1>My Reservations</h1>
          <button 
            className="new-reservation-btn"
            onClick={() => setShowNewReservationModal(true)}
          >
            + New Reservation
          </button>
        </div>

        {/* New Reservation Modal */}
        <NewReservationModal
          isOpen={showNewReservationModal}
          onClose={() => setShowNewReservationModal(false)}
        />

        {/* Tabs */}
        <div className="reservations-tabs">
          <button
            className={`tab-btn ${activeTab === "current" ? "active" : ""}`}
            onClick={() => setActiveTab("current")}
          >
            Restaurants ({currentReservations.length})
          </button>
          <button
            className={`tab-btn ${activeTab === "valet" ? "active" : ""}`}
            onClick={() => setActiveTab("valet")}
          >
            Valet ({currentValetReservations.length})
          </button>
          <button
            className={`tab-btn ${activeTab === "venues" ? "active" : ""}`}
            onClick={() => setActiveTab("venues")}
          >
            Venues ({currentVenueReservations.length})
          </button>
          <button
            className={`tab-btn ${activeTab === "bowling" ? "active" : ""}`}
            onClick={() => setActiveTab("bowling")}
          >
            Bowling ({bowlingReservations.length})
          </button>
          <button
            className={`tab-btn ${activeTab === "past" ? "active" : ""}`}
            onClick={() => setActiveTab("past")}
          >
            Past ({pastReservations.length + pastValetReservations.length + pastVenueReservations.length})
          </button>
        </div>

        {loading ? (
          <div className="loading-state">Loading reservations...</div>
        ) : (
          <>
            {/* RESTAURANT RESERVATIONS */}
            {activeTab === "current" && (
              <section className="reservations-section">
                {currentReservations.length > 0 ? (
                  <div className="reservation-list">
                    {currentReservations.map((res) => {
                      const canModify = canModifyReservation(res);
                      return (
                        <div key={res.id} className="reservation-card">
                          <div className="reservation-card-header">
                            <div>
                              <h3>{res.restaurantName || "Restaurant"}</h3>
                              <div className="reservation-meta">
                                <span className="reservation-type-badge">Table</span>
                                {res.source?.system === RESERVATION_SOURCE.OPENTABLE && (
                                  <span className="reservation-source-badge" title="Reserved via OpenTable">
                                    OT
                                  </span>
                                )}
                                <span className={`reservation-status status-${res.status?.toLowerCase()}`}>
                                  {res.status}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="reservation-details">
                            <div className="reservation-detail-item">
                              <strong>Date:</strong> {formatDate(res.startAt)}
                            </div>
                            <div className="reservation-detail-item">
                              <strong>Time:</strong> {formatTime(res.startAt)}
                            </div>
                            <div className="reservation-detail-item">
                              <strong>Party Size:</strong> {res.partySize} {res.partySize === 1 ? "guest" : "guests"}
                            </div>
                            {res.metadata?.serverName && (
                              <div className="reservation-detail-item">
                                <strong>Requested Server:</strong> {res.metadata.serverName}
                              </div>
                            )}
                            {res.metadata?.specialRequests && (
                              <div className="reservation-detail-item">
                                <strong>Special Requests:</strong> {res.metadata.specialRequests}
                              </div>
                            )}
                            {res.metadata?.preferences && res.metadata.preferences.length > 0 && (
                              <div className="reservation-detail-item">
                                <strong>Preferences:</strong> {res.metadata.preferences.join(", ")}
                              </div>
                            )}
                          </div>
                          {res.source?.system === RESERVATION_SOURCE.OPENTABLE ? (
                            <p className="info-text">
                              OpenTable reservations must be cancelled through OpenTable.
                            </p>
                          ) : (
                            <div className="reservation-actions">
                              <button
                                className="cancel-btn"
                                onClick={() => handleCancelReservation(res)}
                                disabled={!canModify || cancellingId === res.id}
                                title={!canModify ? "Reservations cannot be cancelled within 2 hours of the reservation time" : ""}
                              >
                                {cancellingId === res.id ? "Cancelling..." : canModify ? "Cancel Reservation" : "Cannot Cancel (Within 2 Hours)"}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>No upcoming reservations</p>
                    <Link to="/reservation" className="new-reservation-link">
                      Make a Reservation
                    </Link>
                  </div>
                )}
              </section>
            )}

            {/* VALET RESERVATIONS */}
            {activeTab === "valet" && (
              <section className="reservations-section">
                {currentValetReservations.length > 0 ? (
                  <div className="reservation-list">
                    {currentValetReservations.map((res) => {
                      const arrivalTime = res.estimatedArrival?.toDate?.() || new Date(res.estimatedArrival);
                      const now = new Date();
                      const isUpcoming = arrivalTime > now;
                      
                      return (
                        <div key={res.id} className="reservation-card valet-card">
                          <div className="reservation-card-header">
                            <div>
                              <h3>{res.restaurantName || "Location"}</h3>
                              <div className="reservation-meta">
                                <span className="reservation-type-badge valet-badge">Valet</span>
                                <span className={`reservation-status status-${res.status?.toLowerCase()}`}>
                                  {res.status === VALET_PRE_BOOKING_STATUS.PENDING && "Pending"}
                                  {res.status === VALET_PRE_BOOKING_STATUS.ARRIVED && "Arrived"}
                                  {res.status === VALET_PRE_BOOKING_STATUS.ACTIVE && "Active"}
                                  {res.status === VALET_PRE_BOOKING_STATUS.COMPLETED && "Completed"}
                                  {res.status === VALET_PRE_BOOKING_STATUS.CANCELLED && "Cancelled"}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="reservation-details">
                            <div className="reservation-detail-item">
                              <strong>Estimated Arrival:</strong> {formatDateTime(res.estimatedArrival)}
                            </div>
                            {res.carInfo && (
                              <>
                                <div className="reservation-detail-item">
                                  <strong>Car:</strong> {res.carInfo.color} {res.carInfo.make} {res.carInfo.model}
                                </div>
                                <div className="reservation-detail-item">
                                  <strong>License Plate:</strong> {res.carInfo.licensePlate}
                                </div>
                              </>
                            )}
                            {res.payment && (
                              <div className="reservation-detail-item">
                                <strong>Payment:</strong> ${(res.payment.amount || 0).toFixed(2)} 
                                {res.payment.status === "succeeded" && (
                                  <span className="payment-status-success"> ✓ Paid</span>
                                )}
                              </div>
                            )}
                            {isUpcoming && (
                              <div className="reservation-detail-item active-indicator">
                                <strong>⏱️ Arriving in:</strong> {Math.max(0, Math.floor((arrivalTime - now) / 60000))} minutes
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>No upcoming valet reservations</p>
                  </div>
                )}
              </section>
            )}

            {/* VENUE RESERVATIONS */}
            {activeTab === "venues" && (
              <section className="reservations-section">
                {currentVenueReservations.length > 0 ? (
                  <div className="reservation-list">
                    {currentVenueReservations.map((group) => {
                      const startTime = group.startTime?.toDate?.() || new Date(group.startTime);
                      const endTime = group.endTime?.toDate?.() || new Date(group.endTime);
                      const extendedUntil = group.extendedUntil?.toDate?.() || null;
                      const finalEndTime = extendedUntil || endTime;
                      const now = new Date();
                      const isActive = group.status === "active";
                      const timeRemaining = Math.max(0, Math.floor((finalEndTime - now) / 60000));
                      const isParent = group.parentUserId === currentUser.uid;
                      
                      return (
                        <div key={group.id} className="reservation-card venue-card">
                          <div className="reservation-card-header">
                            <div>
                              <h3>{group.restaurantName || "Venue"}</h3>
                              <div className="reservation-meta">
                                <span className="reservation-type-badge venue-badge">Venue</span>
                                <span className={`reservation-status status-${group.status?.toLowerCase()}`}>
                                  {group.status === "active" && "Active"}
                                  {group.status === "paused" && "Paused"}
                                  {group.status === "completed" && "Completed"}
                                  {group.status === "expired" && "Expired"}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="reservation-details">
                            <div className="reservation-detail-item">
                              <strong>Start Time:</strong> {formatDateTime(startTime)}
                            </div>
                            <div className="reservation-detail-item">
                              <strong>End Time:</strong> {formatDateTime(finalEndTime)}
                              {extendedUntil && (
                                <span className="extended-badge"> (Extended)</span>
                              )}
                            </div>
                            <div className="reservation-detail-item">
                              <strong>Time Limit:</strong> {group.timeLimit} minutes
                            </div>
                            <div className="reservation-detail-item">
                              <strong>Group Size:</strong> {group.members?.length || 1} {group.members?.length === 1 ? "person" : "people"}
                            </div>
                            {group.parentName && (
                              <div className="reservation-detail-item">
                                <strong>Group Leader:</strong> {group.parentName}
                              </div>
                            )}
                            {isParent && (
                              <div className="reservation-detail-item">
                                <strong>Your Role:</strong> <span className="parent-badge">Parent/Leader</span>
                              </div>
                            )}
                            {!isParent && (
                              <div className="reservation-detail-item">
                                <strong>Your Role:</strong> <span className="member-badge">Member</span>
                              </div>
                            )}
                            {isActive && timeRemaining > 0 && (
                              <div className="reservation-detail-item active-indicator">
                                <strong>⏱️ Time Remaining:</strong> {timeRemaining} minutes
                              </div>
                            )}
                            {group.cardOnFile && (
                              <div className="reservation-detail-item">
                                <strong>💳 Card on File:</strong> {group.cardLast4 ? `****${group.cardLast4}` : "Yes"}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>No upcoming venue reservations</p>
                  </div>
                )}
              </section>
            )}

            {/* BOWLING RESERVATIONS */}
            {activeTab === "bowling" && (
              <section className="reservations-section">
                {bowlingReservations.length > 0 ? (
                  <div className="reservation-list">
                    {bowlingReservations.map((res) => {
                      const endTime = res.endTime?.toDate?.() || new Date(res.endTime);
                      const now = new Date();
                      const isActive = endTime >= now && res.status === "checked-in";
                      const canModify = endTime > new Date(now.getTime() + 2 * 60 * 60 * 1000);
                      
                      return (
                        <div key={res.id} className="reservation-card bowling-card">
                          <div className="reservation-card-header">
                            <div>
                              <h3>{res.restaurantName || "Restaurant"}</h3>
                              <div className="reservation-meta">
                                <span className="reservation-type-badge">Bowling</span>
                                <span className={`reservation-status status-${res.status?.toLowerCase()}`}>
                                  {res.status === "checked-in" ? "Active" : res.status}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="reservation-details">
                            <div className="reservation-detail-item">
                              <strong>Lane:</strong> {res.laneId}
                            </div>
                            <div className="reservation-detail-item">
                              <strong>Start Time:</strong> {formatDateTime(res.startTime)}
                            </div>
                            <div className="reservation-detail-item">
                              <strong>End Time:</strong> {formatDateTime(res.endTime)}
                            </div>
                            <div className="reservation-detail-item">
                              <strong>Duration:</strong> {res.duration} minutes
                            </div>
                            <div className="reservation-detail-item">
                              <strong>Party Size:</strong> {res.partySize} {res.partySize === 1 ? "person" : "people"}
                            </div>
                            {res.guestName && (
                              <div className="reservation-detail-item">
                                <strong>Guest Name:</strong> {res.guestName}
                              </div>
                            )}
                            {res.needsShoes && res.shoeRentals && res.shoeRentals.length > 0 && (
                              <div className="reservation-detail-item">
                                <strong>Shoe Rentals:</strong> {res.shoeRentals.length} {res.shoeRentals.length === 1 ? "pair" : "pairs"}
                              </div>
                            )}
                            {isActive && (
                              <div className="reservation-detail-item active-indicator">
                                <strong>⏱️ Time Remaining:</strong> {Math.max(0, Math.floor((endTime - now) / 60000))} minutes
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>No upcoming bowling reservations</p>
                  </div>
                )}
              </section>
            )}

            {/* PAST RESERVATIONS */}
            {activeTab === "past" && (() => {
              // Combine and sort past reservations (most recent first)
              const allPastReservations = [
                ...pastReservations.map(res => ({ ...res, type: 'table', sortTime: res.startAtTimestamp?.toDate?.() || new Date(res.startAt) })),
                ...pastValetReservations.map(res => ({ ...res, type: 'valet', sortTime: res.estimatedArrival?.toDate?.() || new Date(res.estimatedArrival) })),
                ...pastVenueReservations.map(res => ({ 
                  ...res, 
                  type: 'venue', 
                  sortTime: res.extendedUntil?.toDate?.() || res.endTime?.toDate?.() || new Date(res.endTime || res.startTime) 
                }))
              ].sort((a, b) => b.sortTime - a.sortTime);

              return (
                <section className="reservations-section">
                  {allPastReservations.length > 0 ? (
                    <div className="reservation-list">
                      {allPastReservations.map((res) => {
                        if (res.type === 'table') {
                          return (
                            <div key={res.id} className="reservation-card past-card">
                              <div className="reservation-card-header">
                                <div>
                                  <h3>{res.restaurantName || "Restaurant"}</h3>
                                  <div className="reservation-meta">
                                    {res.source?.system === RESERVATION_SOURCE.OPENTABLE && (
                                      <span className="reservation-source-badge" title="Reserved via OpenTable">
                                        OT
                                      </span>
                                    )}
                                    <span className="reservation-type-badge">Table</span>
                                    <span className={`reservation-status status-${res.status?.toLowerCase()}`}>
                                      {res.status}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="reservation-details">
                                <div className="reservation-detail-item">
                                  <strong>Date:</strong> {formatDate(res.startAt)}
                                </div>
                                <div className="reservation-detail-item">
                                  <strong>Time:</strong> {formatTime(res.startAt)}
                                </div>
                                <div className="reservation-detail-item">
                                  <strong>Party Size:</strong> {res.partySize} {res.partySize === 1 ? "guest" : "guests"}
                                </div>
                                {res.metadata?.serverName && (
                                  <div className="reservation-detail-item">
                                    <strong>Server:</strong> {res.metadata.serverName}
                                  </div>
                                )}
                              </div>
                              <div className="reservation-actions">
                                <Link
                                  to={`/review/${res.restaurantId}`}
                                  className="review-btn"
                                  state={{ reservationId: res.id }}
                                >
                                  Write a Review
                                </Link>
                              </div>
                            </div>
                          );
                        } else if (res.type === 'valet') {
                          return (
                            <div key={res.id} className="reservation-card past-card valet-card">
                              <div className="reservation-card-header">
                                <div>
                                  <h3>{res.restaurantName || "Location"}</h3>
                                  <div className="reservation-meta">
                                    <span className="reservation-type-badge valet-badge">Valet</span>
                                    <span className={`reservation-status status-${res.status?.toLowerCase()}`}>
                                      {res.status === VALET_PRE_BOOKING_STATUS.COMPLETED && "Completed"}
                                      {res.status === VALET_PRE_BOOKING_STATUS.CANCELLED && "Cancelled"}
                                      {res.status === VALET_PRE_BOOKING_STATUS.ACTIVE && "Active"}
                                      {res.status === VALET_PRE_BOOKING_STATUS.ARRIVED && "Arrived"}
                                      {res.status === VALET_PRE_BOOKING_STATUS.PENDING && "Past"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="reservation-details">
                                <div className="reservation-detail-item">
                                  <strong>Date:</strong> {formatDate(res.estimatedArrival)}
                                </div>
                                <div className="reservation-detail-item">
                                  <strong>Time:</strong> {formatTime(res.estimatedArrival)}
                                </div>
                                {res.carInfo && (
                                  <>
                                    <div className="reservation-detail-item">
                                      <strong>Car:</strong> {res.carInfo.color} {res.carInfo.make} {res.carInfo.model}
                                    </div>
                                    <div className="reservation-detail-item">
                                      <strong>License Plate:</strong> {res.carInfo.licensePlate}
                                    </div>
                                  </>
                                )}
                                {res.payment && (
                                  <div className="reservation-detail-item">
                                    <strong>Payment:</strong> ${(res.payment.amount || 0).toFixed(2)}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        } else if (res.type === 'venue') {
                          const startTime = res.startTime?.toDate?.() || new Date(res.startTime);
                          const endTime = res.endTime?.toDate?.() || new Date(res.endTime);
                          const extendedUntil = res.extendedUntil?.toDate?.() || null;
                          const finalEndTime = extendedUntil || endTime;
                          const isParent = res.parentUserId === currentUser.uid;
                          
                          return (
                            <div key={res.id} className="reservation-card past-card venue-card">
                              <div className="reservation-card-header">
                                <div>
                                  <h3>{res.restaurantName || "Venue"}</h3>
                                  <div className="reservation-meta">
                                    <span className="reservation-type-badge venue-badge">Venue</span>
                                    <span className={`reservation-status status-${res.status?.toLowerCase()}`}>
                                      {res.status === "completed" && "Completed"}
                                      {res.status === "expired" && "Expired"}
                                      {res.status === "active" && "Past"}
                                      {res.status === "paused" && "Paused"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="reservation-details">
                                <div className="reservation-detail-item">
                                  <strong>Date:</strong> {formatDate(startTime)}
                                </div>
                                <div className="reservation-detail-item">
                                  <strong>Time:</strong> {formatTime(startTime)} - {formatTime(finalEndTime)}
                                </div>
                                <div className="reservation-detail-item">
                                  <strong>Duration:</strong> {res.timeLimit} minutes
                                </div>
                                <div className="reservation-detail-item">
                                  <strong>Group Size:</strong> {res.members?.length || 1} {res.members?.length === 1 ? "person" : "people"}
                                </div>
                                {res.parentName && (
                                  <div className="reservation-detail-item">
                                    <strong>Group Leader:</strong> {res.parentName}
                                  </div>
                                )}
                                {isParent && (
                                  <div className="reservation-detail-item">
                                    <strong>Your Role:</strong> <span className="parent-badge">Parent/Leader</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }
                      })}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <p>No past reservations</p>
                    </div>
                  )}
                </section>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}

