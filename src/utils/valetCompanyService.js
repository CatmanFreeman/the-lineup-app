// src/utils/valetCompanyService.js
//
// VALET COMPANY SERVICE
//
// Manages valet companies, drivers, and restaurant authorizations
// - Valet companies are organizations (not restaurants)
// - Valet drivers are users (not employees) with role "Valet"
// - Restaurants authorize/approve valet companies
// - Tracks valet activity and timing

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
  Timestamp,
} from "firebase/firestore";
import { db } from "../hooks/services/firebase";
import { createNotification, NOTIFICATION_TYPES, NOTIFICATION_PRIORITY } from "./notificationService";

/**
 * Valet Company Status
 */
export const VALET_COMPANY_STATUS = {
  PENDING: "PENDING", // Waiting for restaurant approval
  APPROVED: "APPROVED", // Approved by restaurant
  REJECTED: "REJECTED", // Rejected by restaurant
  SUSPENDED: "SUSPENDED", // Temporarily suspended
};

/**
 * Valet Company Subscription Plan
 */
export const VALET_COMPANY_PLAN = {
  FREE: "FREE", // Can only work at restaurants (must be associated)
  PAID: "PAID", // Can add non-restaurant locations
};

/**
 * Valet Driver Status
 */
export const VALET_DRIVER_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  SUSPENDED: "SUSPENDED",
};

/**
 * Create or update valet company
 * 
 * @param {Object} params
 * @param {string} params.companyId - Valet company ID (auto-generated if not provided)
 * @param {string} params.name - Company name
 * @param {string} params.contactName - Contact person name
 * @param {string} params.contactEmail - Contact email
 * @param {string} params.contactPhone - Contact phone
 * @param {string} params.address - Company address
 * @returns {Promise<string>} Valet company ID
 */
