// src/utils/fcmService.js
//
// FIREBASE CLOUD MESSAGING SERVICE
//
// Handles push notification registration and token management
// - Request notification permission
// - Register device tokens
// - Handle foreground messages
// - Background message handling (via service worker)

import { getToken, onMessage, isSupported } from "firebase/messaging";
import { messaging } from "../hooks/services/firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../hooks/services/firebase";

/**
 * Request notification permission from user
 * @returns {Promise<boolean>} True if permission granted
 */
export async function requestNotificationPermission() {
  try {
    if (!("Notification" in window)) {
      console.warn("This browser does not support notifications");
      return false;
    }

    if (Notification.permission === "granted") {
      return true;
    }

    if (Notification.permission === "denied") {
      console.warn("Notification permission denied");
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === "granted";
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    return false;
  }
}

/**
 * Get FCM token for current device
 * @param {string} userId - User ID
 * @returns {Promise<string|null>} FCM token or null
 */
export async function getFCMToken(userId) {
  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn("FCM not supported in this browser");
      return null;
    }

    if (!messaging) {
      console.warn("Messaging not initialized");
      return null;
    }

    // Request permission first
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.warn("Notification permission not granted");
      return null;
    }

    // Get token
    const token = await getToken(messaging, {
      vapidKey: process.env.REACT_APP_FCM_VAPID_KEY || "YOUR_VAPID_KEY_HERE",
    });

    if (!token) {
      console.warn("No FCM token available");
      return null;
    }

    // Store token in Firestore
    if (userId) {
      await saveFCMToken(userId, token);
    }

    return token;
  } catch (error) {
    console.error("Error getting FCM token:", error);
    return null;
  }
}

/**
 * Save FCM token to user's document
 * @param {string} userId - User ID
 * @param {string} token - FCM token
 */
export async function saveFCMToken(userId, token) {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();
      const existingTokens = userData.fcmTokens || [];

      // Check if token already exists
      if (!existingTokens.includes(token)) {
        await setDoc(
          userRef,
          {
            fcmTokens: [...existingTokens, token],
            fcmTokenUpdatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
    } else {
      // Create user document with token
      await setDoc(userRef, {
        fcmTokens: [token],
        fcmTokenUpdatedAt: serverTimestamp(),
      });
    }

    // Also store in a separate collection for easier querying
    const tokenRef = doc(db, "fcmTokens", token);
    await setDoc(
      tokenRef,
      {
        userId,
        token,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error("Error saving FCM token:", error);
  }
}

/**
 * Remove FCM token (when user logs out or unsubscribes)
 * @param {string} userId - User ID
 * @param {string} token - FCM token to remove
 */
export async function removeFCMToken(userId, token) {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();
      const existingTokens = userData.fcmTokens || [];
      const updatedTokens = existingTokens.filter((t) => t !== token);

      await setDoc(
        userRef,
        {
          fcmTokens: updatedTokens,
          fcmTokenUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    // Remove from tokens collection
    const tokenRef = doc(db, "fcmTokens", token);
    await setDoc(
      tokenRef,
      {
        userId: null,
        removedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error("Error removing FCM token:", error);
  }
}

/**
 * Set up foreground message handler
 * @param {Function} callback - Callback function to handle messages
 * @returns {Function} Unsubscribe function
 */
export function onForegroundMessage(callback) {
  if (!messaging) {
    console.warn("Messaging not initialized");
    return () => {};
  }

  return onMessage(messaging, (payload) => {
    console.log("Foreground message received:", payload);
    callback(payload);
  });
}

/**
 * Initialize FCM for a user
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if initialized successfully
 */
export async function initializeFCM(userId) {
  try {
    const token = await getFCMToken(userId);
    return token !== null;
  } catch (error) {
    console.error("Error initializing FCM:", error);
    return false;
  }
}

