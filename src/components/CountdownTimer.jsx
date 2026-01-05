import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getNextReminder } from "../utils/reminderService";
import "./CountdownTimer.css";

export default function CountdownTimer({ title, restaurantId, onClick }) {
  const navigate = useNavigate();
  const params = useParams();
  const actualRestaurantId = restaurantId || params.restaurantId;
  
  const [reminder, setReminder] = useState(null);
  const [minutesUntil, setMinutesUntil] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!actualRestaurantId) {
      setLoading(false);
      return;
    }

    loadNextReminder();
    const interval = setInterval(loadNextReminder, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [actualRestaurantId]);

  useEffect(() => {
    if (!reminder) return;

    const updateCountdown = () => {
      const scheduledAt = reminder.scheduledAtTimestamp?.toDate?.() || new Date(reminder.scheduledAt);
      const now = new Date();
      const diffMs = scheduledAt - now;
      const diffMins = Math.round(diffMs / 60000);
      setMinutesUntil(diffMins);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, [reminder]);

  const loadNextReminder = async () => {
    if (!actualRestaurantId) return;

    try {
      const nextReminder = await getNextReminder(actualRestaurantId);
      setReminder(nextReminder);
    } catch (err) {
      console.error("Error loading next reminder:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/dashboard/restaurant/${actualRestaurantId}?tab=reminders`);
    }
  };

  if (loading) {
    return (
      <div className="countdown-card countdown-card--loading">
        <h3>{title}</h3>
        <p>Loading...</p>
      </div>
    );
  }

  if (!reminder) {
    return (
      <div className="countdown-card countdown-card--empty" onClick={handleClick} style={{ cursor: "pointer" }}>
        <h3>{title}</h3>
        <p>No upcoming reminders</p>
        <p className="countdown-card__link">Click to create one →</p>
      </div>
    );
  }

  const scheduledAt = reminder.scheduledAtTimestamp?.toDate?.() || new Date(reminder.scheduledAt);
  const isPast = minutesUntil !== null && minutesUntil < 0;
  const isSoon = minutesUntil !== null && minutesUntil >= 0 && minutesUntil <= 15;

  return (
    <div
      className={`countdown-card ${isPast ? "countdown-card--past" : ""} ${isSoon ? "countdown-card--soon" : ""}`}
      onClick={handleClick}
      style={{ cursor: "pointer" }}
    >
      <h3>{title}</h3>
      <strong>{reminder.label}</strong>
      <p className={isPast ? "countdown-card__overdue" : ""}>
        {isPast
          ? "Overdue"
          : minutesUntil === 0
          ? "Now"
          : minutesUntil === 1
          ? "in 1 minute"
          : `in ${minutesUntil} minutes`}
      </p>
      <p className="countdown-card__time">
        {scheduledAt.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })}
      </p>
      <p className="countdown-card__link">Click to manage →</p>
    </div>
  );
}
