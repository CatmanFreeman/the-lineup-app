// src/utils/valetCompanyMetricsService.js
//
// Service for fetching valet company location metrics

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "../hooks/services/firebase";
import { VALET_STATUS } from "./valetService";
import { getUpcomingPreBookingsForLocation } from "./valetPreBookingService";

/**
 * Get shift metrics for a location
 * 
 * @param {string} restaurantId - Restaurant ID (location)
 * @param {Date} shiftStart - Start of current shift
 * @returns {Promise<Object>} Shift metrics
 */
export async function getLocationShiftMetrics(restaurantId, shiftStart = null) {
  try {
    // If no restaurantId, return empty metrics (for non-restaurant locations)
    if (!restaurantId) {
      return {
        totalRevenue: 0,
        carsReceived: 0,
        carsInInventory: 0,
        shiftStart: shiftStart || new Date(),
      };
    }

    // Check if restaurant exists
    try {
      const restaurantRef = doc(db, "restaurants", restaurantId);
      const restaurantSnap = await getDoc(restaurantRef);
      if (!restaurantSnap.exists()) {
        return {
          totalRevenue: 0,
          carsReceived: 0,
          carsInInventory: 0,
          shiftStart: shiftStart || new Date(),
        };
      }
    } catch (checkError) {
      console.warn("Could not verify restaurant exists:", checkError);
      return {
        totalRevenue: 0,
        carsReceived: 0,
        carsInInventory: 0,
        shiftStart: shiftStart || new Date(),
      };
    }

    // Default shift start to today at 6 AM
    const today = new Date();
    const shiftStartTime = shiftStart || new Date(today.setHours(6, 0, 0, 0));
    const shiftStartTimestamp = Timestamp.fromDate(shiftStartTime);

    // Get all tickets for this restaurant
    const valetRef = collection(db, "restaurants", restaurantId, "valetTickets");
    
    // Get tickets created during shift
    const shiftTicketsQuery = query(
      valetRef,
      where("createdAt", ">=", shiftStartTimestamp),
      orderBy("createdAt", "desc")
    );
    const shiftTicketsSnap = await getDocs(shiftTicketsQuery);
    
    // Get all active tickets (cars in inventory)
    const activeTicketsQuery = query(
      valetRef,
      where("status", "!=", VALET_STATUS.COMPLETED)
    );
    const activeTicketsSnap = await getDocs(activeTicketsQuery);

    const shiftTickets = shiftTicketsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const activeTickets = activeTicketsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Calculate revenue (sum of tips)
    let totalRevenue = 0;
    shiftTickets.forEach(ticket => {
      if (ticket.tipAmount) {
        totalRevenue += parseFloat(ticket.tipAmount) || 0;
      }
    });

    return {
      totalRevenue,
      carsReceived: shiftTickets.length,
      carsInInventory: activeTickets.length,
      shiftStart: shiftStartTime,
    };
  } catch (error) {
    console.error("Error getting location shift metrics:", error);
    return {
      totalRevenue: 0,
      carsReceived: 0,
      carsInInventory: 0,
      shiftStart: shiftStart || new Date(),
    };
  }
}

/**
 * Get active drivers on shift for a location
 * 
 * @param {string} companyId - Valet company ID
 * @param {string} locationId - Location ID
 * @returns {Promise<Array>} Array of active drivers
 */
export async function getActiveDriversOnShift(companyId, locationId) {
  try {
    // Get drivers for this location
    const driversRef = collection(db, "valetCompanies", companyId, "locations", locationId, "drivers");
    const driversSnap = await getDocs(driversRef);
    
    const drivers = [];
    for (const driverDoc of driversSnap.docs) {
      const driverData = driverDoc.data();
      
      // Get user profile for full info
      if (driverData.userId) {
        const userRef = doc(db, "users", driverData.userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          // Check if driver is active (status ACTIVE)
          if (userData.status === "ACTIVE" || !userData.status) {
            drivers.push({
              id: driverDoc.id,
              userId: driverData.userId,
              name: driverData.name || userData.name,
              email: driverData.email || userData.email,
              phone: driverData.phone || userData.phone,
              status: userData.status || "ACTIVE",
            });
          }
        }
      }
    }
    
    return drivers;
  } catch (error) {
    console.error("Error getting active drivers on shift:", error);
    return [];
  }
}

/**
 * Get all location metrics for a valet company
 * 
 * @param {string} companyId - Valet company ID
 * @returns {Promise<Array>} Array of location metrics
 */
