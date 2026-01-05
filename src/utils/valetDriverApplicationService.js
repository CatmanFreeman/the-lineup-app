// src/utils/valetDriverApplicationService.js
//
// VALET DRIVER APPLICATION SERVICE
//
// Handles valet driver applications to valet companies
// - Driver signs up like a diner (regular user signup)
// - Driver applies to valet company (adds company as employer)
// - Valet company accepts/rejects application
// - Driver's ratings apply to valet company's overall rating

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../hooks/services/firebase";
import { createNotification, NOTIFICATION_TYPES, NOTIFICATION_PRIORITY } from "./notificationService";

/**
 * Valet Driver Application Status
 */
export const VALET_DRIVER_APPLICATION_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
};

/**
 * Apply to valet company (driver applies to work for company)
 * 
 * @param {Object} params
 * @param {string} params.driverId - Driver user ID
 * @param {string} params.valetCompanyId - Valet company ID
 * @param {string} params.restaurantId - Restaurant location (optional, can be set later)
 * @param {string} params.driverName - Driver name
 * @param {string} params.driverEmail - Driver email
 * @param {string} params.driverPhone - Driver phone
 * @returns {Promise<string>} Application ID
 */
export async function applyToValetCompany({
  driverId,
  valetCompanyId,
  restaurantId = null,
  driverName,
  driverEmail,
  driverPhone,
}) {
  try {
    if (!driverId || !valetCompanyId || !driverName) {
      throw new Error("Missing required fields: driverId, valetCompanyId, driverName");
    }

    // Check if application already exists
    const applicationsRef = collection(db, "valetCompanies", valetCompanyId, "driverApplications");
    const existingQuery = query(
      applicationsRef,
      where("driverId", "==", driverId),
      where("status", "in", [VALET_DRIVER_APPLICATION_STATUS.PENDING, VALET_DRIVER_APPLICATION_STATUS.APPROVED])
    );
    const existingSnap = await getDocs(existingQuery);
    
    if (!existingSnap.empty) {
      throw new Error("Application already exists for this valet company");
    }

    // Create application
    const applicationDoc = doc(applicationsRef);
    await setDoc(applicationDoc, {
      id: applicationDoc.id,
      driverId,
      valetCompanyId,
      restaurantId,
      driverName,
      driverEmail,
      driverPhone,
      status: VALET_DRIVER_APPLICATION_STATUS.PENDING,
      appliedAt: serverTimestamp(),
      approvedBy: null,
      approvedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Notify valet company admin
    await notifyValetCompanyAdmin(valetCompanyId, driverId, driverName);

    return applicationDoc.id;
  } catch (error) {
    console.error("Error applying to valet company:", error);
    throw error;
  }
}

/**
 * Approve or reject valet driver application
 * 
 * @param {Object} params
 * @param {string} params.valetCompanyId - Valet company ID
 * @param {string} params.applicationId - Application ID
 * @param {string} params.status - "APPROVED" or "REJECTED"
 * @param {string} params.approvedBy - User ID who approved/rejected (valet company admin)
 * @param {string} params.restaurantId - Restaurant location to assign driver to
 * @returns {Promise<void>}
 */
export async function approveOrRejectDriverApplication({
  valetCompanyId,
  applicationId,
  status,
  approvedBy,
  restaurantId = null,
}) {
  try {
    const applicationRef = doc(db, "valetCompanies", valetCompanyId, "driverApplications", applicationId);
    const applicationSnap = await getDoc(applicationRef);
    
    if (!applicationSnap.exists()) {
      throw new Error("Application not found");
    }

    const applicationData = applicationSnap.data();
    const driverId = applicationData.driverId;

    await updateDoc(applicationRef, {
      status,
      approvedBy,
      approvedAt: serverTimestamp(),
      restaurantId: restaurantId || applicationData.restaurantId,
      updatedAt: serverTimestamp(),
    });

    // If approved, register driver and notify them
    if (status === VALET_DRIVER_APPLICATION_STATUS.APPROVED) {
      const { registerValetDriver } = await import("./valetCompanyService");
      await registerValetDriver({
        userId: driverId,
        valetCompanyId,
        restaurantId: restaurantId || applicationData.restaurantId,
        name: applicationData.driverName,
        email: applicationData.driverEmail,
        phone: applicationData.driverPhone,
      });

      // Notify driver
      await createNotification({
        userId: driverId,
        restaurantId: restaurantId || applicationData.restaurantId,
        type: NOTIFICATION_TYPES.VALET_COMPANY_APPROVED,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title: "Application Approved",
        message: `Your application to ${valetCompanyId} has been approved! You can now access the Valet Driver Dashboard.`,
        actionUrl: `/dashboard/valet/${restaurantId || applicationData.restaurantId}`,
        metadata: {
          valetCompanyId,
          restaurantId: restaurantId || applicationData.restaurantId,
        },
      });
    } else {
      // Notify driver of rejection
      await createNotification({
        userId: driverId,
        type: NOTIFICATION_TYPES.VALET_COMPANY_APPROVED, // TODO: Add REJECTED type
        priority: NOTIFICATION_PRIORITY.MEDIUM,
        title: "Application Status",
        message: `Your application to ${valetCompanyId} was not approved at this time.`,
        metadata: {
          valetCompanyId,
          status: "rejected",
        },
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Error approving/rejecting driver application:", error);
    throw error;
  }
}

/**
 * Get pending driver applications for a valet company
 * 
 * @param {string} valetCompanyId
 * @returns {Promise<Array>} Array of pending applications
 */
export async function getPendingDriverApplications(valetCompanyId) {
  try {
    const applicationsRef = collection(db, "valetCompanies", valetCompanyId, "driverApplications");
    const q = query(
      applicationsRef,
      where("status", "==", VALET_DRIVER_APPLICATION_STATUS.PENDING)
    );
    const snap = await getDocs(q);

    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
  } catch (error) {
    console.error("Error getting pending driver applications:", error);
    return [];
  }
}

/**
 * Notify valet company admin about new driver application
 */
async function notifyValetCompanyAdmin(valetCompanyId, driverId, driverName) {
  try {
    // Get valet company admin
    const companyRef = doc(db, "valetCompanies", valetCompanyId);
    const companySnap = await getDoc(companyRef);
    
    if (!companySnap.exists()) return;

    const companyData = companySnap.data();
    const adminUserId = companyData.adminUserId;

    if (adminUserId) {
      await createNotification({
        userId: adminUserId,
        type: NOTIFICATION_TYPES.VALET_AUTHORIZATION_REQUEST, // Reuse this type
        priority: NOTIFICATION_PRIORITY.MEDIUM,
        title: "New Driver Application",
        message: `${driverName} has applied to work for your valet company.`,
        actionUrl: `/dashboard/valet-company/${valetCompanyId}/drivers`,
        metadata: {
          valetCompanyId,
          driverId,
          driverName,
        },
      });
    }
  } catch (error) {
    console.error("Error notifying valet company admin:", error);
  }
}








