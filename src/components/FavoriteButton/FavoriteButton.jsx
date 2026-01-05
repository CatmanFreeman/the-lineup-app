// src/components/FavoriteButton/FavoriteButton.jsx
//
// FAVORITE BUTTON COMPONENT
//
// Reusable button to favorite/unfavorite:
// - Restaurants
// - Staff members
// - Valet drivers
// - When you favorite a restaurant, you become a follower

import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  favoriteUserOrRestaurant,
  unfavoriteUserOrRestaurant,
  isFavorited,
} from "../../utils/favoritesService";
import "./FavoriteButton.css";

export default function FavoriteButton({
  targetId,
  targetType, // "restaurant", "staff", or "driver"
  onFavoriteChange, // Optional callback
}) {
  const { currentUser } = useAuth();
  const [isFavoritedState, setIsFavoritedState] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (currentUser && targetId && targetType) {
      checkFavoriteStatus();
    } else {
      setLoading(false);
    }
  }, [currentUser, targetId, targetType]);

  async function checkFavoriteStatus() {
    try {
      const favorited = await isFavorited(currentUser.uid, targetId, targetType);
      setIsFavoritedState(favorited);
    } catch (error) {
      console.error("Error checking favorite status:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleToggle = async () => {
    if (!currentUser) {
      alert("Please log in to favorite");
      return;
    }

    if (toggling) return;

    setToggling(true);

    try {
      if (isFavoritedState) {
        await unfavoriteUserOrRestaurant(currentUser.uid, targetId, targetType);
        setIsFavoritedState(false);
      } else {
        await favoriteUserOrRestaurant(currentUser.uid, targetId, targetType);
        setIsFavoritedState(true);
      }

      if (onFavoriteChange) {
        onFavoriteChange(!isFavoritedState);
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
      alert("Failed to update favorite. Please try again.");
    } finally {
      setToggling(false);
    }
  };

  if (loading || !currentUser) {
    return null;
  }

  return (
    <button
      className={`favorite-button ${isFavoritedState ? "favorited" : ""}`}
      onClick={handleToggle}
      disabled={toggling}
      title={isFavoritedState ? "Unfavorite" : "Favorite"}
    >
      <span className="favorite-button-icon">
        {isFavoritedState ? "❤️" : "🤍"}
      </span>
      <span className="favorite-button-text">
        {isFavoritedState ? "Favorited" : "Favorite"}
      </span>
    </button>
  );
}








