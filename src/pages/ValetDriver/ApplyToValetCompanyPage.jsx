// src/pages/ValetDriver/ApplyToValetCompanyPage.jsx
//
// APPLY TO VALET COMPANY PAGE
//
// Allows users (who signed up like diners) to apply to valet companies
// Similar to employee application flow

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../hooks/services/firebase";
import { applyToValetCompany } from "../../utils/valetDriverApplicationService";
import "./ApplyToValetCompanyPage.css";

export default function ApplyToValetCompanyPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [valetCompanies, setValetCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [restaurantId, setRestaurantId] = useState("");
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
      return;
    }

    loadValetCompanies();
    loadRestaurants();
  }, [currentUser, navigate]);

  async function loadValetCompanies() {
    try {
      const companiesRef = collection(db, "valetCompanies");
      const snap = await getDocs(companiesRef);
      setValetCompanies(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
    } catch (error) {
      console.error("Error loading valet companies:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadRestaurants() {
    try {
      const restaurantsRef = collection(db, "restaurants");
      const snap = await getDocs(restaurantsRef);
      setRestaurants(
        snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || d.id,
        }))
      );
    } catch (error) {
      console.error("Error loading restaurants:", error);
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!selectedCompanyId) {
      setError("Please select a valet company");
      return;
    }

    try {
      setSubmitting(true);

      await applyToValetCompany({
        driverId: currentUser.uid,
        valetCompanyId: selectedCompanyId,
        restaurantId: restaurantId || null,
        driverName: currentUser.displayName || currentUser.name || "Driver",
        driverEmail: currentUser.email || "",
        driverPhone: currentUser.phoneNumber || "",
      });

      setSuccess(true);
      setTimeout(() => {
        navigate("/profile");
      }, 2000);
    } catch (error) {
      console.error("Error applying to valet company:", error);
      setError(error.message || "Failed to submit application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="apply-valet-page">
        <div className="apply-valet-loading">Loading...</div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="apply-valet-page">
        <div className="apply-valet-success">
          <h2>Application Submitted!</h2>
          <p>Your application has been sent to the valet company. You'll be notified when they review it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="apply-valet-page">
      <div className="apply-valet-card">
        <h1>Apply to Valet Company</h1>
        <p className="apply-valet-subtitle">
          Select a valet company to apply to work as a driver
        </p>

        {error && <div className="apply-valet-error">{error}</div>}

        <form onSubmit={handleSubmit} className="apply-valet-form">
          <div className="apply-valet-form-group">
            <label>Valet Company *</label>
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              required
            >
              <option value="">Select a valet company</option>
              {valetCompanies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          <div className="apply-valet-form-group">
            <label>Restaurant Location (Optional)</label>
            <select
              value={restaurantId}
              onChange={(e) => setRestaurantId(e.target.value)}
            >
              <option value="">Select a restaurant (optional)</option>
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </option>
              ))}
            </select>
            <p className="apply-valet-form-hint">
              You can specify a restaurant location now, or it can be assigned later
            </p>
          </div>

          <button
            type="submit"
            className="apply-valet-submit"
            disabled={submitting}
          >
            {submitting ? "Submitting..." : "Submit Application"}
          </button>
        </form>

        <div className="apply-valet-footer">
          <p>
            <a href="/profile" className="apply-valet-link">
              Cancel
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}








