// src/utils/phoneVerificationService.js
//
// PHONE VERIFICATION SERVICE
//
// For LINEUP reservations, phone verification is required.
// This service handles phone number validation and verification.

/**
 * Validate phone number format
 * 
 * @param {string} phone - Phone number
 * @returns {boolean} True if valid format
 */
export function validatePhoneFormat(phone) {
  if (!phone) return false;
  
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, "");
  
  // US phone numbers should be 10 digits
  // Allow 11 digits if it starts with 1 (country code)
  if (digitsOnly.length === 10) {
    return true;
  }
  
  if (digitsOnly.length === 11 && digitsOnly[0] === "1") {
    return true;
  }
  
  return false;
}

/**
 * Format phone number for display
 * 
 * @param {string} phone - Phone number
 * @returns {string} Formatted phone number
 */
export function formatPhoneNumber(phone) {
  if (!phone) return "";
  
  const digitsOnly = phone.replace(/\D/g, "");
  
  if (digitsOnly.length === 10) {
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  }
  
  if (digitsOnly.length === 11 && digitsOnly[0] === "1") {
    return `+1 (${digitsOnly.slice(1, 4)}) ${digitsOnly.slice(4, 7)}-${digitsOnly.slice(7)}`;
  }
  
  return phone; // Return as-is if can't format
}

/**
 * Normalize phone number for storage
 * 
 * @param {string} phone - Phone number
 * @returns {string} Normalized phone number (digits only, with country code)
 */
export function normalizePhoneNumber(phone) {
  if (!phone) return "";
  
  const digitsOnly = phone.replace(/\D/g, "");
  
  // If 10 digits, assume US and add country code
  if (digitsOnly.length === 10) {
    return `1${digitsOnly}`;
  }
  
  // If 11 digits and starts with 1, return as-is
  if (digitsOnly.length === 11 && digitsOnly[0] === "1") {
    return digitsOnly;
  }
  
  // Return digits only (will be validated elsewhere)
  return digitsOnly;
}

/**
 * Verify phone number (placeholder for future SMS/voice verification)
 * 
 * For now, this just validates the format.
 * In production, this would send a verification code via SMS.
 * 
 * @param {string} phone - Phone number
 * @returns {Promise<{verified: boolean, code?: string}>}
 */
export async function verifyPhoneNumber(phone) {
  // Validate format first
  if (!validatePhoneFormat(phone)) {
    return {
      verified: false,
      error: "Invalid phone number format",
    };
  }
  
  // TODO: In production, send SMS verification code
  // For now, just return success (format is valid)
  return {
    verified: true,
    // In production, this would include a verification code
    // code: generateVerificationCode(),
  };
}

/**
 * Check if phone verification is required for a reservation
 * 
 * @param {Date|string} reservationTime - Reservation time
 * @returns {boolean} True if verification required
 */
export function isPhoneVerificationRequired(reservationTime) {
  // Phone verification is always required for LINEUP reservations
  // This function can be extended to check other conditions
  return true;
}









