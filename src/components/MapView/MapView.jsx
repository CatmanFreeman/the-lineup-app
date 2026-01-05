// src/components/MapView/MapView.jsx
import React, { useEffect, useRef, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../hooks/services/firebase";
import "./MapView.css";

import restaurantPin from "../../assets/icons/restaurant_pin.png";
import userIcon from "../../assets/icons/hungry_user_icon.png";
import RestaurantPopup from "../RestaurantPopup/RestaurantPopup";

export default function MapView({
  selectedCuisine,
  selectedRadius,
  viewMode,
  setViewMode,
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null); // ADDED
  const userLocationRef = useRef(null); // ADDED
  const watchPositionIdRef = useRef(null); // For geolocation watch cleanup

  const [activeRestaurant, setActiveRestaurant] = useState(null);
  const [restaurantsCache, setRestaurantsCache] = useState([]); // ADDED
  const [userLocation, setUserLocation] = useState(null); // Track user location in state to trigger re-renders
  const [locationError, setLocationError] = useState(null); // Track location errors

  // ---------------------------------------------------------
  // UTILS — DISTANCE (Haversine)
  // ---------------------------------------------------------
  function milesBetween(lat1, lon1, lat2, lon2) {
    const R = 3958.8;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ---------------------------------------------------------
  // INIT MAP (ONE TIME)
  // ---------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    let retryCount = 0;
    const maxRetries = 50; // ~20 seconds max wait

    async function initMap() {
      // Check if Google Maps is loaded
      if (!window.google || !window.google.maps) {
        retryCount++;
        if (!cancelled && retryCount < maxRetries) {
          setTimeout(initMap, 400);
        } else if (!cancelled) {
          console.error("Google Maps API failed to load after multiple retries");
        }
        return;
      }

      const { maps } = window.google;
      const defaultCenter = { lat: 30.2672, lng: -97.7431 };

      const map = new maps.Map(mapRef.current, {
        center: defaultCenter,
        zoom: 6,
        disableDefaultUI: true,
        gestureHandling: "greedy",
      });

      mapInstanceRef.current = map;

      map.addListener("click", () => setActiveRestaurant(null));
      
      // Wait a moment for map to fully initialize before requesting location
      setTimeout(() => {
        if (cancelled) return;

      // USER LOCATION - Improved for mobile
      function updateUserLocation(pos) {
        if (cancelled) return;
        const currentMap = mapInstanceRef.current;
        if (!currentMap) {
          console.warn("Map not ready yet, cannot update user location");
          return;
        }

        const userPos = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };

        console.log("✅ User location found:", userPos);
        console.log("Accuracy:", pos.coords.accuracy, "meters");
        
        userLocationRef.current = userPos;
        setUserLocation(userPos); // Update state to trigger marker re-render
        
        // Center map on user location
        currentMap.setCenter(userPos);
        currentMap.setZoom(12);
        
        console.log("Map centered on user location");

        // Remove existing marker if any
        if (userMarkerRef.current) {
          userMarkerRef.current.setMap(null);
        }

        // Create user location marker with emoji (hungry face 😋)
        // Use a data URL for the emoji to ensure it always loads on mobile
        const emojiCanvas = document.createElement('canvas');
        emojiCanvas.width = 50;
        emojiCanvas.height = 50;
        const ctx = emojiCanvas.getContext('2d');
        ctx.font = '40px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('😋', 25, 25);
        
        const emojiDataUrl = emojiCanvas.toDataURL();

        // Create user location marker with emoji icon
        userMarkerRef.current = new maps.Marker({
          position: userPos,
          map: currentMap,
          icon: {
            url: emojiDataUrl,
            scaledSize: new maps.Size(40, 40),
            anchor: new maps.Point(20, 20),
          },
          title: "Your Location",
          zIndex: 1000, // Ensure user marker appears above restaurant pins
        });

        console.log("User marker created successfully");
      }

        // Request user location - try getCurrentPosition first (more reliable on mobile)
        if (navigator.geolocation) {
          console.log("Requesting user location...");
          setLocationError(null);
          
          // First, try getCurrentPosition (more reliable initial request)
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (cancelled) return;
              console.log("✅ getCurrentPosition success:", pos.coords);
              setLocationError(null);
              updateUserLocation(pos);
              
              // After successful initial location, start watching for updates
              const watchId = navigator.geolocation.watchPosition(
                (watchPos) => {
                  if (cancelled) return;
                  console.log("watchPosition update:", watchPos.coords);
                  updateUserLocation(watchPos);
                },
                (watchError) => {
                  console.warn("watchPosition error:", watchError);
                  // Continue using the last known position
                },
                {
                  enableHighAccuracy: true,
                  timeout: 30000,
                  maximumAge: 60000 // Allow 1 minute old cache for updates
                }
              );
              
              watchPositionIdRef.current = watchId;
            },
            (error) => {
              if (cancelled) return;
              console.error("❌ getCurrentPosition error:", error);
              console.error("Error code:", error.code);
              console.error("Error message:", error.message);
              
              // Error code meanings:
              // 1 = PERMISSION_DENIED
              // 2 = POSITION_UNAVAILABLE  
              // 3 = TIMEOUT
              
              let errorMessage = "Unable to get your location";
              if (error.code === 1) {
                errorMessage = "Location permission denied. Please enable location access in your browser settings.";
                console.error("Location permission denied by user");
              } else if (error.code === 2) {
                errorMessage = "Location unavailable. Please check your GPS settings.";
                console.error("Location unavailable - GPS may be off");
              } else if (error.code === 3) {
                errorMessage = "Location request timed out. Please try again.";
                console.error("Location request timed out");
              }
              
              setLocationError(errorMessage);
              
              // Try one more time with less strict options
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  if (cancelled) return;
                  console.log("✅ Retry getCurrentPosition success:", pos.coords);
                  setLocationError(null);
                  updateUserLocation(pos);
                },
                (retryError) => {
                  if (cancelled) return;
                  console.error("❌ All geolocation attempts failed:", retryError);
                  setLocationError("Could not determine your location. Please check your browser settings.");
                },
                {
                  enableHighAccuracy: false, // Less accurate but faster
                  timeout: 15000, // 15 seconds
                  maximumAge: 300000 // Allow 5 minute old cache
                }
              );
            },
            {
              enableHighAccuracy: true,
              timeout: 20000, // 20 seconds for initial request
              maximumAge: 0 // Get fresh location
            }
          );
        } else {
          console.warn("Geolocation is not supported by this browser");
          setLocationError("Geolocation is not supported by this browser");
        }
      }, 500); // Small delay to ensure map is fully ready

      // LOAD RESTAURANTS (ONCE) - Ensure imageURL is loaded
      try {
        const snap = await getDocs(collection(db, "restaurants"));
        const restaurants = snap.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            // Ensure imageURL is properly set (check multiple possible fields)
            imageURL: data.imageURL || data.logoURL || data.logo || null,
          };
        });

        console.log(`Loaded ${restaurants.length} restaurants`);
        const withCoords = restaurants.filter(r => typeof r.lat === "number" && typeof r.lng === "number");
        console.log(`${withCoords.length} restaurants have valid coordinates`);
        
        // Log sample restaurant data for debugging
        if (withCoords.length > 0) {
          console.log("Sample restaurant:", {
            name: withCoords[0].name,
            lat: withCoords[0].lat,
            lng: withCoords[0].lng,
            imageURL: withCoords[0].imageURL,
            cuisines: withCoords[0].cuisines,
            cuisine: withCoords[0].cuisine,
            liveRating: withCoords[0].liveRating
          });
        }
        
        setRestaurantsCache(restaurants);
      } catch (error) {
        console.error("Error loading restaurants:", error);
        setRestaurantsCache([]);
      }
    }

    // Try to initialize immediately
    initMap();

    // Also listen for the google-maps-loaded event
    const handleMapsLoaded = () => {
      if (!cancelled && (!window.google || !window.google.maps)) {
        initMap();
      }
    };

    window.addEventListener("google-maps-loaded", handleMapsLoaded);

    return () => {
      cancelled = true;
      window.removeEventListener("google-maps-loaded", handleMapsLoaded);
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      if (userMarkerRef.current) {
        userMarkerRef.current.setMap(null);
        userMarkerRef.current = null;
      }
      if (watchPositionIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchPositionIdRef.current);
        watchPositionIdRef.current = null;
      }
      mapInstanceRef.current = null;
    };
  }, []);

  // ---------------------------------------------------------
  // RENDER MARKERS (FILTERED)
  // ---------------------------------------------------------
  useEffect(() => {
    if (!mapInstanceRef.current) {
      console.log("Map instance not ready yet");
      return;
    }

    if (!window.google || !window.google.maps) {
      console.log("Google Maps API not loaded yet");
      return;
    }

    const map = mapInstanceRef.current;

    // Clear existing markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    console.log(`Rendering markers for ${restaurantsCache.length} restaurants`);
    let markersCreated = 0;
    let markersFiltered = 0;

    restaurantsCache.forEach((rest) => {
      if (typeof rest.lat !== "number" || typeof rest.lng !== "number") return;

      // CUISINE FILTER
      const cuisineField = rest.cuisines || rest.cuisine; // Support both cuisines (array) and cuisine (string)
      if (
        selectedCuisine &&
        selectedCuisine !== "All Cuisines" &&
        !(
          Array.isArray(cuisineField)
            ? cuisineField.includes(selectedCuisine)
            : cuisineField === selectedCuisine
        )
      ) {
        markersFiltered++;
        return;
      }

      // DISTANCE FILTER
      let distance = null;
      const currentUserLocation = userLocation || userLocationRef.current;
      if (currentUserLocation) {
        distance = milesBetween(
          currentUserLocation.lat,
          currentUserLocation.lng,
          rest.lat,
          rest.lng
        );

        // Apply radius filter if user location is available
        // Default to 10 miles if selectedRadius is "Radius" (placeholder) or not set
        const radiusToUse = (selectedRadius && selectedRadius !== "Radius" && selectedRadius !== "Any Radius") 
          ? parseInt(selectedRadius) 
          : 10; // Default to 10 miles
        
        if (distance > radiusToUse) {
          markersFiltered++;
          return;
        }
      }
      // If no user location yet, show all restaurants (they'll be filtered once location is found)

      const live =
        typeof rest.liveRating === "number"
          ? rest.liveRating.toFixed(1)
          : "—";

      const marker = new window.google.maps.Marker({
        position: { lat: rest.lat, lng: rest.lng },
        map,
        icon: {
          url: restaurantPin,
          scaledSize: new window.google.maps.Size(44, 44),
          labelOrigin: new window.google.maps.Point(22, 18),
        },
        label: {
          text: live,
          color: "#ffffff",
          fontWeight: "700",
          fontSize: "14px",
        },
      });

      marker.addListener("click", () => {
        setActiveRestaurant({
          ...rest,
          distance: distance ? distance.toFixed(1) : null,
        });
      });

      markersRef.current.push(marker);
      markersCreated++;
    });

    console.log(`Created ${markersCreated} markers, filtered ${markersFiltered} restaurants`);
    console.log(`Total markers on map: ${markersRef.current.length}`);
    console.log(`User location:`, userLocation || userLocationRef.current);
    console.log(`Selected radius:`, selectedRadius);
  }, [restaurantsCache, selectedCuisine, selectedRadius, userLocation]);

  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------
  return (
    <div className="map-wrapper">
      <div id="map" ref={mapRef} className="map-canvas" />

      {/* MAP / LIST TOGGLE OVERLAY */}
      <div className="map-view-toggle">
        <button
          className={viewMode === "map" ? "active" : ""}
          onClick={() => setViewMode("map")}
        >
          Map
        </button>
        <button
          className={viewMode === "list" ? "active" : ""}
          onClick={() => setViewMode("list")}
        >
          List
        </button>
      </div>

      {activeRestaurant && (
        <div className="popup-overlay">
          <RestaurantPopup
            restaurant={activeRestaurant}
            onClose={() => setActiveRestaurant(null)}
          />
        </div>
      )}

      {/* Location Status Indicator */}
      {locationError && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(255, 0, 0, 0.9)',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '8px',
          fontSize: '14px',
          zIndex: 1000,
          maxWidth: '90%',
          textAlign: 'center',
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
        }}>
          {locationError}
          <button
            onClick={() => {
              setLocationError(null);
              if (navigator.geolocation && mapInstanceRef.current) {
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    const userPos = {
                      lat: pos.coords.latitude,
                      lng: pos.coords.longitude,
                    };
                    userLocationRef.current = userPos;
                    setUserLocation(userPos);
                    mapInstanceRef.current.setCenter(userPos);
                    mapInstanceRef.current.setZoom(12);
                  },
                  (err) => {
                    setLocationError("Still unable to get location. Please check browser settings.");
                  },
                  { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
                );
              }
            }}
            style={{
              marginLeft: '10px',
              padding: '5px 10px',
              backgroundColor: 'white',
              color: 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      )}

      {!userLocation && !locationError && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '8px',
          fontSize: '14px',
          zIndex: 1000
        }}>
          Finding your location...
        </div>
      )}
    </div>
  );
}
