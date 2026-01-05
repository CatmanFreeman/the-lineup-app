// src/pages/Reviews/PostReviewPage.jsx

import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../hooks/services/firebase";
import { Link, useNavigate } from "react-router-dom";
import "./PostReviewPage.css";

export default function PostReviewPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const loadRestaurants = async () => {
      setLoading(true);
      try {
        const restaurantsRef = collection(db, "restaurants");
        const snapshot = await getDocs(restaurantsRef);
        const restaurantsList = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          restaurantsList.push({
            id: docSnap.id,
            name: data.name || docSnap.id,
            address: data.address || "",
            ...data,
          });
        });

        setRestaurants(restaurantsList);
      } catch (err) {
        console.error("Error loading restaurants:", err);
      } finally {
        setLoading(false);
      }
    };

    loadRestaurants();
  }, []);

  const filteredRestaurants = restaurants.filter((restaurant) =>
    restaurant.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const cuisineText = (restaurant) => {
    if (Array.isArray(restaurant.cuisine)) {
      return restaurant.cuisine.join(" • ");
    }
    return restaurant.cuisine || "";
  };

  const live = (restaurant) => {
    return typeof restaurant.liveRating === "number"
      ? restaurant.liveRating.toFixed(1)
      : "-";
  };

  const avg = (restaurant) => {
    return typeof restaurant.avgRating === "number"
      ? restaurant.avgRating.toFixed(1)
      : "-";
  };

  if (!currentUser) {
    return (
      <div className="post-review-page">
        <div className="post-review-header">
          <div style={{ width: "100px" }}></div>
          <h1>Post a Review</h1>
          <Link to="/reviews" className="back-link">← Back</Link>
        </div>
        <div className="post-review-content">
          <p>Please log in to post a review.</p>
          <Link to="/login" className="btn-primary">Log In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="post-review-page">
      <div className="post-review-header">
        <div style={{ width: "100px" }}></div>
        <h1>Post a Review</h1>
        <Link to="/reviews" className="back-link">← Back</Link>
      </div>

      <div className="post-review-content">
        <p className="section-description">
          Select a restaurant to review your experience.
        </p>

        <div className="search-box">
          <input
            type="text"
            placeholder="Search restaurants..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        {loading ? (
          <div className="loading">Loading restaurants...</div>
        ) : filteredRestaurants.length === 0 ? (
          <div className="empty-state">
            <p>No restaurants found.</p>
          </div>
        ) : (
          <div className="restaurants-list">
            {filteredRestaurants.map((restaurant) => (
              <div
                key={restaurant.id}
                className="post-review-restaurant-card"
                onClick={() => navigate(`/review/${restaurant.id}`)}
              >
                {/* HEADER */}
                <div className="post-review-card-header">
                  {restaurant.imageURL && (
                    <img
                      src={restaurant.imageURL}
                      alt={restaurant.name}
                      className="post-review-logo"
                    />
                  )}
                  <div className="post-review-title-block">
                    <div className="post-review-title-link">{restaurant.name}</div>
                    {cuisineText(restaurant) && (
                      <div className="post-review-cuisine">
                        {cuisineText(restaurant)}
                      </div>
                    )}
                    <div
                      className={`post-review-open-status ${
                        restaurant.isOpen ? "open" : "closed"
                      }`}
                    >
                      {restaurant.isOpen ? "Open Now" : "Closed"}
                    </div>
                  </div>
                </div>

                {/* RATINGS ROW */}
                <div className="post-review-ratings">
                  <div className="post-review-rating-row">
                    <span className="rating-label">Live:</span>
                    <span className="rating-star">★</span>
                    <span className="rating-value">{live(restaurant)}</span>
                  </div>
                  <div className="post-review-rating-row">
                    <span className="rating-label">Avg:</span>
                    <span className="rating-star">★</span>
                    <span className="rating-value">{avg(restaurant)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

