// src/utils/togoOrderService.js
//
// TO-GO ORDER SERVICE
//
// Handles To-Go order creation, management, and tracking
// - Create orders
// - Update order status
// - Track orders
// - Restaurant order management

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../hooks/services/firebase";
import { createNotification, NOTIFICATION_TYPES, NOTIFICATION_PRIORITY } from "./notificationService";

/**
 * Order Status Enum
 */
export const ORDER_STATUS = {
  PENDING: "PENDING",           // Order placed, awaiting confirmation
  CONFIRMED: "CONFIRMED",        // Restaurant confirmed order
  PREPARING: "PREPARING",        // Order being prepared
  READY: "READY",               // Order ready for pickup
  PICKED_UP: "PICKED_UP",       // Customer picked up order
  CANCELLED: "CANCELLED",       // Order cancelled
  COMPLETED: "COMPLETED",       // Order completed
};

/**
 * Order Type
 */
export const ORDER_TYPE = {
  PICKUP: "PICKUP",
  DELIVERY: "DELIVERY",
};

/**
 * Create a To-Go order
 * 
 * @param {Object} params
 * @param {string} params.restaurantId - Restaurant ID
 * @param {string} params.dinerId - Diner user ID
 * @param {string} params.dinerName - Diner name
 * @param {string} params.dinerPhone - Diner phone
 * @param {string} params.dinerEmail - Diner email (optional)
 * @param {Array} params.items - Order items [{ menuItemId, name, price, quantity, specialInstructions }]
 * @param {string} params.orderType - "PICKUP" or "DELIVERY"
 * @param {Object} params.pickupInfo - Pickup information { preferredTime, notes }
 * @param {Object} params.deliveryInfo - Delivery information { address, preferredTime, notes }
 * @param {number} params.subtotal - Order subtotal
 * @param {number} params.tax - Tax amount
 * @param {number} params.deliveryFee - Delivery fee (if delivery)
 * @param {number} params.total - Total amount
 * @param {number} params.tip - Tip amount (optional)
 * @param {string} params.paymentMethodId - Stripe payment method ID
 * @param {string} params.paymentIntentId - Stripe payment intent ID (after payment processed)
 * @param {string} params.toGoWorkerId - To-go worker user ID (optional)
 * @param {string} params.toGoWorkerName - To-go worker name (optional)
 * @returns {Promise<string>} Order ID
 */
export async function createToGoOrder({
  restaurantId,
  dinerId,
  dinerName,
  dinerPhone,
  dinerEmail = null,
  items,
  orderType,
  pickupInfo = null,
  deliveryInfo = null,
  subtotal,
  tax,
  deliveryFee = 0,
  tip = 0,
  total,
  paymentMethodId,
  paymentIntentId = null,
  toGoWorkerId = null,
  toGoWorkerName = null,
}) {
  try {
    const orderRef = doc(collection(db, "restaurants", restaurantId, "togoOrders"));
    const orderId = orderRef.id;

    const orderData = {
      id: orderId,
      restaurantId,
      dinerId,
      dinerName,
      dinerPhone,
      dinerEmail,
      items: items.map((item) => ({
        menuItemId: item.menuItemId,
        name: item.name,
        price: Number(item.price),
        quantity: Number(item.quantity),
        specialInstructions: item.specialInstructions || null,
        subtotal: Number(item.price) * Number(item.quantity),
      })),
      orderType, // "PICKUP" or "DELIVERY"
      pickupInfo: orderType === ORDER_TYPE.PICKUP ? pickupInfo : null,
      deliveryInfo: orderType === ORDER_TYPE.DELIVERY ? deliveryInfo : null,
      subtotal: Number(subtotal),
      tax: Number(tax),
      deliveryFee: Number(deliveryFee),
      tip: Number(tip) || 0,
      total: Number(total),
      paymentMethodId,
      paymentIntentId,
      toGoWorkerId: toGoWorkerId || null,
      toGoWorkerName: toGoWorkerName || null,
      status: ORDER_STATUS.PENDING,
      statusHistory: [
        {
          status: ORDER_STATUS.PENDING,
          timestamp: serverTimestamp(),
          note: "Order placed",
        },
      ],
      estimatedReadyTime: null,
      actualReadyTime: null,
      pickedUpAt: null,
      cancelledAt: null,
      cancelledReason: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(orderRef, orderData);

    // Notify restaurant of new order
    await notifyRestaurantOfNewOrder(restaurantId, orderId, dinerName, total, orderType);

    // Notify diner of order confirmation
    await notifyDinerOfOrderConfirmation(dinerId, restaurantId, orderId, total);

    return orderId;
  } catch (error) {
    console.error("Error creating To-Go order:", error);
    throw error;
  }
}

/**
 * Get order by ID
 * 
 * @param {string} restaurantId - Restaurant ID
 * @param {string} orderId - Order ID
 * @returns {Promise<Object>} Order data
 */
export async function getToGoOrder(restaurantId, orderId) {
  try {
    const orderRef = doc(db, "restaurants", restaurantId, "togoOrders", orderId);
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()) {
      throw new Error("Order not found");
    }

    return {
      id: orderSnap.id,
      ...orderSnap.data(),
    };
  } catch (error) {
    console.error("Error getting To-Go order:", error);
    throw error;
  }
}

