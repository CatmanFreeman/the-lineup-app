// src/utils/reservationService.js

import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../hooks/services/firebase";
import { createNotification, NOTIFICATION_TYPES, NOTIFICATION_PRIORITY } from "./notificationService";

/**
 * Reservation Service
 * Handles diner reservations for restaurants
 */

/**
 * Create a new reservation
 */
export async function createReservation({
  dinerId,
  dinerName,
  restaurantId,
  restaurantName,
  dateISO,
  time,
  partySize,
  serverId = null,
  serverName = null,
  preferences = [],
  birthdayName = null,
  anniversaryYears = null,
  specialRequests = null,
  phone = null,
  email = null,
}) {
  try {
    const reservationRef = collection(db, "reservations");
    
    const reservationData = {
      dinerId,
      dinerName: dinerName || null,
      restaurantId,
      restaurantName: restaurantName || null,
      dateISO,
      time,
      partySize: Number(partySize) || 1,
      serverId: serverId || null,
      serverName: serverName || null,
      preferences: Array.isArray(preferences) ? preferences : [],
      birthdayName: birthdayName || null,
      anniversaryYears: anniversaryYears || null,
      specialRequests: specialRequests || null,
      phone: phone || null,
      email: email || null,
      status: "confirmed", // "confirmed" | "cancelled" | "completed"
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(reservationRef, reservationData);

    // Notify the restaurant
    await createNotification({
      userId: null, // Restaurant notification (would need restaurant owner/manager IDs)
      restaurantId,
      type: NOTIFICATION_TYPES.RESERVATION,
      priority: NOTIFICATION_PRIORITY.MEDIUM,
      title: "New Reservation",
      message: `${dinerName || "A diner"} made a reservation for ${dateISO} at ${time}`,
      actionUrl: `/restaurant/${restaurantId}/reservations`,
      metadata: {
        reservationId: docRef.id,
        dinerId,
        dateISO,
        time,
        partySize,
      },
    });

    // Notify the server if one was selected
    if (serverId) {
      await createNotification({
        userId: serverId,
        restaurantId,
        type: NOTIFICATION_TYPES.RESERVATION,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title: "You've been requested!",
        message: `${dinerName || "A diner"} requested you for a reservation on ${dateISO} at ${time}`,
        actionUrl: `/restaurant/${restaurantId}/reservations`,
        metadata: {
          reservationId: docRef.id,
          dinerId,
          dateISO,
          time,
          partySize,
        },
      });
    }

    return docRef.id;
  } catch (error) {
    console.error("Error creating reservation:", error);
    throw error;
  }
}

/**
 * Get reservations for a diner
 */
export async function getDinerReservations(dinerId, status = null) {
  try {
    let q = query(
      collection(db, "reservations"),
      where("dinerId", "==", dinerId),
      orderBy("dateISO", "desc"),
      orderBy("time", "desc")
    );

    if (status) {
      q = query(q, where("status", "==", status));
    }

    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
  } catch (error) {
    console.error("Error getting diner reservations:", error);
    throw error;
  }
}

/**
 * Get current (upcoming) reservations for a diner
 */
export async function getCurrentReservations(dinerId) {
  try {
    const todayISO = new Date().toISOString().split("T")[0];
    const q = query(
      collection(db, "reservations"),
      where("dinerId", "==", dinerId),
      where("dateISO", ">=", todayISO),
      where("status", "==", "confirmed"),
      orderBy("dateISO", "asc"),
      orderBy("time", "asc")
    );

    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
  } catch (error) {
    console.error("Error getting current reservations:", error);
    throw error;
  }
}

/**
 * Get past reservations for a diner
 */
export async function getPastReservations(dinerId, limit = 10) {
  try {
    const todayISO = new Date().toISOString().split("T")[0];
    const q = query(
      collection(db, "reservations"),
      where("dinerId", "==", dinerId),
      where("dateISO", "<", todayISO),
      orderBy("dateISO", "desc"),
      orderBy("time", "desc")
    );

    const snap = await getDocs(q);
    const results = snap.docs.slice(0, limit).map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    return results;
  } catch (error) {
    console.error("Error getting past reservations:", error);
    throw error;
  }
}

/**
 * Cancel a reservation
 */
export async function cancelReservation(reservationId) {
  try {
    const reservationRef = doc(db, "reservations", reservationId);
    await updateDoc(reservationRef, {
      status: "cancelled",
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error("Error cancelling reservation:", error);
    throw error;
  }
}

/**
 * Get available servers for a restaurant on a specific date
 * This checks if a schedule exists for that date
 */
export async function getAvailableServers(restaurantId, dateISO) {
  try {
    // Get the week ending date for the schedule
    const date = new Date(dateISO);
    const dayOfWeek = date.getDay();
    const daysToSunday = (7 - dayOfWeek) % 7;
    const weekEndingDate = new Date(date);
    weekEndingDate.setDate(date.getDate() + daysToSunday);
    const weekEndingISO = weekEndingDate.toISOString().split("T")[0];

    // Check if schedule exists and is published
    const scheduleRef = doc(
      db,
      "companies",
      "company-demo",
      "restaurants",
      restaurantId,
      "schedules",
      weekEndingISO
    );

    const scheduleSnap = await getDoc(scheduleRef);
    
    if (!scheduleSnap.exists()) {
      return []; // No schedule available
    }

    const scheduleData = scheduleSnap.data();
    if (scheduleData.status !== "published") {
      return []; // Schedule not published
    }

    // Get the day's schedule
    const daySchedule = scheduleData.days?.[dateISO];
    if (!daySchedule || !daySchedule.slots) {
      return [];
    }

    // Get staff information
    const staffRef = collection(
      db,
      "companies",
      "company-demo",
      "restaurants",
      restaurantId,
      "staff"
    );

    const staffSnap = await getDocs(staffRef);
    const staffMap = {};
    staffSnap.docs.forEach((d) => {
      const data = d.data();
      if (data.role === "Front of House" && (data.subRole === "Server" || data.subRole === "Waitstaff")) {
        staffMap[data.uid] = {
          id: data.uid,
          name: data.name || "Unknown",
          imageURL: data.imageURL || null,
          rating: data.rating || null,
        };
      }
    });

    // Get servers scheduled for that day
    const availableServers = [];
    Object.entries(daySchedule.slots).forEach(([slotId, uid]) => {
      if (uid && staffMap[uid]) {
        // Check if it's a server slot (you may need to adjust this based on your slot naming)
        if (slotId.includes("server") || slotId.includes("foh")) {
          availableServers.push(staffMap[uid]);
        }
      }
    });

    return availableServers;
  } catch (error) {
    console.error("Error getting available servers:", error);
    return [];
  }
}

