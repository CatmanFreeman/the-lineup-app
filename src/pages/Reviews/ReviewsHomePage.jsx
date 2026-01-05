// src/pages/Reviews/ReviewsHomePage.jsx

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
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
import { generateMockReviewData, createMockReviews, createMockReviewerProfiles } from "../../utils/mockReviewService";
import { addFavoriteReviewer, removeFavoriteReviewer } from "../../utils/favoriteReviewerService";
import "./ReviewsHomePage.css";

// All cuisine options
const ALL_CUISINES = [
  "All Cuisines",
  "American",
  "Barbecue",
  "Bistro",
  "Breakfast",
  "Brunch",
  "Burgers",
  "Café",
  "Chinese",
  "Desserts",
  "Indian",
  "Italian",
  "Mediterranean",
  "Mexican",
  "Middle Eastern",
  "Pizza",
  "Sandwiches",
  "Seafood",
  "Soup",
  "Salads",
  "Southern",
  "Soul Food",
  "Steakhouse",
  "Sushi",
  "Tapas",
  "Thai",
  "Vegan",
  "Vegetarian",
  "Venezuelan",
  "Vietnamese",
];

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

export default function ReviewsHomePage() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [expandedReviews, setExpandedReviews] = useState(new Set());

  // Left Column: Past Reviews & Favorite Reviewers
  const [myReviews, setMyReviews] = useState([]);
  const [favoriteReviewers, setFavoriteReviewers] = useState([]);
  const [selectedReviewer, setSelectedReviewer] = useState(null);
  const [reviewerReviews, setReviewerReviews] = useState([]);
  const [favoritedReviewerIds, setFavoritedReviewerIds] = useState(new Set());

  // Center Column: Main Review Feed
  const [allReviews, setAllReviews] = useState([]);
  const [mainReviews, setMainReviews] = useState([]);

  // Right Column: Search
  const [restaurants, setRestaurants] = useState([]);
  const [valetCompanies, setValetCompanies] = useState([]);
  const [restaurantSearchInput, setRestaurantSearchInput] = useState("");
  const [restaurantSuggestions, setRestaurantSuggestions] = useState([]);
  const [showRestaurantSuggestions, setShowRestaurantSuggestions] = useState(false);
  const [searchFilters, setSearchFilters] = useState({
    restaurant: "",
    valetCompany: "",
    cuisine: "",
    reviewer: "",
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

  // Load restaurants and valet companies
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
          type: "restaurant",
          ...d.data(),
        }));
        setRestaurants(restaurantsList);
      } catch (error) {
        console.error("Error loading restaurants:", error);
      }
    }

    async function loadValetCompanies() {
      try {
        const { getAllValetCompaniesWithLocations } = await import("../../utils/valetCompanyLocationService");
        const companies = await getAllValetCompaniesWithLocations();
        const companiesList = companies.map((company) => ({
          id: company.id,
          name: company.name,
          type: "valet",
          averageRating: company.averageRating || null,
          reviewCount: company.reviewCount || 0,
          locations: company.locations,
        }));
        setValetCompanies(companiesList);
      } catch (error) {
        console.error("Error loading valet companies:", error);
      }
    }

    loadRestaurants();
    loadValetCompanies();
  }, []);

  // Filter restaurant/valet suggestions as user types
  useEffect(() => {
    if (!restaurantSearchInput.trim()) {
      setRestaurantSuggestions([]);
      setShowRestaurantSuggestions(false);
      return;
    }

    const searchTerm = restaurantSearchInput.toLowerCase();
    const restaurantMatches = restaurants
      .filter((r) => r.name.toLowerCase().includes(searchTerm))
      .map((r) => ({ ...r, displayType: "Restaurant" }));
    
    const valetMatches = valetCompanies
      .filter((v) => v.name.toLowerCase().includes(searchTerm))
      .map((v) => ({ ...v, displayType: "Valet Company" }));
    
    const filtered = [...restaurantMatches, ...valetMatches]
      .slice(0, 10); // Limit to 10 suggestions
    
    setRestaurantSuggestions(filtered);
    setShowRestaurantSuggestions(filtered.length > 0);
  }, [restaurantSearchInput, restaurants, valetCompanies]);

  // Load my past reviews
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    async function loadMyReviews() {
      try {
        const reviewsRef = collection(db, "restaurant_reviews");
        const q = query(
          reviewsRef,
          where("dinerId", "==", currentUser.uid),
          orderBy("createdAt", "desc"),
          limit(10)
        );

        const snapshot = await getDocs(q);
        const reviewsList = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        console.log(`Loaded ${reviewsList.length} of my reviews`);
        setMyReviews(reviewsList);
      } catch (error) {
        console.error("Error loading my reviews:", error);
        // If index error, try without orderBy
        try {
          const reviewsRef = collection(db, "restaurant_reviews");
          const q = query(
            reviewsRef,
            where("dinerId", "==", currentUser.uid),
            limit(10)
          );
          const snapshot = await getDocs(q);
          const reviewsList = [];
          snapshot.forEach((doc) => {
            reviewsList.push({
              id: doc.id,
              ...doc.data(),
            });
          });
          // Sort manually by createdAt
          reviewsList.sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
            return dateB - dateA;
          });
          console.log(`Loaded ${reviewsList.length} of my reviews (fallback)`);
          setMyReviews(reviewsList);
        } catch (fallbackError) {
          console.error("Error loading my reviews (fallback):", fallbackError);
        }
      }
    }

    loadMyReviews();
  }, [currentUser]);

  // Load favorite reviewers
  useEffect(() => {
    if (!currentUser) return;

    async function loadFavorites() {
      try {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return;

        const userData = userSnap.data();
        const favoriteIds = userData.favoriteReviewers || [];

        if (favoriteIds.length === 0) {
          setFavoriteReviewers([]);
          return;
        }

        const reviewersList = [];
        for (const reviewerId of favoriteIds) {
          try {
            const reviewerRef = doc(db, "users", reviewerId);
            const reviewerSnap = await getDoc(reviewerRef);
            if (reviewerSnap.exists()) {
              const reviewerData = reviewerSnap.data();
              reviewersList.push({
                id: reviewerId,
                name: reviewerData.fullName || reviewerData.displayName || reviewerData.name || "Anonymous",
                imageURL: reviewerData.imageURL || null,
                ...reviewerData,
              });
            }
          } catch (err) {
            console.error(`Error loading reviewer ${reviewerId}:`, err);
          }
        }
        setFavoriteReviewers(reviewersList);
        // Also track favorited IDs for quick lookup
        setFavoritedReviewerIds(new Set(favoriteIds));
      } catch (error) {
        console.error("Error loading favorite reviewers:", error);
      }
    }

    loadFavorites();
  }, [currentUser]);

  // Load reviewer's reviews when clicked
  const loadReviewerReviews = useCallback(async (reviewerId) => {
    try {
      const reviewsRef = collection(db, "restaurant_reviews");
      const q = query(
        reviewsRef,
        where("dinerId", "==", reviewerId),
        orderBy("createdAt", "desc"),
        limit(5)
      );

      const snapshot = await getDocs(q);
      const reviewsList = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setReviewerReviews(reviewsList);
    } catch (error) {
      console.error("Error loading reviewer reviews:", error);
      setReviewerReviews([]);
    }
  }, []);

  // Load all reviews and filter by distance and search filters
  useEffect(() => {
    async function loadMainReviews() {
      setLoading(true);
      try {
        const reviewsRef = collection(db, "restaurant_reviews");
        let q = query(reviewsRef, orderBy("createdAt", "desc"), limit(200)); // Increased limit to ensure user's reviews are included

        // Apply restaurant filter if selected
        if (searchFilters.restaurant) {
          q = query(
            reviewsRef,
            where("restaurantId", "==", searchFilters.restaurant),
            orderBy("createdAt", "desc"),
            limit(200)
          );
        }

        const snapshot = await getDocs(q);
        let reviewsList = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        console.log(`Loaded ${reviewsList.length} total reviews from Firestore`);
        console.log("Sample reviews:", reviewsList.slice(0, 3).map(r => ({ id: r.id, restaurantId: r.restaurantId, dinerId: r.dinerId, createdAt: r.createdAt })));

        // Filter by distance if user location is available and no restaurant filter
        // ALWAYS include the current user's own reviews regardless of distance
        if (userLocation && !searchFilters.restaurant && searchFilters.radius !== "Any Radius") {
          const radiusMiles = parseInt(searchFilters.radius) || 25; // Extract number from "25 miles"
          const beforeFilter = reviewsList.length;
          reviewsList = reviewsList.filter((review) => {
            // Always include user's own reviews
            if (currentUser && review.dinerId === currentUser.uid) {
              return true;
            }
            
            const restaurant = restaurants.find((r) => r.id === review.restaurantId);
            // If restaurant not found or no location data, include the review anyway (don't filter out)
            if (!restaurant) {
              console.warn(`Restaurant not found for review ${review.id}: ${review.restaurantId}`);
              return true; // Include reviews even if restaurant not found
            }
            if (!restaurant.lat || !restaurant.lng) {
              console.warn(`Restaurant ${restaurant.id} (${restaurant.name}) missing location data`);
              return true; // Include reviews even if location data missing
            }
            
            const distance = milesBetween(
              userLocation.lat,
              userLocation.lng,
              restaurant.lat,
              restaurant.lng
            );
            return distance <= radiusMiles;
          });
          console.log(`Distance filter (${radiusMiles} miles): ${beforeFilter} -> ${reviewsList.length} reviews`);
        } else if (userLocation && !searchFilters.restaurant && searchFilters.radius === "Any Radius") {
          // Default to 25 miles if "Any Radius" is selected
          const beforeFilter = reviewsList.length;
          reviewsList = reviewsList.filter((review) => {
            // Always include user's own reviews
            if (currentUser && review.dinerId === currentUser.uid) {
              return true;
            }
            
            const restaurant = restaurants.find((r) => r.id === review.restaurantId);
            // If restaurant not found or no location data, include the review anyway (don't filter out)
            if (!restaurant) {
              console.warn(`Restaurant not found for review ${review.id}: ${review.restaurantId}`);
              return true; // Include reviews even if restaurant not found
            }
            if (!restaurant.lat || !restaurant.lng) {
              console.warn(`Restaurant ${restaurant.id} (${restaurant.name}) missing location data`);
              return true; // Include reviews even if location data missing
            }
            
            const distance = milesBetween(
              userLocation.lat,
              userLocation.lng,
              restaurant.lat,
              restaurant.lng
            );
            return distance <= 25;
          });
          console.log(`Distance filter (25 miles default): ${beforeFilter} -> ${reviewsList.length} reviews`);
        } else if (!userLocation) {
          console.log("No user location available, showing all reviews");
        }

        // Filter by cuisine if selected
        if (searchFilters.cuisine && searchFilters.cuisine !== "All Cuisines") {
          reviewsList = reviewsList.filter((review) => {
            const restaurant = restaurants.find((r) => r.id === review.restaurantId);
            if (!restaurant) return false;
            const restaurantCuisines = Array.isArray(restaurant.cuisine)
              ? restaurant.cuisine
              : restaurant.cuisine
              ? [restaurant.cuisine]
              : [];
            return restaurantCuisines.includes(searchFilters.cuisine);
          });
        }

        // Filter by reviewer if selected
        if (searchFilters.reviewer) {
          reviewsList = reviewsList.filter(
            (review) => review.dinerId === searchFilters.reviewer
          );
        }

        // If no reviews found (or very few), generate mock reviews for demo
        // Always show at least 5 reviews for demo purposes
        if (reviewsList.length < 5 && restaurants.length > 0) {
          console.log("Generating mock reviews for demo...");
          const mockReviews = [];
          // Generate 6-8 mock reviews from different restaurants
          const restaurantsToUse = restaurants.slice(0, Math.min(4, restaurants.length));
          for (const restaurant of restaurantsToUse) {
            // Generate 2 reviews per restaurant
            for (let i = 0; i < 2; i++) {
              const mockReview = generateMockReviewData(restaurant.id, restaurant.name);
              // Only add if we don't already have enough reviews
              if (reviewsList.length + mockReviews.length < 8) {
                mockReviews.push(mockReview);
              }
            }
          }
          // Sort by date (newest first)
          mockReviews.sort((a, b) => {
            const dateA = a.createdAt.toDate ? a.createdAt.toDate().getTime() : 0;
            const dateB = b.createdAt.toDate ? b.createdAt.toDate().getTime() : 0;
            return dateB - dateA;
          });
          // Combine real reviews with mock reviews, ensuring we have at least 5
          reviewsList = [...reviewsList, ...mockReviews].slice(0, 20);
          // Re-sort combined list
          reviewsList.sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0);
            return dateB - dateA;
          });
        }

        // Store all reviews and set main reviews (limit to 5 for feed)
        setAllReviews(reviewsList);
        setMainReviews(reviewsList.slice(0, 5));
      } catch (error) {
        console.error("Error loading main reviews:", error);
      } finally {
        setLoading(false);
      }
    }

    loadMainReviews();
  }, [searchFilters, restaurants, userLocation]);


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
    const currentCount = mainReviews.length;
    const nextReviews = allReviews.slice(currentCount, currentCount + 5);
    setMainReviews((prev) => [...prev, ...nextReviews]);
  };

  const handleReviewerClick = (reviewer) => {
    setSelectedReviewer(reviewer);
    loadReviewerReviews(reviewer.id);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "Recently";
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleDateString();
    }
    return "Recently";
  };

  const getRestaurantName = (restaurantId) => {
    const restaurant = restaurants.find((r) => r.id === restaurantId);
    return restaurant?.name || "Restaurant";
  };

  // Handle favorite reviewer toggle
  const handleToggleFavoriteReviewer = async (reviewerId, reviewerName, reviewerImageURL) => {
    if (!currentUser) {
      alert("Please log in to favorite reviewers");
      return;
    }

    if (currentUser.uid === reviewerId) {
      return; // Can't favorite yourself
    }

    const isFavorited = favoritedReviewerIds.has(reviewerId);

    try {
      if (isFavorited) {
        // Remove from favorites
        await removeFavoriteReviewer(currentUser.uid, reviewerId);
        setFavoritedReviewerIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(reviewerId);
          return newSet;
        });
        setFavoriteReviewers((prev) => prev.filter((r) => r.id !== reviewerId));
      } else {
        // Add to favorites
        await addFavoriteReviewer(currentUser.uid, reviewerId);
        setFavoritedReviewerIds((prev) => {
          const newSet = new Set(prev);
          newSet.add(reviewerId);
          return newSet;
        });
        // Add to favoriteReviewers list
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

  return (
    <div className="reviews-home-page">
      <div className="reviews-header-row">
        <h1 className="reviews-home-title">Reviews</h1>
        <Link to="/" className="back-link">
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

          {/* My Past Reviews */}
          {currentUser && (
            <section className="reviews-side-section">
              <h2>My Reviews</h2>
              {myReviews.length > 0 ? (
                <>
                  <div className="reviews-side-list">
                    {myReviews.slice(0, 3).map((review) => (
                      <div key={review.id} className="review-side-card">
                        <div className="review-side-header">
                          <h3>{getRestaurantName(review.restaurantId)}</h3>
                          <div className="review-side-rating">
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
                        <p className="review-side-date">{formatDate(review.createdAt)}</p>
                        {review.overallComment && (
                          <p className="review-side-comment">{review.overallComment.substring(0, 100)}...</p>
                        )}
                      </div>
                    ))}
                  </div>
                  <Link to="/reviews/my" style={{ display: "block", marginTop: "15px", textAlign: "center", color: "#4da3ff", textDecoration: "none", fontWeight: 600 }}>
                    View All My Reviews →
                  </Link>
                </>
              ) : (
                <p className="empty-text">No reviews yet</p>
              )}
            </section>
          )}

          {/* Favorite Reviewers */}
          {currentUser && (
            <section className="reviews-side-section">
              <h2>Favorite Reviewers</h2>
              {favoriteReviewers.length > 0 ? (
                <>
                  <div className="favorite-reviewers-list">
                    {favoriteReviewers.slice(0, 5).map((reviewer) => (
                      <div
                        key={reviewer.id}
                        className="favorite-reviewer-card"
                        onClick={() => handleReviewerClick(reviewer)}
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
                          <Link 
                            to={`/reviews/reviewer/${reviewer.id}`}
                            className="view-reviews-btn"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View Reviews →
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Link 
                    to="/favorites?tab=diners" 
                    className="all-favorites-link"
                  >
                    All Favorites →
                  </Link>
                </>
              ) : (
                <p className="empty-text">No favorite reviewers yet</p>
              )}

              {/* Selected Reviewer's Reviews */}
              {selectedReviewer && reviewerReviews.length > 0 && (
                <div className="reviewer-reviews-panel">
                  <div className="reviewer-reviews-header">
                    <h3>{selectedReviewer.name}'s Reviews</h3>
                    <button
                      className="close-panel-btn"
                      onClick={() => setSelectedReviewer(null)}
                    >
                      ×
                    </button>
                  </div>
                  <div className="reviewer-reviews-list">
                    {reviewerReviews.map((review) => (
                      <div key={review.id} className="reviewer-review-item">
                        <h4>{getRestaurantName(review.restaurantId)}</h4>
                        <div className="reviewer-review-rating">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <span
                              key={star}
                              className={
                                star <= review.overallRating ? "star-filled" : "star-empty"
                              }
                            >
                              ★
                            </span>
                          ))}
                        </div>
                        <p className="reviewer-review-date">{formatDate(review.createdAt)}</p>
                        {review.overallComment && (
                          <p className="reviewer-review-comment">
                            {review.overallComment.substring(0, 80)}...
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        {/* CENTER COLUMN - Main Review Feed */}
        <div className="reviews-center-column">
          {loading ? (
            <div className="loading">Loading reviews...</div>
          ) : mainReviews.length === 0 ? (
            <div className="empty-state">
              <h2>No Reviews Found</h2>
              <p>Try adjusting your search filters.</p>
            </div>
          ) : (
            <div className="main-reviews-feed">
              {/* Featured Review (First one - larger) */}
              {mainReviews.length > 0 && (
                <div className="featured-review-card">
                  <div className="featured-review-header">
                    <div className="featured-review-restaurant">
                      <h2>{getRestaurantName(mainReviews[0].restaurantId)}</h2>
                      <span className="featured-review-date">
                        {formatDate(mainReviews[0].createdAt)}
                      </span>
                    </div>
                    <div className="featured-review-rating">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={
                            star <= mainReviews[0].overallRating
                              ? "star-filled"
                              : "star-empty"
                          }
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                  {mainReviews[0].dinerName && (
                    <p className="featured-review-author">
                      By:{" "}
                      {mainReviews[0].dinerId && mainReviews[0].dinerId !== currentUser?.uid ? (
                        <Link
                          to={`/reviews/reviewer/${mainReviews[0].dinerId}`}
                          className="reviewer-name-link"
                        >
                          {mainReviews[0].dinerName}
                        </Link>
                      ) : (
                        <span>{mainReviews[0].dinerName}</span>
                      )}
                      {currentUser &&
                        mainReviews[0].dinerId &&
                        mainReviews[0].dinerId !== currentUser.uid && (
                          <button
                            className="favorite-reviewer-heart-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFavoriteReviewer(
                                mainReviews[0].dinerId,
                                mainReviews[0].dinerName,
                                null
                              );
                            }}
                            title={
                              favoritedReviewerIds.has(mainReviews[0].dinerId)
                                ? "Unfavorite this reviewer"
                                : "Favorite this reviewer"
                            }
                          >
                            <span
                              className={
                                favoritedReviewerIds.has(mainReviews[0].dinerId)
                                  ? "heart heart-on"
                                  : "heart"
                              }
                            >
                              ♥
                            </span>
                          </button>
                        )}
                    </p>
                  )}
                  {mainReviews[0].overallComment && (
                    <p className="featured-review-comment">
                      {mainReviews[0].overallComment}
                    </p>
                  )}
                  <div className="featured-review-actions">
                    <ShareButton
                      type="review"
                      itemId={mainReviews[0].id}
                      restaurantName={getRestaurantName(mainReviews[0].restaurantId)}
                      rating={mainReviews[0].overallRating}
                      reviewText={mainReviews[0].overallComment || ""}
                      reviewerName={mainReviews[0].dinerName || "Anonymous"}
                    />
                  </div>
                  <div className="featured-review-meta">
                    <span>Items: {mainReviews[0].itemCount || 0}</span>
                    {mainReviews[0].serverName && (
                      <span>Server: {mainReviews[0].serverName}</span>
                    )}
                  </div>
                  <Link
                    to={`/reviews/post`}
                    className="view-restaurant-link"
                  >
                    View Restaurant →
                  </Link>
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
                            <h3>{getRestaurantName(review.restaurantId)}</h3>
                            <span className="feed-review-date">
                              {formatDate(review.createdAt)}
                            </span>
                          </div>
                          <div className="feed-review-rating">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span
                                key={star}
                                className={
                                  star <= review.overallRating ? "star-filled" : "star-empty"
                                }
                              >
                                ★
                              </span>
                            ))}
                          </div>
                        </div>
                        {review.dinerName && (
                          <p className="feed-review-author">
                            By:{" "}
                            {review.dinerId && review.dinerId !== currentUser?.uid ? (
                              <Link
                                to={`/reviews/reviewer/${review.dinerId}`}
                                className="reviewer-name-link"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {review.dinerName}
                              </Link>
                            ) : (
                              <span>{review.dinerName}</span>
                            )}
                            {currentUser &&
                              review.dinerId &&
                              review.dinerId !== currentUser.uid && (
                                <button
                                  className="favorite-reviewer-heart-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleFavoriteReviewer(
                                      review.dinerId,
                                      review.dinerName,
                                      null
                                    );
                                  }}
                                  title={
                                    favoritedReviewerIds.has(review.dinerId)
                                      ? "Unfavorite this reviewer"
                                      : "Favorite this reviewer"
                                  }
                                >
                                  <span
                                    className={
                                      favoritedReviewerIds.has(review.dinerId)
                                        ? "heart heart-on"
                                        : "heart"
                                    }
                                  >
                                    ♥
                                  </span>
                                </button>
                              )}
                          </p>
                        )}
                        {review.overallComment && (
                          <p className="feed-review-comment">
                            {isExpanded
                              ? review.overallComment
                              : commentPreview}
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
                            restaurantName={getRestaurantName(review.restaurantId)}
                            rating={review.overallRating}
                            reviewText={review.overallComment || ""}
                            reviewerName={review.dinerName || "Anonymous"}
                          />
                        </div>
                        <div className="feed-review-meta">
                          <span>Items: {review.itemCount || 0}</span>
                          {review.serverName && <span>Server: {review.serverName}</span>}
                        </div>
                        <Link
                          to={`/reviews/post`}
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
              {allReviews.length > mainReviews.length && (
                <button className="load-more-btn" onClick={loadMoreReviews}>
                  Load More Reviews
                </button>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN - Search */}
        <div className="reviews-right-column">
          <section className="reviews-search-section">
            <h2>Search Reviews</h2>

            {/* Generate Mock Reviews Button (for demo) */}
            {mainReviews.length === 0 && restaurants.length > 0 && (
              <div className="mock-reviews-section">
                <p className="mock-reviews-hint">No reviews found. Generate demo reviews?</p>
                <button
                  className="generate-mock-btn"
                  onClick={async () => {
                    try {
                      setLoading(true);
                      // First create reviewer profiles
                      await createMockReviewerProfiles();
                      const restaurantsToUse = restaurants.slice(0, Math.min(3, restaurants.length));
                      for (const restaurant of restaurantsToUse) {
                        await createMockReviews(restaurant.id, restaurant.name, 3);
                      }
                      // Reload reviews
                      window.location.reload();
                    } catch (error) {
                      console.error("Error generating mock reviews:", error);
                      alert("Failed to generate mock reviews. Check console for details.");
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  Generate Demo Reviews
                </button>
              </div>
            )}

            {/* Search by Restaurant or Valet Company */}
            <div className="search-group">
              <label>By Restaurant or Valet Company</label>
              <div className="restaurant-autocomplete-wrapper">
                <input
                  type="text"
                  value={restaurantSearchInput}
                  onChange={(e) => {
                    setRestaurantSearchInput(e.target.value);
                    if (!e.target.value) {
                      setSearchFilters((prev) => ({ ...prev, restaurant: "", valetCompany: "" }));
                    }
                  }}
                  onFocus={() => {
                    if (restaurantSuggestions.length > 0) {
                      setShowRestaurantSuggestions(true);
                    }
                  }}
                  onBlur={() => {
                    // Delay to allow click on suggestion
                    setTimeout(() => setShowRestaurantSuggestions(false), 200);
                  }}
                  placeholder="Start typing restaurant name..."
                  className="restaurant-search-input"
                />
                {showRestaurantSuggestions && restaurantSuggestions.length > 0 && (
                  <div className="restaurant-suggestions-dropdown">
                    {restaurantSuggestions.map((item) => (
                      <div
                        key={item.id}
                        className="restaurant-suggestion-item"
                        onClick={() => {
                          setRestaurantSearchInput(item.name);
                          if (item.type === "restaurant") {
                            setSearchFilters((prev) => ({ ...prev, restaurant: item.id, valetCompany: "" }));
                          } else {
                            setSearchFilters((prev) => ({ ...prev, valetCompany: item.id, restaurant: "" }));
                          }
                          setShowRestaurantSuggestions(false);
                        }}
                      >
                        <span>{item.name}</span>
                        <span className="suggestion-type-badge" style={{
                          marginLeft: "8px",
                          fontSize: "11px",
                          background: item.type === "valet" ? "rgba(74, 158, 255, 0.2)" : "rgba(255, 255, 255, 0.1)",
                          color: item.type === "valet" ? "#4a9eff" : "rgba(255, 255, 255, 0.7)",
                          padding: "2px 6px",
                          borderRadius: "4px",
                        }}>
                          {item.displayType}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Search by Cuisine */}
            <div className="search-group">
              <label>By Cuisine</label>
              <select
                value={searchFilters.cuisine}
                onChange={(e) =>
                  setSearchFilters((prev) => ({ ...prev, cuisine: e.target.value }))
                }
                className="search-select"
              >
                {ALL_CUISINES.map((cuisine) => (
                  <option key={cuisine} value={cuisine === "All Cuisines" ? "" : cuisine}>
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
                  setSearchFilters((prev) => ({ ...prev, radius: e.target.value }))
                }
                className="search-select"
              >
                {radiusOptions.map((radius) => (
                  <option key={radius} value={radius}>
                    {radius}
                  </option>
                ))}
              </select>
            </div>

            {/* Search by Reviewer */}
            <div className="search-group">
              <label>By Reviewer</label>
              {!currentUser ? (
                <div className="reviewer-dropdown-message">
                  <p>Please log in to filter by favorite reviewers.</p>
                </div>
              ) : favoriteReviewers.length === 0 ? (
                <div className="reviewer-dropdown-message">
                  <p>💙 Save your favorite reviewer to add them here.</p>
                </div>
              ) : (
                <select
                  value={searchFilters.reviewer}
                  onChange={(e) =>
                    setSearchFilters((prev) => ({ ...prev, reviewer: e.target.value }))
                  }
                  className="search-select"
                >
                  <option value="">All Reviewers</option>
                  {favoriteReviewers.map((reviewer) => (
                    <option key={reviewer.id} value={reviewer.id}>
                      {reviewer.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Clear Filters */}
            {(searchFilters.restaurant ||
              searchFilters.cuisine ||
              searchFilters.reviewer ||
              (searchFilters.radius && searchFilters.radius !== "Any Radius")) && (
              <button
                className="clear-filters-btn"
                onClick={() => {
                  setSearchFilters({ restaurant: "", cuisine: "", reviewer: "", radius: "Any Radius" });
                  setRestaurantSearchInput("");
                }}
              >
                Clear Filters
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

