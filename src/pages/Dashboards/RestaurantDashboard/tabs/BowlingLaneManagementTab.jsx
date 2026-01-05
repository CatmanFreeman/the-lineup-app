// src/pages/Dashboards/RestaurantDashboard/tabs/BowlingLaneManagementTab.jsx
//
// BOWLING LANE MANAGEMENT TAB
//
// Lane management system for bowling alleys to replace existing lane technology
// Manages lane assignments, reservations, and guest management

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../../../hooks/services/firebase";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { scheduleExpirationNotifications, approveReservationExtension, declineReservationExtension } from "../../../../utils/bowlingReservationNotificationService";
import { Timestamp } from "firebase/firestore";
import "./BowlingLaneManagementTab.css";

const LANE_STATUS = {
  AVAILABLE: "available",
  RESERVED: "reserved",
  IN_USE: "in_use",
  MAINTENANCE: "maintenance",
};

export default function BowlingLaneManagementTab() {
  const { restaurantId } = useParams();
  const [lanes, setLanes] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeView, setActiveView] = useState("lanes"); // lanes | reservations | inventory
  const [showLaneForm, setShowLaneForm] = useState(false);
  const [showReservationForm, setShowReservationForm] = useState(false);
  const [selectedLane, setSelectedLane] = useState(null);

  // Form states
  const [laneForm, setLaneForm] = useState({
    laneNumber: "",
    status: LANE_STATUS.AVAILABLE,
    notes: "",
  });

  const [reservationForm, setReservationForm] = useState({
    laneId: "",
    guestName: "",
    guestPhone: "",
    startTime: "",
    startTimeHours: new Date().getHours(),
    startTimeMinutes: new Date().getMinutes(),
    duration: 60, // minutes
    partySize: 2,
    needsShoes: false,
    shoeRentals: [], // Array of {name, size}
    paymentType: "",
    paymentAmount: "",
    paymentProcessed: false, // Whether payment was processed in POS
    paymentReference: "", // POS transaction reference/confirmation number
    isWalkIn: true, // All reservations from restaurant dashboard are walk-ins
    notes: "",
  });
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  // Inventory state
  const [bowlingBalls, setBowlingBalls] = useState([]);
  const [bowlingShoes, setBowlingShoes] = useState([]);
  const [bowlingPins, setBowlingPins] = useState({ total: 0, notes: "" });
  const [showBallForm, setShowBallForm] = useState(false);
  const [showShoeForm, setShowShoeForm] = useState(false);
  const [showPinsForm, setShowPinsForm] = useState(false);
  const [selectedBall, setSelectedBall] = useState(null);
  const [selectedShoe, setSelectedShoe] = useState(null);
  const [ballForm, setBallForm] = useState({
    weight: "",
    condition: "excellent", // excellent, good, fair, poor, needs_replacement
    photo: null,
    photoPreview: null,
    notes: "",
  });
  const [shoeForm, setShoeForm] = useState({
    size: "",
    edition: "",
    condition: "excellent",
    photo: null,
    photoPreview: null,
    notes: "",
  });

  // Load lanes and ensure 12 lanes exist
  const loadLanes = useCallback(async () => {
    if (!restaurantId) return;

    try {
      const lanesRef = collection(db, "restaurants", restaurantId, "bowlingLanes");
      const snap = await getDocs(lanesRef);
      const lanesList = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // Ensure lanes 1-12 exist
      const existingLaneNumbers = new Set(lanesList.map(l => parseInt(l.laneNumber) || 0));
      
      for (let i = 1; i <= 12; i++) {
        if (!existingLaneNumbers.has(i)) {
          // Create missing lane
          const laneRef = doc(db, "restaurants", restaurantId, "bowlingLanes", String(i));
          await setDoc(laneRef, {
            laneNumber: String(i),
            status: LANE_STATUS.AVAILABLE,
            notes: "",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }

      // Reload lanes after ensuring they exist
      const updatedSnap = await getDocs(lanesRef);
      const updatedLanesList = updatedSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // Sort by lane number
      updatedLanesList.sort((a, b) => {
        const numA = parseInt(a.laneNumber) || 0;
        const numB = parseInt(b.laneNumber) || 0;
        return numA - numB;
      });

      setLanes(updatedLanesList);
    } catch (err) {
      console.error("Error loading lanes:", err);
      setError("Failed to load lanes");
    }
  }, [restaurantId]);

  // Load reservations
  const loadReservations = useCallback(async () => {
    if (!restaurantId) return;

    try {
      const reservationsRef = collection(
        db,
        "restaurants",
        restaurantId,
        "bowlingReservations"
      );
      const q = query(reservationsRef, orderBy("startTime", "desc"));
      const snap = await getDocs(q);
      const reservationsList = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        startTime: d.data().startTime?.toDate(),
        endTime: d.data().endTime?.toDate(),
      }));

      setReservations(reservationsList);
    } catch (err) {
      console.error("Error loading reservations:", err);
      setError("Failed to load reservations");
    }
  }, [restaurantId]);

  // Real-time lane updates
  useEffect(() => {
    if (!restaurantId) return;

    const lanesRef = collection(db, "restaurants", restaurantId, "bowlingLanes");
    const unsubscribe = onSnapshot(lanesRef, () => {
      loadLanes();
    });

    return () => unsubscribe();
  }, [restaurantId, loadLanes]);

  // Load bowling inventory
  const loadBowlingInventory = useCallback(async () => {
    if (!restaurantId) return;

    try {
      // Load bowling balls
      const ballsRef = collection(db, "restaurants", restaurantId, "bowlingBalls");
      const ballsSnap = await getDocs(ballsRef);
      const ballsList = ballsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setBowlingBalls(ballsList);

      // Load bowling shoes
      const shoesRef = collection(db, "restaurants", restaurantId, "bowlingShoes");
      const shoesSnap = await getDocs(shoesRef);
      const shoesList = shoesSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setBowlingShoes(shoesList);

      // Load bowling pins count
      const pinsRef = doc(db, "restaurants", restaurantId, "bowlingInventory", "pins");
      const pinsSnap = await getDoc(pinsRef);
      if (pinsSnap.exists()) {
        setBowlingPins(pinsSnap.data());
      } else {
        setBowlingPins({ total: 0, notes: "" });
      }
    } catch (err) {
      console.error("Error loading bowling inventory:", err);
    }
  }, [restaurantId]);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([loadLanes(), loadReservations(), loadBowlingInventory()]);
      setLoading(false);
    };
    loadData();
  }, [loadLanes, loadReservations, loadBowlingInventory]);

  // Create/Update lane
  const saveLane = async () => {
    if (!restaurantId || !laneForm.laneNumber) return;

    try {
      const laneRef = doc(
        db,
        "restaurants",
        restaurantId,
        "bowlingLanes",
        laneForm.laneNumber
      );

      await setDoc(
        laneRef,
        {
          laneNumber: laneForm.laneNumber,
          status: laneForm.status,
          notes: laneForm.notes || "",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setShowLaneForm(false);
      setLaneForm({ laneNumber: "", status: LANE_STATUS.AVAILABLE, notes: "" });
      loadLanes();
    } catch (err) {
      console.error("Error saving lane:", err);
      setError("Failed to save lane");
    }
  };

  // Create reservation
  const createReservation = async () => {
    if (!restaurantId || !reservationForm.laneId) return;

    try {
      // Build start time from hours and minutes
      const now = new Date();
      const startTime = new Date(now);
      startTime.setHours(reservationForm.startTimeHours || now.getHours());
      startTime.setMinutes(reservationForm.startTimeMinutes || now.getMinutes());
      startTime.setSeconds(0);
      startTime.setMilliseconds(0);
      
      const endTime = new Date(startTime.getTime() + reservationForm.duration * 60000);

      const reservationRef = doc(
        collection(db, "restaurants", restaurantId, "bowlingReservations")
      );

      const reservationData = {
        laneId: reservationForm.laneId,
        guestName: reservationForm.guestName,
        guestPhone: reservationForm.guestPhone,
        startTime: Timestamp.fromDate(startTime),
        endTime: Timestamp.fromDate(endTime),
        duration: reservationForm.duration,
        partySize: reservationForm.partySize,
        needsShoes: reservationForm.needsShoes || false,
        shoeRentals: reservationForm.needsShoes ? reservationForm.shoeRentals : [],
        paymentType: reservationForm.paymentType || "",
        paymentAmount: reservationForm.paymentAmount || "",
        paymentProcessed: reservationForm.paymentProcessed || false,
        paymentReference: reservationForm.paymentReference || "",
        isWalkIn: true, // All reservations from restaurant dashboard are walk-ins
        notes: reservationForm.notes || "",
        status: "upcoming",
        type: "bowling",
        parentUserId: reservationForm.parentUserId || null, // Will be set when reservation is made by diner
        siblingUserIds: reservationForm.siblingUserIds || [],
        createdAt: serverTimestamp(),
      };

      await setDoc(reservationRef, reservationData);

      // Schedule expiration notifications if parentUserId is set
      if (reservationData.parentUserId) {
        await scheduleExpirationNotifications(
          reservationRef.id,
          restaurantId,
          Timestamp.fromDate(endTime),
          reservationData.parentUserId,
          reservationData.siblingUserIds
        );
      }

      // Update lane status
      const laneRef = doc(
        db,
        "restaurants",
        restaurantId,
        "bowlingLanes",
        reservationForm.laneId
      );
      await updateDoc(laneRef, {
        status: LANE_STATUS.RESERVED,
        currentReservationId: reservationRef.id,
      });

      setShowReservationForm(false);
      const resetNow = new Date();
      setReservationForm({
        laneId: "",
        guestName: "",
        guestPhone: "",
        startTime: "",
        startTimeHours: resetNow.getHours(),
        startTimeMinutes: resetNow.getMinutes(),
        duration: 60,
        partySize: 2,
        needsShoes: false,
        shoeRentals: [],
        paymentType: "",
        paymentAmount: "",
        paymentProcessed: false,
        paymentReference: "",
        isWalkIn: true,
        notes: "",
      });
      setShowTimePicker(false);
      loadReservations();
      loadLanes();
    } catch (err) {
      console.error("Error creating reservation:", err);
      setError("Failed to create reservation");
    }
  };

  // Check in reservation (start using lane)
  const checkInReservation = async (reservationId) => {
    if (!restaurantId) return;

    try {
      const reservationRef = doc(
        db,
        "restaurants",
        restaurantId,
        "bowlingReservations",
        reservationId
      );
      const reservationSnap = await getDoc(reservationRef);
      const reservationData = reservationSnap.data();
      
      await updateDoc(reservationRef, {
        status: "in_progress",
        checkedInAt: serverTimestamp(),
      });

      // Schedule expiration notifications when reservation becomes active
      if (reservationData.parentUserId && reservationData.endTime) {
        await scheduleExpirationNotifications(
          reservationId,
          restaurantId,
          reservationData.endTime,
          reservationData.parentUserId,
          reservationData.siblingUserIds || []
        );
      }

      // Update lane status
      const foundReservation = reservations.find((r) => r.id === reservationId);
      if (foundReservation) {
        const laneRef = doc(
          db,
          "restaurants",
          restaurantId,
          "bowlingLanes",
          foundReservation.laneId
        );
        await updateDoc(laneRef, {
          status: LANE_STATUS.IN_USE,
        });
      }

      loadReservations();
      loadLanes();
    } catch (err) {
      console.error("Error checking in reservation:", err);
      setError("Failed to check in reservation");
    }
  };

  // Complete reservation
  const completeReservation = async (reservationId) => {
    if (!restaurantId) return;

    try {
      const reservationRef = doc(
        db,
        "restaurants",
        restaurantId,
        "bowlingReservations",
        reservationId
      );
      await updateDoc(reservationRef, {
        status: "completed",
        completedAt: serverTimestamp(),
      });

      // Update lane status
      const reservation = reservations.find((r) => r.id === reservationId);
      if (reservation) {
        const laneRef = doc(
          db,
          "restaurants",
          restaurantId,
          "bowlingLanes",
          reservation.laneId
        );
        await updateDoc(laneRef, {
          status: LANE_STATUS.AVAILABLE,
          currentReservationId: null,
        });
      }

      loadReservations();
      loadLanes();
    } catch (err) {
      console.error("Error completing reservation:", err);
      setError("Failed to complete reservation");
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case LANE_STATUS.AVAILABLE:
        return "#10b981"; // green
      case LANE_STATUS.RESERVED:
        return "#f59e0b"; // amber
      case LANE_STATUS.IN_USE:
        return "#3b82f6"; // blue
      case LANE_STATUS.MAINTENANCE:
        return "#ef4444"; // red
      default:
        return "#6b7280"; // gray
    }
  };

  if (loading) {
    return (
      <div className="bowling-tab">
        <div className="bowling-tab__loading">Loading lane management...</div>
      </div>
    );
  }

  return (
    <div className="bowling-tab">
      <div className="bowling-tab__header">
        <h2>Bowling Lane Management</h2>
        <div className="bowling-tab__actions">
          <button
            type="button"
            className="dashBtn dashBtn--primary"
            onClick={() => {
              setShowLaneForm(true);
              setLaneForm({ laneNumber: "", status: LANE_STATUS.AVAILABLE, notes: "" });
            }}
          >
            + Add Lane
          </button>
          <button
            type="button"
            className="dashBtn dashBtn--primary"
            onClick={() => {
              const now = new Date();
              setShowReservationForm(true);
              setReservationForm({
                laneId: "",
                guestName: "",
                guestPhone: "",
                startTime: "",
                startTimeHours: now.getHours(),
                startTimeMinutes: now.getMinutes(),
                duration: 60,
                partySize: 2,
                needsShoes: false,
                shoeRentals: [],
                paymentType: "",
                paymentAmount: "",
                paymentProcessed: false,
                paymentReference: "",
                isWalkIn: true,
                notes: "",
              });
            }}
          >
            + New Reservation
          </button>
        </div>
      </div>

      {error && <div className="bowling-tab__error">{error}</div>}

      {/* View Tabs */}
      <div className="bowling-tab__nav">
        <button
          type="button"
          className={activeView === "lanes" ? "active" : ""}
          onClick={() => setActiveView("lanes")}
        >
          Lanes
        </button>
        <button
          type="button"
          className={activeView === "reservations" ? "active" : ""}
          onClick={() => setActiveView("reservations")}
        >
          Reservations
        </button>
        <button
          type="button"
          className={activeView === "inventory" ? "active" : ""}
          onClick={() => setActiveView("inventory")}
        >
          Inventory
        </button>
      </div>

      {/* Lanes View */}
      {activeView === "lanes" && (
        <div className="bowling-tab__lanes">
          {lanes.length === 0 ? (
            <div className="bowling-tab__empty">
              <p>No lanes configured. Add your first lane to get started.</p>
            </div>
          ) : (
            <div className="bowling-tab__lanes-grid">
              {lanes.map((lane) => (
                <div key={lane.id} className="bowling-tab__lane-card">
                  <div className="bowling-tab__lane-header">
                    <h3>Lane {lane.laneNumber}</h3>
                    <span
                      className="bowling-tab__lane-status"
                      style={{ backgroundColor: getStatusColor(lane.status) }}
                    >
                      {lane.status.replace("_", " ").toUpperCase()}
                    </span>
                  </div>
                  {lane.notes && (
                    <p className="bowling-tab__lane-notes">{lane.notes}</p>
                  )}
                  {lane.currentReservationId && (
                    <div className="bowling-tab__lane-reservation">
                      <p>Reservation: {lane.currentReservationId}</p>
                    </div>
                  )}
                  <div className="bowling-tab__lane-actions">
                    <button
                      type="button"
                      className="dashBtn dashBtn--small"
                      onClick={() => {
                        setSelectedLane(lane);
                        setLaneForm({
                          laneNumber: lane.laneNumber,
                          status: lane.status,
                          notes: lane.notes || "",
                        });
                        setShowLaneForm(true);
                      }}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reservations View */}
      {activeView === "reservations" && (
        <div className="bowling-tab__reservations">
          {reservations.length === 0 ? (
            <div className="bowling-tab__empty">
              <p>No reservations. Create your first reservation.</p>
            </div>
          ) : (
            <div className="bowling-tab__reservations-list">
              {reservations.map((reservation) => (
                <div key={reservation.id} className="bowling-tab__reservation-card">
                  <div className="bowling-tab__reservation-header">
                    <h3>{reservation.guestName}</h3>
                    <span className="bowling-tab__reservation-status">
                      {reservation.status}
                    </span>
                  </div>
                  <div className="bowling-tab__reservation-details">
                    <p>Lane: {reservation.laneId}</p>
                    <p>Party Size: {reservation.partySize}</p>
                    <p>
                      Time:{" "}
                      {reservation.startTime?.toLocaleTimeString()} -{" "}
                      {reservation.endTime?.toLocaleTimeString()}
                    </p>
                    {reservation.guestPhone && <p>Phone: {reservation.guestPhone}</p>}
                    {reservation.isWalkIn && (
                      <div style={{
                        background: "rgba(59, 130, 246, 0.1)",
                        border: "1px solid rgba(59, 130, 246, 0.3)",
                        borderRadius: "6px",
                        padding: "8px",
                        marginTop: "8px",
                        fontSize: "12px",
                      }}>
                        <strong>Walk-In Booking</strong>
                        {reservation.paymentType && (
                          <p style={{ margin: "4px 0 0 0" }}>
                            Payment: {reservation.paymentType}
                            {reservation.paymentAmount && ` - $${parseFloat(reservation.paymentAmount).toFixed(2)}`}
                            {reservation.paymentProcessed ? (
                              <span style={{ color: "#10b981", marginLeft: "8px" }}>✓ Processed</span>
                            ) : (
                              <span style={{ color: "#f59e0b", marginLeft: "8px" }}>Pending</span>
                            )}
                          </p>
                        )}
                        {reservation.paymentReference && (
                          <p style={{ margin: "4px 0 0 0", fontSize: "11px", opacity: 0.8 }}>
                            POS Ref: {reservation.paymentReference}
                          </p>
                        )}
                      </div>
                    )}
                    {reservation.needsShoes && reservation.shoeRentals && reservation.shoeRentals.length > 0 && (
                      <div className="bowling-tab__shoe-rentals">
                        <p><strong>Shoe Rentals:</strong></p>
                        {reservation.shoeRentals.map((shoe, idx) => (
                          <p key={idx} style={{ marginLeft: "16px", fontSize: "13px" }}>
                            👟 {shoe.name || `Person ${idx + 1}`} - Size {shoe.size || "N/A"}
                          </p>
                        ))}
                      </div>
                    )}
                    {reservation.extensionStatus === "pending" && (
                      <div className="bowling-tab__extension-pending" style={{
                        background: "rgba(245, 158, 11, 0.2)",
                        border: "1px solid rgba(245, 158, 11, 0.4)",
                        borderRadius: "8px",
                        padding: "12px",
                        marginTop: "12px",
                      }}>
                        <p style={{ fontWeight: 600, marginBottom: "8px" }}>Extension Requested</p>
                        <p style={{ fontSize: "13px", marginBottom: "8px" }}>
                          {reservation.extensionMinutes} minutes - Process in POS system
                        </p>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            type="button"
                            className="dashBtn dashBtn--small"
                            style={{ background: "#10b981", color: "#fff" }}
                            onClick={async () => {
                              try {
                                await approveReservationExtension(reservation.id, restaurantId);
                                loadReservations();
                                alert("Extension approved! Notifications sent to guests.");
                              } catch (err) {
                                console.error("Error approving extension:", err);
                                alert("Failed to approve extension");
                              }
                            }}
                          >
                            Approve Extension
                          </button>
                          <button
                            type="button"
                            className="dashBtn dashBtn--small"
                            style={{ background: "#ef4444", color: "#fff" }}
                            onClick={async () => {
                              try {
                                await declineReservationExtension(reservation.id, restaurantId);
                                loadReservations();
                                alert("Extension declined. Guest notified.");
                              } catch (err) {
                                console.error("Error declining extension:", err);
                                alert("Failed to decline extension");
                              }
                            }}
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {reservation.status === "upcoming" && (
                    <button
                      type="button"
                      className="dashBtn dashBtn--small"
                      onClick={() => checkInReservation(reservation.id)}
                    >
                      Check In
                    </button>
                  )}
                  {reservation.status === "in_progress" && (
                    <button
                      type="button"
                      className="dashBtn dashBtn--small"
                      onClick={() => completeReservation(reservation.id)}
                    >
                      Complete
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Inventory View */}
      {activeView === "inventory" && (
        <div className="bowling-tab__inventory">
          {/* Bowling Balls Section */}
          <div className="bowling-inventory-section">
            <div className="bowling-inventory-section-header">
              <h3>Bowling Balls</h3>
              <button
                type="button"
                className="dashBtn dashBtn--primary"
                onClick={() => {
                  setSelectedBall(null);
                  setBallForm({
                    weight: "",
                    condition: "excellent",
                    photo: null,
                    photoPreview: null,
                    notes: "",
                  });
                  setShowBallForm(true);
                }}
              >
                + Add Ball
              </button>
            </div>
            <div className="bowling-inventory-grid">
              {bowlingBalls.length === 0 ? (
                <div className="bowling-tab__empty">
                  <p>No bowling balls tracked. Add your first ball.</p>
                </div>
              ) : (
                bowlingBalls.map((ball) => (
                  <div key={ball.id} className="bowling-inventory-item">
                    {ball.photoURL && (
                      <img src={ball.photoURL} alt={`Ball ${ball.weight}lbs`} className="bowling-inventory-photo" />
                    )}
                    <div className="bowling-inventory-details">
                      <h4>{ball.weight} lbs</h4>
                      <div className={`bowling-condition-badge bowling-condition-${ball.condition}`}>
                        {ball.condition.replace("_", " ").toUpperCase()}
                      </div>
                      {ball.notes && <p className="bowling-inventory-notes">{ball.notes}</p>}
                      {ball.conditionHistory && ball.conditionHistory.length > 0 && (
                        <div className="bowling-condition-history">
                          <p className="bowling-history-label">Condition History:</p>
                          {ball.conditionHistory.slice(-3).map((entry, idx) => (
                            <p key={idx} className="bowling-history-entry">
                              {entry.condition} - {entry.date?.toDate?.()?.toLocaleDateString() || entry.date}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="bowling-inventory-actions">
                      <button
                        type="button"
                        className="dashBtn dashBtn--small"
                        onClick={() => {
                          setSelectedBall(ball);
                          setBallForm({
                            weight: ball.weight || "",
                            condition: ball.condition || "excellent",
                            photo: null,
                            photoPreview: ball.photoURL || null,
                            notes: ball.notes || "",
                          });
                          setShowBallForm(true);
                        }}
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bowling Shoes Section */}
          <div className="bowling-inventory-section">
            <div className="bowling-inventory-section-header">
              <h3>Bowling Shoes</h3>
              <button
                type="button"
                className="dashBtn dashBtn--primary"
                onClick={() => {
                  setSelectedShoe(null);
                  setShoeForm({
                    size: "",
                    edition: "",
                    condition: "excellent",
                    photo: null,
                    photoPreview: null,
                    notes: "",
                  });
                  setShowShoeForm(true);
                }}
              >
                + Add Shoes
              </button>
            </div>
            <div className="bowling-inventory-grid">
              {bowlingShoes.length === 0 ? (
                <div className="bowling-tab__empty">
                  <p>No bowling shoes tracked. Add your first pair.</p>
                </div>
              ) : (
                bowlingShoes.map((shoe) => (
                  <div key={shoe.id} className="bowling-inventory-item">
                    {shoe.photoURL && (
                      <img src={shoe.photoURL} alt={`Shoes Size ${shoe.size}`} className="bowling-inventory-photo" />
                    )}
                    <div className="bowling-inventory-details">
                      <h4>Size {shoe.size}</h4>
                      {shoe.edition && <p className="bowling-shoe-edition">{shoe.edition}</p>}
                      <div className={`bowling-condition-badge bowling-condition-${shoe.condition}`}>
                        {shoe.condition.replace("_", " ").toUpperCase()}
                      </div>
                      {shoe.notes && <p className="bowling-inventory-notes">{shoe.notes}</p>}
                      {shoe.conditionHistory && shoe.conditionHistory.length > 0 && (
                        <div className="bowling-condition-history">
                          <p className="bowling-history-label">Condition History:</p>
                          {shoe.conditionHistory.slice(-3).map((entry, idx) => (
                            <p key={idx} className="bowling-history-entry">
                              {entry.condition} - {entry.date?.toDate?.()?.toLocaleDateString() || entry.date}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="bowling-inventory-actions">
                      <button
                        type="button"
                        className="dashBtn dashBtn--small"
                        onClick={() => {
                          setSelectedShoe(shoe);
                          setShoeForm({
                            size: shoe.size || "",
                            edition: shoe.edition || "",
                            condition: shoe.condition || "excellent",
                            photo: null,
                            photoPreview: shoe.photoURL || null,
                            notes: shoe.notes || "",
                          });
                          setShowShoeForm(true);
                        }}
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bowling Pins Section */}
          <div className="bowling-inventory-section">
            <div className="bowling-inventory-section-header">
              <h3>Bowling Pins</h3>
              <button
                type="button"
                className="dashBtn dashBtn--primary"
                onClick={() => setShowPinsForm(true)}
              >
                Update Count
              </button>
            </div>
            <div className="bowling-pins-display">
              <div className="bowling-pins-count">
                <h4>Total Pins: {bowlingPins.total}</h4>
                {bowlingPins.notes && <p className="bowling-inventory-notes">{bowlingPins.notes}</p>}
                {bowlingPins.history && bowlingPins.history.length > 0 && (
                  <div className="bowling-pins-history">
                    <p className="bowling-history-label">Count History:</p>
                    {bowlingPins.history.slice(-5).map((entry, idx) => (
                      <p key={idx} className="bowling-history-entry">
                        {entry.count} pins - {entry.date?.toDate?.()?.toLocaleDateString() || entry.date}
                        {entry.notes && ` - ${entry.notes}`}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Lane Modal */}
      {showLaneForm && (
        <div className="bowling-tab__modal">
          <div className="bowling-tab__modal-content">
            <h3>{selectedLane ? "Edit Lane" : "Add Lane"}</h3>
            <div className="bowling-tab__form">
              <label>
                Lane Number
                <input
                  type="text"
                  value={laneForm.laneNumber}
                  onChange={(e) =>
                    setLaneForm({ ...laneForm, laneNumber: e.target.value })
                  }
                  disabled={!!selectedLane}
                />
              </label>
              <label>
                Status
                <select
                  value={laneForm.status}
                  onChange={(e) =>
                    setLaneForm({ ...laneForm, status: e.target.value })
                  }
                >
                  <option value={LANE_STATUS.AVAILABLE}>Available</option>
                  <option value={LANE_STATUS.RESERVED}>Reserved</option>
                  <option value={LANE_STATUS.IN_USE}>In Use</option>
                  <option value={LANE_STATUS.MAINTENANCE}>Maintenance</option>
                </select>
              </label>
              <label>
                Notes
                <textarea
                  value={laneForm.notes}
                  onChange={(e) =>
                    setLaneForm({ ...laneForm, notes: e.target.value })
                  }
                />
              </label>
              <div className="bowling-tab__modal-actions">
                <button
                  type="button"
                  className="dashBtn"
                  onClick={() => {
                    setShowLaneForm(false);
                    setSelectedLane(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="dashBtn dashBtn--primary"
                  onClick={saveLane}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reservation Form Modal */}
      {showReservationForm && (
        <div 
          className="bowling-tab__modal"
          onClick={(e) => {
            if (e.target.classList.contains('bowling-tab__modal')) {
              setShowTimePicker(false);
            }
          }}
        >
          <div className="bowling-tab__modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>New Walk-In Reservation</h3>
            <p style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.7)", marginBottom: "16px" }}>
              Book a walk-in customer. Enter payment information after processing in POS system.
            </p>
            <div className="bowling-tab__form">
              <label>
                Lane
                <select
                  value={reservationForm.laneId}
                  onChange={(e) =>
                    setReservationForm({ ...reservationForm, laneId: e.target.value })
                  }
                >
                  <option value="">Select Lane</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((laneNum) => {
                    const lane = lanes.find(l => parseInt(l.laneNumber) === laneNum);
                    const isAvailable = !lane || lane.status === LANE_STATUS.AVAILABLE;
                    return (
                      <option 
                        key={laneNum} 
                        value={String(laneNum)}
                        disabled={!isAvailable}
                      >
                        Lane {laneNum} {!isAvailable ? `(${lane?.status || 'unavailable'})` : ''}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label>
                Guest Name
                <input
                  type="text"
                  value={reservationForm.guestName}
                  onChange={(e) =>
                    setReservationForm({ ...reservationForm, guestName: e.target.value })
                  }
                />
              </label>
              <label>
                Guest Phone
                <input
                  type="tel"
                  value={reservationForm.guestPhone}
                  onChange={(e) =>
                    setReservationForm({
                      ...reservationForm,
                      guestPhone: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Start Time
                <div 
                  className="bowling-time-picker-trigger"
                  onClick={() => {
                    // Initialize with current time if not set
                    if (reservationForm.startTimeHours === undefined || reservationForm.startTimeMinutes === undefined) {
                      const now = new Date();
                      setReservationForm({
                        ...reservationForm,
                        startTimeHours: now.getHours(),
                        startTimeMinutes: now.getMinutes(),
                      });
                    }
                    setShowTimePicker(!showTimePicker);
                  }}
                >
                  {String(reservationForm.startTimeHours !== undefined ? reservationForm.startTimeHours : new Date().getHours()).padStart(2, '0')}:
                  {String(reservationForm.startTimeMinutes !== undefined ? reservationForm.startTimeMinutes : new Date().getMinutes()).padStart(2, '0')}
                </div>
                {showTimePicker && (
                  <div className="bowling-time-picker">
                    <div className="bowling-time-picker-hours">
                      <div className="bowling-time-picker-label">Hour</div>
                      <div className="bowling-time-picker-scroll">
                        {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                          <div
                            key={hour}
                            className={`bowling-time-picker-item ${
                              (reservationForm.startTimeHours !== undefined ? reservationForm.startTimeHours : new Date().getHours()) === hour ? 'selected' : ''
                            }`}
                            onClick={() => {
                              setReservationForm({
                                ...reservationForm,
                                startTimeHours: hour,
                              });
                            }}
                          >
                            {String(hour).padStart(2, '0')}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bowling-time-picker-minutes">
                      <div className="bowling-time-picker-label">Minute</div>
                      <div className="bowling-time-picker-scroll">
                        {Array.from({ length: 60 }, (_, i) => i).map((minute) => (
                          <div
                            key={minute}
                            className={`bowling-time-picker-item ${
                              (reservationForm.startTimeMinutes !== undefined ? reservationForm.startTimeMinutes : new Date().getMinutes()) === minute ? 'selected' : ''
                            }`}
                            onClick={() => {
                              setReservationForm({
                                ...reservationForm,
                                startTimeMinutes: minute,
                              });
                            }}
                          >
                            {String(minute).padStart(2, '0')}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </label>
              <label>
                Duration
                <select
                  value={reservationForm.duration}
                  onChange={(e) =>
                    setReservationForm({
                      ...reservationForm,
                      duration: parseInt(e.target.value),
                    })
                  }
                >
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={120}>2 hours</option>
                  <option value={180}>3 hours</option>
                </select>
              </label>
              <label>
                Party Size
                <select
                  value={reservationForm.partySize}
                  onChange={(e) => {
                    const newPartySize = parseInt(e.target.value);
                    setReservationForm({
                      ...reservationForm,
                      partySize: newPartySize,
                      // Update shoe rentals array if shoes are needed
                      shoeRentals: reservationForm.needsShoes
                        ? Array.from({ length: newPartySize }, (_, i) => {
                            // Preserve existing shoe data if available
                            const existing = reservationForm.shoeRentals[i];
                            return existing || { name: "", size: "" };
                          })
                        : [],
                    });
                  }}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((size) => (
                    <option key={size} value={size}>
                      {size} {size === 1 ? 'person' : 'people'}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={reservationForm.needsShoes}
                  onChange={(e) => {
                    const needsShoes = e.target.checked;
                    setReservationForm({
                      ...reservationForm,
                      needsShoes,
                      shoeRentals: needsShoes
                        ? Array.from({ length: reservationForm.partySize }, (_, i) => ({
                            name: "",
                            size: "",
                          }))
                        : [],
                      paymentType: reservationForm.paymentType || "",
                      paymentAmount: reservationForm.paymentAmount || "",
                      paymentProcessed: reservationForm.paymentProcessed || false,
                      paymentReference: reservationForm.paymentReference || "",
                    });
                  }}
                />
                Do you need to rent shoes for your group?
              </label>
              
              {reservationForm.needsShoes && reservationForm.shoeRentals.length > 0 && (
                <div className="bowling-shoe-rentals">
                  <label>Shoe Rentals ({reservationForm.partySize} people)</label>
                  {reservationForm.shoeRentals.map((shoe, index) => (
                    <div key={index} className="bowling-shoe-rental-item">
                      <div className="bowling-shoe-icon">👟</div>
                      <input
                        type="text"
                        placeholder={`Person ${index + 1} name`}
                        value={shoe.name}
                        onChange={(e) => {
                          const updatedShoes = [...reservationForm.shoeRentals];
                          updatedShoes[index].name = e.target.value;
                          setReservationForm({
                            ...reservationForm,
                            shoeRentals: updatedShoes,
                          });
                        }}
                      />
                      <select
                        value={shoe.size}
                        onChange={(e) => {
                          const updatedShoes = [...reservationForm.shoeRentals];
                          updatedShoes[index].size = e.target.value;
                          setReservationForm({
                            ...reservationForm,
                            shoeRentals: updatedShoes,
                          });
                        }}
                      >
                        <option value="">Select Size</option>
                        {Array.from({ length: 20 }, (_, i) => {
                          const size = i + 1;
                          return (
                            <option key={size} value={size}>
                              Size {size}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  ))}
                </div>
              )}

              <div className="bowling-payment-section">
                <h4 style={{ marginBottom: "12px", fontSize: "16px", fontWeight: 600 }}>Payment Information</h4>
                <div style={{
                  background: "rgba(59, 130, 246, 0.1)",
                  border: "1px solid rgba(59, 130, 246, 0.3)",
                  borderRadius: "6px",
                  padding: "10px",
                  fontSize: "12px",
                  color: "rgba(255, 255, 255, 0.8)",
                  marginBottom: "12px",
                }}>
                  <strong>POS Integration:</strong> All payments are processed through your POS system. Payment information will be automatically captured from POS when the transaction is processed. You can manually enter details below if needed.
                </div>
                <label>
                  Payment Method (as processed in POS)
                  <select
                    value={reservationForm.paymentType}
                    onChange={(e) =>
                      setReservationForm({ ...reservationForm, paymentType: e.target.value })
                    }
                  >
                    <option value="">Select Payment Method</option>
                    <option value="cash">Cash</option>
                    <option value="credit">Credit Card</option>
                    <option value="debit">Debit Card</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                {reservationForm.paymentType && (
                  <>
                    <label>
                      Payment Amount ($)
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={reservationForm.paymentAmount}
                        onChange={(e) =>
                          setReservationForm({ ...reservationForm, paymentAmount: e.target.value })
                        }
                        placeholder="0.00"
                      />
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={reservationForm.paymentProcessed}
                        onChange={(e) =>
                          setReservationForm({ ...reservationForm, paymentProcessed: e.target.checked })
                        }
                      />
                      Payment Processed in POS
                    </label>
                    {reservationForm.paymentProcessed && (
                      <label>
                        POS Transaction Reference
                        <input
                          type="text"
                          value={reservationForm.paymentReference}
                          onChange={(e) =>
                            setReservationForm({ ...reservationForm, paymentReference: e.target.value })
                          }
                          placeholder="Enter POS confirmation/reference number"
                        />
                      </label>
                    )}
                  </>
                )}
              </div>

              <label>
                Notes
                <textarea
                  value={reservationForm.notes}
                  onChange={(e) =>
                    setReservationForm({ ...reservationForm, notes: e.target.value })
                  }
                />
              </label>
              <div className="bowling-tab__modal-actions">
                <button
                  type="button"
                  className="dashBtn"
                  onClick={() => {
      setShowReservationForm(false);
      setShowTimePicker(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="dashBtn dashBtn--primary"
                  onClick={createReservation}
                >
                  Create Reservation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Bowling Ball Modal */}
      {showBallForm && (
        <div className="bowling-tab__modal">
          <div className="bowling-tab__modal-content">
            <h3>{selectedBall ? "Edit Ball" : "Add Bowling Ball"}</h3>
            <div className="bowling-tab__form">
              <label>
                Weight (lbs)
                <input
                  type="number"
                  value={ballForm.weight}
                  onChange={(e) => setBallForm({ ...ballForm, weight: e.target.value })}
                  min="6"
                  max="16"
                  step="1"
                />
              </label>
              <label>
                Condition
                <select
                  value={ballForm.condition}
                  onChange={(e) => setBallForm({ ...ballForm, condition: e.target.value })}
                >
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                  <option value="needs_replacement">Needs Replacement</option>
                </select>
              </label>
              <label>
                Photo
                {ballForm.photoPreview && (
                  <img src={ballForm.photoPreview} alt="Ball preview" className="bowling-photo-preview" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const preview = URL.createObjectURL(file);
                      setBallForm({ ...ballForm, photo: file, photoPreview: preview });
                    }
                  }}
                />
              </label>
              <label>
                Notes
                <textarea
                  value={ballForm.notes}
                  onChange={(e) => setBallForm({ ...ballForm, notes: e.target.value })}
                  rows={3}
                />
              </label>
              <div className="bowling-tab__modal-actions">
                <button
                  type="button"
                  className="dashBtn"
                  onClick={() => {
                    setShowBallForm(false);
                    setSelectedBall(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="dashBtn dashBtn--primary"
                  onClick={async () => {
                    try {
                      let photoURL = ballForm.photoPreview;
                      
                      // Upload photo if new
                      if (ballForm.photo) {
                        const storage = getStorage();
                        const photoRef = ref(storage, `bowling/balls/${restaurantId}/${Date.now()}_${ballForm.photo.name}`);
                        await uploadBytes(photoRef, ballForm.photo);
                        photoURL = await getDownloadURL(photoRef);
                      }

                      const ballData = {
                        weight: ballForm.weight,
                        condition: ballForm.condition,
                        photoURL: photoURL || null,
                        notes: ballForm.notes || "",
                        updatedAt: serverTimestamp(),
                      };

                      if (selectedBall) {
                        // Update existing ball
                        const ballRef = doc(db, "restaurants", restaurantId, "bowlingBalls", selectedBall.id);
                        const existingData = await getDoc(ballRef);
                        const existing = existingData.data();
                        
                        // Add condition history if condition changed
                        if (existing.condition !== ballForm.condition) {
                          const history = existing.conditionHistory || [];
                          history.push({
                            condition: existing.condition,
                            date: existing.updatedAt || serverTimestamp(),
                          });
                          ballData.conditionHistory = history;
                        } else {
                          ballData.conditionHistory = existing.conditionHistory || [];
                        }
                        
                        await updateDoc(ballRef, ballData);
                      } else {
                        // Create new ball
                        const ballRef = doc(collection(db, "restaurants", restaurantId, "bowlingBalls"));
                        await setDoc(ballRef, {
                          ...ballData,
                          id: ballRef.id,
                          createdAt: serverTimestamp(),
                          conditionHistory: [],
                        });
                      }

                      setShowBallForm(false);
                      setSelectedBall(null);
                      loadBowlingInventory();
                    } catch (err) {
                      console.error("Error saving ball:", err);
                      alert("Failed to save ball");
                    }
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Bowling Shoes Modal */}
      {showShoeForm && (
        <div className="bowling-tab__modal">
          <div className="bowling-tab__modal-content">
            <h3>{selectedShoe ? "Edit Shoes" : "Add Bowling Shoes"}</h3>
            <div className="bowling-tab__form">
              <label>
                Size
                <input
                  type="number"
                  value={shoeForm.size}
                  onChange={(e) => setShoeForm({ ...shoeForm, size: e.target.value })}
                  min="1"
                  max="20"
                  step="0.5"
                />
              </label>
              <label>
                Edition/Model (Optional)
                <input
                  type="text"
                  value={shoeForm.edition}
                  onChange={(e) => setShoeForm({ ...shoeForm, edition: e.target.value })}
                  placeholder="e.g., Pro Model 2024"
                />
              </label>
              <label>
                Condition
                <select
                  value={shoeForm.condition}
                  onChange={(e) => setShoeForm({ ...shoeForm, condition: e.target.value })}
                >
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                  <option value="needs_replacement">Needs Replacement</option>
                </select>
              </label>
              <label>
                Photo
                {shoeForm.photoPreview && (
                  <img src={shoeForm.photoPreview} alt="Shoe preview" className="bowling-photo-preview" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const preview = URL.createObjectURL(file);
                      setShoeForm({ ...shoeForm, photo: file, photoPreview: preview });
                    }
                  }}
                />
              </label>
              <label>
                Notes
                <textarea
                  value={shoeForm.notes}
                  onChange={(e) => setShoeForm({ ...shoeForm, notes: e.target.value })}
                  rows={3}
                />
              </label>
              <div className="bowling-tab__modal-actions">
                <button
                  type="button"
                  className="dashBtn"
                  onClick={() => {
                    setShowShoeForm(false);
                    setSelectedShoe(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="dashBtn dashBtn--primary"
                  onClick={async () => {
                    try {
                      let photoURL = shoeForm.photoPreview;
                      
                      // Upload photo if new
                      if (shoeForm.photo) {
                        const storage = getStorage();
                        const photoRef = ref(storage, `bowling/shoes/${restaurantId}/${Date.now()}_${shoeForm.photo.name}`);
                        await uploadBytes(photoRef, shoeForm.photo);
                        photoURL = await getDownloadURL(photoRef);
                      }

                      const shoeData = {
                        size: shoeForm.size,
                        edition: shoeForm.edition || "",
                        condition: shoeForm.condition,
                        photoURL: photoURL || null,
                        notes: shoeForm.notes || "",
                        updatedAt: serverTimestamp(),
                      };

                      if (selectedShoe) {
                        // Update existing shoe
                        const shoeRef = doc(db, "restaurants", restaurantId, "bowlingShoes", selectedShoe.id);
                        const existingData = await getDoc(shoeRef);
                        const existing = existingData.data();
                        
                        // Add condition history if condition changed
                        if (existing.condition !== shoeForm.condition) {
                          const history = existing.conditionHistory || [];
                          history.push({
                            condition: existing.condition,
                            date: existing.updatedAt || serverTimestamp(),
                          });
                          shoeData.conditionHistory = history;
                        } else {
                          shoeData.conditionHistory = existing.conditionHistory || [];
                        }
                        
                        await updateDoc(shoeRef, shoeData);
                      } else {
                        // Create new shoe
                        const shoeRef = doc(collection(db, "restaurants", restaurantId, "bowlingShoes"));
                        await setDoc(shoeRef, {
                          ...shoeData,
                          id: shoeRef.id,
                          createdAt: serverTimestamp(),
                          conditionHistory: [],
                        });
                      }

                      setShowShoeForm(false);
                      setSelectedShoe(null);
                      loadBowlingInventory();
                    } catch (err) {
                      console.error("Error saving shoe:", err);
                      alert("Failed to save shoe");
                    }
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Update Bowling Pins Modal */}
      {showPinsForm && (
        <div className="bowling-tab__modal">
          <div className="bowling-tab__modal-content">
            <h3>Update Bowling Pins Count</h3>
            <div className="bowling-tab__form">
              <label>
                Total Pins
                <input
                  type="number"
                  value={bowlingPins.total}
                  onChange={(e) => setBowlingPins({ ...bowlingPins, total: parseInt(e.target.value) || 0 })}
                  min="0"
                />
              </label>
              <label>
                Notes (Optional)
                <textarea
                  value={bowlingPins.notes}
                  onChange={(e) => setBowlingPins({ ...bowlingPins, notes: e.target.value })}
                  rows={3}
                  placeholder="e.g., Received new shipment, replaced damaged pins..."
                />
              </label>
              <div className="bowling-tab__modal-actions">
                <button
                  type="button"
                  className="dashBtn"
                  onClick={() => setShowPinsForm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="dashBtn dashBtn--primary"
                  onClick={async () => {
                    try {
                      const pinsRef = doc(db, "restaurants", restaurantId, "bowlingInventory", "pins");
                      const existingData = await getDoc(pinsRef);
                      const existing = existingData.exists() ? existingData.data() : { total: 0, history: [] };
                      
                      const history = existing.history || [];
                      if (existing.total !== bowlingPins.total) {
                        history.push({
                          count: existing.total,
                          date: existing.updatedAt || serverTimestamp(),
                          notes: existing.notes || "",
                        });
                      }

                      await setDoc(pinsRef, {
                        total: bowlingPins.total,
                        notes: bowlingPins.notes || "",
                        history: history.slice(-20), // Keep last 20 entries
                        updatedAt: serverTimestamp(),
                      }, { merge: true });

                      setShowPinsForm(false);
                      loadBowlingInventory();
                    } catch (err) {
                      console.error("Error updating pins:", err);
                      alert("Failed to update pins count");
                    }
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