/**
 * Get orders for a restaurant
 * 
 * @param {string} restaurantId - Restaurant ID
 * @param {string} status - Filter by status (optional)
 * @param {number} limitCount - Limit results (default: 50)
 * @returns {Promise<Array>} Array of orders
 */
export async function getRestaurantToGoOrders(restaurantId, status = null, limitCount = 50) {
  try {
    const ordersRef = collection(db, "restaurants", restaurantId, "togoOrders");
    let q = query(ordersRef, orderBy("createdAt", "desc"), limit(limitCount));

    if (status) {
      q = query(ordersRef, where("status", "==", status), orderBy("createdAt", "desc"), limit(limitCount));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error getting restaurant To-Go orders:", error);
    return [];
  }
}

/**
 * Get orders for a diner
 * 
 * @param {string} dinerId - Diner user ID
 * @param {number} limitCount - Limit results (default: 50)
 * @returns {Promise<Array>} Array of orders
 */
export async function getDinerToGoOrders(dinerId, limitCount = 50) {
  try {
    // Query across all restaurants
    // Note: This requires a collection group query
    const ordersRef = collection(db, "togoOrders");
    const q = query(
      ordersRef,
      where("dinerId", "==", dinerId),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error getting diner To-Go orders:", error);
    // Fallback: Query each restaurant (less efficient)
    return [];
  }
}

/**
 * Update order status
 * 
 * @param {string} restaurantId - Restaurant ID
 * @param {string} orderId - Order ID
 * @param {string} newStatus - New status
 * @param {string} note - Optional note
 * @param {Date} estimatedReadyTime - Estimated ready time (optional)
 * @returns {Promise<void>}
 */
export async function updateOrderStatus(
  restaurantId,
  orderId,
  newStatus,
  note = null,
  estimatedReadyTime = null
) {
  try {
    const orderRef = doc(db, "restaurants", restaurantId, "togoOrders", orderId);
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()) {
      throw new Error("Order not found");
    }

    const orderData = orderSnap.data();
    const statusHistory = orderData.statusHistory || [];

    const updateData = {
      status: newStatus,
      statusHistory: [
        ...statusHistory,
        {
          status: newStatus,
          timestamp: serverTimestamp(),
          note: note || getStatusNote(newStatus),
        },
      ],
      updatedAt: serverTimestamp(),
    };

    if (estimatedReadyTime) {
      updateData.estimatedReadyTime = estimatedReadyTime;
    }

    if (newStatus === ORDER_STATUS.READY) {
      updateData.actualReadyTime = serverTimestamp();
    }

    if (newStatus === ORDER_STATUS.PICKED_UP) {
      updateData.pickedUpAt = serverTimestamp();
      updateData.status = ORDER_STATUS.COMPLETED;
    }

    if (newStatus === ORDER_STATUS.CANCELLED) {
      updateData.cancelledAt = serverTimestamp();
      if (note) {
        updateData.cancelledReason = note;
      }
    }

    await updateDoc(orderRef, updateData);

    // Notify diner of status change
    if (orderData.dinerId) {
      await notifyDinerOfStatusChange(
        orderData.dinerId,
        restaurantId,
        orderId,
        newStatus,
        estimatedReadyTime
      );
    }
  } catch (error) {
    console.error("Error updating order status:", error);
    throw error;
  }
}

/**
 * Cancel order
 * 
 * @param {string} restaurantId - Restaurant ID
 * @param {string} orderId - Order ID
 * @param {string} reason - Cancellation reason
 * @param {boolean} isDinerCancellation - True if diner cancelled, false if restaurant cancelled
 * @returns {Promise<void>}
 */
export async function cancelOrder(restaurantId, orderId, reason, isDinerCancellation = false) {
  try {
    await updateOrderStatus(restaurantId, orderId, ORDER_STATUS.CANCELLED, reason);

    // If restaurant cancelled, notify diner
    if (!isDinerCancellation) {
      const order = await getToGoOrder(restaurantId, orderId);
      if (order.dinerId) {
        await createNotification({
          userId: order.dinerId,
          restaurantId,
          type: NOTIFICATION_TYPES.TOGO_ORDER_CANCELLED,
          priority: NOTIFICATION_PRIORITY.HIGH,
          title: "Order Cancelled",
          message: `Your order from ${order.restaurantName || "the restaurant"} has been cancelled. ${reason ? `Reason: ${reason}` : ""}`,
          actionUrl: `/togo/order/${orderId}?restaurantId=${restaurantId}`,
          metadata: {
            orderId,
            reason,
          },
        });
      }
    }
  } catch (error) {
    console.error("Error cancelling order:", error);
    throw error;
  }
}

/**
 * Subscribe to order updates
 * 
 * @param {string} restaurantId - Restaurant ID
 * @param {string} orderId - Order ID
 * @param {Function} callback - Callback function
 * @returns {Function} Unsubscribe function
 */
export function subscribeToOrder(restaurantId, orderId, callback) {
  const orderRef = doc(db, "restaurants", restaurantId, "togoOrders", orderId);
  
  return onSnapshot(orderRef, (snapshot) => {
    if (snapshot.exists()) {
      callback({
        id: snapshot.id,
        ...snapshot.data(),
      });
    } else {
      callback(null);
    }
  });
}

/**
 * Subscribe to restaurant orders
 * 
 * @param {string} restaurantId - Restaurant ID
 * @param {Function} callback - Callback function
 * @param {string} status - Filter by status (optional)
 * @returns {Function} Unsubscribe function
 */
export function subscribeToRestaurantOrders(restaurantId, callback, status = null) {
  const ordersRef = collection(db, "restaurants", restaurantId, "togoOrders");
  let q = query(ordersRef, orderBy("createdAt", "desc"), limit(50));

  if (status) {
    q = query(ordersRef, where("status", "==", status), orderBy("createdAt", "desc"), limit(50));
  }

  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(orders);
  });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get status note for status change
 */
