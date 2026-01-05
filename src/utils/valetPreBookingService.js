// src/utils/valetPreBookingService.js
//
// VALET PRE-BOOKING SERVICE
//
// Allows diners to pre-book valet service before arriving
// - Collects car information (license plate, make, model, color)
// - Creates advance notification for valet company
// - No payment exchange (valet company handles payment)
// - Provides VIP service (valet knows guest name and car before arrival)

import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../hooks/services/firebase";
import { createNotification, NOTIFICATION_TYPES, NOTIFICATION_PRIORITY } from "./notificationService";
import { getAuthorizedValetCompanies } from "./valetCompanyService";
import { getAllValetCompaniesWithLocations } from "./valetCompanyLocationService";
import { processValetPayment, PLATFORM_FEE_PERCENTAGE } from "./stripeService";

/**
 * Valet Pre-Booking Status
 */
export const VALET_PRE_BOOKING_STATUS = {
  PENDING: "PENDING", // Pre-booked, car not arrived yet
  ARRIVED: "ARRIVED", // Car has arrived at restaurant
  ACTIVE: "ACTIVE", // Valet service in progress
  COMPLETED: "COMPLETED", // Service completed
  CANCELLED: "CANCELLED", // Cancelled by diner or valet company
};

/**
 * Create valet pre-booking with payment
 * 
 * @param {Object} params
 * @param {string} params.dinerId - Diner user ID
 * @param {string} params.restaurantId - Restaurant ID (optional if locationId provided)
 * @param {string} params.locationId - Valet company location ID (optional, for non-restaurant locations)
 * @param {string} params.valetCompanyId - Valet company ID (optional, can be auto-assigned)
 * @param {string} params.dinerName - Diner name
 * @param {string} params.dinerPhone - Diner phone
 * @param {string} params.dinerEmail - Diner email (optional)
 * @param {Object} params.carInfo - Car information
 * @param {string} params.carInfo.licensePlate - License plate number
 * @param {string} params.carInfo.make - Car make (e.g., "Toyota")
 * @param {string} params.carInfo.model - Car model (e.g., "Camry")
 * @param {string} params.carInfo.color - Car color
 * @param {string} params.estimatedArrival - Estimated arrival time (ISO string)
 * @param {string} params.paymentMethodId - Stripe payment method ID (required)
 * @param {number} params.amount - Payment amount (default $6.00)
 * @param {Object} params.paymentInfo - Payment card information (for company records)
 * @returns {Promise<Object>} Pre-booking result with ID and payment info
 */
