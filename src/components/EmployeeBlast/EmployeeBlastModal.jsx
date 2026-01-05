// src/components/EmployeeBlast/EmployeeBlastModal.jsx
//
// EMPLOYEE BLAST MODAL
//
// Modal for employees to create and send blasts when punching in
// - Text blast: "Hey guys, I'm going to work. I'm signing in at work tonight. Come see me."
// - Video blast: 15-second video recorded on phone
// - Shareable to social media

import React, { useState, useRef } from "react";
import { createEmployeeBlast } from "../../utils/employeeBlastService";
import { shareToFacebook, shareToInstagram, shareToTikTok, trackSocialShare } from "../../utils/socialShareService";
import "./EmployeeBlastModal.css";

export default function EmployeeBlastModal({ 
  isOpen, 
  onClose, 
  employeeId, 
  restaurantId, 
  restaurantName,
  employeeName,
  onBlastCreated 
}) {
  const [blastType, setBlastType] = useState("text"); // "text" or "video"
  const [textContent, setTextContent] = useState("Hey guys, I'm going to work. I'm signing in at work tonight. Come see me!");
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [recording, setRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  if (!isOpen) return null;

  const handleVideoFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check video duration
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        const duration = video.duration;
        if (duration > 15) {
          alert("Video must be 15 seconds or less");
          return;
        }
        setVideoFile(file);
        setVideoPreview(URL.createObjectURL(file));
      };
      video.src = URL.createObjectURL(file);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
      });

      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const file = new File([blob], "blast-video.webm", { type: "video/webm" });
        setVideoFile(file);
        setVideoPreview(URL.createObjectURL(blob));
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setRecording(true);

      // Auto-stop after 15 seconds
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          stopRecording();
        }
      }, 15000);
    } catch (error) {
      console.error("Error starting recording:", error);
      alert("Failed to access camera. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setRecording(false);
      
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (blastType === "text" && !textContent.trim()) {
      setError("Please enter a message");
      return;
    }

    if (blastType === "video" && !videoFile) {
      setError("Please record or upload a video");
      return;
    }

    setSubmitting(true);

    try {
      const blastId = await createEmployeeBlast({
        employeeId,
        restaurantId,
        blastType,
        textContent: blastType === "text" ? textContent : null,
        videoFile: blastType === "video" ? videoFile : null,
      });

      if (onBlastCreated) {
        onBlastCreated(blastId);
      }

      // Show success and offer social sharing
      const share = window.confirm(
        "Blast sent to your followers! Would you like to share it on social media?"
      );

      if (share) {
        // Show share options
        const platform = window.prompt(
          "Share on:\n1. Facebook\n2. Instagram\n3. TikTok\n\nEnter 1, 2, or 3:"
        );

        if (platform === "1") {
          shareToFacebook(blastId, textContent, null, restaurantName, employeeName);
          await trackSocialShare(blastId, "facebook");
        } else if (platform === "2") {
          await shareToInstagram(blastId, textContent, null);
          await trackSocialShare(blastId, "instagram");
        } else if (platform === "3") {
          await shareToTikTok(blastId, textContent, null);
          await trackSocialShare(blastId, "tiktok");
        }
      }

      onClose();
    } catch (error) {
      console.error("Error creating blast:", error);
      setError(error.message || "Failed to send blast. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="employee-blast-modal-overlay" onClick={onClose}>
      <div className="employee-blast-modal" onClick={(e) => e.stopPropagation()}>
        <div className="employee-blast-modal-header">
          <h2>Send Blast to Followers</h2>
          <button className="employee-blast-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="employee-blast-form">
          {/* Blast Type Selection */}
          <div className="employee-blast-type-selector">
            <button
              type="button"
              className={`employee-blast-type-btn ${blastType === "text" ? "active" : ""}`}
              onClick={() => setBlastType("text")}
            >
              📝 Text
            </button>
            <button
              type="button"
              className={`employee-blast-type-btn ${blastType === "video" ? "active" : ""}`}
              onClick={() => setBlastType("video")}
            >
              🎥 Video (15s)
            </button>
          </div>

          {/* Text Blast */}
          {blastType === "text" && (
            <div className="employee-blast-text-section">
              <label>Message</label>
              <textarea
                className="employee-blast-text-input"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Hey guys, I'm going to work..."
                rows={4}
                maxLength={500}
              />
              <p className="employee-blast-char-count">
                {textContent.length} / 500 characters
              </p>
            </div>
          )}

          {/* Video Blast */}
          {blastType === "video" && (
            <div className="employee-blast-video-section">
              <label>Video (15 seconds max)</label>
              
              {!videoFile && !recording && (
                <div className="employee-blast-video-options">
                  <button
                    type="button"
                    className="employee-blast-record-btn"
                    onClick={startRecording}
                  >
                    🎥 Record Video
                  </button>
                  <label className="employee-blast-upload-btn">
                    📤 Upload Video
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleVideoFileSelect}
                      style={{ display: "none" }}
                    />
                  </label>
                </div>
              )}

              {recording && (
                <div className="employee-blast-recording">
                  <video
                    ref={videoRef}
                    className="employee-blast-preview-video"
                    autoPlay
                    muted
                    playsInline
                  />
                  <button
                    type="button"
                    className="employee-blast-stop-btn"
                    onClick={stopRecording}
                  >
                    ⏹ Stop Recording
                  </button>
                </div>
              )}

              {videoPreview && !recording && (
                <div className="employee-blast-video-preview">
                  <video src={videoPreview} controls className="employee-blast-preview-video" />
                  <button
                    type="button"
                    className="employee-blast-remove-video"
                    onClick={() => {
                      setVideoFile(null);
                      setVideoPreview(null);
                    }}
                  >
                    Remove Video
                  </button>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="employee-blast-error">{error}</div>
          )}

          <div className="employee-blast-modal-actions">
            <button
              type="button"
              className="employee-blast-cancel-btn"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="employee-blast-submit-btn"
              disabled={submitting}
            >
              {submitting ? "Sending..." : "Send Blast"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}








