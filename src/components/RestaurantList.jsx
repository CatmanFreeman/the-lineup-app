import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../hooks/services/firebase";
import { useAuth } from "../context/AuthContext";

import reserveIcon from "../assets/icons/reserve_icon.svg";
import toGoIcon from "../assets/icons/ToGo_icon_white.png";
import DinerProfile from "../pages/DinerProfile/DinerProfile";

import "./RestaurantList.css";

/* ------------------------------------------------------------------ */
/* ICON: MAP PIN                                                      */
/* ------------------------------------------------------------------ */
function BluePinIcon() {
  return (
    <svg className="pin-svg" viewBox="0 0 24 24">
      <path
        d="M12 22s7-7.1 7-13a7 7 0 1 0-14 0c0 5.9 7 13 7 13z"
        fill="currentColor"
      />
      <circle cx="12" cy="9" r="2.5" fill="#0b1220" />
    </svg>
  );
}

export default function RestaurantList({ selectedCuisine, selectedRadius, setViewMode }) {
  const [restaurants, setRestaurants] = useState([]);
  const [userLocation, setUserLocation] = useState(null);

  // favorites: { [restaurantId]: true }
  const [favorites, setFavorites] = useState({});

  const { user } = useAuth();
  const navigate = useNavigate();

  /* -------------------------------------------------------------- */
  /* DISTANCE (HAVERSINE)                                           */
  /* -------------------------------------------------------------- */
  function milesBetween(lat1, lon1, lat2, lon2) {
    const R = 3958.8;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  /* -------------------------------------------------------------- */
  /* USER GPS                                                       */
  /* -------------------------------------------------------------- */
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => setUserLocation(null)
    );
  }, []);

  /* -------------------------------------------------------------- */
  /* LOAD RESTAURANTS                                               */
  /* -------------------------------------------------------------- */
  useEffect(() => {
    async function loadRestaurants() {
      const snap = await getDocs(collection(db, "restaurants"));
      setRestaurants(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }
    loadRestaurants();
  }, []);

  /* -------------------------------------------------------------- */
  /* LOAD FAVORITES (when logged in)                                */
  /* -------------------------------------------------------------- */
  useEffect(() => {
    async function loadFavorites() {
      if (!user) {
        setFavorites({});
        return;
      }
      const favSnap = await getDocs(collection(db, "users", user.uid, "favorites"));
      const favMap = {};
      favSnap.docs.forEach((d) => {
        favMap[d.id] = true; // doc id = restaurantId
      });
      setFavorites(favMap);
    }
    loadFavorites();
  }, [user]);

  /* -------------------------------------------------------------- */
  /* FAVORITES TOGGLE                                               */
  /* -------------------------------------------------------------- */
  async function handleFavorite(restaurantId) {
    if (!user) {
      alert("Sign in to add favorites");
      return;
    }

    const isFav = !!favorites[restaurantId];

    try {
      if (isFav) {
        await deleteDoc(doc(db, "users", user.uid, "favorites", restaurantId));
        setFavorites((prev) => {
          const copy = { ...prev };
          delete copy[restaurantId];
          return copy;
        });
      } else {
        await setDoc(
          doc(db, "users", user.uid, "favorites", restaurantId),
          { restaurantId, createdAt: serverTimestamp() },
          { merge: true }
        );
        setFavorites((prev) => ({ ...prev, [restaurantId]: true }));
      }
    } catch (e) {
      console.error("Favorite toggle failed:", e);
    }
  }

  /* -------------------------------------------------------------- */
  /* FILTER + AUGMENT                                               */
  /* -------------------------------------------------------------- */
  const filtered = useMemo(() => {
    return restaurants
      .map((r) => {
        let distance = null;
        const lat = Number(r.lat);
        const lng = Number(r.lng);

        if (userLocation && !Number.isNaN(lat) && !Number.isNaN(lng)) {
          distance = milesBetween(userLocation.lat, userLocation.lng, lat, lng);
        }

        return {
          ...r,
          distance: distance ? distance.toFixed(1) : null,
        };
      })
      .filter((r) => {
        // Cuisine filter
        if (
          selectedCuisine &&
          selectedCuisine !== "All Cuisines" &&
          !(
            Array.isArray(r.cuisine)
              ? r.cuisine.includes(selectedCuisine)
              : r.cuisine === selectedCuisine
          )
        ) {
          return false;
        }

        // Radius filter
        if (
          selectedRadius &&
          selectedRadius !== "Any Radius" &&
          r.distance &&
          parseFloat(r.distance) > parseInt(selectedRadius, 10)
        ) {
          return false;
        }

        return true;
      });
  }, [restaurants, userLocation, selectedCuisine, selectedRadius]);

  /* -------------------------------------------------------------- */
  /* RENDER                                                         */
  /* -------------------------------------------------------------- */
  return (
    <div className="restaurant-list-wrapper">
      <div className="list-header">
        <span className="back-to-map-link" onClick={() => setViewMode("map")}>
          ← MAP
        </span>
      </div>

      <div className="restaurant-list">
        {filtered.map((r) => {
          const cuisines = Array.isArray(r.cuisine)
            ? r.cuisine.join(" · ")
            : (r.cuisine || "").replace(/\s*[-/]\s*/g, " · ");

          // ✅ FIX: pull liveRating from Firestore field name: liveRating
          // Also tolerate strings like "4.6"
          const rawLive = r.liveRating ?? r.liverating ?? r.rating ?? null;
          const liveRatingNum =
            rawLive === null || rawLive === undefined ? null : Number(rawLive);
          const liveRating =
            Number.isFinite(liveRatingNum) ? liveRatingNum.toFixed(1) : "—";

          const isFav = !!favorites[r.id];

          return (
            <div key={r.id} className="restaurant-card">
              {/* FAVORITE (top-right) */}
              <div
                className={`favorite top-right ${isFav ? "active" : ""}`}
                onClick={() => handleFavorite(r.id)}
                title={isFav ? "Remove favorite" : "Add favorite"}
              >
                {isFav ? "♥" : "♡"}
              </div>

              {/* LOGO */}
              <img
                src={r.imageURL || "/placeholder.jpg"}
                alt={r.name}
                className="restaurant-thumb"
              />

              {/* BODY */}
              <div className="restaurant-body">
                <div
                  className="restaurant-name clickable"
                  onClick={() => navigate(`/company/${r.id}`)}
                >
                  {r.name}
                </div>

                <div className="cuisine-row">
  <span className="restaurant-cuisine">{cuisines}</span>

  <div className="service-icons-inline">
    <img
      src={reserveIcon}
      alt="Reserve"
      className="service-icon"
      onClick={() => navigate(`/restaurant/${r.id}/reserve`)}
    />
    <img
      src={toGoIcon}
      alt="To Go"
      className="service-icon"
      onClick={() => navigate(`/restaurant/${r.id}/togo`)}
    />
  </div>
</div>


                <div className="restaurant-bottom">
                  <div className="bottom-left">
                    <span>LIVE</span>
                    <span>⭐ {liveRating}</span>
                    <BluePinIcon />
                    <span>{r.distance ? `${r.distance} mi` : "—"}</span>
                  </div>

                  <div className="bottom-right">
                    <button onClick={() => r.menuURL && window.open(r.menuURL)} title="Menu">
                      📋
                    </button>
                    <button
                      onClick={() => r.phone && (window.location.href = `tel:${r.phone}`)}
                      title="Call"
                    >
                      📞
                    </button>
                    <button
                      onClick={() =>
                        window.open(
                          `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}`
                        )
                      }
                      title="Directions"
                    >
                      🧭
                    </button>
                    <button onClick={() => navigate(`/lineup/${r.id}`)} title="Live Lineup">
                      🔵
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
