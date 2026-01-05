// src/hooks/useAutoAwards.js

import { useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { 
  runEmployeeAutoAwards, 
  runDinerAutoAwards 
} from "../utils/autoAwardService";

/**
 * Hook to automatically check and award badges
 * Call this when:
 * - Employee punches in/out
 * - Shift completes
 * - Performance rankings update
 * - Diner writes review/checks in
 */
export function useAutoAwards(restaurantId = null, companyId = "company-demo") {
  const { currentUser } = useAuth();
  
  const checkEmployeeAwards = useCallback(async () => {
    if (!currentUser?.uid || !restaurantId) return;
    
    try {
      await runEmployeeAutoAwards(currentUser.uid, restaurantId, companyId);
    } catch (error) {
      console.error("Error checking employee awards:", error);
    }
  }, [currentUser?.uid, restaurantId, companyId]);
  
  const checkDinerAwards = useCallback(async () => {
    if (!currentUser?.uid) return;
    
    try {
      await runDinerAutoAwards(currentUser.uid);
    } catch (error) {
      console.error("Error checking diner awards:", error);
    }
  }, [currentUser?.uid]);
  
  return {
    checkEmployeeAwards,
    checkDinerAwards,
  };
}