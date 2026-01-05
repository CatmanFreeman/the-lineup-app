// src/pages/Dashboards/EmployeeDashboard/TimeClock.jsx

import React, { useEffect, useMemo, useState } from "react";
import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../hooks/services/firebase";
import useGeofence from "../../../hooks/useGeofence";
import useRestaurantLocation from "../../../hooks/useRestaurantLocation";
import { awardPointsForAction, POINT_ACTION } from "../../../utils/pointsService";
import { runEmployeeAutoAwards } from "../../../utils/autoAwardService";
import { getScheduledShiftEndTime, isPunchOutOnTime } from "../../../utils/scheduleService";
import { trackVettedEmployment } from "../../../utils/employmentTrackingService";

/**
 * Employee Time Clock
 *
 * FEATURES
 * - Manual punch in / punch out (always available when allowed)
 * - GPS-assisted nudges (arrival +5 min, departure +1 min)
 * - Status-driven UI (Not Clocked / Clocked / Action Needed)
 * - No auto-punching (manager trust preserved)
 * - Flag creation for manager review
 * - Auto-award badges and points on punch in/out
 * - Checks punch out time against scheduled shift end time
 */

export default function TimeClock({
  employeeUid,
  restaurantId,
  role,
  companyId = null,
  profileMode = "diner",
  onPunchInSuccess = null,
}) {
  // ----------------------------------
  // State
  // ----------------------------------
  const [clockedIn, setClockedIn] = useState(false);
  const [punchInTime, setPunchInTime] = useState(null);

  const [insideGeofence, setInsideGeofence] = useState(false);
  const [arrivalAt, setArrivalAt] = useState(null);
  const [departureAt, setDepartureAt] = useState(null);

  const [arrivalNudgeReady, setArrivalNudgeReady] = useState(false);
  const [departureNudgeReady, setDepartureNudgeReady] = useState(false);

  const [flagged, setFlagged] = useState(false);
  const [loading, setLoading] = useState(false);

  // ----------------------------------
  // Derived
  // ----------------------------------
  const status = useMemo(() => {
    if (flagged) return "FLAGGED";
    if (clockedIn && departureNudgeReady) return "ACTION_NEEDED";
    if (clockedIn) return "CLOCKED_IN";
    return "NOT_CLOCKED";
  }, [clockedIn, flagged, departureNudgeReady]);

  // ----------------------------------
  // Real Restaurant Location (Firestore)
  // ----------------------------------
  const effectiveCompanyId = companyId || "company-demo"; // Use prop or fallback
  const { loading: loadingLoc, error: locError, location } =
    useRestaurantLocation({ companyId: effectiveCompanyId, restaurantId });

  // ----------------------------------
  // Real Geofence (Browser GPS)
  // ----------------------------------
  const {
    permission,
    error: geoError,
    position,
    distanceMeters,
    inside,
    arrivalAt: geoArrivalAt,
    departureAt: geoDepartureAt,
  } = useGeofence({
    targetLat: location?.lat,
    targetLng: location?.lng,
    radiusMeters: 80, // adjust as needed (80m default)
    enabled: !!location && !loadingLoc,
  });

  // Wire into your existing state vars
  useEffect(() => {
    setInsideGeofence(!!inside);
  }, [inside]);

  useEffect(() => {
    if (geoArrivalAt) setArrivalAt(geoArrivalAt);
  }, [geoArrivalAt]);

  useEffect(() => {
    if (geoDepartureAt) setDepartureAt(geoDepartureAt);
  }, [geoDepartureAt]);

  // ----------------------------------
  // Arrival → 5 min punch-in nudge
  // ----------------------------------
  useEffect(() => {
    if (!arrivalAt || clockedIn) return;

    const timer = setTimeout(() => {
      setArrivalNudgeReady(true);
    }, 5 * 60 * 1000);

    return () => clearTimeout(timer);
  }, [arrivalAt, clockedIn]);

  // ----------------------------------
  // Departure → 1 min punch-out nudge
  // ----------------------------------
  useEffect(() => {
    if (!departureAt || !clockedIn) return;

    const timer = setTimeout(() => {
      setDepartureNudgeReady(true);
    }, 60 * 1000);

    return () => clearTimeout(timer);
  }, [departureAt, clockedIn]);

  // ----------------------------------
  // Punch In
  // ----------------------------------
  async function punchIn() {
    if (!insideGeofence || clockedIn) return;

    setLoading(true);

    try {
      const ref = doc(
        db,
        "restaurants",
        restaurantId,
        "attendance",
        employeeUid
      );

      await setDoc(
        ref,
        {
          employeeUid,
          role,
          status: "active",
          punchedInAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Award points for punch in
      try {
        await awardPointsForAction({
          userId: employeeUid,
          action: POINT_ACTION.PUNCH_IN,
          reason: "Punched in for shift",
          source: "timeclock",
          sourceId: ref.id,
          restaurantId,
          companyId: effectiveCompanyId,
        });
      } catch (pointsError) {
        console.error("Error awarding points for punch in:", pointsError);
        // Don't fail punch in if points fail
      }

      setClockedIn(true);
      setPunchInTime(new Date());
      setArrivalNudgeReady(false);
      
      // Callback for parent to show blast modal
      if (onPunchInSuccess) {
        onPunchInSuccess();
      }
      
      // Track vetted employment (if first time at this restaurant)
      // Get restaurant name first
      try {
        const restaurantRef = doc(db, "restaurants", restaurantId);
        const restaurantSnap = await getDoc(restaurantRef);
        const restaurantName = restaurantSnap.exists() 
          ? (restaurantSnap.data().name || restaurantId)
          : restaurantId;
        
        // Track vetted employment (async, don't wait)
        trackVettedEmployment({
          employeeUid,
          restaurantId,
          restaurantName,
          role,
          startDate: new Date(),
        }).catch(err => {
          console.error("Error tracking vetted employment:", err);
        });
      } catch (trackingError) {
        console.error("Error getting restaurant name for employment tracking:", trackingError);
      }
      
      // Run auto-award checks (async, don't wait)
      runEmployeeAutoAwards(employeeUid, restaurantId, effectiveCompanyId).catch(err => {
        console.error("Error running auto-awards:", err);
      });
    } catch (error) {
      console.error("Error punching in:", error);
    } finally {
      setLoading(false);
    }
  }

  // ----------------------------------
  // Punch Out
  // ----------------------------------
  async function punchOut() {
    if (!clockedIn) return;

    setLoading(true);

    try {
      const ref = doc(
        db,
        "restaurants",
        restaurantId,
        "attendance",
        employeeUid
      );

      const punchOutTime = new Date();

      await updateDoc(ref, {
        status: "completed",
        punchedOutAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Check if punched out on time based on scheduled shift end time
      let punchedOutOnTime = false;
      try {
        const scheduledEndTime = await getScheduledShiftEndTime(employeeUid, restaurantId, effectiveCompanyId);
        
        if (scheduledEndTime) {
          punchedOutOnTime = isPunchOutOnTime(punchOutTime, scheduledEndTime, 15);
          
          // Award appropriate points based on whether they punched out on time
          await awardPointsForAction({
            userId: employeeUid,
            action: punchedOutOnTime 
              ? POINT_ACTION.PUNCH_OUT_ON_TIME 
              : POINT_ACTION.PUNCH_OUT || POINT_ACTION.PUNCH_OUT_ON_TIME, // Fallback if PUNCH_OUT doesn't exist
            reason: punchedOutOnTime 
              ? "Punched out on time (within scheduled end time + 15 min)" 
              : "Punched out (outside scheduled window)",
            source: "timeclock",
            sourceId: ref.id,
            restaurantId,
            companyId: effectiveCompanyId,
          });
        } else {
          // No schedule found, award basic punch out points
          await awardPointsForAction({
            userId: employeeUid,
            action: POINT_ACTION.PUNCH_OUT || POINT_ACTION.PUNCH_OUT_ON_TIME, // Fallback if PUNCH_OUT doesn't exist
            reason: "Punched out (no scheduled shift found)",
            source: "timeclock",
            sourceId: ref.id,
            restaurantId,
            companyId: effectiveCompanyId,
          });
        }
      } catch (pointsError) {
        console.error("Error awarding points for punch out:", pointsError);
        // Don't fail punch out if points fail
      }

      setClockedIn(false);
      setPunchInTime(null);
      setDepartureNudgeReady(false);
      
      // Run auto-award checks after shift completion (async, don't wait)
      runEmployeeAutoAwards(employeeUid, restaurantId, effectiveCompanyId).catch(err => {
        console.error("Error running auto-awards:", err);
      });
      
      // Award points for shift completion
      try {
        await awardPointsForAction({
          userId: employeeUid,
          action: POINT_ACTION.SHIFT_COMPLETE,
          reason: "Shift completed",
          source: "timeclock",
          sourceId: ref.id,
          restaurantId,
          companyId: effectiveCompanyId,
        });
      } catch (pointsError) {
        console.error("Error awarding points for shift completion:", pointsError);
      }
    } catch (error) {
      console.error("Error punching out:", error);
    } finally {
      setLoading(false);
    }
  }

  // ----------------------------------
  // Flag (manager review)
  // ----------------------------------
  async function flagEvent(reason) {
    const ref = doc(
      db,
      "restaurants",
      restaurantId,
      "attendanceFlags",
      `${employeeUid}_${Date.now()}`
    );

    await setDoc(ref, {
      employeeUid,
      reason,
      createdAt: serverTimestamp(),
    });

    setFlagged(true);
  }

  // ----------------------------------
  // UI
  // ----------------------------------
  return (
    <div className="metric-card info" style={{ maxWidth: 420 }}>
      <div className="metric-title">Time Clock</div>
      <div className="metric-subtext" style={{ marginBottom: 10 }}>
        {loadingLoc ? (
          "Loading restaurant location…"
        ) : locError ? (
          `Location error: ${locError}`
        ) : geoError ? (
          `GPS error: ${geoError}`
        ) : permission === "denied" ? (
          "GPS permission denied. Enable location to punch in."
        ) : !position ? (
          "Waiting for GPS…"
        ) : (
          <>
            Distance:{" "}
            {Number.isFinite(distanceMeters)
              ? `${Math.round(distanceMeters)}m`
              : "—"}{" "}
            • Inside: {inside ? "Yes" : "No"}
          </>
        )}
      </div>

      {/* STATUS */}
      <div style={{ marginBottom: 12 }}>
        {status === "NOT_CLOCKED" && (
          <div className="metric-subtext">
            You are not currently clocked in.
          </div>
        )}

        {status === "CLOCKED_IN" && (
          <div className="metric-subtext">
            Clocked in at{" "}
            {punchInTime?.toLocaleTimeString() || "—"}
          </div>
        )}

        {status === "ACTION_NEEDED" && (
          <div className="metric-subtext" style={{ color: "#f59e0b" }}>
            You left the restaurant. Punch out?
          </div>
        )}

        {status === "FLAGGED" && (
          <div className="metric-subtext" style={{ color: "#ef4444" }}>
            Attendance flagged for manager review.
          </div>
        )}
      </div>

      {/* ACTIONS */}
      <div style={{ display: "flex", gap: 10 }}>
        {!clockedIn && (
          <button
            disabled={!insideGeofence || loading}
            onClick={punchIn}
          >
            Punch In
          </button>
        )}

        {clockedIn && (
          <button onClick={punchOut} disabled={loading}>
            Punch Out
          </button>
        )}

        {departureNudgeReady && clockedIn && (
          <button
            onClick={() =>
              flagEvent("Left geofence without punching out")
            }
            style={{ background: "#ef4444", color: "#fff" }}
          >
            Ignore
          </button>
        )}
      </div>

      {/* NUDGES */}
      {arrivalNudgeReady && !clockedIn && (
        <div className="metric-subtext" style={{ marginTop: 10 }}>
          You've arrived. Please punch in.
        </div>
      )}
    </div>
  );
}