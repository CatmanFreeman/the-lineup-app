// src/components/ValetPreBooking/DrivingDetectedModal.jsx
//
// DRIVING DETECTED MODAL
//
// Shown when app detects user is driving
// Asks if they're going to a restaurant and want to pre-book valet

import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { getCurrentLocation } from "../../utils/arrivalDetectionService";
import { getNearbyRestaurantsWithValet } from "../../utils/valetPreBookingService";
import "./DrivingDetectedModal.css";

export default function DrivingDetectedModal({ onClose, onRestaurantSelected }) {
  const [userLocation, setUserLocation] = useState(null);
  const [nearbyRestaurants, setNearbyRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);

  useEffect(() => {
    loadNearbyRestaurants();
  }, []);

  async function loadNearbyRestaurants() {
    try {
      const location = await getCurrentLocation();
      if (!location) {
        setLoading(false);
        return;
      }

      setUserLocation(location);
      const restaurants = await getNearbyRestaurantsWithValet(location.lat, location.lng, 5);
      setNearbyRestaurants(restaurants);
    } catch (error) {
      console.error("Error loading nearby restaurants:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleRestaurantSelect = (restaurant) => {
    setSelectedRestaurant(restaurant);
    if (onRestaurantSelected) {
      onRestaurantSelected(restaurant);
    }
    // Use window.location instead of navigate since we're outside Router context
    window.location.href = `/valet/prebook?restaurantId=${restaurant.id}`;
    if (onClose) onClose();
  };

  return (
    <div className="driving-detected-overlay" onClick={onClose}>
      <div className="driving-detected-modal" onClick={(e) => e.stopPropagation()}>
        <div className="driving-detected-header">
          <h2>🚗 You're Driving</h2>
          <button className="driving-detected-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="driving-detected-body">
          <p className="driving-detected-question">
            Are you heading to a restaurant?
          </p>

          {loading ? (
            <div className="driving-detected-loading">Loading nearby restaurants...</div>
          ) : nearbyRestaurants.length === 0 ? (
            <div className="driving-detected-empty">
              <p>No restaurants with valet service found nearby.</p>
              <button className="driving-detected-btn" onClick={onClose}>
                Maybe Later
              </button>
            </div>
          ) : (
            <>
              <p className="driving-detected-subtitle">
                Select a restaurant to pre-book valet service:
              </p>
              <div className="driving-detected-restaurants">
                {nearbyRestaurants.slice(0, 5).map((restaurant) => (
                  <button
                    key={restaurant.id}
                    className="driving-detected-restaurant-card"
                    onClick={() => handleRestaurantSelect(restaurant)}
                  >
                    <div className="driving-detected-restaurant-info">
                      <h3>{restaurant.name}</h3>
                      <p className="driving-detected-restaurant-distance">
                        {restaurant.distanceMiles.toFixed(1)} miles away
                      </p>
                      {restaurant.valetCompanies.length > 0 && (
                        <p className="driving-detected-restaurant-valet">
                          ✓ Valet Available
                        </p>
                      )}
                    </div>
                    <div className="driving-detected-restaurant-arrow">→</div>
                  </button>
                ))}
              </div>
              <button className="driving-detected-btn-secondary" onClick={onClose}>
                Not going to a restaurant
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