export async function createValetPreBooking({
  dinerId,
  restaurantId = null,
  locationId = null,
  valetCompanyId = null,
  dinerName,
  dinerPhone,
  dinerEmail = null,
  carInfo,
  estimatedArrival,
  paymentMethodId,
  amount = 6.00,
  paymentInfo = null,
}) {
  try {
    if (!dinerId || (!restaurantId && !locationId) || !dinerName || !carInfo || !estimatedArrival || !paymentMethodId) {
      throw new Error("Missing required fields: dinerId, restaurantId/locationId, dinerName, carInfo, estimatedArrival, paymentMethodId");
    }

    // If locationId provided, extract valetCompanyId from location
    if (locationId && !valetCompanyId) {
      const companies = await getAllValetCompaniesWithLocations();
      for (const company of companies) {
        const location = company.locations.find((loc) => loc.id === locationId);
        if (location) {
          valetCompanyId = company.id;
          // If location is a restaurant, set restaurantId
          if (location.restaurantId) {
            restaurantId = location.restaurantId;
          }
          break;
        }
      }
      if (!valetCompanyId) {
        throw new Error("Location not found");
      }
    }

    // If valet company not specified and restaurantId provided, get first authorized company
    if (!valetCompanyId && restaurantId) {
      const authorizedCompanies = await getAuthorizedValetCompanies(restaurantId);
      if (authorizedCompanies.length === 0) {
        throw new Error("No valet companies authorized for this restaurant");
      }
      valetCompanyId = authorizedCompanies[0].id;
    }

    // Process payment first ($6 total: $1 platform fee, $5 to valet company)
    const paymentResult = await processValetPayment({
      userId: dinerId,
      valetCompanyId,
      locationId,
      restaurantId,
      amount: amount,
      paymentMethodId,
      description: `Valet service pre-booking - ${restaurantId ? "Restaurant" : "Location"}`,
    });

    // Determine collection path - store in BOTH restaurant and valet company for easy lookup
    const isRestaurantLocation = !!restaurantId;
    
    // Store in valet company's pre-bookings (primary)
    const companyPreBookingRef = doc(collection(db, "valetCompanies", valetCompanyId, "valetPreBookings"));
    
    const preBookingData = {
      id: companyPreBookingRef.id,
      dinerId,
      restaurantId: restaurantId || null,
      locationId: locationId || null,
      valetCompanyId,
      dinerName,
      dinerPhone,
      dinerEmail: dinerEmail || null,
      carInfo: {
        licensePlate: carInfo.licensePlate?.toUpperCase().trim() || "",
        make: carInfo.make?.trim() || "",
        model: carInfo.model?.trim() || "",
        color: carInfo.color?.trim() || "",
      },
      estimatedArrival: Timestamp.fromDate(new Date(estimatedArrival)),
      payment: {
        transactionId: paymentResult.transactionId,
        amount: paymentResult.amount,
        platformFee: paymentResult.platformFee,
        valetCompanyAmount: paymentResult.valetCompanyAmount,
        paymentMethodId,
        paymentInfo: paymentInfo || null, // Card info for company records
        status: paymentResult.status,
        paidAt: serverTimestamp(),
      },
      status: VALET_PRE_BOOKING_STATUS.PENDING,
      arrivedAt: null,
      completedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(companyPreBookingRef, preBookingData);

    // Also store in restaurant's pre-bookings for restaurant-side lookup
    if (restaurantId) {
      const restaurantPreBookingRef = doc(collection(db, "restaurants", restaurantId, "valetPreBookings"), companyPreBookingRef.id);
      await setDoc(restaurantPreBookingRef, {
        ...preBookingData,
        id: companyPreBookingRef.id,
      });
    }

    // Notify valet company admin first, then company notifies drivers
    await notifyValetCompanyIncomingCar({
      valetCompanyId,
      restaurantId,
      locationId,
      preBookingId: companyPreBookingRef.id,
      dinerName,
      dinerPhone,
      dinerEmail,
      carInfo,
      estimatedArrival,
      paymentInfo: paymentInfo || null,
    });

    return {
      preBookingId: companyPreBookingRef.id,
      payment: paymentResult,
    };
  } catch (error) {
    console.error("Error creating valet pre-booking:", error);
    throw error;
  }
}

/**
 * Get active pre-bookings for a restaurant
 * 
 * @param {string} restaurantId
 * @returns {Promise<Array>} Array of active pre-bookings
 */
export async function getActivePreBookings(restaurantId) {
  try {
    const preBookingRef = collection(db, "restaurants", restaurantId, "valetPreBookings");
    const q = query(
      preBookingRef,
      where("status", "in", [
        VALET_PRE_BOOKING_STATUS.PENDING,
        VALET_PRE_BOOKING_STATUS.ARRIVED,
        VALET_PRE_BOOKING_STATUS.ACTIVE,
      ])
    );
    const snap = await getDocs(q);

    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
  } catch (error) {
    console.error("Error getting active pre-bookings:", error);
    return [];
  }
}

/**
 * Get upcoming pre-bookings for a location (next arrivals)
 * 
 * @param {string} valetCompanyId - Valet company ID
 * @param {string} restaurantId - Restaurant ID (optional)
 * @param {string} locationId - Location ID (optional)
 * @param {number} limit - Number of upcoming bookings to return (default 3)
 * @returns {Promise<Array>} Array of upcoming pre-bookings sorted by estimated arrival
 */
export async function getUpcomingPreBookingsForLocation(valetCompanyId, restaurantId = null, locationId = null, limit = 3) {
  try {
    const preBookingRef = collection(db, "valetCompanies", valetCompanyId, "valetPreBookings");
    
    let q;
    if (restaurantId) {
      q = query(
        preBookingRef,
        where("restaurantId", "==", restaurantId),
        where("status", "==", VALET_PRE_BOOKING_STATUS.PENDING),
        orderBy("estimatedArrival", "asc")
      );
    } else if (locationId) {
      q = query(
        preBookingRef,
        where("locationId", "==", locationId),
        where("status", "==", VALET_PRE_BOOKING_STATUS.PENDING),
        orderBy("estimatedArrival", "asc")
      );
    } else {
      // Get all pending bookings for the company
      q = query(
        preBookingRef,
        where("status", "==", VALET_PRE_BOOKING_STATUS.PENDING),
        orderBy("estimatedArrival", "asc")
      );
    }
    
    const snap = await getDocs(q);
    const bookings = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    // Filter to only future arrivals and sort
    const now = new Date();
    const upcoming = bookings
      .filter((booking) => {
        const arrivalTime = booking.estimatedArrival?.toDate 
          ? booking.estimatedArrival.toDate() 
          : new Date(booking.estimatedArrival);
        return arrivalTime >= now;
      })
      .sort((a, b) => {
        const timeA = a.estimatedArrival?.toDate 
          ? a.estimatedArrival.toDate() 
          : new Date(a.estimatedArrival);
        const timeB = b.estimatedArrival?.toDate 
          ? b.estimatedArrival.toDate() 
          : new Date(b.estimatedArrival);
        return timeA - timeB;
      })
      .slice(0, limit);

    return upcoming;
  } catch (error) {
    console.error("Error getting upcoming pre-bookings for location:", error);
    return [];
  }
}

/**
 * Get active pre-bookings for a valet company
 * 
 * @param {string} valetCompanyId
 * @returns {Promise<Array>} Array of active pre-bookings
 */
export async function getValetCompanyPreBookings(valetCompanyId) {
  try {
    const preBookingRef = collection(db, "valetCompanies", valetCompanyId, "valetPreBookings");
    const q = query(
      preBookingRef,
      where("status", "in", [
        VALET_PRE_BOOKING_STATUS.PENDING,
        VALET_PRE_BOOKING_STATUS.ARRIVED,
        VALET_PRE_BOOKING_STATUS.ACTIVE,
      ]),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);

    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
  } catch (error) {
    console.error("Error getting valet company pre-bookings:", error);
    return [];
  }
}

/**
 * Mark pre-booking as arrived
 * 
 * @param {string} restaurantId
 * @param {string} preBookingId
 * @returns {Promise<void>}
 */
export async function markPreBookingArrived(restaurantId, preBookingId) {
  try {
    const preBookingRef = doc(db, "restaurants", restaurantId, "valetPreBookings", preBookingId);
    await updateDoc(preBookingRef, {
      status: VALET_PRE_BOOKING_STATUS.ARRIVED,
      arrivedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Convert to active valet ticket
    const preBookingSnap = await getDoc(preBookingRef);
    if (preBookingSnap.exists()) {
      const preBookingData = preBookingSnap.data();
      
      // Create valet ticket entry
      const { createValetEntryOnCheckIn } = await import("./valetService");
      await createValetEntryOnCheckIn({
        restaurantId,
        reservationId: null, // Pre-booking may not have reservation
        dinerId: preBookingData.dinerId,
        dinerName: preBookingData.dinerName,
        dinerPhone: preBookingData.dinerPhone,
      });

      // Update pre-booking status
      await updateDoc(preBookingRef, {
        status: VALET_PRE_BOOKING_STATUS.ACTIVE,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error("Error marking pre-booking as arrived:", error);
    throw error;
  }
}

/**
 * Notify valet company about incoming car (with payment already processed)
 * Company then notifies drivers at the specific location
 */
async function notifyValetCompanyIncomingCar({
  valetCompanyId,
  restaurantId,
  locationId,
  preBookingId,
  dinerName,
  dinerPhone,
  dinerEmail,
  carInfo,
  estimatedArrival,
  paymentInfo,
}) {
  try {
    // Get valet company admin and drivers
    const companyRef = doc(db, "valetCompanies", valetCompanyId);
    const companySnap = await getDoc(companyRef);
    
    if (!companySnap.exists()) return;

    const companyData = companySnap.data();
    const drivers = companyData.drivers || [];
    const adminUserId = companyData.adminUserId;

    // Get restaurant name
    const restaurantRef = doc(db, "restaurants", restaurantId);
    const restaurantSnap = await getDoc(restaurantRef);
    const restaurantName = restaurantSnap.exists() 
      ? restaurantSnap.data().name || "the restaurant"
      : "the restaurant";

    // Format estimated arrival time
    const arrivalTime = new Date(estimatedArrival);
    const timeStr = arrivalTime.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    // Get location info for driver assignment
    let locationName = restaurantName;
    if (locationId) {
      const companyData = companySnap.data();
      const locations = companyData.locations || [];
      const location = locations.find(loc => loc.id === locationId);
      if (location) {
        locationName = location.name;
      }
    }

    // Get payment amount from pre-booking data
    const preBookingRef = doc(db, "valetCompanies", valetCompanyId, "valetPreBookings", preBookingId);
    const preBookingSnap = await getDoc(preBookingRef);
    const paymentAmount = preBookingSnap.exists() && preBookingSnap.data().payment 
      ? preBookingSnap.data().payment.amount 
      : 6.00;

    // Notify company admin (receives payment info and diner details)
    if (adminUserId) {
      await createNotification({
        userId: adminUserId,
        restaurantId,
        companyId: valetCompanyId,
        type: NOTIFICATION_TYPES.VALET_INCOMING_CAR,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title: "New Valet Pre-Booking - Payment Received",
        message: `${dinerName} pre-booked valet at ${locationName} (ETA: ${timeStr}). Car: ${carInfo.licensePlate} - ${carInfo.color} ${carInfo.make} ${carInfo.model}. Payment: $${paymentAmount.toFixed(2)} received.`,
        actionUrl: `/dashboard/valet-company/${valetCompanyId}?tab=pre-bookings&preBooking=${preBookingId}`,
        metadata: {
          preBookingId,
          restaurantId,
          locationId,
          dinerName,
          dinerPhone,
          dinerEmail,
          carInfo,
          estimatedArrival: arrivalTime.toISOString(),
          paymentInfo: paymentInfo || null,
          amount: paymentAmount,
        },
      });
    }

    // Company notifies drivers at the specific location
    // Get drivers for this specific location (not all company drivers)
    const locationDriversRef = collection(db, "valetCompanies", valetCompanyId, "locations", locationId || "default", "drivers");
    const locationDriversSnap = await getDocs(locationDriversRef);
    
    const locationDriverIds = [];
    locationDriversSnap.forEach((driverDoc) => {
      const driverData = driverDoc.data();
      if (driverData.userId && driverData.status === "ACTIVE") {
        locationDriverIds.push(driverData.userId);
      }
    });

    // If no location-specific drivers, fall back to restaurant-assigned drivers
    if (locationDriverIds.length === 0 && restaurantId) {
      const usersRef = collection(db, "users");
      const driversQuery = query(
        usersRef,
        where("role", "==", "VALET"),
        where("valetCompanyId", "==", valetCompanyId),
        where("restaurantId", "==", restaurantId),
        where("status", "==", "ACTIVE")
      );
      const driversSnap = await getDocs(driversQuery);
      driversSnap.forEach((driverDoc) => {
        locationDriverIds.push(driverDoc.id);
      });
    }

    // Notify all drivers at this location
    for (const driverId of locationDriverIds) {
      await createNotification({
        userId: driverId,
        restaurantId,
        companyId: valetCompanyId,
        type: NOTIFICATION_TYPES.VALET_INCOMING_CAR,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title: "Incoming Car - Pre-Booked",
        message: `${dinerName} - ${carInfo.licensePlate} (ETA: ${timeStr}). Payment already received.`,
        actionUrl: `/dashboard/valet/${restaurantId || locationId}?preBooking=${preBookingId}`,
        metadata: {
          preBookingId,
          restaurantId,
          locationId,
          dinerName,
          dinerPhone,
          carInfo,
          estimatedArrival: arrivalTime.toISOString(),
          paymentReceived: true,
        },
      });
    }
  } catch (error) {
    console.error("Error notifying valet company:", error);
  }
}

/**
 * Get all valet pre-bookings for a diner
 * 
 * @param {string} dinerId - Diner user ID
 * @returns {Promise<Array>} Array of valet pre-bookings
 */
export async function getDinerValetPreBookings(dinerId) {
  try {
    if (!dinerId) {
      return [];
    }

    const allPreBookings = [];

    // Query all valet companies for this diner's pre-bookings
    const valetCompaniesRef = collection(db, "valetCompanies");
    const valetCompaniesSnap = await getDocs(valetCompaniesRef);

    for (const companyDoc of valetCompaniesSnap.docs) {
      const valetCompanyId = companyDoc.id;
      const companyData = companyDoc.data();
      
      try {
        const preBookingsRef = collection(db, "valetCompanies", valetCompanyId, "valetPreBookings");
        const preBookingsQuery = query(
          preBookingsRef,
          where("dinerId", "==", dinerId),
          orderBy("createdAt", "desc")
        );
        const preBookingsSnap = await getDocs(preBookingsQuery);
        
        preBookingsSnap.docs.forEach((doc) => {
          const data = doc.data();
          allPreBookings.push({
            id: doc.id,
            valetCompanyId,
            valetCompanyName: companyData.name || valetCompanyId,
            restaurantId: data.restaurantId || null,
            locationId: data.locationId || null,
            ...data,
          });
        });
      } catch (error) {
        // Skip companies without proper indexes
        console.warn(`Could not query valet pre-bookings for company ${valetCompanyId}:`, error);
      }
    }

    // Also check restaurant-level pre-bookings (backup)
    try {
      const restaurantsRef = collection(db, "restaurants");
      const restaurantsSnap = await getDocs(restaurantsRef);

      for (const restaurantDoc of restaurantsSnap.docs) {
        const restaurantId = restaurantDoc.id;
        const restaurantData = restaurantDoc.data();
        
        try {
          const preBookingsRef = collection(db, "restaurants", restaurantId, "valetPreBookings");
          const preBookingsQuery = query(
            preBookingsRef,
            where("dinerId", "==", dinerId),
            orderBy("createdAt", "desc")
          );
          const preBookingsSnap = await getDocs(preBookingsQuery);
          
          preBookingsSnap.docs.forEach((doc) => {
            const data = doc.data();
            // Only add if not already in allPreBookings (avoid duplicates)
            const exists = allPreBookings.find(pb => pb.id === doc.id);
            if (!exists) {
              allPreBookings.push({
                id: doc.id,
                restaurantId,
                restaurantName: restaurantData.name || restaurantId,
                valetCompanyId: data.valetCompanyId || null,
                ...data,
              });
            }
          });
        } catch (error) {
          // Skip restaurants without proper indexes
          console.warn(`Could not query valet pre-bookings for restaurant ${restaurantId}:`, error);
        }
      }
    } catch (error) {
      console.warn("Error querying restaurant-level valet pre-bookings:", error);
    }

    // Sort by createdAt descending
    allPreBookings.sort((a, b) => {
      const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
      const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
      return bTime - aTime;
    });

    return allPreBookings;
  } catch (error) {
    console.error("Error getting diner valet pre-bookings:", error);
    return [];
  }
}

/**
 * Get nearby restaurants for valet pre-booking
 * 
 * @param {number} userLat
 * @param {number} userLng
 * @param {number} radiusMiles - Search radius in miles
 * @returns {Promise<Array>} Array of nearby restaurants with valet service
 */
export async function getNearbyRestaurantsWithValet(userLat, userLng, radiusMiles = 5) {
  try {
    const { getAllRestaurants } = await import("./arrivalDetectionService");
    const restaurants = await getAllRestaurants();
    
    // Filter restaurants with authorized valet companies
    const restaurantsWithValet = [];
    
    for (const restaurant of restaurants) {
      const authorizedCompanies = await getAuthorizedValetCompanies(restaurant.id);
      if (authorizedCompanies.length > 0) {
        // Calculate distance
        const distance = haversineMiles(
          userLat,
          userLng,
          restaurant.lat,
          restaurant.lng
        );
        
        if (distance <= radiusMiles) {
          restaurantsWithValet.push({
            ...restaurant,
            distanceMiles: distance,
            valetCompanies: authorizedCompanies,
          });
        }
      }
    }

    // Sort by distance
    restaurantsWithValet.sort((a, b) => a.distanceMiles - b.distanceMiles);

    return restaurantsWithValet;
  } catch (error) {
    console.error("Error getting nearby restaurants with valet:", error);
    return [];
  }
}

/**
 * Calculate distance in miles
 */
function haversineMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8; // Earth radius in miles
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

