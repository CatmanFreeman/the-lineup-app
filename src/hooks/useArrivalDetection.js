// src/hooks/useArrivalDetection.js
//
// ARRIVAL DETECTION HOOK
//
// Monitors user location and detects arrival at restaurants
// - Checks location every 15 minutes normally
// - Checks more frequently when within 200 feet
// - Triggers notifications when within 50 feet

import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getAllRestaurants,
  findNearbyRestaurants,
  triggerArrivalNotification,
  getCurrentLocation,
  DETECTION_RADIUS_METERS,
  NOTIFICATION_RADIUS_METERS,
  NORMAL_CHECK_INTERVAL_MS,
  NEARBY_CHECK_INTERVAL_MS,
} from "../utils/arrivalDetectionService";

/**
 * useArrivalDetection
 * 
 * @param {Object} options
 * @param {boolean} options.enabled - Enable/disable detection
 * @param {boolean} options.backgroundMode - Enable background monitoring (requires push notifications)
 */
export default function useArrivalDetection({ enabled = true, backgroundMode = false } = {}) {
  const { currentUser } = useAuth();
  const [restaurants, setRestaurants] = useState([]);
  const [nearbyRestaurants, setNearbyRestaurants] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastNotificationTime, setLastNotificationTime] = useState(new Map());

  const intervalRef = useRef(null);
  const nearbyIntervalRef = useRef(null);
  const restaurantsLoadedRef = useRef(false);

  // Load restaurants once
  useEffect(() => {
    if (!enabled || restaurantsLoadedRef.current) return;

    async function loadRestaurants() {
      const allRestaurants = await getAllRestaurants();
      setRestaurants(allRestaurants);
      restaurantsLoadedRef.current = true;
    }

    loadRestaurants();
  }, [enabled]);

  // Main location monitoring loop
  useEffect(() => {
    if (!enabled || !currentUser) {
      setIsMonitoring(false);
      return;
    }

    if (!navigator.geolocation) {
      console.warn("Geolocation not available");
      return;
    }

    let cancelled = false;
    setIsMonitoring(true);

    // Check location and detect nearby restaurants
    async function checkLocation() {
      if (cancelled) return;

      try {
        const location = await getCurrentLocation();
        if (!location || cancelled) return;

        setUserLocation(location);

        // Find nearby restaurants
        const nearby = findNearbyRestaurants(location.lat, location.lng, restaurants);
        setNearbyRestaurants(nearby);

        // Check if any restaurant is within notification radius (50 feet)
        const withinNotificationRadius = nearby.filter(
          (r) => r.distanceMeters <= NOTIFICATION_RADIUS_METERS
        );

        if (withinNotificationRadius.length > 0) {
          // Check if we've already notified for these restaurants recently (within 5 minutes)
          const now = Date.now();
          const shouldNotify = withinNotificationRadius.some((r) => {
            const lastNotified = lastNotificationTime.get(r.id) || 0;
            return now - lastNotified > 5 * 60 * 1000; // 5 minutes cooldown
          });

          if (shouldNotify) {
            // Trigger notification
            await triggerArrivalNotification(currentUser.uid, nearby, location);

            // Update last notification time
            const newMap = new Map(lastNotificationTime);
            withinNotificationRadius.forEach((r) => {
              newMap.set(r.id, now);
            });
            setLastNotificationTime(newMap);
          }
        }

        // If we're near restaurants (within 200 feet), check more frequently
        const withinDetectionRadius = nearby.filter(
          (r) => r.distanceMeters <= DETECTION_RADIUS_METERS
        );

        if (withinDetectionRadius.length > 0) {
          // Start frequent checking (every 30 seconds)
          if (!nearbyIntervalRef.current) {
            nearbyIntervalRef.current = setInterval(() => {
              checkLocation();
            }, NEARBY_CHECK_INTERVAL_MS);
          }
        } else {
          // Stop frequent checking if we're not near any restaurant
          if (nearbyIntervalRef.current) {
            clearInterval(nearbyIntervalRef.current);
            nearbyIntervalRef.current = null;
          }
        }
      } catch (error) {
        console.error("Error in location check:", error);
      }
    }

    // Initial check
    checkLocation();

    // Set up normal interval (every 15 minutes)
    intervalRef.current = setInterval(() => {
      checkLocation();
    }, NORMAL_CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      setIsMonitoring(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (nearbyIntervalRef.current) {
        clearInterval(nearbyIntervalRef.current);
        nearbyIntervalRef.current = null;
      }
    };
  }, [enabled, currentUser, restaurants, lastNotificationTime]);

  return {
    isMonitoring,
    userLocation,
    nearbyRestaurants,
    restaurants,
  };
}








