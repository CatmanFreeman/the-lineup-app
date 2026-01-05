// src/utils/bowlingReservationNotificationService.js
//
// BOWLING RESERVATION NOTIFICATION SERVICE
//
// Handles expiration warnings and extension requests for bowling reservations
// - Sends notifications at 15 minutes and 5 minutes before expiration
// - Handles parent-controlled extension requests
// - Notifies bowling attendant when extension is requested
// - Sends confirmation to parent and siblings when extended

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../hooks/services/firebase";
import { createNotification, NOTIFICATION_PRIORITY } from "./notificationService";

/**
 * Notification types for bowling reservations
 */
export const BOWLING_NOTIFICATION_TYPES = {
  EXPIRING_15_MIN: "bowling_reservation_expiring_15min",
  EXPIRING_5_MIN: "bowling_reservation_expiring_5min",
  EXTENSION_REQUESTED: "bowling_reservation_extension_requested",
  EXTENSION_APPROVED: "bowling_reservation_extension_approved",
  EXTENSION_DECLINED: "bowling_reservation_extension_declined",
};

/**
 * Schedule expiration notifications for a bowling reservation
 * This should be called when a reservation is created or becomes active
 */
export async function scheduleExpirationNotifications(reservationId, restaurantId, endTime, parentUserId, siblingUserIds = []) {
  try {
    if (!endTime || !parentUserId) {
      console.warn("Cannot schedule notifications: missing endTime or parentUserId");
      return;
    }

    const endTimeDate = endTime.toDate ? endTime.toDate() : new Date(endTime);
    const now = new Date();
    
    // Calculate notification times
    const fifteenMinBefore = new Date(endTimeDate.getTime() - 15 * 60000);
    const fiveMinBefore = new Date(endTimeDate.getTime() - 5 * 60000);

    // Store notification schedule in reservation document
    const reservationRef = doc(db, "restaurants", restaurantId, "bowlingReservations", reservationId);
    await updateDoc(reservationRef, {
      notificationSchedule: {
        fifteenMinNotification: Timestamp.fromDate(fifteenMinBefore),
        fiveMinNotification: Timestamp.fromDate(fiveMinBefore),
        fifteenMinSent: false,
        fiveMinSent: false,
      },
      parentUserId,
      siblingUserIds: siblingUserIds || [],
      updatedAt: serverTimestamp(),
    });

    // Schedule immediate notifications if times have already passed
    if (fifteenMinBefore <= now && fiveMinBefore > now) {
      // Only send 5 min notification
      await sendExpirationNotification(reservationId, restaurantId, 5, parentUserId, siblingUserIds);
    } else if (fiveMinBefore <= now) {
      // Both times have passed, don't send notifications
      await updateDoc(reservationRef, {
        "notificationSchedule.fifteenMinSent": true,
        "notificationSchedule.fiveMinSent": true,
      });
    } else {
      // Schedule future notifications using setTimeout (for client-side)
      // In production, use Cloud Functions scheduled tasks
      const fifteenMinDelay = fifteenMinBefore.getTime() - now.getTime();
      const fiveMinDelay = fiveMinBefore.getTime() - now.getTime();

      if (fifteenMinDelay > 0) {
        setTimeout(() => {
          sendExpirationNotification(reservationId, restaurantId, 15, parentUserId, siblingUserIds);
        }, fifteenMinDelay);
      }

      if (fiveMinDelay > 0) {
        setTimeout(() => {
          sendExpirationNotification(reservationId, restaurantId, 5, parentUserId, siblingUserIds);
        }, fiveMinDelay);
      }
    }
  } catch (error) {
    console.error("Error scheduling expiration notifications:", error);
  }
}

/**
 * Send expiration notification to parent and siblings
 */
