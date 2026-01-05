// src/pages/ValetPreBooking/ValetPreBookingPage.jsx
//
// VALET PRE-BOOKING PAGE
//
// Allows diner to pre-book valet service
// Collects car information and estimated arrival time

import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../hooks/services/firebase";
import { createValetPreBooking } from "../../utils/valetPreBookingService";
import "./ValetPreBookingPage.css";

export default function ValetPreBookingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [restaurant, setRestaurant] = useState(null);
  const [userVehicles, setUserVehicles] = useState([]);
  const [selectedVehicleIndex, setSelectedVehicleIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const restaurantId = searchParams.get("restaurantId");

  // Estimated Arrival
  const [estimatedArrival, setEstimatedArrival] = useState("");

  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
      return;
    }

    if (!restaurantId) {
      navigate("/");
      return;
    }

    loadRestaurant();
    setDefaultArrivalTime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, restaurantId, navigate]);

  async function loadRestaurant() {
    try {
      const restaurantRef = doc(db, "restaurants", restaurantId);
      const restaurantSnap = await getDoc(restaurantRef);

      if (!restaurantSnap.exists()) {
        alert("Restaurant not found");
        navigate("/");
        return;
      }

      setRestaurant({ id: restaurantSnap.id, ...restaurantSnap.data() });

      // Load user vehicles
      const userRef = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const vehicles = userData.vehicles || [];
        setUserVehicles(vehicles);
        
        if (vehicles.length === 0) {
          setError("No vehicles found. Please add vehicle information in your profile settings.");
        }
      }
    } catch (error) {
      console.error("Error loading restaurant:", error);
      alert("Failed to load restaurant data");
      navigate("/");
    } finally {
      setLoading(false);
    }
  }

  function setDefaultArrivalTime() {
    // Default to 15 minutes from now
    const now = new Date();
    const in15Minutes = new Date(now.getTime() + 15 * 60 * 1000);
    setEstimatedArrival(in15Minutes.toISOString().slice(0, 16)); // Format for datetime-local input
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (userVehicles.length === 0) {
      setError("No vehicles found. Please add vehicle information in your profile settings.");
      return;
    }

    if (selectedVehicleIndex < 0 || selectedVehicleIndex >= userVehicles.length) {
      setError("Please select a vehicle");
      return;
    }

    if (!estimatedArrival) {
      setError("Estimated arrival time is required");
      return;
    }

    const selectedVehicle = userVehicles[selectedVehicleIndex];

    if (!selectedVehicle.licensePlate?.trim()) {
      setError("Selected vehicle must have a license plate");
      return;
    }

    try {
      setSubmitting(true);

      await createValetPreBooking({
        dinerId: currentUser.uid,
        restaurantId,
        dinerName: currentUser.displayName || currentUser.name || "Guest",
        dinerPhone: currentUser.phoneNumber || "",
        carInfo: {
          licensePlate: selectedVehicle.licensePlate.trim().toUpperCase(),
          make: selectedVehicle.make?.trim() || "",
          model: selectedVehicle.model?.trim() || "",
          color: selectedVehicle.color?.trim() || "",
        },
        estimatedArrival: new Date(estimatedArrival).toISOString(),
      });

      // Success - redirect to payment page
      const locationId = searchParams.get("locationId");
      navigate(
        `/valet/pay?restaurantId=${restaurantId}${locationId ? `&locationId=${locationId}` : ""}&amount=6.00`
      );
    } catch (error) {
      console.error("Error creating pre-booking:", error);
      setError(error.message || "Failed to pre-book valet service. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="valet-prebooking-page">
        <div className="valet-prebooking-loading">Loading...</div>
      </div>
    );
  }

  if (!restaurant) {
    return null;
  }

  return (
    <div className="valet-prebooking-page">
      <div className="valet-prebooking-card">
        <h1>Pre-Book Valet Service</h1>
        <p className="valet-prebooking-subtitle">
          {restaurant.name} - {restaurant.address || ""}
        </p>

        <p className="valet-prebooking-description">
          Pre-book your valet service to ensure a smooth arrival. The valet company will be notified
          ahead of time with your car information for VIP service.
        </p>

        {error && <div className="valet-prebooking-error">{error}</div>}

        <form onSubmit={handleSubmit} className="valet-prebooking-form">
          <div className="valet-prebooking-section">
            <h2>Select Your Vehicle</h2>

            {userVehicles.length === 0 ? (
              <div className="valet-prebooking-no-vehicles">
                <p>No vehicles found in your profile.</p>
                <p>Please add vehicle information in your profile settings.</p>
                <button
                  type="button"
                  className="valet-prebooking-btn-secondary"
                  onClick={() => navigate("/profile-settings")}
                >
                  Go to Profile Settings
                </button>
              </div>
            ) : (
              <div className="valet-prebooking-vehicles">
                {userVehicles.map((vehicle, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`valet-prebooking-vehicle-card ${
                      selectedVehicleIndex === index ? "selected" : ""
                    }`}
                    onClick={() => setSelectedVehicleIndex(index)}
                  >
                    <div className="valet-prebooking-vehicle-info">
                      <h3>Car {index + 1}</h3>
                      <p className="valet-prebooking-vehicle-plate">
                        {vehicle.licensePlate?.toUpperCase() || "No License Plate"}
                      </p>
                      {(vehicle.make || vehicle.model || vehicle.color) && (
                        <p className="valet-prebooking-vehicle-details">
                          {[vehicle.color, vehicle.make, vehicle.model]
                            .filter(Boolean)
                            .join(" ")}
                        </p>
                      )}
                    </div>
                    {selectedVehicleIndex === index && (
                      <div className="valet-prebooking-vehicle-check">✓</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="valet-prebooking-section">
            <h2>Arrival Time</h2>

            <div className="valet-prebooking-form-group">
              <label>Estimated Arrival *</label>
              <input
                type="datetime-local"
                value={estimatedArrival}
                onChange={(e) => setEstimatedArrival(e.target.value)}
                required
                min={new Date().toISOString().slice(0, 16)}
              />
              <p className="valet-prebooking-form-hint">
                When do you expect to arrive at the restaurant?
              </p>
            </div>
          </div>

          <button
            type="submit"
            className="valet-prebooking-submit"
            disabled={submitting}
          >
            {submitting ? "Pre-Booking..." : "Pre-Book Valet Service"}
          </button>
        </form>

        <div className="valet-prebooking-footer">
          <p className="valet-prebooking-note">
            * Payment for valet service is handled directly with the valet company upon arrival.
            This pre-booking is for advance notification only.
          </p>
          <button
            className="valet-prebooking-cancel"
            onClick={() => navigate(`/restaurant/${restaurantId}`)}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

