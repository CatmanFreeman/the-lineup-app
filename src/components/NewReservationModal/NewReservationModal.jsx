import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../hooks/services/firebase";
import "./NewReservationModal.css";

const RESERVATION_TYPES = {
  RESTAURANT: "restaurant",
  VALET: "valet",
  VENUE: "venue",
  BOWLING: "bowling",
};

export default function NewReservationModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState(null);
  const [businessSearchQuery, setBusinessSearchQuery] = useState("");
  const [businesses, setBusinesses] = useState([]);
  const [filteredBusinesses, setFilteredBusinesses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showBusinessSearch, setShowBusinessSearch] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [showDiningPrompt, setShowDiningPrompt] = useState(false);

  // Reset all state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedType(null);
      setBusinessSearchQuery("");
      setBusinesses([]);
      setFilteredBusinesses([]);
      setShowBusinessSearch(false);
      setSelectedBusiness(null);
      setShowDiningPrompt(false);
      setLoading(false);
    }
  }, [isOpen]);

  // Load businesses based on selected type
  useEffect(() => {
    if (!selectedType) {
      setShowBusinessSearch(false);
      setBusinesses([]);
      setFilteredBusinesses([]);
      return;
    }

    setShowBusinessSearch(true);
    loadBusinesses();
  }, [selectedType]);

  // Filter businesses as user types
  useEffect(() => {
    if (!businessSearchQuery.trim()) {
      setFilteredBusinesses(businesses);
      return;
    }

    const query = businessSearchQuery.toLowerCase();
    const filtered = businesses.filter((business) =>
      business.name.toLowerCase().includes(query)
    );
    setFilteredBusinesses(filtered);
  }, [businessSearchQuery, businesses]);

  const loadBusinesses = async () => {
    setLoading(true);
    try {
      const restaurantsRef = collection(db, "restaurants");
      const restaurantsSnap = await getDocs(restaurantsRef);
      const allBusinesses = [];

      restaurantsSnap.docs.forEach((doc) => {
        const data = doc.data();
        const businessId = doc.id;

        // Filter based on reservation type
        if (selectedType === RESERVATION_TYPES.RESTAURANT) {
          // All restaurants
          allBusinesses.push({
            id: businessId,
            name: data.name || businessId,
            address: data.address || "",
            city: data.city || "",
            state: data.state || "",
            attractions: data.attractions || {},
          });
        } else if (selectedType === RESERVATION_TYPES.VALET) {
          // Restaurants with valet service (check if they have valet companies)
          // For now, include all restaurants (valet availability will be checked later)
          allBusinesses.push({
            id: businessId,
            name: data.name || businessId,
            address: data.address || "",
            city: data.city || "",
            state: data.state || "",
            hasValet: true, // Will be checked when selected
          });
        } else if (selectedType === RESERVATION_TYPES.VENUE) {
          // Restaurants with gaming venue enabled
          if (data.attractions?.gamingVenue) {
            allBusinesses.push({
              id: businessId,
              name: data.name || businessId,
              address: data.address || "",
              city: data.city || "",
              state: data.state || "",
              attractions: data.attractions || {},
            });
          }
        } else if (selectedType === RESERVATION_TYPES.BOWLING) {
          // Restaurants with bowling enabled
          if (data.attractions?.bowling) {
            allBusinesses.push({
              id: businessId,
              name: data.name || businessId,
              address: data.address || "",
              city: data.city || "",
              state: data.state || "",
              attractions: data.attractions || {},
            });
          }
        }
      });

      setBusinesses(allBusinesses);
      setFilteredBusinesses(allBusinesses);
    } catch (error) {
      console.error("Error loading businesses:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTypeSelect = (type) => {
    setSelectedType(type);
    setBusinessSearchQuery("");
  };

  const handleBusinessSelect = (business) => {
    // For bowling, show dining prompt first
    if (selectedType === RESERVATION_TYPES.BOWLING) {
      setSelectedBusiness(business);
      setShowDiningPrompt(true);
      return;
    }

    // Navigate to appropriate reservation page with business pre-populated
    if (selectedType === RESERVATION_TYPES.RESTAURANT) {
      navigate(`/reservation?restaurantId=${business.id}`);
    } else if (selectedType === RESERVATION_TYPES.VALET) {
      navigate(`/valet/prebook?restaurantId=${business.id}`);
    } else if (selectedType === RESERVATION_TYPES.VENUE) {
      navigate(`/venue/reservation?restaurantId=${business.id}`);
    }
    onClose();
  };

  const handleDiningChoice = (wantsToDine) => {
    if (!selectedBusiness) return;

    if (wantsToDine) {
      // Navigate to combined bowling + dinner reservation
      navigate(`/bowling/reservation/new?restaurantId=${selectedBusiness.id}&includeDinner=true`);
    } else {
      // Navigate to bowling-only reservation
      navigate(`/bowling/reservation/new?restaurantId=${selectedBusiness.id}`);
    }
    onClose();
  };

  const handleBack = () => {
    if (showDiningPrompt) {
      setShowDiningPrompt(false);
      setSelectedBusiness(null);
      return;
    }
    setSelectedType(null);
    setBusinessSearchQuery("");
    setShowBusinessSearch(false);
    setSelectedBusiness(null);
  };

  if (!isOpen) return null;

  return (
    <div className="new-reservation-modal-overlay" onClick={onClose}>
      <div className="new-reservation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="new-reservation-modal-header">
          <h2>New Reservation</h2>
          <button className="new-reservation-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="new-reservation-modal-content">
          {showDiningPrompt ? (
            // Step 3: Dining prompt for bowling
            <div className="dining-prompt-section">
              <button className="business-search-back" onClick={handleBack}>
                ← Back
              </button>
              <p className="dining-prompt-question">
                Are you wanting to dine?
              </p>
              <p className="dining-prompt-description">
                You can make a combined reservation for bowling and dinner, or just reserve a bowling lane.
              </p>
              <div className="dining-prompt-options">
                <button
                  className="dining-prompt-btn dining-prompt-btn-yes"
                  onClick={() => handleDiningChoice(true)}
                >
                  Yes, I want to dine
                </button>
                <button
                  className="dining-prompt-btn dining-prompt-btn-no"
                  onClick={() => handleDiningChoice(false)}
                >
                  No, just bowling
                </button>
              </div>
            </div>
          ) : !selectedType ? (
            // Step 1: Select reservation type
            <div className="reservation-type-selection">
              <p className="reservation-type-instruction">
                What type of reservation would you like to make?
              </p>
              <div className="reservation-type-list">
                <label className="reservation-type-option">
                  <input
                    type="radio"
                    name="reservationType"
                    value={RESERVATION_TYPES.RESTAURANT}
                    onChange={() => handleTypeSelect(RESERVATION_TYPES.RESTAURANT)}
                  />
                  <span className="reservation-type-label">
                    <strong>Restaurant</strong>
                    <span className="reservation-type-desc">Table reservation</span>
                  </span>
                </label>

                <label className="reservation-type-option">
                  <input
                    type="radio"
                    name="reservationType"
                    value={RESERVATION_TYPES.VALET}
                    onChange={() => handleTypeSelect(RESERVATION_TYPES.VALET)}
                  />
                  <span className="reservation-type-label">
                    <strong>Valet</strong>
                    <span className="reservation-type-desc">Pre-book valet service</span>
                  </span>
                </label>

                <label className="reservation-type-option">
                  <input
                    type="radio"
                    name="reservationType"
                    value={RESERVATION_TYPES.VENUE}
                    onChange={() => handleTypeSelect(RESERVATION_TYPES.VENUE)}
                  />
                  <span className="reservation-type-label">
                    <strong>Venue</strong>
                    <span className="reservation-type-desc">Gaming Venue, Entertainment Venue, VIP</span>
                  </span>
                </label>

                <label className="reservation-type-option">
                  <input
                    type="radio"
                    name="reservationType"
                    value={RESERVATION_TYPES.BOWLING}
                    onChange={() => handleTypeSelect(RESERVATION_TYPES.BOWLING)}
                  />
                  <span className="reservation-type-label">
                    <strong>Bowling</strong>
                    <span className="reservation-type-desc">Bowling Lane and/or Dinner Reservations</span>
                  </span>
                </label>
              </div>
            </div>
          ) : (
            // Step 2: Search and select business
            <div className="business-search-section">
              <button className="business-search-back" onClick={handleBack}>
                ← Back
              </button>
              <p className="business-search-instruction">
                Search for a {selectedType === RESERVATION_TYPES.RESTAURANT ? "restaurant" : selectedType === RESERVATION_TYPES.VALET ? "location" : selectedType === RESERVATION_TYPES.VENUE ? "venue" : "bowling alley"}
              </p>
              <div className="business-search-wrapper">
                <input
                  type="text"
                  className="business-search-input"
                  placeholder={`Search by name...`}
                  value={businessSearchQuery}
                  onChange={(e) => setBusinessSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>

              {loading ? (
                <div className="business-search-loading">Loading businesses...</div>
              ) : filteredBusinesses.length > 0 ? (
                <div className="business-search-results">
                  {filteredBusinesses.map((business) => (
                    <div
                      key={business.id}
                      className="business-search-result-item"
                      onClick={() => handleBusinessSelect(business)}
                    >
                      <div className="business-result-name">{business.name}</div>
                      {(business.address || business.city || business.state) && (
                        <div className="business-result-location">
                          {[business.address, business.city, business.state]
                            .filter(Boolean)
                            .join(", ")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : businessSearchQuery.trim() ? (
                <div className="business-search-empty">
                  No businesses found matching "{businessSearchQuery}"
                </div>
              ) : (
                <div className="business-search-empty">
                  {selectedType === RESERVATION_TYPES.VENUE && "No gaming venues available"}
                  {selectedType === RESERVATION_TYPES.BOWLING && "No bowling alleys available"}
                  {selectedType === RESERVATION_TYPES.RESTAURANT && "No restaurants available"}
                  {selectedType === RESERVATION_TYPES.VALET && "No locations with valet available"}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

