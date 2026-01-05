// src/components/ArrivalDetection/ArrivalDetectionProvider.jsx
//
// ARRIVAL DETECTION PROVIDER
//
// Wraps the app and monitors user location for arrival detection
// Shows notifications and modals when user arrives at restaurants

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import useArrivalDetection from "../../hooks/useArrivalDetection";
import useUserActivity from "../../hooks/useUserActivity";
import RestaurantSelectionModal from "./RestaurantSelectionModal";
import DrivingDetectedModal from "../ValetPreBooking/DrivingDetectedModal";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "../../hooks/services/firebase";
import { NOTIFICATION_TYPES } from "../../utils/notificationService";
import { monitorMotion } from "../../utils/motionDetectionService";
import { isUserRecentlyActive } from "../../utils/userActivityService";
import { findNearbyRestaurants, getAllRestaurants, getCurrentLocation } from "../../utils/arrivalDetectionService";
import { getAuthorizedValetCompanies } from "../../utils/valetCompanyService";

export default function ArrivalDetectionProvider({ children }) {
  const { currentUser } = useAuth();
  
  // Track user activity
  useUserActivity();
  
  const [showRestaurantSelection, setShowRestaurantSelection] = useState(false);
  const [restaurantsToShow, setRestaurantsToShow] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState([]);
  const [showDrivingModal, setShowDrivingModal] = useState(false);
  const [hasShownDrivingModal, setHasShownDrivingModal] = useState(false);
  const [lastDrivingCheck, setLastDrivingCheck] = useState(null);
  const motionCleanupRef = useRef(null);

  // Enable arrival detection when user is logged in
  const { isMonitoring, nearbyRestaurants } = useArrivalDetection({
    enabled: !!currentUser,
    backgroundMode: false, // TODO: Enable when push notifications are set up
  });

  // Monitor motion to detect driving with smart detection logic
  useEffect(() => {
    if (!currentUser) return;

    // Clean up previous monitoring
    if (motionCleanupRef.current) {
      motionCleanupRef.current();
    }

    let userLocation = null;

    // Start motion monitoring
    motionCleanupRef.current = monitorMotion(
      async () => {
        // User started driving
        if (hasShownDrivingModal) return;

        // CRITICAL FIX: Check if we've already checked recently (within last hour)
        // This prevents false positives from stale GPS data
        const now = Date.now();
        if (lastDrivingCheck && (now - lastDrivingCheck) < 60 * 60 * 1000) {
          console.log('⚠️ Skipping driving check - already checked recently');
          return;
        }

        setLastDrivingCheck(now);

        try {
          // Check if user was recently active in app (within 10 minutes)
          const wasRecentlyActive = await isUserRecentlyActive(currentUser.uid, 10 * 60 * 1000);

          if (wasRecentlyActive) {
            // User was active recently → ask immediately
            console.log('✅ User recently active, showing driving modal');
            setShowDrivingModal(true);
            setHasShownDrivingModal(true);
          } else {
            // User wasn't active → only ask when close to restaurant
            // This will be handled by arrival detection when they get close
            // (within 50 yards/meters of a restaurant)
            console.log('ℹ️ User not recently active, will prompt when near restaurant');
          }
        } catch (error) {
          console.error("Error checking user activity:", error);
          // Don't show modal on error - this prevents false positives
          console.log('⚠️ Error checking activity, not showing modal to prevent false positives');
        }
      },
      () => {
        // User stopped driving - reset flag immediately
        console.log('✅ User stopped driving, resetting flags');
        setHasShownDrivingModal(false);
        setLastDrivingCheck(null);
      }
    );

    return () => {
      if (motionCleanupRef.current) {
        motionCleanupRef.current();
      }
      // Reset flags when component unmounts or user changes
      setHasShownDrivingModal(false);
      setLastDrivingCheck(null);
    };
  }, [currentUser]);

  // Check for nearby restaurants when user gets close (for non-active users)
  useEffect(() => {
    if (!currentUser || hasShownDrivingModal) return;

    async function checkNearbyRestaurants() {
      try {
        const wasRecentlyActive = await isUserRecentlyActive(currentUser.uid, 10 * 60 * 1000);
        if (wasRecentlyActive) return; // Already handled by motion detection

        // Get user location
        const location = await getCurrentLocation();
        if (!location) return;

        // Get all restaurants
        const restaurants = await getAllRestaurants();

        // Find nearby restaurants (within 50 yards ≈ 45 meters)
        const nearby = findNearbyRestaurants(location.lat, location.lng, restaurants);
        // Filter to only those within 45 meters (50 yards)
        const nearbyClose = nearby.filter(r => {
          // Calculate distance in meters
          const R = 6371000; // Earth radius in meters
          const toRad = (deg) => (deg * Math.PI) / 180;
          const dLat = toRad(r.lat - location.lat);
          const dLon = toRad(r.lng - location.lng);
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(location.lat)) * Math.cos(toRad(r.lat)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distanceMeters = R * c;
          return distanceMeters <= 45;
        });

        // Check if any have valet service
        const restaurantsWithValet = [];

        for (const restaurant of nearby) {
          const valetCompanies = await getAuthorizedValetCompanies(restaurant.id);
          if (valetCompanies.length > 0) {
            restaurantsWithValet.push(restaurant);
          }
        }

        // If close to restaurant with valet, show modal
        if (nearbyClose.length > 0 && restaurantsWithValet.length > 0 && !hasShownDrivingModal) {
          setShowDrivingModal(true);
          setHasShownDrivingModal(true);
        }
      } catch (error) {
        console.error("Error checking nearby restaurants:", error);
      }
    }

    // Check every 30 seconds when user is not recently active
    const interval = setInterval(checkNearbyRestaurants, 30 * 1000);
    checkNearbyRestaurants(); // Initial check

    return () => clearInterval(interval);
  }, [currentUser, hasShownDrivingModal]);

  // Check for arrival-related notifications
  useEffect(() => {
    if (!currentUser) return;

    async function checkNotifications() {
      try {
        const notificationsRef = collection(db, "notifications");
        const q = query(
          notificationsRef,
          where("userId", "==", currentUser.uid),
          where("read", "==", false),
          where("type", "==", NOTIFICATION_TYPES.RESERVATION),
          orderBy("createdAt", "desc"),
          limit(5)
        );

        const snap = await getDocs(q);
        const notifications = [];

        snap.forEach((doc) => {
          const data = doc.data();
          if (data.metadata?.arrivalType) {
            notifications.push({
              id: doc.id,
              ...data,
            });
          }
        });

        setUnreadNotifications(notifications);

        // Check if there's a restaurant selection notification
        const selectionNotification = notifications.find(
          (n) => n.metadata?.arrivalType === "restaurant_selection"
        );

        if (selectionNotification && selectionNotification.metadata?.restaurants) {
          setRestaurantsToShow(selectionNotification.metadata.restaurants);
          setShowRestaurantSelection(true);
        }
      } catch (error) {
        console.error("Error checking notifications:", error);
      }
    }

    checkNotifications();

    // Check every 30 seconds for new notifications
    const interval = setInterval(checkNotifications, 30 * 1000);

    return () => clearInterval(interval);
  }, [currentUser]);


  const handleCloseRestaurantSelection = () => {
    setShowRestaurantSelection(false);
    setRestaurantsToShow([]);
  };

  const handleCloseDrivingModal = () => {
    setShowDrivingModal(false);
  };

  const handleRestaurantSelected = (restaurant) => {
    setShowDrivingModal(false);
    // Navigation handled by DrivingDetectedModal
  };

  return (
    <>
      {children}
      {showRestaurantSelection && restaurantsToShow.length > 0 && (
        <RestaurantSelectionModal
          restaurants={restaurantsToShow}
          onClose={handleCloseRestaurantSelection}
        />
      )}
      {showDrivingModal && (
        <DrivingDetectedModal
          onClose={handleCloseDrivingModal}
          onRestaurantSelected={handleRestaurantSelected}
        />
      )}
    </>
  );
}

