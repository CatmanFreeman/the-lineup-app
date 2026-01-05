// src/utils/favoriteReviewerService.js

import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../hooks/services/firebase";

/**
 * Favorite Reviewer Service
 * 
 * Allows diners to favorite reviewers whose reviews they like
 */

/**
 * Add a reviewer to favorites
 * @param {string} userId - Current user's ID
 * @param {string} reviewerId - Reviewer's user ID to favorite
 * @returns {Promise<boolean>} Success status
 */
export async function addFavoriteReviewer(userId, reviewerId) {
  try {
    if (!userId || !reviewerId) {
      throw new Error("User ID and Reviewer ID are required");
    }

    if (userId === reviewerId) {
      throw new Error("Cannot favorite yourself");
    }

    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.exists() ? userSnap.data() : {};

    const favoriteIds = userData.favoriteReviewers || [];

    if (favoriteIds.includes(reviewerId)) {
      return true; // Already favorited
    }

    const updatedFavorites = [...favoriteIds, reviewerId];

    await setDoc(
      userRef,
      {
        favoriteReviewers: updatedFavorites,
      },
      { merge: true }
    );

    return true;
  } catch (error) {
    console.error("Error adding favorite reviewer:", error);
    throw error;
  }
}

/**
 * Remove a reviewer from favorites
 * @param {string} userId - Current user's ID
 * @param {string} reviewerId - Reviewer's user ID to unfavorite
 * @returns {Promise<boolean>} Success status
 */
export async function removeFavoriteReviewer(userId, reviewerId) {
  try {
    if (!userId || !reviewerId) {
      throw new Error("User ID and Reviewer ID are required");
    }

    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.exists() ? userSnap.data() : {};

    const favoriteIds = userData.favoriteReviewers || [];
    const updatedFavorites = favoriteIds.filter((id) => id !== reviewerId);

    await setDoc(
      userRef,
      {
        favoriteReviewers: updatedFavorites,
      },
      { merge: true }
    );

    return true;
  } catch (error) {
    console.error("Error removing favorite reviewer:", error);
    throw error;
  }
}

/**
 * Check if a reviewer is favorited
 * @param {string} userId - Current user's ID
 * @param {string} reviewerId - Reviewer's user ID to check
 * @returns {Promise<boolean>} True if favorited
 */
export async function isReviewerFavorited(userId, reviewerId) {
  try {
    if (!userId || !reviewerId) {
      return false;
    }

    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return false;
    }

    const userData = userSnap.data();
    const favoriteIds = userData.favoriteReviewers || [];

    return favoriteIds.includes(reviewerId);
  } catch (error) {
    console.error("Error checking favorite reviewer:", error);
    return false;
  }
}

/**
 * Get all favorite reviewers for a user
 * @param {string} userId - Current user's ID
 * @returns {Promise<Array>} Array of reviewer user IDs
 */
export async function getFavoriteReviewers(userId) {
  try {
    if (!userId) {
      return [];
    }

    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return [];
    }

    const userData = userSnap.data();
    return userData.favoriteReviewers || [];
  } catch (error) {
    console.error("Error getting favorite reviewers:", error);
    return [];
  }
}

