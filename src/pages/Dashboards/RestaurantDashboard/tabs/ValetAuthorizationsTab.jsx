// src/pages/Dashboards/RestaurantDashboard/tabs/ValetAuthorizationsTab.jsx
//
// VALET AUTHORIZATIONS TAB
//
// Restaurant managers can approve/reject valet company authorization requests
// View authorized valet companies and their activity

import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "../../../../hooks/services/firebase";
import {
  getAuthorizedValetCompanies,
  applyToRestaurant,
  approveOrRejectApplication,
  VALET_COMPANY_STATUS,
} from "../../../../utils/valetCompanyService";
import { useAuth } from "../../../../context/AuthContext";
import "./ValetAuthorizationsTab.css";

export default function ValetAuthorizationsTab() {
  const { restaurantId } = useParams();
  const { currentUser } = useAuth();
  const [applications, setApplications] = useState([]);
  const [authorizedCompanies, setAuthorizedCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) return;

    loadApplications();
    loadAuthorizedCompanies();

    // Set up real-time listener for applications
    const applicationsRef = collection(db, "restaurants", restaurantId, "valetApplications");
    const unsubscribe = onSnapshot(applicationsRef, (snapshot) => {
      const apps = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setApplications(apps);
      loadAuthorizedCompanies();
    });

    return () => unsubscribe();
  }, [restaurantId]);

  async function loadApplications() {
    try {
      const applicationsRef = collection(db, "restaurants", restaurantId, "valetApplications");
      const snap = await getDocs(applicationsRef);
      setApplications(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("Error loading applications:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadAuthorizedCompanies() {
    try {
      const companies = await getAuthorizedValetCompanies(restaurantId);
      setAuthorizedCompanies(companies);
    } catch (error) {
      console.error("Error loading authorized companies:", error);
    }
  }

  const handleApprove = async (applicationId) => {
    if (!window.confirm("Approve this valet company application?")) return;

    try {
      await approveOrRejectApplication({
        restaurantId,
        applicationId,
        status: VALET_COMPANY_STATUS.APPROVED,
        approvedBy: currentUser.uid,
      });
    } catch (error) {
      console.error("Error approving application:", error);
      alert("Failed to approve application. Please try again.");
    }
  };

  const handleReject = async (applicationId) => {
    if (!window.confirm("Reject this valet company application?")) return;

    try {
      await approveOrRejectApplication({
        restaurantId,
        applicationId,
        status: VALET_COMPANY_STATUS.REJECTED,
        approvedBy: currentUser.uid,
      });
    } catch (error) {
      console.error("Error rejecting application:", error);
      alert("Failed to reject application. Please try again.");
    }
  };

  const pendingApplications = applications.filter(
    (a) => a.status === VALET_COMPANY_STATUS.PENDING
  );

  if (loading) {
    return (
      <div className="valet-auth-tab">
        <div className="valet-auth-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="valet-auth-tab">
      <div className="valet-auth-header">
        <h2>Valet Company Applications</h2>
        <p className="valet-auth-subtitle">
          Valet companies apply to provide services at your restaurant. Review and manage their applications.
        </p>
      </div>

      {/* Pending Applications */}
      {pendingApplications.length > 0 && (
        <div className="valet-auth-section">
          <h3>Pending Applications ({pendingApplications.length})</h3>
          <p className="valet-auth-form-note">
            Valet companies have applied to provide services at your restaurant. Review and approve or reject their applications.
          </p>
          <div className="valet-auth-list">
            {pendingApplications.map((app) => (
              <div key={app.id} className="valet-auth-card">
                <div className="valet-auth-card-header">
                  <div>
                    <h4>Valet Company: {app.valetCompanyId}</h4>
                    <p className="valet-auth-meta">
                      Applied {app.requestedAt?.toDate?.()?.toLocaleDateString() || "recently"}
                    </p>
                  </div>
                  <div className="valet-auth-status-badge valet-auth-status-pending">
                    Pending
                  </div>
                </div>
                <div className="valet-auth-card-actions">
                  <button
                    className="valet-auth-btn valet-auth-btn-success"
                    onClick={() => handleApprove(app.id)}
                  >
                    Approve
                  </button>
                  <button
                    className="valet-auth-btn valet-auth-btn-danger"
                    onClick={() => handleReject(app.id)}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Authorized Companies */}
      <div className="valet-auth-section">
        <h3>Authorized Companies ({authorizedCompanies.length})</h3>
        {authorizedCompanies.length === 0 ? (
          <div className="valet-auth-empty">
            <p>No authorized valet companies</p>
          </div>
        ) : (
          <div className="valet-auth-list">
            {authorizedCompanies.map((company) => (
              <div key={company.id} className="valet-auth-card">
                <div className="valet-auth-card-header">
                  <div>
                    <h4>{company.name}</h4>
                    <p className="valet-auth-meta">
                      Contact: {company.contactName} ({company.contactEmail})
                    </p>
                    <p className="valet-auth-meta">
                      Authorized {company.authorizedAt?.toDate?.()?.toLocaleDateString() || "recently"}
                    </p>
                  </div>
                  <div className="valet-auth-status-badge valet-auth-status-approved">
                    Approved
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

