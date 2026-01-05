// src/utils/photoUploadService.js

import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../hooks/services/firebase";

/**
 * Photo Upload Service
 * 
 * Handles uploading photos for review items to Firebase Storage
 * Structure: restaurants/{restaurantId}/reviews/{reviewId}/items/{itemId}/photos/{photoId}
 */

const MAX_PHOTOS_PER_ITEM = 3;
const MAX_PHOTO_SIZE_MB = 5;
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

/**
 * Upload a photo for a review item
 * @param {File} file - Photo file
 * @param {string} restaurantId - Restaurant ID
 * @param {string} reviewId - Review ID
 * @param {string} itemId - Menu item ID
 * @returns {Promise<string>} Download URL of uploaded photo
 */
export async function uploadReviewPhoto(file, restaurantId, reviewId, itemId) {
  try {
    // Validate file
    if (!file) {
      throw new Error("No file provided");
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error("Invalid file type. Only JPG, PNG, and WebP are allowed.");
    }

    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > MAX_PHOTO_SIZE_MB) {
      throw new Error(`File size exceeds ${MAX_PHOTO_SIZE_MB}MB limit`);
    }

    // Generate unique filename
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const photoId = `${timestamp}_${safeName}`;

    // Upload to Firebase Storage
    const storagePath = [
      "restaurants",
      restaurantId,
      "reviews",
      reviewId,
      "items",
      itemId,
      "photos",
      photoId,
    ].join("/");

    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);

    return downloadURL;
  } catch (error) {
    console.error("Error uploading review photo:", error);
    throw error;
  }
}

/**
 * Upload multiple photos for a review item
 * @param {Array<File>} files - Array of photo files
 * @param {string} restaurantId - Restaurant ID
 * @param {string} reviewId - Review ID
 * @param {string} itemId - Menu item ID
 * @returns {Promise<Array<string>>} Array of download URLs
 */
export async function uploadReviewPhotos(files, restaurantId, reviewId, itemId) {
  try {
    if (!files || files.length === 0) {
      return [];
    }

    if (files.length > MAX_PHOTOS_PER_ITEM) {
      throw new Error(`Maximum ${MAX_PHOTOS_PER_ITEM} photos per item`);
    }

    const uploadPromises = files.map((file) =>
      uploadReviewPhoto(file, restaurantId, reviewId, itemId)
    );

    const urls = await Promise.all(uploadPromises);
    return urls;
  } catch (error) {
    console.error("Error uploading review photos:", error);
    throw error;
  }
}

/**
 * Validate photo file before upload
 * @param {File} file - Photo file
 * @returns {Object} { valid: boolean, error: string }
 */
export function validateReviewPhoto(file) {
  if (!file) {
    return { valid: false, error: "No file provided" };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: "Invalid file type. Only JPG, PNG, and WebP are allowed." };
  }

  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > MAX_PHOTO_SIZE_MB) {
    return { valid: false, error: `File size exceeds ${MAX_PHOTO_SIZE_MB}MB limit` };
  }

  return { valid: true, error: null };
}

