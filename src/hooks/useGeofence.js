// src/hooks/useGeofence.js
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * useGeofence
 * - Watches browser GPS (navigator.geolocation.watchPosition)
 * - Computes distance to a target point (restaurant lat/lng)
 * - Returns inside/outside + arrival/departure timestamps
 *
 * Notes:
 * - Browser geolocation requires HTTPS (or localhost).
 * - iOS Safari can be aggressive about background updates.
 */

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  // Earth radius in meters
  const R = 6371000;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function useGeofence({
  targetLat,
  targetLng,
  radiusMeters = 80, // default ~262 ft
  enabled = true,
  watchOptions,
}) {
  const [permission, setPermission] = useState("prompt"); // prompt | granted | denied | unsupported
  const [error, setError] = useState("");

  const [position, setPosition] = useState(null); // { lat, lng, accuracy, ts }
  const [distanceMeters, setDistanceMeters] = useState(null);

  const [inside, setInside] = useState(false);
  const [arrivalAt, setArrivalAt] = useState(null);
  const [departureAt, setDepartureAt] = useState(null);

  const watchIdRef = useRef(null);
  const lastInsideRef = useRef(false);

  const canCompute = useMemo(() => {
    return (
      typeof targetLat === "number" &&
      typeof targetLng === "number" &&
      Number.isFinite(targetLat) &&
      Number.isFinite(targetLng)
    );
  }, [targetLat, targetLng]);

  useEffect(() => {
    if (!enabled) return;

    if (!("geolocation" in navigator)) {
      setPermission("unsupported");
      setError("Geolocation unsupported in this browser.");
      return;
    }

    let cancelled = false;

    // Permission API is not supported in all browsers; we try best-effort
    async function checkPermission() {
      try {
        if (!navigator.permissions?.query) return;
        const res = await navigator.permissions.query({ name: "geolocation" });
        if (!cancelled) setPermission(res.state || "prompt");
        res.onchange = () => {
          if (!cancelled) setPermission(res.state || "prompt");
        };
      } catch {
        // ignore
      }
    }

    checkPermission();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (!canCompute) return;

    if (!("geolocation" in navigator)) return;

    setError("");

    const opts = {
      enableHighAccuracy: true,
      maximumAge: 10_000,
      timeout: 20_000,
      ...(watchOptions || {}),
    };

    // Clear any existing watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;
        const ts = pos.timestamp || Date.now();

        setPosition({ lat, lng, accuracy, ts });

        const d = haversineMeters(lat, lng, targetLat, targetLng);
        setDistanceMeters(d);

        const nowInside = d <= radiusMeters;

        // Track transitions
        const lastInside = lastInsideRef.current;
        if (!lastInside && nowInside) {
          setArrivalAt(Date.now());
          setDepartureAt(null);
        }
        if (lastInside && !nowInside) {
          setDepartureAt(Date.now());
        }

        lastInsideRef.current = nowInside;
        setInside(nowInside);
      },
      (err) => {
        // err.code: 1 PERMISSION_DENIED, 2 POSITION_UNAVAILABLE, 3 TIMEOUT
        setError(err?.message || "Geolocation error");
        if (err?.code === 1) setPermission("denied");
      },
      opts
    );

    watchIdRef.current = id;

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, canCompute, targetLat, targetLng, radiusMeters, watchOptions]);

  return {
    permission,
    error,
    position,
    distanceMeters,
    inside,
    arrivalAt,
    departureAt,
  };
}
