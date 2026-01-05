// src/utils/reminderService.js

import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy,
  Timestamp 
} from "firebase/firestore";
import { db } from "../hooks/services/firebase";

/**
 * Reminder Service
 * Manages reminders for restaurant managers and employees
 * 
 * Structure: 
 * - Restaurant reminders: restaurants/{restaurantId}/reminders/{reminderId}
 * - Employee reminders: users/{userId}/reminders/{reminderId}
 */

/**
 * Create a new reminder
 * @param {string} restaurantId - Restaurant ID
 * @param {Object} reminderData - Reminder data
 * @param {string} reminderData.label - What needs to be done
 * @param {Date|string} reminderData.scheduledAt - When the reminder should fire
 * @param {string} reminderData.createdBy - User ID who created the reminder
 * @param {string} reminderData.createdByName - Name of creator
 * @param {boolean} reminderData.completed - Whether reminder is completed
 * @returns {Promise<string>} Reminder ID
 */
export async function createReminder(restaurantId, reminderData) {
  if (!restaurantId) throw new Error("restaurantId is required");
  if (!reminderData.label) throw new Error("label is required");
  if (!reminderData.scheduledAt) throw new Error("scheduledAt is required");

  const remindersRef = collection(db, "restaurants", restaurantId, "reminders");
  
  const scheduledAt = reminderData.scheduledAt instanceof Date 
    ? Timestamp.fromDate(reminderData.scheduledAt)
    : Timestamp.fromDate(new Date(reminderData.scheduledAt));

  const reminder = {
    label: reminderData.label,
    scheduledAt,
    createdAt: Timestamp.now(),
    createdBy: reminderData.createdBy || null,
    createdByName: reminderData.createdByName || null,
    completed: reminderData.completed || false,
    completedAt: null,
  };

  const docRef = await addDoc(remindersRef, reminder);
  return docRef.id;
}

/**
 * Get all reminders for a restaurant
 * @param {string} restaurantId - Restaurant ID
 * @param {Object} options - Query options
 * @param {boolean} options.includeCompleted - Include completed reminders
 * @param {Date} options.startDate - Start date for filtering
 * @param {Date} options.endDate - End date for filtering
 * @returns {Promise<Array>} Array of reminders
 */
export async function getReminders(restaurantId, options = {}) {
  if (!restaurantId) throw new Error("restaurantId is required");

  const remindersRef = collection(db, "restaurants", restaurantId, "reminders");
  let q = query(remindersRef);

  // Filter by completion status
  if (options.includeCompleted === false) {
    q = query(q, where("completed", "==", false));
  }

  // Filter by date range
  if (options.startDate) {
    const startTimestamp = options.startDate instanceof Date
      ? Timestamp.fromDate(options.startDate)
      : Timestamp.fromDate(new Date(options.startDate));
    q = query(q, where("scheduledAt", ">=", startTimestamp));
  }

  if (options.endDate) {
    const endTimestamp = options.endDate instanceof Date
      ? Timestamp.fromDate(options.endDate)
      : Timestamp.fromDate(new Date(options.endDate));
    q = query(q, where("scheduledAt", "<=", endTimestamp));
  }

  // Order by scheduled time
  q = query(q, orderBy("scheduledAt", "asc"));

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    scheduledAtTimestamp: d.data().scheduledAt,
    createdAtTimestamp: d.data().createdAt,
    completedAtTimestamp: d.data().completedAt,
  }));
}

/**
 * Get the next upcoming reminder
 * @param {string} restaurantId - Restaurant ID
 * @returns {Promise<Object|null>} Next reminder or null
 */
export async function getNextReminder(restaurantId) {
  if (!restaurantId) return null;

  try {
    const now = new Date();
    const reminders = await getReminders(restaurantId, {
      includeCompleted: false,
      startDate: now,
    });

    // Filter to only future reminders
    const futureReminders = reminders.filter((r) => {
      const scheduledAt = r.scheduledAtTimestamp?.toDate?.() || new Date(r.scheduledAt);
      return scheduledAt > now;
    });

    if (futureReminders.length === 0) return null;

    // Return the earliest one
    return futureReminders[0];
  } catch (err) {
    console.error("Error getting next reminder:", err);
    return null;
  }
}

/**
 * Update a reminder
 * @param {string} restaurantId - Restaurant ID
 * @param {string} reminderId - Reminder ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateReminder(restaurantId, reminderId, updates) {
  if (!restaurantId) throw new Error("restaurantId is required");
  if (!reminderId) throw new Error("reminderId is required");

  const reminderRef = doc(db, "restaurants", restaurantId, "reminders", reminderId);
  
  const updateData = { ...updates };
  
  // Convert Date objects to Timestamps
  if (updateData.scheduledAt instanceof Date) {
    updateData.scheduledAt = Timestamp.fromDate(updateData.scheduledAt);
  }
  
  if (updateData.completedAt instanceof Date) {
    updateData.completedAt = Timestamp.fromDate(updateData.completedAt);
  }

  await updateDoc(reminderRef, updateData);
}

/**
 * Mark a reminder as completed
 * @param {string} restaurantId - Restaurant ID
 * @param {string} reminderId - Reminder ID
 * @returns {Promise<void>}
 */
export async function completeReminder(restaurantId, reminderId) {
  await updateReminder(restaurantId, reminderId, {
    completed: true,
    completedAt: Timestamp.now(),
  });
}

