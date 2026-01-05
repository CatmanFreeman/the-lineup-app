// src/pages/ToGo/ToGoOrderTrackingPage.jsx
//
// TO-GO ORDER TRACKING PAGE
//
// Real-time order tracking for customers
// - View order details
// - Track order status
// - Estimated ready time
// - Order history

import React, { useState, useEffect } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../hooks/services/firebase";
import { getToGoOrder, subscribeToOrder, ORDER_STATUS, ORDER_TYPE } from "../../utils/togoOrderService";
import "./ToGoOrderTrackingPage.css";

export default function ToGoOrderTrackingPage() {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const restaurantId = searchParams.get("restaurantId");
  const { currentUser } = useAuth();

  const [order, setOrder] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orderId || !restaurantId) {
      setError("Order ID and Restaurant ID required");
      setLoading(false);
      return;
    }

    loadOrderData();

    // Subscribe to real-time updates
    const unsubscribe = subscribeToOrder(restaurantId, orderId, (orderData) => {
      setOrder(orderData);
    });

    return () => unsubscribe();
  }, [orderId, restaurantId]);

  async function loadOrderData() {
    try {
      setLoading(true);
      setError("");

      // Load order
      const orderData = await getToGoOrder(restaurantId, orderId);
      setOrder(orderData);

      // Verify user owns this order
      if (currentUser && orderData.dinerId !== currentUser.uid) {
        setError("You don't have permission to view this order");
        setLoading(false);
        return;
      }

      // Load restaurant
      if (restaurantId) {
        const restaurantRef = doc(db, "restaurants", restaurantId);
        const restaurantSnap = await getDoc(restaurantRef);
        if (restaurantSnap.exists()) {
          setRestaurant({
            id: restaurantSnap.id,
            ...restaurantSnap.data(),
          });
        }
      }
    } catch (err) {
      console.error("Error loading order data:", err);
      setError(err.message || "Failed to load order");
    } finally {
      setLoading(false);
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      [ORDER_STATUS.PENDING]: "#ffa500",
      [ORDER_STATUS.CONFIRMED]: "#4da3ff",
      [ORDER_STATUS.PREPARING]: "#4da3ff",
      [ORDER_STATUS.READY]: "#10b981",
      [ORDER_STATUS.PICKED_UP]: "#10b981",
      [ORDER_STATUS.COMPLETED]: "#10b981",
      [ORDER_STATUS.CANCELLED]: "#ff4444",
    };
    return colors[status] || "#999";
  };

  const getStatusMessage = (status) => {
    const messages = {
      [ORDER_STATUS.PENDING]: "Your order has been received and is awaiting confirmation",
      [ORDER_STATUS.CONFIRMED]: "Your order has been confirmed and will be prepared soon",
      [ORDER_STATUS.PREPARING]: "Your order is being prepared",
      [ORDER_STATUS.READY]: "Your order is ready for pickup!",
      [ORDER_STATUS.PICKED_UP]: "Order picked up",
      [ORDER_STATUS.COMPLETED]: "Thank you for your order!",
      [ORDER_STATUS.CANCELLED]: "This order has been cancelled",
    };
    return messages[status] || "Order status updated";
  };

  if (loading) {
    return (
      <div className="togo-tracking-page">
        <div className="togo-tracking-loading">Loading order...</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="togo-tracking-page">
        <div className="togo-tracking-error">{error || "Order not found"}</div>
        <Link to="/" className="togo-tracking-back-link">
          Back to Home
        </Link>
      </div>
    );
  }

  const statusColor = getStatusColor(order.status);
  const statusMessage = getStatusMessage(order.status);
  const estimatedReadyTime = order.estimatedReadyTime
    ? new Date(order.estimatedReadyTime.seconds * 1000).toLocaleString()
    : null;

  return (
    <div className="togo-tracking-page">
      <div className="togo-tracking-container">
        <div className="togo-tracking-header">
          <Link to="/" className="togo-tracking-back-link">
            ← Back to Home
          </Link>
          <h1>Order Tracking</h1>
          <p className="togo-tracking-order-number">Order #{order.id.substring(0, 8).toUpperCase()}</p>
        </div>

        <div className="togo-tracking-content">
          {/* Status Card */}
          <div className="togo-tracking-status-card">
            <div className="togo-tracking-status-indicator" style={{ backgroundColor: statusColor }}>
              <div className="togo-tracking-status-dot" />
            </div>
            <div className="togo-tracking-status-info">
              <h2 className="togo-tracking-status-title">{order.status}</h2>
              <p className="togo-tracking-status-message">{statusMessage}</p>
              {estimatedReadyTime && (
                <p className="togo-tracking-estimated-time">
                  Estimated ready: {estimatedReadyTime}
                </p>
              )}
            </div>
          </div>

          {/* Restaurant Info */}
          {restaurant && (
            <div className="togo-tracking-section">
              <h3>Restaurant</h3>
              <p className="togo-tracking-restaurant-name">{restaurant.name}</p>
              {restaurant.phone && (
                <p className="togo-tracking-restaurant-phone">
                  <a href={`tel:${restaurant.phone}`}>{restaurant.phone}</a>
                </p>
              )}
            </div>
          )}

          {/* Order Details */}
          <div className="togo-tracking-section">
            <h3>Order Details</h3>
            <div className="togo-tracking-order-items">
              {order.items.map((item, index) => (
                <div key={index} className="togo-tracking-order-item">
                  <div className="togo-tracking-item-info">
                    <span className="togo-tracking-item-name">{item.name}</span>
                    <span className="togo-tracking-item-quantity">×{item.quantity}</span>
                  </div>
                  <span className="togo-tracking-item-price">${item.subtotal.toFixed(2)}</span>
                  {item.specialInstructions && (
                    <p className="togo-tracking-item-instructions">
                      Note: {item.specialInstructions}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="togo-tracking-order-totals">
              <div className="togo-tracking-total-row">
                <span>Subtotal</span>
                <span>${order.subtotal.toFixed(2)}</span>
              </div>
              {order.deliveryFee > 0 && (
                <div className="togo-tracking-total-row">
                  <span>Delivery Fee</span>
                  <span>${order.deliveryFee.toFixed(2)}</span>
                </div>
              )}
              <div className="togo-tracking-total-row">
                <span>Tax</span>
                <span>${order.tax.toFixed(2)}</span>
              </div>
              <div className="togo-tracking-total-row togo-tracking-total-final">
                <span>Total</span>
                <span>${order.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Pickup/Delivery Info */}
          <div className="togo-tracking-section">
            <h3>{order.orderType === ORDER_TYPE.PICKUP ? "Pickup" : "Delivery"} Information</h3>
            {order.orderType === ORDER_TYPE.PICKUP ? (
              <div>
                <p><strong>Type:</strong> Pickup</p>
                {order.pickupInfo?.preferredTime && (
                  <p><strong>Preferred Time:</strong> {new Date(order.pickupInfo.preferredTime).toLocaleString()}</p>
                )}
                {order.pickupInfo?.notes && (
                  <p><strong>Notes:</strong> {order.pickupInfo.notes}</p>
                )}
              </div>
            ) : (
              <div>
                <p><strong>Type:</strong> Delivery</p>
                {order.deliveryInfo?.address && (
                  <div>
                    <p><strong>Address:</strong></p>
                    <p>
                      {order.deliveryInfo.address.line1}
                      {order.deliveryInfo.address.line2 && `, ${order.deliveryInfo.address.line2}`}
                      <br />
                      {order.deliveryInfo.address.city}, {order.deliveryInfo.address.state} {order.deliveryInfo.address.zip}
                    </p>
                  </div>
                )}
                {order.deliveryInfo?.preferredTime && (
                  <p><strong>Preferred Time:</strong> {new Date(order.deliveryInfo.preferredTime).toLocaleString()}</p>
                )}
                {order.deliveryInfo?.notes && (
                  <p><strong>Notes:</strong> {order.deliveryInfo.notes}</p>
                )}
              </div>
            )}
          </div>

          {/* Status History */}
          {order.statusHistory && order.statusHistory.length > 1 && (
            <div className="togo-tracking-section">
              <h3>Status History</h3>
              <div className="togo-tracking-status-history">
                {order.statusHistory
                  .slice()
                  .reverse()
                  .map((statusEntry, index) => (
                    <div key={index} className="togo-tracking-status-entry">
                      <div className="togo-tracking-status-entry-dot" />
                      <div className="togo-tracking-status-entry-content">
                        <p className="togo-tracking-status-entry-status">{statusEntry.status}</p>
                        {statusEntry.note && (
                          <p className="togo-tracking-status-entry-note">{statusEntry.note}</p>
                        )}
                        {statusEntry.timestamp && (
                          <p className="togo-tracking-status-entry-time">
                            {statusEntry.timestamp.toDate
                              ? statusEntry.timestamp.toDate().toLocaleString()
                              : new Date(statusEntry.timestamp).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {order.status === ORDER_STATUS.PENDING && (
            <div className="togo-tracking-actions">
              <button
                className="togo-tracking-cancel-btn"
                onClick={async () => {
                  if (window.confirm("Are you sure you want to cancel this order?")) {
                    try {
                      const { cancelOrder } = await import("../../utils/togoOrderService");
                      await cancelOrder(restaurantId, orderId, "Cancelled by customer", true);
                      alert("Order cancelled");
                    } catch (err) {
                      alert("Failed to cancel order: " + err.message);
                    }
                  }
                }}
              >
                Cancel Order
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

