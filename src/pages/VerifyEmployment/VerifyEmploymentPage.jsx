// src/pages/VerifyEmployment/VerifyEmploymentPage.jsx
//
// PUBLIC VERIFICATION PAGE
//
// Allows off-app restaurants to verify employment via a public link
// Accessed via: /verify-employment?requestId={requestId}

import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../hooks/services/firebase";
import { approveEmploymentVerification, rejectEmploymentVerification } from "../../utils/employmentVerificationService";
import "./VerifyEmploymentPage.css";

export default function VerifyEmploymentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestId = searchParams.get("requestId");

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null); // "approved" | "rejected" | null

  useEffect(() => {
    if (requestId) {
      loadVerificationRequest();
    } else {
      setLoading(false);
    }
  }, [requestId]);

  const loadVerificationRequest = async () => {
    try {
      setLoading(true);
      const requestRef = doc(db, "employmentVerificationRequests", requestId);
      const requestSnap = await getDoc(requestRef);

      if (!requestSnap.exists()) {
        setRequest(null);
        return;
      }

      const requestData = requestSnap.data();
      
      // Check if already processed
      if (requestData.status !== "pending") {
        setResult(requestData.status);
      }

      setRequest({
        id: requestSnap.id,
        ...requestData,
      });
    } catch (error) {
      console.error("Error loading verification request:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!window.confirm(`Approve employment verification for ${request.employeeName}?`)) {
      return;
    }

    setProcessing(true);

    try {
      const result = await approveEmploymentVerification({
        requestId: request.id,
        verifiedBy: "public_link", // Indicates verified via public link
      });

      if (result.success) {
        setResult("approved");
        // Update request status
        const requestRef = doc(db, "employmentVerificationRequests", request.id);
        await updateDoc(requestRef, {
          verifiedViaPublicLink: true,
          verifiedAt: serverTimestamp(),
        });
      } else {
        alert(result.message || "Failed to approve verification");
      }
    } catch (error) {
      console.error("Error approving verification:", error);
      alert("An error occurred while approving verification");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    const reason = prompt(`Reject employment verification for ${request.employeeName}?\n\nOptional reason:`);
    if (reason === null) return; // User cancelled

    setProcessing(true);

    try {
      const result = await rejectEmploymentVerification({
        requestId: request.id,
        rejectedBy: "public_link",
        reason: reason || null,
      });

      if (result.success) {
        setResult("rejected");
      } else {
        alert(result.message || "Failed to reject verification");
      }
    } catch (error) {
      console.error("Error rejecting verification:", error);
      alert("An error occurred while rejecting verification");
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Present";
    try {
      const date = dateString?.toDate?.() || new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="verify-employment-page">
        <div className="verify-container">
          <div className="verify-loading">Loading verification request...</div>
        </div>
      </div>
    );
  }

  if (!requestId || !request) {
    return (
      <div className="verify-employment-page">
        <div className="verify-container">
          <div className="verify-error">
            <h2>Verification Request Not Found</h2>
            <p>The verification link is invalid or has expired.</p>
            <button onClick={() => navigate("/")} className="verify-btn verify-btn-primary">
              Go to Homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (result === "approved") {
    return (
      <div className="verify-employment-page">
        <div className="verify-container">
          <div className="verify-success">
            <div className="verify-success-icon">✓</div>
            <h2>Employment Verified</h2>
            <p>You have successfully verified {request.employeeName}'s employment at {request.restaurantName}.</p>
            <p className="verify-success-note">
              Thank you for helping build trusted resumes in the service industry!
            </p>
            <button onClick={() => navigate("/")} className="verify-btn verify-btn-primary">
              Continue to The Lineup
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (result === "rejected") {
    return (
      <div className="verify-employment-page">
        <div className="verify-container">
          <div className="verify-rejected">
            <div className="verify-rejected-icon">✗</div>
            <h2>Verification Rejected</h2>
            <p>You have rejected the employment verification request.</p>
            <button onClick={() => navigate("/")} className="verify-btn verify-btn-primary">
              Continue to The Lineup
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="verify-employment-page">
      <div className="verify-container">
        <div className="verify-header">
          <h1>The Lineup</h1>
          <h2>Employment Verification Request</h2>
        </div>

        <div className="verify-content">
          <p className="verify-intro">
            <strong>{request.employeeName}</strong> has requested verification of their employment at your restaurant.
          </p>

          <div className="verify-details">
            <div className="verify-detail-row">
              <span className="verify-label">Employee Name:</span>
              <span className="verify-value">{request.employeeName}</span>
            </div>
            <div className="verify-detail-row">
              <span className="verify-label">Position:</span>
              <span className="verify-value">{request.position}</span>
            </div>
            <div className="verify-detail-row">
              <span className="verify-label">Restaurant:</span>
              <span className="verify-value">{request.restaurantName}</span>
            </div>
            <div className="verify-detail-row">
              <span className="verify-label">Employment Period:</span>
              <span className="verify-value">
                {formatDate(request.startDate)} - {formatDate(request.endDate)}
              </span>
            </div>
          </div>

          <div className="verify-info-box">
            <h3>Why Verify?</h3>
            <p>
              Verified employment helps employees build trusted resumes and helps restaurants attract quality talent. 
              This is a one-click process that takes less than 10 seconds.
            </p>
          </div>

          <div className="verify-actions">
            <button
              className="verify-btn verify-btn-approve"
              onClick={handleApprove}
              disabled={processing}
            >
              {processing ? "Processing..." : "✓ Approve Verification"}
            </button>
            <button
              className="verify-btn verify-btn-reject"
              onClick={handleReject}
              disabled={processing}
            >
              {processing ? "Processing..." : "✗ Reject"}
            </button>
          </div>

          <div className="verify-footer">
            <p>
              <strong>Not on The Lineup yet?</strong><br />
              <a href="https://thelineup.app/restaurants/signup" className="verify-link">
                Join The Lineup
              </a> to access our full suite of restaurant management tools, employee scheduling, and more.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

