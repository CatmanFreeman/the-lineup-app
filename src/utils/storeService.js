// src/utils/storeService.js

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../hooks/services/firebase";
import { deductPoints } from "./pointsService";

/**
 * Store Item Types
 */
export const STORE_ITEM_TYPE = {
  GIFT_CARD: "gift_card",
  EXPERIENCE: "experience",
  PRODUCT: "product",
};

/**
 * Store Item Status
 */
export const STORE_ITEM_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  SOLD_OUT: "sold_out",
};

/**
 * Create a store item (for admin/restaurant use)
 */
export async function createStoreItem({
  name,
  description,
  type,
  pointsCost,
  restaurantId = null,
  vendorId = null,
  imageUrl = null,
  giftCardValue = null, // For gift cards, the dollar value
  quantity = null, // null = unlimited
  status = STORE_ITEM_STATUS.ACTIVE,
}) {
  try {
    const itemsRef = collection(db, "storeItems");
    const itemRef = doc(itemsRef);

    await setDoc(itemRef, {
      name,
      description,
      type,
      pointsCost,
      restaurantId,
      vendorId,
      imageUrl,
      giftCardValue,
      quantity,
      availableQuantity: quantity,
      status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { id: itemRef.id };
  } catch (error) {
    console.error("Error creating store item:", error);
    throw error;
  }
}

/**
 * Get all active store items
 */
export async function getStoreItems({
  type = null,
  restaurantId = null,
  limitCount = 100,
} = {}) {
  try {
    const itemsRef = collection(db, "storeItems");
    let q = query(itemsRef, where("status", "==", STORE_ITEM_STATUS.ACTIVE));

    if (type) {
      q = query(q, where("type", "==", type));
    }

    if (restaurantId) {
      q = query(q, where("restaurantId", "==", restaurantId));
    }

    q = query(q, orderBy("pointsCost", "asc"), limit(limitCount));

    const snapshot = await getDocs(q);
    const items = [];

    snapshot.forEach((doc) => {
      items.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return items;
  } catch (error) {
    console.error("Error getting store items:", error);
    return [];
  }
}

/**
 * Get a single store item by ID
 */
export async function getStoreItem(itemId) {
  try {
    const itemRef = doc(db, "storeItems", itemId);
    const itemSnap = await getDoc(itemRef);

    if (!itemSnap.exists()) {
      return null;
    }

    return {
      id: itemSnap.id,
      ...itemSnap.data(),
    };
  } catch (error) {
    console.error("Error getting store item:", error);
    return null;
  }
}

/**
 * Purchase a store item with points
 */
export async function purchaseStoreItem({
  userId,
  itemId,
  quantity = 1,
}) {
  try {
    // Get the item
    const item = await getStoreItem(itemId);
    if (!item) {
      throw new Error("Item not found");
    }

    if (item.status !== STORE_ITEM_STATUS.ACTIVE) {
      throw new Error("Item is not available");
    }

    // Check quantity
    if (item.quantity !== null && item.availableQuantity < quantity) {
      throw new Error("Insufficient quantity available");
    }

    const totalCost = item.pointsCost * quantity;

    // Deduct points
    await deductPoints({
      userId,
      points: totalCost,
      reason: `Purchased ${quantity}x ${item.name}`,
      source: "store",
      sourceId: itemId,
    });

    // Update item quantity if limited
    if (item.quantity !== null) {
      const itemRef = doc(db, "storeItems", itemId);
      await setDoc(
        itemRef,
        {
          availableQuantity: item.availableQuantity - quantity,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    // Create purchase record
    const purchaseRef = doc(collection(db, "users", userId, "storePurchases"));
    await setDoc(purchaseRef, {
      itemId,
      itemName: item.name,
      itemType: item.type,
      quantity,
      pointsCost: totalCost,
      giftCardValue: item.giftCardValue,
      restaurantId: item.restaurantId,
      status: "completed",
      createdAt: serverTimestamp(),
    });

    return {
      purchaseId: purchaseRef.id,
      item,
      pointsSpent: totalCost,
    };
  } catch (error) {
    console.error("Error purchasing store item:", error);
    throw error;
  }
}

/**
 * Get user's purchase history
 */
export async function getUserPurchases(userId, limitCount = 50) {
  try {
    const purchasesRef = collection(db, "users", userId, "storePurchases");
    const q = query(
      purchasesRef,
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    const purchases = [];

    snapshot.forEach((doc) => {
      purchases.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return purchases;
  } catch (error) {
    console.error("Error getting user purchases:", error);
    return [];
  }
}

