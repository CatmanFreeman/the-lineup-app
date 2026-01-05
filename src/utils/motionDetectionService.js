// src/utils/motionDetectionService.js
//
// MOTION DETECTION SERVICE
//
// Detects when user is driving (motion at driving speed)
// Uses GPS speed data to determine if user is in a vehicle
// Triggers prompts for restaurant selection and valet booking

import { getCurrentLocation } from "./arrivalDetectionService";

// Constants
const DRIVING_SPEED_THRESHOLD_MPH = 15; // Minimum speed to consider "driving" (mph)
const DRIVING_SPEED_THRESHOLD_MPS = DRIVING_SPEED_THRESHOLD_MPH * 0.44704; // Convert to m/s
const CHECK_INTERVAL_MS = 5000; // Check every 5 seconds when motion detected
const MOTION_CONFIRMATION_COUNT = 3; // Need 3 consecutive readings to confirm driving

/**
 * Get current speed from GPS
 * @returns {Promise<number|null>} Speed in m/s or null
 */
export function getCurrentSpeed() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    let lastPosition = null;
    let lastTimestamp = null;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const currentTime = position.timestamp || Date.now();
        const currentLat = position.coords.latitude;
        const currentLng = position.coords.longitude;
        
        // CRITICAL FIX: Reject stale GPS data (older than 30 seconds)
        const dataAge = Date.now() - currentTime;
        if (dataAge > 30000) {
          console.warn('⚠️ Rejecting stale GPS data:', dataAge, 'ms old');
          return; // Don't use this data
        }

        if (lastPosition && lastTimestamp) {
          const timeDiff = (currentTime - lastTimestamp) / 1000; // seconds
          
          // CRITICAL FIX: Reject if time difference is too large (stale data)
          if (timeDiff > 60 || timeDiff < 0) {
            console.warn('⚠️ Rejecting invalid time difference:', timeDiff, 'seconds');
            navigator.geolocation.clearWatch(watchId);
            resolve(null);
            return;
          }
          
          const distance = haversineMeters(
            lastPosition.lat,
            lastPosition.lng,
            currentLat,
            currentLng
          );
          
          // CRITICAL FIX: Reject if distance is suspiciously large (GPS error)
          if (distance > 10000) { // More than 10km in a few seconds = GPS error
            console.warn('⚠️ Rejecting suspicious GPS jump:', distance, 'meters');
            navigator.geolocation.clearWatch(watchId);
            resolve(null);
            return;
          }
          
          const speed = timeDiff > 0 ? distance / timeDiff : 0; // m/s
          
          navigator.geolocation.clearWatch(watchId);
          resolve(speed);
        } else {
          lastPosition = { lat: currentLat, lng: currentLng };
          lastTimestamp = currentTime;
        }
      },
      (error) => {
        navigator.geolocation.clearWatch(watchId);
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );

    // Timeout after 10 seconds
    setTimeout(() => {
      navigator.geolocation.clearWatch(watchId);
      resolve(null);
    }, 10000);
  });
}

/**
 * Calculate distance between two points (Haversine formula)
 */
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check if user is currently driving
 * @returns {Promise<boolean>} True if user appears to be driving
 */
export async function isUserDriving() {
  try {
    const speeds = [];
    
    // Take multiple readings to confirm driving
    for (let i = 0; i < MOTION_CONFIRMATION_COUNT; i++) {
      const speed = await getCurrentSpeed();
      if (speed !== null) {
        speeds.push(speed);
      }
      if (i < MOTION_CONFIRMATION_COUNT - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds between readings
      }
    }

    if (speeds.length === 0) {
      return false;
    }

    // Average speed
    const avgSpeed = speeds.reduce((sum, s) => sum + s, 0) / speeds.length;
    
    // Check if average speed exceeds threshold
    return avgSpeed >= DRIVING_SPEED_THRESHOLD_MPS;
  } catch (error) {
    console.error("Error checking if user is driving:", error);
    return false;
  }
}

/**
 * Monitor user motion and detect driving
 * @param {Function} onDrivingDetected - Callback when driving is detected
 * @param {Function} onStopped - Callback when user stops
 * @returns {Function} Cleanup function
 */
export function monitorMotion(onDrivingDetected, onStopped) {
  let isMonitoring = true;
  let wasDriving = false;
  let checkInterval = null;
  let consecutiveDrivingChecks = 0;
  let consecutiveStoppedChecks = 0;
  const REQUIRED_CONSECUTIVE_CHECKS = 2; // Need 2 consecutive checks to confirm state change

  async function checkMotion() {
    if (!isMonitoring) return;

    try {
      const driving = await isUserDriving();
      
      if (driving) {
        consecutiveStoppedChecks = 0;
        consecutiveDrivingChecks++;
        
        // Only trigger if we've confirmed driving for multiple checks
        if (consecutiveDrivingChecks >= REQUIRED_CONSECUTIVE_CHECKS && !wasDriving) {
          // Started driving (confirmed)
          wasDriving = true;
          console.log('🚗 Confirmed: User is driving');
          if (onDrivingDetected) {
            onDrivingDetected();
          }
        }
      } else {
        consecutiveDrivingChecks = 0;
        consecutiveStoppedChecks++;
        
        // Only trigger if we've confirmed stopped for multiple checks
        if (consecutiveStoppedChecks >= REQUIRED_CONSECUTIVE_CHECKS && wasDriving) {
          // Stopped driving (confirmed)
          wasDriving = false;
          console.log('🛑 Confirmed: User stopped driving');
          if (onStopped) {
            onStopped();
          }
        }
      }
    } catch (error) {
      console.error("Error in motion monitoring:", error);
      // On error, don't change state - prevents false positives
    }
  }

  // Start monitoring
  checkMotion();
  checkInterval = setInterval(checkMotion, CHECK_INTERVAL_MS);

  // Return cleanup function
  return () => {
    isMonitoring = false;
    if (checkInterval) {
      clearInterval(checkInterval);
    }
    // Reset state on cleanup
    wasDriving = false;
    consecutiveDrivingChecks = 0;
    consecutiveStoppedChecks = 0;
  };
}




