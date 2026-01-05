// src/utils/arrivalDetectionService.js
//
// ARRIVAL DETECTION SERVICE
//
// Monitors user location and detects when they arrive at restaurants
// - Checks location every 15 minutes normally
// - Checks more frequently (every 30 seconds) when within 200 feet
// - Triggers notification when within 50 feet
// - Checks for active reservations
// - Handles multiple nearby restaurants

import { collection, getDocs } from "firebase/firestore";
import { db } from "../hooks/services/firebase";
import { getCurrentDinerReservationsFromLedger } from "./reservationLedgerService";
import { createNotification, NOTIFICATION_TYPES, NOTIFICATION_PRIORITY } from "./notificationService";
import { getAllValetCompaniesWithLocations } from "./valetCompanyLocationService";

// Export constants for use in hooks
export const DETECTION_RADIUS_METERS = 200 * 0.3048; // 200 feet = ~61 meters
export const NOTIFICATION_RADIUS_METERS = 50 * 0.3048; // 50 feet = ~15.24 meters
export const NORMAL_CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
export const NEARBY_CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds when near restaurant


/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Distance in meters
 */
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;

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

/**
 * Get all restaurants with valid coordinates
 * @returns {Promise<Array>} Array of restaurants with { id, name, lat, lng, imageURL, liveRating, companyId }
 */
export async function getAllRestaurants() {
  try {
    // Try both collection paths
    const restaurantsRef = collection(db, "restaurants");
    const restaurantsSnap = await getDocs(restaurantsRef);
    
    const restaurants = [];
    restaurantsSnap.forEach((doc) => {
      const data = doc.data();
      const lat = Number(data.lat);
      const lng = Number(data.lng);
      
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        restaurants.push({
          id: doc.id,
          name: data.name || doc.id,
          lat,
          lng,
          imageURL: data.imageURL || data.logoURL || data.logo,
          liveRating: typeof data.liveRating === "number" ? data.liveRating : null,
          companyId: data.companyId || null,
          isRestaurant: true,
          ...data,
        });
      }
    });

    // Also load valet company locations (for paid plans)
    const valetCompanies = await getAllValetCompaniesWithLocations();
    valetCompanies.forEach((company) => {
      company.locations.forEach((location) => {
        const lat = Number(location.lat);
        const lng = Number(location.lng);
        
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          restaurants.push({
            id: location.id,
            name: location.name,
            lat,
            lng,
            imageURL: company.logoURL || null,
            liveRating: null, // Valet locations don't have ratings
            companyId: null,
            isRestaurant: false,
            isValetLocation: true,
            valetCompanyId: company.id,
            valetCompanyName: company.name,
            locationType: location.type,
            restaurantId: location.restaurantId || null,
          });
        }
      });
    });

    return restaurants;
  } catch (error) {
    console.error("Error loading restaurants:", error);
    return [];
  }
}

/**
 * Find restaurants within detection radius
 * @param {number} userLat
 * @param {number} userLng
 * @param {Array} restaurants
 * @returns {Array} Array of nearby restaurants with distance
 */
export function findNearbyRestaurants(userLat, userLng, restaurants) {
  const nearby = [];

  for (const restaurant of restaurants) {
    const distance = haversineMeters(
      userLat,
      userLng,
      restaurant.lat,
      restaurant.lng
    );

    if (distance <= DETECTION_RADIUS_METERS) {
      nearby.push({
        ...restaurant,
        distanceMeters: distance,
        distanceFeet: distance / 0.3048,
      });
    }
  }

  // Sort by distance (closest first)
  nearby.sort((a, b) => a.distanceMeters - b.distanceMeters);

  return nearby;
}

/**
 * Check if user has active reservation for a restaurant
 * @param {string} dinerId
 * @param {string} restaurantId
 * @returns {Promise<Object|null>} Reservation object or null
 */
export async function checkActiveReservation(dinerId, restaurantId) {
  try {
    const reservations = await getCurrentDinerReservationsFromLedger(dinerId);
    
    // Filter for today's reservations at this restaurant
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const activeReservation = reservations.find((r) => {
      if (r.restaurantId !== restaurantId) return false;
      
      const startAt = r.startAtTimestamp?.toDate?.() || new Date(r.startAt);
      return startAt >= today && startAt < tomorrow && 
             r.status !== "CANCELLED" && 
             r.status !== "COMPLETED" &&
             r.status !== "NO_SHOW";
    });

    return activeReservation || null;
  } catch (error) {
    console.error("Error checking reservation:", error);
    return null;
  }
}

/**
 * Check if user is already on waiting list
 * @param {string} dinerId
 * @param {string} restaurantId
 * @returns {Promise<boolean>}
 */