async function sendExpirationNotification(reservationId, restaurantId, minutesRemaining, parentUserId, siblingUserIds = []) {
  try {
    const reservationRef = doc(db, "restaurants", restaurantId, "bowlingReservations", reservationId);
    const reservationSnap = await getDoc(reservationRef);
    
    if (!reservationSnap.exists()) {
      console.warn(`Reservation ${reservationId} not found`);
      return;
    }

    const reservation = reservationSnap.data();
    const notificationType = minutesRemaining === 15 
      ? BOWLING_NOTIFICATION_TYPES.EXPIRING_15_MIN 
      : BOWLING_NOTIFICATION_TYPES.EXPIRING_5_MIN;

    // Check if notification already sent
    const schedule = reservation.notificationSchedule || {};
    const alreadySent = minutesRemaining === 15 ? schedule.fifteenMinSent : schedule.fiveMinSent;
    
    if (alreadySent) {
      return; // Already sent
    }

    const laneId = reservation.laneId;
    const guestName = reservation.guestName;
    const endTime = reservation.endTime?.toDate ? reservation.endTime.toDate() : new Date(reservation.endTime);

    // Send to parent (with extension options)
    await createNotification({
      userId: parentUserId,
      restaurantId,
      type: notificationType,
      priority: NOTIFICATION_PRIORITY.HIGH,
      title: `Bowling Reservation Expiring in ${minutesRemaining} Minutes`,
      message: `Your reservation for Lane ${laneId} (${guestName}) expires in ${minutesRemaining} minutes.`,
      actionUrl: `/bowling/reservation/${reservationId}?restaurantId=${restaurantId}&minutesRemaining=${minutesRemaining}&isParent=true`,
      metadata: {
        reservationId,
        restaurantId,
        laneId,
        minutesRemaining,
        endTime: endTime.toISOString(),
        canExtend: true,
        isParent: true,
      },
    });

    // Send to siblings (informational only, no extension options)
    for (const siblingId of siblingUserIds || []) {
      await createNotification({
        userId: siblingId,
        restaurantId,
        type: notificationType,
        priority: NOTIFICATION_PRIORITY.HIGH,
      title: `Bowling Reservation Expiring in ${minutesRemaining} Minutes`,
      message: `Your group's reservation for Lane ${laneId} (${guestName}) expires in ${minutesRemaining} minutes.`,
      actionUrl: `/bowling/reservation/${reservationId}?restaurantId=${restaurantId}&minutesRemaining=${minutesRemaining}&isParent=false`,
        metadata: {
          reservationId,
          restaurantId,
          laneId,
          minutesRemaining,
          endTime: endTime.toISOString(),
          canExtend: false,
          isParent: false,
        },
      });
    }

    // Mark notification as sent
    await updateDoc(reservationRef, {
      [`notificationSchedule.${minutesRemaining === 15 ? 'fifteenMinSent' : 'fiveMinSent'}`]: true,
      updatedAt: serverTimestamp(),
    });

    console.log(`Expiration notification sent for reservation ${reservationId} (${minutesRemaining} min)`);
  } catch (error) {
    console.error("Error sending expiration notification:", error);
  }
}

/**
 * Request extension for a bowling reservation
 * Called by parent user from push notification
 */
export async function requestReservationExtension(reservationId, restaurantId, extensionMinutes) {
  try {
    const reservationRef = doc(db, "restaurants", restaurantId, "bowlingReservations", reservationId);
    const reservationSnap = await getDoc(reservationRef);
    
    if (!reservationSnap.exists()) {
      throw new Error("Reservation not found");
    }

    const reservation = reservationSnap.data();
    const parentUserId = reservation.parentUserId;
    const laneId = reservation.laneId;
    const guestName = reservation.guestName;
    const currentEndTime = reservation.endTime?.toDate ? reservation.endTime.toDate() : new Date(reservation.endTime);
    const newEndTime = new Date(currentEndTime.getTime() + extensionMinutes * 60000);

    // Update reservation with extension request
    await updateDoc(reservationRef, {
      extensionRequested: true,
      extensionMinutes,
      requestedNewEndTime: Timestamp.fromDate(newEndTime),
      extensionStatus: "pending",
      updatedAt: serverTimestamp(),
    });

    // Notify bowling attendant
    await notifyBowlingAttendantForExtension({
      reservationId,
      restaurantId,
      laneId,
      guestName,
      extensionMinutes,
      currentEndTime: currentEndTime.toISOString(),
      newEndTime: newEndTime.toISOString(),
    });

    // Notify parent that request was sent
    await createNotification({
      userId: parentUserId,
      restaurantId,
      type: BOWLING_NOTIFICATION_TYPES.EXTENSION_REQUESTED,
      priority: NOTIFICATION_PRIORITY.MEDIUM,
      title: "Extension Request Sent",
      message: `Your request to extend Lane ${laneId} by ${extensionMinutes} minutes has been sent to the bowling desk.`,
      actionUrl: `/bowling/reservation/${reservationId}`,
      metadata: {
        reservationId,
        extensionMinutes,
      },
    });

    return { success: true, newEndTime };
  } catch (error) {
    console.error("Error requesting reservation extension:", error);
    throw error;
  }
}

/**
 * Notify bowling attendant that extension is requested
 */
