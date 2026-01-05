// src/utils/scheduleRequestService.js

import {
    collection,
    doc,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp,
    updateDoc,
  } from "firebase/firestore";
  import { db } from "../hooks/services/firebase";
  import { createNotification, NOTIFICATION_TYPES, NOTIFICATION_PRIORITY } from "./notificationService";
  
  const COMPANY_ID = "company-demo";
  
  /**
   * Schedule Request Service
   * Handles time-off requests and shift swaps
   */
  
  /**
   * Create a time-off request
   */
  export async function requestTimeOff({
    employeeUid,
    employeeName,
    restaurantId,
    dateISO,
    weekEndingISO,
    reason = "",
  }) {
    try {
      const requestRef = collection(
        db,
        "companies",
        COMPANY_ID,
        "restaurants",
        restaurantId,
        "scheduleRequests"
      );
  
      const requestData = {
        uid: employeeUid,
        name: employeeName,
        dateISO,
        weekEndingISO,
        reason,
        type: "time_off",
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
  
      const docRef = await addDoc(requestRef, requestData);
  
      // Notify manager (via notification system)
      // Note: This would need manager UIDs - for now, just log
      console.log("Time-off request created:", docRef.id);
  
      return docRef.id;
    } catch (error) {
      console.error("Error creating time-off request:", error);
      throw error;
    }
  }
  
  /**
   * Create a shift swap request
   */
  export async function requestShiftSwap({
    employeeUid,
    employeeName,
    restaurantId,
    fromDateISO,
    fromSlotId,
    toDateISO,
    toSlotId,
    targetEmployeeUid,
    targetEmployeeName,
    reason = "",
  }) {
    try {
      const requestRef = collection(
        db,
        "companies",
        COMPANY_ID,
        "restaurants",
        restaurantId,
        "scheduleRequests"
      );
  
      const requestData = {
        uid: employeeUid,
        name: employeeName,
        dateISO: fromDateISO,
        weekEndingISO: getWeekEndingISO(new Date(fromDateISO)),
        reason,
        type: "shift_swap",
        fromDateISO,
        fromSlotId,
        toDateISO,
        toSlotId,
        targetEmployeeUid,
        targetEmployeeName,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
  
      const docRef = await addDoc(requestRef, requestData);
  
      // Notify target employee and manager
      console.log("Shift swap request created:", docRef.id);
  
      return docRef.id;
    } catch (error) {
      console.error("Error creating shift swap request:", error);
      throw error;
    }
  }
  
  /**
   * Get employee's schedule requests
   */
  export async function getEmployeeScheduleRequests(employeeUid, restaurantId, status = null) {
    try {
      const requestRef = collection(
        db,
        "companies",
        COMPANY_ID,
        "restaurants",
        restaurantId,
        "scheduleRequests"
      );
  
      let q = query(
        requestRef,
        where("uid", "==", employeeUid),
        orderBy("createdAt", "desc")
      );
  
      if (status) {
        q = query(q, where("status", "==", status));
      }
  
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error("Error fetching schedule requests:", error);
      return [];
    }
  }
  
  /**
   * Cancel a schedule request
   */
  export async function cancelScheduleRequest(requestId, restaurantId) {
    try {
      const requestRef = doc(
        db,
        "companies",
        COMPANY_ID,
        "restaurants",
        restaurantId,
        "scheduleRequests",
        requestId
      );
  
      await updateDoc(requestRef, {
        status: "cancelled",
        updatedAt: serverTimestamp(),
      });
  
      return true;
    } catch (error) {
      console.error("Error cancelling schedule request:", error);
      throw error;
    }
  }
  
  /**
   * Helper: Get week ending ISO date (Sunday)
   */
  function getWeekEndingISO(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    const sunday = new Date(d.setDate(diff));
    sunday.setHours(23, 59, 59, 999);
    return sunday.toISOString().split("T")[0];
  }