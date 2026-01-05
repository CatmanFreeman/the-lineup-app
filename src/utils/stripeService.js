// src/utils/stripeService.js
//
// STRIPE PAYMENT SERVICE
//
// Handles Stripe integration for valet payments
// - Creates/retrieves Stripe customers
// - Manages stored payment methods
// - Processes valet payments with platform fee splitting
// - Handles TipShare tips for valet drivers

// Note: In production, most Stripe operations should be done server-side
// This client-side service will call Firebase Cloud Functions that handle Stripe API calls

import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "../hooks/services/firebase";

/**
 * Platform fee percentage (e.g., 16.67% = $1 out of $6)
 */
export const PLATFORM_FEE_PERCENTAGE = 0.1667; // 16.67%

/**
 * Get or create Stripe customer ID for user
 * 
 * @param {string} userId - User ID
 * @param {string} email - User email
 * @param {string} name - User name
 * @returns {Promise<string>} Stripe customer ID
 */
export async function getOrCreateStripeCustomer(userId, email, name) {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      throw new Error("User not found");
    }

    const userData = userSnap.data();
    
    // If user already has Stripe customer ID, return it
    if (userData.stripeCustomerId) {
      return userData.stripeCustomerId;
    }

    // Otherwise, call Cloud Function to create Stripe customer
    // For now, we'll store a placeholder and the Cloud Function will handle it
    // In production, this should call a Cloud Function:
    // const response = await fetch('/api/stripe/create-customer', { ... });
    // const { customerId } = await response.json();
    
    // Placeholder: In production, this would be handled by Cloud Function
    const customerId = `cus_${userId.substring(0, 24)}`; // Placeholder format
    
    await updateDoc(userRef, {
      stripeCustomerId: customerId,
      updatedAt: serverTimestamp(),
    });

    return customerId;
  } catch (error) {
    console.error("Error getting/creating Stripe customer:", error);
    throw error;
  }
}

/**
 * Get stored payment methods for user
 * 
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of payment methods
 */
export async function getStoredPaymentMethods(userId) {
  try {
    const paymentMethodsRef = collection(db, "users", userId, "paymentMethods");
    const paymentMethodsSnap = await getDocs(paymentMethodsRef);

    const paymentMethods = [];
    paymentMethodsSnap.forEach((doc) => {
      const data = doc.data();
      paymentMethods.push({
        id: doc.id,
        ...data,
      });
    });

    // Sort by isDefault (default first), then by createdAt (newest first)
    paymentMethods.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });

    return paymentMethods;
  } catch (error) {
    console.error("Error getting stored payment methods:", error);
    return [];
  }
}

/**
 * Save payment method for user
 * 
 * @param {string} userId - User ID
 * @param {string} paymentMethodId - Stripe payment method ID
 * @param {Object} paymentMethodData - Payment method data (last4, brand, etc.)
 * @param {boolean} isDefault - Set as default payment method
 * @returns {Promise<string>} Payment method document ID
 */
