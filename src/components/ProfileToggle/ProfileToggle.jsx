// src/components/ProfileToggle/ProfileToggle.jsx
//
// PROFILE TOGGLE COMPONENT
//
// Allows employees/drivers to toggle between:
// - Work Mode: Can be followed, can send blasts, work features enabled
// - Diner Mode: Can follow others, diner features enabled

import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../hooks/services/firebase";
import "./ProfileToggle.css";

export default function ProfileToggle() {
  const { currentUser } = useAuth();
  const [profileMode, setProfileMode] = useState("diner"); // "diner" or "work"
  const [loading, setLoading] = useState(true);
  const [canToggle, setCanToggle] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    loadProfileMode();
  }, [currentUser]);

  async function loadProfileMode() {
    try {
      const userRef = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        // Check if user is an employee or driver
        const isEmployee = userData.role === "EMPLOYEE" || userData.role === "SERVER" || userData.role === "COOK" || userData.role === "HOST";
        const isDriver = userData.role === "VALET";
        
        setCanToggle(isEmployee || isDriver);
        
        if (isEmployee || isDriver) {
          // Load saved mode preference, default to "diner"
          const savedMode = userData.profileMode || "diner";
          setProfileMode(savedMode);
        } else {
          // Regular diner, always in diner mode
          setProfileMode("diner");
        }
      }
    } catch (error) {
      console.error("Error loading profile mode:", error);
    } finally {
      setLoading(false);
    }
  }

  const toggleMode = async () => {
    if (!currentUser) return;

    const newMode = profileMode === "diner" ? "work" : "diner";
    
    try {
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        profileMode: newMode,
        updatedAt: new Date(),
      });
      
      setProfileMode(newMode);
      
      // Update currentUser context if possible
      if (currentUser.profileMode !== undefined) {
        currentUser.profileMode = newMode;
      }
    } catch (error) {
      console.error("Error updating profile mode:", error);
      alert("Failed to switch profile mode. Please try again.");
    }
  };

  if (loading || !currentUser || !canToggle) {
    return null;
  }

  return (
    <div className="profile-toggle">
      <div className="profile-toggle-label">
        <span className="profile-mode-indicator" data-mode={profileMode}>
          {profileMode === "work" ? "💼 Work Mode" : "🍽️ Diner Mode"}
        </span>
      </div>
      <button
        className={`profile-toggle-switch ${profileMode === "work" ? "work-mode" : "diner-mode"}`}
        onClick={toggleMode}
        title={`Switch to ${profileMode === "diner" ? "Work" : "Diner"} Mode`}
      >
        <span className="profile-toggle-slider" />
      </button>
      <div className="profile-mode-description">
        {profileMode === "work" ? (
          <span>You can be followed and send work blasts</span>
        ) : (
          <span>You can follow others and use diner features</span>
        )}
      </div>
    </div>
  );
}

