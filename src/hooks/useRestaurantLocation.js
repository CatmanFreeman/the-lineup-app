// src/hooks/useRestaurantLocation.js
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./services/firebase";

/**
 * useRestaurantLocation
 * Reads: /companies/{companyId}/restaurants/{restaurantId}
 * Expects fields: lat, lng (numbers)
 */
export default function useRestaurantLocation({ companyId, restaurantId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [location, setLocation] = useState(null); // { lat, lng }

  useEffect(() => {
    if (!companyId || !restaurantId) return;

    let alive = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const ref = doc(db, "companies", companyId, "restaurants", restaurantId);
        const snap = await getDoc(ref);

        if (!alive) return;

        if (!snap.exists()) {
          setError("Restaurant not found.");
          setLocation(null);
          setLoading(false);
          return;
        }

        const data = snap.data() || {};
        const lat = Number(data.lat);
        const lng = Number(data.lng);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          setError("Restaurant lat/lng missing or invalid.");
          setLocation(null);
          setLoading(false);
          return;
        }

        setLocation({ lat, lng });
        setLoading(false);
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "Failed to load restaurant location.");
        setLocation(null);
        setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [companyId, restaurantId]);

  return { loading, error, location };
}
