// src/utils/fullyVettedResumeService.js
//
// FULLY VETTED RESUME SERVICE
//
// Checks if an employee's resume is fully vetted and awards the "Fully Vetted Resume" badge

import { doc, getDoc } from "firebase/firestore";
import { db } from "../hooks/services/firebase";
import { awardBadge, getUserBadges, BADGE_TYPE } from "./badgeService";
import { notifyBadgeEarned } from "./notificationService";

/**
 * Check if employee has fully vetted resume
 * A fully vetted resume means:
 * - All employment entries are verified (no unvetted entries)
 * - OR all past employment is verified (current job can be unvetted if still active)
 * 
 * @param {string} employeeUid - Employee user ID
 * @returns {Promise<{isFullyVetted: boolean, vettedCount: number, totalCount: number}>}
 */
export async function checkFullyVettedResume(employeeUid) {
  try {
    const userRef = doc(db, "users", employeeUid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return { isFullyVetted: false, vettedCount: 0, totalCount: 0 };
    }

    const userData = userSnap.data();
    const employment = userData.employment || {};

    const vettedJobs = employment.vettedJobs || [];
    const unvettedCurrentJob = employment.currentJob && !employment.currentJob.vetted ? 1 : 0;
    const unvettedPastJobs = (employment.pastJobs || []).filter(job => !job.vetted).length;

    const totalUnvetted = unvettedCurrentJob + unvettedPastJobs;
    const totalVetted = vettedJobs.length;
    const totalCount = totalVetted + totalUnvetted;

    // Fully vetted if:
    // 1. Has at least one vetted job, AND
    // 2. No unvetted jobs (or only current job is unvetted, which is acceptable)
    const isFullyVetted = totalVetted > 0 && unvettedPastJobs === 0;

    return {
      isFullyVetted,
      vettedCount: totalVetted,
      totalCount,
      unvettedCount: totalUnvetted,
    };
  } catch (error) {
    console.error("Error checking fully vetted resume:", error);
    return { isFullyVetted: false, vettedCount: 0, totalCount: 0 };
  }
}

/**
 * Check and award "Fully Vetted Resume" badge if eligible
 * 
 * @param {string} employeeUid - Employee user ID
 * @param {string} restaurantId - Current restaurant ID (optional)
 * @param {string} companyId - Company ID (optional)
 * @returns {Promise<{awarded: boolean, badgeId?: string}>}
 */
export async function checkAndAwardFullyVettedBadge(employeeUid, restaurantId = null, companyId = null) {
  try {
    // Check if resume is fully vetted
    const { isFullyVetted } = await checkFullyVettedResume(employeeUid);

    if (!isFullyVetted) {
      return { awarded: false };
    }

    // Check if user already has this badge
    const existingBadges = await getUserBadges(employeeUid);
    const hasBadge = existingBadges.some(
      (badge) => badge.badgeId === "fully_vetted_resume" && badge.status === "approved"
    );

    if (hasBadge) {
      return { awarded: false, reason: "already_has_badge" };
    }

    // Award the badge
    const badgeData = {
      name: "Fully Vetted Resume",
      description: "All employment history has been verified by restaurants",
      icon: "✓",
      category: "resume",
      type: BADGE_TYPE.EMPLOYEE_SYSTEM,
      rarity: 3, // RARE
      pointsValue: 500, // Significant points for fully vetted resume
    };

    const badgeId = await awardBadge({
      badgeId: "fully_vetted_resume",
      badgeData,
      userId: employeeUid,
      restaurantId,
      companyId,
      awardedBy: "system",
      requiresApproval: false,
    });

    // Send notification
    try {
      await notifyBadgeEarned({
        userId: employeeUid,
        restaurantId,
        companyId,
        badgeName: badgeData.name,
        badgeIcon: badgeData.icon,
        pointsValue: badgeData.pointsValue,
        badgeId: "fully_vetted_resume",
      });
    } catch (notifError) {
      console.error("Error sending badge notification:", notifError);
    }

    return { awarded: true, badgeId };
  } catch (error) {
    console.error("Error checking and awarding fully vetted badge:", error);
    return { awarded: false };
  }
}

/**
 * Call this function whenever employment is verified
 * It will check if the resume is now fully vetted and award the badge
 */
export async function onEmploymentVerified(employeeUid, restaurantId = null, companyId = null) {
  return await checkAndAwardFullyVettedBadge(employeeUid, restaurantId, companyId);
}








