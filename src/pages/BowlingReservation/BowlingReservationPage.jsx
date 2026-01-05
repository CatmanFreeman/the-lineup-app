import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../../hooks/services/firebase";
import { createBowlingReservation } from "../../utils/bowlingReservationService";
import { scheduleExpirationNotifications } from "../../utils/bowlingReservationNotificationService";
import { Timestamp } from "firebase/firestore";
import "./BowlingReservationPage.css";

export default function BowlingReservationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const restaurantId = searchParams.get("restaurantId");
  const includeDinner = searchParams.get("includeDinner") === "true";

  const [formData, setFormData] = useState({
    laneId: "",
    startTimeHours: new Date().getHours(),
    startTimeMinutes: new Date().getMinutes(),
    duration: 60,
    partySize: 2,
    needsShoes: false,
    shoeRentals: [],
    guestName: "",
    guestPhone: "",
    notes: "",
  });

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [lanes, setLanes] = useState([]);

  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
      return;
    }

    if (!restaurantId) {
      navigate("/reservations");
      return;
    }

    loadRestaurant();
    loadLanes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, restaurantId, navigate]);

  const loadRestaurant = async () => {
    try {
      const restaurantRef = doc(db, "restaurants", restaurantId);
      const restaurantSnap = await getDoc(restaurantRef);
      if (restaurantSnap.exists()) {
        setRestaurant({ id: restaurantSnap.id, ...restaurantSnap.data() });
      }
    } catch (error) {
      console.error("Error loading restaurant:", error);
      setError("Failed to load restaurant");
    } finally {
      setLoading(false);
    }
  };

  const loadLanes = async () => {
    if (!restaurantId) return;
    try {
      const lanesRef = collection(db, "restaurants", restaurantId, "bowlingLanes");
      const snap = await getDocs(lanesRef);
      const lanesList = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // Ensure lanes 1-12 exist
      const existingLaneNumbers = new Set(lanesList.map(l => parseInt(l.laneNumber)));
      for (let i = 1; i <= 12; i++) {
        if (!existingLaneNumbers.has(i)) {
          lanesList.push({
            id: String(i),
            laneNumber: String(i),
            status: "available",
          });
        }
      }

      setLanes(lanesList.sort((a, b) => parseInt(a.laneNumber) - parseInt(b.laneNumber)));
    } catch (error) {
      console.error("Error loading lanes:", error);
    }
  };

  const handleShoeRentalChange = (index, field, value) => {
    const updatedShoes = [...formData.shoeRentals];
    if (!updatedShoes[index]) {
      updatedShoes[index] = { name: "", size: "" };
    }
    updatedShoes[index][field] = value;
    setFormData({ ...formData, shoeRentals: updatedShoes });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.laneId || !formData.guestName || !formData.guestPhone) {
      setError("Please fill in all required fields");
      return;
    }

    try {
      setSubmitting(true);

      const now = new Date();
      const startTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        formData.startTimeHours,
        formData.startTimeMinutes
      );

      const reservationId = await createBowlingReservation({
        restaurantId,
        laneId: formData.laneId,
        startTime,
        duration: formData.duration,
        partySize: formData.partySize,
        guestName: formData.guestName,
        guestPhone: formData.guestPhone,
        guestEmail: currentUser.email,
        dinerId: currentUser.uid,
        needsShoes: formData.needsShoes,
        shoeRentals: formData.needsShoes ? formData.shoeRentals : [],
        notes: formData.notes,
      });

      // Schedule expiration notifications if this is a diner reservation
      if (currentUser.uid) {
        const endTime = new Date(startTime.getTime() + formData.duration * 60000);
        await scheduleExpirationNotifications(
          reservationId,
          restaurantId,
          Timestamp.fromDate(endTime),
          currentUser.uid,
          [] // Sibling IDs would be added if group booking
        );
      }

      alert("Bowling reservation created successfully!");
      
      // If including dinner, redirect to restaurant reservation page
      if (includeDinner) {
        navigate(`/reservation?restaurantId=${restaurantId}&bowlingReservationId=${reservationId}`);
      } else {
        navigate("/reservations?tab=bowling");
      }
    } catch (error) {
      console.error("Error creating bowling reservation:", error);
      setError(error.message || "Failed to create reservation. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bowling-reservation-page">
        <div className="bowling-reservation-loading">Loading...</div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="bowling-reservation-page">
        <div className="bowling-reservation-error">Restaurant not found</div>
      </div>
    );
  }

  return (
    <div className="bowling-reservation-page">
      <div className="bowling-reservation-container">
        <div className="bowling-reservation-header">
          <h1>
            {includeDinner ? "Bowling Lane + Dinner Reservation" : "Bowling Lane Reservation"}
          </h1>
          <p className="bowling-reservation-subtitle">
            {restaurant.name}
          </p>
          {includeDinner && (
            <p className="bowling-reservation-note" style={{ 
              color: "rgba(255, 255, 255, 0.8)", 
              fontSize: "14px", 
              marginTop: "8px",
              padding: "12px",
              background: "rgba(77, 163, 255, 0.1)",
              borderRadius: "6px"
            }}>
              After completing your bowling reservation, you'll be taken to make your dinner reservation.
            </p>
          )}
          <button className="bowling-reservation-back" onClick={() => navigate("/reservations")}>
            ← Back to Reservations
          </button>
        </div>

        {error && <div className="bowling-reservation-error">{error}</div>}

        <form onSubmit={handleSubmit} className="bowling-reservation-form">
          <div className="form-group">
            <label>Lane *</label>
            <select
              value={formData.laneId}
              onChange={(e) => setFormData({ ...formData, laneId: e.target.value })}
              required
            >
              <option value="">Select Lane</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((laneNum) => {
                const lane = lanes.find(l => parseInt(l.laneNumber) === laneNum);
                const isAvailable = !lane || lane.status === "available";
                return (
                  <option
                    key={laneNum}
                    value={String(laneNum)}
                    disabled={!isAvailable}
                  >
                    Lane {laneNum} {!isAvailable ? `(${lane?.status || 'unavailable'})` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="form-group">
            <label>Guest Name *</label>
            <input
              type="text"
              value={formData.guestName}
              onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Guest Phone *</label>
            <input
              type="tel"
              value={formData.guestPhone}
              onChange={(e) => setFormData({ ...formData, guestPhone: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Start Time *</label>
            <div
              className="bowling-time-picker-trigger"
              onClick={() => setShowTimePicker(!showTimePicker)}
            >
              {String(formData.startTimeHours).padStart(2, '0')}:
              {String(formData.startTimeMinutes).padStart(2, '0')}
            </div>
            {showTimePicker && (
              <div className="bowling-time-picker">
                <div className="bowling-time-picker-hours">
                  <div className="bowling-time-picker-label">Hour</div>
                  <div className="bowling-time-picker-scroll">
                    {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                      <div
                        key={hour}
                        className={`bowling-time-picker-item ${
                          formData.startTimeHours === hour ? 'selected' : ''
                        }`}
                        onClick={() => {
                          setFormData({ ...formData, startTimeHours: hour });
                        }}
                      >
                        {String(hour).padStart(2, '0')}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bowling-time-picker-minutes">
                  <div className="bowling-time-picker-label">Minute</div>
                  <div className="bowling-time-picker-scroll">
                    {Array.from({ length: 60 }, (_, i) => i).map((minute) => (
                      <div
                        key={minute}
                        className={`bowling-time-picker-item ${
                          formData.startTimeMinutes === minute ? 'selected' : ''
                        }`}
                        onClick={() => {
                          setFormData({ ...formData, startTimeMinutes: minute });
                        }}
                      >
                        {String(minute).padStart(2, '0')}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Duration *</label>
            <select
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
              required
            >
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={120}>2 hours</option>
              <option value={180}>3 hours</option>
            </select>
          </div>

          <div className="form-group">
            <label>Party Size *</label>
            <select
              value={formData.partySize}
              onChange={(e) => {
                const newPartySize = parseInt(e.target.value);
                setFormData({
                  ...formData,
                  partySize: newPartySize,
                  shoeRentals: formData.needsShoes
                    ? Array.from({ length: newPartySize }, (_, i) => {
                        const existing = formData.shoeRentals[i];
                        return existing || { name: "", size: "" };
                      })
                    : [],
                });
              }}
              required
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((size) => (
                <option key={size} value={size}>
                  {size} {size === 1 ? 'person' : 'people'}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.needsShoes}
                onChange={(e) => {
                  const needsShoes = e.target.checked;
                  setFormData({
                    ...formData,
                    needsShoes,
                    shoeRentals: needsShoes
                      ? Array.from({ length: formData.partySize }, (_, i) => ({
                          name: "",
                          size: "",
                        }))
                      : [],
                  });
                }}
              />
              Do you need to rent shoes for your group?
            </label>
          </div>

          {formData.needsShoes && formData.shoeRentals.length > 0 && (
            <div className="form-group">
              <label>Shoe Rentals ({formData.partySize} people)</label>
              {formData.shoeRentals.map((shoe, index) => (
                <div key={index} className="bowling-shoe-rental-item">
                  <div className="bowling-shoe-icon">👟</div>
                  <input
                    type="text"
                    placeholder={`Person ${index + 1} name`}
                    value={shoe.name}
                    onChange={(e) => handleShoeRentalChange(index, "name", e.target.value)}
                  />
                  <select
                    value={shoe.size}
                    onChange={(e) => handleShoeRentalChange(index, "size", e.target.value)}
                  >
                    <option value="">Select Size</option>
                    {Array.from({ length: 20 }, (_, i) => {
                      const size = i + 1;
                      return (
                        <option key={size} value={size}>
                          Size {size}
                        </option>
                      );
                    })}
                  </select>
                </div>
              ))}
            </div>
          )}

          <div className="form-group">
            <label>Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div className="bowling-reservation-actions">
            <button
              type="button"
              className="bowling-reservation-btn-secondary"
              onClick={() => navigate("/reservations")}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bowling-reservation-btn-primary"
              disabled={submitting}
            >
              {submitting ? "Creating..." : "Create Reservation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

