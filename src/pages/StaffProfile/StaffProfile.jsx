// src/pages/StaffProfile/StaffProfile.jsx

import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../hooks/services/firebase";
import BadgeGallery from "../../components/BadgeGallery";
import { getEmployeeBadges } from "../../utils/badgeService";
import TipShareModal from "../../components/TipShareModal";
import EmploymentHistory from "../../components/EmploymentHistory";
import FavoriteButton from "../../components/FavoriteButton/FavoriteButton";
import "./StaffProfile.css";

// Icons
import reserveIcon from "../../assets/icons/reserve_icon.svg";
import tipshareIcon from "../../assets/icons/icon_tipshare.png";

export default function StaffProfile() {
  const { restaurantId, staffId } = useParams();
  const [staff, setStaff] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [badges, setBadges] = useState([]);
  const [badgesLoading, setBadgesLoading] = useState(true);
  const [showTipShareModal, setShowTipShareModal] = useState(false);
  const [employmentHistory, setEmploymentHistory] = useState(null);

  // Load employee badges
  const loadBadges = useCallback(async (uid) => {
    if (!uid || !restaurantId) return;
    
    setBadgesLoading(true);
    try {
      const employeeBadges = await getEmployeeBadges(uid, restaurantId);
      setBadges(employeeBadges || []);
    } catch (err) {
      console.error("Failed to load badges:", err);
      setBadges([]);
    } finally {
      setBadgesLoading(false);
    }
  }, [restaurantId]);

  // Load staff and restaurant data
  useEffect(() => {
    async function loadData() {
      // Restaurant
      const restRef = doc(db, "restaurants", restaurantId);
      const restSnap = await getDoc(restRef);
      if (restSnap.exists()) setRestaurant(restSnap.data());

      // Staff member
      const staffRef = doc(
        db,
        "restaurants",
        restaurantId,
        "staff",
        staffId
      );
      const staffSnap = await getDoc(staffRef);
      if (staffSnap.exists()) {
        const staffData = { id: staffSnap.id, ...staffSnap.data() };
        setStaff(staffData);
        
        // Load badges for this employee
        if (staffData.uid) {
          loadBadges(staffData.uid);
          
          // Load user profile for employment history
          try {
            const userRef = doc(db, "users", staffData.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const userData = userSnap.data();
              setEmploymentHistory(userData.employment || null);
            }
          } catch (userErr) {
            console.warn("Failed to load user profile:", userErr);
          }
        }
      }
    }

    loadData();
  }, [restaurantId, staffId, loadBadges]);

  if (!staff) return <div className="profile-wrapper">Loading...</div>;

  // MAIN FIX: use imageURL (exact Firestore field) as primary
  const photoSrc =
    staff.imageURL ||
    staff.photoUrl ||
    staff.photoURL ||
    staff.photo ||
    staff.imageUrl ||
    staff.image ||
    staff.avatar ||
    "";

  return (
    <div className="profile-wrapper">
      <div className="profile-inner">
        {/* Staff Photo */}
        {photoSrc && (
          <img src={photoSrc} alt={staff.name} className="profile-photo" />
        )}

        {/* Name */}
        <h1 className="profile-name no-wrap">{staff.name}</h1>

        {/* Position + Rating */}
        <div className="profile-role-rating">
          <span className="profile-role">{staff.subRole || staff.role}</span>
          <span className="profile-rating">
            <span className="star-gold">★</span>
            {staff.rating || "-"}
          </span>
        </div>

        {/* Icons: Tipshare + Reserve (servers only) + Favorite */}
        <div className="profile-icons">
          <img 
            src={tipshareIcon} 
            className="profile-icon profile-icon-clickable" 
            alt="Tip Share"
            onClick={() => {
              if (staff.uid) {
                setShowTipShareModal(true);
              }
            }}
            style={{ cursor: "pointer" }}
          />
          {staff.subRole === "Server" && (
            <img src={reserveIcon} className="profile-icon" alt="Reserve" />
          )}
        </div>
        
        {/* Favorite Button */}
        {staff.uid && (
          <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
            <FavoriteButton
              targetId={staff.uid}
              targetType="staff"
              onFavoriteChange={(isFavorited) => {
                console.log("Staff favorite status changed:", isFavorited);
              }}
            />
          </div>
        )}

        {/* Badges Section */}
        <div className="profile-section">
          <h2 className="section-title">Badges & Achievements</h2>
          {badgesLoading ? (
            <div className="empty-text">Loading badges...</div>
          ) : badges.length === 0 ? (
            <div className="empty-text">No badges yet.</div>
          ) : (
            <BadgeGallery badges={badges} showLabels={true} />
          )}
        </div>

        {/* Employment History */}
        <div className="profile-section">
          <h2 className="section-title">Employment History</h2>
          <EmploymentHistory
            employment={employmentHistory}
            currentRestaurant={restaurant ? { id: restaurantId, name: restaurant.name } : null}
            currentRole={staff.subRole || staff.role}
            viewMode="public"
          />
        </div>

        {/* Customer Photos */}
        <div className="profile-section">
          <h2 className="section-title">Customer Photos</h2>
          <p className="empty-text">No photos yet.</p>
        </div>

        {/* Reviews */}
        <div className="profile-section">
          <h2 className="section-title">Reviews</h2>
          <p className="empty-text">No reviews yet.</p>
        </div>

        {/* Footer Links */}
        <div className="profile-links">
          <Link
            to={`/staff/${restaurantId}/${staffId}/reviews`}
            className="profile-link"
          >
            {staff.name} Reviews
          </Link>
          <Link
            to={`/live-lineup/${restaurantId}`}
            className="profile-link"
          >
            Back to Live Lineup
          </Link>
          <Link to="/" className="profile-link">
            Back to Map
          </Link>
        </div>
      </div>

      {/* TipShare Modal */}
      {showTipShareModal && staff.uid && (
        <TipShareModal
          isOpen={showTipShareModal}
          onClose={() => setShowTipShareModal(false)}
          employeeId={staff.uid}
          employeeName={staff.name}
          restaurantId={restaurantId}
          source="staff_profile"
          sourceId={staff.id}
        />
      )}
    </div>
  );
}