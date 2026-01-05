// src/pages/Reviews/ReadReviewsPage.jsx

import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "../../hooks/services/firebase";
import { Link } from "react-router-dom";
import ShareButton from "../../components/ShareButton/ShareButton";
import { addFavoriteReviewer, isReviewerFavorited } from "../../utils/favoriteReviewerService";
import "./ReviewsPages.css";

export default function ReadReviewsPage() {
  const { currentUser } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [favoritedReviewers, setFavoritedReviewers] = useState(new Set());

  const loadReviews = async (restaurantId) => {
    try {
      const reviewsRef = collection(db, "restaurant_reviews");
      let q;

      if (restaurantId === "all") {
        q = query(reviewsRef, orderBy("createdAt", "desc"), limit(50));
      } else {
        q = query(
          reviewsRef,
          where("restaurantId", "==", restaurantId),
          orderBy("createdAt", "desc"),
          limit(50)
        );
      }

      const snapshot = await getDocs(q);
      const reviewsList = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        reviewsList.push({
          id: docSnap.id,
          ...data,
        });
      });

      setReviews(reviewsList);

      // Check which reviewers are favorited
      if (currentUser) {
        const favoritedSet = new Set();
        await Promise.all(
          reviewsList.map(async (review) => {
            if (review.dinerId) {
              const isFav = await isReviewerFavorited(currentUser.uid, review.dinerId);
              if (isFav) {
                favoritedSet.add(review.dinerId);
              }
            }
          })
        );
        setFavoritedReviewers(favoritedSet);
      }
    } catch (err) {
      console.error("Error loading reviews:", err);
      setError("Failed to load reviews. Please try again.");
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError("");

      try {
        // Load restaurants
        const restaurantsRef = collection(db, "restaurants");
        const restaurantsSnap = await getDocs(restaurantsRef);
        const restaurantsList = [];

        restaurantsSnap.forEach((docSnap) => {
          const data = docSnap.data();
          restaurantsList.push({
            id: docSnap.id,
            name: data.name || docSnap.id,
            ...data,
          });
        });

        setRestaurants(restaurantsList);
      } catch (err) {
        console.error("Error loading restaurants:", err);
      }

      // Load reviews
      try {
        await loadReviews("all");
      } catch (err) {
        console.error("Error loading data:", err);
        setError("Failed to load reviews. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentUser]);

  const handleRestaurantChange = (e) => {
    const restaurantId = e.target.value;
    setSelectedRestaurant(restaurantId);
    loadReviews(restaurantId);
  };

  const handleFavoriteReviewer = async (reviewerId) => {
    if (!currentUser) {
      setError("Please log in to favorite reviewers");
      return;
    }

    try {
      await addFavoriteReviewer(currentUser.uid, reviewerId);
      setFavoritedReviewers((prev) => new Set([...prev, reviewerId]));
    } catch (err) {
      console.error("Error favoriting reviewer:", err);
      setError("Failed to favorite reviewer. Please try again.");
    }
  };

  return (
    <div className="reviews-page">
      <div className="reviews-header">
        <h1>Review Hub</h1>
        <Link to="/" className="back-link">← Back to Home</Link>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="reviews-filter">
        <label>
          Filter by Restaurant:
          <select
            value={selectedRestaurant}
            onChange={handleRestaurantChange}
            className="filter-select"
          >
            <option value="all">All Restaurants</option>
            {restaurants.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>
                {restaurant.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <div className="loading">Loading reviews...</div>
      ) : reviews.length === 0 ? (
        <div className="empty-state">
          <h2>No Reviews Found</h2>
          <p>No reviews available for the selected restaurant.</p>
        </div>
      ) : (
        <div className="reviews-list">
          {reviews.map((review) => (
            <div key={review.id} className="review-card">
              <div className="review-header">
                <div className="review-restaurant">
                  <h3>
                    {restaurants.find((r) => r.id === review.restaurantId)?.name ||
                      "Restaurant"}
                  </h3>
                  <span className="review-date">
                    {review.createdAt?.toDate
                      ? review.createdAt.toDate().toLocaleDateString()
                      : "Recently"}
                  </span>
                </div>
                <div className="review-rating">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      className={star <= review.overallRating ? "star-filled" : "star-empty"}
                    >
                      ★
                    </span>
                  ))}
                </div>
              </div>
              {review.overallComment && (
                <p className="review-comment">{review.overallComment}</p>
              )}
              <div className="review-actions">
                <ShareButton
                  type="review"
                  itemId={review.id}
                  restaurantName={restaurants.find((r) => r.id === review.restaurantId)?.name || "Restaurant"}
                  rating={review.overallRating}
                  reviewText={review.overallComment || ""}
                  reviewerName={review.dinerName || "Anonymous"}
                />
              </div>
              <div className="review-meta">
                <span>Items reviewed: {review.itemCount || 0}</span>
                {review.dinerName && (
                  <span>
                    By: {review.dinerName}
                    {currentUser &&
                      review.dinerId &&
                      review.dinerId !== currentUser.uid &&
                      !favoritedReviewers.has(review.dinerId) && (
                        <button
                          onClick={() => handleFavoriteReviewer(review.dinerId)}
                          className="favorite-reviewer-btn"
                          title="Favorite this reviewer"
                        >
                          ⭐ Favorite
                        </button>
                      )}
                  </span>
                )}
              </div>
              <Link
                to={`/restaurant/${review.restaurantId}`}
                className="view-restaurant-link"
              >
                View Restaurant →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

