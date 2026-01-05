// src/pages/Reviews/FavoriteReviewersPage.jsx

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { collection, doc, getDoc, getDocs, query, where, setDoc } from "firebase/firestore";
import { db } from "../../hooks/services/firebase";
import { Link } from "react-router-dom";
import "./ReviewsPages.css";

export default function FavoriteReviewersPage() {
  const { currentUser } = useAuth();
  const [favoriteReviewers, setFavoriteReviewers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadFavoriteReviewers = useCallback(async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Load favorite reviewers from user's document
      const userRef = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        const favoriteIds = userData.favoriteReviewers || [];

        if (favoriteIds.length === 0) {
          setFavoriteReviewers([]);
          setLoading(false);
          return;
        }

        // Load reviewer details
        const reviewers = [];
        for (const reviewerId of favoriteIds) {
          try {
            const reviewerRef = doc(db, "users", reviewerId);
            const reviewerSnap = await getDoc(reviewerRef);

            if (reviewerSnap.exists()) {
              const reviewerData = reviewerSnap.data();
              reviewers.push({
                id: reviewerId,
                name: reviewerData.displayName || reviewerData.name || "Anonymous",
                email: reviewerData.email || "",
                ...reviewerData,
              });
            }
          } catch (err) {
            console.error(`Error loading reviewer ${reviewerId}:`, err);
          }
        }

        setFavoriteReviewers(reviewers);
      } else {
        setFavoriteReviewers([]);
      }
    } catch (err) {
      console.error("Error loading favorite reviewers:", err);
      setError("Failed to load favorite reviewers. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadFavoriteReviewers();
  }, [loadFavoriteReviewers]);

  const removeFavorite = async (reviewerId) => {
    if (!currentUser) return;

    try {
      const userRef = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists() ? userSnap.data() : {};
      const favoriteIds = userData.favoriteReviewers || [];

      const updatedFavorites = favoriteIds.filter((id) => id !== reviewerId);

      await setDoc(
        userRef,
        {
          favoriteReviewers: updatedFavorites,
        },
        { merge: true }
      );

      setFavoriteReviewers((prev) => prev.filter((r) => r.id !== reviewerId));
    } catch (err) {
      console.error("Error removing favorite:", err);
      setError("Failed to remove favorite. Please try again.");
    }
  };

  if (!currentUser) {
    return (
      <div className="reviews-page">
        <div className="reviews-header">
          <h1>Favorite Reviewers</h1>
        </div>
        <div className="reviews-content">
          <p>Please log in to view your favorite reviewers.</p>
          <Link to="/login" className="btn-primary">Log In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="reviews-page">
      <div className="reviews-header">
        <h1>Favorite Reviewers</h1>
        <Link to="/" className="back-link">← Back to Home</Link>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading">Loading favorite reviewers...</div>
      ) : favoriteReviewers.length === 0 ? (
        <div className="empty-state">
          <h2>No Favorite Reviewers Yet</h2>
          <p>
            You haven't favorited any reviewers yet. When you read a review you like, you can
            favorite the reviewer to see their reviews here.
          </p>
        </div>
      ) : (
        <div className="favorite-reviewers-list">
          {favoriteReviewers.map((reviewer) => (
            <div key={reviewer.id} className="reviewer-card">
              <div className="reviewer-info">
                <h3>{reviewer.name}</h3>
                {reviewer.email && <p className="reviewer-email">{reviewer.email}</p>}
              </div>
              <div className="reviewer-actions">
                <Link
                  to={`/reviews/reviewer/${reviewer.id}`}
                  className="btn-secondary"
                >
                  View Reviews
                </Link>
                <button
                  onClick={() => removeFavorite(reviewer.id)}
                  className="btn-remove"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

