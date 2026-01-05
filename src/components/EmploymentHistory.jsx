// src/components/EmploymentHistory.jsx

import React, { useState } from "react";
import "./EmploymentHistory.css";
import { requestEmploymentVerification } from "../utils/employmentVerificationService";

/**
 * EmploymentHistory Component
 * Displays employee's work history in a resume-like format
 * 
 * Data structure expected:
 * - employment.currentJob: { restaurant, position, startDate, restaurantId? }
 * - employment.pastJobs: [{ restaurant, position, startDate, endDate }]
 * - currentRestaurant: { name, id } (optional - from current restaurant context)
 */
export default function EmploymentHistory({
  employment,
  currentRestaurant = null,
  currentRole = null,
  viewMode = "public", // "public" or "resume"
  employeeUid = null, // Required for verification requests
  employeeName = null, // Required for verification requests
}) {
  const [verificationRequests, setVerificationRequests] = useState({}); // Track pending requests
  const [loading, setLoading] = useState({});
  if (!employment && !currentRestaurant) {
    return (
      <div className="eh-container">
        <div className="eh-empty">No employment history available</div>
      </div>
    );
  }

  // Build complete employment list, separating vetted and unvetted
  const vettedJobs = [];
  const unvettedJobs = [];

  // Helper to add job to appropriate list
  const addJob = (job, isVetted = false) => {
    const jobEntry = {
      ...job,
      isCurrent: job.isCurrent || false,
    };
    if (isVetted) {
      vettedJobs.push(jobEntry);
    } else {
      unvettedJobs.push(jobEntry);
    }
  };

  // Add current restaurant if provided (most recent) - this is vetted if they're actively working
  if (currentRestaurant && currentRole) {
    // Check if this is a vetted entry (from system tracking)
    const isVetted = employment?.vettedJobs?.some(
      (vj) => vj.restaurantId === currentRestaurant.id && !vj.endDate
    );
    addJob({
      restaurant: currentRestaurant.name || currentRestaurant,
      restaurantId: currentRestaurant.id || currentRestaurant,
      position: currentRole,
      startDate: null, // Will be calculated from staff document if available
      endDate: null,
      isCurrent: true,
    }, isVetted);
  }

  // Add vetted jobs (system-tracked employment)
  if (employment?.vettedJobs && Array.isArray(employment.vettedJobs)) {
    employment.vettedJobs.forEach((job) => {
      if (job.restaurant || job.restaurantId) {
        const isCurrent = !job.endDate;
        // Skip if it's the same as current restaurant (already added above)
        if (currentRestaurant && 
            (job.restaurantId === currentRestaurant.id || 
             job.restaurant === currentRestaurant.name)) {
          return;
        }
        addJob({
          restaurant: job.restaurant || job.restaurantName,
          restaurantId: job.restaurantId,
          position: job.position || job.role,
          startDate: job.startDate,
          endDate: job.endDate,
          isCurrent,
        }, true);
      }
    });
  }

  // Add unvetted current job (user-entered)
  if (employment?.currentJob?.restaurant && !employment.currentJob.vetted) {
    const isDuplicate = currentRestaurant && 
      (employment.currentJob.restaurant === currentRestaurant.name ||
       employment.currentJob.restaurantId === currentRestaurant.id);
    
    if (!isDuplicate) {
      addJob({
        ...employment.currentJob,
        isCurrent: true,
      }, false);
    }
  }

  // Add unvetted past jobs (user-entered)
  if (employment?.pastJobs && Array.isArray(employment.pastJobs)) {
    employment.pastJobs.forEach((job) => {
      if (job.restaurant && !job.vetted) {
        addJob({
          ...job,
          isCurrent: false,
        }, false);
      }
    });
  }

  // Sort both lists by date (most recent first)
  const sortJobs = (jobs) => {
    return jobs.sort((a, b) => {
      const aDate = a.endDate || a.startDate || "9999-12-31";
      const bDate = b.endDate || b.startDate || "9999-12-31";
      return bDate.localeCompare(aDate);
    });
  };
  
  sortJobs(vettedJobs);
  sortJobs(unvettedJobs);

  const formatDate = (dateString) => {
    if (!dateString) return "Present";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const calculateDuration = (startDate, endDate) => {
    if (!startDate) return "";
    try {
      const start = new Date(startDate);
      const end = endDate ? new Date(endDate) : new Date();
      const months = (end.getFullYear() - start.getFullYear()) * 12 + 
                     (end.getMonth() - start.getMonth());
      
      if (months < 12) {
        return `${months} month${months !== 1 ? "s" : ""}`;
      } else {
        const years = Math.floor(months / 12);
        const remainingMonths = months % 12;
        if (remainingMonths === 0) {
          return `${years} year${years !== 1 ? "s" : ""}`;
        }
        return `${years} year${years !== 1 ? "s" : ""}, ${remainingMonths} month${remainingMonths !== 1 ? "s" : ""}`;
      }
    } catch {
      return "";
    }
  };

  const handleRequestVerification = async (job, jobIndex) => {
    if (!employeeUid || !employeeName) {
      alert("Unable to request verification: Employee information missing");
      return;
    }

    const jobKey = `${job.restaurant}-${jobIndex}`;
    setLoading({ ...loading, [jobKey]: true });

    try {
      const result = await requestEmploymentVerification({
        employeeUid,
        employeeName,
        restaurantName: job.restaurant,
        restaurantId: job.restaurantId,
        position: job.position,
        startDate: job.startDate,
        endDate: job.endDate,
      });

      if (result.success) {
        setVerificationRequests({ ...verificationRequests, [jobKey]: "pending" });
        alert(result.message || "Verification request sent successfully!");
      } else {
        alert(result.message || "Failed to send verification request");
      }
    } catch (error) {
      console.error("Error requesting verification:", error);
      alert("An error occurred while requesting verification");
    } finally {
      setLoading({ ...loading, [jobKey]: false });
    }
  };

  const renderJobList = (jobs, isVetted) => {
    if (jobs.length === 0) return null;

    return (
      <div className="eh-jobs-section">
        <div className="eh-section-header">
          <h4 className="eh-section-title">
            {isVetted ? "Verified Employment" : "Employment History"}
          </h4>
          {isVetted && (
            <span className="eh-vetted-badge" title="This employment has been verified by the system">
              ✓ Verified
            </span>
          )}
          {!isVetted && viewMode === "resume" && (
            <span className="eh-unvetted-note" title="This information was provided by you and has not been verified">
              Self-reported
            </span>
          )}
        </div>
        <div className="eh-jobs-list">
          {jobs.map((job, idx) => {
            const duration = calculateDuration(job.startDate, job.endDate);
            const jobKey = `${job.restaurant}-${idx}`;
            const isRequestPending = verificationRequests[jobKey] === "pending";
            const isLoading = loading[jobKey];
            
            return (
              <div key={idx} className={`eh-job-item ${job.isCurrent ? "eh-job-current" : ""} ${isVetted ? "eh-job-vetted" : ""}`}>
                <div className="eh-job-header">
                  <div className="eh-job-main">
                    <div className="eh-job-restaurant">{job.restaurant}</div>
                    <div className="eh-job-position">{job.position}</div>
                  </div>
                  <div className="eh-job-badges">
                    {job.isCurrent && (
                      <span className="eh-current-badge">Current</span>
                    )}
                  </div>
                </div>
                <div className="eh-job-dates">
                  <span className="eh-date-range">
                    {formatDate(job.startDate)} - {formatDate(job.endDate)}
                  </span>
                  {duration && (
                    <span className="eh-duration">• {duration}</span>
                  )}
                </div>
                {/* Verification Request Button (only for unvetted jobs in resume mode) */}
                {!isVetted && viewMode === "resume" && employeeUid && (
                  <div className="eh-verification-request">
                    {isRequestPending ? (
                      <span className="eh-verification-pending">
                        ✓ Verification Request Sent
                      </span>
                    ) : (
                      <div className="eh-verification-options">
                        <label className="eh-verification-checkbox">
                          <input
                            type="checkbox"
                            checked={false}
                            onChange={() => handleRequestVerification(job, idx)}
                            disabled={isLoading}
                          />
                          <span>Request Verification</span>
                        </label>
                        {isLoading && <span className="eh-loading">Sending...</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const hasAnyJobs = vettedJobs.length > 0 || unvettedJobs.length > 0;

  return (
    <div className="eh-container">
      <div className="eh-header">
        <h3 className="eh-title">Employment History</h3>
        {viewMode === "resume" && (
          <span className="eh-subtitle">Your Service Industry Resume</span>
        )}
      </div>

      {!hasAnyJobs ? (
        <div className="eh-empty">No employment history to display</div>
      ) : (
        <>
          {/* Vetted jobs first (system-verified) */}
          {renderJobList(vettedJobs, true)}
          
          {/* Unvetted jobs (user-entered) */}
          {renderJobList(unvettedJobs, false)}
        </>
      )}
    </div>
  );
}