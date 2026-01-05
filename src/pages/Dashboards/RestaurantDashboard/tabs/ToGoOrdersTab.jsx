// src/pages/Dashboards/RestaurantDashboard/tabs/ToGoOrdersTab.jsx
//
// TO-GO ORDERS TAB
//
// Restaurant dashboard tab for managing To-Go orders
// - View all orders
// - Filter by status
// - Update order status
// - View order details

import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  getRestaurantToGoOrders,
  subscribeToRestaurantOrders,
  updateOrderStatus,
  ORDER_STATUS,
  ORDER_TYPE,
} from "../../../../utils/togoOrderService";
import "./ToGoOrdersTab.css";

export default function ToGoOrdersTab() {
  const { restaurantId } = useParams();
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;

    // Subscribe to real-time order updates
    const unsubscribe = subscribeToRestaurantOrders(
      restaurantId,
      (ordersData) => {
        setOrders(ordersData);
        setLoading(false);
      },
      statusFilter !== "all" ? statusFilter : null
    );

    return () => unsubscribe();
  }, [restaurantId, statusFilter]);

  useEffect(() => {
    if (statusFilter === "all") {
      setFilteredOrders(orders);
    } else {
      setFilteredOrders(orders.filter((order) => order.status === statusFilter));
    }
  }, [orders, statusFilter]);

  const handleStatusUpdate = async (orderId, newStatus, estimatedTime = null) => {
    if (!window.confirm(`Update order status to ${newStatus}?`)) return;

    setUpdatingStatus(true);
    try {
      await updateOrderStatus(restaurantId, orderId, newStatus, null, estimatedTime);
      setSelectedOrder(null);
    } catch (error) {
      console.error("Error updating order status:", error);
      alert("Failed to update order status: " + error.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

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

  const formatTime = (timestamp) => {
    if (!timestamp) return "—";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return "—";
    }
  };

  if (loading) {
    return (
      <div className="togo-orders-tab">
        <div className="togo-orders-loading">Loading orders...</div>
      </div>
    );
  }

  return (
    <div className="togo-orders-tab">
      <div className="togo-orders-header">
        <h2>To-Go Orders</h2>
        <div className="togo-orders-filters">
          <button
            className={`togo-orders-filter-btn ${statusFilter === "all" ? "active" : ""}`}
            onClick={() => setStatusFilter("all")}
          >
            All ({orders.length})
          </button>
          <button
            className={`togo-orders-filter-btn ${statusFilter === ORDER_STATUS.PENDING ? "active" : ""}`}
            onClick={() => setStatusFilter(ORDER_STATUS.PENDING)}
          >
            Pending ({orders.filter((o) => o.status === ORDER_STATUS.PENDING).length})
          </button>
          <button
            className={`togo-orders-filter-btn ${statusFilter === ORDER_STATUS.PREPARING ? "active" : ""}`}
            onClick={() => setStatusFilter(ORDER_STATUS.PREPARING)}
          >
            Preparing ({orders.filter((o) => o.status === ORDER_STATUS.PREPARING).length})
          </button>
          <button
            className={`togo-orders-filter-btn ${statusFilter === ORDER_STATUS.READY ? "active" : ""}`}
            onClick={() => setStatusFilter(ORDER_STATUS.READY)}
          >
            Ready ({orders.filter((o) => o.status === ORDER_STATUS.READY).length})
          </button>
        </div>
      </div>

      <div className="togo-orders-content">
        {filteredOrders.length === 0 ? (
          <div className="togo-orders-empty">
            <p>No orders found</p>
            {statusFilter !== "all" && (
              <button
                className="togo-orders-clear-filter"
                onClick={() => setStatusFilter("all")}
              >
                Show All Orders
              </button>
            )}
          </div>
        ) : (
          <div className="togo-orders-list">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className={`togo-orders-card ${selectedOrder?.id === order.id ? "selected" : ""}`}
                onClick={() => setSelectedOrder(order)}
              >
                <div className="togo-orders-card-header">
                  <div className="togo-orders-card-info">
                    <span className="togo-orders-order-number">
                      #{order.id.substring(0, 8).toUpperCase()}
                    </span>
                    <span
                      className="togo-orders-status-badge"
                      style={{ backgroundColor: getStatusColor(order.status) }}
                    >
                      {order.status}
                    </span>
                  </div>
                  <span className="togo-orders-order-total">${order.total.toFixed(2)}</span>
                </div>
                <div className="togo-orders-card-details">
                  <p className="togo-orders-customer-name">{order.dinerName}</p>
                  <p className="togo-orders-order-type">
                    {order.orderType === ORDER_TYPE.PICKUP ? "🛒 Pickup" : "🚚 Delivery"}
                  </p>
                  <p className="togo-orders-order-time">
                    Placed: {formatTime(order.createdAt)}
                  </p>
                  {order.estimatedReadyTime && (
                    <p className="togo-orders-estimated-time">
                      Est. Ready: {formatTime(order.estimatedReadyTime)}
                    </p>
                  )}
                </div>
                <div className="togo-orders-card-items">
                  {order.items.slice(0, 3).map((item, idx) => (
                    <span key={idx} className="togo-orders-item-preview">
                      {item.name} ×{item.quantity}
                    </span>
                  ))}
                  {order.items.length > 3 && (
                    <span className="togo-orders-item-more">
                      +{order.items.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div
          className="togo-orders-modal-overlay"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="togo-orders-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="togo-orders-modal-header">
              <h3>Order #{selectedOrder.id.substring(0, 8).toUpperCase()}</h3>
              <button
                className="togo-orders-modal-close"
                onClick={() => setSelectedOrder(null)}
              >
                ×
              </button>
            </div>

            <div className="togo-orders-modal-content">
              {/* Customer Info */}
              <div className="togo-orders-modal-section">
                <h4>Customer Information</h4>
                <p><strong>Name:</strong> {selectedOrder.dinerName}</p>
                <p><strong>Phone:</strong> {selectedOrder.dinerPhone}</p>
                {selectedOrder.dinerEmail && (
                  <p><strong>Email:</strong> {selectedOrder.dinerEmail}</p>
                )}
              </div>

              {/* Order Items */}
              <div className="togo-orders-modal-section">
                <h4>Order Items</h4>
                <div className="togo-orders-modal-items">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="togo-orders-modal-item">
                      <div className="togo-orders-modal-item-header">
                        <span>{item.name} ×{item.quantity}</span>
                        <span>${item.subtotal.toFixed(2)}</span>
                      </div>
                      {item.specialInstructions && (
                        <p className="togo-orders-modal-item-note">
                          Note: {item.specialInstructions}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <div className="togo-orders-modal-totals">
                  <div className="togo-orders-modal-total-row">
                    <span>Subtotal</span>
                    <span>${selectedOrder.subtotal.toFixed(2)}</span>
                  </div>
                  {selectedOrder.deliveryFee > 0 && (
                    <div className="togo-orders-modal-total-row">
                      <span>Delivery Fee</span>
                      <span>${selectedOrder.deliveryFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="togo-orders-modal-total-row">
                    <span>Tax</span>
                    <span>${selectedOrder.tax.toFixed(2)}</span>
                  </div>
                  <div className="togo-orders-modal-total-row togo-orders-modal-total-final">
                    <span>Total</span>
                    <span>${selectedOrder.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Pickup/Delivery Info */}
              <div className="togo-orders-modal-section">
                <h4>
                  {selectedOrder.orderType === ORDER_TYPE.PICKUP ? "Pickup" : "Delivery"} Details
                </h4>
                {selectedOrder.orderType === ORDER_TYPE.PICKUP ? (
                  <div>
                    {selectedOrder.pickupInfo?.preferredTime && (
                      <p>
                        <strong>Preferred Time:</strong>{" "}
                        {formatTime(selectedOrder.pickupInfo.preferredTime)}
                      </p>
                    )}
                    {selectedOrder.pickupInfo?.notes && (
                      <p><strong>Notes:</strong> {selectedOrder.pickupInfo.notes}</p>
                    )}
                  </div>
                ) : (
                  <div>
                    {selectedOrder.deliveryInfo?.address && (
                      <div>
                        <p><strong>Delivery Address:</strong></p>
                        <p>
                          {selectedOrder.deliveryInfo.address.line1}
                          {selectedOrder.deliveryInfo.address.line2 &&
                            `, ${selectedOrder.deliveryInfo.address.line2}`}
                          <br />
                          {selectedOrder.deliveryInfo.address.city},{" "}
                          {selectedOrder.deliveryInfo.address.state}{" "}
                          {selectedOrder.deliveryInfo.address.zip}
                        </p>
                      </div>
                    )}
                    {selectedOrder.deliveryInfo?.preferredTime && (
                      <p>
                        <strong>Preferred Time:</strong>{" "}
                        {formatTime(selectedOrder.deliveryInfo.preferredTime)}
                      </p>
                    )}
                    {selectedOrder.deliveryInfo?.notes && (
                      <p><strong>Notes:</strong> {selectedOrder.deliveryInfo.notes}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Status Actions */}
              <div className="togo-orders-modal-actions">
                <h4>Update Status</h4>
                <div className="togo-orders-status-buttons">
                  {selectedOrder.status === ORDER_STATUS.PENDING && (
                    <>
                      <button
                        className="togo-orders-status-btn"
                        onClick={() =>
                          handleStatusUpdate(selectedOrder.id, ORDER_STATUS.CONFIRMED)
                        }
                        disabled={updatingStatus}
                      >
                        Confirm Order
                      </button>
                      <button
                        className="togo-orders-status-btn togo-orders-status-btn-danger"
                        onClick={() => {
                          const reason = window.prompt("Cancellation reason:");
                          if (reason) {
                            handleStatusUpdate(selectedOrder.id, ORDER_STATUS.CANCELLED);
                          }
                        }}
                        disabled={updatingStatus}
                      >
                        Cancel Order
                      </button>
                    </>
                  )}
                  {selectedOrder.status === ORDER_STATUS.CONFIRMED && (
                    <button
                      className="togo-orders-status-btn"
                      onClick={() =>
                        handleStatusUpdate(selectedOrder.id, ORDER_STATUS.PREPARING)
                      }
                      disabled={updatingStatus}
                    >
                      Start Preparing
                    </button>
                  )}
                  {selectedOrder.status === ORDER_STATUS.PREPARING && (
                    <button
                      className="togo-orders-status-btn togo-orders-status-btn-success"
                      onClick={() => {
                        const estimatedTime = window.prompt(
                          "Estimated ready time (minutes from now):",
                          "15"
                        );
                        if (estimatedTime) {
                          const minutes = parseInt(estimatedTime, 10);
                          if (!isNaN(minutes)) {
                            const readyTime = new Date();
                            readyTime.setMinutes(readyTime.getMinutes() + minutes);
                            handleStatusUpdate(
                              selectedOrder.id,
                              ORDER_STATUS.READY,
                              readyTime
                            );
                          }
                        }
                      }}
                      disabled={updatingStatus}
                    >
                      Mark Ready
                    </button>
                  )}
                  {selectedOrder.status === ORDER_STATUS.READY && (
                    <button
                      className="togo-orders-status-btn togo-orders-status-btn-success"
                      onClick={() =>
                        handleStatusUpdate(selectedOrder.id, ORDER_STATUS.PICKED_UP)
                      }
                      disabled={updatingStatus}
                    >
                      Mark Picked Up
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

