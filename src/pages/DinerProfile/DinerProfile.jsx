// src/pages/DinerProfile/DinerProfile.jsx

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  collectionGroup,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";

import { db } from "../../hooks/services/firebase";
import { uploadImage } from "../../utils/uploadImage";
import { useAuth } from "../../context/AuthContext";
import BadgeGallery from "../../components/BadgeGallery";
import { getDinerBadges } from "../../utils/badgeService";
import FavoriteButton from "../../components/FavoriteButton/FavoriteButton";

import "./DinerProfile.css";

export default function DinerProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [diner, setDiner] = useState(null);
  const [loading, setLoading] = useState(true);

  const [recentReviews, setRecentReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  const [isFavorited, setIsFavorited] = useState(false);
  const [favLoading, setFavLoading] = useState(true);

  const [badges, setBadges] = useState([]);
  const [badgesLoading, setBadgesLoading] = useState(true);

  /* ======================================================
     LOAD DINER BADGES
  ====================================================== */
  const loadBadges = useCallback(async (uid) => {
    if (!uid) return;
    
    setBadgesLoading(true);
    try {
      const dinerBadges = await getDinerBadges(uid);
      setBadges(dinerBadges || []);
    } catch (err) {
      console.error("Failed to load diner badges:", err);
      setBadges([]);
    } finally {
      setBadgesLoading(false);
    }
  }, []);

  /* ======================================================
     LOAD DINER PROFILE (PUBLIC)
  ====================================================== */
  useEffect(() => {
    async function loadDiner() {
      setLoading(true);
      try {
        const ref = doc(db, "users", userId);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const dinerData = { id: snap.id, ...snap.data() };
          setDiner(dinerData);
          
          // Load badges for this diner
          loadBadges(userId);
        } else {
          setDiner(null);
        }
      } catch (err) {
        console.error("DinerProfile load error:", err);
        setDiner(null);
      } finally {
        setLoading(false);
      }
    }

    if (userId) loadDiner();
  }, [userId, loadBadges]);

  /* ======================================================
     LOAD RECENT REVIEWS (LAST 3)
  ====================================================== */
  useEffect(() => {
    async function loadReviews() {
      setReviewsLoading(true);
      try {
        const q = query(
          collectionGroup(db, "reviews"),
          where("userId", "==", userId),
          orderBy("timestamp", "desc"),
          limit(3)
        );

        const snap = await getDocs(q);
        setRecentReviews(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        );
      } catch (err) {
        console.warn("Recent reviews query failed:", err);
        setRecentReviews([]);
      } finally {
        setReviewsLoading(false);
      }
    }

    if (userId) loadReviews();
  }, [userId]);

  /* ======================================================
     FAVORITE STATE (VIEWER → DINER)
  ====================================================== */
  useEffect(() => {
    async function loadFavoriteState() {
      setFavLoading(true);
      try {
        if (!currentUser?.uid) {
          setIsFavorited(false);
          return;
        }

        const viewerRef = doc(db, "users", currentUser.uid);
        const snap = await getDoc(viewerRef);
        const data = snap.data() || {};

        const ids = Array.isArray(data.favoriteDinerIds)
          ? data.favoriteDinerIds
          : [];

        setIsFavorited(ids.includes(userId));
      } catch (err) {
        console.warn("Favorite state load failed:", err);
        setIsFavorited(false);
      } finally {
        setFavLoading(false);
      }
    }

    if (userId) loadFavoriteState();
  }, [currentUser?.uid, userId]);

  /* ======================================================
     IMAGE UPLOAD HANDLER (FIXED)
  ====================================================== */
  async function handleImageSelect(e) {
    e.stopPropagation();

    const file = e.target.files?.[0];
    if (!file) return;

    if (!currentUser || currentUser.uid !== userId) return;

    try {
      const imageURL = await uploadImage(
        file,
        `users/${currentUser.uid}/profile`
      );

      await updateDoc(doc(db, "users", currentUser.uid), {
        imageURL,
      });

      setDiner((prev) => ({ ...prev, imageURL }));
    } catch (err) {
      console.error("Image upload failed:", err);
    }
  }

  /* ======================================================
     FAVORITE TOGGLE
  ====================================================== */
  async function toggleFavorite() {
    if (!currentUser?.uid) {
      navigate("/login");
      return;
    }

    if (currentUser.uid === userId) return;

    try {
      const viewerRef = doc(db, "users", currentUser.uid);

      await updateDoc(viewerRef, {
        favoriteDinerIds: isFavorited
          ? arrayRemove(userId)
          : arrayUnion(userId),
      });

      setIsFavorited((v) => !v);
    } catch (err) {
      console.error("toggleFavorite error:", err);
    }
  }

  /* ======================================================
     DERIVED DISPLAY DATA
  ====================================================== */
  const displayName = diner?.displayName || "Diner";

  const fromLine = useMemo(() => {
    if (!diner) return "";
    const parts = [diner.city, diner.state].filter(Boolean);
    return parts.length ? `From: ${parts.join(", ")}` : "";
  }, [diner]);

  const favoriteRestaurants = Array.isArray(diner?.favoriteRestaurants)
    ? diner.favoriteRestaurants
    : [];

  const favoriteDiners = Array.isArray(diner?.favoriteDiners)
    ? diner.favoriteDiners
    : [];

  const checkins = Array.isArray(diner?.recentCheckins)
    ? diner.recentCheckins
    : [];

  /* ======================================================
     RENDER STATES
  ====================================================== */
  if (loading) {
    return (
      <div className="profile-wrapper">
        <div className="profile-inner">
          <div className="profile-loading">Loading…</div>
        </div>
      </div>
    );
  }

  if (!diner) {
    return (
      <div className="profile-wrapper">
        <div className="profile-inner">
          <div className="profile-notfound">Diner not found.</div>
        </div>
      </div>
    );
  }

  /* ======================================================
     MAIN RENDER
  ====================================================== */
  return (
    <div className="profile-wrapper">
      <div className="profile-inner">

        {/* ================= IMAGE ================= */}
        <div className="diner-image-wrapper">
          <input
            type="file"
            accept="image/*"
            id="diner-image-input"
            style={{ display: "none" }}
            onChange={handleImageSelect}
          />

          {diner.imageURL ? (
            <img
              src={diner.imageURL}
              alt="Diner"
              className="diner-profile-image"
            />
          ) : (
            <div
              className="diner-image-placeholder"
              onClick={(e) => {
                e.stopPropagation();
                document
                  .getElementById("diner-image-input")
                  .click();
              }}
            >
              ADD IMAGE
            </div>
          )}
        </div>

        {/* ================= NAME + HEART ================= */}
        <div className="diner-name-row">
          <div className="profile-name">{displayName}</div>

          <button
            className="diner-fav-btn"
            onClick={toggleFavorite}
            disabled={favLoading || currentUser?.uid === userId}
            title={
              currentUser?.uid === userId
                ? "This is you"
                : isFavorited
                ? "Unfavorite"
                : "Favorite"
            }
          >
            <span className={isFavorited ? "heart heart-on" : "heart"}>
              ♥
            </span>
          </button>
        </div>

        {/* ================= LOCATION ================= */}
        <div className="diner-from">{fromLine}</div>

        {/* ================= BADGES ================= */}
        <div className="profile-section">
          <div className="section-title">Badges & Achievements</div>
          {badgesLoading ? (
            <div className="empty-text">Loading badges...</div>
          ) : badges.length === 0 ? (
            <div className="empty-text">No badges yet.</div>
          ) : (
            <BadgeGallery badges={badges} showLabels={true} />
          )}
        </div>

        {/* ================= FAVORITES ================= */}
        <div className="profile-section">
          <div className="section-title">Favorite Restaurants</div>
          {favoriteRestaurants.length === 0 ? (
            <div className="empty-text">No favorites yet.</div>
          ) : (
            <div className="chip-grid">
              {favoriteRestaurants.map((r, i) => (
                <div key={i} className="chip">{r}</div>
              ))}
            </div>
          )}
        </div>

        <div className="profile-section">
          <div className="section-title">Favorite Diners</div>
          {favoriteDiners.length === 0 ? (
            <div className="empty-text">No favorites yet.</div>
          ) : (
            <div className="chip-grid">
              {favoriteDiners.map((d, i) => (
                <div key={i} className="chip">{d}</div>
              ))}
            </div>
          )}
        </div>

        <div className="profile-section">
          <div className="section-title">Recent Check-ins</div>
          {checkins.length === 0 ? (
            <div className="empty-text">No check-ins yet.</div>
          ) : (
            checkins.map((c, i) => (
              <div key={i} className="list-row">{c}</div>
            ))
          )}
        </div>

        <div className="profile-section">
          <div className="section-title">Reviews</div>
          {reviewsLoading ? (
            <div className="empty-text">Loading…</div>
          ) : recentReviews.length === 0 ? (
            <div className="empty-text">No reviews yet.</div>
          ) : (
            recentReviews.map((r) => (
              <div key={r.id} className="review-card">
                <div className="review-text">{r.comment}</div>
              </div>
            ))
          )}
        </div>

        <button
          className="profile-backlink"
          onClick={() => navigate(-1)}
        >
          ← Back
        </button>

      </div>
    </div>
  );
}