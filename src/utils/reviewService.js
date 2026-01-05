// src/utils/reviewService.js

import {
    collection,
    doc,
    setDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    getDoc,
    updateDoc,
  } from "firebase/firestore";
  import { db } from "../hooks/services/firebase";
  import { createTipShareTransaction } from "./tipshareService";
  
  /**
   * Review Service
   * 
   * Handles menu item reviews that assign ratings to both servers and BOH employees
   * - BOH gets heavily weighted on food quality
   * - Server gets weighted on communication/order accuracy
   */
  
  /**
   * Create a menu item review
   * @param {Object} reviewData - Review data
   * @param {string} reviewData.dinerId - ID of the diner making the review
   * @param {string} reviewData.restaurantId - Restaurant ID
   * @param {string} reviewData.menuItemId - Menu item ID
   * @param {string} reviewData.menuItemName - Menu item name
   * @param {number} reviewData.itemRating - Rating for the menu item (1-5)
   * @param {string} reviewData.itemComment - Comment about the item
   * @param {string} reviewData.serverId - Server's employee ID
   * @param {string} reviewData.serverName - Server's name
   * @param {number} reviewData.serverRating - Rating for server (1-5)
   * @param {string} reviewData.serverComment - Comment about server
   * @param {string} reviewData.bohId - BOH employee's ID
   * @param {string} reviewData.bohName - BOH employee's name
   * @param {number} reviewData.bohRating - Rating for BOH (1-5)
   * @param {string} reviewData.bohComment - Comment about BOH
   * @param {number} reviewData.serverTipShare - Optional tip amount for server
   * @param {number} reviewData.bohTipShare - Optional tip amount for BOH
   * @param {string} reviewData.orderId - Optional order ID
   */
  export async function createMenuItemReview(reviewData) {
    try {
      const reviewRef = doc(collection(db, "menu_item_reviews"));
      
      const review = {
        dinerId: reviewData.dinerId,
        restaurantId: reviewData.restaurantId,
        menuItemId: reviewData.menuItemId,
        menuItemName: reviewData.menuItemName,
        
        // Item rating
        itemRating: Number(reviewData.itemRating),
        itemComment: reviewData.itemComment || null,
        
        // Server rating (weighted less on food, more on service/communication)
        serverId: reviewData.serverId || null,
        serverName: reviewData.serverName || null,
        serverRating: Number(reviewData.serverRating || 0),
        serverComment: reviewData.serverComment || null,
        serverWeight: 0.3, // 30% weight on server for food items
        
        // BOH rating (heavily weighted on food quality)
        bohId: reviewData.bohId || null,
        bohName: reviewData.bohName || null,
        bohRating: Number(reviewData.bohRating || 0),
        bohComment: reviewData.bohComment || null,
        bohWeight: 0.7, // 70% weight on BOH for food items
        
        // Calculated scores
        serverScore: Number(reviewData.serverRating) * 0.3,
        bohScore: Number(reviewData.bohRating) * 0.7,
        overallScore: (Number(reviewData.serverRating) * 0.3) + (Number(reviewData.bohRating) * 0.7),
        
        // TipShare
        serverTipShare: reviewData.serverTipShare ? Number(reviewData.serverTipShare) : null,
        bohTipShare: reviewData.bohTipShare ? Number(reviewData.bohTipShare) : null,
        
        // Metadata
        orderId: reviewData.orderId || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
  
      await setDoc(reviewRef, review);
  
      // Process TipShare transactions if provided
      const tipSharePromises = [];
      
      if (reviewData.serverTipShare && reviewData.serverTipShare > 0) {
        tipSharePromises.push(
          createTipShareTransaction({
            dinerId: reviewData.dinerId,
            employeeId: reviewData.serverId,
            restaurantId: reviewData.restaurantId,
            amount: reviewData.serverTipShare,
            source: "review",
            sourceId: reviewRef.id,
            note: `Tip from menu item review: ${reviewData.menuItemName}`,
            dinerName: reviewData.dinerName || null,
            employeeName: reviewData.serverName,
          })
        );
      }
      
      if (reviewData.bohTipShare && reviewData.bohTipShare > 0) {
        tipSharePromises.push(
          createTipShareTransaction({
            dinerId: reviewData.dinerId,
            employeeId: reviewData.bohId,
            restaurantId: reviewData.restaurantId,
            amount: reviewData.bohTipShare,
            source: "review",
            sourceId: reviewRef.id,
            note: `Tip from menu item review: ${reviewData.menuItemName}`,
            dinerName: reviewData.dinerName || null,
            employeeName: reviewData.bohName,
          })
        );
      }
  
      if (tipSharePromises.length > 0) {
        await Promise.all(tipSharePromises);
      }
  
      // Update employee performance scores (this would ideally be done via Cloud Function)
      // For now, we'll update the review counts
      const serverScore = Number(reviewData.serverRating) * 0.3;
      const bohScore = Number(reviewData.bohRating) * 0.7;
      
      await updateEmployeeReviewStats(reviewData.serverId, reviewData.restaurantId, {
        rating: reviewData.serverRating,
        score: serverScore,
        weight: 0.3,
      });
      
      await updateEmployeeReviewStats(reviewData.bohId, reviewData.restaurantId, {
        rating: reviewData.bohRating,
        score: bohScore,
        weight: 0.7,
      });
  
      return {
        reviewId: reviewRef.id,
        review,
      };
    } catch (error) {
      console.error("Error creating menu item review:", error);
      throw error;
    }
  }
  
  /**
   * Update employee review statistics
   * This should ideally be done via Cloud Function, but we'll do it client-side for now
   */
  async function updateEmployeeReviewStats(employeeId, restaurantId, reviewData) {
    try {
      const statsRef = doc(
        db,
        "restaurants",
        restaurantId,
        "staff",
        employeeId,
        "reviewStats",
        "current"
      );
  
      const statsSnap = await getDoc(statsRef);
      const currentStats = statsSnap.exists() ? statsSnap.data() : {
        totalReviews: 0,
        averageRating: 0,
        weightedScore: 0,
        lastUpdated: null,
      };
  
      const newTotalReviews = currentStats.totalReviews + 1;
      const newAverageRating = 
        ((currentStats.averageRating * currentStats.totalReviews) + reviewData.rating) / newTotalReviews;
      const newWeightedScore = 
        ((currentStats.weightedScore * currentStats.totalReviews) + reviewData.score) / newTotalReviews;
  
      await setDoc(
        statsRef,
        {
          totalReviews: newTotalReviews,
          averageRating: newAverageRating,
          weightedScore: newWeightedScore,
          lastUpdated: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error("Error updating employee review stats:", error);
      // Don't throw - this is a background update
    }
  }
  
  /**
   * Get reviews for a menu item
   */
  export async function getMenuItemReviews(menuItemId, limitCount = 20) {
    try {
      const reviewsRef = collection(db, "menu_item_reviews");
      const q = query(
        reviewsRef,
        where("menuItemId", "==", menuItemId),
        orderBy("createdAt", "desc"),
        limit(limitCount)
      );
  
      const snap = await getDocs(q);
      return snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
    } catch (error) {
      console.error("Error getting menu item reviews:", error);
      return [];
    }
  }
  
  /**
   * Get reviews for an employee (server or BOH)
   */
  export async function getEmployeeReviews(employeeId, restaurantId, limitCount = 50) {
    try {
      const reviewsRef = collection(db, "menu_item_reviews");
      
      // Get reviews where employee is server
      const serverQ = query(
        reviewsRef,
        where("serverId", "==", employeeId),
        where("restaurantId", "==", restaurantId),
        orderBy("createdAt", "desc"),
        limit(limitCount)
      );
  
      // Get reviews where employee is BOH
      const bohQ = query(
        reviewsRef,
        where("bohId", "==", employeeId),
        where("restaurantId", "==", restaurantId),
        orderBy("createdAt", "desc"),
        limit(limitCount)
      );
  
      const [serverSnap, bohSnap] = await Promise.all([
        getDocs(serverQ),
        getDocs(bohQ),
      ]);
  
      const reviews = [];
      
      serverSnap.docs.forEach((docSnap) => {
        reviews.push({
          id: docSnap.id,
          ...docSnap.data(),
          role: "server",
        });
      });
  
      bohSnap.docs.forEach((docSnap) => {
        reviews.push({
          id: docSnap.id,
          ...docSnap.data(),
          role: "boh",
        });
      });
  
      // Sort by date
      reviews.sort((a, b) => {
        const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return bTime - aTime;
      });
  
      return reviews.slice(0, limitCount);
    } catch (error) {
      console.error("Error getting employee reviews:", error);
      return [];
    }
  }
  
  /**
   * Get average rating for a menu item
   */
  export async function getMenuItemAverageRating(menuItemId) {
    try {
      const reviews = await getMenuItemReviews(menuItemId, 100);
      if (reviews.length === 0) return null;

      const sum = reviews.reduce((acc, review) => acc + review.itemRating, 0);
      return sum / reviews.length;
    } catch (error) {
      console.error("Error getting menu item average rating:", error);
      return null;
    }
  }

  /**
   * Create a full restaurant review with multiple items
   * @param {Object} reviewData - Full review data
   * @param {string} reviewData.dinerId - ID of the diner making the review
   * @param {string} reviewData.restaurantId - Restaurant ID
   * @param {Array} reviewData.items - Array of reviewed items
   * @param {number} reviewData.overallRating - Overall restaurant rating (1-5)
   * @param {string} reviewData.overallComment - Overall review comment (max 500 chars)
   * @param {string} reviewData.serverId - Server's employee ID
   * @param {string} reviewData.serverName - Server's name
   * @param {Object} reviewData.tipShare - TipShare data { server, hostess, boh, employees }
   * @param {string} reviewData.visitId - Optional visit ID
   */
  export async function createFullRestaurantReview(reviewData) {
    try {
      const reviewId = `review_${Date.now()}_${reviewData.dinerId}`;
      const reviewRef = doc(db, "restaurant_reviews", reviewId);

      // Create main review document
      const review = {
        dinerId: reviewData.dinerId,
        dinerName: reviewData.dinerName || null,
        restaurantId: reviewData.restaurantId,
        overallRating: Number(reviewData.overallRating),
        overallComment: reviewData.overallComment?.trim().substring(0, 500) || null,
        serverId: reviewData.serverId || null,
        serverName: reviewData.serverName || null,
        visitId: reviewData.visitId || null,
        itemCount: reviewData.items?.length || 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(reviewRef, review);

      // Create individual item reviews
      const itemReviewPromises = (reviewData.items || []).map(async (item) => {
        // Get BOH employee for this item's station
        const bohEmployees = item.bohEmployees || [];
        const primaryBoh = bohEmployees[0] || null;

        const itemReviewData = {
          dinerId: reviewData.dinerId,
          restaurantId: reviewData.restaurantId,
          menuItemId: item.id,
          menuItemName: item.name,
          itemRating: Number(item.rating),
          itemComment: item.comment?.trim().substring(0, 200) || null,
          itemPhotos: item.photos || [],
          serverId: reviewData.serverId || null,
          serverName: reviewData.serverName || null,
          serverRating: Number(item.serverRating || reviewData.overallRating),
          serverComment: item.serverComment?.trim().substring(0, 200) || null,
          bohId: primaryBoh?.id || null,
          bohName: primaryBoh?.name || null,
          bohRating: Number(item.bohRating || item.rating),
          bohComment: item.bohComment?.trim().substring(0, 200) || null,
          station: (item.station && item.station.trim()) || null,
          parentReviewId: reviewId,
          createdAt: serverTimestamp(),
        };

        return createMenuItemReview(itemReviewData);
      });

      await Promise.all(itemReviewPromises);

      // Process TipShare transactions
      const tipSharePromises = [];
      const tipShare = reviewData.tipShare || {};

      if (tipShare.server && tipShare.server > 0 && reviewData.serverId) {
        tipSharePromises.push(
          createTipShareTransaction({
            dinerId: reviewData.dinerId,
            employeeId: reviewData.serverId,
            restaurantId: reviewData.restaurantId,
            amount: tipShare.server,
            source: "review",
            sourceId: reviewId,
            note: `Tip from restaurant review`,
            dinerName: reviewData.dinerName || null,
            employeeName: reviewData.serverName,
          })
        );
      }

      if (tipShare.hostess && tipShare.hostess > 0 && tipShare.hostessId) {
        tipSharePromises.push(
          createTipShareTransaction({
            dinerId: reviewData.dinerId,
            employeeId: tipShare.hostessId,
            restaurantId: reviewData.restaurantId,
            amount: tipShare.hostess,
            source: "review",
            sourceId: reviewId,
            note: `Tip from restaurant review`,
            dinerName: reviewData.dinerName || null,
            employeeName: tipShare.hostessName || "Hostess",
          })
        );
      }

      if (tipShare.boh && tipShare.boh > 0 && tipShare.bohEmployees) {
        // Split BOH tip among employees
        const perEmployee = tipShare.boh / tipShare.bohEmployees.length;
        tipShare.bohEmployees.forEach((emp) => {
          tipSharePromises.push(
            createTipShareTransaction({
              dinerId: reviewData.dinerId,
              employeeId: emp.id,
              restaurantId: reviewData.restaurantId,
              amount: perEmployee,
              source: "review",
              sourceId: reviewId,
              note: `Tip from restaurant review (BOH)`,
              dinerName: reviewData.dinerName || null,
              employeeName: emp.name,
            })
          );
        });
      }

      // Individual employee tips
      if (tipShare.employees && Array.isArray(tipShare.employees)) {
        tipShare.employees.forEach((empTip) => {
          if (empTip.amount > 0 && empTip.employeeId) {
            tipSharePromises.push(
              createTipShareTransaction({
                dinerId: reviewData.dinerId,
                employeeId: empTip.employeeId,
                restaurantId: reviewData.restaurantId,
                amount: empTip.amount,
                source: "review",
                sourceId: reviewId,
                note: `Tip from restaurant review`,
                dinerName: reviewData.dinerName || null,
                employeeName: empTip.employeeName || "Employee",
              })
            );
          }
        });
      }

      if (tipSharePromises.length > 0) {
        await Promise.all(tipSharePromises);
      }

      // Mark visit as reviewed if visitId provided
      if (reviewData.visitId) {
        try {
          const { markVisitAsReviewed } = await import("./gpsNotificationService");
          await markVisitAsReviewed(reviewData.visitId);
        } catch (err) {
          console.error("Error marking visit as reviewed:", err);
        }
      }

      return {
        reviewId,
        review,
        success: true,
      };
    } catch (error) {
      console.error("Error creating full restaurant review:", error);
      throw error;
    }
  }