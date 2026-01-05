// src/pages/ValetReview/ValetReviewPage.jsx
//
// VALET REVIEW & CLAIMS PAGE
//
// Appears after diner picks up their car (ticket completed)
// - Driver rating (5 stars)
// - Company rating (5 stars)
// - Review text (200 words default)
// - If rating ≤ 3: Show "Do you need to make a claim?" prompt
// - If claim needed: Allow 6 photos, 1 video (45s), 1000-word description
// - Submit review or claim

import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../hooks/services/firebase";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { createValetReview, submitValetClaim } from "../../utils/valetReviewService";
import { processValetTip } from "../../utils/stripeService";
import { getStoredPaymentMethods } from "../../utils/stripeService";
import "./ValetReviewPage.css";

export default function ValetReviewPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const ticketId = searchParams.get("ticketId");
  const restaurantId = searchParams.get("restaurantId");
  const postTipAmount = parseFloat(searchParams.get("tip")) || 0;
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [valetDriver, setValetDriver] = useState(null);
  const [valetCompany, setValetCompany] = useState(null);
  
  // Review state
  const [driverRating, setDriverRating] = useState(0);
  const [companyRating, setCompanyRating] = useState(0);
  const [driverReviewText, setDriverReviewText] = useState("");
  const [companyReviewText, setCompanyReviewText] = useState("");
  const [showClaimPrompt, setShowClaimPrompt] = useState(false);
  const [needsClaim, setNeedsClaim] = useState(false);
  const [claimPromptAnswered, setClaimPromptAnswered] = useState(false);
  
  // Claim state
  const [claimPhotos, setClaimPhotos] = useState([]);
  const [claimVideo, setClaimVideo] = useState(null);
  const [claimDescription, setClaimDescription] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);
  
  // Post-tip state
  const [showPostTip, setShowPostTip] = useState(false);
  const [postTipAmountState, setPostTipAmountState] = useState(postTipAmount);
  const [postTipNote, setPostTipNote] = useState("");
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);

  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
      return;
    }

    if (!ticketId || !restaurantId) {
      navigate("/");
      return;
    }

    loadData();
  }, [currentUser, ticketId, restaurantId, navigate]);

  async function loadData() {
    try {
      setLoading(true);
      
      // Load ticket
      const ticketRef = doc(db, "restaurants", restaurantId, "valetTickets", ticketId);
      const ticketSnap = await getDoc(ticketRef);
      
      if (!ticketSnap.exists()) {
        alert("Ticket not found");
        navigate("/");
        return;
      }

      const ticketData = {
        id: ticketSnap.id,
        ...ticketSnap.data(),
      };
      setTicket(ticketData);

      // Load valet driver info
      if (ticketData.valetEmployeeId) {
        const driverRef = doc(db, "users", ticketData.valetEmployeeId);
        const driverSnap = await getDoc(driverRef);
        if (driverSnap.exists()) {
          setValetDriver({
            id: driverSnap.id,
            ...driverSnap.data(),
          });
        }
      }

      // Load valet company info
      if (ticketData.valetCompanyId) {
        const { getValetCompany } = await import("../../utils/valetCompanyService");
        try {
          const company = await getValetCompany(ticketData.valetCompanyId);
          setValetCompany(company);
        } catch (error) {
          console.error("Error loading valet company:", error);
        }
      }

      // Load payment methods for post-tip
      if (postTipAmount > 0) {
        const methods = await getStoredPaymentMethods(currentUser.uid);
        setPaymentMethods(methods);
        if (methods.length > 0) {
          setSelectedPaymentMethod(methods[0]);
        }
        setShowPostTip(true);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      alert("Failed to load review information");
      navigate("/");
    } finally {
      setLoading(false);
    }
  }

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files).slice(0, 6 - claimPhotos.length);
    setClaimPhotos([...claimPhotos, ...files]);
  };

  const handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check video duration (should be ≤ 45 seconds)
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        const duration = video.duration;
        if (duration > 45) {
          alert("Video must be 45 seconds or less");
          return;
        }
        setClaimVideo(file);
      };
      video.src = URL.createObjectURL(file);
    }
  };

  const removePhoto = (index) => {
    setClaimPhotos(claimPhotos.filter((_, i) => i !== index));
  };

  const handleRatingChange = (rating, type) => {
    let newDriverRating = driverRating;
    let newCompanyRating = companyRating;
    
    if (type === "driver") {
      newDriverRating = rating;
      setDriverRating(rating);
    } else {
      newCompanyRating = rating;
      setCompanyRating(rating);
    }

    // Show claim prompt if EITHER rating is ≤ 2 stars (only once, after both ratings are set)
    if (!claimPromptAnswered && newDriverRating > 0 && newCompanyRating > 0) {
      if (newDriverRating <= 2 || newCompanyRating <= 2) {
        setShowClaimPrompt(true);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (driverRating === 0 || companyRating === 0) {
      alert("Please rate both the driver and the company");
      return;
    }

    // Review text is optional for both driver and company
    // But if making a claim, description is required (checked below)

    if (needsClaim && claimDescription.trim().length < 50) {
      alert("Please provide a detailed description (at least 50 characters) for your claim");
      return;
    }

    // Validate character limits
    if (driverReviewText.length > 200) {
      alert("Driver review must be 200 characters or less");
      return;
    }

    if (companyReviewText.length > 200) {
      alert("Company review must be 200 characters or less");
      return;
    }

    if (needsClaim && claimDescription.length > 1000) {
      alert("Claim description must be 1000 characters or less");
      return;
    }

    setSubmitting(true);

    try {
      // Process post-tip if provided
      if (showPostTip && postTipAmountState > 0 && selectedPaymentMethod) {
        try {
          await processValetTip({
            dinerId: currentUser.uid,
            valetDriverId: ticket.valetEmployeeId,
            valetCompanyId: ticket.valetCompanyId,
            restaurantId,
            locationId: ticket.locationId || null,
            amount: postTipAmountState,
            paymentMethodId: selectedPaymentMethod.stripePaymentMethodId || selectedPaymentMethod.id,
            note: postTipNote.trim() || null,
          });
        } catch (tipError) {
          console.error("Error processing post-tip:", tipError);
          // Continue with review even if tip fails
        }
      }

      // Upload claim media if needed
      let claimPhotoUrls = [];
      let claimVideoUrl = null;

      if (needsClaim) {
        setUploadingMedia(true);
        const storage = getStorage();

        // Upload photos
        for (const photo of claimPhotos) {
          const photoRef = ref(storage, `valetClaims/${ticketId}/${Date.now()}_${photo.name}`);
          await uploadBytes(photoRef, photo);
          const url = await getDownloadURL(photoRef);
          claimPhotoUrls.push(url);
        }

        // Upload video
        if (claimVideo) {
          const videoRef = ref(storage, `valetClaims/${ticketId}/video_${Date.now()}_${claimVideo.name}`);
          await uploadBytes(videoRef, claimVideo);
          claimVideoUrl = await getDownloadURL(videoRef);
        }

        setUploadingMedia(false);

        // Submit claim
        const claimResult = await submitValetClaim({
          ticketId,
          restaurantId,
          valetCompanyId: ticket.valetCompanyId,
          valetDriverId: ticket.valetEmployeeId,
          dinerId: currentUser.uid,
          dinerName: currentUser.displayName || "Guest",
          driverRating,
          companyRating,
          description: claimDescription,
          photos: claimPhotoUrls,
          video: claimVideoUrl,
        });
        
        // Show claim number to user
        if (claimResult && claimResult.claimNumber) {
          alert(`Claim submitted successfully! Your claim number is: ${claimResult.claimNumber}`);
        }
      } else {
        // Submit review only
        await createValetReview({
          ticketId,
          restaurantId,
          valetCompanyId: ticket.valetCompanyId,
          valetDriverId: ticket.valetEmployeeId,
          dinerId: currentUser.uid,
          dinerName: currentUser.displayName || "Guest",
          driverRating,
          companyRating,
          driverReviewText: driverReviewText.trim() || null,
          companyReviewText: companyReviewText.trim() || null,
        });
      }

      alert(needsClaim ? "Claim submitted successfully" : "Review submitted successfully");
      navigate("/");
    } catch (error) {
      console.error("Error submitting review/claim:", error);
      alert(error.message || "Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
      setUploadingMedia(false);
    }
  };

  if (loading) {
    return (
      <div className="valet-review-page">
        <div className="valet-review-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="valet-review-page">
      <div className="valet-review-container">
        <div className="valet-review-header">
          <h1>How was your valet experience?</h1>
          <button className="valet-review-skip" onClick={() => navigate("/")}>
            Skip
          </button>
        </div>

        <form onSubmit={handleSubmit} className="valet-review-form">
          {/* Driver Rating */}
          <div className="valet-review-section">
            <h2>Rate Your Driver</h2>
            <p className="valet-review-driver-name">
              {valetDriver?.displayName || valetDriver?.name || "Your Valet Driver"}
            </p>
            <div className="valet-review-stars">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className={`valet-review-star ${driverRating >= star ? "active" : ""}`}
                  onClick={() => handleRatingChange(star, "driver")}
                >
                  ⭐
                </button>
              ))}
            </div>
          </div>

          {/* Company Rating */}
          <div className="valet-review-section">
            <h2>Rate the Valet Company</h2>
            <p className="valet-review-company-name">
              {valetCompany?.name || "Valet Company"}
            </p>
            <div className="valet-review-stars">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className={`valet-review-star ${companyRating >= star ? "active" : ""}`}
                  onClick={() => handleRatingChange(star, "company")}
                >
                  ⭐
                </button>
              ))}
            </div>
          </div>

          {/* Review Text (200 characters each) - Always shown, even if making a claim */}
          <div className="valet-review-section">
            <h2>Review Your Driver</h2>
            <p className="valet-review-driver-name">
              {valetDriver?.displayName || valetDriver?.name || "Your Valet Driver"}
            </p>
            <textarea
              className="valet-review-text"
              value={driverReviewText}
              onChange={(e) => setDriverReviewText(e.target.value)}
              placeholder="Share your experience with the driver... (optional, 200 characters max)"
              maxLength={200}
              rows={4}
              disabled={needsClaim}
            />
            <p className="valet-review-char-count">
              {driverReviewText.length} / 200 characters
            </p>
          </div>

          <div className="valet-review-section">
            <h2>Review the Valet Company</h2>
            <p className="valet-review-company-name">
              {valetCompany?.name || "Valet Company"}
            </p>
            <textarea
              className="valet-review-text"
              value={companyReviewText}
              onChange={(e) => setCompanyReviewText(e.target.value)}
              placeholder="Share your experience with the company... (optional, 200 characters max)"
              maxLength={200}
              rows={4}
              disabled={needsClaim}
            />
            <p className="valet-review-char-count">
              {companyReviewText.length} / 200 characters
            </p>
          </div>

          {/* Claim Prompt (if EITHER rating ≤ 2 stars) */}
          {showClaimPrompt && !needsClaim && !claimPromptAnswered && (
            <div className="valet-review-claim-prompt">
              <h3>Do you want to make a claim?</h3>
              <p>You've given a low rating. Would you like to file a formal claim with photos and video?</p>
              <div className="valet-review-claim-buttons">
                <button
                  type="button"
                  className="valet-review-btn valet-review-btn-secondary"
                  onClick={() => {
                    setNeedsClaim(false);
                    setShowClaimPrompt(false);
                    setClaimPromptAnswered(true);
                  }}
                >
                  No
                </button>
                <button
                  type="button"
                  className="valet-review-btn valet-review-btn-primary"
                  onClick={() => {
                    setNeedsClaim(true);
                    setShowClaimPrompt(false);
                    setClaimPromptAnswered(true);
                  }}
                >
                  Yes
                </button>
              </div>
            </div>
          )}

          {/* Claim Form (if needsClaim) */}
          {needsClaim && (
            <div className="valet-review-claim-form">
              <h2>File a Claim</h2>
              
              {/* Photos */}
              <div className="valet-review-claim-photos">
                <label>Photos (up to 6)</label>
                <div className="valet-review-photos-grid">
                  {claimPhotos.map((photo, index) => (
                    <div key={index} className="valet-review-photo-preview">
                      <img
                        src={URL.createObjectURL(photo)}
                        alt={`Claim photo ${index + 1}`}
                      />
                      <button
                        type="button"
                        className="valet-review-photo-remove"
                        onClick={() => removePhoto(index)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {claimPhotos.length < 6 && (
                    <label className="valet-review-photo-upload">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handlePhotoUpload}
                        style={{ display: "none" }}
                      />
                      + Add Photo
                    </label>
                  )}
                </div>
              </div>

              {/* Video */}
              <div className="valet-review-claim-video">
                <label>Video (45 seconds max)</label>
                {claimVideo ? (
                  <div className="valet-review-video-preview">
                    <video src={URL.createObjectURL(claimVideo)} controls />
                    <button
                      type="button"
                      className="valet-review-video-remove"
                      onClick={() => setClaimVideo(null)}
                    >
                      Remove Video
                    </button>
                  </div>
                ) : (
                  <label className="valet-review-video-upload">
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleVideoUpload}
                      style={{ display: "none" }}
                    />
                    + Add Video
                  </label>
                )}
              </div>

              {/* Claim Description (1000 characters) */}
              <div className="valet-review-claim-description">
                <label>Detailed Description *</label>
                <textarea
                  className="valet-review-claim-text"
                  value={claimDescription}
                  onChange={(e) => setClaimDescription(e.target.value)}
                  placeholder="Describe what happened in detail... (1000 characters max)"
                  maxLength={1000}
                  rows={8}
                  required
                />
                <p className="valet-review-char-count">
                  {claimDescription.length} / 1000 characters (minimum 50)
                </p>
              </div>
            </div>
          )}

          {/* Post-Tip Section */}
          {showPostTip && (
            <div className="valet-review-post-tip">
              <h2>Tip Your Driver (Optional)</h2>
              {paymentMethods.length > 0 ? (
                <>
                  <div className="valet-review-tip-amounts">
                    {[2, 3, 5, 10].map((tip) => (
                      <button
                        key={tip}
                        type="button"
                        className={`valet-review-tip-btn ${
                          postTipAmountState === tip ? "selected" : ""
                        }`}
                        onClick={() => setPostTipAmountState(tip)}
                      >
                        ${tip}
                      </button>
                    ))}
                    <input
                      type="number"
                      className="valet-review-tip-custom"
                      placeholder="Custom"
                      min="0"
                      step="0.01"
                      value={postTipAmountState > 0 && ![2, 3, 5, 10].includes(postTipAmountState) ? postTipAmountState : ""}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        setPostTipAmountState(value);
                      }}
                    />
                  </div>
                  {postTipAmountState > 0 && (
                    <textarea
                      className="valet-review-tip-note"
                      placeholder="Add a note (optional)"
                      value={postTipNote}
                      onChange={(e) => setPostTipNote(e.target.value)}
                      rows={3}
                    />
                  )}
                </>
              ) : (
                <p className="valet-review-no-payment-methods">
                  No payment methods saved. Tip will be skipped.
                </p>
              )}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="valet-review-submit"
            disabled={submitting || uploadingMedia}
          >
            {submitting || uploadingMedia
              ? "Submitting..."
              : needsClaim
              ? "Submit Claim and Review"
              : "Submit Review"}
          </button>
        </form>
      </div>
    </div>
  );
}