export async function getAllLocationMetrics(companyId) {
  try {
    // Get company locations
    const companyRef = doc(db, "valetCompanies", companyId);
    const companySnap = await getDoc(companyRef);
    
    if (!companySnap.exists()) {
      return [];
    }

    const companyData = companySnap.data();
    const locations = companyData.locations || [];

    // Get metrics for each location
    const locationMetrics = await Promise.all(
      locations.map(async (location) => {
        const metrics = await getLocationShiftMetrics(location.restaurantId);
        const activeDrivers = await getActiveDriversOnShift(companyId, location.id);
        const upcomingCars = await getUpcomingPreBookingsForLocation(companyId, location.restaurantId, location.id, 3);
        
        return {
          locationId: location.id,
          locationName: location.name,
          restaurantId: location.restaurantId,
          ...metrics,
          activeDrivers,
          driverCount: activeDrivers.length,
          upcomingCars,
        };
      })
    );

    return locationMetrics;
  } catch (error) {
    console.error("Error getting all location metrics:", error);
    return [];
  }
}

/**
 * Get company financial metrics for a date range
 * 
 * @param {string} companyId - Valet company ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Object>} Financial metrics
 */
export async function getCompanyFinancialMetrics(companyId, startDate, endDate) {
  try {
    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);
    
    // Get all payments for this company (filter by status in code since Firestore has limitations)
    const paymentsRef = collection(db, "valetPayments");
    const q = query(
      paymentsRef,
      where("valetCompanyId", "==", companyId),
      orderBy("completedAt", "desc")
    );
    
    const paymentsSnap = await getDocs(q);
    const allPayments = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Filter by status and date range
    const payments = allPayments.filter(payment => {
      if (payment.status !== "succeeded") return false;
      if (!payment.completedAt) return false;
      
      const completedDate = payment.completedAt?.toDate 
        ? payment.completedAt.toDate() 
        : new Date(payment.completedAt);
      
      return completedDate >= startDate && completedDate <= endDate;
    });

    // Calculate totals
    let totalRevenue = 0;
    let totalPlatformFees = 0;
    let totalCompanyAmount = 0;
    let transactionCount = 0;

    payments.forEach(payment => {
      totalRevenue += parseFloat(payment.amount || 0);
      totalPlatformFees += parseFloat(payment.platformFee || 0);
      totalCompanyAmount += parseFloat(payment.valetCompanyAmount || 0);
      transactionCount += 1;
    });

    return {
      totalRevenue,
      totalPlatformFees,
      totalCompanyAmount,
      transactionCount,
      startDate,
      endDate,
    };
  } catch (error) {
    console.error("Error getting company financial metrics:", error);
    return {
      totalRevenue: 0,
      totalPlatformFees: 0,
      totalCompanyAmount: 0,
      transactionCount: 0,
      startDate,
      endDate,
    };
  }
}

/**
 * Get daily revenue for today
 * 
 * @param {string} companyId - Valet company ID
 * @returns {Promise<Object>} Daily metrics
 */
export async function getDailyRevenue(companyId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return await getCompanyFinancialMetrics(companyId, today, tomorrow);
}

/**
 * Get weekly revenue (current week, Monday to Sunday)
 * 
 * @param {string} companyId - Valet company ID
 * @returns {Promise<Object>} Weekly metrics
 */
export async function getWeeklyRevenue(companyId) {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust to get Monday
  
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  return await getCompanyFinancialMetrics(companyId, monday, sunday);
}

/**
 * Get monthly revenue (current month)
 * 
 * @param {string} companyId - Valet company ID
 * @returns {Promise<Object>} Monthly metrics
 */
export async function getMonthlyRevenue(companyId) {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  firstDay.setHours(0, 0, 0, 0);
  
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  lastDay.setHours(23, 59, 59, 999);
  
  return await getCompanyFinancialMetrics(companyId, firstDay, lastDay);
}

/**
 * Get yearly revenue (current year)
 * 
 * @param {string} companyId - Valet company ID
 * @returns {Promise<Object>} Yearly metrics
 */
export async function getYearlyRevenue(companyId) {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), 0, 1);
  firstDay.setHours(0, 0, 0, 0);
  
  const lastDay = new Date(today.getFullYear(), 11, 31);
  lastDay.setHours(23, 59, 59, 999);
  
  return await getCompanyFinancialMetrics(companyId, firstDay, lastDay);
}

/**
 * Get all financial periods for company
 * 
 * @param {string} companyId - Valet company ID
 * @returns {Promise<Object>} All period metrics
 */
export async function getAllCompanyFinancials(companyId) {
  try {
    const [daily, weekly, monthly, yearly] = await Promise.all([
      getDailyRevenue(companyId),
      getWeeklyRevenue(companyId),
      getMonthlyRevenue(companyId),
      getYearlyRevenue(companyId),
    ]);

    return {
      daily,
      weekly,
      monthly,
      yearly,
    };
  } catch (error) {
    console.error("Error getting all company financials:", error);
    return {
      daily: { totalCompanyAmount: 0, transactionCount: 0 },
      weekly: { totalCompanyAmount: 0, transactionCount: 0 },
      monthly: { totalCompanyAmount: 0, transactionCount: 0 },
      yearly: { totalCompanyAmount: 0, transactionCount: 0 },
    };
  }
}

