// src/utils/favoritesService.js
//
// FAVORITES & FOLLOWERS SERVICE
//
// Handles favorites/following relationships
// - Diners can favorite restaurants, staff, and drivers
// - When you favorite a restaurant, you become a follower
// - Employees and drivers can be followed when in work mode
// - Employees and drivers can follow others when in diner mode

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../hooks/services/firebase";

/**
 * Favorite a restaurant, staff member, or driver
 * 
 * @param {string} dinerId - User ID of the person doing the favoriting
 * @param {string} targetId - ID of restaurant/staff/driver being favorited
 * @param {string} targetType - "restaurant", "staff", or "driver"
 * @returns {Promise<void>}
 */
export async function favoriteUserOrRestaurant(dinerId, targetId, targetType) {
  try {
    if (!dinerId || !targetId || !targetType) {
      throw new Error("Missing required parameters");
    }

    const favoriteRef = doc(
      db,
      "users",
      dinerId,
      "favorites",
      `${targetType}_${targetId}`
    );

    await setDoc(favoriteRef, {
      targetId,
      targetType,
      favoritedAt: serverTimestamp(),
    });

    // If it's a restaurant, also add to followers
    if (targetType === "restaurant") {
      const followerRef = doc(
        db,
        "restaurants",
        targetId,
        "followers",
        dinerId
      );
      await setDoc(followerRef, {
        userId: dinerId,
        followedAt: serverTimestamp(),
      });
    }

    // If it's a staff or driver, add to their followers
    if (targetType === "staff" || targetType === "driver") {
      const followerRef = doc(
        db,
        "users",
        targetId,
        "followers",
        dinerId
      );
      await setDoc(followerRef, {
        userId: dinerId,
        followedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error("Error favoriting:", error);
    throw error;
  }
}

/**
 * Unfavorite a restaurant, staff member, or driver
 * 
 * @param {string} dinerId - User ID of the person doing the unfavoriting
 * @param {string} targetId - ID of restaurant/staff/driver being unfavorited
 * @param {string} targetType - "restaurant", "staff", or "driver"
 * @returns {Promise<void>}
 */
export async function unfavoriteUserOrRestaurant(dinerId, targetId, targetType) {
  try {
    const favoriteRef = doc(
      db,
      "users",
      dinerId,
      "favorites",
      `${targetType}_${targetId}`
    );
    await deleteDoc(favoriteRef);

    // Remove from followers
    if (targetType === "restaurant") {
      const followerRef = doc(
        db,
        "restaurants",
        targetId,
        "followers",
        dinerId
      );
      await deleteDoc(followerRef);
    }

    if (targetType === "staff" || targetType === "driver") {
      const followerRef = doc(
        db,
        "users",
        targetId,
        "followers",
        dinerId
      );
      await deleteDoc(followerRef);
    }
  } catch (error) {
    console.error("Error unfavoriting:", error);
    throw error;
  }
}

/**
 * Check if a user/restaurant is favorited
 * 
 * @param {string} dinerId - User ID checking
 * @param {string} targetId - ID of restaurant/staff/driver
 * @param {string} targetType - "restaurant", "staff", or "driver"
 * @returns {Promise<boolean>}
 */
export async function isFavorited(dinerId, targetId, targetType) {
  try {
    const favoriteRef = doc(
      db,
      "users",
      dinerId,
      "favorites",
      `${targetType}_${targetId}`
    );
    const favoriteSnap = await getDoc(favoriteRef);
    return favoriteSnap.exists();
  } catch (error) {
    console.error("Error checking favorite status:", error);
    return false;
  }
}

/**
 * Get all favorites for a user
 * 
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of favorites
 */
export async function getUserFavorites(userId) {
  try {
    const favoritesRef = collection(db, "users", userId, "favorites");
    const favoritesSnap = await getDocs(favoritesRef);
    return favoritesSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error getting favorites:", error);
    return [];
  }
}

/**
 * Get all followers for a user or restaurant
 * 
 * @param {string} targetId - User ID or restaurant ID
 * @param {string} targetType - "user" or "restaurant"
 * @returns {Promise<Array>} Array of followers
 */
export async function getFollowers(targetId, targetType) {
  try {
    let followersRef;
    if (targetType === "restaurant") {
      followersRef = collection(db, "restaurants", targetId, "followers");
    } else {
      followersRef = collection(db, "users", targetId, "followers");
    }

    const followersSnap = await getDocs(followersRef);
    return followersSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error getting followers:", error);
    return [];
  }
}

/**
 * Get follower count for a user or restaurant
 * 
 * @param {string} targetId - User ID or restaurant ID
 * @param {string} targetType - "user" or "restaurant"
 * @returns {Promise<number>} Follower count
 */
export async function getFollowerCount(targetId, targetType) {
  try {
    const followers = await getFollowers(targetId, targetType);
    return followers.length;
  } catch (error) {
    console.error("Error getting follower count:", error);
    return 0;
  }
}








