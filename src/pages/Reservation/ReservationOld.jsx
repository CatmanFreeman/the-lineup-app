// src/pages/Reservation/Reservation.jsx

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../../hooks/services/firebase";
import {
  createReservation,
  getCurrentReservations,
  getPastReservations,
  getAvailableServers,
  cancelReservation,
} from "../../utils/reservationService";
import "./Reservation.css";

// Reservation Preferences options (subset of restaurant preferences)
const RESERVATION_PREFERENCE_OPTIONS = [
  // Restaurant Amenities
  "Waterfront",
  "Ocean View",
  "Water View",
  "Riverfront",
  "Patio Seating",
  "Rooftop",
  "Outdoor Seating",
  // Dietary Restrictions
  "Gluten Free",
  "Vegetarian",
  "Vegan",
  "Pescatarian",
  // Accessibility
  "Wheelchair Accessible",
  "Blind",
  "Deaf",
  // Special Occasions
  "Birthday",
  "Anniversary",
];

// Map reservation preferences to restaurant preference keys
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
  "Pescatarian": "pescatarian", // May not be in restaurant prefs, but allow it
  "Wheelchair Accessible": "wheelchairAccessible",
  "Blind": "blind",
  "Deaf": "deaf",
  "Birthday": "birthday", // Always available
  "Anniversary": "anniversary", // Always available
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
    time: "",
    partySize: 2,
    serverId: null,
    serverName: null,
    preferences: [],
    birthdayName: "",
    anniversaryYears: "",
    specialRequests: "",
  });

  // Available servers
  const [availableServers, setAvailableServers] = useState([]);
  const [loadingServers, setLoadingServers] = useState(false);
  const [showLineupLink, setShowLineupLink] = useState(false);

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

  // Load reservations
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    async function loadReservations() {
      setLoading(true);
      try {
        const [current, past] = await Promise.all([
          getCurrentReservations(currentUser.uid),
          getPastReservations(currentUser.uid, 5),
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

    // Check if date is in the future
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
    setFormData((prev) => ({ ...prev, serverId: null, serverName: null }));
  };

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setFormData((prev) => ({
      ...prev,
      date: newDate,
      serverId: null,
      serverName: null,
    }));
  };

  const handleServerSelect = (server) => {
    setFormData((prev) => ({
      ...prev,
      serverId: server.id,
      serverName: server.name,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser || !selectedRestaurant || !formData.date || !formData.time) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      await createReservation({
        dinerId: currentUser.uid,
        dinerName: currentUser.displayName || "Guest",
        restaurantId: selectedRestaurant.id,
        restaurantName: selectedRestaurant.name,
        dateISO: formData.date,
        time: formData.time,
        partySize: formData.partySize,
        serverId: formData.serverId,
        serverName: formData.serverName,
        preferences: formData.preferences,
        birthdayName: formData.birthdayName || null,
        anniversaryYears: formData.anniversaryYears || null,
        specialRequests: formData.specialRequests || null,
        email: currentUser.email || null,
      });

      // Reset form
      setSelectedRestaurant(null);
      setSearchQuery("");
      setFormData({
        date: "",
        time: "",
        partySize: 2,
        serverId: null,
        serverName: null,
        preferences: [],
        birthdayName: "",
        anniversaryYears: "",
        specialRequests: "",
      });

      // Reload reservations
      const [current, past] = await Promise.all([
        getCurrentReservations(currentUser.uid),
        getPastReservations(currentUser.uid, 5),
      ]);
      setCurrentReservations(current);
      setPastReservations(past);

      alert("Reservation created successfully!");
    } catch (error) {
      console.error("Error creating reservation:", error);
      alert("Failed to create reservation. Please try again.");
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

  if (!currentUser) {
    return (
      <div className="reservation-page">
        <div className="reservation-container">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
            <div style={{ width: "100px" }}></div>
            <h1 style={{ flex: 1, textAlign: "center", margin: 0 }}>Reservations</h1>
            <Link to="/" style={{ color: "#4da3ff", textDecoration: "none", fontSize: "16px", fontWeight: 600, padding: "8px 16px", border: "1px solid #4da3ff", borderRadius: "4px", transition: "all 0.2s" }} onMouseEnter={(e) => { e.target.style.color = "#6bb3ff"; e.target.style.borderColor = "#6bb3ff"; }} onMouseLeave={(e) => { e.target.style.color = "#4da3ff"; e.target.style.borderColor = "#4da3ff"; }}>
              ← Back
            </Link>
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
            <Link to="/" style={{ color: "#4da3ff", textDecoration: "none", fontSize: "16px", fontWeight: 600, padding: "8px 16px", border: "1px solid #4da3ff", borderRadius: "4px", transition: "all 0.2s" }} onMouseEnter={(e) => { e.target.style.color = "#6bb3ff"; e.target.style.borderColor = "#6bb3ff"; }} onMouseLeave={(e) => { e.target.style.color = "#4da3ff"; e.target.style.borderColor = "#4da3ff"; }}>
              ← Back
            </Link>
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
          <Link to="/" style={{ color: "#4da3ff", textDecoration: "none", fontSize: "16px", fontWeight: 600, padding: "8px 16px", border: "1px solid #4da3ff", borderRadius: "4px", transition: "all 0.2s" }} onMouseEnter={(e) => { e.target.style.color = "#6bb3ff"; e.target.style.borderColor = "#6bb3ff"; }} onMouseLeave={(e) => { e.target.style.color = "#4da3ff"; e.target.style.borderColor = "#4da3ff"; }}>
            ← Back
          </Link>
        </div>

        {/* CURRENT RESERVATIONS */}
        <section className="reservation-section">
          <h2>Current Reservations</h2>
          {currentReservations.length > 0 ? (
            <div className="reservation-list">
              {currentReservations.map((res) => (
                <div key={res.id} className="reservation-card">
                  <div className="reservation-header">
                    <h3>{res.restaurantName || "Restaurant"}</h3>
                    <span className="reservation-status">{res.status}</span>
                  </div>
                  <div className="reservation-details">
                    <p>
                      <strong>Date:</strong> {formatDate(res.dateISO)}
                    </p>
                    <p>
                      <strong>Time:</strong> {res.time}
                    </p>
                    <p>
                      <strong>Party Size:</strong> {res.partySize}
                    </p>
                    {res.serverName && (
                      <p>
                        <strong>Server:</strong> {res.serverName}
                      </p>
                    )}
                    {res.specialRequests && (
                      <p>
                        <strong>Special Requests:</strong> {res.specialRequests}
                      </p>
                    )}
                  </div>
                  <button
                    className="cancel-btn"
                    onClick={async () => {
                      if (window.confirm("Cancel this reservation?")) {
                        try {
                          await cancelReservation(res.id);
                          // Reload reservations
                          const [current, past] = await Promise.all([
                            getCurrentReservations(currentUser.uid),
                            getPastReservations(currentUser.uid, 5),
                          ]);
                          setCurrentReservations(current);
                          setPastReservations(past);
                          alert("Reservation cancelled successfully");
                        } catch (error) {
                          console.error("Error cancelling reservation:", error);
                          alert("Failed to cancel reservation. Please try again.");
                        }
                      }
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ))}
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
                      <strong>Date:</strong> {formatDate(res.dateISO)}
                    </p>
                    <p>
                      <strong>Time:</strong> {res.time}
                    </p>
                    <p>
                      <strong>Party Size:</strong> {res.partySize}
                    </p>
                    {res.serverName && (
                      <p>
                        <strong>Server:</strong> {res.serverName}
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

            {/* Date, Time, Party Size - Responsive Row */}
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
                <label>Time *</label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, time: e.target.value }))
                  }
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
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      partySize: parseInt(e.target.value) || 1,
                    }))
                  }
                  required
                />
              </div>
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
                  // Check if this preference is available at the selected restaurant
                  const prefKey = PREFERENCE_KEY_MAP[pref];
                  
                  // Preferences that are always available (diner preferences, not restaurant-specific)
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
                  
                  // Check if restaurant has this preference available
                  let isAvailable = false;
                  if (isAlwaysAvailable) {
                    // These preferences are always available
                    isAvailable = true;
                  } else if (!selectedRestaurant) {
                    // Restaurant-specific preferences need a restaurant to be selected
                    isAvailable = false;
                  } else {
                    // Check if restaurant has this preference
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
                              // Clear birthday/anniversary fields if unchecked
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
            <button type="submit" className="submit-btn" disabled={!selectedRestaurant}>
              Make Reservation
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