export async function checkWaitingListStatus(dinerId, restaurantId) {
  try {
    const waitingListRef = collection(db, "restaurants", restaurantId, "waitingList");
    await getDocs(waitingListRef);
    
    // Check if any entry matches this diner
    // Note: waitingList entries may not have dinerId, so we'd need to check by phone/name
    // TODO: Implement actual checking logic
    return false;
    // For now, return false - can be enhanced later
    return false;
  } catch (error) {
    console.error("Error checking waiting list:", error);
    return false;
  }
}

/**
 * Trigger arrival notification
 * @param {string} dinerId
 * @param {Array} nearbyRestaurants - Array of nearby restaurants
 * @param {Object} userLocation - { lat, lng }
 */
export async function triggerArrivalNotification(dinerId, nearbyRestaurants, userLocation) {
  try {
    // Check for active reservations
    const restaurantsWithReservations = [];
    const restaurantsWithoutReservations = [];

    for (const restaurant of nearbyRestaurants) {
      // Only check restaurants within notification radius (50 feet)
      if (restaurant.distanceMeters > NOTIFICATION_RADIUS_METERS) {
        continue;
      }

      const reservation = await checkActiveReservation(dinerId, restaurant.id);
      
      if (reservation) {
        restaurantsWithReservations.push({
          restaurant,
          reservation,
        });
      } else {
        const onWaitingList = await checkWaitingListStatus(dinerId, restaurant.id);
        if (!onWaitingList) {
          restaurantsWithoutReservations.push(restaurant);
        }
      }
    }

    // If user has reservation(s), show check-in prompt
    if (restaurantsWithReservations.length > 0) {
      const primary = restaurantsWithReservations[0];
      const reservation = primary.reservation;
      const restaurant = primary.restaurant;

      // Format reservation time
      const startAt = reservation.startAtTimestamp?.toDate?.() || new Date(reservation.startAt);
      const timeStr = startAt.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });

      await createNotification({
        userId: dinerId,
        restaurantId: restaurant.id,
        companyId: restaurant.companyId,
        type: NOTIFICATION_TYPES.RESERVATION,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title: "Ready to check in?",
        message: `You're here! Check in for your ${timeStr} reservation at ${restaurant.name}.`,
        actionUrl: `/arrival/checkin?restaurantId=${restaurant.id}&reservationId=${reservation.id}`,
        metadata: {
          arrivalType: "reservation_checkin",
          restaurantId: restaurant.id,
          reservationId: reservation.id,
          restaurantName: restaurant.name,
          reservationTime: timeStr,
        },
      });
    }
    // If no reservation but nearby restaurants, show waiting list option
    else if (restaurantsWithoutReservations.length > 0) {
      // If multiple restaurants, show selection
      if (restaurantsWithoutReservations.length > 1) {
        await createNotification({
          userId: dinerId,
          type: NOTIFICATION_TYPES.RESERVATION,
          priority: NOTIFICATION_PRIORITY.HIGH,
          title: "Restaurants nearby",
          message: `You're near ${restaurantsWithoutReservations.length} restaurants. Would you like to join a waiting list?`,
          actionUrl: `/arrival/select?restaurants=${restaurantsWithoutReservations.map(r => r.id).join(",")}`,
          metadata: {
            arrivalType: "restaurant_selection",
            restaurants: restaurantsWithoutReservations.map(r => ({
              id: r.id,
              name: r.name,
              imageURL: r.imageURL,
              liveRating: r.liveRating,
            })),
          },
        });
      }
      // Single restaurant, show direct waiting list prompt
      else {
        const restaurant = restaurantsWithoutReservations[0];
        await createNotification({
          userId: dinerId,
          restaurantId: restaurant.id,
          companyId: restaurant.companyId,
          type: NOTIFICATION_TYPES.RESERVATION,
          priority: NOTIFICATION_PRIORITY.HIGH,
          title: "Join the waiting list?",
          message: `You're at ${restaurant.name}. Would you like to join the waiting list?`,
          actionUrl: `/arrival/waitinglist?restaurantId=${restaurant.id}`,
          metadata: {
            arrivalType: "waiting_list_prompt",
            restaurantId: restaurant.id,
            restaurantName: restaurant.name,
          },
        });
      }
    }
  } catch (error) {
    console.error("Error triggering arrival notification:", error);
  }
}

/**
 * Get current user location
 * @returns {Promise<Object|null>} { lat, lng } or null
 */
export function getCurrentLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.warn("Error getting location:", error);
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5 * 60 * 1000, // 5 minutes
        timeout: 10000,
      }
    );
  });
}

