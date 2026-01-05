import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../hooks/services/firebase";
import { createGamingVenueGroup } from "../../utils/gamingVenueReservationService";
import "./VenueReservationPage.css";

export default function VenueReservationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const restaurantId = searchParams.get("restaurantId");

  const [formData, setFormData] = useState({
    parentName: currentUser?.displayName || "",
    parentPhone: "",
    parentEmail: currentUser?.email || "",
    startTime: new Date().toISOString().slice(0, 16),
    timeLimit: 60,
    members: [{ name: "", phone: "", email: "", userId: null, isParent: false }],
    cardOnFile: false,
    cardLast4: "",
    notes: "",
  });

  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
      return;
    }

    if (!restaurantId) {
      navigate("/reservations");
      return;
    }

    loadRestaurant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, restaurantId, navigate]);

  const loadRestaurant = async () => {
    try {
      const restaurantRef = doc(db, "restaurants", restaurantId);
      const restaurantSnap = await getDoc(restaurantRef);
      if (restaurantSnap.exists()) {
        const data = restaurantSnap.data();
        if (!data.attractions?.gamingVenue) {
          setError("This restaurant does not offer gaming venue services");
        } else {
          setRestaurant({ id: restaurantSnap.id, ...data });
        }
      }
    } catch (error) {
      console.error("Error loading restaurant:", error);
      setError("Failed to load restaurant");
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = () => {
    setFormData({
      ...formData,
      members: [
        ...formData.members,
        { name: "", phone: "", email: "", userId: null, isParent: false },
      ],
    });
  };

  const handleRemoveMember = (index) => {
    const updatedMembers = formData.members.filter((_, i) => i !== index);
    setFormData({ ...formData, members: updatedMembers });
  };

  const handleMemberChange = (index, field, value) => {
    const updatedMembers = [...formData.members];
    updatedMembers[index][field] = value;
    setFormData({ ...formData, members: updatedMembers });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.parentName || !formData.startTime) {
      setError("Please fill in all required fields");
      return;
    }

    try {
      setSubmitting(true);

      const startTime = new Date(formData.startTime);

      const groupId = await createGamingVenueGroup({
        restaurantId,
        parentUserId: currentUser.uid,
        parentName: formData.parentName,
        parentPhone: formData.parentPhone,
        parentEmail: formData.parentEmail,
        startTime,
        timeLimit: formData.timeLimit,
        members: formData.members.filter(m => m.name.trim()),
        cardOnFile: formData.cardOnFile,
        cardLast4: formData.cardLast4,
        notes: formData.notes,
      });

      alert("Gaming venue group created successfully!");
      navigate("/reservations?tab=venues");
    } catch (error) {
      console.error("Error creating venue group:", error);
      setError(error.message || "Failed to create group. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="venue-reservation-page">
        <div className="venue-reservation-loading">Loading...</div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="venue-reservation-page">
        <div className="venue-reservation-error">{error || "Restaurant not found"}</div>
      </div>
    );
  }

  return (
    <div className="venue-reservation-page">
      <div className="venue-reservation-container">
        <div className="venue-reservation-header">
          <h1>Gaming Venue Group Reservation</h1>
          <p className="venue-reservation-subtitle">
            {restaurant.name}
          </p>
          <button className="venue-reservation-back" onClick={() => navigate("/reservations")}>
            ← Back to Reservations
          </button>
        </div>

        {error && <div className="venue-reservation-error">{error}</div>}

        <form onSubmit={handleSubmit} className="venue-reservation-form">
          <div className="form-group">
            <label>Group Leader Name *</label>
            <input
              type="text"
              value={formData.parentName}
              onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Group Leader Phone</label>
            <input
              type="tel"
              value={formData.parentPhone}
              onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Group Leader Email</label>
            <input
              type="email"
              value={formData.parentEmail}
              onChange={(e) => setFormData({ ...formData, parentEmail: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Start Time *</label>
            <input
              type="datetime-local"
              value={formData.startTime}
              onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Time Limit (minutes) *</label>
            <select
              value={formData.timeLimit}
              onChange={(e) => setFormData({ ...formData, timeLimit: parseInt(e.target.value) })}
              required
            >
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
              <option value={180}>3 hours</option>
            </select>
          </div>

          <div className="form-group">
            <label>Group Members</label>
            {formData.members.map((member, index) => (
              <div key={index} className="venue-member-item">
                <div className="venue-member-header">
                  <strong>Member {index + 1}</strong>
                  {formData.members.length > 1 && (
                    <button
                      type="button"
                      className="venue-member-remove"
                      onClick={() => handleRemoveMember(index)}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Name"
                  value={member.name}
                  onChange={(e) => handleMemberChange(index, "name", e.target.value)}
                />
                <input
                  type="tel"
                  placeholder="Phone"
                  value={member.phone}
                  onChange={(e) => handleMemberChange(index, "phone", e.target.value)}
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={member.email}
                  onChange={(e) => handleMemberChange(index, "email", e.target.value)}
                />
              </div>
            ))}
            <button
              type="button"
              className="venue-add-member-btn"
              onClick={handleAddMember}
            >
              + Add Member
            </button>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.cardOnFile}
                onChange={(e) => setFormData({ ...formData, cardOnFile: e.target.checked })}
              />
              Card on file for time extensions
            </label>
            {formData.cardOnFile && (
              <input
                type="text"
                placeholder="Last 4 digits of card"
                value={formData.cardLast4}
                onChange={(e) => setFormData({ ...formData, cardLast4: e.target.value })}
                maxLength={4}
              />
            )}
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div className="venue-reservation-actions">
            <button
              type="button"
              className="venue-reservation-btn-secondary"
              onClick={() => navigate("/reservations")}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="venue-reservation-btn-primary"
              disabled={submitting}
            >
              {submitting ? "Creating..." : "Create Group"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

