// src/utils/gamingVenueReservationService.js
//
// GAMING VENUE RESERVATION SERVICE
//
// Service for creating and managing gaming venue group reservations
// (Dave & Buster's style entertainment venues)

import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../hooks/services/firebase";
import { createNotification, NOTIFICATION_TYPES, NOTIFICATION_PRIORITY } from "./notificationService";

export const GROUP_STATUS = {
  ACTIVE: "active",
  PAUSED: "paused",
  COMPLETED: "completed",
  EXPIRED: "expired",
};

/**
 * Create a gaming venue group reservation
 * 
 * @param {Object} params
 * @param {string} params.restaurantId - Restaurant ID
 * @param {string} params.parentUserId - Parent/leader user ID
 * @param {string} params.parentName - Parent name
 * @param {string} params.parentPhone - Parent phone
 * @param {string} params.parentEmail - Parent email
 * @param {Date} params.startTime - Start time
 * @param {number} params.timeLimit - Time limit in minutes
 * @param {Array} params.members - Array of member objects {name, phone, email, userId, isParent}
 * @param {boolean} params.cardOnFile - Whether card is on file
 * @param {string} params.cardLast4 - Last 4 digits of card
 * @param {string} params.notes - Additional notes
 * @returns {Promise<string>} Group ID
 */
