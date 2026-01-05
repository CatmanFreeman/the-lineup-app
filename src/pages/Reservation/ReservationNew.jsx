// src/pages/Reservation/ReservationNew.jsx
//
// UPDATED RESERVATION COMPONENT
// 
// Phase 3: Native Reservation UI Updates
// - Uses availability engine for slot selection
// - Enforces 15-minute slots
// - Phone verification for LINEUP reservations
// - 2-hour modification/cancellation cutoff
// - Uses canonical ledger service

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../../hooks/services/firebase";
import {
  createReservationInLedger,
  RESERVATION_SOURCE,
  cancelReservationInLedger,
  getCurrentDinerReservationsFromLedger,
  getPastDinerReservationsFromLedger,
} from "../../utils/reservationLedgerService";
import {
  computeAvailability,
  checkSlotAvailability,
  SLOT_TIER,
  CONFIDENCE,
} from "../../utils/availabilityEngineService";
import {
  validatePhoneFormat,
  formatPhoneNumber,
  normalizePhoneNumber,
  verifyPhoneNumber,
} from "../../utils/phoneVerificationService";
import { getAvailableServers } from "../../utils/reservationService";
import "./Reservation.css";

// Reservation Preferences options (subset of restaurant preferences)
const RESERVATION_PREFERENCE_OPTIONS = [
  "Waterfront",
  "Ocean View",
  "Water View",
  "Riverfront",
  "Patio Seating",
  "Rooftop",
  "Outdoor Seating",
  "Gluten Free",
  "Vegetarian",
  "Vegan",
  "Pescatarian",
  "Wheelchair Accessible",
  "Blind",
  "Deaf",
  "Birthday",
  "Anniversary",
];

const PREFERENCE_KEY_MAP = {
  "Waterfront": "waterfront",
  "Ocean View": "oceanView",
  "Water View": "waterView",
  "Riverfront": "riverfront",
  "Patio Seating": "patioSeating",
  "Rooftop": "rooftop",
  "Outdoor Seating": "outdoorSeating",
  "Gluten Free": "glutenFreeOptions",
  "Vegetarian": "vegetarianOptions",
  "Vegan": "veganOptions",
  "Pescatarian": "pescatarian",
  "Wheelchair Accessible": "wheelchairAccessible",
  "Blind": "blind",
  "Deaf": "deaf",
  "Birthday": "birthday",
  "Anniversary": "anniversary",
};

