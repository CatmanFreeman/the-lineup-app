// src/utils/notificationService.js

import { collection, addDoc, query, where, getDocs, updateDoc, doc, serverTimestamp, orderBy, limit } from "firebase/firestore";
import { db } from "../hooks/services/firebase";
import { writeBatch } from "firebase/firestore";

/**
 * Notification Priority Levels
 */
export const NOTIFICATION_PRIORITY = {
  HIGH: "high",    // Push + Email + In-App
  MEDIUM: "medium", // Email + In-App
  LOW: "low"       // In-App only
};

/**
 * Notification Types
 */
export const NOTIFICATION_TYPES = {
  DOCUMENTS_SUBMITTED: "documents_submitted",
  ORIENTATION_ASSIGNED: "orientation_assigned",
  ORIENTATION_COMPLETE: "orientation_complete",
  READY_FOR_WORK: "ready_for_work",
  TEST_ASSIGNED: "test_assigned",
  TEST_COMPLETE: "test_complete",
  SCHEDULE_PUBLISHED: "schedule_published",
  SHIFT_REMINDER: "shift_reminder",
  BADGE_EARNED: "badge_earned",
  POINTS_EARNED: "points_earned",
  RESERVATION: "reservation",
  VALET_TICKET_MISSING: "valet_ticket_missing",
  VALET_RETRIEVE_CAR: "valet_retrieve_car",
  VALET_CAR_READY: "valet_car_ready",
  VALET_AUTHORIZATION_REQUEST: "valet_authorization_request",
  VALET_COMPANY_APPROVED: "valet_company_approved",
  VALET_INCOMING_CAR: "valet_incoming_car",
  VALET_REVIEW: "valet_review",
  VALET_REVIEW_REQUEST: "valet_review_request",
  VALET_CLAIM: "valet_claim",
  BOWLING_RESERVATION: "bowling_reservation",
  BOWLING_RESERVATION_EXPIRING_15MIN: "bowling_reservation_expiring_15min",
  BOWLING_RESERVATION_EXPIRING_5MIN: "bowling_reservation_expiring_5min",
  BOWLING_RESERVATION_EXTENSION_REQUESTED: "bowling_reservation_extension_requested",
  BOWLING_RESERVATION_EXTENSION_APPROVED: "bowling_reservation_extension_approved",
  BOWLING_RESERVATION_EXTENSION_DECLINED: "bowling_reservation_extension_declined",
  EMPLOYEE_BLAST: "employee_blast",
  EMPLOYMENT_VERIFICATION_REQUEST: "employment_verification_request",
  EMPLOYMENT_VERIFIED: "employment_verified",
  EMPLOYMENT_VERIFICATION_REJECTED: "employment_verification_rejected",
  GAMING_VENUE_GROUP: "gaming_venue_group",
  GAMING_VENUE_EXTENSION_REQUEST: "gaming_venue_extension_request",
  GAMING_VENUE_TIME_ALERT: "gaming_venue_time_alert",
  TOGO_ORDER_NEW: "togo_order_new",
  TOGO_ORDER_CONFIRMED: "togo_order_confirmed",
  TOGO_ORDER_STATUS_UPDATE: "togo_order_status_update",
  TOGO_ORDER_CANCELLED: "togo_order_cancelled",
  TOGO_ORDER_READY: "togo_order_ready",
};

/**
 * Create a notification
 */
export async function createNotification({
  userId,
  restaurantId,
  companyId,
  type,
  priority = NOTIFICATION_PRIORITY.LOW,
  title,
  message,
  actionUrl,
  metadata = {}
}) {
  try {
    const notificationRef = await addDoc(
      collection(db, "notifications"),
      {
        userId,
        restaurantId,
        companyId,
        type,
        priority,
        title,
        message,
        actionUrl,
        metadata,
        read: false,
        createdAt: serverTimestamp(),
        // For push/email delivery tracking
        pushSent: false,
        emailSent: false
      }
    );

    // Push and email notifications are handled by Cloud Functions
    // Firestore triggers will automatically send push/email for HIGH/MEDIUM priority

    return notificationRef.id;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
}

/**
 * Notify user when badge is earned
 */
export async function notifyBadgeEarned({
  userId,
  restaurantId,
  companyId,
  badgeName,
  badgeIcon,
  pointsValue,
  badgeId,
}) {
  try {
    const title = "🎉 Badge Earned!";
    const message = pointsValue > 0
      ? `You earned the "${badgeName}" badge and ${pointsValue} Lineup Points!`
      : `You earned the "${badgeName}" badge!`;
    
    return await createNotification({
      userId,
      restaurantId,
      companyId,
      type: NOTIFICATION_TYPES.BADGE_EARNED,
      priority: NOTIFICATION_PRIORITY.MEDIUM,
      title,
      message,
      actionUrl: `/dashboard/employee/${restaurantId}?tab=badges`,
      metadata: {
        badgeId,
        badgeName,
        badgeIcon,
        pointsValue,
      },
    });
  } catch (error) {
    console.error("Error creating badge notification:", error);
    throw error;
  }
}

/**
 * Notify user when points are earned
 */
export async function notifyPointsEarned({
  userId,
  restaurantId,
  companyId,
  points,
  reason,
  action,
}) {
  try {
    // Only notify for significant point awards (>= 50 points)
    if (points < 50) return null;
    
    const title = "⭐ Points Earned!";
    const message = `You earned ${points} Lineup Points${reason ? `: ${reason}` : ""}`;
    
    return await createNotification({
      userId,
      restaurantId,
      companyId,
      type: NOTIFICATION_TYPES.POINTS_EARNED,
      priority: NOTIFICATION_PRIORITY.LOW,
      title,
      message,
      actionUrl: `/dashboard/employee/${restaurantId}?tab=points`,
      metadata: {
        points,
        reason,
        action,
      },
    });
  } catch (error) {
    console.error("Error creating points notification:", error);
    return null;
  }
}

/**
 * Get notifications for a user
 */
export async function getUserNotifications(userId, limitCount = 50) {
  try {
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return [];
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(notificationId) {
  try {
    await updateDoc(doc(db, "notifications", notificationId), {
      read: true,
      readAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    throw error;
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsRead(userId) {
  try {
    const notifications = await getUserNotifications(userId, 1000);
    const batch = writeBatch(db);
    notifications.forEach(notif => {
      if (!notif.read) {
        batch.update(doc(db, "notifications", notif.id), {
          read: true,
          readAt: serverTimestamp()
        });
      }
    });
    await batch.commit();
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    throw error;
  }
}