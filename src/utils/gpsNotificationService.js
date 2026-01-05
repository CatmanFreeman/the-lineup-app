// src/utils/gpsNotificationService.js

import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../hooks/services/firebase";
import { createNotification } from "./notificationService";

/**
 * GPS Notification Service
 * 
 * Tracks when diners leave restaurants and triggers review prompts
 * - Monitors departure from restaurant geofence
 * - Sends notification 5 minutes after departure
 * - Creates in-app notification and push notification
 */

const DEPARTURE_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Track restaurant visit
 * @param {string} dinerId - Diner user ID
 * @param {string} restaurantId - Restaurant ID
 * @param {Date} arrivalTime - When diner arrived
 * @param {Date} departureTime - When diner left
 */
export async function trackRestaurantVisit({
  dinerId,
  restaurantId,
  arrivalTime,
  departureTime,
}) {
  try {
    const visitId = `${dinerId}_${restaurantId}_${departureTime.getTime()}`;
    const visitRef = doc(db, "restaurant_visits", visitId);

    await setDoc(visitRef, {
      dinerId,
      restaurantId,
      arrivalTime: serverTimestamp(),
      departureTime: serverTimestamp(),
      arrivalTimestamp: arrivalTime.getTime(),
      departureTimestamp: departureTime.getTime(),
      reviewPromptSent: false,
      reviewSubmitted: false,
      createdAt: serverTimestamp(),
    });

    // Schedule review prompt notification
    const promptTime = departureTime.getTime() + DEPARTURE_BUFFER_MS;
    const now = Date.now();

    if (promptTime > now) {
      // Schedule for future
      setTimeout(() => {
        sendReviewPrompt(dinerId, restaurantId, visitId);
      }, promptTime - now);
    } else {
      // Send immediately if already past the buffer time
      await sendReviewPrompt(dinerId, restaurantId, visitId);
    }

    return { visitId, success: true };
  } catch (error) {
    console.error("Error tracking restaurant visit:", error);
    throw error;
  }
}

/**
 * Send review prompt notification
 * @param {string} dinerId - Diner user ID
 * @param {string} restaurantId - Restaurant ID
 * @param {string} visitId - Visit ID
 */
async function sendReviewPrompt(dinerId, restaurantId, visitId) {
  try {
    // Check if review already submitted
    const visitRef = doc(db, "restaurant_visits", visitId);
    const visitSnap = await getDoc(visitRef);
    
    if (visitSnap.exists()) {
      const visitData = visitSnap.data();
      if (visitData.reviewSubmitted) {
        return; // Already reviewed, don't send prompt
      }
    }

    // Load restaurant name
    const restaurantRef = doc(db, "restaurants", restaurantId);
    const restaurantSnap = await getDoc(restaurantRef);
    const restaurantName = restaurantSnap.exists() 
      ? restaurantSnap.data().name || "the restaurant"
      : "the restaurant";

    // Create in-app notification
    await createNotification({
      userId: dinerId,
      type: "review_prompt",
      priority: "medium",
      title: "How was your experience?",
      message: `Share your thoughts about ${restaurantName} while it's fresh in your mind!`,
      data: {
        restaurantId,
        visitId,
        action: "review",
        actionUrl: `/review/${restaurantId}?visit=${visitId}`,
      },
    });

    // Mark prompt as sent
    await setDoc(
      visitRef,
      {
        reviewPromptSent: true,
        reviewPromptSentAt: serverTimestamp(),
      },
      { merge: true }
    );

    // TODO: Send push notification via Firebase Cloud Messaging
    // This would require FCM setup and device token registration

    return { success: true };
  } catch (error) {
    console.error("Error sending review prompt:", error);
    throw error;
  }
}

/**
 * Mark visit as reviewed
 * @param {string} visitId - Visit ID
 */
export async function markVisitAsReviewed(visitId) {
  try {
    const visitRef = doc(db, "restaurant_visits", visitId);
    await setDoc(
      visitRef,
      {
        reviewSubmitted: true,
        reviewSubmittedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error("Error marking visit as reviewed:", error);
    throw error;
  }
}

/**
 * Get pending review prompts for a diner
 * @param {string} dinerId - Diner user ID
 * @returns {Promise<Array>} Array of pending review prompts
 */
export async function getPendingReviewPrompts(dinerId) {
  try {
    // This would query restaurant_visits collection
    // For now, return empty array - can be enhanced with Firestore queries
    return [];
  } catch (error) {
    console.error("Error getting pending review prompts:", error);
    return [];
  }
}

