// src/pages/Dashboards/ValetDriverDashboard/DriverClaimsTab.jsx
//
// DRIVER CLAIMS TAB
//
// Displays all claims submitted against this valet driver
// Shows current and past claims with status

import React, { useState, useEffect } from "react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "../../../hooks/services/firebase";
import "./DriverClaimsTab.css";

export default function DriverClaimsTab({ driverId, valetCompanyId }) {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL"); // ALL, PENDING, REVIEWING, RESOLVED, REJECTED

  useEffect(() => {
    if (valetCompanyId && driverId) {
      loadClaims();
    }
  }, [valetCompanyId, driverId, filter]);

  async function loadClaims() {
    try {
      setLoading(true);
      const claimsRef = collection(db, "valetCompanies", valetCompanyId, "claims");
      let claimsQuery = query(
        claimsRef,
        where("valetDriverId", "==", driverId),
        orderBy("submittedAt", "desc")
      );

      if (filter !== "ALL") {
        claimsQuery = query(
          claimsRef,
          where("valetDriverId", "==", driverId),
          where("status", "==", filter),
          orderBy("submittedAt", "desc")
        );
      }

      const claimsSnap = await getDocs(claimsQuery);
      const claimsData = claimsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setClaims(claimsData);
    } catch (error) {
      console.error("Error loading driver claims:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="driver-claims-tab-loading">Loading claims...</div>;
  }

  return (
    <div className="driver-claims-tab">
      <div className="driver-claims-tab-filters">
        <button
          className={`driver-claims-filter-btn ${filter === "ALL" ? "active" : ""}`}
          onClick={() => setFilter("ALL")}
        >
          All ({claims.length})
        </button>
        <button
          className={`driver-claims-filter-btn ${filter === "PENDING" ? "active" : ""}`}
          onClick={() => setFilter("PENDING")}
        >
          Pending
        </button>
        <button
          className={`driver-claims-filter-btn ${filter === "REVIEWING" ? "active" : ""}`}
          onClick={() => setFilter("REVIEWING")}
        >
          Reviewing
        </button>
        <button
          className={`driver-claims-filter-btn ${filter === "RESOLVED" ? "active" : ""}`}
          onClick={() => setFilter("RESOLVED")}
        >
          Resolved
        </button>
        <button
          className={`driver-claims-filter-btn ${filter === "REJECTED" ? "active" : ""}`}
          onClick={() => setFilter("REJECTED")}
        >
          Rejected
        </button>
      </div>

      {claims.length === 0 ? (
        <div className="driver-claims-tab-empty">
          <p>No claims found</p>
        </div>
      ) : (
        <div className="driver-claims-list">
          {claims.map((claim) => (
            <div key={claim.id} className="driver-claim-card">
              <div className="driver-claim-header">
                <div>
                  <h3>Claim #{claim.id.substring(0, 8)}</h3>
                  <p className="driver-claim-meta">
                    From: {claim.dinerName} • Ticket: {claim.ticketId?.substring(0, 8) || "N/A"}
                  </p>
                  <p className="driver-claim-meta">
                    Submitted: {claim.submittedAt?.toDate?.()?.toLocaleDateString() || "N/A"}
                  </p>
                </div>
                <div className="driver-claim-status-badge" data-status={claim.status}>
                  {claim.status}
                </div>
              </div>

              <div className="driver-claim-ratings">
                <div className="driver-claim-rating">
                  <span>Your Rating:</span>
                  <span className="driver-claim-rating-stars">
                    {"⭐".repeat(claim.driverRating || 0)}
                    {"☆".repeat(5 - (claim.driverRating || 0))}
                  </span>
                </div>
                <div className="driver-claim-rating">
                  <span>Company Rating:</span>
                  <span className="driver-claim-rating-stars">
                    {"⭐".repeat(claim.companyRating || 0)}
                    {"☆".repeat(5 - (claim.companyRating || 0))}
                  </span>
                </div>
              </div>

              <div className="driver-claim-description">
                <h4>Description</h4>
                <p>{claim.description}</p>
              </div>

              {claim.photos && claim.photos.length > 0 && (
                <div className="driver-claim-photos">
                  <h4>Photos ({claim.photos.length})</h4>
                  <div className="driver-claim-photos-grid">
                    {claim.photos.map((photoUrl, index) => (
                      <img
                        key={index}
                        src={photoUrl}
                        alt={`Claim photo ${index + 1}`}
                        className="driver-claim-photo"
                        onClick={() => window.open(photoUrl, "_blank")}
                      />
                    ))}
                  </div>
                </div>
              )}

              {claim.video && (
                <div className="driver-claim-video">
                  <h4>Video</h4>
                  <video src={claim.video} controls className="driver-claim-video-player" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}








