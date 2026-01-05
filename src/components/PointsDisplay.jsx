// src/components/PointsDisplay.jsx

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { getPointsBalance } from "../utils/pointsService";
import "./PointsDisplay.css";

export default function PointsDisplay({
  userId = null,
  showLabel = true,
  size = "normal", // "small" | "normal" | "large"
  onClick = null,
}) {
  const { currentUser } = useAuth();
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  const targetUserId = userId || currentUser?.uid;

  const loadPoints = useCallback(async () => {
    if (!targetUserId) return;

    setLoading(true);
    try {
      const balance = await getPointsBalance(targetUserId);
      setPoints(balance.total || 0);
    } catch (error) {
      console.error("Error loading points:", error);
      setPoints(0);
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    if (!targetUserId) {
      setLoading(false);
      return;
    }

    loadPoints();
  }, [targetUserId, loadPoints]);

  if (loading) {
    return (
      <div className={`points-display points-display-${size}`}>
        <span className="points-loading">...</span>
      </div>
    );
  }

  const formattedPoints = points.toLocaleString();

  return (
    <div
      className={`points-display points-display-${size}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: '#4da3ff',
        backgroundColor: '#4da3ff',
        color: '#ffffff',
        padding: '4px 8px', /* Increased by 10% from 3.08px 6px, with extra horizontal padding for expansion */
        borderRadius: '16px',
        fontWeight: 700,
        whiteSpace: 'nowrap',
        cursor: 'default',
        border: 'none',
        minWidth: 'fit-content',
        width: 'auto' /* Ensure it expands with content */
      }}
    >
      <span 
        className="points-value"
        style={{
          fontSize: '1.1em',
          fontWeight: 700,
          color: '#ffffff',
          textDecoration: 'underline',
          margin: 0,
          padding: 0
        }}
      >
        {formattedPoints}
      </span>
      {showLabel && (
        <span 
          className="points-label"
          style={{
            fontSize: '1em',
            fontWeight: 700,
            color: '#ffffff',
            margin: 0,
            padding: 0
          }}
        >
          Lineup Pts
        </span>
      )}
    </div>
  );
}