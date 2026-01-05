import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../hooks/services/firebase";

import reserveIcon from "../../assets/icons/reserve_icon.svg";
import toGoIcon from "../../assets/icons/ToGo_icon_white.png";

import "./CompanyProfile.css";

export default function CompanyProfile() {
  const { companyId } = useParams();
  const navigate = useNavigate();

  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  /* -------------------------------------------------- */
  /* LOAD COMPANY                                       */
  /* -------------------------------------------------- */
  useEffect(() => {
    async function loadCompany() {
      try {
        const ref = doc(db, "restaurants", companyId);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          setCompany({ id: snap.id, ...snap.data() });
        }
      } catch (err) {
        console.error("CompanyProfile load error:", err);
      } finally {
        setLoading(false);
      }
    }

    loadCompany();
  }, [companyId]);

  if (loading) {
    return <div className="profile-wrapper">Loading…</div>;
  }

  if (!company) {
    return <div className="profile-wrapper">Company not found.</div>;
  }

  const cuisines = Array.isArray(company.cuisine)
    ? company.cuisine.join(" · ")
    : company.cuisine || "";

  const liveRating =
    typeof company.liveRating === "number"
      ? company.liveRating.toFixed(1)
      : "—";

  const avgRating =
    typeof company.avgRating === "number"
      ? company.avgRating.toFixed(1)
      : "—";

  /* -------------------------------------------------- */
  /* RENDER                                             */
  /* -------------------------------------------------- */
  return (
    <div className="profile-wrapper">
      <div className="profile-inner">
        {/* LOGO */}
        {company.imageURL && (
          <img
            src={company.imageURL}
            alt={company.name}
            className="profile-photo"
          />
        )}

        {/* NAME */}
        <div className="profile-name no-wrap">{company.name}</div>

        {/* CUISINE */}
        <div className="profile-role">{cuisines}</div>

        {/* RATINGS */}
       <div className="profile-rating">
  <span>⭐ LIVE {liveRating}</span>
  <span>•</span>
  <span>⭐ AVG {avgRating}</span>
</div>


        {/* ICON ACTION ROW — MATCHES RESTAURANT LIST */}
        <div className="profile-icons">
          {/* Live Lineup */}
          <button
            className="icon-button"
            title="Live Lineup"
            onClick={() => navigate(`/lineup/${company.id}`)}
          >
            🔵
          </button>

          {/* Call */}
          {company.phone && (
            <button
              className="icon-button"
              title="Call"
              onClick={() => (window.location.href = `tel:${company.phone}`)}
            >
              📞
            </button>
          )}

          {/* Directions */}
          {company.lat && company.lng && (
            <button
              className="icon-button"
              title="Directions"
              onClick={() =>
                window.open(
                  `https://www.google.com/maps/dir/?api=1&destination=${company.lat},${company.lng}`
                )
              }
            >
              🧭
            </button>
          )}

          {/* Reserve */}
          <img
            src={reserveIcon}
            alt="Reserve"
            className="profile-icon"
            onClick={() => navigate(`/restaurant/${company.id}/reserve`)}
          />

          {/* To-Go */}
          <img
            src={toGoIcon}
            alt="To Go"
            className="profile-icon"
            onClick={() => navigate(`/restaurant/${company.id}/togo`)}
          />
        </div>

        {/* ABOUT */}
        <div className="profile-section">
          <div className="section-title">About</div>
          <div className="empty-text">
            {company.description || "No description yet."}
          </div>
        </div>

        {/* PHOTOS */}
        <div className="profile-section">
          <div className="section-title">Photos</div>
          <div className="empty-text">No photos yet.</div>
        </div>

        {/* REVIEWS */}
        <div className="profile-section">
          <div className="section-title">Reviews</div>
          <div className="empty-text">No reviews yet.</div>
        </div>

        {/* BACK */}
        <div className="profile-links">
          <span className="profile-link" onClick={() => navigate(-1)}>
            ← Back to Map
          </span>
        </div>
      </div>
    </div>
  );
}
