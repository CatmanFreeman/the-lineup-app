// src/pages/Dashboards/RestaurantDashboard/tabs/RemindersTab.jsx

import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../../../context/AuthContext";
import {
  getReminders,
  createReminder,
  updateReminder,
  deleteReminder,
  completeReminder,
} from "../../../../utils/reminderService";
import "./RemindersTab.css";

export default function RemindersTab() {
  const { restaurantId } = useParams();
  const { currentUser } = useAuth();
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingReminder, setEditingReminder] = useState(null);
  
  // Form state
  const [formLabel, setFormLabel] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formTime, setFormTime] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    loadReminders();
  }, [restaurantId, showCompleted]);

  const loadReminders = async () => {
    if (!restaurantId) return;

    setLoading(true);
    try {
      const allReminders = await getReminders(restaurantId, {
        includeCompleted: showCompleted,
      });

      // Filter out completed if not showing them
      const filtered = showCompleted
        ? allReminders
        : allReminders.filter((r) => !r.completed);

      setReminders(filtered);
    } catch (err) {
      console.error("Error loading reminders:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReminder = async (e) => {
    e.preventDefault();
    if (!formLabel.trim() || !formDate || !formTime) {
      alert("Please fill in all fields");
      return;
    }

    try {
      const scheduledDateTime = new Date(`${formDate}T${formTime}`);
      
      await createReminder(restaurantId, {
        label: formLabel.trim(),
        scheduledAt: scheduledDateTime,
        createdBy: currentUser?.uid || null,
        createdByName: currentUser?.displayName || "Manager",
      });

      // Reset form
      setFormLabel("");
      setFormDate("");
      setFormTime("");
      setShowCreateForm(false);
      
      await loadReminders();
    } catch (err) {
      console.error("Error creating reminder:", err);
      alert("Failed to create reminder");
    }
  };

  const handleUpdateReminder = async (e) => {
    e.preventDefault();
    if (!editingReminder) return;
    if (!formLabel.trim() || !formDate || !formTime) {
      alert("Please fill in all fields");
      return;
    }

    try {
      const scheduledDateTime = new Date(`${formDate}T${formTime}`);
      
      await updateReminder(restaurantId, editingReminder.id, {
        label: formLabel.trim(),
        scheduledAt: scheduledDateTime,
      });

      setEditingReminder(null);
      setFormLabel("");
      setFormDate("");
      setFormTime("");
      
      await loadReminders();
    } catch (err) {
      console.error("Error updating reminder:", err);
      alert("Failed to update reminder");
    }
  };

  const handleComplete = async (reminderId) => {
    try {
      await completeReminder(restaurantId, reminderId);
      await loadReminders();
    } catch (err) {
      console.error("Error completing reminder:", err);
      alert("Failed to complete reminder");
    }
  };

  const handleDelete = async (reminderId) => {
    if (!window.confirm("Are you sure you want to delete this reminder?")) {
      return;
    }

    try {
      await deleteReminder(restaurantId, reminderId);
      await loadReminders();
    } catch (err) {
      console.error("Error deleting reminder:", err);
      alert("Failed to delete reminder");
    }
  };

  const startEdit = (reminder) => {
    setEditingReminder(reminder);
    setFormLabel(reminder.label);
    
    const scheduledAt = reminder.scheduledAtTimestamp?.toDate?.() || new Date(reminder.scheduledAt);
    setFormDate(scheduledAt.toISOString().split("T")[0]);
    setFormTime(scheduledAt.toTimeString().slice(0, 5));
    setShowCreateForm(true);
  };

  const cancelEdit = () => {
    setEditingReminder(null);
    setFormLabel("");
    setFormDate("");
    setFormTime("");
    setShowCreateForm(false);
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return "—";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getMinutesUntil = (timestamp) => {
    if (!timestamp) return null;
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = date - now;
    const diffMins = Math.round(diffMs / 60000);
    return diffMins;
  };

  // Get today's date for min date
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="reminders-tab">
      <div className="reminders-tab__header">
        <h2>Reminders</h2>
        <div className="reminders-tab__actions">
          <label className="reminders-tab__toggle">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
            />
            Show Completed
          </label>
          <button
            className="reminders-tab__create-btn"
            onClick={() => {
              setEditingReminder(null);
              setFormLabel("");
              setFormDate("");
              setFormTime("");
              setShowCreateForm(true);
            }}
          >
            + New Reminder
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="reminders-tab__form-card">
          <h3>{editingReminder ? "Edit Reminder" : "Create New Reminder"}</h3>
          <form onSubmit={editingReminder ? handleUpdateReminder : handleCreateReminder}>
            <div className="reminders-tab__form-group">
              <label>What needs to be done?</label>
              <input
                type="text"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="e.g., Pre-rush line check, Inventory count, etc."
                required
              />
            </div>
            <div className="reminders-tab__form-row">
              <div className="reminders-tab__form-group">
                <label>Date</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  min={today}
                  required
                />
              </div>
              <div className="reminders-tab__form-group">
                <label>Time</label>
                <input
                  type="time"
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="reminders-tab__form-actions">
              <button type="submit" className="reminders-tab__submit-btn">
                {editingReminder ? "Update" : "Create"} Reminder
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="reminders-tab__cancel-btn"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="reminders-tab__loading">Loading reminders...</div>
      ) : reminders.length === 0 ? (
        <div className="reminders-tab__empty">
          <p>No reminders yet.</p>
          <p>Create your first reminder to get started!</p>
        </div>
      ) : (
        <div className="reminders-tab__list">
          {reminders.map((reminder) => {
            const minutesUntil = getMinutesUntil(reminder.scheduledAtTimestamp || reminder.scheduledAt);
            const isPast = minutesUntil !== null && minutesUntil < 0;
            const isUpcoming = minutesUntil !== null && minutesUntil >= 0 && minutesUntil <= 60;

            return (
              <div
                key={reminder.id}
                className={`reminders-tab__item ${
                  reminder.completed ? "reminders-tab__item--completed" : ""
                } ${isUpcoming ? "reminders-tab__item--upcoming" : ""} ${
                  isPast && !reminder.completed ? "reminders-tab__item--past" : ""
                }`}
              >
                <div className="reminders-tab__item-content">
                  <div className="reminders-tab__item-label">{reminder.label}</div>
                  <div className="reminders-tab__item-time">
                    {formatDateTime(reminder.scheduledAtTimestamp || reminder.scheduledAt)}
                  </div>
                  {minutesUntil !== null && !reminder.completed && (
                    <div className="reminders-tab__item-countdown">
                      {isPast
                        ? "Overdue"
                        : minutesUntil === 0
                        ? "Now"
                        : `${minutesUntil} minute${minutesUntil !== 1 ? "s" : ""} until`}
                    </div>
                  )}
                  {reminder.completed && (
                    <div className="reminders-tab__item-completed">
                      Completed {formatDateTime(reminder.completedAtTimestamp || reminder.completedAt)}
                    </div>
                  )}
                </div>
                {!reminder.completed && (
                  <div className="reminders-tab__item-actions">
                    <button
                      onClick={() => handleComplete(reminder.id)}
                      className="reminders-tab__action-btn reminders-tab__action-btn--complete"
                    >
                      ✓ Complete
                    </button>
                    <button
                      onClick={() => startEdit(reminder)}
                      className="reminders-tab__action-btn reminders-tab__action-btn--edit"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(reminder.id)}
                      className="reminders-tab__action-btn reminders-tab__action-btn--delete"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}








