// src/utils/badgeService.js

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
    serverTimestamp,
    writeBatch,
  } from "firebase/firestore";
  import { db } from "../hooks/services/firebase";
  
  /**
   * Badge Types
   */
  export const BADGE_TYPE = {
    DINER: "diner",
    EMPLOYEE_SYSTEM: "employee_system",
    EMPLOYEE_RESTAURANT: "employee_restaurant",
    RESTAURANT: "restaurant", // Company can award to restaurants
  };
  
  /**
   * Badge Categories
   */
  export const BADGE_CATEGORY = {
    // Diner categories
    REVIEW: "review",
    CHECK_IN: "check_in",
    RATING: "rating",
    CUISINE: "cuisine",
    SOCIAL: "social",
    PLATFORM: "platform",
    CRITIC: "critic",
    
    // Employee categories
    TENURE: "tenure",
    PERFORMANCE: "performance",
    SKILL: "skill",
    SHIFT: "shift",
    ATTENDANCE: "attendance",
    MANAGER_AWARD: "manager_award",
    
    // Restaurant categories
    RESTAURANT_AWARD: "restaurant_award",
    RESTAURANT_ACHIEVEMENT: "restaurant_achievement",
  };
  
  /**
   * Badge Rarity (for sorting/display priority)
   */
  export const BADGE_RARITY = {
    COMMON: 1,
    UNCOMMON: 2,
    RARE: 3,
    EPIC: 4,
    LEGENDARY: 5,
  };
  
  /**
   * Award a badge to a user
   */
  export async function awardBadge({
    badgeId,
    badgeData,
    userId,
    restaurantId = null,
    companyId = null,
    awardedBy = "system",
    requiresApproval = false,
  }) {
    try {
      const badgeRef = doc(
        collection(db, "users", userId, "badges")
      );
  
      const badgeDoc = {
        badgeId,
        ...badgeData,
        userId,
        restaurantId: restaurantId || null,
        companyId: companyId || null,
        awardedBy,
        requiresApproval,
        status: requiresApproval ? "pending" : "approved",
        awardedAt: serverTimestamp(),
        approvedAt: requiresApproval ? null : serverTimestamp(),
        approvedBy: requiresApproval ? null : awardedBy,
      };
  
      await setDoc(badgeRef, badgeDoc);
  
      // If badge awards points, add points
      if (badgeData.pointsValue && badgeData.pointsValue > 0) {
        const { awardPoints } = await import("./pointsService");
        await awardPoints({
          userId,
          points: badgeData.pointsValue,
          reason: `Badge earned: ${badgeData.name}`,
          source: "badge",
          sourceId: badgeRef.id,
        });
      }
  
      // Send notification if badge is approved and manually awarded (not auto-award to avoid spam)
      // Auto-awards will send notifications from autoAwardService
      if (!requiresApproval && awardedBy !== "system") {
        try {
          const { notifyBadgeEarned } = await import("./notificationService");
          await notifyBadgeEarned({
            userId,
            restaurantId,
            companyId,
            badgeName: badgeData.name,
            badgeIcon: badgeData.icon,
            pointsValue: badgeData.pointsValue || 0,
            badgeId,
          });
        } catch (notifError) {
          console.error("Error sending badge notification:", notifError);
          // Don't fail badge award if notification fails
        }
      }
  
      return badgeRef.id;
    } catch (error) {
      console.error("Error awarding badge:", error);
      throw error;
    }
  }
  
  /**
   * Award a badge to a restaurant (from company)
   */
  export async function awardRestaurantBadge({
    badgeId,
    badgeData,
    restaurantId,
    companyId,
    awardedBy,
  }) {
    try {
      const badgeRef = doc(
        collection(db, "restaurants", restaurantId, "badges")
      );
  
      const badgeDoc = {
        badgeId,
        ...badgeData,
        restaurantId,
        companyId,
        awardedBy,
        status: "approved",
        awardedAt: serverTimestamp(),
        approvedAt: serverTimestamp(),
        approvedBy: awardedBy,
      };
  
      await setDoc(badgeRef, badgeDoc);
      return badgeRef.id;
    } catch (error) {
      console.error("Error awarding restaurant badge:", error);
      throw error;
    }
  }
  
  /**
   * Get all badges for a user (merged view)
   */
  export async function getUserBadges(userId, options = {}) {
    try {
      const {
        includeRestaurant = true,
        restaurantId = null,
        type = null,
      } = options;
  
      const badgesRef = collection(db, "users", userId, "badges");
      
      let q = query(badgesRef, where("status", "==", "approved"));
      
      if (restaurantId) {
        q = query(
          badgesRef,
          where("status", "==", "approved"),
          where("restaurantId", "in", [restaurantId, null])
        );
      }
  
      const snapshot = await getDocs(q);
      const badges = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
  
      // Sort by rarity (highest first), then by awardedAt (newest first)
      badges.sort((a, b) => {
        const rarityDiff = (b.rarity || 1) - (a.rarity || 1);
        if (rarityDiff !== 0) return rarityDiff;
        
        const aTime = a.awardedAt?.toDate?.()?.getTime() || 0;
        const bTime = b.awardedAt?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });
  
      return badges;
    } catch (error) {
      console.error("Error getting user badges:", error);
      return [];
    }
  }
  
  /**
   * Get top badges for homepage display (up to 16, most brag-worthy)
   */
  export async function getTopBadgesForHomepage(userId, restaurantId = null) {
    const allBadges = await getUserBadges(userId, { restaurantId });
    
    // Filter to most brag-worthy (highest rarity, then newest)
    // Limit to 16 badges
    return allBadges.slice(0, 16);
  }
  
  /**
   * Get badges by category for profile display
   */
  export async function getBadgesByCategory(userId, category, restaurantId = null) {
    const allBadges = await getUserBadges(userId, { restaurantId });
    return allBadges.filter((badge) => badge.category === category);
  }
  
  /**
   * Get diner badges only
   */
  export async function getDinerBadges(userId) {
    const allBadges = await getUserBadges(userId);
    return allBadges.filter((badge) => badge.type === BADGE_TYPE.DINER);
  }
  
  /**
   * Get employee badges only
   */
  export async function getEmployeeBadges(userId, restaurantId = null) {
    const allBadges = await getUserBadges(userId, { restaurantId });
    return allBadges.filter(
      (badge) =>
        badge.type === BADGE_TYPE.EMPLOYEE_SYSTEM ||
        badge.type === BADGE_TYPE.EMPLOYEE_RESTAURANT
    );
  }
  
  /**
   * Get restaurant badges
   */
  export async function getRestaurantBadges(restaurantId) {
    try {
      const badgesRef = collection(db, "restaurants", restaurantId, "badges");
      const snapshot = await getDocs(
        query(badgesRef, where("status", "==", "approved"), orderBy("awardedAt", "desc"))
      );
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error("Error getting restaurant badges:", error);
      return [];
    }
  }
  
  /**
   * Approve a pending badge (for badges requiring approval like Sommelier)
   */
  export async function approveBadge(userId, badgeId, approvedBy) {
    try {
      const badgeRef = doc(db, "users", userId, "badges", badgeId);
      await updateDoc(badgeRef, {
        status: "approved",
        approvedAt: serverTimestamp(),
        approvedBy,
      });
  
      // Award points if badge has point value
      const badgeSnap = await getDoc(badgeRef);
      const badgeData = badgeSnap.data();
      if (badgeData.pointsValue && badgeData.pointsValue > 0) {
        const { awardPoints } = await import("./pointsService");
        await awardPoints({
          userId,
          points: badgeData.pointsValue,
          reason: `Badge approved: ${badgeData.name}`,
          source: "badge",
          sourceId: badgeId,
        });
      }
  
      // Send notification for approved badge
      try {
        const { notifyBadgeEarned } = await import("./notificationService");
        await notifyBadgeEarned({
          userId,
          restaurantId: badgeData.restaurantId,
          companyId: badgeData.companyId,
          badgeName: badgeData.name,
          badgeIcon: badgeData.icon,
          pointsValue: badgeData.pointsValue || 0,
          badgeId: badgeData.badgeId,
        });
      } catch (notifError) {
        console.error("Error sending badge notification:", notifError);
      }
  
      return true;
    } catch (error) {
      console.error("Error approving badge:", error);
      throw error;
    }
  }
  
  /**
   * Calculate and award tenure badge
   */
  export async function calculateAndAwardTenureBadge(userId, restaurantId, startDate) {
    try {
      const start = startDate instanceof Date ? startDate : new Date(startDate);
      const now = new Date();
      const yearsOfService = Math.floor(
        (now - start) / (1000 * 60 * 60 * 24 * 365)
      );
  
      if (yearsOfService < 0) return null;
  
      // Get badge library
      const { getBadgeById } = await import("./badgeLibrary");
      const tenureBadgeId = `tenure_${yearsOfService === 0 ? "newbie" : yearsOfService}`;
      const badgeTemplate = getBadgeById(tenureBadgeId);
  
      if (!badgeTemplate) return null;
  
      // Check if user already has this tenure badge
      const existingBadges = await getUserBadges(userId, { restaurantId });
      const hasBadge = existingBadges.some(
        (b) => b.badgeId === tenureBadgeId && b.type === BADGE_TYPE.EMPLOYEE_SYSTEM
      );
  
      if (hasBadge) return null;
  
      // Award the badge
      return await awardBadge({
        badgeId: tenureBadgeId,
        badgeData: {
          ...badgeTemplate,
          yearsOfService,
          startDate: start.toISOString(),
        },
        userId,
        restaurantId,
        companyId: null,
        awardedBy: "system",
        requiresApproval: false,
      });
    } catch (error) {
      console.error("Error calculating tenure badge:", error);
      return null;
    }
  }
  
  /**
   * Revoke a badge (for restaurant-specific badges when employee leaves)
   */
  export async function revokeBadge(userId, badgeId) {
    try {
      const badgeRef = doc(db, "users", userId, "badges", badgeId);
      await updateDoc(badgeRef, {
        status: "revoked",
        revokedAt: serverTimestamp(),
      });
      return true;
    } catch (error) {
      console.error("Error revoking badge:", error);
      throw error;
    }
  }
  
  /**
   * Revoke all restaurant-specific badges for a user
   */
  export async function revokeRestaurantBadges(userId, restaurantId) {
    try {
      const badges = await getUserBadges(userId, { restaurantId });
      const restaurantBadges = badges.filter(
        (b) =>
          b.type === BADGE_TYPE.EMPLOYEE_RESTAURANT &&
          b.restaurantId === restaurantId
      );
  
      const batch = writeBatch(db);
      restaurantBadges.forEach((badge) => {
        const badgeRef = doc(db, "users", userId, "badges", badge.id);
        batch.update(badgeRef, {
          status: "revoked",
          revokedAt: serverTimestamp(),
        });
      });
  
      await batch.commit();
      return restaurantBadges.length;
    } catch (error) {
      console.error("Error revoking restaurant badges:", error);
      throw error;
    }
  }