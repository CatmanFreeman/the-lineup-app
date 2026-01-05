// src/utils/pointsService.js

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
    increment,
    writeBatch,
  } from "firebase/firestore";
  import { db } from "../hooks/services/firebase";
  
  /**
   * Point Action Types
   */
  export const POINT_ACTION = {
    // Diner actions
    REVIEW: "review",
    CHECK_IN: "check_in",
    PHOTO_UPLOAD: "photo_upload",
    TIP: "tip",
    INVITE: "invite",
    RESERVATION: "reservation",
    
    // Employee actions
    SHIFT_COMPLETE: "shift_complete",
    PUNCH_IN: "punch_in",
    PUNCH_OUT: "punch_out",
    PUNCH_OUT_ON_TIME: "punch_out_on_time",
    PERFORMANCE: "performance",
    SHIFT_GAME: "shift_game",
    ATTENDANCE: "attendance",
    
    // Badge-related
    BADGE_EARNED: "badge_earned",
    
    // Store
    STORE_PURCHASE: "store_purchase",
  };
  
  /**
   * Point Values (configurable)
   */
  export const POINT_VALUES = {
    [POINT_ACTION.REVIEW]: 50,
    [POINT_ACTION.CHECK_IN]: 10,
    [POINT_ACTION.PHOTO_UPLOAD]: 15,
    [POINT_ACTION.TIP]: 25,
    [POINT_ACTION.INVITE]: 100,
    [POINT_ACTION.RESERVATION]: 20,
    
    [POINT_ACTION.SHIFT_COMPLETE]: 100,
    [POINT_ACTION.PUNCH_IN]: 5,
    [POINT_ACTION.PUNCH_OUT]: 5,
    [POINT_ACTION.PUNCH_OUT_ON_TIME]: 10,
    [POINT_ACTION.PERFORMANCE]: 50,
    [POINT_ACTION.SHIFT_GAME]: 25,
    [POINT_ACTION.ATTENDANCE]: 20,
    
    [POINT_ACTION.BADGE_EARNED]: 0, // Set per badge
    [POINT_ACTION.STORE_PURCHASE]: 0, // Deduction
  };
  
  /**
   * Award points to a user
   */
  export async function awardPoints({
    userId,
    points,
    reason,
    action = null,
    source = "system",
    sourceId = null,
    restaurantId = null,
    companyId = null,
  }) {
    try {
      // Get or create user points document
      const pointsRef = doc(db, "users", userId, "lineupPoints", "balance");
      const pointsSnap = await getDoc(pointsRef);
  
      const currentTotal = pointsSnap.exists() ? pointsSnap.data().total || 0 : 0;
      const currentEarned = pointsSnap.exists() ? pointsSnap.data().earned || 0 : 0;
  
      // Update balance
      await setDoc(
        pointsRef,
        {
          total: currentTotal + points,
          earned: currentEarned + points,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
  
      // Record transaction
      const transactionRef = doc(collection(db, "users", userId, "lineupPoints", "transactions"));
      await setDoc(transactionRef, {
        points,
        reason,
        action: action || reason,
        source,
        sourceId,
        restaurantId,
        companyId,
        type: "earned",
        balanceAfter: currentTotal + points,
        createdAt: serverTimestamp(),
      });
  
      return {
        newTotal: currentTotal + points,
        transactionId: transactionRef.id,
      };
    } catch (error) {
      console.error("Error awarding points:", error);
      throw error;
    }
  }
  
  /**
   * Deduct points from a user (for store purchases)
   */
  export async function deductPoints({
    userId,
    points,
    reason,
    source = "store",
    sourceId = null,
  }) {
    try {
      const pointsRef = doc(db, "users", userId, "lineupPoints", "balance");
      const pointsSnap = await getDoc(pointsRef);
  
      if (!pointsSnap.exists()) {
        throw new Error("User has no points balance");
      }
  
      const currentTotal = pointsSnap.data().total || 0;
      const currentSpent = pointsSnap.data().spent || 0;
  
      if (currentTotal < points) {
        throw new Error("Insufficient points");
      }
  
      // Update balance
      await setDoc(
        pointsRef,
        {
          total: currentTotal - points,
          spent: currentSpent + points,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
  
      // Record transaction
      const transactionRef = doc(collection(db, "users", userId, "lineupPoints", "transactions"));
      await setDoc(transactionRef, {
        points: -points,
        reason,
        source,
        sourceId,
        type: "spent",
        balanceAfter: currentTotal - points,
        createdAt: serverTimestamp(),
      });
  
      return {
        newTotal: currentTotal - points,
        transactionId: transactionRef.id,
      };
    } catch (error) {
      console.error("Error deducting points:", error);
      throw error;
    }
  }
  
  /**
   * Get user's point balance
   */
  export async function getPointsBalance(userId) {
    try {
      const pointsRef = doc(db, "users", userId, "lineupPoints", "balance");
      const pointsSnap = await getDoc(pointsRef);
  
      if (!pointsSnap.exists()) {
        return {
          total: 0,
          earned: 0,
          spent: 0,
        };
      }
  
      const data = pointsSnap.data();
      return {
        total: data.total || 0,
        earned: data.earned || 0,
        spent: data.spent || 0,
      };
    } catch (error) {
      console.error("Error getting points balance:", error);
      return {
        total: 0,
        earned: 0,
        spent: 0,
      };
    }
  }
  
  /**
   * Get point transactions history
   */
  export async function getPointTransactions(userId, limitCount = 50) {
    try {
      const transactionsRef = collection(db, "users", userId, "lineupPoints", "transactions");
      const snapshot = await getDocs(
        query(transactionsRef, orderBy("createdAt", "desc"), limit(limitCount))
      );
  
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error("Error getting point transactions:", error);
      return [];
    }
  }
  
  /**
   * Award points for a specific action
   */
  export async function awardPointsForAction({
    userId,
    action,
    reason = null,
    source = "system",
    sourceId = null,
    restaurantId = null,
    companyId = null,
    customPoints = null,
  }) {
    const points = customPoints !== null ? customPoints : POINT_VALUES[action] || 0;
  
    if (points <= 0) {
      console.warn(`No points configured for action: ${action}`);
      return null;
    }
  
    return await awardPoints({
      userId,
      points,
      reason: reason || `Points for ${action}`,
      action,
      source,
      sourceId,
      restaurantId,
      companyId,
    });
  }