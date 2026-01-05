// src/pages/FollowersFeed/FollowersFeedPage.jsx
//
// FOLLOWERS FEED PAGE
//
// Displays blasts from followed employees/drivers
// - Shows text and video blasts
// - Allows liking and sharing
// - Nudges users to interact and visit restaurants

import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { getFollowedEmployeeBlasts, likeEmployeeBlast } from "../../utils/employeeBlastService";
import { shareToFacebook, shareToInstagram, shareToTikTok, trackSocialShare } from "../../utils/socialShareService";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../hooks/services/firebase";
import ShareButton from "../../components/ShareButton/ShareButton";
import "./FollowersFeedPage.css";

export default function FollowersFeedPage() {
  const { currentUser } = useAuth();
  const [blasts, setBlasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [likedBlasts, setLikedBlasts] = useState(new Set());

  useEffect(() => {
    if (currentUser) {
      loadBlasts();
    } else {
      setLoading(false);
    }
  }, [currentUser]);

  async function loadBlasts() {
    try {
      setLoading(true);
      const blastsData = await getFollowedEmployeeBlasts(currentUser.uid, 50);
      
      // Load employee and restaurant names
      const blastsWithNames = await Promise.all(
        blastsData.map(async (blast) => {
          try {
            const employeeRef = doc(db, "users", blast.employeeId);
            const employeeSnap = await getDoc(employeeRef);
            const employeeData = employeeSnap.data();
            
            const restaurantRef = doc(db, "restaurants", blast.restaurantId);
            const restaurantSnap = await getDoc(restaurantRef);
            const restaurantData = restaurantSnap.data();
            
            return {
              ...blast,
              employeeName: employeeData?.name || employeeData?.displayName || "Employee",
              restaurantName: restaurantData?.name || "Restaurant",
            };
          } catch (error) {
            console.error("Error loading blast details:", error);
            return {
              ...blast,
              employeeName: "Employee",
              restaurantName: "Restaurant",
            };
          }
        })
      );
      
      setBlasts(blastsWithNames);
    } catch (error) {
      console.error("Error loading blasts:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleLike = async (blastId) => {
    if (!currentUser) {
      alert("Please log in to like blasts");
      return;
    }

    try {
      await likeEmployeeBlast(blastId, currentUser.uid);
      setLikedBlasts((prev) => new Set([...prev, blastId]));
      
      // Update local state
      setBlasts((prev) =>
        prev.map((blast) =>
          blast.id === blastId
            ? { ...blast, likes: (blast.likes || 0) + 1 }
            : blast
        )
      );
    } catch (error) {
      console.error("Error liking blast:", error);
      alert("Failed to like blast. Please try again.");
    }
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return "Just now";
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (!currentUser) {
    return (
      <div className="followers-feed-page">
        <div className="followers-feed-header">
          <h1>Followers Feed</h1>
        </div>
        <div className="followers-feed-empty">
          <p>Please log in to see blasts from your favorite staff members.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="followers-feed-page">
        <div className="followers-feed-header">
          <h1>Followers Feed</h1>
        </div>
        <div className="followers-feed-loading">Loading blasts...</div>
      </div>
    );
  }

  return (
    <div className="followers-feed-page">
      <div className="followers-feed-header">
        <h1>Followers Feed</h1>
        <p className="followers-feed-subtitle">
          See what your favorite staff members are up to!
        </p>
      </div>

      {blasts.length === 0 ? (
        <div className="followers-feed-empty">
          <p>No blasts yet. Follow your favorite staff members to see their updates!</p>
          <p className="followers-feed-empty-hint">
            💡 When staff members punch in, they can send blasts to their followers.
          </p>
        </div>
      ) : (
        <div className="followers-feed-list">
          {blasts.map((blast) => (
            <div key={blast.id} className="followers-feed-blast-card">
              <div className="followers-feed-blast-header">
                <div className="followers-feed-blast-author">
                  <div className="followers-feed-blast-author-info">
                    <h3>{blast.employeeName}</h3>
                    <p className="followers-feed-blast-restaurant">
                      @ {blast.restaurantName}
                    </p>
                  </div>
                </div>
                <span className="followers-feed-blast-time">
                  {formatTimeAgo(blast.createdAt)}
                </span>
              </div>

              {blast.blastType === "text" && (
                <div className="followers-feed-blast-content">
                  <p>{blast.textContent}</p>
                </div>
              )}

              {blast.blastType === "video" && blast.videoUrl && (
                <div className="followers-feed-blast-video">
                  <video src={blast.videoUrl} controls className="followers-feed-video-player" />
                </div>
              )}

              <div className="followers-feed-blast-actions">
                <button
                  className={`followers-feed-like-btn ${
                    likedBlasts.has(blast.id) ? "liked" : ""
                  }`}
                  onClick={() => handleLike(blast.id)}
                >
                  ❤️ {blast.likes || 0}
                </button>
                <ShareButton
                  type="blast"
                  itemId={blast.id}
                  textContent={blast.textContent}
                  videoUrl={blast.videoUrl}
                  restaurantName={blast.restaurantName}
                  employeeName={blast.employeeName}
                />
              </div>

              <div className="followers-feed-blast-cta">
                <p className="followers-feed-cta-text">
                  💡 Want to see {blast.employeeName}? Visit {blast.restaurantName} on The Lineup!
                </p>
                <a
                  href={`/restaurant/${blast.restaurantId}`}
                  className="followers-feed-cta-button"
                >
                  View Restaurant →
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

