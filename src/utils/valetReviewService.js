// src/utils/valetReviewService.js
//
// VALET REVIEW & CLAIMS SERVICE
//
// Handles valet reviews and claims
// - Reviews: Driver rating, company rating, review text
// - Claims: Triggered by low ratings (≤3), includes photos, video, detailed description

import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../hooks/services/firebase";
import { db } from "../hooks/services/firebase";
import { createNotification, NOTIFICATION_TYPES, NOTIFICATION_PRIORITY } from "./notificationService";

/**
 * Create valet review
 * 
 * @param {Object} params
 * @param {string} params.ticketId - Valet ticket ID
 * @param {string} params.restaurantId - Restaurant ID
 * @param {string} params.valetCompanyId - Valet company ID
 * @param {string} params.valetDriverId - Valet driver user ID
 * @param {string} params.dinerId - Diner user ID
 * @param {string} params.dinerName - Diner name
 * @param {number} params.driverRating - Driver rating (1-5)
 * @param {number} params.companyRating - Company rating (1-5)
 * @param {string} params.driverReviewText - Driver review text (200 words max, optional)
 * @param {string} params.companyReviewText - Company review text (200 words max, optional)
 * @returns {Promise<string>} Review ID
 */
export async function createValetReview({
  ticketId,
  restaurantId,
  valetCompanyId,
  valetDriverId,
  dinerId,
  dinerName,
  driverRating,
  companyRating,
  driverReviewText,
  companyReviewText,
}) {
  try {
    if (!ticketId || !restaurantId || !valetCompanyId || !valetDriverId || !dinerId) {
      throw new Error("Missing required fields");
    }

    if (driverRating < 1 || driverRating > 5 || companyRating < 1 || companyRating > 5) {
      throw new Error("Ratings must be between 1 and 5");
    }

    // Create review document
    const reviewRef = doc(collection(db, "valetReviews"));
    const reviewId = reviewRef.id;

    await setDoc(reviewRef, {
      id: reviewId,
      ticketId,
      restaurantId,
      valetCompanyId,
      valetDriverId,
      dinerId,
      dinerName,
      driverRating: Number(driverRating),
      companyRating: Number(companyRating),
      driverReviewText: driverReviewText?.trim() || null,
      companyReviewText: companyReviewText?.trim() || null,
      isPublic: true, // Reviews are public by default
      createdAt: serverTimestamp(),
    });

    // Update driver's average rating
    await updateDriverRating(valetDriverId, driverRating);

    // Update company's average rating
    await updateCompanyRating(valetCompanyId, companyRating);

    // Notify driver and company
    await createNotification({
      userId: valetDriverId,
      restaurantId,
      type: NOTIFICATION_TYPES.VALET_REVIEW,
      priority: NOTIFICATION_PRIORITY.LOW,
      title: "New Review",
      message: `You received a ${driverRating}-star review from ${dinerName}`,
      metadata: {
        reviewId,
        rating: driverRating,
      },
    });

    return reviewId;
  } catch (error) {
    console.error("Error creating valet review:", error);
    throw error;
  }
}

/**
 * Submit valet claim
 * 
 * @param {Object} params
 * @param {string} params.ticketId - Valet ticket ID
 * @param {string} params.restaurantId - Restaurant ID
 * @param {string} params.valetCompanyId - Valet company ID
 * @param {string} params.valetDriverId - Valet driver user ID
 * @param {string} params.dinerId - Diner user ID
 * @param {string} params.dinerName - Diner name
 * @param {number} params.driverRating - Driver rating (1-5)
 * @param {number} params.companyRating - Company rating (1-5)
 * @param {string} params.description - Detailed claim description (1000 words max)
 * @param {Array<string>} params.photos - Array of photo URLs (max 6)
 * @param {string} params.video - Video URL (optional, 45 seconds max)
 * @returns {Promise<string>} Claim ID
 */
