// src/pages/LiveLineup/LiveLineup.jsx

import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../../hooks/services/firebase";
import TipShareModal from "../../components/TipShareModal";
import "./LiveLineup.css";

// Icons
import reserveIcon from "../../assets/icons/reserve_icon.svg";
import tipshareIcon from "../../assets/icons/icon_tipshare.png";

export default function LiveLineup() {
  const { restaurantId } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [staff, setStaff] = useState([]);
  const [tipShareModal, setTipShareModal] = useState({
    isOpen: false,
    employeeId: null,
    employeeName: null,
  });

  // Very simple shift label based on current hour
  const [shiftLabel] = useState(() => {
    const hour = new Date().getHours();
    if (hour < 11) return "Breakfast / Brunch";
    if (hour < 16) return "Lunch";
    return "Dinner";
  });

  useEffect(() => {
    async function loadData() {
      // Restaurant document
      const restRef = doc(db, "restaurants", restaurantId);
      const restSnap = await getDoc(restRef);
      if (restSnap.exists()) {
        setRestaurant(restSnap.data());
      }

      // Staff subcollection
      const staffRef = collection(db, "restaurants", restaurantId, "staff");
      const staffSnap = await getDocs(staffRef);
      const staffList = [];

      staffSnap.forEach((docSnap) => {
        staffList.push({ id: docSnap.id, ...docSnap.data() });
      });

      // FOH first, then BOH
      const sorted = [
        ...staffList.filter((s) => s.role === "Front of House"),
        ...staffList.filter((s) => s.role === "Back of House"),
      ];

      setStaff(sorted);
    }

    loadData();
  }, [restaurantId]);

  if (!restaurant) return <div className="live-wrapper">Loading...</div>;

  return (
    <div className="live-wrapper">
      <div className="live-inner">

        {/* HEADER */}
        <div className="live-header">

          {/* LOGO – use Firestore field imageURL */}
          {restaurant.imageURL && (
            <img
              src={restaurant.imageURL}
              alt="Restaurant Logo"
              className="live-logo"
            />
          )}

          <div className="live-title-block">
            <h1 className="live-title no-wrap">{restaurant.name}</h1>

            <div className="live-rating-line">
              <span className="star-gold">★</span>
              <span className="live-rating-value">
                {restaurant.avgRating || "-"}
              </span>
              <span className="live-subtitle">
                {" "}Live Lineup — {shiftLabel}
              </span>
            </div>
          </div>
        </div>

        {/* FRONT OF HOUSE */}
        <div className="staff-section">
          <h2 className="section-title">Front of House</h2>

          {staff
            .filter((s) => s.role === "Front of House")
            .map((s) => (
              <div className="staff-row" key={s.id}>

                {/* Position */}
                <div className="staff-position">{s.subRole}</div>

                {/* Icons: Tip$ + Reserve slot */}
                <div className="staff-icons">
                  <img
                    src={tipshareIcon}
                    className="staff-icon staff-icon-clickable"
                    alt="Tip Share"
                    onClick={() => {
                      if (s.uid) {
                        setTipShareModal({
                          isOpen: true,
                          employeeId: s.uid,
                          employeeName: s.name,
                        });
                      }
                    }}
                    style={{ cursor: "pointer" }}
                  />
                  <div className="reserve-slot">
                    {s.subRole === "Server" && (
                      <img
                        src={reserveIcon}
                        className="staff-icon"
                        alt="Reserve"
                      />
                    )}
                  </div>
                </div>

                {/* Name */}
                <div className="staff-name">
                  <Link to={`/staff/${restaurantId}/${s.id}`}>
                    {s.name}
                  </Link>
                </div>

                {/* Rating */}
                <div className="staff-rating">
                  <span className="star-gold">★</span>
                  {s.rating || "-"}
                </div>

                {/* Reviews */}
                <Link
                  to={`/staff/${restaurantId}/${s.id}`}
                  className="reviews-link"
                >
                  Reviews
                </Link>
              </div>
            ))}
        </div>

        {/* BACK OF HOUSE */}
        <div className="staff-section">
          <h2 className="section-title">Back of House</h2>

          {staff
            .filter((s) => s.role === "Back of House")
            .map((s) => (
              <div className="staff-row" key={s.id}>
                <div className="staff-position">{s.subRole}</div>

                <div className="staff-icons">
                  <img
                    src={tipshareIcon}
                    className="staff-icon staff-icon-clickable"
                    alt="Tip Share"
                    onClick={() => {
                      if (s.uid) {
                        setTipShareModal({
                          isOpen: true,
                          employeeId: s.uid,
                          employeeName: s.name,
                        });
                      }
                    }}
                    style={{ cursor: "pointer" }}
                  />
                  {/* Empty reserve slot to keep columns aligned */}
                  <div className="reserve-slot" />
                </div>

                <div className="staff-name">
                  <Link to={`/staff/${restaurantId}/${s.id}`}>
                    {s.name}
                  </Link>
                </div>

                <div className="staff-rating">
                  <span className="star-gold">★</span>
                  {s.rating || "-"}
                </div>

                <Link
                  to={`/staff/${restaurantId}/${s.id}`}
                  className="reviews-link"
                >
                  Reviews
                </Link>
              </div>
            ))}
        </div>

        {/* Back link */}
        <div className="back-links">
          <Link to="/">Back to Map</Link>
        </div>

      </div>

      {/* TipShare Modal */}
      {tipShareModal.isOpen && tipShareModal.employeeId && (
        <TipShareModal
          isOpen={tipShareModal.isOpen}
          onClose={() => setTipShareModal({ isOpen: false, employeeId: null, employeeName: null })}
          employeeId={tipShareModal.employeeId}
          employeeName={tipShareModal.employeeName}
          restaurantId={restaurantId}
          source="live_lineup"
        />
      )}
    </div>
  );
}