/**
 * Delete a reminder
 * @param {string} restaurantId - Restaurant ID
 * @param {string} reminderId - Reminder ID
 * @returns {Promise<void>}
 */
export async function deleteReminder(restaurantId, reminderId) {
  if (!restaurantId) throw new Error("restaurantId is required");
  if (!reminderId) throw new Error("reminderId is required");

  const reminderRef = doc(db, "restaurants", restaurantId, "reminders", reminderId);
  await deleteDoc(reminderRef);
}

// ============================================
// EMPLOYEE-LEVEL REMINDERS
// Structure: users/{userId}/reminders/{reminderId}
// ============================================

/**
 * Create a new employee reminder
 * @param {string} userId - User ID
 * @param {Object} reminderData - Reminder data
 * @param {string} reminderData.label - What needs to be done
 * @param {Date|string} reminderData.scheduledAt - When the reminder should fire
 * @returns {Promise<string>} Reminder ID
 */
export async function createEmployeeReminder(userId, reminderData) {
  if (!userId) throw new Error("userId is required");
  if (!reminderData.label) throw new Error("label is required");
  if (!reminderData.scheduledAt) throw new Error("scheduledAt is required");

  const remindersRef = collection(db, "users", userId, "reminders");
  
  const scheduledAt = reminderData.scheduledAt instanceof Date 
    ? Timestamp.fromDate(reminderData.scheduledAt)
    : Timestamp.fromDate(new Date(reminderData.scheduledAt));

  const reminder = {
    label: reminderData.label,
    scheduledAt,
    createdAt: Timestamp.now(),
    completed: reminderData.completed || false,
    completedAt: null,
  };

  const docRef = await addDoc(remindersRef, reminder);
  return docRef.id;
}

/**
 * Get all reminders for an employee
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @param {boolean} options.includeCompleted - Include completed reminders
 * @param {Date} options.startDate - Start date for filtering
 * @param {Date} options.endDate - End date for filtering
 * @returns {Promise<Array>} Array of reminders
 */
export async function getEmployeeReminders(userId, options = {}) {
  if (!userId) throw new Error("userId is required");

  const remindersRef = collection(db, "users", userId, "reminders");
  let q = query(remindersRef);

  // Filter by completion status
  if (options.includeCompleted === false) {
    q = query(q, where("completed", "==", false));
  }

  // Filter by date range
  if (options.startDate) {
    const startTimestamp = options.startDate instanceof Date
      ? Timestamp.fromDate(options.startDate)
      : Timestamp.fromDate(new Date(options.startDate));
    q = query(q, where("scheduledAt", ">=", startTimestamp));
  }

  if (options.endDate) {
    const endTimestamp = options.endDate instanceof Date
      ? Timestamp.fromDate(options.endDate)
      : Timestamp.fromDate(new Date(options.endDate));
    q = query(q, where("scheduledAt", "<=", endTimestamp));
  }

  // Order by scheduled time
  q = query(q, orderBy("scheduledAt", "asc"));

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    scheduledAtTimestamp: d.data().scheduledAt,
    createdAtTimestamp: d.data().createdAt,
    completedAtTimestamp: d.data().completedAt,
  }));
}

/**
 * Get the next upcoming employee reminder
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Next reminder or null
 */
export async function getNextEmployeeReminder(userId) {
  if (!userId) return null;

  try {
    const now = new Date();
    const reminders = await getEmployeeReminders(userId, {
      includeCompleted: false,
      startDate: now,
    });

    // Filter to only future reminders
    const futureReminders = reminders.filter((r) => {
      const scheduledAt = r.scheduledAtTimestamp?.toDate?.() || new Date(r.scheduledAt);
      return scheduledAt > now;
    });

    if (futureReminders.length === 0) return null;

    // Return the earliest one
    return futureReminders[0];
  } catch (err) {
    console.error("Error getting next employee reminder:", err);
    return null;
  }
}

/**
 * Update an employee reminder
 * @param {string} userId - User ID
 * @param {string} reminderId - Reminder ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateEmployeeReminder(userId, reminderId, updates) {
  if (!userId) throw new Error("userId is required");
  if (!reminderId) throw new Error("reminderId is required");

  const reminderRef = doc(db, "users", userId, "reminders", reminderId);
  
  const updateData = { ...updates };
  
  // Convert Date objects to Timestamps
  if (updateData.scheduledAt instanceof Date) {
    updateData.scheduledAt = Timestamp.fromDate(updateData.scheduledAt);
  }
  
  if (updateData.completedAt instanceof Date) {
    updateData.completedAt = Timestamp.fromDate(updateData.completedAt);
  }

  await updateDoc(reminderRef, updateData);
}

/**
 * Mark an employee reminder as completed
 * @param {string} userId - User ID
 * @param {string} reminderId - Reminder ID
 * @returns {Promise<void>}
 */
export async function completeEmployeeReminder(userId, reminderId) {
  await updateEmployeeReminder(userId, reminderId, {
    completed: true,
    completedAt: Timestamp.now(),
  });
}

/**
 * Delete an employee reminder
 * @param {string} userId - User ID
 * @param {string} reminderId - Reminder ID
 * @returns {Promise<void>}
 */
export async function deleteEmployeeReminder(userId, reminderId) {
  if (!userId) throw new Error("userId is required");
  if (!reminderId) throw new Error("reminderId is required");

  const reminderRef = doc(db, "users", userId, "reminders", reminderId);
  await deleteDoc(reminderRef);
}

