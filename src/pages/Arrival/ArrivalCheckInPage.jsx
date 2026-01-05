// src/pages/Arrival/ArrivalCheckInPage.jsx
//
// ARRIVAL CHECK-IN PAGE
//
// Shown when user arrives at restaurant with a reservation
// Allows check-in and valet selection

import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../hooks/services/firebase";
import { checkInReservation } from "../../utils/waitingListService";
import { createValetEntryOnCheckIn } from "../../utils/valetService";
import GuestCheckIn from "../../components/GuestCheckIn";
import "./ArrivalCheckInPage.css";

export default function ArrivalCheckInPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [restaurant, setRestaurant] = useState(null);
  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(true);

  const restaurantId = searchParams.get("restaurantId");
  const reservationId = searchParams.get("reservationId");

  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
      return;
    }

    if (!restaurantId || !reservationId) {
      navigate("/");
      return;
    }

    async function loadData() {
      try {
        // Load restaurant
        const restaurantRef = doc(db, "restaurants", restaurantId);
        const restaurantSnap = await getDoc(restaurantRef);
        
        if (!restaurantSnap.exists()) {
          alert("Restaurant not found");
          navigate("/");
          return;
        }

        setRestaurant({ id: restaurantSnap.id, ...restaurantSnap.data() });

        // Load reservation
        const reservationRef = doc(
          db,
          "restaurants",
          restaurantId,
          "reservations",
          reservationId
        );
        const reservationSnap = await getDoc(reservationRef);

        if (!reservationSnap.exists()) {
          alert("Reservation not found");
          navigate("/");
          return;
        }

        const reservationData = reservationSnap.data();
        if (reservationData.dinerId !== currentUser.uid) {
          alert("This reservation does not belong to you");
          navigate("/");
          return;
        }

        setReservation({ id: reservationSnap.id, ...reservationData });
      } catch (error) {
        console.error("Error loading data:", error);
        alert("Failed to load reservation data");
        navigate("/");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [currentUser, restaurantId, reservationId, navigate]);

  const handleCheckInComplete = async ({ valetParking, ticketUploaded }) => {
    try {
      // Check in reservation
      await checkInReservation(restaurantId, reservationId, {
        isValetParking: valetParking,
        dinerId: currentUser.uid,
        dinerName: reservation?.dinerName || currentUser.displayName,
        dinerPhone: reservation?.phone,
      });

      // Navigate to success page or back
      navigate(`/restaurant/${restaurantId}?checkedIn=true`);
    } catch (error) {
      console.error("Error checking in:", error);
      alert("Failed to check in. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="arrival-checkin-page">
        <div className="arrival-checkin-loading">Loading...</div>
      </div>
    );
  }

  if (!restaurant || !reservation) {
    return null;
  }

  return (
    <div className="arrival-checkin-page">
      <div className="arrival-checkin-container">
        <h1>Welcome to {restaurant.name}!</h1>
        <GuestCheckIn
          reservationId={reservationId}
          restaurantId={restaurantId}
          dinerName={reservation.dinerName || currentUser.displayName}
          dinerPhone={reservation.phone}
          onCheckInComplete={handleCheckInComplete}
        />
      </div>
    </div>
  );
}