async function notifyBowlingAttendantForExtension({ reservationId, restaurantId, laneId, guestName, extensionMinutes, currentEndTime, newEndTime }) {
  try {
    // Get bowling alley attendants (FOH staff with "Bowling Alley Attendant" role)
    const staffRef = collection(db, "restaurants", restaurantId, "staff");
    const staffQuery = query(
      staffRef,
      where("position", "==", "Bowling Alley Attendant"),
      where("status", "==", "active")
    );
    const staffSnap = await getDocs(staffQuery);

    const attendants = staffSnap.docs.map(d => ({
      id: d.id,
      userId: d.data().userId,
      ...d.data(),
    }));

    if (attendants.length === 0) {
      // Fallback: notify restaurant admins
      console.warn(`No bowling attendants found for restaurant ${restaurantId}, notifying admins`);
      // You can add admin notification logic here
      return;
    }

    // Send notification to all active attendants
    for (const attendant of attendants) {
      if (attendant.userId) {
        await createNotification({
          userId: attendant.userId,
          restaurantId,
          type: BOWLING_NOTIFICATION_TYPES.EXTENSION_REQUESTED,
          priority: NOTIFICATION_PRIORITY.HIGH,
          title: "Reservation Extension Requested",
          message: `${guestName} wants to extend Lane ${laneId} by ${extensionMinutes} minutes. Please process in POS system.`,
          actionUrl: `/restaurant/${restaurantId}?tab=bowling-lanes&reservation=${reservationId}`,
          metadata: {
            reservationId,
            laneId,
            guestName,
            extensionMinutes,
            currentEndTime,
            newEndTime,
            action: "approve_extension",
          },
        });
      }
    }
  } catch (error) {
    console.error("Error notifying bowling attendant:", error);
  }
}

/**
 * Approve extension (called by bowling attendant after processing in POS)
 */
export async function approveReservationExtension(reservationId, restaurantId) {
  try {
    const reservationRef = doc(db, "restaurants", restaurantId, "bowlingReservations", reservationId);
    const reservationSnap = await getDoc(reservationRef);
    
    if (!reservationSnap.exists()) {
      throw new Error("Reservation not found");
    }

    const reservation = reservationSnap.data();
    
    if (reservation.extensionStatus !== "pending") {
      throw new Error("Extension not pending");
    }

    const extensionMinutes = reservation.extensionMinutes || 0;
    const currentEndTime = reservation.endTime?.toDate ? reservation.endTime.toDate() : new Date(reservation.endTime);
    const newEndTime = new Date(currentEndTime.getTime() + extensionMinutes * 60000);

    // Update reservation end time
    await updateDoc(reservationRef, {
      endTime: Timestamp.fromDate(newEndTime),
      duration: reservation.duration + extensionMinutes,
      extensionStatus: "approved",
      extensionApprovedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Reschedule notifications for new end time
    const parentUserId = reservation.parentUserId;
    const siblingUserIds = reservation.siblingUserIds || [];
    await scheduleExpirationNotifications(reservationId, restaurantId, Timestamp.fromDate(newEndTime), parentUserId, siblingUserIds);

    // Notify parent and siblings
    const laneId = reservation.laneId;

    // Notify parent
    await createNotification({
      userId: parentUserId,
      restaurantId,
      type: BOWLING_NOTIFICATION_TYPES.EXTENSION_APPROVED,
      priority: NOTIFICATION_PRIORITY.HIGH,
      title: "Reservation Extended",
      message: `Your reservation for Lane ${laneId} has been extended by ${extensionMinutes} minutes. New end time: ${newEndTime.toLocaleTimeString()}.`,
      actionUrl: `/bowling/reservation/${reservationId}`,
      metadata: {
        reservationId,
        extensionMinutes,
        newEndTime: newEndTime.toISOString(),
      },
    });

    // Notify siblings
    for (const siblingId of siblingUserIds || []) {
      await createNotification({
        userId: siblingId,
        restaurantId,
        type: BOWLING_NOTIFICATION_TYPES.EXTENSION_APPROVED,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title: "Reservation Extended",
        message: `Your group's reservation for Lane ${laneId} has been extended by ${extensionMinutes} minutes. New end time: ${newEndTime.toLocaleTimeString()}.`,
        actionUrl: `/bowling/reservation/${reservationId}`,
        metadata: {
          reservationId,
          extensionMinutes,
          newEndTime: newEndTime.toISOString(),
        },
      });
    }

    return { success: true, newEndTime };
  } catch (error) {
    console.error("Error approving reservation extension:", error);
    throw error;
  }
}

/**
 * Decline extension (if attendant cannot extend)
 */
export async function declineReservationExtension(reservationId, restaurantId) {
  try {
    const reservationRef = doc(db, "restaurants", restaurantId, "bowlingReservations", reservationId);
    const reservationSnap = await getDoc(reservationRef);
    
    if (!reservationSnap.exists()) {
      throw new Error("Reservation not found");
    }

    const reservation = reservationSnap.data();
    const parentUserId = reservation.parentUserId;
    const laneId = reservation.laneId;

    await updateDoc(reservationRef, {
      extensionStatus: "declined",
      extensionDeclinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Notify parent
    await createNotification({
      userId: parentUserId,
      restaurantId,
      type: BOWLING_NOTIFICATION_TYPES.EXTENSION_DECLINED,
      priority: NOTIFICATION_PRIORITY.MEDIUM,
      title: "Extension Not Available",
      message: `Unfortunately, we cannot extend your reservation for Lane ${laneId} at this time.`,
      actionUrl: `/bowling/reservation/${reservationId}`,
      metadata: {
        reservationId,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error declining reservation extension:", error);
    throw error;
  }
}