function getStatusNote(status) {
  const notes = {
    [ORDER_STATUS.CONFIRMED]: "Order confirmed by restaurant",
    [ORDER_STATUS.PREPARING]: "Order is being prepared",
    [ORDER_STATUS.READY]: "Order is ready for pickup",
    [ORDER_STATUS.PICKED_UP]: "Order picked up",
    [ORDER_STATUS.CANCELLED]: "Order cancelled",
    [ORDER_STATUS.COMPLETED]: "Order completed",
  };
  return notes[status] || "Status updated";
}

/**
 * Notify restaurant of new order
 */
async function notifyRestaurantOfNewOrder(restaurantId, orderId, dinerName, total, orderType) {
  try {
    // Get restaurant managers/admins
    const restaurantRef = doc(db, "restaurants", restaurantId);
    const restaurantSnap = await getDoc(restaurantRef);
    
    if (restaurantSnap.exists()) {
      const restaurantData = restaurantSnap.data();
      const companyId = restaurantData.companyId;

      // Notify company admins
      if (companyId) {
        const companyUsersRef = collection(db, "companies", companyId, "users");
        const companyUsersSnap = await getDocs(companyUsersRef);
        
        companyUsersSnap.forEach((userDoc) => {
          const userId = userDoc.id;
          createNotification({
            userId,
            restaurantId,
            companyId,
            type: NOTIFICATION_TYPES.TOGO_ORDER_NEW,
            priority: NOTIFICATION_PRIORITY.HIGH,
            title: "New To-Go Order",
            message: `New ${orderType.toLowerCase()} order from ${dinerName} - $${total.toFixed(2)}`,
            actionUrl: `/dashboard/restaurant/${restaurantId}?tab=togo-orders&orderId=${orderId}`,
            metadata: {
              orderId,
              dinerName,
              total,
              orderType,
            },
          }).catch((err) => console.error("Error creating notification:", err));
        });
      }
    }
  } catch (error) {
    console.error("Error notifying restaurant of new order:", error);
    // Don't throw - notification failure shouldn't fail order creation
  }
}

