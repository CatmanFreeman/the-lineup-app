// src/pages/Dashboards/ValetDriverDashboard/ValetTimeClock.jsx
//
// VALET TIME CLOCK
//
// Time clock for valet drivers (separate from restaurant employees)
// Tracks attendance for valet company

import React, { useEffect, useState } from "react";
import { doc, setDoc, updateDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../hooks/services/firebase";
import useGeofence from "../../../hooks/useGeofence";
import "./ValetTimeClock.css";

export default function ValetTimeClock({ 
  driverId, 
  valetCompanyId, 
  restaurantId,
  onPunchInSuccess, // Callback when punch-in succeeds
}) {
  const [clockedIn, setClockedIn] = useState(false);
  const [punchInTime, setPunchInTime] = useState(null);
  const [insideGeofence, setInsideGeofence] = useState(false);
  const [loading, setLoading] = useState(false);
  const [restaurantLocation, setRestaurantLocation] = useState(null);

  // Get restaurant location for geofence
  useEffect(() => {
    async function loadRestaurantLocation() {
      try {
        const restaurantRef = doc(db, "restaurants", restaurantId);
        const restaurantSnap = await getDoc(restaurantRef);
        if (restaurantSnap.exists()) {
          const data = restaurantSnap.data();
          if (data.lat && data.lng) {
            setRestaurantLocation({ lat: data.lat, lng: data.lng });
          }
        }
      } catch (error) {
        console.error("Error loading restaurant location:", error);
      }
    }

    if (restaurantId) {
      loadRestaurantLocation();
    }
  }, [restaurantId]);

  // Geofence for restaurant location
  const {
    inside,
    distanceMeters,
  } = useGeofence({
    targetLat: restaurantLocation?.lat,
    targetLng: restaurantLocation?.lng,
    radiusMeters: 80,
    enabled: !!restaurantLocation,
  });

  useEffect(() => {
    setInsideGeofence(!!inside);
  }, [inside]);

  // Check current clock status
  useEffect(() => {
    async function checkClockStatus() {
      try {
        const attendanceRef = doc(
          db,
          "valetCompanies",
          valetCompanyId,
          "attendance",
          driverId
        );
        const attendanceSnap = await getDoc(attendanceRef);

        if (attendanceSnap.exists()) {
          const data = attendanceSnap.data();
          if (data.status === "active" && data.punchedInAt) {
            setClockedIn(true);
            const punchIn = data.punchedInAt?.toDate?.() || new Date(data.punchedInAt);
            setPunchInTime(punchIn);
          }
        }
      } catch (error) {
        console.error("Error checking clock status:", error);
      }
    }

    if (driverId && valetCompanyId) {
      checkClockStatus();
    }
  }, [driverId, valetCompanyId]);

  async function punchIn() {
    if (!insideGeofence || clockedIn) return;

    setLoading(true);
    try {
      const attendanceRef = doc(
        db,
        "valetCompanies",
        valetCompanyId,
        "attendance",
        driverId
      );

      await setDoc(
        attendanceRef,
        {
          driverId,
          valetCompanyId,
          restaurantId,
          status: "active",
          punchedInAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setClockedIn(true);
      setPunchInTime(new Date());
      
      // Callback for parent to show blast modal
      if (onPunchInSuccess) {
        onPunchInSuccess();
      }
    } catch (error) {
      console.error("Error punching in:", error);
      alert("Failed to punch in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function punchOut() {
    if (!clockedIn) return;

    setLoading(true);
    try {
      const attendanceRef = doc(
        db,
        "valetCompanies",
        valetCompanyId,
        "attendance",
        driverId
      );

      await updateDoc(attendanceRef, {
        status: "completed",
        punchedOutAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setClockedIn(false);
      setPunchInTime(null);
    } catch (error) {
      console.error("Error punching out:", error);
      alert("Failed to punch out. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const formatElapsedTime = () => {
    if (!punchInTime) return "00:00";
    const now = new Date();
    const elapsed = Math.floor((now - punchInTime) / 1000); // seconds
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  };

  return (
    <div className="valet-timeclock">
      <div className="valet-timeclock-status">
        {clockedIn ? (
          <>
            <div className="valet-timeclock-status-indicator valet-timeclock-status-active">
              Clocked In
            </div>
            <div className="valet-timeclock-elapsed">
              <div className="valet-timeclock-elapsed-label">Time Elapsed</div>
              <div className="valet-timeclock-elapsed-time">{formatElapsedTime()}</div>
            </div>
          </>
        ) : (
          <div className="valet-timeclock-status-indicator valet-timeclock-status-inactive">
            Not Clocked In
          </div>
        )}
      </div>

      <div className="valet-timeclock-actions">
        {clockedIn ? (
          <button
            className="valet-timeclock-btn valet-timeclock-btn-out"
            onClick={punchOut}
            disabled={loading}
          >
            {loading ? "Punching Out..." : "Punch Out"}
          </button>
        ) : (
          <button
            className={`valet-timeclock-btn valet-timeclock-btn-in ${
              !insideGeofence ? "valet-timeclock-btn-disabled" : ""
            }`}
            onClick={punchIn}
            disabled={loading || !insideGeofence}
            title={
              !insideGeofence
                ? "You must be near the restaurant to punch in"
                : "Punch in for your shift"
            }
          >
            {loading ? "Punching In..." : "Punch In"}
          </button>
        )}
      </div>

      {!insideGeofence && !clockedIn && (
        <div className="valet-timeclock-geofence-warning">
          ⚠️ You must be near the restaurant to punch in
          {distanceMeters && (
            <span> ({Math.round(distanceMeters)}m away)</span>
          )}
        </div>
      )}
    </div>
  );
}

