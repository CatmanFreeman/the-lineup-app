// src/utils/socialShareService.js
//
// SOCIAL MEDIA SHARING SERVICE
//
// Handles sharing to social media platforms
// - Employee blasts (text and video)
// - Restaurant reviews (your own or others')
// - All shares include calls-to-action to join The Lineup
// - Facebook, Instagram, TikTok

/**
 * Share blast to Facebook
 * 
 * @param {string} blastId - Blast ID
 * @param {string} textContent - Text content (if text blast)
 * @param {string} videoUrl - Video URL (if video blast)
 * @param {string} restaurantName - Restaurant name
 * @param {string} employeeName - Employee name
 */
export function shareToFacebook(blastId, textContent, videoUrl, restaurantName, employeeName) {
  const url = encodeURIComponent(window.location.origin + `/feed/blast/${blastId}`);
  const text = textContent || `${employeeName} is working at ${restaurantName}! Come see them!`;
  const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${encodeURIComponent(text)}`;
  window.open(shareUrl, "_blank", "width=600,height=400");
}

/**
 * Share blast to Instagram
 * Note: Instagram doesn't support direct URL sharing, so we provide copy link
 * 
 * @param {string} blastId - Blast ID
 * @param {string} textContent - Text content (if text blast)
 * @param {string} videoUrl - Video URL (if video blast)
 */
export async function shareToInstagram(blastId, textContent, videoUrl) {
  const url = window.location.origin + `/feed/blast/${blastId}`;
  
  // Copy link to clipboard
  try {
    await navigator.clipboard.writeText(url);
    alert("Link copied to clipboard! Paste it in your Instagram story or post.");
  } catch (error) {
    // Fallback for older browsers
    const textArea = document.createElement("textarea");
    textArea.value = url;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
    alert("Link copied to clipboard! Paste it in your Instagram story or post.");
  }
}

/**
 * Share blast to TikTok
 * Note: TikTok doesn't support direct URL sharing, so we provide copy link
 * 
 * @param {string} blastId - Blast ID
 * @param {string} textContent - Text content (if text blast)
 * @param {string} videoUrl - Video URL (if video blast)
 */
export async function shareToTikTok(blastId, textContent, videoUrl) {
  const url = window.location.origin + `/feed/blast/${blastId}`;
  
  // Copy link to clipboard
  try {
    await navigator.clipboard.writeText(url);
    alert("Link copied to clipboard! Paste it in your TikTok video description.");
  } catch (error) {
    // Fallback for older browsers
    const textArea = document.createElement("textarea");
    textArea.value = url;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
    alert("Link copied to clipboard! Paste it in your TikTok video description.");
  }
}

/**
 * Share review to Facebook
 * 
 * @param {string} reviewId - Review ID
 * @param {string} restaurantName - Restaurant name
 * @param {number} rating - Rating (1-5)
 * @param {string} reviewText - Review text
 * @param {string} reviewerName - Reviewer name
 */
export function shareReviewToFacebook(reviewId, restaurantName, rating, reviewText, reviewerName) {
  const url = encodeURIComponent(window.location.origin + `/reviews?review=${reviewId}`);
  const stars = "⭐".repeat(rating);
  const text = `${reviewerName} gave ${restaurantName} ${rating} stars!\n\n"${reviewText.substring(0, 200)}${reviewText.length > 200 ? '...' : ''}"\n\nCheck out ${restaurantName} on The Lineup! Join now to see live wait times, make reservations, and discover great restaurants near you.`;
  const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${encodeURIComponent(text)}`;
  window.open(shareUrl, "_blank", "width=600,height=400");
}

/**
 * Share review to Instagram
 * 
 * @param {string} reviewId - Review ID
 * @param {string} restaurantName - Restaurant name
 * @param {number} rating - Rating (1-5)
 * @param {string} reviewText - Review text
 * @param {string} reviewerName - Reviewer name
 */
