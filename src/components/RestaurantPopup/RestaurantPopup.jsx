// -------------------------------------------------------
// src/components/RestaurantPopup/RestaurantPopup.jsx
// Complete updated file – no omissions
// -------------------------------------------------------

import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../hooks/services/firebase";
import { getDoc, setDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import "./RestaurantPopup.css";

import reserveIcon from "../../assets/icons/reserve_icon.svg";
import toGoIcon from "../../assets/icons/ToGo_icon_white.png";

function cleanPhone(phone) {
  if (!phone) return "";
  return phone.replace(/[^\d]/g, "");
}

function buildDirectionsURL(restaurant) {
  const base = "https://www.google.com/maps/dir/?api=1";
  const namePart = restaurant.name || "";
  const addressPart = restaurant.address || "";
  const dest = encodeURIComponent(`${namePart} ${addressPart}`.trim());
  return `${base}&destination=${dest}`;
}

export default function RestaurantPopup({ restaurant, onClose }) {
  const { currentUser } = useAuth();
  const [isFavorite, setIsFavorite] = useState(false);

  const restaurantId = restaurant?.id;

  // Load favorite status
  useEffect(() => {
    async function loadFavoriteStatus() {
      if (!currentUser || !restaurantId) {
        setIsFavorite(false);
        return;
      }
      try {
        const favRef = doc(db, "users", currentUser.uid, "favorites", restaurantId);
        const favSnap = await getDoc(favRef);
        setIsFavorite(favSnap.exists());
      } catch (error) {
        console.error("Error loading favorite status:", error);
        setIsFavorite(false);
      }
    }
    loadFavoriteStatus();
  }, [currentUser, restaurantId]);

  if (!restaurant) return null;

  const {
    id,
    name,
    cuisine,
    imageURL: restaurantImageURL,
    logoURL,
    logo,
    liveRating,
    avgRating,
    phone,
    menuURL,
    isOpen
  } = restaurant;

  // Ensure imageURL is set from multiple possible fields
  const imageURL = restaurantImageURL || logoURL || logo || null;

  // Handle favorite toggle
  async function handleFavorite(e) {
    e.stopPropagation();
    if (!currentUser) {
      alert("Sign in to add favorites");
      return;
    }

    try {
      if (isFavorite) {
        await deleteDoc(doc(db, "users", currentUser.uid, "favorites", id));
        setIsFavorite(false);
      } else {
        await setDoc(
          doc(db, "users", currentUser.uid, "favorites", id),
          { restaurantId: id, createdAt: serverTimestamp() },
          { merge: true }
        );
        setIsFavorite(true);
      }
    } catch (error) {
      console.error("Favorite toggle failed:", error);
    }
  }

  const cuisineText = Array.isArray(cuisine)
    ? cuisine.join(" • ")
    : cuisine || "";

  const tel = cleanPhone(phone);
  const directionsURL = buildDirectionsURL(restaurant);

  const live = typeof liveRating === "number" ? liveRating.toFixed(1) : "-";
  const avg = typeof avgRating === "number" ? avgRating.toFixed(1) : "-";

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-card" onClick={(e) => e.stopPropagation()}>

        {/* HEADER */}
        <div className="popup-header">
          {imageURL && (
            <img src={imageURL} alt={name} className="popup-logo" />
          )}

          <div className="popup-title-block">
            <div className="popup-title-row">
              <a
                href={menuURL || "#"}
                target={menuURL ? "_blank" : undefined}
                rel={menuURL ? "noreferrer" : undefined}
                className="popup-title-link"
              >
                {name}
              </a>
              <button
                type="button"
                className="popup-favorite-btn"
                onClick={handleFavorite}
                title={isFavorite ? "Remove from favorites" : "Add to favorites"}
              >
                <span className={isFavorite ? "heart heart-on" : "heart"}>♥</span>
              </button>
            </div>

            {cuisineText && (
              <div className="popup-cuisine">{cuisineText}</div>
            )}

            <div
              className={`popup-open-status ${
                isOpen ? "open" : "closed"
              }`}
            >
              {isOpen ? "Open Now" : "Closed"}
            </div>
          </div>
        </div>

        {/* RATINGS + ICONS INLINE ROW */}
        <div className="popup-ratings">
          {/* Live Rating */}
          <div className="popup-rating-row">
            <span className="rating-label">Live:</span>
            <span className="rating-star">★</span>
            <span className="rating-value">{live}</span>
          </div>

          {/* Avg Rating */}
          <div className="popup-rating-row">
            <span className="rating-label">Avg:</span>
            <span className="rating-star">★</span>
            <span className="rating-value">{avg}</span>
          </div>

          {/* Reserve + ToGo Icons */}
          <div className="popup-tools-inline">
            <img
              src={reserveIcon}
              alt="Reserve"
              className="popup-icon reserve-icon"
            />

            <img
              src={toGoIcon}
              alt="To-Go"
              className="popup-icon togo-icon"
              onClick={() => (window.location.href = `/to-go/${id}`)}
            />
          </div>
        </div>

        {/* LINKS */}
        <div className="popup-links">
          <a
            href={menuURL || "#"}
            target={menuURL ? "_blank" : undefined}
            rel={menuURL ? "noreferrer" : undefined}
            className="popup-link"
          >
            Menu
          </a>

          <a href={tel ? `tel:${tel}` : "#"} className="popup-link">
            Call
          </a>

          <a
            href={directionsURL}
            target="_blank"
            rel="noreferrer"
            className="popup-link"
          >
            Directions
          </a>

          <button
            type="button"
            className="popup-link popup-link-button"
            onClick={() => {
              window.location.href = `/live-lineup/${id}`;
            }}
          >
            Live Lineup
          </button>

          <a href={`/reviews/${id}`} className="popup-link">
            Reviews
          </a>
        </div>
      </div>
    </div>
  );
}
