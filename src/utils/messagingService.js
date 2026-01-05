// src/utils/messagingService.js

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { db } from "../hooks/services/firebase";

const COMPANY_ID = "company-demo";

/**
 * Messaging Service
 * 
 * Messaging rules:
 * - Company Dashboard ↔ Restaurant Dashboard (can message each other)
 * - Restaurant Dashboard ↔ Employee Dashboard (can message each other)
 * - Employees CANNOT message other employees
 * - Diners CANNOT message employees (except through TipShare)
 * - Diners CANNOT message other diners
 */

/**
 * Get conversations for a user based on their role
 */
export async function getConversations({ userId, userType, restaurantId, companyId }) {
  try {
    let conversationsRef;
    
    if (userType === "company") {
      // Company can message restaurants
      conversationsRef = collection(db, "companies", companyId || COMPANY_ID, "messages");
    } else if (userType === "restaurant") {
      // Restaurant can message company and employees
      conversationsRef = collection(db, "restaurants", restaurantId, "messages");
    } else if (userType === "employee") {
      // Employee can only message restaurant
      conversationsRef = collection(db, "restaurants", restaurantId, "messages");
    } else {
      throw new Error("Invalid user type");
    }

    const q = query(
      conversationsRef,
      where("participants", "array-contains", userId),
      orderBy("lastMessageAt", "desc"),
      limit(50)
    );

    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
  } catch (error) {
    console.error("Error loading conversations:", error);
    return [];
  }
}

/**
 * Get recipients based on user type
 */
export async function getRecipients({ userId, userType, restaurantId, companyId }) {
  try {
    const recipients = [];

    if (userType === "company") {
      // Company can message restaurants
      const restaurantsRef = collection(db, "restaurants");
      const restaurantsSnap = await getDocs(restaurantsRef);
      
      restaurantsSnap.docs.forEach((doc) => {
        const data = doc.data();
        recipients.push({
          id: doc.id,
          name: data.name || doc.id,
          type: "restaurant",
          restaurantId: doc.id,
        });
      });
    } else if (userType === "restaurant") {
      // Restaurant can message company and employees
      // Add company
      recipients.push({
        id: `company-${companyId || COMPANY_ID}`,
        name: "Company Dashboard",
        type: "company",
        companyId: companyId || COMPANY_ID,
      });

      // Add employees
      const staffRef = collection(db, "restaurants", restaurantId, "staff");
      const staffSnap = await getDocs(staffRef);
      
      staffSnap.docs.forEach((doc) => {
        const data = doc.data();
        const staffUid = data.uid || doc.id;
        if (staffUid !== userId) {
          recipients.push({
            id: staffUid,
            name: data.name || doc.id,
            type: "employee",
            employeeId: doc.id,
            restaurantId: restaurantId,
          });
        }
      });
    } else if (userType === "employee") {
      // Employee can message restaurant management and same-department employees
      // First, get the employee's role (FOH or BOH)
      let employeeRole = null;
      if (userId) {
        try {
          const staffRef = collection(db, "restaurants", restaurantId, "staff");
          const staffSnap = await getDocs(staffRef);
          for (const docSnap of staffSnap.docs) {
            const data = docSnap.data();
            const staffUid = data.uid || docSnap.id;
            if (staffUid === userId) {
              employeeRole = data.role; // "Front of House" or "Back of House"
              break;
            }
          }
        } catch (err) {
          console.error("Error loading employee role:", err);
        }
      }

      // Always add restaurant management
      const restaurantRef = doc(db, "restaurants", restaurantId);
      const restaurantSnap = await getDoc(restaurantRef);
      
      if (restaurantSnap.exists()) {
        const data = restaurantSnap.data();
        recipients.push({
          id: `restaurant-${restaurantId}`,
          name: data.name || "Restaurant Management",
          type: "restaurant",
          restaurantId: restaurantId,
        });
      }

      // Add employees from same department (FOH to FOH, BOH to BOH)
      if (employeeRole) {
        const staffRef = collection(db, "restaurants", restaurantId, "staff");
        const staffSnap = await getDocs(staffRef);
        
        staffSnap.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const staffUid = data.uid || docSnap.id;
          
          // Skip self
          if (staffUid === userId) return;
          
          // Only add if same department
          if (data.role === employeeRole) {
            recipients.push({
              id: staffUid,
              name: data.name || "Employee",
              type: "employee",
              employeeId: docSnap.id,
              restaurantId: restaurantId,
            });
          }
        });
      }
    }

    return recipients;
  } catch (error) {
    console.error("Error loading recipients:", error);
    return [];
  }
}