export async function submitValetClaim({
  ticketId,
  restaurantId,
  valetCompanyId,
  valetDriverId,
  dinerId,
  dinerName,
  driverRating,
  companyRating,
  description,
  photos = [],
  video = null,
}) {
  try {
    if (!ticketId || !restaurantId || !valetCompanyId || !dinerId) {
      throw new Error("Missing required fields");
    }

    if (!description || description.trim().length < 50) {
      throw new Error("Claim description must be at least 50 characters");
    }

    if (photos.length > 6) {
      throw new Error("Maximum 6 photos allowed");
    }

    // Create claim document with claim number
    const claimRef = doc(collection(db, "valetCompanies", valetCompanyId, "claims"));
    const claimId = claimRef.id;
    
    // Generate claim number (format: VC-YYYYMMDD-XXXXX)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const randomSuffix = claimId.substring(0, 5).toUpperCase();
    const claimNumber = `VC-${year}${month}${day}-${randomSuffix}`;

    // Get driver info (name, phone) and car info from ticket
    let driverName = null;
    let driverPhone = null;
    let carInfo = null;
    
    try {
      // Get ticket data
      const ticketRef = doc(db, "restaurants", restaurantId, "valetTickets", ticketId);
      const ticketSnap = await getDoc(ticketRef);
      
      if (ticketSnap.exists()) {
        const ticketData = ticketSnap.data();
        
        // Get driver info
        if (valetDriverId) {
          const driverRef = doc(db, "users", valetDriverId);
          const driverSnap = await getDoc(driverRef);
          if (driverSnap.exists()) {
            const driverData = driverSnap.data();
            driverName = driverData.name || driverData.displayName || null;
            driverPhone = driverData.phone || null;
          }
        }
        
        // Get car info from ticket or pre-booking
        if (ticketData.carInfo) {
          carInfo = ticketData.carInfo;
        } else {
          // Try to get from pre-booking
          const preBookingRef = doc(db, "valetCompanies", valetCompanyId, "valetPreBookings", ticketId);
          const preBookingSnap = await getDoc(preBookingRef);
          if (preBookingSnap.exists()) {
            const preBookingData = preBookingSnap.data();
            carInfo = preBookingData.carInfo || null;
          }
        }
      }
    } catch (error) {
      console.warn("Error fetching driver/car info for claim:", error);
      // Continue without this info
    }

    await setDoc(claimRef, {
      id: claimId,
      claimNumber, // Assigned claim number
      ticketId,
      restaurantId,
      valetDriverId,
      dinerId,
      dinerName,
      driverRating: Number(driverRating),
      companyRating: Number(companyRating),
      description: description.trim(),
      photos: photos.slice(0, 6),
      video: video || null,
      driverInfo: {
        name: driverName,
        phone: driverPhone,
      },
      carInfo: carInfo || null,
      status: "PENDING", // PENDING, REVIEWING, RESOLVED, REJECTED
      submittedAt: serverTimestamp(),
      reviewedAt: null,
      resolvedAt: null,
      createdAt: serverTimestamp(),
    });

    // Also create a review (with lower rating) for public display
    await createValetReview({
      ticketId,
      restaurantId,
      valetCompanyId,
      valetDriverId,
      dinerId,
      dinerName,
      driverRating,
      companyRating,
      reviewText: null, // No public review text for claims
    });

    // Notify valet company admin immediately
    try {
      const companyRef = doc(db, "valetCompanies", valetCompanyId);
      const companySnap = await getDoc(companyRef);
      
      if (companySnap.exists()) {
        const companyData = companySnap.data();
        const adminUserId = companyData.adminUserId;
        
        if (adminUserId) {
          await createNotification({
            userId: adminUserId,
            restaurantId,
            companyId: valetCompanyId,
            type: NOTIFICATION_TYPES.VALET_CLAIM,
            priority: NOTIFICATION_PRIORITY.HIGH,
            title: "New Claim Submitted",
            message: `Claim ${claimNumber} has been submitted. Driver: ${driverName || "Unknown"}. Review immediately.`,
            actionUrl: `/dashboard/valet-company/${valetCompanyId}?tab=claims&claimId=${claimId}`,
            metadata: {
              claimId,
              claimNumber,
              valetCompanyId,
              ticketId,
              valetDriverId,
              dinerName,
            },
          });
        }
      }
    } catch (notifyError) {
      console.error("Error notifying valet company of claim:", notifyError);
      // Don't fail the claim submission if notification fails
    }

    return { claimId, claimNumber };
  } catch (error) {
    console.error("Error submitting valet claim:", error);
    throw error;
  }
}

/**
 * Update driver's average rating
 * 
 * @param {string} driverId - Driver user ID
 * @param {number} newRating - New rating to add
 */
async function updateDriverRating(driverId, newRating) {
  try {
    const driverRef = doc(db, "users", driverId);
    const driverSnap = await getDoc(driverRef);

    if (!driverSnap.exists()) {
      return;
    }

    const driverData = driverSnap.data();
    const currentAvg = driverData.valetAverageRating || 0;
    const reviewCount = driverData.valetReviewCount || 0;

    // Calculate new average
    const newAvg = ((currentAvg * reviewCount) + newRating) / (reviewCount + 1);

    await updateDoc(driverRef, {
      valetAverageRating: newAvg,
      valetReviewCount: reviewCount + 1,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating driver rating:", error);
    // Don't throw - rating update failure shouldn't block review creation
  }
}

/**
 * Update company's average rating
 * 
 * @param {string} companyId - Valet company ID
 * @param {number} newRating - New rating to add
 */
async function updateCompanyRating(companyId, newRating) {
  try {
    const companyRef = doc(db, "valetCompanies", companyId);
    const companySnap = await getDoc(companyRef);

    if (!companySnap.exists()) {
      return;
    }

    const companyData = companySnap.data();
    const currentAvg = companyData.averageRating || 0;
    const reviewCount = companyData.reviewCount || 0;

    // Calculate new average
    const newAvg = ((currentAvg * reviewCount) + newRating) / (reviewCount + 1);

    await updateDoc(companyRef, {
      averageRating: newAvg,
      reviewCount: reviewCount + 1,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating company rating:", error);
    // Don't throw - rating update failure shouldn't block review creation
  }
}

/**
 * Get valet company reviews (public)
 * 
 * @param {string} valetCompanyId - Valet company ID
 * @param {number} limit - Number of reviews to return
 * @returns {Promise<Array>} Array of reviews
 */
export async function getValetCompanyReviews(valetCompanyId, limit = 20) {
  try {
    const reviewsRef = collection(db, "valetReviews");
    const reviewsQuery = query(
      reviewsRef,
      where("valetCompanyId", "==", valetCompanyId),
      where("isPublic", "==", true),
      orderBy("createdAt", "desc"),
      limit(limit)
    );
    const reviewsSnap = await getDocs(reviewsQuery);

    return reviewsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error getting valet company reviews:", error);
    return [];
  }
}