/**
 * Notify diner of order confirmation
 */
async function notifyDinerOfOrderConfirmation(dinerId, restaurantId, orderId, total) {
  try {
    await createNotification({
      userId: dinerId,
      restaurantId,
      type: NOTIFICATION_TYPES.TOGO_ORDER_CONFIRMED,
      priority: NOTIFICATION_PRIORITY.MEDIUM,
      title: "Order Confirmed",
      message: `Your order has been received and is being processed. Total: $${total.toFixed(2)}`,
      actionUrl: `/togo/order/${orderId}?restaurantId=${restaurantId}`,
      metadata: {
        orderId,
        total,
      },
    });
  } catch (error) {
    console.error("Error notifying diner of order confirmation:", error);
  }
}

/**
 * Notify diner of status change
 */
async function notifyDinerOfStatusChange(dinerId, restaurantId, orderId, newStatus, estimatedReadyTime) {
  try {
    const statusMessages = {
      [ORDER_STATUS.CONFIRMED]: "Your order has been confirmed",
      [ORDER_STATUS.PREPARING]: "Your order is being prepared",
      [ORDER_STATUS.READY]: "Your order is ready for pickup!",
      [ORDER_STATUS.COMPLETED]: "Thank you for your order!",
    };

    const message = statusMessages[newStatus] || "Your order status has been updated";
    const estimatedTime = estimatedReadyTime
      ? ` Estimated ready time: ${new Date(estimatedReadyTime).toLocaleTimeString()}`
      : "";

    await createNotification({
      userId: dinerId,
      restaurantId,
      type: NOTIFICATION_TYPES.TOGO_ORDER_STATUS_UPDATE,
      priority: newStatus === ORDER_STATUS.READY ? NOTIFICATION_PRIORITY.HIGH : NOTIFICATION_PRIORITY.MEDIUM,
      title: "Order Update",
      message: `${message}${estimatedTime}`,
      actionUrl: `/togo/order/${orderId}?restaurantId=${restaurantId}`,
      metadata: {
        orderId,
        status: newStatus,
        estimatedReadyTime,
      },
    });
  } catch (error) {
    console.error("Error notifying diner of status change:", error);
  }
}

