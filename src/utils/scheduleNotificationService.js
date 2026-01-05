// src/utils/scheduleNotificationService.js
//
// Schedule Notification Service
//
// Notifies guests when schedules are published so they can select servers

import { createNotification } from "./notificationService";
import { NOTIFICATION_TYPES, NOTIFICATION_PRIORITY } from "./notificationService";
import { getReservationsInWindow, RESERVATION_STATUS, RESERVATION_SOURCE } from "./reservationLedgerService";

/**
 * Notify guests when a schedule is published
 * 
 * Finds all reservations for the published dates that don't have a server selected,
 * and notifies those guests that they can now select a server.
 * 
 * @param {string} restaurantId - Restaurant ID
 * @param {string} weekEndingISO - Week ending date (ISO format)
 * @param {Array<string>} dateISOs - Array of date ISOs that were published
 */
export async function notifyGuestsOnSchedulePublish(restaurantId, weekEndingISO, dateISOs) {
  try {
    if (!dateISOs || dateISOs.length === 0) {
      console.warn("No dates provided for schedule publish notification");
      return;
    }

    // Get the date range for the published week
    const startDate = new Date(dateISOs[0]);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateISOs[dateISOs.length - 1]);
    endDate.setHours(23, 59, 59, 999);

    // Get all reservations for these dates from the canonical ledger
    const reservations = await getReservationsInWindow({
      restaurantId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    // Filter for:
    // 1. LINEUP reservations (not OpenTable - they don't select servers)
    // 2. Active status (not cancelled, completed, no-show)
    // 3. No server selected (metadata.serverId is null/undefined)
    // 4. Has dinerId (so we can notify them)
    const reservationsToNotify = reservations.filter((res) => {
      const isLineup = res.source?.system === RESERVATION_SOURCE.LINEUP;
      const isActive = 
        res.status !== RESERVATION_STATUS.CANCELLED &&
        res.status !== RESERVATION_STATUS.COMPLETED &&
        res.status !== RESERVATION_STATUS.NO_SHOW;
      const noServer = !res.metadata?.serverId;
      const hasDinerId = !!res.dinerId;
      const isInPublishedDates = dateISOs.includes(res.startAt.split("T")[0]);

      return isLineup && isActive && noServer && hasDinerId && isInPublishedDates;
    });

    console.log(
      `Found ${reservationsToNotify.length} reservations to notify for schedule publish`
    );

    // Create notifications for each guest
    const notificationPromises = reservationsToNotify.map(async (reservation) => {
      const reservationDate = new Date(reservation.startAt);
      const dateStr = reservationDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      const timeStr = reservationDate.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

      return createNotification({
        userId: reservation.dinerId,
        restaurantId,
        type: NOTIFICATION_TYPES.SCHEDULE_PUBLISHED,
        priority: NOTIFICATION_PRIORITY.MEDIUM,
        title: "Schedule Published - Select Your Server!",
        message: `The schedule for ${dateStr} at ${timeStr} is now available. You can now select your preferred server for your reservation.`,
        actionUrl: `/reservations?reservationId=${reservation.id}&selectServer=true`,
        metadata: {
          reservationId: reservation.id,
          restaurantId,
          dateISO: reservation.startAt.split("T")[0],
          weekEndingISO,
          type: "schedule_published",
        },
      });
    });

    await Promise.all(notificationPromises);

    console.log(
      `Sent ${reservationsToNotify.length} notifications for schedule publish`
    );

    return {
      success: true,
      notifiedCount: reservationsToNotify.length,
    };
  } catch (error) {
    console.error("Error notifying guests on schedule publish:", error);
    throw error;
  }
}

/**
 * Check if a reservation can have a server added
 * 
 * @param {Object} reservation - Reservation object
 * @returns {boolean}
 */
export function canAddServerToReservation(reservation) {
  if (!reservation) return false;
  
  const isLineup = reservation.source?.system === RESERVATION_SOURCE.LINEUP;
  const isActive = 
    reservation.status !== RESERVATION_STATUS.CANCELLED &&
    reservation.status !== RESERVATION_STATUS.COMPLETED &&
    reservation.status !== RESERVATION_STATUS.NO_SHOW;
  const noServer = !reservation.metadata?.serverId;
  const isFuture = new Date(reservation.startAt) > new Date();

  return isLineup && isActive && noServer && isFuture;
}