export async function shareReviewToInstagram(reviewId, restaurantName, rating, reviewText, reviewerName) {
  const url = window.location.origin + `/reviews?review=${reviewId}`;
  const stars = "⭐".repeat(rating);
  const text = `${reviewerName} gave ${restaurantName} ${rating} stars!\n\n"${reviewText.substring(0, 200)}${reviewText.length > 200 ? '...' : ''}"\n\nCheck out ${restaurantName} on The Lineup! Join now: ${url}`;
  
  try {
    await navigator.clipboard.writeText(text);
    alert("Review text copied to clipboard! Paste it in your Instagram story or post with a screenshot of the review.");
  } catch (error) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
    alert("Review text copied to clipboard! Paste it in your Instagram story or post with a screenshot of the review.");
  }
}

/**
 * Share review to TikTok
 * 
 * @param {string} reviewId - Review ID
 * @param {string} restaurantName - Restaurant name
 * @param {number} rating - Rating (1-5)
 * @param {string} reviewText - Review text
 * @param {string} reviewerName - Reviewer name
 */
export async function shareReviewToTikTok(reviewId, restaurantName, rating, reviewText, reviewerName) {
  const url = window.location.origin + `/reviews?review=${reviewId}`;
  const stars = "⭐".repeat(rating);
  const text = `${reviewerName} gave ${restaurantName} ${rating} stars! ${stars}\n\n"${reviewText.substring(0, 200)}${reviewText.length > 200 ? '...' : ''}"\n\nCheck out ${restaurantName} on The Lineup! Join now: ${url}`;
  
  try {
    await navigator.clipboard.writeText(text);
    alert("Review text copied to clipboard! Paste it in your TikTok video description.");
  } catch (error) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
    alert("Review text copied to clipboard! Paste it in your TikTok video description.");
  }
}

/**
 * Track social share for blasts
 * 
 * @param {string} blastId - Blast ID
 * @param {string} platform - "facebook", "instagram", or "tiktok"
 */
export async function trackSocialShare(blastId, platform) {
  try {
    const { doc, getDoc, updateDoc, serverTimestamp } = await import("firebase/firestore");
    const { db } = await import("../hooks/services/firebase");
    
    const blastRef = doc(db, "employeeBlasts", blastId);
    const blastSnap = await getDoc(blastRef);

    if (blastSnap.exists()) {
      const blastData = blastSnap.data();
      const currentShares = blastData.shares || {
        facebook: 0,
        instagram: 0,
        tiktok: 0,
      };

      await updateDoc(blastRef, {
        shares: {
          ...currentShares,
          [platform]: (currentShares[platform] || 0) + 1,
        },
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error("Error tracking social share:", error);
    // Don't throw - share tracking failure shouldn't block sharing
  }
}

/**
 * Track social share for reviews
 * 
 * @param {string} reviewId - Review ID
 * @param {string} platform - "facebook", "instagram", or "tiktok"
 */
export async function trackReviewShare(reviewId, platform) {
  try {
    const { doc, getDoc, updateDoc, serverTimestamp } = await import("firebase/firestore");
    const { db } = await import("../hooks/services/firebase");
    
    // Try restaurant_reviews collection first
    let reviewRef = doc(db, "restaurant_reviews", reviewId);
    let reviewSnap = await getDoc(reviewRef);

    // If not found, try valetReviews
    if (!reviewSnap.exists()) {
      reviewRef = doc(db, "valetReviews", reviewId);
      reviewSnap = await getDoc(reviewRef);
    }

    if (reviewSnap.exists()) {
      const reviewData = reviewSnap.data();
      const currentShares = reviewData.shares || {
        facebook: 0,
        instagram: 0,
        tiktok: 0,
      };

      await updateDoc(reviewRef, {
        shares: {
          ...currentShares,
          [platform]: (currentShares[platform] || 0) + 1,
        },
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error("Error tracking review share:", error);
    // Don't throw - share tracking failure shouldn't block sharing
  }
}

