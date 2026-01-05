// src/utils/valetService.js
//
// VALET SERVICE - REDESIGNED
//
// Guest-driven valet ticket upload with hostess fallback
// - Guest checks in, selects valet parking
// - Guest uploads valet ticket photo
// - Hostess gets notified if ticket missing
// - Hostess can upload ticket if guest didn't
// - System tracks ticket through dining experience
// - Check dropped triggers valet notification
// - Car ready notification includes tip share option

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db } from "../hooks/services/firebase";
import { createNotification } from "./notificationService";
import { createTipShareTransaction } from "./tipshareService";

/**
 * Valet Ticket Status
 */
export const VALET_STATUS = {
  PENDING_UPLOAD: "PENDING_UPLOAD", // Guest checked in with valet, waiting for ticket upload
  UPLOADED: "UPLOADED", // Ticket uploaded, waiting for check
  CHECK_DROPPED: "CHECK_DROPPED", // Check dropped, ready for retrieval
  RETRIEVING: "RETRIEVING", // Valet is getting the car
  READY: "READY", // Car is ready at front
  COMPLETED: "COMPLETED", // Diner has received car
};

/**
 * Create valet ticket entry when guest checks in with valet
 * 
 * @param {Object} params
 * @param {string} params.restaurantId
 * @param {string} params.reservationId
 * @param {string} params.dinerId
 * @param {string} params.dinerName
 * @param {string} params.dinerPhone
 * @returns {Promise<string>} Valet ticket ID
 */
