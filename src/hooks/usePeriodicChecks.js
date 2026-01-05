// src/hooks/usePeriodicChecks.js

import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { runEmployeeAutoAwards, runDinerAutoAwards } from "../utils/autoAwardService";

/**
 * Hook to run periodic auto-award checks
 * 
 * @param {Object} options
 * @param {string} options.restaurantId - Restaurant ID (for employees)
 * @param {string} options.companyId - Company ID
 * @param {boolean} options.enabled - Whether to run checks
 * @param {number} options.intervalMinutes - How often to check (default: 60 minutes)
 */
export default function usePeriodicChecks({
  restaurantId = null,
  companyId = "company-demo",
  enabled = true,
  intervalMinutes = 60,
}) {
  const { currentUser } = useAuth();
  const intervalRef = useRef(null);
  const lastCheckRef = useRef(null);

  useEffect(() => {
    if (!enabled || !currentUser) {
      return;
    }

    // Run initial check
    const runChecks = async () => {
      try {
        // Check if enough time has passed
        const now = Date.now();
        if (lastCheckRef.current && (now - lastCheckRef.current) < intervalMinutes * 60 * 1000) {
          return;
        }

        lastCheckRef.current = now;

        // Run employee checks if restaurantId is provided
        if (restaurantId) {
          await runEmployeeAutoAwards(currentUser.uid, restaurantId, companyId);
        }

        // Run diner checks for all users
        await runDinerAutoAwards(currentUser.uid);
      } catch (error) {
        console.error("Error running periodic checks:", error);
      }
    };

    // Run immediately on mount
    runChecks();

    // Set up interval
    intervalRef.current = setInterval(runChecks, intervalMinutes * 60 * 1000);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, currentUser, restaurantId, companyId, intervalMinutes]);
}