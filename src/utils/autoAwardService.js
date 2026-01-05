// src/utils/autoAwardService.js

import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    collectionGroup,
  } from "firebase/firestore";
  import { db } from "../hooks/services/firebase";
  import {
    awardBadge,
    getUserBadges,
    calculateAndAwardTenureBadge,
  } from "./badgeService";
  import { getBadgeById } from "./badgeLibrary";
  import { notifyBadgeEarned } from "./notificationService";
  
  const COMPANY_ID = "company-demo";
  
  /**
   * Auto-Award Service
   * Automatically checks and awards badges based on user activity
   */
  
  /**
   * Check and award tenure badges for an employee
   */
  export async function checkAndAwardTenureBadge(userId, restaurantId, startDate) {
    try {
      if (!startDate) return null;
      
      const result = await calculateAndAwardTenureBadge(userId, restaurantId, startDate);
      
      if (result) {
        // Get badge info for notification
        const now = new Date();
        const start = startDate instanceof Date ? startDate : new Date(startDate);
        const yearsOfService = Math.floor((now - start) / (1000 * 60 * 60 * 24 * 365));
        const tenureBadgeId = `tenure_${yearsOfService === 0 ? "newbie" : yearsOfService}`;
        const badgeTemplate = getBadgeById(tenureBadgeId);
        
        if (badgeTemplate) {
          await notifyBadgeEarned({
            userId,
            restaurantId,
            companyId: COMPANY_ID,
            badgeName: badgeTemplate.name,
            badgeIcon: badgeTemplate.icon,
            pointsValue: badgeTemplate.pointsValue || 0,
            badgeId: tenureBadgeId,
          }).catch(err => console.error("Notification error:", err));
        }
        
        console.log(`Tenure badge awarded to ${userId}`);
      }
      
      return result;
    } catch (error) {
      console.error("Error checking tenure badge:", error);
      return null;
    }
  }
  
  /**
   * Check and award perfect attendance badges
   */
  export async function checkAndAwardAttendanceBadges(userId, restaurantId, companyId = COMPANY_ID) {
    try {
      // Get attendance records for current month
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      
      const attendanceRef = collection(
        db,
        "companies",
        companyId,
        "restaurants",
        restaurantId,
        "attendance"
      );
      
      // Get user's attendance record
      const userAttendanceRef = doc(attendanceRef, userId);
      const attendanceSnap = await getDoc(userAttendanceRef);
      
      if (!attendanceSnap.exists()) return null;
      
      const attendanceData = attendanceSnap.data();
      const history = attendanceData.history || [];
      
      // Filter to current month
      const monthShifts = history.filter((record) => {
        const recordDate = record.date?.toDate ? record.date.toDate() : new Date(record.date);
        return recordDate >= monthStart && recordDate <= monthEnd;
      });
      
      // Check for perfect attendance this month
      const scheduledShifts = monthShifts.filter(r => r.scheduled === true);
      const completedShifts = monthShifts.filter(r => 
        r.status === "completed" || r.status === "active"
      );
      
      if (scheduledShifts.length > 0 && scheduledShifts.length === completedShifts.length) {
        // Perfect attendance this month
        const existingBadges = await getUserBadges(userId, { restaurantId });
        const hasBadge = existingBadges.some(
          (b) => b.badgeId === "perfect_attendance_month" && 
                 b.awardedAt?.toDate?.()?.getMonth() === now.getMonth()
        );
        
        if (!hasBadge) {
          const badgeTemplate = getBadgeById("perfect_attendance_month");
          if (badgeTemplate) {
            const badgeId = await awardBadge({
              badgeId: "perfect_attendance_month",
              badgeData: badgeTemplate,
              userId,
              restaurantId,
              companyId,
              awardedBy: "system",
              requiresApproval: false,
            });
            
            // Send notification
            if (badgeId) {
              await notifyBadgeEarned({
                userId,
                restaurantId,
                companyId,
                badgeName: badgeTemplate.name,
                badgeIcon: badgeTemplate.icon,
                pointsValue: badgeTemplate.pointsValue || 0,
                badgeId: "perfect_attendance_month",
              }).catch(err => console.error("Notification error:", err));
            }
            
            console.log(`Perfect attendance month badge awarded to ${userId}`);
          }
        }
      }
      
      // Check for perfect attendance this year
      const yearStart = new Date(now.getFullYear(), 0, 1);
      const yearShifts = history.filter((record) => {
        const recordDate = record.date?.toDate ? record.date.toDate() : new Date(record.date);
        return recordDate >= yearStart && recordDate <= now;
      });
      
      const yearScheduled = yearShifts.filter(r => r.scheduled === true);
      const yearCompleted = yearShifts.filter(r => 
        r.status === "completed" || r.status === "active"
      );
      
      if (yearScheduled.length > 0 && yearScheduled.length === yearCompleted.length) {
        const existingBadges = await getUserBadges(userId, { restaurantId });
        const hasBadge = existingBadges.some(
          (b) => b.badgeId === "perfect_attendance_year" && 
                 b.awardedAt?.toDate?.()?.getFullYear() === now.getFullYear()
        );
        
        if (!hasBadge) {
          const badgeTemplate = getBadgeById("perfect_attendance_year");
          if (badgeTemplate) {
            const badgeId = await awardBadge({
              badgeId: "perfect_attendance_year",
              badgeData: badgeTemplate,
              userId,
              restaurantId,
              companyId,
              awardedBy: "system",
              requiresApproval: false,
            });
            
            // Send notification
            if (badgeId) {
              await notifyBadgeEarned({
                userId,
                restaurantId,
                companyId,
                badgeName: badgeTemplate.name,
                badgeIcon: badgeTemplate.icon,
                pointsValue: badgeTemplate.pointsValue || 0,
                badgeId: "perfect_attendance_year",
              }).catch(err => console.error("Notification error:", err));
            }
            
            console.log(`Perfect attendance year badge awarded to ${userId}`);
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error("Error checking attendance badges:", error);
      return null;
    }
  }
  
  /**
   * Check and award shift completion badges
   */
  export async function checkAndAwardShiftBadges(userId, restaurantId, companyId = COMPANY_ID) {
    try {
      const attendanceRef = collection(
        db,
        "companies",
        companyId,
        "restaurants",
        restaurantId,
        "attendance"
      );
      
      const userAttendanceRef = doc(attendanceRef, userId);
      const attendanceSnap = await getDoc(userAttendanceRef);
      
      if (!attendanceSnap.exists()) return null;
      
      const attendanceData = attendanceSnap.data();
      const history = attendanceData.history || [];
      
      // Count completed shifts
      const completedShifts = history.filter(r => 
        r.status === "completed" || r.status === "active"
      );
      
      const totalShifts = completedShifts.length;
      
      // Check for 100 shifts badge
      if (totalShifts >= 100) {
        const existingBadges = await getUserBadges(userId, { restaurantId });
        const hasBadge = existingBadges.some(b => b.badgeId === "shift_100");
        
        if (!hasBadge) {
          const badgeTemplate = getBadgeById("shift_100");
          if (badgeTemplate) {
            const badgeId = await awardBadge({
              badgeId: "shift_100",
              badgeData: badgeTemplate,
              userId,
              restaurantId,
              companyId,
              awardedBy: "system",
              requiresApproval: false,
            });
            
            // Send notification
            if (badgeId) {
              await notifyBadgeEarned({
                userId,
                restaurantId,
                companyId,
                badgeName: badgeTemplate.name,
                badgeIcon: badgeTemplate.icon,
                pointsValue: badgeTemplate.pointsValue || 0,
                badgeId: "shift_100",
              }).catch(err => console.error("Notification error:", err));
            }
            
            console.log(`100 shifts badge awarded to ${userId}`);
          }
        }
      }
      
      // Check for night owl badge (50 night shifts)
      const nightShifts = completedShifts.filter(r => {
        if (!r.punchedInAt) return false;
        const punchTime = r.punchedInAt.toDate ? r.punchedInAt.toDate() : new Date(r.punchedInAt);
        const hour = punchTime.getHours();
        return hour >= 18 || hour < 6; // 6 PM to 6 AM
      });
      
      if (nightShifts.length >= 50) {
        const existingBadges = await getUserBadges(userId, { restaurantId });
        const hasBadge = existingBadges.some(b => b.badgeId === "night_owl");
        
        if (!hasBadge) {
          const badgeTemplate = getBadgeById("night_owl");
          if (badgeTemplate) {
            const badgeId = await awardBadge({
              badgeId: "night_owl",
              badgeData: badgeTemplate,
              userId,
              restaurantId,
              companyId,
              awardedBy: "system",
              requiresApproval: false,
            });
            
            // Send notification
            if (badgeId) {
              await notifyBadgeEarned({
                userId,
                restaurantId,
                companyId,
                badgeName: badgeTemplate.name,
                badgeIcon: badgeTemplate.icon,
                pointsValue: badgeTemplate.pointsValue || 0,
                badgeId: "night_owl",
              }).catch(err => console.error("Notification error:", err));
            }
            
            console.log(`Night owl badge awarded to ${userId}`);
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error("Error checking shift badges:", error);
      return null;
    }
  }
  
  /**
   * Check and award top performer badge (monthly)
   */
  export async function checkAndAwardTopPerformerBadge(
    userId,
    restaurantId,
    companyId = COMPANY_ID,
    performanceScore
  ) {
    try {
      // Get all employees' performance scores for current month
      const now = new Date();
      
      // Get ranking snapshot for current period
      const weekEndingISO = (() => {
        const day = now.getDay();
        const daysToSunday = (7 - day) % 7;
        const sunday = new Date(now);
        sunday.setDate(now.getDate() + daysToSunday);
        const yyyy = sunday.getFullYear();
        const mm = String(sunday.getMonth() + 1).padStart(2, "0");
        const dd = String(sunday.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
      })();
      
      const rankingRef = doc(
        db,
        "companies",
        companyId,
        "restaurants",
        restaurantId,
        "rankingSnapshots",
        weekEndingISO
      );
      
      const rankingSnap = await getDoc(rankingRef);
      if (!rankingSnap.exists()) return null;
      
      const rankingData = rankingSnap.data();
      const eliteBand = rankingData.bands?.elite || [];
      
      // Check if user is in elite band and has highest score
      const userInElite = eliteBand.find(e => e.uid === userId);
      if (!userInElite) return null;
      
      // Check if they have the highest score in elite band
      const topPerformer = eliteBand.reduce((top, emp) => {
        return (emp.score || 0) > (top.score || 0) ? emp : top;
      }, eliteBand[0]);
      
      if (topPerformer.uid === userId) {
        // Check if they already have this badge for this month
        const existingBadges = await getUserBadges(userId, { restaurantId });
        const hasBadge = existingBadges.some(
          (b) => b.badgeId === "top_performer" && 
                 b.awardedAt?.toDate?.()?.getMonth() === now.getMonth() &&
                 b.awardedAt?.toDate?.()?.getFullYear() === now.getFullYear()
        );
        
        if (!hasBadge) {
          const badgeTemplate = getBadgeById("top_performer");
          if (badgeTemplate) {
            const badgeId = await awardBadge({
              badgeId: "top_performer",
              badgeData: badgeTemplate,
              userId,
              restaurantId,
              companyId,
              awardedBy: "system",
              requiresApproval: false,
            });
            
            // Send notification
            if (badgeId) {
              await notifyBadgeEarned({
                userId,
                restaurantId,
                companyId,
                badgeName: badgeTemplate.name,
                badgeIcon: badgeTemplate.icon,
                pointsValue: badgeTemplate.pointsValue || 0,
                badgeId: "top_performer",
              }).catch(err => console.error("Notification error:", err));
            }
            
            console.log(`Top performer badge awarded to ${userId}`);
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error("Error checking top performer badge:", error);
      return null;
    }
  }
  
  /**
   * Check and award diner badges
   */
  export async function checkAndAwardDinerBadges(userId) {
    try {
      // Get user's reviews
      const reviewsQuery = query(
        collectionGroup(db, "reviews"),
        where("userId", "==", userId),
        orderBy("timestamp", "desc")
      );
      
      const reviewsSnap = await getDocs(reviewsQuery);
      const reviews = reviewsSnap.docs.map(d => d.data());
      
      // Check for review badges
      const reviewCount = reviews.length;
      
      if (reviewCount >= 1) {
        const existingBadges = await getUserBadges(userId);
        const hasBadge = existingBadges.some(b => b.badgeId === "review_1");
        
        if (!hasBadge) {
          const badgeTemplate = getBadgeById("review_1");
          if (badgeTemplate) {
            const badgeId = await awardBadge({
              badgeId: "review_1",
              badgeData: badgeTemplate,
              userId,
              restaurantId: null,
              companyId: null,
              awardedBy: "system",
              requiresApproval: false,
            });
            
            // Send notification
            if (badgeId) {
              await notifyBadgeEarned({
                userId,
                restaurantId: null,
                companyId: null,
                badgeName: badgeTemplate.name,
                badgeIcon: badgeTemplate.icon,
                pointsValue: badgeTemplate.pointsValue || 0,
                badgeId: "review_1",
              }).catch(err => console.error("Notification error:", err));
            }
          }
        }
      }
      
      if (reviewCount >= 10) {
        const existingBadges = await getUserBadges(userId);
        const hasBadge = existingBadges.some(b => b.badgeId === "review_10");
        
        if (!hasBadge) {
          const badgeTemplate = getBadgeById("review_10");
          if (badgeTemplate) {
            const badgeId = await awardBadge({
              badgeId: "review_10",
              badgeData: badgeTemplate,
              userId,
              restaurantId: null,
              companyId: null,
              awardedBy: "system",
              requiresApproval: false,
            });
            
            // Send notification
            if (badgeId) {
              await notifyBadgeEarned({
                userId,
                restaurantId: null,
                companyId: null,
                badgeName: badgeTemplate.name,
                badgeIcon: badgeTemplate.icon,
                pointsValue: badgeTemplate.pointsValue || 0,
                badgeId: "review_10",
              }).catch(err => console.error("Notification error:", err));
            }
          }
        }
      }
      
      // Check for check-in badges
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const checkIns = userData.recentCheckins || [];
        
        if (checkIns.length >= 10) {
          const existingBadges = await getUserBadges(userId);
          const hasBadge = existingBadges.some(b => b.badgeId === "check_in_10");
          
          if (!hasBadge) {
            const badgeTemplate = getBadgeById("check_in_10");
            if (badgeTemplate) {
              const badgeId = await awardBadge({
                badgeId: "check_in_10",
                badgeData: badgeTemplate,
                userId,
                restaurantId: null,
                companyId: null,
                awardedBy: "system",
                requiresApproval: false,
              });
              
              // Send notification
              if (badgeId) {
                await notifyBadgeEarned({
                  userId,
                  restaurantId: null,
                  companyId: null,
                  badgeName: badgeTemplate.name,
                  badgeIcon: badgeTemplate.icon,
                  pointsValue: badgeTemplate.pointsValue || 0,
                  badgeId: "check_in_10",
                }).catch(err => console.error("Notification error:", err));
              }
            }
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error("Error checking diner badges:", error);
      return null;
    }
  }
  
  /**
   * Run all auto-award checks for an employee
   */
  export async function runEmployeeAutoAwards(userId, restaurantId, companyId = COMPANY_ID) {
    try {
      // Get employee data
      const staffRef = doc(db, "restaurants", restaurantId, "staff", userId);
      const staffSnap = await getDoc(staffRef);
      
      if (!staffSnap.exists()) return;
      
      const staffData = staffSnap.data();
      const startDate = staffData.startDate || staffData.hireDate;
      
      // Run all checks
      await Promise.all([
        checkAndAwardTenureBadge(userId, restaurantId, startDate),
        checkAndAwardAttendanceBadges(userId, restaurantId, companyId),
        checkAndAwardShiftBadges(userId, restaurantId, companyId),
        // Top performer check would need performance score passed in
      ]);
      
      console.log(`Auto-award checks completed for ${userId}`);
    } catch (error) {
      console.error("Error running auto-awards:", error);
    }
  }
  
  /**
   * Run all auto-award checks for a diner
   */
  export async function runDinerAutoAwards(userId) {
    try {
      await checkAndAwardDinerBadges(userId);
      console.log(`Auto-award checks completed for diner ${userId}`);
    } catch (error) {
      console.error("Error running diner auto-awards:", error);
    }
  }