/**
 * Send a message
 */
export async function sendMessage({
  senderId,
  senderName,
  senderType,
  recipientId,
  recipientName,
  recipientType,
  text,
  restaurantId,
  companyId,
  conversationId = null,
}) {
  try {
    let conversationsRef;
    let conversationDocId = conversationId;

    // Determine conversation collection path
    if (senderType === "company" && recipientType === "restaurant") {
      conversationsRef = collection(db, "companies", companyId || COMPANY_ID, "messages");
    } else if (senderType === "restaurant" && recipientType === "company") {
      conversationsRef = collection(db, "companies", companyId || COMPANY_ID, "messages");
    } else if ((senderType === "restaurant" || senderType === "employee") && 
               (recipientType === "restaurant" || recipientType === "employee")) {
      conversationsRef = collection(db, "restaurants", restaurantId, "messages");
    } else {
      throw new Error("Invalid messaging relationship");
    }

    // Create or get conversation
    if (!conversationDocId) {
      const newConvoRef = doc(conversationsRef);
      conversationDocId = newConvoRef.id;

      await addDoc(conversationsRef, {
        id: conversationDocId,
        participants: [senderId, recipientId],
        participantNames: {
          [senderId]: senderName,
          [recipientId]: recipientName,
        },
        participantTypes: {
          [senderId]: senderType,
          [recipientId]: recipientType,
        },
        lastMessage: text.trim(),
        lastMessageAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        unreadCount: {
          [senderId]: 0,
          [recipientId]: 1,
        },
        restaurantId: restaurantId || null,
        companyId: companyId || null,
      });
    }

    // Add message to conversation
    const messagesRef = collection(conversationsRef, conversationDocId, "messages");
    await addDoc(messagesRef, {
      senderId: senderId,
      senderName: senderName,
      senderType: senderType,
      text: text.trim(),
      createdAt: serverTimestamp(),
    });

    // Update conversation
    const conversationRef = doc(conversationsRef, conversationDocId);
    await updateDoc(conversationRef, {
      lastMessage: text.trim(),
      lastMessageAt: serverTimestamp(),
      [`unreadCount.${recipientId}`]: 1,
    });

    return conversationDocId;
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
}

/**
 * Get messages for a conversation
 */
export async function getMessages({ conversationId, senderType, restaurantId, companyId }) {
  try {
    let messagesRef;

    if (senderType === "company") {
      messagesRef = collection(db, "companies", companyId || COMPANY_ID, "messages", conversationId, "messages");
    } else {
      messagesRef = collection(db, "restaurants", restaurantId, "messages", conversationId, "messages");
    }

    const q = query(messagesRef, orderBy("createdAt", "asc"), limit(100));
    const snap = await getDocs(q);
    
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
  } catch (error) {
    console.error("Error loading messages:", error);
    return [];
  }
}

/**
 * Mark conversation as read
 */
export async function markConversationAsRead({
  conversationId,
  userId,
  senderType,
  restaurantId,
  companyId,
}) {
  try {
    let conversationRef;

    if (senderType === "company") {
      conversationRef = doc(db, "companies", companyId || COMPANY_ID, "messages", conversationId);
    } else {
      conversationRef = doc(db, "restaurants", restaurantId, "messages", conversationId);
    }

    await updateDoc(conversationRef, {
      [`unreadCount.${userId}`]: 0,
    });
  } catch (error) {
    console.error("Error marking conversation as read:", error);
  }
}

/**
 * Set up real-time listener for messages
 */
export function subscribeToMessages({
  conversationId,
  senderType,
  restaurantId,
  companyId,
  callback,
}) {
  try {
    let messagesRef;

    if (senderType === "company") {
      messagesRef = collection(db, "companies", companyId || COMPANY_ID, "messages", conversationId, "messages");
    } else {
      messagesRef = collection(db, "restaurants", restaurantId, "messages", conversationId, "messages");
    }

    const q = query(messagesRef, orderBy("createdAt", "asc"), limit(100));
    
    return onSnapshot(q, (snap) => {
      const messages = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      callback(messages);
    });
  } catch (error) {
    console.error("Error setting up message listener:", error);
    return () => {};
  }
}