export async function createValetEntryOnCheckIn({
  restaurantId,
  reservationId,
  dinerId,
  dinerName,
  dinerPhone,
}) {
  try {
    if (!restaurantId || !reservationId || !dinerId) {
      throw new Error("Missing required fields: restaurantId, reservationId, dinerId");
    }

    const valetRef = collection(db, "restaurants", restaurantId, "valetTickets");
    
    // Check if valet entry already exists for this reservation
    const existingQuery = query(
      valetRef,
      where("reservationId", "==", reservationId),
      where("status", "!=", VALET_STATUS.COMPLETED)
    );
    const existingSnap = await getDocs(existingQuery);
    
    if (!existingSnap.empty) {
      // Already exists, return existing ID
      return existingSnap.docs[0].id;
    }

    const ticketDoc = doc(valetRef);
    await setDoc(ticketDoc, {
      id: ticketDoc.id,
      restaurantId,
      reservationId,
      dinerId,
      dinerName,
      dinerPhone,
      status: VALET_STATUS.PENDING_UPLOAD,
      ticketPhotoUrl: null,
      ticketNumber: null, // Will be extracted from photo or entered manually
      uploadedBy: "guest", // "guest" or "hostess"
      enteredAt: serverTimestamp(),
      uploadedAt: null,
      checkDroppedAt: null,
      retrievalStartedAt: null,
      carReadyAt: null,
      completedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Notify hostess that guest checked in with valet but hasn't uploaded ticket yet
    await notifyHostessMissingTicket(restaurantId, dinerName, reservationId, ticketDoc.id);

    return ticketDoc.id;
  } catch (error) {
    console.error("Error creating valet entry on check-in:", error);
    throw error;
  }
}

/**
 * Upload valet ticket photo
 * 
 * @param {string} restaurantId
 * @param {string} ticketId
 * @param {File} photoFile
 * @param {string} uploadedBy - "guest" or "hostess"
 * @param {string} ticketNumber - Optional, can be extracted from photo or entered manually
 * @returns {Promise<string>} Photo URL
 */
export async function uploadValetTicketPhoto(restaurantId, ticketId, photoFile, uploadedBy, ticketNumber = null) {
  try {
    const storage = getStorage();
    const photoRef = ref(storage, `restaurants/${restaurantId}/valetTickets/${ticketId}/ticket_${Date.now()}.jpg`);
    
    // Upload photo
    await uploadBytes(photoRef, photoFile);
    const photoUrl = await getDownloadURL(photoRef);

    // Update ticket
    const ticketRef = doc(db, "restaurants", restaurantId, "valetTickets", ticketId);
    await updateDoc(ticketRef, {
      status: VALET_STATUS.UPLOADED,
      ticketPhotoUrl: photoUrl,
      ticketNumber: ticketNumber || `TICKET_${ticketId.substring(0, 8)}`,
      uploadedBy,
      uploadedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return photoUrl;
  } catch (error) {
    console.error("Error uploading valet ticket photo:", error);
    throw error;
  }
}

/**
 * Notify hostess that guest checked in with valet but hasn't uploaded ticket
 */
async function notifyHostessMissingTicket(restaurantId, dinerName, reservationId, ticketId) {
  try {
    // Import notification types at the top level
    const { NOTIFICATION_TYPES } = await import("./notificationService");
    
    // Get restaurant staff (hostess role)
    const staffRef = collection(db, "restaurants", restaurantId, "staff");
    const hostessQuery = query(
      staffRef,
      where("role", "==", "host") || where("role", "==", "hostess")
    );
    const hostessSnap = await getDocs(hostessQuery);

    // Notify all hostesses
    const notifications = [];
    hostessSnap.docs.forEach((doc) => {
      const staffData = doc.data();
      if (staffData.uid) {
        notifications.push(
          createNotification({
            userId: staffData.uid,
            restaurantId,
            companyId: null, // TODO: Get from restaurant data
            type: NOTIFICATION_TYPES.VALET_TICKET_MISSING,
            priority: "medium",
            title: "Valet Ticket Missing",
            message: `${dinerName} has checked in. He's valeting. He has not captured his valet ticket yet.`,
            actionUrl: `/restaurant/${restaurantId}?tab=valet&ticketId=${ticketId}`,
            metadata: {
              reservationId,
              ticketId,
              dinerName,
            },
          })
        );
      }
    });

    await Promise.all(notifications);
  } catch (error) {
    console.error("Error notifying hostess:", error);
    // Don't fail the whole operation
  }
}

/**
 * Handle check dropped event - notify valet drivers
 * 
 * @param {string} restaurantId
 * @param {string} tableId
 * @param {string} reservationId
 */
export async function handleCheckDropped(restaurantId, tableId, reservationId = null) {
  try {
    const valetRef = collection(db, "restaurants", restaurantId, "valetTickets");
    
    // Find valet ticket for this reservation
    let ticketQuery = query(
      valetRef,
      where("reservationId", "==", reservationId),
      where("status", "==", VALET_STATUS.UPLOADED)
    );

    const ticketSnap = await getDocs(ticketQuery);
    
    if (ticketSnap.empty) {
      // No valet ticket for this reservation
      return;
    }

    const ticketDoc = ticketSnap.docs[0];
    const ticketData = ticketDoc.data();
    
    // Update ticket status
    await updateDoc(ticketDoc.ref, {
      status: VALET_STATUS.CHECK_DROPPED,
      checkDroppedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Notify valet drivers
    await notifyValetDrivers(restaurantId, ticketData);

    return ticketDoc.id;
  } catch (error) {
    console.error("Error handling check dropped for valet:", error);
    throw error;
  }
}

/**
 * Notify valet drivers to retrieve car
 * Uses valet company service to get drivers (users, not staff)
 */
async function notifyValetDrivers(restaurantId, ticketData) {
  try {
    // Import notification types and valet company service
    const { NOTIFICATION_TYPES } = await import("./notificationService");
    const { getValetDriversForRestaurant } = await import("./valetCompanyService");
    
    // Get valet drivers (users with role "VALET" assigned to this restaurant)
    const drivers = await getValetDriversForRestaurant(restaurantId);

    // If no drivers found via valet company system, fall back to staff (legacy)
    if (drivers.length === 0) {
      const staffRef = collection(db, "restaurants", restaurantId, "staff");
      const valetQuery = query(
        staffRef,
        where("role", "==", "valet")
      );
      const valetSnap = await getDocs(valetQuery);

      valetSnap.docs.forEach((doc) => {
        const staffData = doc.data();
        if (staffData.uid) {
          drivers.push({
            id: staffData.uid,
            name: staffData.name || "Valet Driver",
          });
        }
      });
    }

    // Notify all valet drivers
    const notifications = [];
    drivers.forEach((driver) => {
      notifications.push(
        createNotification({
          userId: driver.id,
          restaurantId,
          companyId: driver.valetCompanyId || null,
          type: NOTIFICATION_TYPES.VALET_RETRIEVE_CAR,
          priority: "high",
          title: "Retrieve Car",
          message: `Get car for ticket ${ticketData.ticketNumber || ticketData.id.substring(0, 8)} - ${ticketData.dinerName}`,
          actionUrl: `/dashboard/valet/${restaurantId}?ticketId=${ticketData.id}`,
          metadata: {
            ticketId: ticketData.id,
            ticketNumber: ticketData.ticketNumber,
            dinerName: ticketData.dinerName,
            restaurantId,
          },
        })
      );
    });

    await Promise.all(notifications);
  } catch (error) {
    console.error("Error notifying valet drivers:", error);
    // Don't fail the whole operation
  }
}

/**
 * Start car retrieval (valet is getting the car)
 */
export async function startCarRetrieval(restaurantId, ticketId, retrievedBy) {
  try {
    const ticketRef = doc(db, "restaurants", restaurantId, "valetTickets", ticketId);
    const ticketSnap = await getDoc(ticketRef);
    
    if (!ticketSnap.exists()) {
      throw new Error("Valet ticket not found");
    }

    const ticketData = ticketSnap.data();
    if (ticketData.status !== VALET_STATUS.CHECK_DROPPED) {
      throw new Error(`Cannot start retrieval - ticket status is ${ticketData.status}`);
    }

    await updateDoc(ticketRef, {
      status: VALET_STATUS.RETRIEVING,
      retrievedBy,
      retrievalStartedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error starting car retrieval:", error);
    throw error;
  }
}

/**
 * Mark car as ready (valet has car at front)
 * Includes tip share option for diner
 * 
 * @param {string} restaurantId
 * @param {string} ticketId
 * @param {string} valetEmployeeId - Valet employee who retrieved the car
 * @param {string} valetEmployeeName
 */
export async function markCarReady(restaurantId, ticketId, valetEmployeeId, valetEmployeeName) {
  try {
    const ticketRef = doc(db, "restaurants", restaurantId, "valetTickets", ticketId);
    const ticketSnap = await getDoc(ticketRef);
    
    if (!ticketSnap.exists()) {
      throw new Error("Valet ticket not found");
    }

    const ticketData = ticketSnap.data();
    if (ticketData.status !== VALET_STATUS.RETRIEVING) {
      throw new Error(`Cannot mark ready - ticket status is ${ticketData.status}`);
    }

    await updateDoc(ticketRef, {
      status: VALET_STATUS.READY,
      carReadyAt: serverTimestamp(),
      valetEmployeeId,
      valetEmployeeName,
      updatedAt: serverTimestamp(),
    });

    // Notify diner that their car is ready (includes tip share option)
    if (ticketData.dinerId) {
      try {
        await createNotification({
          userId: ticketData.dinerId,
          restaurantId,
          type: "VALET_CAR_READY",
          priority: "high",
          title: "Your car is ready!",
          message: `Your car (ticket ${ticketData.ticketNumber || ticketData.id.substring(0, 8)}) is ready at the front.`,
          actionUrl: `/valet/tip/${ticketId}`,
          metadata: {
            ticketId,
            ticketNumber: ticketData.ticketNumber,
            valetEmployeeId,
            valetEmployeeName,
            restaurantId,
            showTipShare: true,
          },
        });
      } catch (notifError) {
        console.error("Error sending valet notification:", notifError);
        // Don't fail the whole operation if notification fails
      }
    }

    return ticketData;
  } catch (error) {
    console.error("Error marking car ready:", error);
    throw error;
  }
}

/**
 * Tip valet driver (separate from FOH tip pool)
 * 
 * @param {string} restaurantId
 * @param {string} ticketId
 * @param {string} dinerId
 * @param {number} amount
 * @param {string} note - Optional
 */
export async function tipValetDriver(restaurantId, ticketId, dinerId, amount, note = null) {
  try {
    // Get ticket to find valet employee
    const ticketRef = doc(db, "restaurants", restaurantId, "valetTickets", ticketId);
    const ticketSnap = await getDoc(ticketRef);
    
    if (!ticketSnap.exists()) {
      throw new Error("Valet ticket not found");
    }

    const ticketData = ticketSnap.data();
    if (!ticketData.valetEmployeeId) {
      throw new Error("No valet employee assigned to this ticket");
    }

    // Create tip share transaction (valet is separate from FOH)
    await createTipShareTransaction({
      dinerId,
      employeeId: ticketData.valetEmployeeId,
      restaurantId: ticketData.restaurantId,
      amount,
      source: "valet",
      sourceId: ticketId,
      note: note || `Tip for valet service - Ticket ${ticketData.ticketNumber}`,
      dinerName: ticketData.dinerName,
      employeeName: ticketData.valetEmployeeName,
    });

    // Mark ticket as tipped (optional)
    await updateDoc(ticketRef, {
      tipped: true,
      tipAmount: amount,
      tippedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error tipping valet driver:", error);
    throw error;
  }
}

/**
 * Complete valet ticket (diner has received car)
 * Redirects to review page
 * 
 * @param {string} restaurantId
 * @param {string} ticketId
 * @param {string} dinerId - Diner user ID (for redirect)
 * @returns {Promise<void>}
 */
export async function completeValetTicket(restaurantId, ticketId, dinerId = null) {
  try {
    const ticketRef = doc(db, "restaurants", restaurantId, "valetTickets", ticketId);
    await updateDoc(ticketRef, {
      status: VALET_STATUS.COMPLETED,
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Redirect to review page (client-side will handle this)
    // The notification will include a link to the review page
    const ticketData = (await getDoc(ticketRef)).data();
    
    // Create notification with review link
    await createNotification({
      userId: dinerId || ticketData.dinerId,
      restaurantId,
      type: "VALET_REVIEW_REQUEST",
      priority: "MEDIUM",
      title: "How was your valet experience?",
      message: "Please rate your valet driver and company",
      actionUrl: `/valet/review?ticketId=${ticketId}&restaurantId=${restaurantId}`,
      metadata: {
        ticketId,
        valetCompanyId: ticketData.valetCompanyId,
        valetDriverId: ticketData.valetEmployeeId,
      },
    });
  } catch (error) {
    console.error("Error completing valet ticket:", error);
    throw error;
  }
}

/**
 * Get valet ticket by reservation ID
 */
export async function getValetTicketByReservation(restaurantId, reservationId) {
  try {
    const valetRef = collection(db, "restaurants", restaurantId, "valetTickets");
    const ticketQuery = query(
      valetRef,
      where("reservationId", "==", reservationId),
      orderBy("createdAt", "desc"),
      limit(1)
    );

    const ticketSnap = await getDocs(ticketQuery);
    if (ticketSnap.empty) {
      return null;
    }

    return {
      id: ticketSnap.docs[0].id,
      ...ticketSnap.docs[0].data(),
    };
  } catch (error) {
    console.error("Error getting valet ticket by reservation:", error);
    throw error;
  }
}

/**
 * Get active valet tickets for restaurant
 */
export async function getActiveValetTickets(restaurantId, options = {}) {
  try {
    const valetRef = collection(db, "restaurants", restaurantId, "valetTickets");
    
    let ticketQuery = query(
      valetRef,
      where("status", "!=", VALET_STATUS.COMPLETED),
      orderBy("status"),
      orderBy("createdAt", "desc")
    );

    if (options.status) {
      ticketQuery = query(
        valetRef,
        where("status", "==", options.status),
        orderBy("createdAt", "desc")
      );
    }

    const ticketSnap = await getDocs(ticketQuery);
    return ticketSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
  } catch (error) {
    console.error("Error getting active valet tickets:", error);
    throw error;
  }
}
