// src/components/MenuItemReview.jsx

import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { createMenuItemReview } from "../utils/reviewService";
import TipShareModal from "./TipShareModal";
import "./MenuItemReview.css";

export default function MenuItemReview({
  isOpen,
  onClose,
  menuItem,
  server,
  bohEmployee,
  restaurantId,
  orderId = null,
}) {
  const { currentUser } = useAuth();
  
  // Item rating
  const [itemRating, setItemRating] = useState(0);
  const [itemComment, setItemComment] = useState("");
  
  // Server rating
  const [serverRating, setServerRating] = useState(0);
  const [serverComment, setServerComment] = useState("");
  const [showServerTipShare, setShowServerTipShare] = useState(false);
  
  // BOH rating
  const [bohRating, setBohRating] = useState(0);
  const [bohComment, setBohComment] = useState("");
  const [showBohTipShare, setShowBohTipShare] = useState(false);
  
  // General
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleRatingClick = (rating, type) => {
    if (type === "item") {
      setItemRating(rating);
    } else if (type === "server") {
      setServerRating(rating);
    } else if (type === "boh") {
      setBohRating(rating);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
      setError("Please log in to submit a review");
      return;
    }

    if (!itemRating || itemRating === 0) {
      setError("Please rate the menu item");
      return;
    }

    if (!serverRating || serverRating === 0) {
      setError("Please rate the server");
      return;
    }

    if (!bohRating || bohRating === 0) {
      setError("Please rate the food preparation");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await createMenuItemReview({
        dinerId: currentUser.uid,
        dinerName: currentUser.displayName || currentUser.email,
        restaurantId,
        menuItemId: menuItem?.id || menuItem?.menuItemId,
        menuItemName: menuItem?.name || menuItem?.menuItemName || "Menu Item",
        itemRating,
        itemComment: itemComment.trim() || null,
        serverId: server?.id || server?.uid,
        serverName: server?.name || server?.displayName || "Server",
        serverRating,
        serverComment: serverComment.trim() || null,
        bohId: bohEmployee?.id || bohEmployee?.uid,
        bohName: bohEmployee?.name || bohEmployee?.displayName || "Chef",
        bohRating,
        bohComment: bohComment.trim() || null,
        serverTipShare: null, // Will be set if user tips via TipShare modal
        bohTipShare: null, // Will be set if user tips via TipShare modal
        orderId,
      });

      setSuccess(true);
      
      setTimeout(() => {
        setSuccess(false);
        resetForm();
        onClose();
      }, 2000);
    } catch (err) {
      console.error("Error submitting review:", err);
      setError(err.message || "Failed to submit review. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setItemRating(0);
    setItemComment("");
    setServerRating(0);
    setServerComment("");
    setBohRating(0);
    setBohComment("");
  };

  const handleServerTipShare = (amount) => {
    // This would be handled by the TipShare modal
    // For now, we'll just show the modal
    setShowServerTipShare(true);
  };

  const handleBohTipShare = (amount) => {
    // This would be handled by the TipShare modal
    // For now, we'll just show the modal
    setShowBohTipShare(true);
  };

  if (!isOpen) return null;

  const StarRating = ({ rating, onRatingClick, type, label }) => (
    <div className="review-rating-section">
      <label className="review-rating-label">{label}</label>
      <div className="review-stars">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={`review-star ${rating >= star ? "review-star-filled" : ""}`}
            onClick={() => onRatingClick(star, type)}
            disabled={loading}
          >
            ★
          </button>
        ))}
        {rating > 0 && (
          <span className="review-rating-value">{rating}/5</span>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="review-modal-overlay" onClick={onClose}>
        <div className="review-modal" onClick={(e) => e.stopPropagation()}>
          <div className="review-modal-header">
            <h2>Review Menu Item</h2>
            <button className="review-close-btn" onClick={onClose}>×</button>
          </div>

          <div className="review-modal-body">
            {success ? (
              <div className="review-success">
                <div className="review-success-icon">✓</div>
                <h3>Review Submitted!</h3>
                <p>Thank you for your feedback.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="review-form">
                {/* Menu Item Info */}
                <div className="review-item-info">
                  <h3>{menuItem?.name || menuItem?.menuItemName || "Menu Item"}</h3>
                  {menuItem?.description && (
                    <p className="review-item-description">{menuItem.description}</p>
                  )}
                </div>

                {/* Item Rating */}
                <StarRating
                  rating={itemRating}
                  onRatingClick={handleRatingClick}
                  type="item"
                  label="Rate this menu item"
                />
                
                <div className="review-comment-section">
                  <label className="review-label">Comments about the item (Optional)</label>
                  <textarea
                    value={itemComment}
                    onChange={(e) => setItemComment(e.target.value)}
                    placeholder="How was the taste, presentation, temperature?"
                    className="review-textarea"
                    rows={3}
                    maxLength={500}
                  />
                  <div className="review-char-count">{itemComment.length}/500</div>
                </div>

                {/* Server Rating */}
                <div className="review-employee-section">
                  <div className="review-employee-header">
                    <h4>Server: {server?.name || server?.displayName || "Server"}</h4>
                    <button
                      type="button"
                      className="review-tipshare-btn"
                      onClick={() => setShowServerTipShare(true)}
                    >
                      💰 Tip Server
                    </button>
                  </div>
                  
                  <StarRating
                    rating={serverRating}
                    onRatingClick={handleRatingClick}
                    type="server"
                    label="Rate the server (communication, accuracy, service)"
                  />
                  
                  <div className="review-comment-section">
                    <label className="review-label">Comments about server (Optional)</label>
                    <textarea
                      value={serverComment}
                      onChange={(e) => setServerComment(e.target.value)}
                      placeholder="How was the service? Did they communicate well?"
                      className="review-textarea"
                      rows={2}
                      maxLength={300}
                    />
                    <div className="review-char-count">{serverComment.length}/300</div>
                  </div>
                </div>

                {/* BOH Rating */}
                <div className="review-employee-section">
                  <div className="review-employee-header">
                    <h4>Chef: {bohEmployee?.name || bohEmployee?.displayName || "Chef"}</h4>
                    <button
                      type="button"
                      className="review-tipshare-btn"
                      onClick={() => setShowBohTipShare(true)}
                    >
                      💰 Tip Chef
                    </button>
                  </div>
                  
                  <StarRating
                    rating={bohRating}
                    onRatingClick={handleRatingClick}
                    type="boh"
                    label="Rate the food preparation (quality, presentation, accuracy)"
                  />
                  
                  <div className="review-comment-section">
                    <label className="review-label">Comments about food preparation (Optional)</label>
                    <textarea
                      value={bohComment}
                      onChange={(e) => setBohComment(e.target.value)}
                      placeholder="How was the food prepared? Quality, temperature, presentation?"
                      className="review-textarea"
                      rows={2}
                      maxLength={300}
                    />
                    <div className="review-char-count">{bohComment.length}/300</div>
                  </div>
                </div>

                {error && <div className="review-error">{error}</div>}

                <div className="review-modal-footer">
                  <button
                    type="button"
                    className="review-btn review-btn-secondary"
                    onClick={onClose}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="review-btn review-btn-primary"
                    disabled={loading || !itemRating || !serverRating || !bohRating}
                  >
                    {loading ? "Submitting..." : "Submit Review"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Server TipShare Modal */}
      {showServerTipShare && server && (
        <TipShareModal
          isOpen={showServerTipShare}
          onClose={() => setShowServerTipShare(false)}
          employeeId={server?.id || server?.uid}
          employeeName={server?.name || server?.displayName || "Server"}
          restaurantId={restaurantId}
          source="review"
          sourceId={null} // Will be set after review is created
        />
      )}

      {/* BOH TipShare Modal */}
      {showBohTipShare && bohEmployee && (
        <TipShareModal
          isOpen={showBohTipShare}
          onClose={() => setShowBohTipShare(false)}
          employeeId={bohEmployee?.id || bohEmployee?.uid}
          employeeName={bohEmployee?.name || bohEmployee?.displayName || "Chef"}
          restaurantId={restaurantId}
          source="review"
          sourceId={null} // Will be set after review is created
        />
      )}
    </>
  );
}