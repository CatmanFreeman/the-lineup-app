// src/utils/employeeBlastService.js
//
// EMPLOYEE BLAST SERVICE
//
// Handles employee "going to work" notifications
// - Text blasts: "Hey guys, I'm going to work. I'm signing in at work tonight. Come see me."
// - Video blasts: 15-second video recorded by employee
// - Sent to all followers when employee punches in
// - Shareable on Facebook, Instagram, TikTok

import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db } from "../hooks/services/firebase";
import { getFollowers } from "./favoritesService";
import { createNotification, NOTIFICATION_TYPES, NOTIFICATION_PRIORITY } from "./notificationService";

/**
 * Create and send an employee blast
 * 
 * @param {Object} params
 * @param {string} params.employeeId - Employee user ID
 * @param {string} params.restaurantId - Restaurant ID
 * @param {string} params.blastType - "text" or "video"
 * @param {string} params.textContent - Text content (if text blast)
 * @param {File} params.videoFile - Video file (if video blast, max 15 seconds)
 * @returns {Promise<string>} Blast ID
 */
export async function createEmployeeBlast({
  employeeId,
  restaurantId,
  blastType,
  textContent = null,
  videoFile = null,
}) {
  try {
    if (!employeeId || !restaurantId || !blastType) {
      throw new Error("Missing required parameters");
    }

    if (blastType === "text" && !textContent) {
      throw new Error("Text content required for text blast");
    }

    if (blastType === "video" && !videoFile) {
      throw new Error("Video file required for video blast");
    }

    // Validate video duration (15 seconds max)
    if (blastType === "video" && videoFile) {
      const video = document.createElement("video");
      video.preload = "metadata";
      const duration = await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          window.URL.revokeObjectURL(video.src);
          resolve(video.duration);
        };
        video.src = URL.createObjectURL(videoFile);
      });

      if (duration > 15) {
        throw new Error("Video must be 15 seconds or less");
      }
    }

    // Upload video if provided
    let videoUrl = null;
    if (blastType === "video" && videoFile) {
      const storage = getStorage();
      const videoRef = ref(storage, `employeeBlasts/${employeeId}/${Date.now()}_${videoFile.name}`);
      await uploadBytes(videoRef, videoFile);
      videoUrl = await getDownloadURL(videoRef);
    }

    // Create blast document
    const blastRef = doc(collection(db, "employeeBlasts"));
    const blastId = blastRef.id;

    await setDoc(blastRef, {
      id: blastId,
      employeeId,
      restaurantId,
      blastType,
      textContent: textContent?.trim() || null,
      videoUrl,
      createdAt: serverTimestamp(),
      likes: 0,
      shares: {
        facebook: 0,
        instagram: 0,
        tiktok: 0,
      },
    });

    // Get all followers
    const followers = await getFollowers(employeeId, "user");

    // Send notifications to all followers
    for (const follower of followers) {
      await createNotification({
        userId: follower.userId,
        restaurantId,
        type: NOTIFICATION_TYPES.EMPLOYEE_BLAST,
        priority: NOTIFICATION_PRIORITY.MEDIUM,
        title: "Your favorite staff member is working!",
        message: blastType === "text" 
          ? textContent 
          : "Check out their video!",
        actionUrl: `/feed/blast/${blastId}`,
        metadata: {
          blastId,
          employeeId,
          blastType,
        },
      });
    }

    return blastId;
  } catch (error) {
    console.error("Error creating employee blast:", error);
    throw error;
  }
}

/**
 * Get employee blasts for a restaurant
 * 
 * @param {string} restaurantId - Restaurant ID
 * @param {number} limit - Number of blasts to return
 * @returns {Promise<Array>} Array of blasts
 */
export async function getEmployeeBlasts(restaurantId, limit = 20) {
  try {
    const blastsRef = collection(db, "employeeBlasts");
    const blastsQuery = query(
      blastsRef,
      where("restaurantId", "==", restaurantId),
      orderBy("createdAt", "desc"),
      limit(limit)
    );
    const blastsSnap = await getDocs(blastsQuery);

    return blastsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error getting employee blasts:", error);
    return [];
  }
}

/**
 * Get employee blasts for followers feed
 * 
 * @param {string} userId - User ID (follower)
 * @param {number} limit - Number of blasts to return
 * @returns {Promise<Array>} Array of blasts from followed employees
 */
export async function getFollowedEmployeeBlasts(userId, limit = 20) {
  try {
    // Get all users this person follows
    const { getUserFavorites } = await import("./favoritesService");
    const favorites = await getUserFavorites(userId);
    const followedStaffIds = favorites
      .filter((fav) => fav.targetType === "staff" || fav.targetType === "driver")
      .map((fav) => fav.targetId);

    if (followedStaffIds.length === 0) {
      return [];
    }

    // Get blasts from followed employees
    const blastsRef = collection(db, "employeeBlasts");
    const blastsQuery = query(
      blastsRef,
      where("employeeId", "in", followedStaffIds.slice(0, 10)), // Firestore "in" limit is 10
      orderBy("createdAt", "desc"),
      limit(limit)
    );
    const blastsSnap = await getDocs(blastsQuery);

    return blastsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error getting followed employee blasts:", error);
    return [];
  }
}

/**
 * Like an employee blast
 * 
 * @param {string} blastId - Blast ID
 * @param {string} userId - User ID who liked
 * @returns {Promise<void>}
 */
export async function likeEmployeeBlast(blastId, userId) {
  try {
    const blastRef = doc(db, "employeeBlasts", blastId);
    const blastSnap = await getDoc(blastRef);

    if (!blastSnap.exists()) {
      throw new Error("Blast not found");
    }

    const blastData = blastSnap.data();
    const currentLikes = blastData.likes || 0;

    // Check if user already liked (would need a likes subcollection in production)
    await updateDoc(blastRef, {
      likes: currentLikes + 1,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error liking blast:", error);
    throw error;
  }
}