export async function createGamingVenueGroup({
  restaurantId,
  parentUserId,
  parentName,
  parentPhone,
  parentEmail,
  startTime,
  timeLimit,
  members = [],
  cardOnFile = false,
  cardLast4 = "",
  notes = "",
}) {
  try {
    if (!restaurantId || !parentUserId || !parentName || !startTime || !timeLimit) {
      throw new Error("Missing required fields: restaurantId, parentUserId, parentName, startTime, timeLimit");
    }

    const startTimeDate = startTime instanceof Date ? startTime : new Date(startTime);
    const endTimeDate = new Date(startTimeDate.getTime() + timeLimit * 60000);

    // Ensure parent is in members array
    const parentMember = {
      name: parentName,
      phone: parentPhone,
      email: parentEmail,
      userId: parentUserId,
      isParent: true,
    };

    const allMembers = [
      parentMember,
      ...members.filter(m => !m.isParent), // Exclude parent if already added
    ];

    const groupRef = doc(collection(db, "restaurants", restaurantId, "gamingGroups"));

    const groupData = {
      id: groupRef.id,
      restaurantId,
      parentUserId,
      parentName,
      parentPhone,
      parentEmail,
      startTime: Timestamp.fromDate(startTimeDate),
      endTime: Timestamp.fromDate(endTimeDate),
      extendedUntil: null,
      timeLimit,
      members: allMembers,
      cardOnFile,
      cardLast4: cardLast4 || "",
      notes: notes || "",
      status: GROUP_STATUS.ACTIVE,
      warning15Sent: false,
      warning5Sent: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(groupRef, groupData);

    // Notify restaurant
    await createNotification({
      userId: null, // Will notify restaurant admins
      restaurantId,
      type: NOTIFICATION_TYPES.GAMING_VENUE_GROUP,
      priority: NOTIFICATION_PRIORITY.MEDIUM,
      title: "New Gaming Venue Group",
      message: `${parentName} - ${allMembers.length} ${allMembers.length === 1 ? "person" : "people"} - ${timeLimit} minutes`,
      actionUrl: `/restaurant/${restaurantId}?tab=gaming-venue`,
      metadata: {
        groupId: groupRef.id,
        parentUserId,
        parentName,
        startTime: startTimeDate.toISOString(),
        timeLimit,
      },
    });

    return groupRef.id;
  } catch (error) {
    console.error("Error creating gaming venue group:", error);
    throw error;
  }
}

/**
 * Get gaming venue groups for a diner (as parent or member)
 * 
 * @param {string} dinerId - Diner user ID
 * @param {string} dinerEmail - Diner email (optional, for member lookup)
 * @returns {Promise<Array>} Array of gaming groups
 */
export async function getDinerGamingVenueGroups(dinerId, dinerEmail = null) {
  try {
    if (!dinerId) {
      return [];
    }

    const allGroups = [];

    // Query all restaurants with gaming venue enabled
    const restaurantsRef = collection(db, "restaurants");
    const restaurantsSnap = await getDocs(restaurantsRef);

    for (const restaurantDoc of restaurantsSnap.docs) {
      const restaurantId = restaurantDoc.id;
      const restaurantData = restaurantDoc.data();

      // Only check restaurants with gaming venue enabled
      if (restaurantData.attractions?.gamingVenue) {
        try {
          const groupsRef = collection(db, "restaurants", restaurantId, "gamingGroups");
          
          // Query groups where user is parent
          const parentQuery = query(
            groupsRef,
            where("parentUserId", "==", dinerId),
            orderBy("startTime", "desc")
          );
          const parentSnap = await getDocs(parentQuery);

          parentSnap.docs.forEach((doc) => {
            const data = doc.data();
            allGroups.push({
              id: doc.id,
              restaurantId,
              restaurantName: restaurantData.name || restaurantId,
              ...data,
            });
          });

          // Query all groups and filter for member matches (if no parent match)
          // Note: This is less efficient but necessary since Firestore doesn't support
          // querying array-contains with nested fields easily
          const allGroupsQuery = query(groupsRef, orderBy("startTime", "desc"));
          const allGroupsSnap = await getDocs(allGroupsQuery);

          allGroupsSnap.docs.forEach((doc) => {
            const data = doc.data();
            const groupId = doc.id;
            
            // Skip if already added as parent
            if (allGroups.find(g => g.id === groupId)) {
              return;
            }

            // Check if user is a member
            const isMember = data.members?.some(m => 
              m.userId === dinerId || 
              (dinerEmail && m.email === dinerEmail)
            );

            if (isMember) {
              allGroups.push({
                id: groupId,
                restaurantId,
                restaurantName: restaurantData.name || restaurantId,
                ...data,
              });
            }
          });
        } catch (error) {
          // Skip restaurants without proper indexes
          console.warn(`Could not query gaming groups for restaurant ${restaurantId}:`, error);
        }
      }
    }

    // Sort by startTime descending
    allGroups.sort((a, b) => {
      const aTime = a.startTime?.toDate?.() || new Date(a.startTime || 0);
      const bTime = b.startTime?.toDate?.() || new Date(b.startTime || 0);
      return bTime - aTime;
    });

    return allGroups;
  } catch (error) {
    console.error("Error getting diner gaming venue groups:", error);
    return [];
  }
}

/**
 * Add a member to an existing gaming venue group
 * 
 * @param {string} restaurantId - Restaurant ID
 * @param {string} groupId - Group ID
 * @param {Object} member - Member object {name, phone, email, userId}
 * @returns {Promise<void>}
 */
export async function addMemberToGroup(restaurantId, groupId, member) {
  try {
    const groupRef = doc(db, "restaurants", restaurantId, "gamingGroups", groupId);
    const groupSnap = await getDoc(groupRef);

    if (!groupSnap.exists()) {
      throw new Error("Group not found");
    }

    const groupData = groupSnap.data();
    const members = groupData.members || [];

    // Check if member already exists
    const memberExists = members.some(m => 
      m.userId === member.userId || 
      m.email === member.email ||
      m.phone === member.phone
    );

    if (memberExists) {
      throw new Error("Member already in group");
    }

    // Add member
    members.push({
      ...member,
      isParent: false,
    });

    await updateDoc(groupRef, {
      members,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error adding member to group:", error);
    throw error;
  }
}

/**
 * Request time extension for a gaming venue group
 * 
 * @param {string} restaurantId - Restaurant ID
 * @param {string} groupId - Group ID
 * @param {number} minutes - Minutes to extend
 * @returns {Promise<void>}
 */
export async function requestTimeExtension(restaurantId, groupId, minutes) {
  try {
    const groupRef = doc(db, "restaurants", restaurantId, "gamingGroups", groupId);
    
    // Notify restaurant front desk
    await createNotification({
      userId: null, // Will notify restaurant admins
      restaurantId,
      type: NOTIFICATION_TYPES.GAMING_VENUE_EXTENSION_REQUEST,
      priority: NOTIFICATION_PRIORITY.HIGH,
      title: "Time Extension Request",
      message: `Group ${groupId} requests ${minutes} minute extension`,
      actionUrl: `/restaurant/${restaurantId}?tab=gaming-venue&group=${groupId}`,
      metadata: {
        groupId,
        extensionMinutes: minutes,
      },
    });

    // Update group with extension request
    await updateDoc(groupRef, {
      extensionRequested: minutes,
      extensionRequestedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error requesting time extension:", error);
    throw error;
  }
}

