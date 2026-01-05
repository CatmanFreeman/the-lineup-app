// src/pages/Dashboards/RestaurantDashboard/tabs/LiveOperationsTab.jsx
//
// LIVE OPERATIONS TAB - Restaurant Dashboard
//
// Shows real-time POS events, table status, meal lifecycle, and order tracking

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../../../hooks/services/firebase";
import { POS_EVENT_TYPE, POS_SYSTEM } from "../../../../utils/posEventService";
import { handleMockToastEvent, MOCK_TOAST_EVENTS } from "../../../../services/toastWebhookReceiver";
import "./LiveOperationsTab.css";

export default function LiveOperationsTab() {
  const { restaurantId } = useParams();
  const [posEvents, setPosEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all"); // all, seated, orders, checks
  const [timeRange, setTimeRange] = useState("last-hour"); // last-hour, today, all
  const [testing, setTesting] = useState(false);

  // Load POS events
  const loadPosEvents = useCallback(async () => {
    if (!restaurantId) return;

    setLoading(true);
    setError(null);

    try {
      const posEventsRef = collection(db, "restaurants", restaurantId, "posEvents");
      
      // Build query based on time range
      let timeQuery = query(posEventsRef, orderBy("timestamp", "desc"), limit(100));
      
      if (timeRange === "last-hour") {
        const oneHourAgo = Timestamp.fromDate(new Date(Date.now() - 60 * 60 * 1000));
        timeQuery = query(
          posEventsRef,
          where("timestamp", ">=", oneHourAgo),
          orderBy("timestamp", "desc"),
          limit(100)
        );
      } else if (timeRange === "today") {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayStartTimestamp = Timestamp.fromDate(todayStart);
        timeQuery = query(
          posEventsRef,
          where("timestamp", ">=", todayStartTimestamp),
          orderBy("timestamp", "desc"),
          limit(200)
        );
      }

      const snapshot = await getDocs(timeQuery);
      const events = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Apply filter
      let filteredEvents = events;
      if (filter !== "all") {
        filteredEvents = events.filter((event) => {
          switch (filter) {
            case "seated":
              return event.eventType === POS_EVENT_TYPE.SEATED;
            case "orders":
              return event.eventType === POS_EVENT_TYPE.FIRST_DRINK || 
                     event.eventType === POS_EVENT_TYPE.ENTREES_ORDERED;
            case "checks":
              return event.eventType === POS_EVENT_TYPE.CHECK_CLOSED;
            default:
              return true;
          }
        });
      }

      setPosEvents(filteredEvents);
    } catch (err) {
      console.error("Error loading POS events:", err);
      setError("Failed to load POS events. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, filter, timeRange]);

  // Set up real-time listener
  useEffect(() => {
    if (!restaurantId) return;

    const posEventsRef = collection(db, "restaurants", restaurantId, "posEvents");
    
    // Build query for real-time updates
    let realtimeQuery = query(posEventsRef, orderBy("timestamp", "desc"), limit(50));
    
    if (timeRange === "last-hour") {
      const oneHourAgo = Timestamp.fromDate(new Date(Date.now() - 60 * 60 * 1000));
      realtimeQuery = query(
        posEventsRef,
        where("timestamp", ">=", oneHourAgo),
        orderBy("timestamp", "desc"),
        limit(50)
      );
    }

    const unsubscribe = onSnapshot(
      realtimeQuery,
      (snapshot) => {
        const events = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Apply filter
        let filteredEvents = events;
        if (filter !== "all") {
          filteredEvents = events.filter((event) => {
            switch (filter) {
              case "seated":
                return event.eventType === POS_EVENT_TYPE.SEATED;
              case "orders":
                return event.eventType === POS_EVENT_TYPE.FIRST_DRINK || 
                       event.eventType === POS_EVENT_TYPE.ENTREES_ORDERED;
              case "checks":
                return event.eventType === POS_EVENT_TYPE.CHECK_CLOSED;
              default:
                return true;
            }
          });
        }

        setPosEvents(filteredEvents);
        setLoading(false);
      },
      (err) => {
        console.error("Error in POS events listener:", err);
        setError("Failed to load POS events.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [restaurantId, filter, timeRange]);

  const getEventTypeLabel = (eventType) => {
    switch (eventType) {
      case POS_EVENT_TYPE.SEATED:
        return "Seated";
      case POS_EVENT_TYPE.FIRST_DRINK:
        return "First Drink";
      case POS_EVENT_TYPE.ENTREES_ORDERED:
        return "Entrees Ordered";
      case POS_EVENT_TYPE.CHECK_CLOSED:
        return "Check Closed";
      case POS_EVENT_TYPE.TABLE_STATUS_CHANGED:
        return "Table Status";
      default:
        return eventType;
    }
  };

  const getEventTypeIcon = (eventType) => {
    switch (eventType) {
      case POS_EVENT_TYPE.SEATED:
        return "🪑";
      case POS_EVENT_TYPE.FIRST_DRINK:
        return "🥤";
      case POS_EVENT_TYPE.ENTREES_ORDERED:
        return "🍽️";
      case POS_EVENT_TYPE.CHECK_CLOSED:
        return "💳";
      default:
        return "📋";
    }
  };

  const handleTestEvent = async (eventType) => {
    if (!restaurantId) {
      alert("No restaurant ID found");
      return;
    }

    setTesting(true);
    try {
      // Update mock event with current restaurant ID
      let mockEvent;
      switch (eventType) {
        case "seated":
          mockEvent = {
            ...MOCK_TOAST_EVENTS.TABLE_SEATED,
            data: {
              ...MOCK_TOAST_EVENTS.TABLE_SEATED.data,
              restaurantId: restaurantId,
            },
          };
          break;
        case "first-drink":
          mockEvent = {
            ...MOCK_TOAST_EVENTS.ORDER_CREATED,
            data: {
              ...MOCK_TOAST_EVENTS.ORDER_CREATED.data,
              restaurantId: restaurantId,
            },
          };
          break;
        case "entrees":
          mockEvent = {
            ...MOCK_TOAST_EVENTS.ENTREES_ORDERED,
            data: {
              ...MOCK_TOAST_EVENTS.ENTREES_ORDERED.data,
              restaurantId: restaurantId,
            },
          };
          break;
        case "check-closed":
          mockEvent = {
            ...MOCK_TOAST_EVENTS.CHECK_CLOSED,
            data: {
              ...MOCK_TOAST_EVENTS.CHECK_CLOSED.data,
              restaurantId: restaurantId,
            },
          };
          break;
        default:
          return;
      }

      await handleMockToastEvent(mockEvent);
      // Reload events after a short delay
      setTimeout(() => {
        loadPosEvents();
      }, 500);
    } catch (error) {
      console.error("Error testing event:", error);
      alert("Failed to create test event. Check console for details.");
    } finally {
      setTesting(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "—";
    
    let date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Timestamp) {
      date = timestamp.toDate();
    } else {
      date = new Date(timestamp);
    }

    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (loading && posEvents.length === 0) {
    return (
      <div className="live-operations-container">
        <div className="live-operations-loading">
          <p>Loading POS events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="live-operations-container">
      <div className="live-operations-header">
        <div>
          <h2>Live Operations</h2>
          <p className="live-operations-subtitle">
            Real-time POS events, table status, and meal lifecycle tracking
          </p>
        </div>
        
        <div className="live-operations-controls">
          <div className="filter-group">
            <label>Time Range:</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="filter-select"
            >
              <option value="last-hour">Last Hour</option>
              <option value="today">Today</option>
              <option value="all">All Time</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>Filter:</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Events</option>
              <option value="seated">Seated</option>
              <option value="orders">Orders</option>
              <option value="checks">Checks Closed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Test Mode Section */}
      <div className="test-mode-section">
        <div className="test-mode-header">
          <h3>🧪 Test Mode</h3>
          <p className="test-mode-subtitle">
            Test POS integration with mock events (no Toast credentials required)
          </p>
        </div>
        <div className="test-mode-buttons">
          <button
            onClick={() => handleTestEvent("seated")}
            disabled={testing}
            className="test-button test-button-seated"
          >
            🪑 Test Seated
          </button>
          <button
            onClick={() => handleTestEvent("first-drink")}
            disabled={testing}
            className="test-button test-button-drink"
          >
            🥤 Test First Drink
          </button>
          <button
            onClick={() => handleTestEvent("entrees")}
            disabled={testing}
            className="test-button test-button-entrees"
          >
            🍽️ Test Entrees
          </button>
          <button
            onClick={() => handleTestEvent("check-closed")}
            disabled={testing}
            className="test-button test-button-check"
          >
            💳 Test Check Closed
          </button>
        </div>
        {testing && (
          <div className="test-mode-status">Creating test event...</div>
        )}
      </div>

      {error && (
        <div className="live-operations-error">
          {error}
        </div>
      )}

      {posEvents.length === 0 ? (
        <div className="live-operations-empty">
          <p>No POS events found</p>
          <p className="empty-subtitle">
            {timeRange === "last-hour" 
              ? "Events will appear here when your POS system sends webhooks."
              : "No events match your current filters."}
          </p>
        </div>
      ) : (
        <div className="live-operations-events">
          {posEvents.map((event) => (
            <div key={event.id} className="pos-event-card">
              <div className="pos-event-header">
                <div className="pos-event-type">
                  <span className="pos-event-icon">{getEventTypeIcon(event.eventType)}</span>
                  <span className="pos-event-type-label">{getEventTypeLabel(event.eventType)}</span>
                </div>
                <div className="pos-event-meta">
                  <span className="pos-event-time">{formatTimestamp(event.timestamp)}</span>
                  <span className="pos-event-system">{event.posSystem || "UNKNOWN"}</span>
                </div>
              </div>
              
              <div className="pos-event-details">
                {event.tableId && (
                  <div className="pos-event-detail">
                    <span className="detail-label">Table:</span>
                    <span className="detail-value">{event.tableId}</span>
                  </div>
                )}
                
                {event.metadata?.tableName && (
                  <div className="pos-event-detail">
                    <span className="detail-label">Table Name:</span>
                    <span className="detail-value">{event.metadata.tableName}</span>
                  </div>
                )}
                
                {event.metadata?.checkId && (
                  <div className="pos-event-detail">
                    <span className="detail-label">Check ID:</span>
                    <span className="detail-value">{event.metadata.checkId}</span>
                  </div>
                )}
                
                {event.metadata?.total && (
                  <div className="pos-event-detail">
                    <span className="detail-label">Total:</span>
                    <span className="detail-value">
                      ${Number(event.metadata.total).toFixed(2)}
                    </span>
                  </div>
                )}
                
                {event.metadata?.items && event.metadata.items.length > 0 && (
                  <div className="pos-event-detail">
                    <span className="detail-label">Items:</span>
                    <span className="detail-value">
                      {event.metadata.items.length} item(s)
                    </span>
                  </div>
                )}
                
                {event.linkedReservationId && (
                  <div className="pos-event-detail">
                    <span className="detail-label">Reservation:</span>
                    <span className="detail-value reservation-link">
                      {event.linkedReservationId}
                    </span>
                  </div>
                )}
                
                {event.processed !== undefined && (
                  <div className="pos-event-detail">
                    <span className="detail-label">Status:</span>
                    <span className={`detail-value ${event.processed ? "processed" : "pending"}`}>
                      {event.processed ? "✓ Processed" : "⏳ Pending"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="live-operations-info">
        <h3>About POS Integration</h3>
        <ul>
          <li>
            <strong>Real-time Updates:</strong> Events appear automatically when your POS system sends webhooks
          </li>
          <li>
            <strong>Supported Systems:</strong> Toast (active), Square (active), Clover (active)
          </li>
          <li>
            <strong>Event Types:</strong> Seated, First Drink, Entrees Ordered, Check Closed
          </li>
          <li>
            <strong>Meal Lifecycle:</strong> Events are automatically linked to reservations when possible
          </li>
        </ul>
        <p className="info-note">
          <strong>Note:</strong> To receive POS events, configure webhooks in your POS system to send events to your Lineup webhook endpoint.
        </p>
      </div>
    </div>
  );
}

