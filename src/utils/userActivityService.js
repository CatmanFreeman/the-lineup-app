// src/utils/userActivityService.js
//
// USER ACTIVITY SERVICE
//
// Tracks when users are active in the app
// Used to determine if motion detection should trigger restaurant prompts

import { doc, updateDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../hooks/services/firebase";

const RECENT_ACTIVITY_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Mark user as active (call this when user interacts with app)
 * 
 * @param {string} userId
 */
export async function markUserActive(userId) {
  try {
    if (!userId) return;

    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      lastActiveAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error marking user active:", error);
  }
}

/**
 * Check if user has been active recently
 * 
 * @param {string} userId
 * @param {number} thresholdMs - Time threshold in milliseconds (default: 10 minutes)
 * @returns {Promise<boolean>} True if user was active within threshold
 */
export async function isUserRecentlyActive(userId, thresholdMs = RECENT_ACTIVITY_THRESHOLD_MS) {
  try {
    if (!userId) return false;

    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) return false;

    const userData = userSnap.data();
    const lastActiveAt = userData.lastActiveAt;

    if (!lastActiveAt) return false;

    const lastActive = lastActiveAt.toDate ? lastActiveAt.toDate() : new Date(lastActiveAt);
    const now = new Date();
    const timeSinceActive = now - lastActive;

    return timeSinceActive <= thresholdMs;
  } catch (error) {
    console.error("Error checking user activity:", error);
    return false;
  }
}

/**
 * Get time since user was last active
 * 
 * @param {string} userId
 * @returns {Promise<number|null>} Milliseconds since last activity, or null if never active
 */
export async function getTimeSinceLastActive(userId) {
  try {
    if (!userId) return null;

    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) return null;

    const userData = userSnap.data();
    const lastActiveAt = userData.lastActiveAt;

    if (!lastActiveAt) return null;

    const lastActive = lastActiveAt.toDate ? lastActiveAt.toDate() : new Date(lastActiveAt);
    const now = new Date();
    return now - lastActive;
  } catch (error) {
    console.error("Error getting time since last active:", error);
    return null;
  }
}








