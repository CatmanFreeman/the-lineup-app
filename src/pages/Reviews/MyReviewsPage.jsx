// src/pages/Reviews/MyReviewsPage.jsx

import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import ShareButton from "../../components/ShareButton/ShareButton";
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

const radiusOptions = ["Any Radius", "5 miles", "10 miles", "15 miles", "25 miles"];

export default function MyReviewsPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [expandedReviews, setExpandedReviews] = useState(new Set());

  // Center Column: My Reviews
  const [allReviews, setAllReviews] = useState([]);
  const [mainReviews, setMainReviews] = useState([]);

  // Right Column: Search
  const [restaurants, setRestaurants] = useState([]);
  const [searchFilters, setSearchFilters] = useState({
    restaurant: "",
    cuisine: "",
    radius: "Any Radius",
  });

  // Get user location
  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn("Geolocation not available");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => {
        console.warn("Error getting location:", err);
      }
    );
  }, []);

  // Load restaurants
  useEffect(() => {
    async function loadRestaurants() {
      try {
        const restaurantsRef = collection(db, "restaurants");
        const snap = await getDocs(restaurantsRef);
        const restaurantsList = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || d.id,
          cuisine: d.data().cuisine || [],
          lat: d.data().lat,
          lng: d.data().lng,
          ...d.data(),
        }));
        setRestaurants(restaurantsList);
      } catch (error) {
        console.error("Error loading restaurants:", error);
      }
    }
    loadRestaurants();
  }, []);

  // Load my reviews
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const loadReviews = async () => {
      setLoading(true);
      try {
        const reviewsRef = collection(db, "restaurant_reviews");
        const q = query(
          reviewsRef,
          where("dinerId", "==", currentUser.uid),
          orderBy("createdAt", "desc"),
          limit(100)
        );
        const snapshot = await getDocs(q);
        const reviews = [];
        snapshot.forEach((doc) => {
          reviews.push({
            id: doc.id,
            ...doc.data(),
          });
        });
        console.log(`Loaded ${reviews.length} of my reviews`, reviews);
        setAllReviews(reviews);
        if (reviews.length > 0) {
          setMainReviews(reviews.slice(0, 5));
        }
      } catch (error) {
        console.error("Error loading my reviews:", error);
        // If index error, try without orderBy
        try {
          const reviewsRef = collection(db, "restaurant_reviews");
          const q = query(
            reviewsRef,
            where("dinerId", "==", currentUser.uid),
            limit(100)
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
          console.log(`Loaded ${reviews.length} of my reviews (fallback)`, reviews);
          setAllReviews(reviews);
          if (reviews.length > 0) {
            setMainReviews(reviews.slice(0, 5));
          }
        } catch (fallbackError) {
          console.error("Error loading my reviews (fallback):", fallbackError);
        }
      } finally {
        setLoading(false);
      }
    };

    loadReviews();
  }, [currentUser]);

  // Get unique restaurants and cuisines from my reviews
  const myRestaurants = useMemo(() => {
    const restaurantIds = new Set();
    allReviews.forEach((review) => {
      if (review.restaurantId) {
        restaurantIds.add(review.restaurantId);
      }
    });
    return restaurants.filter((r) => restaurantIds.has(r.id));
  }, [allReviews, restaurants]);

  const myCuisines = useMemo(() => {
    const cuisines = new Set();
    myRestaurants.forEach((restaurant) => {
      if (restaurant.cuisine) {
        const cuisineArray = Array.isArray(restaurant.cuisine)
          ? restaurant.cuisine
          : [restaurant.cuisine];
        cuisineArray.forEach((c) => cuisines.add(c));
      }
    });
    return Array.from(cuisines).sort();
  }, [myRestaurants]);

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
      const restaurantIds = myRestaurants
        .filter((r) => {
          const cuisineArray = Array.isArray(r.cuisine)
            ? r.cuisine
            : r.cuisine
            ? [r.cuisine]
            : [];
          return cuisineArray.includes(searchFilters.cuisine);
        })
        .map((r) => r.id);
      filtered = filtered.filter((review) =>
        restaurantIds.includes(review.restaurantId)
      );
    }

    // Filter by radius
    if (searchFilters.radius !== "Any Radius" && userLocation) {
      const radiusMiles = parseInt(searchFilters.radius) || 25;
      filtered = filtered.filter((review) => {
        const restaurant = restaurants.find(
          (r) => r.id === review.restaurantId
        );
        if (!restaurant || !restaurant.lat || !restaurant.lng) return true; // Include if no location data
        const distance = milesBetween(
          userLocation.lat,
          userLocation.lng,
          restaurant.lat,
          restaurant.lng
        );
        return distance <= radiusMiles;
      });
    }

    return filtered;
  }, [allReviews, searchFilters, userLocation, restaurants, myRestaurants]);

  // Update main reviews when filters change
  useEffect(() => {
    const hasActiveFilters = searchFilters.restaurant || searchFilters.cuisine || searchFilters.radius !== "Any Radius";
    if (hasActiveFilters && filteredReviews.length > 0) {
      setMainReviews(filteredReviews.slice(0, 5));
    } else if (!hasActiveFilters && allReviews.length > 0) {
      setMainReviews(allReviews.slice(0, 5));
    }
  }, [filteredReviews, allReviews, searchFilters]);

  const toggleReviewExpansion = (reviewId) => {
    setExpandedReviews((prev) => {
      const next = new Set(prev);
      if (next.has(reviewId)) {
        next.delete(reviewId);
      } else {
        next.add(reviewId);
      }
      return next;
    });
  };

  const loadMoreReviews = () => {
    const currentCount = mainReviews.length;
    const nextReviews = allReviews.slice(currentCount, currentCount + 5);
    setMainReviews([...mainReviews, ...nextReviews]);
  };

  if (!currentUser) {
    return (
      <div className="reviews-home-page">
        <div className="reviews-header-row">
          <h1 className="reviews-home-title">My Reviews</h1>
          <Link to="/reviews" className="back-link">← Back to Reviews</Link>
        </div>
        <div style={{ textAlign: "center", padding: "40px", color: "#ffffff" }}>
          <p>Please log in to view your reviews.</p>
          <Link to="/login" style={{ color: "#4da3ff" }}>Log In</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="reviews-home-page">
        <div className="reviews-header-row">
          <h1 className="reviews-home-title">My Reviews</h1>
          <Link to="/reviews" className="back-link">← Back to Reviews</Link>
        </div>
        <div style={{ textAlign: "center", padding: "40px", color: "#ffffff" }}>
          <p>Loading your reviews...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="reviews-home-page">
      <div className="reviews-header-row">
        <div style={{ width: "100px" }}></div>
        <h1 className="reviews-home-title">My Reviews</h1>
        <Link to="/reviews" className="back-link">← Back to Reviews</Link>
      </div>

      <div className="reviews-home-layout">
        {/* LEFT COLUMN - Empty for now, could add "Post a Review" button */}
        <div className="reviews-left-column">
          <Link to="/reviews/post" className="post-review-btn">
            Post a Review
          </Link>
        </div>

        {/* CENTER COLUMN - My Reviews */}
        <div className="reviews-center-column">
          {mainReviews.length === 0 ? (
            <div className="no-reviews-message">
              <p>No reviews found.</p>
              <Link to="/reviews/post" className="post-review-btn" style={{ marginTop: "20px", display: "inline-block" }}>
                Post Your First Review
              </Link>
            </div>
          ) : (
            <>
              {/* Featured Review (Latest) */}
              {mainReviews[0] && (
                <div className="featured-review-card">
                  <div className="featured-review-header">
                    <div className="featured-review-restaurant">
                      <h3>{mainReviews[0].restaurantName || "Restaurant"}</h3>
                      <span className="featured-review-date">
                        {mainReviews[0].createdAt?.toDate
                          ? mainReviews[0].createdAt.toDate().toLocaleDateString()
                          : "Recent"}
                      </span>
                    </div>
                    <div className="featured-review-rating">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={
                            star <= (mainReviews[0].overallRating || 0)
                              ? "star-filled"
                              : "star-empty"
                          }
                        >
                          ★
                        </span>
                      ))}
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
                </div>
              )}

              {/* Other Reviews (Smaller, expandable) */}
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
                          <div className="feed-review-restaurant">
                            <h4>{review.restaurantName || "Restaurant"}</h4>
                            <span className="feed-review-date">
                              {review.createdAt?.toDate
                                ? review.createdAt.toDate().toLocaleDateString()
                                : "Recent"}
                            </span>
                          </div>
                          <div className="feed-review-rating">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span
                                key={star}
                                className={
                                  star <= (review.overallRating || 0)
                                    ? "star-filled"
                                    : "star-empty"
                                }
                              >
                                ★
                              </span>
                            ))}
                          </div>
                        </div>
                        {review.overallComment && (
                          <p
                            className={`review-comment ${isExpanded ? "expanded" : ""}`}
                          >
                            {isExpanded
                              ? review.overallComment
                              : commentPreview}
                            {showExpand && (
                              <button
                                className="show-more-btn"
                                onClick={() => toggleReviewExpansion(review.id)}
                              >
                                {isExpanded ? "Show Less" : "Show More"}
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
                            reviewerName={review.dinerName || "You"}
                          />
                        </div>
                        <div className="feed-review-meta">
                          <span>Items: {review.itemCount || 0}</span>
                          {review.serverName && (
                            <span>Server: {review.serverName}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Load More Button */}
              {allReviews.length > mainReviews.length && (
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
            <h2>Search My Reviews</h2>

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
                {myRestaurants.map((restaurant) => (
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
                {myCuisines.map((cuisine) => (
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