export default function Reservation() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);

  // Reservations data
  const [currentReservations, setCurrentReservations] = useState([]);
  const [pastReservations, setPastReservations] = useState([]);
  const [suggestions, setSuggestions] = useState([]);

  // Restaurant search
  const [restaurants, setRestaurants] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    date: "",
    selectedSlot: null, // Selected slot from availability engine
    partySize: 2,
    phone: "",
    phoneVerified: false,
    serverId: null,
    serverName: null,
    preferences: [],
    birthdayName: "",
    anniversaryYears: "",
    specialRequests: "",
  });

  // Availability engine state
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState(null);

  // Available servers
  const [availableServers, setAvailableServers] = useState([]);
  const [loadingServers, setLoadingServers] = useState(false);
  const [showLineupLink, setShowLineupLink] = useState(false);

  // Phone verification
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState(null);

  // Load restaurants
  useEffect(() => {
    async function loadRestaurants() {
      try {
        const snap = await getDocs(collection(db, "restaurants"));
        const restaurantsList = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || d.id,
          ...d.data(),
        }));
        setRestaurants(restaurantsList);
      } catch (error) {
        console.error("Error loading restaurants:", error);
      }
    }
    loadRestaurants();
  }, []);

  // Load reservations from ledger
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    async function loadReservations() {
      setLoading(true);
      try {
        const [current, past] = await Promise.all([
          getCurrentDinerReservationsFromLedger(currentUser.uid),
          getPastDinerReservationsFromLedger(currentUser.uid, 5),
        ]);
        setCurrentReservations(current);
        setPastReservations(past);

        // Generate suggestions based on past reservations
        if (past.length > 0) {
          const restaurantIds = [...new Set(past.map((r) => r.restaurantId))];
          const suggestedRestaurants = restaurants.filter((r) =>
            restaurantIds.includes(r.id)
          );
          setSuggestions(suggestedRestaurants.slice(0, 3));
        }
      } catch (error) {
        console.error("Error loading reservations:", error);
      } finally {
        setLoading(false);
      }
    }

    loadReservations();
  }, [currentUser, restaurants]);

  // Load availability when restaurant and date are selected
  useEffect(() => {
    if (!selectedRestaurant || !formData.date) {
      setAvailableSlots([]);
      return;
    }

    loadAvailability();
  }, [selectedRestaurant, formData.date, formData.partySize]);

  const loadAvailability = useCallback(async () => {
    if (!selectedRestaurant || !formData.date) return;

    setLoadingAvailability(true);
    setAvailabilityError(null);
    try {
      const slots = await computeAvailability({
        restaurantId: selectedRestaurant.id,
        date: formData.date,
        restaurantData: selectedRestaurant,
        options: {},
      });

      // Filter slots that can accommodate party size
      const suitableSlots = slots.filter(
        (slot) => slot.availableCovers >= formData.partySize
      );

      setAvailableSlots(suitableSlots);
    } catch (error) {
      console.error("Error loading availability:", error);
      setAvailabilityError("Failed to load availability. Please try again.");
    } finally {
      setLoadingAvailability(false);
    }
  }, [selectedRestaurant, formData.date, formData.partySize]);

  // Filter restaurants for autocomplete
  const filteredRestaurants = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return restaurants
      .filter((r) => r.name.toLowerCase().includes(query))
      .slice(0, 5);
  }, [restaurants, searchQuery]);

  // Load available servers when date and restaurant are selected
  useEffect(() => {
    if (!selectedRestaurant || !formData.date) {
      setAvailableServers([]);
      setShowLineupLink(false);
      return;
    }

    const selectedDate = new Date(formData.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);

    if (selectedDate > today) {
      setShowLineupLink(true);
      loadAvailableServers();
    } else {
      setShowLineupLink(false);
      setAvailableServers([]);
    }
  }, [selectedRestaurant, formData.date]);

  const loadAvailableServers = useCallback(async () => {
    if (!selectedRestaurant || !formData.date) return;

    setLoadingServers(true);
    try {
      const servers = await getAvailableServers(selectedRestaurant.id, formData.date);
      setAvailableServers(servers);
    } catch (error) {
      console.error("Error loading servers:", error);
      setAvailableServers([]);
    } finally {
      setLoadingServers(false);
    }
  }, [selectedRestaurant, formData.date]);

  const handleRestaurantSelect = (restaurant) => {
    setSelectedRestaurant(restaurant);
    setSearchQuery(restaurant.name);
    setShowSuggestions(false);
    setFormData((prev) => ({
      ...prev,
      serverId: null,
      serverName: null,
      selectedSlot: null,
    }));
  };

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setFormData((prev) => ({
      ...prev,
      date: newDate,
      selectedSlot: null,
      serverId: null,
      serverName: null,
    }));
  };

  const handleSlotSelect = (slot) => {
    setFormData((prev) => ({
      ...prev,
      selectedSlot: slot,
    }));
  };

  const handlePhoneChange = (e) => {
    const phone = e.target.value;
    setFormData((prev) => ({
      ...prev,
      phone,
      phoneVerified: false,
    }));
    setPhoneError(null);
  };

  const handlePhoneVerification = async () => {
    if (!formData.phone) {
      setPhoneError("Please enter a phone number");
      return;
    }

    if (!validatePhoneFormat(formData.phone)) {
      setPhoneError("Please enter a valid phone number");
      return;
    }

    setVerifyingPhone(true);
    setPhoneError(null);

    try {
      const result = await verifyPhoneNumber(formData.phone);
      if (result.verified) {
        setFormData((prev) => ({
          ...prev,
          phoneVerified: true,
        }));
      } else {
        setPhoneError(result.error || "Phone verification failed");
      }
    } catch (error) {
      console.error("Error verifying phone:", error);
      setPhoneError("Failed to verify phone number. Please try again.");
    } finally {
      setVerifyingPhone(false);
    }
  };

  const handleServerSelect = (server) => {
    setFormData((prev) => ({
      ...prev,
      serverId: server.id,
      serverName: server.name,
    }));
  };

  // Check if reservation can be modified/cancelled (2-hour cutoff)
  const canModifyReservation = (reservation) => {
    const reservationTime = reservation.startAtTimestamp?.toDate?.() || new Date(reservation.startAt);
    const now = new Date();
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    return reservationTime > twoHoursFromNow;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!currentUser || !selectedRestaurant || !formData.date || !formData.selectedSlot) {
      alert("Please select a restaurant, date, and time slot");
      return;
    }

    if (!formData.phone || !formData.phoneVerified) {
      alert("Please verify your phone number");
      return;
    }

    try {
      // Create reservation in ledger
      const reservationId = await createReservationInLedger({
        restaurantId: selectedRestaurant.id,
        startAt: formData.selectedSlot.startAtISO,
        partySize: formData.partySize,
        sourceSystem: RESERVATION_SOURCE.LINEUP,
        dinerId: currentUser.uid,
        dinerName: currentUser.displayName || "Guest",
        phone: normalizePhoneNumber(formData.phone),
        email: currentUser.email || null,
        metadata: {
          serverId: formData.serverId,
          serverName: formData.serverName,
          preferences: formData.preferences,
          birthdayName: formData.birthdayName || null,
          anniversaryYears: formData.anniversaryYears || null,
          specialRequests: formData.specialRequests || null,
        },
      });

      // Reset form
      setSelectedRestaurant(null);
      setSearchQuery("");
      setFormData({
        date: "",
        selectedSlot: null,
        partySize: 2,
        phone: "",
        phoneVerified: false,
        serverId: null,
        serverName: null,
        preferences: [],
        birthdayName: "",
        anniversaryYears: "",
        specialRequests: "",
      });
      setAvailableSlots([]);

      // Reload reservations
      const [current, past] = await Promise.all([
        getCurrentDinerReservationsFromLedger(currentUser.uid),
        getPastDinerReservationsFromLedger(currentUser.uid, 5),
      ]);
      setCurrentReservations(current);
      setPastReservations(past);

      alert("Reservation created successfully!");
    } catch (error) {
      console.error("Error creating reservation:", error);
      alert(`Failed to create reservation: ${error.message || "Please try again."}`);
    }
  };

  const handleCancelReservation = async (reservation) => {
    if (!canModifyReservation(reservation)) {
      alert("Reservations cannot be cancelled within 2 hours of the reservation time.");
      return;
    }

    if (!window.confirm("Cancel this reservation?")) {
      return;
    }

    try {
      await cancelReservationInLedger({
        restaurantId: reservation.restaurantId,
        reservationId: reservation.id,
        source: "DINER_CANCELLATION",
        reason: "Cancelled by diner",
      });

      // Reload reservations
      const [current, past] = await Promise.all([
        getCurrentDinerReservationsFromLedger(currentUser.uid),
        getPastDinerReservationsFromLedger(currentUser.uid, 5),
      ]);
      setCurrentReservations(current);
      setPastReservations(past);

      alert("Reservation cancelled successfully");
    } catch (error) {
      console.error("Error cancelling reservation:", error);
      alert("Failed to cancel reservation. Please try again.");
    }
  };

  const formatDate = (dateISO) => {
    const date = new Date(dateISO);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateISO) => {
    const date = new Date(dateISO);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getTierColor = (tier) => {
    switch (tier) {
      case SLOT_TIER.RECOMMENDED:
        return "#4ade80"; // Green
      case SLOT_TIER.AVAILABLE:
        return "#4da3ff"; // Blue
      case SLOT_TIER.FLEXIBLE:
        return "#fbbf24"; // Yellow
      default:
        return "#888";
    }
  };

  const getTierLabel = (tier) => {
    switch (tier) {
      case SLOT_TIER.RECOMMENDED:
        return "Recommended";
      case SLOT_TIER.AVAILABLE:
        return "Available";
      case SLOT_TIER.FLEXIBLE:
        return "Flexible";
      default:
        return tier;
    }
  };

  if (!currentUser) {
    return (
      <div className="reservation-page">
        <div className="reservation-container">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
            <div style={{ width: "100px" }}></div>
            <h1 style={{ flex: 1, textAlign: "center", margin: 0 }}>Reservations</h1>
            <Link to="/" className="back-link">← Back</Link>
          </div>
          <p>Please log in to view and make reservations.</p>
          <Link to="/login">Log In</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="reservation-page">
        <div className="reservation-container">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
            <div style={{ width: "100px" }}></div>
            <h1 style={{ flex: 1, textAlign: "center", margin: 0 }}>Reservations</h1>
            <Link to="/" className="back-link">← Back</Link>
          </div>
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="reservation-page">
      <div className="reservation-container">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
          <div style={{ width: "100px" }}></div>
          <h1 style={{ flex: 1, textAlign: "center", margin: 0 }}>Reservations</h1>
          <Link to="/" className="back-link">← Back</Link>
        </div>

        {/* CURRENT RESERVATIONS */}
        <section className="reservation-section">
          <h2>Current Reservations</h2>
          {currentReservations.length > 0 ? (
            <div className="reservation-list">
              {currentReservations.map((res) => {
                const canModify = canModifyReservation(res);
                return (
                  <div key={res.id} className="reservation-card">
                    <div className="reservation-header">
                      <h3>{res.restaurantName || "Restaurant"}</h3>
                      <span className="reservation-status">{res.status}</span>
                    </div>
                    <div className="reservation-details">
                      <p>
                        <strong>Date:</strong> {formatDate(res.startAt)}
                      </p>
                      <p>
                        <strong>Time:</strong> {formatTime(res.startAt)}
                      </p>
                      <p>
                        <strong>Party Size:</strong> {res.partySize}
                      </p>
                      {res.metadata?.serverName && (
                        <p>
                          <strong>Server:</strong> {res.metadata.serverName}
                        </p>
                      )}
                      {res.metadata?.specialRequests && (
                        <p>
                          <strong>Special Requests:</strong> {res.metadata.specialRequests}
                        </p>
                      )}
                    </div>
                    <button
                      className="cancel-btn"
                      onClick={() => handleCancelReservation(res)}
                      disabled={!canModify}
                      title={!canModify ? "Reservations cannot be cancelled within 2 hours of the reservation time" : ""}
                    >
                      {canModify ? "Cancel" : "Cannot Cancel (Within 2 Hours)"}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="empty-state">No upcoming reservations</p>
          )}
        </section>

        {/* PAST RESERVATIONS */}
        <section className="reservation-section">
          <h2>Past Reservations</h2>
          {pastReservations.length > 0 ? (
            <div className="reservation-list">
              {pastReservations.map((res) => (
                <div key={res.id} className="reservation-card past">
                  <div className="reservation-header">
                    <h3>{res.restaurantName || "Restaurant"}</h3>
                    <span className="reservation-status">{res.status}</span>
                  </div>
                  <div className="reservation-details">
                    <p>
                      <strong>Date:</strong> {formatDate(res.startAt)}
                    </p>
                    <p>
                      <strong>Time:</strong> {formatTime(res.startAt)}
                    </p>
                    <p>
                      <strong>Party Size:</strong> {res.partySize}
                    </p>
                    {res.metadata?.serverName && (
                      <p>
                        <strong>Server:</strong> {res.metadata.serverName}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No past reservations</p>
          )}
        </section>

        {/* SUGGESTIONS */}
        {suggestions.length > 0 && (
          <section className="reservation-section">
            <h2>Suggestions</h2>
            <div className="suggestions-grid">
              {suggestions.map((restaurant) => (
                <div
                  key={restaurant.id}
                  className="suggestion-card"
                  onClick={() => handleRestaurantSelect(restaurant)}
                >
                  {restaurant.imageURL && (
                    <img
                      src={restaurant.imageURL}
                      alt={restaurant.name}
                      className="suggestion-image"
                    />
                  )}
                  <h3>{restaurant.name}</h3>
                  {restaurant.cuisine && (
                    <p className="suggestion-cuisine">
                      {Array.isArray(restaurant.cuisine)
                        ? restaurant.cuisine.join(", ")
                        : restaurant.cuisine}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* NEW RESERVATION FORM */}
        <section className="reservation-section">
          <h2>Make a New Reservation</h2>
          <form onSubmit={handleSubmit} className="reservation-form">
            {/* Restaurant Search */}
            <div className="form-group">
              <label>Restaurant *</label>
              <div className="search-wrapper">
                <input
                  type="text"
                  placeholder="Search restaurants..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                    if (!e.target.value) {
                      setSelectedRestaurant(null);
                    }
                  }}
                  onFocus={() => setShowSuggestions(true)}
                />
                {showSuggestions && filteredRestaurants.length > 0 && (
                  <div className="autocomplete-dropdown">
                    {filteredRestaurants.map((restaurant) => (
                      <div
                        key={restaurant.id}
                        className="autocomplete-item"
                        onClick={() => handleRestaurantSelect(restaurant)}
                      >
                        {restaurant.imageURL && (
                          <img
                            src={restaurant.imageURL}
                            alt={restaurant.name}
                            className="autocomplete-image"
                          />
                        )}
                        <div>
                          <div className="autocomplete-name">{restaurant.name}</div>
                          {restaurant.cuisine && (
                            <div className="autocomplete-cuisine">
                              {Array.isArray(restaurant.cuisine)
                                ? restaurant.cuisine.join(", ")
                                : restaurant.cuisine}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Date and Party Size */}
            <div className="form-row">
              <div className="form-group">
                <label>Date *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={handleDateChange}
                  min={new Date().toISOString().split("T")[0]}
                  required
                />
              </div>

              <div className="form-group">
                <label>Party Size *</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={formData.partySize}
                  onChange={(e) => {
                    const newPartySize = parseInt(e.target.value) || 1;
                    setFormData((prev) => ({
                      ...prev,
                      partySize: newPartySize,
                      selectedSlot: null, // Reset slot when party size changes
                    }));
                  }}
                  required
                />
              </div>
            </div>

            {/* Availability Slots */}
            {selectedRestaurant && formData.date && (
              <div className="form-group">
                <label>Select Time Slot *</label>
                {loadingAvailability ? (
                  <div>Loading available time slots...</div>
                ) : availabilityError ? (
                  <div className="error-text">{availabilityError}</div>
                ) : availableSlots.length === 0 ? (
                  <div className="info-text">No available time slots for this date and party size.</div>
                ) : (
                  <div className="slots-grid">
                    {availableSlots.map((slot, index) => {
                      const isSelected = formData.selectedSlot?.startAtISO === slot.startAtISO;
                      return (
                        <div
                          key={index}
                          className={`slot-card ${isSelected ? "selected" : ""}`}
                          onClick={() => handleSlotSelect(slot)}
                          style={{
                            borderColor: getTierColor(slot.tier),
                            backgroundColor: isSelected ? getTierColor(slot.tier) + "20" : "transparent",
                          }}
                        >
                          <div className="slot-time">{formatTime(slot.startAtISO)}</div>
                          <div className="slot-tier" style={{ color: getTierColor(slot.tier) }}>
                            {getTierLabel(slot.tier)}
                          </div>
                          <div className="slot-info">
                            <span>{slot.availableCovers} covers available</span>
                            {slot.confidence === CONFIDENCE.LOW && (
                              <span className="low-confidence">Low confidence</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {formData.selectedSlot && (
                  <p className="selected-slot">
                    Selected: <strong>{formatTime(formData.selectedSlot.startAtISO)}</strong> ({getTierLabel(formData.selectedSlot.tier)})
                  </p>
                )}
              </div>
            )}

            {/* Phone Verification */}
            <div className="form-group">
              <label>Phone Number *</label>
              <div className="phone-verification-wrapper">
                <input
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  disabled={formData.phoneVerified}
                  required
                />
                {!formData.phoneVerified && (
                  <button
                    type="button"
                    className="verify-phone-btn"
                    onClick={handlePhoneVerification}
                    disabled={verifyingPhone || !formData.phone}
                  >
                    {verifyingPhone ? "Verifying..." : "Verify"}
                  </button>
                )}
                {formData.phoneVerified && (
                  <span className="phone-verified">✓ Verified</span>
                )}
              </div>
              {phoneError && <div className="error-text">{phoneError}</div>}
              {formData.phone && !validatePhoneFormat(formData.phone) && !phoneError && (
                <div className="error-text">Please enter a valid phone number</div>
              )}
            </div>

            {/* Live Lineup Link */}
            {showLineupLink && selectedRestaurant && formData.date && (
              <div className="form-group">
                <Link
                  to={`/live-lineup/${selectedRestaurant.id}?date=${formData.date}`}
                  className="lineup-link"
                  target="_blank"
                >
                  👨‍🍳 View who's working this date
                </Link>
              </div>
            )}

            {/* Server Selection (if available) */}
            {loadingServers ? (
              <div className="form-group">
                <label>Server</label>
                <div>Loading available servers...</div>
              </div>
            ) : availableServers.length > 0 ? (
              <div className="form-group">
                <label>Select Server (Optional)</label>
                <div className="server-grid">
                  {availableServers.map((server) => (
                    <div
                      key={server.id}
                      className={`server-card ${
                        formData.serverId === server.id ? "selected" : ""
                      }`}
                      onClick={() => handleServerSelect(server)}
                    >
                      {server.imageURL && (
                        <img
                          src={server.imageURL}
                          alt={server.name}
                          className="server-image"
                        />
                      )}
                      <div className="server-name">{server.name}</div>
                      {server.rating && (
                        <div className="server-rating">⭐ {server.rating.toFixed(1)}</div>
                      )}
                    </div>
                  ))}
                </div>
                {formData.serverName && (
                  <p className="selected-server">
                    Selected: <strong>{formData.serverName}</strong>
                  </p>
                )}
              </div>
            ) : formData.date && selectedRestaurant ? (
              <div className="form-group">
                <label>Server</label>
                <p className="info-text">
                  No schedule available for this date yet. Server selection will be made at the
                  restaurant. Guest will be notified once schedule becomes available.
                </p>
              </div>
            ) : null}

            {/* Preferences */}
            <div className="form-group">
              <label>Preferences</label>
              <div className="preferences-grid">
                {RESERVATION_PREFERENCE_OPTIONS.map((pref) => {
                  const prefKey = PREFERENCE_KEY_MAP[pref];
                  const alwaysAvailablePrefs = [
                    "Birthday",
                    "Anniversary",
                    "Deaf",
                    "Blind",
                    "Vegetarian",
                    "Vegan",
                    "Pescatarian",
                    "Wheelchair Accessible",
                    "Gluten Free",
                  ];
                  const isAlwaysAvailable = alwaysAvailablePrefs.includes(pref);
                  
                  let isAvailable = false;
                  if (isAlwaysAvailable) {
                    isAvailable = true;
                  } else if (!selectedRestaurant) {
                    isAvailable = false;
                  } else {
                    const restaurantPrefs = selectedRestaurant.preferences || {};
                    isAvailable = !!restaurantPrefs[prefKey];
                  }
                  
                  const isDisabled = !isAvailable;

                  return (
                    <label
                      key={pref}
                      className={`preference-checkbox ${isDisabled ? "disabled" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.preferences.includes(pref)}
                        disabled={isDisabled}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData((prev) => ({
                              ...prev,
                              preferences: [...prev.preferences, pref],
                            }));
                          } else {
                            setFormData((prev) => ({
                              ...prev,
                              preferences: prev.preferences.filter((p) => p !== pref),
                              birthdayName: pref === "Birthday" ? "" : prev.birthdayName,
                              anniversaryYears:
                                pref === "Anniversary" ? "" : prev.anniversaryYears,
                            }));
                          }
                        }}
                      />
                      <span>{pref}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Birthday Name Input */}
            {formData.preferences.includes("Birthday") && (
              <div className="form-group">
                <label>Birthday - Person's Name</label>
                <input
                  type="text"
                  value={formData.birthdayName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, birthdayName: e.target.value }))
                  }
                  placeholder="Enter the name of the person celebrating"
                />
              </div>
            )}

            {/* Anniversary Years Input */}
            {formData.preferences.includes("Anniversary") && (
              <div className="form-group">
                <label>Anniversary - Years</label>
                <input
                  type="text"
                  value={formData.anniversaryYears}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, anniversaryYears: e.target.value }))
                  }
                  placeholder="Years"
                />
              </div>
            )}

            {/* Special Requests */}
            <div className="form-group">
              <label>Additional Special Requests</label>
              <textarea
                value={formData.specialRequests}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, specialRequests: e.target.value }))
                }
                placeholder="Any additional notes or special requests..."
                rows="3"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="submit-btn"
              disabled={!selectedRestaurant || !formData.selectedSlot || !formData.phoneVerified}
            >
              Make Reservation
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}