export async function savePaymentMethod(userId, paymentMethodId, paymentMethodData, isDefault = false) {
  try {
    // If setting as default, unset other defaults
    if (isDefault) {
      const existingMethods = await getStoredPaymentMethods(userId);
      const updatePromises = existingMethods
        .filter((pm) => pm.isDefault)
        .map((pm) => {
          const pmRef = doc(db, "users", userId, "paymentMethods", pm.id);
          return updateDoc(pmRef, { isDefault: false });
        });
      await Promise.all(updatePromises);
    }

    const paymentMethodRef = doc(collection(db, "users", userId, "paymentMethods"));
    await setDoc(paymentMethodRef, {
      stripePaymentMethodId: paymentMethodId,
      last4: paymentMethodData.last4 || null,
      brand: paymentMethodData.brand || null, // "visa", "mastercard", etc.
      expMonth: paymentMethodData.expMonth || null,
      expYear: paymentMethodData.expYear || null,
      isDefault,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return paymentMethodRef.id;
  } catch (error) {
    console.error("Error saving payment method:", error);
    throw error;
  }
}

/**
 * Process valet payment
 * 
 * @param {Object} params
 * @param {string} params.userId - User ID (diner)
 * @param {string} params.valetCompanyId - Valet company ID
 * @param {string} params.locationId - Location ID (optional)
 * @param {string} params.restaurantId - Restaurant ID (optional, if location is restaurant)
 * @param {number} params.amount - Payment amount in dollars (e.g., 6.00)
 * @param {string} params.paymentMethodId - Stripe payment method ID (or stored payment method ID)
 * @param {string} params.description - Payment description
 * @returns {Promise<Object>} Payment result with transaction ID, platform fee, etc.
 */
export async function processValetPayment({
  userId,
  valetCompanyId,
  locationId = null,
  restaurantId = null,
  amount,
  paymentMethodId,
  description = "Valet Service",
}) {
  try {
    // Calculate platform fee
    const platformFee = Math.round(amount * PLATFORM_FEE_PERCENTAGE * 100) / 100; // Round to 2 decimals
    const valetCompanyAmount = amount - platformFee;

    // In production, this would call a Cloud Function that:
    // 1. Creates Stripe PaymentIntent with application_fee_amount
    // 2. Confirms payment
    // 3. Transfers funds to valet company's connected account
    // 4. Records transaction in Firestore
    
    // For now, we'll create a placeholder transaction record
    // In production, replace this with Cloud Function call:
    // const response = await fetch('/api/stripe/process-valet-payment', {
    //   method: 'POST',
    //   body: JSON.stringify({ ... })
    // });
    // const result = await response.json();

    const transactionRef = doc(collection(db, "valetPayments"));
    const transactionId = transactionRef.id;

    await setDoc(transactionRef, {
      id: transactionId,
      userId,
      valetCompanyId,
      locationId,
      restaurantId,
      amount: Number(amount),
      platformFee: Number(platformFee),
      valetCompanyAmount: Number(valetCompanyAmount),
      paymentMethodId,
      description,
      status: "pending", // pending, succeeded, failed, refunded
      stripePaymentIntentId: null, // Will be set by Cloud Function
      createdAt: serverTimestamp(),
      completedAt: null,
    });

    // TODO: Call Cloud Function to process payment
    // For now, we'll simulate success
    await updateDoc(transactionRef, {
      status: "succeeded",
      completedAt: serverTimestamp(),
    });

    return {
      transactionId,
      amount,
      platformFee,
      valetCompanyAmount,
      status: "succeeded",
    };
  } catch (error) {
    console.error("Error processing valet payment:", error);
    throw error;
  }
}

/**
 * Process valet tip via TipShare
 * 
 * @param {Object} params
 * @param {string} params.dinerId - Diner user ID
 * @param {string} params.valetDriverId - Valet driver user ID
 * @param {string} params.valetCompanyId - Valet company ID
 * @param {string} params.restaurantId - Restaurant ID (optional)
 * @param {string} params.locationId - Location ID (optional)
 * @param {number} params.amount - Tip amount in dollars
 * @param {string} params.paymentMethodId - Stripe payment method ID
 * @param {string} params.note - Optional note
 * @returns {Promise<Object>} Tip result
 */
export async function processValetTip({
  dinerId,
  valetDriverId,
  valetCompanyId,
  restaurantId = null,
  locationId = null,
  amount,
  paymentMethodId,
  note = null,
}) {
  try {
    // Process payment for tip
    const tipPayment = await processValetPayment({
      userId: dinerId,
      valetCompanyId,
      locationId,
      restaurantId,
      amount,
      paymentMethodId,
      description: "Valet Tip",
    });

    // Create TipShare transaction
    const { createTipShareTransaction } = await import("./tipshareService");
    const tipShareResult = await createTipShareTransaction({
      dinerId,
      employeeId: valetDriverId,
      restaurantId,
      amount,
      source: "valet",
      sourceId: tipPayment.transactionId,
      note: note || "Valet tip",
      dinerName: null, // Will be fetched from user
      employeeName: null, // Will be fetched from user
    });

    return {
      ...tipPayment,
      tipShareTransactionId: tipShareResult.transactionId,
    };
  } catch (error) {
    console.error("Error processing valet tip:", error);
    throw error;
  }
}

/**
 * Get valet company Stripe account ID
 * 
 * @param {string} valetCompanyId - Valet company ID
 * @returns {Promise<string|null>} Stripe connected account ID
 */
export async function getValetCompanyStripeAccount(valetCompanyId) {
  try {
    const companyRef = doc(db, "valetCompanies", valetCompanyId);
    const companySnap = await getDoc(companyRef);

    if (!companySnap.exists()) {
      return null;
    }

    const companyData = companySnap.data();
    return companyData.stripeAccountId || null;
  } catch (error) {
    console.error("Error getting valet company Stripe account:", error);
    return null;
  }
}








