// src/pages/Reviews/ReviewerReviewsPage.jsx

import React, { useState, useEffect, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../../hooks/services/firebase";
import { addFavoriteReviewer, removeFavoriteReviewer } from "../../utils/favoriteReviewerService";
import { createMockReviewerProfiles } from "../../utils/mockReviewService";
import ShareButton from "../../components/ShareButton/ShareButton";
import "./ReviewsHomePage.css";

// Distance calculation (Haversine formula)
function milesBetween(lat1, lon1, lat2, lon2) {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export default function ReviewerReviewsPage() {
  const { reviewerId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reviewer, setReviewer] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [expandedReviews, setExpandedReviews] = useState(new Set());

  // Left Column: Past Reviews & Favorite Reviewers
  const [myReviews, setMyReviews] = useState([]);
  const [favoriteReviewers, setFavoriteReviewers] = useState([]);
  const [favoritedReviewerIds, setFavoritedReviewerIds] = useState(new Set());

  // Center Column: Reviewer's Reviews
  const [allReviews, setAllReviews] = useState([]);
  const [mainReviews, setMainReviews] = useState([]);

  // Right Column: Search
  const [restaurants, setRestaurants] = useState([]);
  const [searchFilters, setSearchFilters] = useState({
    restaurant: "",
    cuisine: "",
    radius: "Any Radius",
  });

  const radiusOptions = ["Any Radius", "5 miles", "10 miles", "15 miles", "25 miles"];

  // Get user location
  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn("Geolocation not available");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      (error) => {
        console.warn("Error getting location:", error);
      }
    );
  }, []);

  // Load reviewer info
  useEffect(() => {
    const loadReviewer = async () => {
      if (!reviewerId) return;
      try {
        const reviewerRef = doc(db, "users", reviewerId);
        const reviewerSnap = await getDoc(reviewerRef);
        if (reviewerSnap.exists()) {
          setReviewer({
            id: reviewerSnap.id,
            ...reviewerSnap.data(),
          });
        } else {
          // If reviewer doesn't exist and it's a mock diner, try to create the profile
          if (reviewerId.startsWith("mock-diner-")) {
            console.log("Reviewer profile not found, attempting to create...");
            try {
              await createMockReviewerProfiles();
              // Try loading again
              const retrySnap = await getDoc(reviewerRef);
              if (retrySnap.exists()) {
                setReviewer({
                  id: retrySnap.id,
                  ...retrySnap.data(),
                });
              }
            } catch (createError) {
              console.error("Error creating reviewer profile:", createError);
            }
          }
        }
      } catch (error) {
        console.error("Error loading reviewer:", error);
      }
    };
    loadReviewer();
  }, [reviewerId]);

  // Load reviewer's reviews
  useEffect(() => {
    if (!reviewerId) return;

    const loadReviews = async () => {
      setLoading(true);
      try {
        const reviewsRef = collection(db, "restaurant_reviews");
        const q = query(
          reviewsRef,
          where("dinerId", "==", reviewerId),
          orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        const reviews = [];
        snapshot.forEach((doc) => {
          reviews.push({
            id: doc.id,
            ...doc.data(),
          });
        });
        console.log(`Loaded ${reviews.length} reviews for reviewer ${reviewerId}`, reviews);
        setAllReviews(reviews);
        // Set main reviews immediately
        if (reviews.length > 0) {
          console.log(`Setting main reviews:`, reviews.slice(0, 5));
          setMainReviews(reviews.slice(0, 5));
        } else {
          console.log(`No reviews found for reviewer ${reviewerId}`);
        }
      } catch (error) {
        console.error("Error loading reviews:", error);
        // If index error, try without orderBy
        try {
          const reviewsRef = collection(db, "restaurant_reviews");
          const q = query(
            reviewsRef,
            where("dinerId", "==", reviewerId)
          );
          const snapshot = await getDocs(q);
          const reviews = [];
          snapshot.forEach((doc) => {
            reviews.push({
              id: doc.id,
              ...doc.data(),
            });
          });
          // Sort manually by createdAt
          reviews.sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
            return dateB - dateA;
          });
          console.log(`Loaded ${reviews.length} reviews for reviewer ${reviewerId} (fallback)`, reviews);
          setAllReviews(reviews);
          // Set main reviews immediately
          if (reviews.length > 0) {
            setMainReviews(reviews.slice(0, 5));
          }
        } catch (fallbackError) {
          console.error("Error loading reviews (fallback):", fallbackError);
        }
      } finally {
        setLoading(false);
      }
    };

    loadReviews();
  }, [reviewerId]);

  // Load restaurants
  useEffect(() => {
    const loadRestaurants = async () => {
      try {
        const restaurantsRef = collection(db, "restaurants");
        const snapshot = await getDocs(restaurantsRef);
        const restaurantsList = [];
        snapshot.forEach((doc) => {
          restaurantsList.push({
            id: doc.id,
            ...doc.data(),
          });
        });
        setRestaurants(restaurantsList);
      } catch (error) {
        console.error("Error loading restaurants:", error);
      }
    };
    loadRestaurants();
  }, []);

  // Load my reviews
  useEffect(() => {
    if (!currentUser) return;

    const loadMyReviews = async () => {
      try {
        const reviewsRef = collection(db, "restaurant_reviews");
        const q = query(
          reviewsRef,
          where("dinerId", "==", currentUser.uid),
          orderBy("createdAt", "desc"),
          limit(5)
        );
        const snapshot = await getDocs(q);
        const reviews = [];
        snapshot.forEach((doc) => {
          reviews.push({
            id: doc.id,
            ...doc.data(),
          });
        });
        setMyReviews(reviews);
      } catch (error) {
        console.error("Error loading my reviews:", error);
        // If index error, try without orderBy
        try {
          const reviewsRef = collection(db, "restaurant_reviews");
          const q = query(
            reviewsRef,
            where("dinerId", "==", currentUser.uid),
            limit(5)
          );
          const snapshot = await getDocs(q);
          const reviews = [];
          snapshot.forEach((doc) => {
            reviews.push({
              id: doc.id,
              ...doc.data(),
            });
          });
          // Sort manually by createdAt
          reviews.sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
            return dateB - dateA;
          });
          setMyReviews(reviews.slice(0, 5));
        } catch (fallbackError) {
          console.error("Error loading my reviews (fallback):", fallbackError);
        }
      }
    };

    loadMyReviews();
  }, [currentUser]);

  // Load favorite reviewers
  useEffect(() => {
    if (!currentUser) return;

    const loadFavoriteReviewers = async () => {
      try {
        const favoritesRef = collection(
          db,
          "users",
          currentUser.uid,
          "favoriteReviewers"
        );
        const snapshot = await getDocs(favoritesRef);
        const reviewers = [];
        const ids = new Set();
        snapshot.forEach((doc) => {
          const data = doc.data();
          ids.add(data.reviewerId);
          reviewers.push({
            id: data.reviewerId,
            name: data.reviewerName,
            imageURL: data.reviewerImageURL || null,
          });
        });
        setFavoriteReviewers(reviewers);
        setFavoritedReviewerIds(ids);
      } catch (error) {
        console.error("Error loading favorite reviewers:", error);
      }
    };

    loadFavoriteReviewers();
  }, [currentUser]);

  // Get unique restaurants and cuisines from reviewer's reviews
  const reviewerRestaurants = useMemo(() => {
    const restaurantIds = new Set();
    allReviews.forEach((review) => {
      if (review.restaurantId) {
        restaurantIds.add(review.restaurantId);
      }
    });
    return restaurants.filter((r) => restaurantIds.has(r.id));
  }, [allReviews, restaurants]);

  const reviewerCuisines = useMemo(() => {
    const cuisines = new Set();
    reviewerRestaurants.forEach((restaurant) => {
      if (restaurant.cuisine) {
        cuisines.add(restaurant.cuisine);
      }
    });
    return Array.from(cuisines).sort();
  }, [reviewerRestaurants]);

  // Filter reviews based on search filters
  const filteredReviews = useMemo(() => {
    let filtered = [...allReviews];

    // Filter by restaurant
    if (searchFilters.restaurant) {
      filtered = filtered.filter(
        (review) => review.restaurantId === searchFilters.restaurant
      );
    }

    // Filter by cuisine
    if (searchFilters.cuisine) {
      const restaurantIds = reviewerRestaurants
        .filter((r) => r.cuisine === searchFilters.cuisine)
        .map((r) => r.id);
      filtered = filtered.filter((review) =>
        restaurantIds.includes(review.restaurantId)
      );
    }

    // Filter by radius
    if (searchFilters.radius !== "Any Radius" && userLocation) {
      const radiusMiles = parseInt(searchFilters.radius);
      filtered = filtered.filter((review) => {
        const restaurant = restaurants.find(
          (r) => r.id === review.restaurantId
        );
        if (!restaurant || !restaurant.location) return false;
        const distance = milesBetween(
          userLocation.lat,
          userLocation.lon,
          restaurant.location.latitude,
          restaurant.location.longitude
        );
        return distance <= radiusMiles;
      });
    }

    return filtered;
  }, [allReviews, searchFilters, userLocation, restaurants, reviewerRestaurants]);

  // Update main reviews when filters change
  useEffect(() => {
    // Only update if we have filtered reviews, or if no filters are active, use allReviews
    const hasActiveFilters = searchFilters.restaurant || searchFilters.cuisine || searchFilters.radius !== "Any Radius";
    if (hasActiveFilters && filteredReviews.length > 0) {
      setMainReviews(filteredReviews.slice(0, 5));
    } else if (!hasActiveFilters && allReviews.length > 0) {
      // No filters active, show all reviews
      setMainReviews(allReviews.slice(0, 5));
    }
  }, [filteredReviews, allReviews, searchFilters]);

  const toggleReviewExpansion = (reviewId) => {
    setExpandedReviews((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(reviewId)) {
        newSet.delete(reviewId);
      } else {
        newSet.add(reviewId);
      }
      return newSet;
    });
  };

  const loadMoreReviews = () => {
    setMainReviews(filteredReviews.slice(0, mainReviews.length + 5));
  };

  const handleToggleFavoriteReviewer = async (reviewerId, reviewerName, reviewerImageURL) => {
    if (!currentUser) return;

    const isFavorited = favoritedReviewerIds.has(reviewerId);

    try {
      if (isFavorited) {
        await removeFavoriteReviewer(currentUser.uid, reviewerId);
        setFavoritedReviewerIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(reviewerId);
          return newSet;
        });
        setFavoriteReviewers((prev) => prev.filter((r) => r.id !== reviewerId));
      } else {
        await addFavoriteReviewer(currentUser.uid, reviewerId);
        setFavoritedReviewerIds((prev) => {
          const newSet = new Set(prev);
          newSet.add(reviewerId);
          return newSet;
        });
        setFavoriteReviewers((prev) => [
          ...prev,
          {
            id: reviewerId,
            name: reviewerName,
            imageURL: reviewerImageURL || null,
          },
        ]);
      }
    } catch (error) {
      console.error("Error toggling favorite reviewer:", error);
      alert("Failed to update favorite reviewer. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="reviews-home-page">
        <div style={{ color: "white", textAlign: "center", padding: "40px" }}>
          Loading...
        </div>
      </div>
    );
  }

  if (!reviewer) {
    return (
      <div className="reviews-home-page">
        <div style={{ color: "white", textAlign: "center", padding: "40px" }}>
          <p style={{ fontSize: "20px", marginBottom: "20px" }}>Reviewer not found</p>
          <p style={{ marginTop: "20px", fontSize: "14px", color: "#888", marginBottom: "30px" }}>
            The reviewer profile may not exist yet. Click below to create reviewer profiles.
          </p>
          <button
            onClick={async () => {
              try {
                await createMockReviewerProfiles();
                alert("Reviewer profiles created! Please refresh the page.");
                window.location.reload();
              } catch (error) {
                console.error("Error creating reviewer profiles:", error);
                alert("Failed to create reviewer profiles. Check console for details.");
              }
            }}
            style={{
              padding: "12px 24px",
              backgroundColor: "#4da3ff",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "600",
              transition: "background 0.2s"
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = "#6bb3ff"}
            onMouseOut={(e) => e.target.style.backgroundColor = "#4da3ff"}
          >
            Create Reviewer Profiles
          </button>
          <Link 
            to="/reviews" 
            style={{
              display: "block",
              marginTop: "20px",
              color: "#4da3ff",
              textDecoration: "none"
            }}
          >
            ← Back to Reviews
          </Link>
        </div>
      </div>
    );
  }

  const reviewerName = reviewer.displayName || reviewer.name || reviewer.email || "Unknown Reviewer";
  // Get first name for search label
  const firstName = reviewerName.split(" ")[0] || reviewerName;

  return (
    <div className="reviews-home-page">
      <div className="reviews-header-row">
        <div style={{ width: "100px" }}></div>
        <h1 className="reviews-home-title">{reviewerName} Reviews</h1>
        <Link to="/reviews" className="back-link">
          ← Back
        </Link>
      </div>

      <div className="reviews-home-layout">
        {/* LEFT COLUMN */}
        <div className="reviews-left-column">
          {/* Post a Review Button */}
          {currentUser && (
            <Link to="/reviews/post" className="post-review-btn">
              Post a Review
            </Link>
          )}

          {/* Favorite Reviewers */}
          {currentUser && (
            <section className="reviews-side-section">
              <h2>Favorite Reviewers</h2>
              {favoriteReviewers.length > 0 ? (
                <div className="favorite-reviewers-list">
                  {favoriteReviewers.map((reviewer) => (
                    <div
                      key={reviewer.id}
                      className="favorite-reviewer-card"
                      onClick={() => navigate(`/reviews/reviewer/${reviewer.id}`)}
                    >
                      {reviewer.imageURL ? (
                        <img
                          src={reviewer.imageURL}
                          alt={reviewer.name}
                          className="reviewer-avatar"
                        />
                      ) : (
                        <div className="reviewer-avatar-placeholder">
                          {reviewer.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="reviewer-info">
                        <h3>
                          {reviewer.name}
                          <button
                            className="favorite-reviewer-heart-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFavoriteReviewer(
                                reviewer.id,
                                reviewer.name,
                                reviewer.imageURL
                              );
                            }}
                            title="Unfavorite this reviewer"
                          >
                            <span className="heart heart-on">♥</span>
                          </button>
                        </h3>
                        <button className="view-reviews-btn">View Reviews →</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No favorite reviewers yet</p>
              )}
            </section>
          )}
        </div>

        {/* CENTER COLUMN - Reviewer's Reviews */}
        <div className="reviews-center-column">
          {mainReviews.length === 0 ? (
            <div className="no-reviews-message">
              <p>No reviews found.</p>
            </div>
          ) : (
            <>
              {/* Featured Review (Latest) */}
              {mainReviews[0] && (
                <div className="featured-review-card">
                  <div className="featured-review-header">
                    <h2>
                      {mainReviews[0].restaurantName || "Restaurant"}
                    </h2>
                    <div className="featured-review-rating">
                      {"⭐".repeat(mainReviews[0].overallRating || 0)}
                    </div>
                  </div>
                  {mainReviews[0].overallComment && (
                    <p className="featured-review-comment">
                      {mainReviews[0].overallComment}
                    </p>
                  )}
                  <div className="featured-review-meta">
                    <span>Items: {mainReviews[0].itemCount || 0}</span>
                    {mainReviews[0].serverName && (
                      <span>Server: {mainReviews[0].serverName}</span>
                    )}
                  </div>
                  <Link
                    to={`/restaurant/${mainReviews[0].restaurantId}`}
                    className="view-restaurant-link"
                  >
                    View Restaurant →
                  </Link>
                </div>
              )}

              {/* Other Reviews */}
              {mainReviews.length > 1 && (
                <div className="reviews-feed-list">
                  {mainReviews.slice(1).map((review) => {
                    const isExpanded = expandedReviews.has(review.id);
                    const commentPreview = review.overallComment
                      ? review.overallComment.substring(0, 150)
                      : "";
                    const showExpand = review.overallComment && review.overallComment.length > 150;

                    return (
                      <div key={review.id} className="feed-review-card">
                        <div className="feed-review-header">
                          <h3>{review.restaurantName || "Restaurant"}</h3>
                          <div className="feed-review-rating">
                            {"⭐".repeat(review.overallRating || 0)}
                          </div>
                        </div>
                        {review.overallComment && (
                          <p className="feed-review-comment">
                            {isExpanded ? review.overallComment : commentPreview}
                            {showExpand && (
                              <button
                                className="expand-comment-btn"
                                onClick={() => toggleReviewExpansion(review.id)}
                              >
                                {isExpanded ? " Show Less" : "... Show More"}
                              </button>
                            )}
                          </p>
                        )}
                        <div className="feed-review-actions">
                          <ShareButton
                            type="review"
                            itemId={review.id}
                            restaurantName={review.restaurantName || "Restaurant"}
                            rating={review.overallRating || 0}
                            reviewText={review.overallComment || ""}
                            reviewerName={review.dinerName || "Anonymous"}
                          />
                        </div>
                        <div className="feed-review-meta">
                          <span>Items: {review.itemCount || 0}</span>
                          {review.serverName && <span>Server: {review.serverName}</span>}
                        </div>
                        <Link
                          to={`/restaurant/${review.restaurantId}`}
                          className="view-restaurant-link"
                        >
                          View Restaurant →
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Load More Button */}
              {filteredReviews.length > mainReviews.length && (
                <button className="load-more-btn" onClick={loadMoreReviews}>
                  Load More Reviews
                </button>
              )}
            </>
          )}
        </div>

        {/* RIGHT COLUMN - Search */}
        <div className="reviews-right-column">
          <section className="reviews-search-section">
            <h2>Search {firstName}'s Reviews</h2>

            {/* Search by Restaurant */}
            <div className="search-group">
              <label>By Restaurant</label>
              <select
                value={searchFilters.restaurant}
                onChange={(e) =>
                  setSearchFilters({ ...searchFilters, restaurant: e.target.value })
                }
                className="search-select"
              >
                <option value="">All Restaurants</option>
                {reviewerRestaurants.map((restaurant) => (
                  <option key={restaurant.id} value={restaurant.id}>
                    {restaurant.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Search by Cuisine */}
            <div className="search-group">
              <label>By Cuisine</label>
              <select
                value={searchFilters.cuisine}
                onChange={(e) =>
                  setSearchFilters({ ...searchFilters, cuisine: e.target.value })
                }
                className="search-select"
              >
                <option value="">All Cuisines</option>
                {reviewerCuisines.map((cuisine) => (
                  <option key={cuisine} value={cuisine}>
                    {cuisine}
                  </option>
                ))}
              </select>
            </div>

            {/* Search by Radius */}
            <div className="search-group">
              <label>By Radius</label>
              <select
                value={searchFilters.radius}
                onChange={(e) =>
                  setSearchFilters({ ...searchFilters, radius: e.target.value })
                }
                className="search-select"
              >
                {radiusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

