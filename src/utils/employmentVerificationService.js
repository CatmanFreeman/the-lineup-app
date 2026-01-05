// src/utils/employmentVerificationService.js
//
// EMPLOYMENT VERIFICATION SERVICE
//
// Handles employee requests to verify past employment with restaurants.
// Supports both on-app restaurants (notification) and off-app restaurants (email).

import { doc, getDoc, collection, addDoc, query, where, getDocs, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";
import { db } from "../hooks/services/firebase";
import { createNotification, NOTIFICATION_TYPES, NOTIFICATION_PRIORITY } from "./notificationService";
import { awardPoints } from "./pointsService";

/**
 * Request verification for an employment entry
 * 
 * @param {Object} params
 * @param {string} params.employeeUid - Employee user ID
 * @param {string} params.employeeName - Employee name
 * @param {string} params.restaurantName - Restaurant name
 * @param {string} params.restaurantId - Restaurant ID (if on app)
 * @param {string} params.position - Job position/role
 * @param {string} params.startDate - Employment start date
 * @param {string} params.endDate - Employment end date (null if current)
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function requestEmploymentVerification({
  employeeUid,
  employeeName,
  restaurantName,
  restaurantId = null,
  position,
  startDate,
  endDate,
}) {
  if (!employeeUid || !employeeName || !restaurantName || !position) {
    return {
      success: false,
      message: "Missing required information for verification request",
    };
  }

  try {
    // Check if restaurant is on the app
    let restaurantOnApp = false;
    let restaurantData = null;
    let companyId = null;

    if (restaurantId) {
      // Try to find restaurant by ID
      const restaurantRef = doc(db, "restaurants", restaurantId);
      const restaurantSnap = await getDoc(restaurantRef);
      
      if (restaurantSnap.exists()) {
        restaurantOnApp = true;
        restaurantData = restaurantSnap.data();
        companyId = restaurantData.companyId || null;
      }
    } else {
      // Try to find restaurant by name
      const restaurantsRef = collection(db, "restaurants");
      const nameQuery = query(
        restaurantsRef,
        where("name", "==", restaurantName)
      );
      const nameSnap = await getDocs(nameQuery);
      
      if (!nameSnap.empty) {
        restaurantOnApp = true;
        restaurantData = nameSnap.docs[0].data();
        restaurantId = nameSnap.docs[0].id;
        companyId = restaurantData.companyId || null;
      }
    }

    // Create verification request record
    const verificationRequest = {
      employeeUid,
      employeeName,
      restaurantName,
      restaurantId: restaurantId || null,
      position,
      startDate,
      endDate,
      status: "pending", // pending, approved, rejected, expired
      requestedAt: serverTimestamp(),
      restaurantOnApp,
      companyId,
    };

    const requestsRef = collection(db, "employmentVerificationRequests");
    const requestDoc = await addDoc(requestsRef, verificationRequest);
    const requestId = requestDoc.id;

    if (restaurantOnApp) {
      // Restaurant is on the app - send notification to restaurant admins/managers
      await sendOnAppVerificationNotification({
        restaurantId,
        companyId,
        employeeUid,
        employeeName,
        restaurantName,
        position,
        startDate,
        endDate,
        requestId,
      });

      return {
        success: true,
        message: `Verification request sent to ${restaurantName}. They will be notified to verify your employment.`,
        requestId,
      };
    } else {
      // Restaurant is not on the app - send email
      await sendOffAppVerificationEmail({
        restaurantName,
        employeeName,
        position,
        startDate,
        endDate,
        requestId,
      });

      return {
        success: true,
        message: `Verification request sent to ${restaurantName} via email. They will receive a link to verify your employment.`,
        requestId,
      };
    }
  } catch (error) {
    console.error("Error requesting employment verification:", error);
    return {
      success: false,
      message: "An error occurred while requesting verification. Please try again later.",
    };
  }
}

/**
 * Send notification to restaurant admins/managers for on-app verification
 */
async function sendOnAppVerificationNotification({
  restaurantId,
  companyId,
  employeeUid,
  employeeName,
  restaurantName,
  position,
  startDate,
  endDate,
  requestId,
}) {
  try {
    // Get restaurant managers/admins
    const staffRef = collection(db, "restaurants", restaurantId, "staff");
    const managerQuery = query(
      staffRef,
      where("role", "in", ["manager", "admin", "owner"])
    );
    const managerSnap = await getDocs(managerQuery);

    const notifications = [];
    const dateRange = formatDateRange(startDate, endDate);

    managerSnap.docs.forEach((doc) => {
      const staffData = doc.data();
      if (staffData.uid) {
        notifications.push(
          createNotification({
            userId: staffData.uid,
            restaurantId,
            companyId,
            type: NOTIFICATION_TYPES.EMPLOYMENT_VERIFICATION_REQUEST || "employment_verification_request",
            priority: NOTIFICATION_PRIORITY.MEDIUM,
            title: "Employment Verification Request",
            message: `${employeeName} is requesting verification of their employment at ${restaurantName} as ${position} (${dateRange})`,
            actionUrl: `/restaurant/${restaurantId}?tab=verifications&requestId=${requestId}`,
            metadata: {
              requestId,
              employeeUid,
              employeeName,
              restaurantName,
              position,
              startDate,
              endDate,
            },
          })
        );
      }
    });

    // Also notify company admins if companyId exists
    if (companyId) {
      const companyUsersRef = collection(db, "companies", companyId, "users");
      const adminQuery = query(
        companyUsersRef,
        where("role", "==", "admin")
      );
      const adminSnap = await getDocs(adminQuery);

      adminSnap.docs.forEach((doc) => {
        const userData = doc.data();
        if (userData.uid) {
          notifications.push(
            createNotification({
              userId: userData.uid,
              restaurantId,
              companyId,
              type: NOTIFICATION_TYPES.EMPLOYMENT_VERIFICATION_REQUEST || "employment_verification_request",
              priority: NOTIFICATION_PRIORITY.MEDIUM,
              title: "Employment Verification Request",
              message: `${employeeName} is requesting verification of their employment at ${restaurantName}`,
              actionUrl: `/company/${companyId}?tab=verifications&requestId=${requestId}`,
              metadata: {
                requestId,
                employeeUid,
                employeeName,
                restaurantName,
                position,
                startDate,
                endDate,
              },
            })
          );
        }
      });
    }

    await Promise.all(notifications);
  } catch (error) {
    console.error("Error sending on-app verification notification:", error);
    // Don't fail the whole request if notification fails
  }
}

/**
 * Send email to restaurant for off-app verification
 * Uses contact finding service and email service
 */
async function sendOffAppVerificationEmail({
  restaurantName,
  employeeName,
  position,
  startDate,
  endDate,
  requestId,
}) {
  try {
    // Find restaurant contact information
    const { findRestaurantContact } = await import("./restaurantContactService");
    const contactInfo = await findRestaurantContact(restaurantName);

    // Generate verification link
    const verificationLink = `${window.location.origin}/verify-employment?requestId=${requestId}`;

    if (contactInfo.found && contactInfo.email) {
      // Send email using email service
      const { sendVerificationEmail } = await import("./emailService");
      const emailResult = await sendVerificationEmail({
        toEmail: contactInfo.email,
        restaurantName,
        employeeName,
        position,
        startDate,
        endDate,
        verificationLink,
      });

      if (emailResult.success) {
        // Update request with email info
        const requestRef = doc(db, "employmentVerificationRequests", requestId);
        await updateDoc(requestRef, {
          contactEmail: contactInfo.email,
          contactPhone: contactInfo.phone,
          contactWebsite: contactInfo.website,
          emailSent: true,
          emailSentAt: serverTimestamp(),
        });
        return;
      }
    }

    // If contact not found or email failed, store for manual processing
    const emailRequestsRef = collection(db, "employmentVerificationEmails");
    await addDoc(emailRequestsRef, {
      restaurantName,
      employeeName,
      position,
      startDate,
      endDate,
      requestId,
      contactInfo: contactInfo.found ? contactInfo : null,
      verificationLink,
      status: contactInfo.found ? "email_sent" : "contact_not_found",
      createdAt: serverTimestamp(),
    });

    // Log for manual follow-up if needed
    if (!contactInfo.found) {
      console.warn(`Could not find contact info for restaurant: ${restaurantName}`);
    }
  } catch (error) {
    console.error("Error sending off-app verification email:", error);
    // Don't fail the whole request if email fails
  }
}

/**
 * Approve employment verification request
 * Called by restaurant admin/manager when they verify employment
 * 
 * @param {string} requestId - Verification request ID
 * @param {string} verifiedBy - User ID of person verifying
 * @param {Object} verifiedData - Optional corrections to dates/position
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function approveEmploymentVerification({
  requestId,
  verifiedBy,
  verifiedData = {},
}) {
  try {
    const requestRef = doc(db, "employmentVerificationRequests", requestId);
    const requestSnap = await getDoc(requestRef);

    if (!requestSnap.exists()) {
      return {
        success: false,
        message: "Verification request not found",
      };
    }

    const requestData = requestSnap.data();

    if (requestData.status !== "pending") {
      return {
        success: false,
        message: `This request has already been ${requestData.status}`,
      };
    }

    // Update request status
    await updateDoc(requestRef, {
      status: "approved",
      verifiedAt: serverTimestamp(),
      verifiedBy,
      verifiedData,
    });

    // Add to employee's vetted employment history
    const employeeRef = doc(db, "users", requestData.employeeUid);
    const employeeSnap = await getDoc(employeeRef);

    if (employeeSnap.exists()) {
      const employeeData = employeeSnap.data();
      const employment = employeeData.employment || {};
      const vettedJobs = employment.vettedJobs || [];

      // Check if already exists
      const exists = vettedJobs.some(
        (job) =>
          job.restaurantId === requestData.restaurantId &&
          job.position === (verifiedData.position || requestData.position)
      );

      if (!exists) {
        const newVettedJob = {
          restaurantId: requestData.restaurantId || null,
          restaurantName: requestData.restaurantName,
          position: verifiedData.position || requestData.position,
          startDate: verifiedData.startDate || requestData.startDate,
          endDate: verifiedData.endDate || requestData.endDate,
          vetted: true,
          vettedAt: serverTimestamp(),
          verifiedBy,
          verifiedRequestId: requestId,
        };

        await updateDoc(employeeRef, {
          "employment.vettedJobs": arrayUnion(newVettedJob),
          updatedAt: serverTimestamp(),
        });
      }
    }

    // Notify employee
    await createNotification({
      userId: requestData.employeeUid,
      restaurantId: requestData.restaurantId,
      companyId: requestData.companyId,
      type: NOTIFICATION_TYPES.EMPLOYMENT_VERIFIED || "employment_verified",
      priority: NOTIFICATION_PRIORITY.MEDIUM,
      title: "Employment Verified",
      message: `${requestData.restaurantName} has verified your employment as ${requestData.position}`,
      actionUrl: `/dashboard/employee/${requestData.restaurantId}/hr?section=resume`,
      metadata: {
        requestId,
        restaurantName: requestData.restaurantName,
        position: requestData.position,
      },
    });

    // Award points for verified employment
    try {
      await awardPoints({
        userId: requestData.employeeUid,
        points: 100, // Points for verified employment
        reason: `Employment verified: ${requestData.restaurantName} - ${requestData.position}`,
        action: "employment_verified",
        source: "employment_verification",
        sourceId: requestId,
        restaurantId: requestData.restaurantId || null,
        companyId: requestData.companyId || null,
      });
    } catch (pointsError) {
      console.error("Error awarding points for verified employment:", pointsError);
      // Don't fail verification if points fail
    }

    // Check if resume is now fully vetted and award badge
    try {
      const { onEmploymentVerified } = await import("./fullyVettedResumeService");
      await onEmploymentVerified(
        requestData.employeeUid,
        requestData.restaurantId,
        requestData.companyId
      );
    } catch (badgeError) {
      console.error("Error checking fully vetted badge:", badgeError);
      // Don't fail verification if badge check fails
    }

    return {
      success: true,
      message: "Employment verification approved and added to employee's vetted resume. Employee earned 100 points!",
    };
  } catch (error) {
    console.error("Error approving employment verification:", error);
    return {
      success: false,
      message: "An error occurred while approving verification",
    };
  }
}

/**
 * Reject employment verification request
 */
export async function rejectEmploymentVerification({
  requestId,
  rejectedBy,
  reason = null,
}) {
  try {
    const requestRef = doc(db, "employmentVerificationRequests", requestId);
    const requestSnap = await getDoc(requestRef);

    if (!requestSnap.exists()) {
      return {
        success: false,
        message: "Verification request not found",
      };
    }

    await updateDoc(requestRef, {
      status: "rejected",
      rejectedAt: serverTimestamp(),
      rejectedBy,
      rejectionReason: reason,
    });

    // Notify employee
    const requestData = requestSnap.data();
    await createNotification({
      userId: requestData.employeeUid,
      restaurantId: requestData.restaurantId,
      companyId: requestData.companyId,
      type: NOTIFICATION_TYPES.EMPLOYMENT_VERIFICATION_REJECTED || "employment_verification_rejected",
      priority: NOTIFICATION_PRIORITY.MEDIUM,
      title: "Employment Verification Rejected",
      message: `${requestData.restaurantName} was unable to verify your employment${reason ? `: ${reason}` : ""}`,
      actionUrl: `/dashboard/employee/${requestData.restaurantId}/hr?section=resume`,
      metadata: {
        requestId,
        restaurantName: requestData.restaurantName,
        reason,
      },
    });

    return {
      success: true,
      message: "Verification request rejected",
    };
  } catch (error) {
    console.error("Error rejecting employment verification:", error);
    return {
      success: false,
      message: "An error occurred while rejecting verification",
    };
  }
}

/**
 * Format date range for display
 */
function formatDateRange(startDate, endDate) {
  const formatDate = (dateString) => {
    if (!dateString) return "Present";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

