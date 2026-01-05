// src/utils/bowlingInventoryService.js
//
// BOWLING INVENTORY SERVICE
//
// Provides bowling inventory data to restaurant inventory tab
// Bowling inventory is the source of truth - feeds into restaurant inventory

import {
  collection,
  doc,
  getDocs,
  getDoc,
} from "firebase/firestore";
import { db } from "../hooks/services/firebase";

/**
 * Get bowling inventory summary for restaurant inventory tab
 * @param {string} restaurantId - Restaurant ID
 * @returns {Promise<Object>} Summary of bowling inventory
 */
export async function getBowlingInventorySummary(restaurantId) {
  try {
    const [ballsSnap, shoesSnap, pinsSnap] = await Promise.all([
      getDocs(collection(db, "restaurants", restaurantId, "bowlingBalls")),
      getDocs(collection(db, "restaurants", restaurantId, "bowlingShoes")),
      getDoc(doc(db, "restaurants", restaurantId, "bowlingInventory", "pins")),
    ]);

    const balls = ballsSnap.docs.map((d) => d.data());
    const shoes = shoesSnap.docs.map((d) => d.data());
    const pinsData = pinsSnap.exists() ? pinsSnap.data() : { total: 0 };

    // Count items by condition
    const ballsByCondition = {
      excellent: balls.filter((b) => b.condition === "excellent").length,
      good: balls.filter((b) => b.condition === "good").length,
      fair: balls.filter((b) => b.condition === "fair").length,
      poor: balls.filter((b) => b.condition === "poor").length,
      needs_replacement: balls.filter((b) => b.condition === "needs_replacement").length,
    };

    const shoesByCondition = {
      excellent: shoes.filter((s) => s.condition === "excellent").length,
      good: shoes.filter((s) => s.condition === "good").length,
      fair: shoes.filter((s) => s.condition === "fair").length,
      poor: shoes.filter((s) => s.condition === "poor").length,
      needs_replacement: shoes.filter((s) => s.condition === "needs_replacement").length,
    };

    return {
      balls: {
        total: balls.length,
        byCondition: ballsByCondition,
        needsReplacement: ballsByCondition.needs_replacement,
      },
      shoes: {
        total: shoes.length,
        byCondition: shoesByCondition,
        needsReplacement: shoesByCondition.needs_replacement,
        bySize: shoes.reduce((acc, shoe) => {
          const size = shoe.size;
          acc[size] = (acc[size] || 0) + 1;
          return acc;
        }, {}),
      },
      pins: {
        total: pinsData.total || 0,
      },
      lastUpdated: pinsData.updatedAt || null,
    };
  } catch (error) {
    console.error("Error getting bowling inventory summary:", error);
    return {
      balls: { total: 0, byCondition: {}, needsReplacement: 0 },
      shoes: { total: 0, byCondition: {}, needsReplacement: 0, bySize: {} },
      pins: { total: 0 },
      lastUpdated: null,
    };
  }
}

/**
 * Get items that need replacement
 * @param {string} restaurantId - Restaurant ID
 * @returns {Promise<Array>} Array of items needing replacement
 */
export async function getItemsNeedingReplacement(restaurantId) {
  try {
    const [ballsSnap, shoesSnap] = await Promise.all([
      getDocs(collection(db, "restaurants", restaurantId, "bowlingBalls")),
      getDocs(collection(db, "restaurants", restaurantId, "bowlingShoes")),
    ]);

    const items = [];

    ballsSnap.docs.forEach((d) => {
      const ball = d.data();
      if (ball.condition === "needs_replacement" || ball.condition === "poor") {
        items.push({
          type: "ball",
          id: d.id,
          weight: ball.weight,
          condition: ball.condition,
          photoURL: ball.photoURL,
        });
      }
    });

    shoesSnap.docs.forEach((d) => {
      const shoe = d.data();
      if (shoe.condition === "needs_replacement" || shoe.condition === "poor") {
        items.push({
          type: "shoe",
          id: d.id,
          size: shoe.size,
          edition: shoe.edition,
          condition: shoe.condition,
          photoURL: shoe.photoURL,
        });
      }
    });

    return items;
  } catch (error) {
    console.error("Error getting items needing replacement:", error);
    return [];
  }
}

