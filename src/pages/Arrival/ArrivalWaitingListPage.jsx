// src/pages/Arrival/ArrivalWaitingListPage.jsx
//
// ARRIVAL WAITING LIST PAGE
//
// Shown when user arrives at restaurant without a reservation
// Allows joining the waiting list

import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../hooks/services/firebase";
import { addToWaitingList } from "../../utils/waitingListService";
import "./ArrivalWaitingListPage.css";

export default function ArrivalWaitingListPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [restaurant, setRestaurant] = useState(null);
  const [partySize, setPartySize] = useState(2);
  const [joining, setJoining] = useState(false);
  const [loading, setLoading] = useState(true);

  const restaurantId = searchParams.get("restaurantId");

  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
      return;
    }

    if (!restaurantId) {
      navigate("/");
      return;
    }

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
      } catch (error) {
        console.error("Error loading restaurant:", error);
        alert("Failed to load restaurant data");
        navigate("/");
      } finally {
        setLoading(false);
      }
    }

    loadRestaurant();
  }, [currentUser, restaurantId, navigate]);

  const handleJoinWaitingList = async () => {
    if (!restaurant) return;

    setJoining(true);

    try {
      // Create a temporary reservation entry for the waiting list
      // Note: This is a simplified version - you may want to enhance this
      await addToWaitingList({
        restaurantId,
        dinerId: currentUser.uid,
        dinerName: currentUser.displayName || "Guest",
        partySize,
        phone: currentUser.phoneNumber || null,
        source: "WALK_UP",
      });

      // Navigate to success page
      navigate(`/restaurant/${restaurantId}?joinedWaitingList=true`);
    } catch (error) {
      console.error("Error joining waiting list:", error);
      alert("Failed to join waiting list. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="arrival-waitinglist-page">
        <div className="arrival-waitinglist-loading">Loading...</div>
      </div>
    );
  }

  if (!restaurant) {
    return null;
  }

  return (
    <div className="arrival-waitinglist-page">
      <div className="arrival-waitinglist-container">
        <div className="arrival-waitinglist-header">
          {restaurant.imageURL && (
            <img
              src={restaurant.imageURL}
              alt={restaurant.name}
              className="arrival-waitinglist-logo"
            />
          )}
          <h1>{restaurant.name}</h1>
          {restaurant.liveRating !== null && (
            <div className="arrival-waitinglist-rating">
              ⭐ {restaurant.liveRating.toFixed(1)}
            </div>
          )}
        </div>

        <div className="arrival-waitinglist-body">
          <p className="arrival-waitinglist-subtitle">
            Join the waiting list to get a table
          </p>

          <div className="arrival-waitinglist-party-size">
            <label>Party Size</label>
            <select
              value={partySize}
              onChange={(e) => setPartySize(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((size) => (
                <option key={size} value={size}>
                  {size} {size === 1 ? "person" : "people"}
                </option>
              ))}
            </select>
          </div>

          <button
            className="arrival-waitinglist-join-btn"
            onClick={handleJoinWaitingList}
            disabled={joining}
          >
            {joining ? "Joining..." : "Join Waiting List"}
          </button>

          <button
            className="arrival-waitinglist-view-lineup-btn"
            onClick={() => navigate(`/restaurant/${restaurantId}/lineup`)}
          >
            View Live Lineup →
          </button>
        </div>
      </div>
    </div>
  );
}








