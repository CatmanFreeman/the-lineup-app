// src/utils/tipshareService.js

import {
    collection,
    doc,
    getDocs,
    setDoc,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    runTransaction,
    getDoc,
  } from "firebase/firestore";
  import { db } from "../hooks/services/firebase";  
  /**
   * TipShare Service
   * 
   * TipShare allows diners to tip employees (FOH and BOH) through the app:
   * - When making a review
   * - From Staff Profile page (TipShare icon)
   * - From LiveLineup page (TipShare icon)
   * - NOT on close-out tickets at restaurant
   */
  
  /**
   * Create a TipShare transaction
   */
  export async function createTipShareTransaction({
    dinerId,
    employeeId,
    restaurantId,
    amount,
    source, // "review", "staff_profile", "live_lineup"
    sourceId, // review ID, staff profile ID, etc.
    note = null,
    dinerName = null,
    employeeName = null,
  }) {
    try {
      const transactionRef = doc(collection(db, "tipshare_transactions"));
      
      const transactionData = {
        dinerId,
        employeeId,
        restaurantId,
        amount: Number(amount),
        source,
        sourceId: sourceId || null,
        note: note || null,
        dinerName: dinerName || null,
        employeeName: employeeName || null,
        status: "pending", // pending, processed, failed
        createdAt: serverTimestamp(),
        processedAt: null,
      };
  
      await setDoc(transactionRef, transactionData);
  
      // Update employee's TipShare balance
      const employeeBalanceRef = doc(
        db,
        "users",
        employeeId,
        "tipshare",
        "balance"
      );
  
      await runTransaction(db, async (transaction) => {
        const balanceSnap = await transaction.get(employeeBalanceRef);
        
        const currentBalance = balanceSnap.exists() 
          ? balanceSnap.data().total || 0 
          : 0;
        const currentWeekly = balanceSnap.exists()
          ? balanceSnap.data().weeklyTotal || 0
          : 0;
  
        transaction.set(
          employeeBalanceRef,
          {
            total: currentBalance + Number(amount),
            weeklyTotal: currentWeekly + Number(amount),
            lastUpdated: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      });
  
      // Update transaction status to processed
      await setDoc(
        transactionRef,
        {
          status: "processed",
          processedAt: serverTimestamp(),
        },
        { merge: true }
      );
  
      const balanceDoc = await getDoc(employeeBalanceRef);
      const newBalance = balanceDoc.exists() ? balanceDoc.data().total || 0 : 0;
  
      return {
        transactionId: transactionRef.id,
        newBalance,
      };
    } catch (error) {
      console.error("Error creating TipShare transaction:", error);
      throw error;
    }
  }
  
  /**
   * Get employee's TipShare balance
   */
  export async function getEmployeeTipShareBalance(employeeId) {
    try {
      const balanceRef = doc(db, "users", employeeId, "tipshare", "balance");
      const balanceSnap = await getDoc(balanceRef);
      
      if (balanceSnap.exists()) {
        return balanceSnap.data();
      }
      
      return {
        total: 0,
        weeklyTotal: 0,
        available: 0,
        pending: 0,
        lastUpdated: null,
      };
    } catch (error) {
      console.error("Error getting TipShare balance:", error);
      return {
        total: 0,
        weeklyTotal: 0,
        available: 0,
        pending: 0,
        lastUpdated: null,
      };
    }
  }
  
  /**
   * Get employee's weekly TipShare total
   * Note: This function may require a Firestore composite index
   * If you get an error, create an index on:
   * - Collection: tipshare_transactions
   * - Fields: employeeId (Ascending), status (Ascending), createdAt (Ascending)
   */
  export async function getEmployeeWeeklyTipShare(employeeId, weekEndingISO) {
    try {
      // Get all transactions for this week
      const weekEnd = new Date(weekEndingISO);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6); // Go back 6 days to get Sunday
      weekStart.setHours(0, 0, 0, 0);
      weekEnd.setHours(23, 59, 59, 999);
      
      const transactionsRef = collection(db, "tipshare_transactions");
      
      // Query for processed transactions for this employee
      const q = query(
        transactionsRef,
        where("employeeId", "==", employeeId),
        where("status", "==", "processed")
      );
      
      const snap = await getDocs(q);
      let total = 0;
      
      // Filter by date range in memory (to avoid composite index requirement)
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const createdAt = data.createdAt;
        
        if (createdAt) {
          const createdDate = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
          if (createdDate >= weekStart && createdDate <= weekEnd) {
            total += data.amount || 0;
          }
        }
      });
      
      return total;
    } catch (error) {
      console.error("Error getting weekly TipShare:", error);
      // Fallback: try without date filter
      try {
        const transactionsRef = collection(db, "tipshare_transactions");
        const q = query(
          transactionsRef,
          where("employeeId", "==", employeeId),
          where("status", "==", "processed")
        );
        const snap = await getDocs(q);
        let total = 0;
        snap.forEach((docSnap) => {
          total += docSnap.data().amount || 0;
        });
        return total;
      } catch (fallbackError) {
        console.error("Fallback query also failed:", fallbackError);
        return 0;
      }
    }
  }
  
  /**
   * Get employee's TipShare transactions
   * Note: This function may require a Firestore index
   * If you get an error, create an index on:
   * - Collection: tipshare_transactions
   * - Fields: employeeId (Ascending), createdAt (Descending)
   */
  export async function getEmployeeTipShareTransactions(employeeId, limitCount = 50) {
    try {
      const transactionsRef = collection(db, "tipshare_transactions");
      const q = query(
        transactionsRef,
        where("employeeId", "==", employeeId),
        orderBy("createdAt", "desc"),
        limit(limitCount)
      );
      
      const snap = await getDocs(q);
      return snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
    } catch (error) {
      console.error("Error getting TipShare transactions:", error);
      // Fallback: get without orderBy if index doesn't exist
      try {
        const transactionsRef = collection(db, "tipshare_transactions");
        const q = query(
          transactionsRef,
          where("employeeId", "==", employeeId),
          limit(limitCount)
        );
        const snap = await getDocs(q);
        const transactions = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        // Sort in memory
        return transactions.sort((a, b) => {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return bTime - aTime;
        });
      } catch (fallbackError) {
        console.error("Fallback query also failed:", fallbackError);
        return [];
      }
    }
  }
  
  /**
   * Request a withdrawal from TipShare balance
   */
  export async function requestWithdrawal({
    employeeId,
    amount,
    type, // "instant" or "free"
    restaurantId,
  }) {
    try {
      const withdrawalRef = doc(collection(db, "tipshare_withdrawals"));
      
      const fee = type === "instant" ? amount * 0.02 : 0;
      const netAmount = amount - fee;
      
      const withdrawalData = {
        employeeId,
        restaurantId,
        amount: Number(amount),
        fee: Number(fee),
        netAmount: Number(netAmount),
        type, // "instant" or "free"
        status: "pending", // pending, processing, completed, failed
        requestedAt: serverTimestamp(),
        estimatedCompletion: type === "instant" 
          ? serverTimestamp() // Instant = now
          : null, // Free = 1-3 days (calculated on backend)
        completedAt: null,
      };
  
      await setDoc(withdrawalRef, withdrawalData);
  
      // Update employee balance (deduct immediately)
      const employeeBalanceRef = doc(
        db,
        "users",
        employeeId,
        "tipshare",
        "balance"
      );
  
      await runTransaction(db, async (transaction) => {
        const balanceSnap = await transaction.get(employeeBalanceRef);
        
        const currentTotal = balanceSnap.exists() 
          ? balanceSnap.data().total || 0 
          : 0;
  
        if (currentTotal < amount) {
          throw new Error("Insufficient balance");
        }
  
        transaction.set(
          employeeBalanceRef,
          {
            total: currentTotal - amount,
            lastUpdated: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      });
  
      // Create transaction record
      const transactionRef = doc(collection(db, "tipshare_transactions"));
      await setDoc(transactionRef, {
        employeeId,
        restaurantId,
        amount: -Number(amount), // Negative for withdrawal
        fee: fee,
        type: "withdrawal",
        withdrawalType: type,
        withdrawalId: withdrawalRef.id,
        status: "pending",
        createdAt: serverTimestamp(),
      });
  
      return {
        withdrawalId: withdrawalRef.id,
        netAmount,
        fee,
      };
    } catch (error) {
      console.error("Error requesting withdrawal:", error);
      throw error;
    }
  }
  
  /**
   * Reset weekly totals (should be called weekly via Cloud Function)
   */
  export async function resetWeeklyTipShareTotals(employeeId) {
    try {
      const balanceRef = doc(db, "users", employeeId, "tipshare", "balance");
      await setDoc(
        balanceRef,
        {
          weeklyTotal: 0,
          lastUpdated: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error("Error resetting weekly totals:", error);
    }
  }