// src/hooks/useUserActivity.js
//
// USER ACTIVITY HOOK
//
// Tracks user activity in the app
// Marks user as active when they interact with the app

import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { markUserActive } from "../utils/userActivityService";

export default function useUserActivity() {
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser) return;

    // Mark user as active on mount
    markUserActive(currentUser.uid);

    // Mark user as active on user interaction
    const handleActivity = () => {
      markUserActive(currentUser.uid);
    };

    // Track various user interactions
    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Also mark active periodically (every 5 minutes) if user is still on page
    const interval = setInterval(() => {
      markUserActive(currentUser.uid);
    }, 5 * 60 * 1000);

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      clearInterval(interval);
    };
  }, [currentUser]);
}








