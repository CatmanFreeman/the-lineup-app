// src/pages/Dashboards/RestaurantDashboard/tabs/VerificationsTab.jsx
//
// VERIFICATIONS TAB - Restaurant Dashboard
//
// Allows restaurant managers/admins to view and approve/reject employment verification requests

import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { collection, query, where, getDocs, orderBy, doc, getDoc } from "firebase/firestore";
import { db } from "../../../../hooks/services/firebase";
import { useAuth } from "../../../../context/AuthContext";
import { approveEmploymentVerification, rejectEmploymentVerification } from "../../../../utils/employmentVerificationService";
import "./VerificationsTab.css";

export default function VerificationsTab() {
  const { restaurantId } = useParams();
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({});

  useEffect(() => {
    if (restaurantId) {
      loadVerificationRequests();
    }
  }, [restaurantId]);

  const loadVerificationRequests = async () => {
    try {
      setLoading(true);
      const requestsRef = collection(db, "employmentVerificationRequests");
      
      // Get requests for this restaurant
      const restaurantQuery = query(
        requestsRef,
        where("restaurantId", "==", restaurantId),
        where("status", "==", "pending"),
        orderBy("requestedAt", "desc")
      );
      
      const restaurantSnap = await getDocs(restaurantQuery);
      const restaurantRequests = restaurantSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Also get requests by restaurant name (for cases where restaurantId might not match)
      const nameQuery = query(
        requestsRef,
        where("restaurantName", "==", restaurantId), // Fallback: try matching by name
        where("status", "==", "pending"),
        orderBy("requestedAt", "desc")
      );
      
      const nameSnap = await getDocs(nameQuery);
      const nameRequests = nameSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(req => !restaurantRequests.find(r => r.id === req.id));

      setRequests([...restaurantRequests, ...nameRequests]);
    } catch (error) {
      console.error("Error loading verification requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId, requestData) => {
    if (!window.confirm(`Approve employment verification for ${requestData.employeeName}?`)) {
      return;
    }

    setProcessing({ ...processing, [requestId]: "approving" });

    try {
      // Get current user ID from auth context
      const verifiedBy = currentUser?.uid || "system";
      
      const result = await approveEmploymentVerification({
        requestId,
        verifiedBy,
      });

      if (result.success) {
        alert("Employment verification approved!");
        await loadVerificationRequests();
      } else {
        alert(result.message || "Failed to approve verification");
      }
    } catch (error) {
      console.error("Error approving verification:", error);
      alert("An error occurred while approving verification");
    } finally {
      setProcessing({ ...processing, [requestId]: null });
    }
  };

  const handleReject = async (requestId, requestData) => {
    const reason = prompt(`Reject employment verification for ${requestData.employeeName}?\n\nOptional reason:`);
    if (reason === null) return; // User cancelled

    setProcessing({ ...processing, [requestId]: "rejecting" });

    try {
      // Get current user ID from auth context
      const rejectedBy = currentUser?.uid || "system";
      
      const result = await rejectEmploymentVerification({
        requestId,
        rejectedBy,
        reason: reason || null,
      });

      if (result.success) {
        alert("Employment verification rejected");
        await loadVerificationRequests();
      } else {
        alert(result.message || "Failed to reject verification");
      }
    } catch (error) {
      console.error("Error rejecting verification:", error);
      alert("An error occurred while rejecting verification");
    } finally {
      setProcessing({ ...processing, [requestId]: null });
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Present";
    try {
      const date = dateString?.toDate?.() || new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const formatDateRange = (startDate, endDate) => {
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  };

  if (loading) {
    return (
      <div className="verifications-container">
        <div className="verifications-loading">Loading verification requests...</div>
      </div>
    );
  }

  return (
    <div className="verifications-container">
      <div className="verifications-header">
        <h2>Employment Verification Requests</h2>
        <p className="verifications-subtitle">
          Review and verify employment history for employees who worked at this restaurant
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="verifications-empty">
          <p>No pending verification requests</p>
          <p className="verifications-empty-subtitle">
            Employees can request verification of their past employment, and requests will appear here.
          </p>
        </div>
      ) : (
        <div className="verifications-list">
          {requests.map((request) => {
            const isProcessing = processing[request.id];
            const requestedDate = request.requestedAt?.toDate?.() || new Date();

            return (
              <div key={request.id} className="verification-request-card">
                <div className="verification-request-header">
                  <div className="verification-request-info">
                    <h3>{request.employeeName}</h3>
                    <p className="verification-request-meta">
                      Requested {requestedDate.toLocaleDateString()} at {requestedDate.toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="verification-request-status">
                    <span className="status-badge status-pending">Pending</span>
                  </div>
                </div>

                <div className="verification-request-details">
                  <div className="verification-detail-row">
                    <span className="verification-label">Position:</span>
                    <span className="verification-value">{request.position}</span>
                  </div>
                  <div className="verification-detail-row">
                    <span className="verification-label">Employment Period:</span>
                    <span className="verification-value">
                      {formatDateRange(request.startDate, request.endDate)}
                    </span>
                  </div>
                  <div className="verification-detail-row">
                    <span className="verification-label">Restaurant:</span>
                    <span className="verification-value">{request.restaurantName}</span>
                  </div>
                </div>

                <div className="verification-request-actions">
                  <button
                    className="verification-btn verification-btn-approve"
                    onClick={() => handleApprove(request.id, request)}
                    disabled={!!isProcessing}
                  >
                    {isProcessing === "approving" ? "Approving..." : "✓ Approve"}
                  </button>
                  <button
                    className="verification-btn verification-btn-reject"
                    onClick={() => handleReject(request.id, request)}
                    disabled={!!isProcessing}
                  >
                    {isProcessing === "rejecting" ? "Rejecting..." : "✗ Reject"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

