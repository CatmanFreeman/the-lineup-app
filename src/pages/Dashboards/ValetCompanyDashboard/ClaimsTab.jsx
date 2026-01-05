// src/pages/Dashboards/ValetCompanyDashboard/ClaimsTab.jsx
//
// CLAIMS TAB
//
// Displays all claims submitted for this valet company
// - Shows claim status (PENDING, REVIEWING, RESOLVED, REJECTED)
// - Displays photos, video, and description
// - Allows company to update claim status

import React, { useState, useEffect } from "react";
import { collection, query, where, orderBy, getDocs, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../hooks/services/firebase";
import "./ClaimsTab.css";

export default function ClaimsTab({ valetCompanyId }) {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL"); // ALL, PENDING, REVIEWING, RESOLVED, REJECTED

  useEffect(() => {
    loadClaims();
  }, [valetCompanyId, filter]);

  async function loadClaims() {
    try {
      setLoading(true);
      const claimsRef = collection(db, "valetCompanies", valetCompanyId, "claims");
      let claimsQuery = query(claimsRef, orderBy("submittedAt", "desc"));

      if (filter !== "ALL") {
        claimsQuery = query(claimsRef, where("status", "==", filter), orderBy("submittedAt", "desc"));
      }

      const claimsSnap = await getDocs(claimsQuery);
      const claimsData = claimsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setClaims(claimsData);
    } catch (error) {
      console.error("Error loading claims:", error);
    } finally {
      setLoading(false);
    }
  }

  const updateClaimStatus = async (claimId, newStatus) => {
    try {
      const claimRef = doc(db, "valetCompanies", valetCompanyId, "claims", claimId);
      await updateDoc(claimRef, {
        status: newStatus,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await loadClaims();
    } catch (error) {
      console.error("Error updating claim status:", error);
      alert("Failed to update claim status");
    }
  };

  if (loading) {
    return <div className="claims-tab-loading">Loading claims...</div>;
  }

  return (
    <div className="claims-tab">
      <div className="claims-tab-filters">
        <button
          className={`claims-filter-btn ${filter === "ALL" ? "active" : ""}`}
          onClick={() => setFilter("ALL")}
        >
          All ({claims.length})
        </button>
        <button
          className={`claims-filter-btn ${filter === "PENDING" ? "active" : ""}`}
          onClick={() => setFilter("PENDING")}
        >
          Pending
        </button>
        <button
          className={`claims-filter-btn ${filter === "REVIEWING" ? "active" : ""}`}
          onClick={() => setFilter("REVIEWING")}
        >
          Reviewing
        </button>
        <button
          className={`claims-filter-btn ${filter === "RESOLVED" ? "active" : ""}`}
          onClick={() => setFilter("RESOLVED")}
        >
          Resolved
        </button>
        <button
          className={`claims-filter-btn ${filter === "REJECTED" ? "active" : ""}`}
          onClick={() => setFilter("REJECTED")}
        >
          Rejected
        </button>
      </div>

      {claims.length === 0 ? (
        <div className="claims-tab-empty">
          <p>No claims found</p>
        </div>
      ) : (
        <div className="claims-list">
          {claims.map((claim) => (
            <div key={claim.id} className="claim-card">
              <div className="claim-header">
                <div>
                  <h3>Claim {claim.claimNumber || `#${claim.id.substring(0, 8)}`}</h3>
                  <p className="claim-meta">
                    From: {claim.dinerName} • Ticket: {claim.ticketId?.substring(0, 8) || "N/A"}
                  </p>
                  <p className="claim-meta">
                    Submitted: {claim.submittedAt?.toDate?.()?.toLocaleDateString() || "N/A"}
                  </p>
                  {claim.driverInfo && (
                    <p className="claim-meta">
                      Driver: {claim.driverInfo.name || "Unknown"} {claim.driverInfo.phone && `• ${claim.driverInfo.phone}`}
                    </p>
                  )}
                  {claim.carInfo && (
                    <p className="claim-meta">
                      Car: {claim.carInfo.licensePlate || "N/A"} - {claim.carInfo.color || ""} {claim.carInfo.make || ""} {claim.carInfo.model || ""}
                    </p>
                  )}
                </div>
                <div className="claim-status-badge" data-status={claim.status}>
                  {claim.status}
                </div>
              </div>

              <div className="claim-ratings">
                <div className="claim-rating">
                  <span>Driver Rating:</span>
                  <span className="claim-rating-stars">
                    {"⭐".repeat(claim.driverRating || 0)}
                    {"☆".repeat(5 - (claim.driverRating || 0))}
                  </span>
                </div>
                <div className="claim-rating">
                  <span>Company Rating:</span>
                  <span className="claim-rating-stars">
                    {"⭐".repeat(claim.companyRating || 0)}
                    {"☆".repeat(5 - (claim.companyRating || 0))}
                  </span>
                </div>
              </div>

              <div className="claim-description">
                <h4>Description</h4>
                <p>{claim.description}</p>
              </div>

              {claim.photos && claim.photos.length > 0 && (
                <div className="claim-photos">
                  <h4>Photos ({claim.photos.length})</h4>
                  <div className="claim-photos-grid">
                    {claim.photos.map((photoUrl, index) => (
                      <img
                        key={index}
                        src={photoUrl}
                        alt={`Claim photo ${index + 1}`}
                        className="claim-photo"
                        onClick={() => window.open(photoUrl, "_blank")}
                      />
                    ))}
                  </div>
                </div>
              )}

              {claim.video && (
                <div className="claim-video">
                  <h4>Video</h4>
                  <video src={claim.video} controls className="claim-video-player" />
                </div>
              )}

              {claim.status === "PENDING" && (
                <div className="claim-actions">
                  <button
                    className="claim-action-btn claim-action-reviewing"
                    onClick={() => updateClaimStatus(claim.id, "REVIEWING")}
                  >
                    Mark as Reviewing
                  </button>
                  <button
                    className="claim-action-btn claim-action-resolved"
                    onClick={() => updateClaimStatus(claim.id, "RESOLVED")}
                  >
                    Mark as Resolved
                  </button>
                  <button
                    className="claim-action-btn claim-action-rejected"
                    onClick={() => updateClaimStatus(claim.id, "REJECTED")}
                  >
                    Reject
                  </button>
                </div>
              )}

              {claim.status === "REVIEWING" && (
                <div className="claim-actions">
                  <button
                    className="claim-action-btn claim-action-resolved"
                    onClick={() => updateClaimStatus(claim.id, "RESOLVED")}
                  >
                    Mark as Resolved
                  </button>
                  <button
                    className="claim-action-btn claim-action-rejected"
                    onClick={() => updateClaimStatus(claim.id, "REJECTED")}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}