export async function createOrUpdateValetCompany({
  companyId = null,
  name,
  contactName,
  contactEmail,
  contactPhone,
  address,
}) {
  try {
    if (!name || !contactEmail) {
      throw new Error("Missing required fields: name, contactEmail");
    }

    const valetCompaniesRef = collection(db, "valetCompanies");
    
    if (companyId) {
      // Update existing
      const companyRef = doc(valetCompaniesRef, companyId);
      await updateDoc(companyRef, {
        name,
        contactName,
        contactEmail,
        contactPhone,
        address,
        updatedAt: serverTimestamp(),
      });
      return companyId;
    } else {
      // Create new (defaults to FREE plan)
      const companyDoc = doc(valetCompaniesRef);
      await setDoc(companyDoc, {
        id: companyDoc.id,
        name,
        contactName,
        contactEmail,
        contactPhone,
        address,
        status: "ACTIVE",
        plan: VALET_COMPANY_PLAN.FREE, // Default to free
        locations: [], // Array of location objects
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return companyDoc.id;
    }
  } catch (error) {
    console.error("Error creating/updating valet company:", error);
    throw error;
  }
}

/**
 * Get valet company by ID
 * 
 * @param {string} companyId - Valet company ID
 * @returns {Promise<Object>} Valet company data
 */
export async function getValetCompany(companyId) {
  try {
    if (!companyId) {
      throw new Error("Company ID is required");
    }

    const companyRef = doc(db, "valetCompanies", companyId);
    const companySnap = await getDoc(companyRef);

    if (!companySnap.exists()) {
      throw new Error("Valet company not found");
    }

    return {
      id: companySnap.id,
      ...companySnap.data(),
    };
  } catch (error) {
    console.error("Error getting valet company:", error);
    throw error;
  }
}

/**
 * Register valet driver as user
 * 
 * @param {Object} params
 * @param {string} params.userId - User ID (from Firebase Auth)
 * @param {string} params.valetCompanyId - Valet company ID
 * @param {string} params.restaurantId - Assigned restaurant location
 * @param {string} params.name - Driver name
 * @param {string} params.email - Driver email
 * @param {string} params.phone - Driver phone
 * @returns {Promise<void>}
 */
export async function registerValetDriver({
  userId,
  valetCompanyId,
  restaurantId,
  name,
  email,
  phone,
}) {
  try {
    if (!userId || !valetCompanyId || !restaurantId) {
      throw new Error("Missing required fields: userId, valetCompanyId, restaurantId");
    }

    // Create user profile with valet role
    const userRef = doc(db, "users", userId);
    await setDoc(
      userRef,
      {
        role: "VALET",
        valetCompanyId,
        restaurantId,
        name,
        email,
        phone,
        status: VALET_DRIVER_STATUS.ACTIVE,
        assignedLocation: restaurantId,
        organization: valetCompanyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Add to valet company drivers list
    const companyRef = doc(db, "valetCompanies", valetCompanyId);
    const companySnap = await getDoc(companyRef);
    
    if (companySnap.exists()) {
      const companyData = companySnap.data();
      const drivers = companyData.drivers || [];
      
      if (!drivers.includes(userId)) {
        await updateDoc(companyRef, {
          drivers: [...drivers, userId],
          updatedAt: serverTimestamp(),
        });
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Error registering valet driver:", error);
    throw error;
  }
}

/**
 * Apply to restaurant (valet company requests to work at restaurant)
 * Similar to employee application - valet company applies, restaurant approves
 * 
 * @param {Object} params
 * @param {string} params.valetCompanyId - Valet company ID
 * @param {string} params.restaurantId - Restaurant ID
 * @param {string} params.requestedBy - User ID who requested (valet company admin)
 * @returns {Promise<string>} Application ID
 */
export async function applyToRestaurant({
  valetCompanyId,
  restaurantId,
  requestedBy,
}) {
  try {
    // Check if application already exists
    const authRef = collection(db, "restaurants", restaurantId, "valetApplications");
    const existingQuery = query(
      authRef,
      where("valetCompanyId", "==", valetCompanyId),
      where("status", "in", [VALET_COMPANY_STATUS.PENDING, VALET_COMPANY_STATUS.APPROVED])
    );
    const existingSnap = await getDocs(existingQuery);
    
    if (!existingSnap.empty) {
      throw new Error("Application already exists for this restaurant");
    }

    // Create application
    const authDoc = doc(authRef);
    
    await setDoc(authDoc, {
      id: authDoc.id,
      valetCompanyId,
      restaurantId,
      status: VALET_COMPANY_STATUS.PENDING,
      requestedBy,
      requestedAt: serverTimestamp(),
      approvedBy: null,
      approvedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Notify restaurant managers
    await notifyRestaurantManagers(restaurantId, valetCompanyId);

    return authDoc.id;
  } catch (error) {
    console.error("Error applying to restaurant:", error);
    throw error;
  }
}

/**
 * Request restaurant authorization for valet company (legacy - use applyToRestaurant)
 * 
 * @deprecated Use applyToRestaurant instead
 */
export async function requestRestaurantAuthorization({
  valetCompanyId,
  restaurantId,
  requestedBy,
}) {
  return applyToRestaurant({ valetCompanyId, restaurantId, requestedBy });
}

/**
 * Approve or reject valet company application
 * 
 * @param {Object} params
 * @param {string} params.restaurantId - Restaurant ID
 * @param {string} params.applicationId - Application ID
 * @param {string} params.status - "APPROVED" or "REJECTED"
 * @param {string} params.approvedBy - User ID who approved/rejected
 * @returns {Promise<void>}
 */
export async function approveOrRejectApplication({
  restaurantId,
  applicationId,
  status,
  approvedBy,
}) {
  try {
    // Check both collections (applications and authorizations for backward compatibility)
    let authRef = doc(db, "restaurants", restaurantId, "valetApplications", applicationId);
    let authSnap = await getDoc(authRef);
    
    if (!authSnap.exists()) {
      // Try legacy authorizations collection
      authRef = doc(db, "restaurants", restaurantId, "valetAuthorizations", applicationId);
      authSnap = await getDoc(authRef);
    }
    
    if (!authSnap.exists()) {
      throw new Error("Application not found");
    }

    const authData = authSnap.data();
    const valetCompanyId = authData.valetCompanyId;

    await updateDoc(authRef, {
      status,
      approvedBy,
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // If approved, create authorization record and notify valet company
    if (status === VALET_COMPANY_STATUS.APPROVED) {
      // Create authorization record
      const authorizationRef = doc(db, "restaurants", restaurantId, "valetAuthorizations", valetCompanyId);
      await setDoc(authorizationRef, {
        id: valetCompanyId,
        valetCompanyId,
        restaurantId,
        status: VALET_COMPANY_STATUS.APPROVED,
        approvedBy,
        approvedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      await notifyValetCompanyApproval(valetCompanyId, restaurantId);
    }

    return { success: true };
  } catch (error) {
    console.error("Error approving/rejecting application:", error);
    throw error;
  }
}

/**
 * Approve or reject valet company authorization (legacy - use approveOrRejectApplication)
 * 
 * @deprecated Use approveOrRejectApplication instead
 */
export async function approveOrRejectAuthorization(params) {
  return approveOrRejectApplication(params);
}

/**
 * Get authorized valet companies for a restaurant
 * Checks both valetAuthorizations (approved) and valetApplications (approved)
 * 
 * @param {string} restaurantId
 * @returns {Promise<Array>} Array of authorized valet companies
 */
export async function getAuthorizedValetCompanies(restaurantId) {
  try {
    const companies = [];
    const companyIds = new Set();

    // Check authorizations collection (approved applications)
    const authRef = collection(db, "restaurants", restaurantId, "valetAuthorizations");
    const authQuery = query(authRef, where("status", "==", VALET_COMPANY_STATUS.APPROVED));
    const authSnap = await getDocs(authQuery);

    for (const docSnap of authSnap.docs) {
      const authData = docSnap.data();
      if (authData.valetCompanyId && !companyIds.has(authData.valetCompanyId)) {
        companyIds.add(authData.valetCompanyId);
        
        const companyRef = doc(db, "valetCompanies", authData.valetCompanyId);
        const companySnap = await getDoc(companyRef);
        
        if (companySnap.exists()) {
          companies.push({
            id: companySnap.id,
            ...companySnap.data(),
            authorizationId: docSnap.id,
            authorizedAt: authData.approvedAt,
          });
        }
      }
    }

    // Also check applications collection for approved ones
    const applicationsRef = collection(db, "restaurants", restaurantId, "valetApplications");
    const appQuery = query(applicationsRef, where("status", "==", VALET_COMPANY_STATUS.APPROVED));
    const appSnap = await getDocs(appQuery);

    for (const docSnap of appSnap.docs) {
      const appData = docSnap.data();
      if (appData.valetCompanyId && !companyIds.has(appData.valetCompanyId)) {
        companyIds.add(appData.valetCompanyId);
        
        const companyRef = doc(db, "valetCompanies", appData.valetCompanyId);
        const companySnap = await getDoc(companyRef);
        
        if (companySnap.exists()) {
          companies.push({
            id: companySnap.id,
            ...companySnap.data(),
            authorizationId: docSnap.id,
            authorizedAt: appData.approvedAt,
          });
        }
      }
    }

    return companies;
  } catch (error) {
    console.error("Error getting authorized valet companies:", error);
    return [];
  }
}

/**
 * Get valet drivers for a restaurant
 * 
 * @param {string} restaurantId
 * @returns {Promise<Array>} Array of valet drivers
 */
export async function getValetDriversForRestaurant(restaurantId) {
  try {
    // Get authorized valet companies
    const companies = await getAuthorizedValetCompanies(restaurantId);
    const companyIds = companies.map((c) => c.id);

    if (companyIds.length === 0) {
      return [];
    }

    // Get all users with valet role assigned to this restaurant
    const usersRef = collection(db, "users");
    const q = query(
      usersRef,
      where("role", "==", "VALET"),
      where("restaurantId", "==", restaurantId),
      where("status", "==", VALET_DRIVER_STATUS.ACTIVE)
    );
    const snap = await getDocs(q);

    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
  } catch (error) {
    console.error("Error getting valet drivers:", error);
    return [];
  }
}

/**
 * Get valet activity for a restaurant
 * 
 * @param {string} restaurantId
 * @param {Date} startDate - Start date for activity
 * @param {Date} endDate - End date for activity
 * @returns {Promise<Array>} Array of valet tickets with activity
 */
export async function getValetActivity(restaurantId, startDate, endDate) {
  try {
    const valetRef = collection(db, "restaurants", restaurantId, "valetTickets");
    const q = query(
      valetRef,
      where("createdAt", ">=", Timestamp.fromDate(startDate)),
      where("createdAt", "<=", Timestamp.fromDate(endDate)),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);

    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
  } catch (error) {
    console.error("Error getting valet activity:", error);
    return [];
  }
}

/**
 * Notify restaurant managers about authorization request
 */
async function notifyRestaurantManagers(restaurantId, valetCompanyId) {
  try {
    // Get restaurant managers
    const staffRef = collection(db, "restaurants", restaurantId, "staff");
    const managersQuery = query(staffRef, where("role", "in", ["manager", "general_manager", "owner"]));
    const managersSnap = await getDocs(managersQuery);

    const companyRef = doc(db, "valetCompanies", valetCompanyId);
    const companySnap = await getDoc(companyRef);
    const companyName = companySnap.exists() ? companySnap.data().name : "A valet company";

    for (const managerDoc of managersSnap.docs) {
      // const managerData = managerDoc.data(); // Available if needed
      await createNotification({
        userId: managerDoc.id,
        restaurantId,
        type: NOTIFICATION_TYPES.VALET_AUTHORIZATION_REQUEST,
        priority: NOTIFICATION_PRIORITY.MEDIUM,
        title: "Valet Company Authorization Request",
        message: `${companyName} has requested authorization to provide valet services.`,
        actionUrl: `/dashboard/restaurant/${restaurantId}/valet/authorizations`,
        metadata: {
          valetCompanyId,
          restaurantId,
        },
      });
    }
  } catch (error) {
    console.error("Error notifying restaurant managers:", error);
  }
}

/**
 * Notify valet company about approval
 */
async function notifyValetCompanyApproval(valetCompanyId, restaurantId) {
  try {
    const companyRef = doc(db, "valetCompanies", valetCompanyId);
    const companySnap = await getDoc(companyRef);
    
    if (!companySnap.exists()) return;

    const companyData = companySnap.data();
    const drivers = companyData.drivers || [];

    const restaurantRef = doc(db, "restaurants", restaurantId);
    const restaurantSnap = await getDoc(restaurantRef);
    const restaurantName = restaurantSnap.exists() ? restaurantSnap.data().name : "the restaurant";

    // Notify all drivers assigned to this restaurant
    for (const driverId of drivers) {
      const driverRef = doc(db, "users", driverId);
      const driverSnap = await getDoc(driverRef);
      
      if (driverSnap.exists()) {
        const driverData = driverSnap.data();
        if (driverData.restaurantId === restaurantId) {
          await createNotification({
            userId: driverId,
            restaurantId,
            type: NOTIFICATION_TYPES.VALET_COMPANY_APPROVED,
            priority: NOTIFICATION_PRIORITY.HIGH,
            title: "Valet Company Approved",
            message: `Your valet company has been approved to provide services at ${restaurantName}.`,
            actionUrl: `/dashboard/valet/${restaurantId}`,
            metadata: {
              valetCompanyId,
              restaurantId,
            },
          });
        }
      }
    }
  } catch (error) {
    console.error("Error notifying valet company:", error);
  }
}

