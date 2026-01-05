// src/components/ArrivalDetection/RestaurantSelectionModal.jsx
//
// RESTAURANT SELECTION MODAL
//
// Shows multiple nearby restaurants as cards
// User can select one to check in or join waiting list

import React from "react";
import { useNavigate } from "react-router-dom";
import "./RestaurantSelectionModal.css";

export default function RestaurantSelectionModal({ restaurants, onClose }) {
  const navigate = useNavigate();

  if (!restaurants || restaurants.length === 0) {
    return null;
  }

  const handleSelectRestaurant = (restaurantId) => {
    navigate(`/arrival/waitinglist?restaurantId=${restaurantId}`);
    if (onClose) onClose();
  };

  const handleViewLineup = (restaurantId, e) => {
    e.stopPropagation();
    navigate(`/restaurant/${restaurantId}/lineup`);
  };

  return (
    <div className="arrival-modal-overlay" onClick={onClose}>
      <div className="arrival-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="arrival-modal-header">
          <h2>Restaurants Nearby</h2>
          <button className="arrival-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="arrival-modal-body">
          <p className="arrival-modal-subtitle">
            You're near {restaurants.length} restaurant{restaurants.length > 1 ? "s" : ""}. 
            Select one to join the waiting list.
          </p>

          <div className="restaurant-selection-grid">
            {restaurants.map((restaurant) => (
              <div
                key={restaurant.id}
                className="restaurant-selection-card"
                onClick={() => handleSelectRestaurant(restaurant.id)}
              >
                {/* Restaurant Logo */}
                <div className="restaurant-selection-logo">
                  {restaurant.imageURL ? (
                    <img
                      src={restaurant.imageURL}
                      alt={restaurant.name}
                      onError={(e) => {
                        e.target.style.display = "none";
                        e.target.nextSibling.style.display = "flex";
                      }}
                    />
                  ) : null}
                  <div className="restaurant-selection-logo-placeholder" style={{ display: restaurant.imageURL ? "none" : "flex" }}>
                    {restaurant.name.charAt(0).toUpperCase()}
                  </div>
                </div>

                {/* Restaurant Name */}
                <div className="restaurant-selection-name">{restaurant.name}</div>

                {/* Live Rating */}
                {restaurant.liveRating !== null && (
                  <div className="restaurant-selection-rating">
                    ⭐ {restaurant.liveRating.toFixed(1)}
                  </div>
                )}

                {/* View Lineup Link */}
                <button
                  className="restaurant-selection-lineup-link"
                  onClick={(e) => handleViewLineup(restaurant.id, e)}
                >
                  View Live Lineup →
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}








