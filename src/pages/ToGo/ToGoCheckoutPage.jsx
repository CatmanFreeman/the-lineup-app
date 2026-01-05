// src/pages/ToGo/ToGoCheckoutPage.jsx
//
// TO-GO CHECKOUT PAGE
//
// Checkout flow for To-Go orders
// - Review order
// - Select pickup/delivery
// - Enter contact info
// - Select payment method
// - Place order

import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../../hooks/services/firebase";
import { getStoredPaymentMethods } from "../../utils/stripeService";
import { createToGoOrder, ORDER_TYPE } from "../../utils/togoOrderService";
import { processValetPayment } from "../../utils/stripeService";
import { createTipShareTransaction } from "../../utils/tipshareService";
import "./ToGoCheckoutPage.css";

export default function ToGoCheckoutPage() {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();

  const cart = location.state?.cart || [];
  const restaurant = location.state?.restaurant || null;

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [restaurantData, setRestaurantData] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);

  // Order details
  const [orderType, setOrderType] = useState(ORDER_TYPE.PICKUP);
  const [dinerName, setDinerName] = useState(currentUser?.displayName || "");
  const [dinerPhone, setDinerPhone] = useState("");
  const [dinerEmail, setDinerEmail] = useState(currentUser?.email || "");
  const [pickupTime, setPickupTime] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState({
    line1: "",
    line2: "",
    city: "",
    state: "",
    zip: "",
  });
  const [deliveryTime, setDeliveryTime] = useState("");
  const [orderNotes, setOrderNotes] = useState("");

  // Tip state
  const [tipAmount, setTipAmount] = useState(0);
  const [tipPercentage, setTipPercentage] = useState(null);
  const [toGoWorker, setToGoWorker] = useState(null);
  const [bohEmployees, setBohEmployees] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      navigate(`/login?redirect=/togo/${restaurantId}/checkout`);
      return;
    }

    if (cart.length === 0) {
      navigate(`/togo/${restaurantId}`);
      return;
    }

    loadCheckoutData();
  }, [currentUser, restaurantId, cart.length, navigate]);

  async function loadCheckoutData() {
    try {
      setLoading(true);

      // Load restaurant if not provided
      if (!restaurant) {
        const restaurantRef = doc(db, "restaurants", restaurantId);
        const restaurantSnap = await getDoc(restaurantRef);
        if (restaurantSnap.exists()) {
          setRestaurantData({
            id: restaurantSnap.id,
            ...restaurantSnap.data(),
          });
        }
      } else {
        setRestaurantData(restaurant);
      }

      // Load payment methods
      const methods = await getStoredPaymentMethods(currentUser.uid);
      setPaymentMethods(methods);
      if (methods.length > 0) {
        const defaultMethod = methods.find((m) => m.isDefault) || methods[0];
        setSelectedPaymentMethod(defaultMethod);
      }

      // Load to-go worker and BOH employees
      await loadToGoStaff();
    } catch (err) {
      console.error("Error loading checkout data:", err);
      setError("Failed to load checkout data");
    } finally {
      setLoading(false);
    }
  }

  async function loadToGoStaff() {
    try {
      setLoadingStaff(true);
      const staffRef = collection(db, "restaurants", restaurantId, "staff");
      const staffSnap = await getDocs(staffRef);

      const allStaff = [];
      staffSnap.forEach((docSnap) => {
        const data = docSnap.data();
        allStaff.push({
          id: docSnap.id,
          uid: data.uid || docSnap.id,
          name: data.name,
          role: data.role,
          subRole: data.subRole,
        });
      });

      // Find to-go worker (look for "to-go", "togo", "takeout", etc. in subRole)
      const toGoWorker = allStaff.find((s) => {
        const subRoleLower = (s.subRole || "").toLowerCase();
        return (
          s.role === "Front of House" &&
          (subRoleLower.includes("to-go") ||
            subRoleLower.includes("togo") ||
            subRoleLower.includes("takeout") ||
            subRoleLower.includes("take-out") ||
            subRoleLower.includes("to go"))
        );
      });

      // Get BOH employees
      const boh = allStaff.filter((s) => s.role === "Back of House");

      setToGoWorker(toGoWorker || null);
      setBohEmployees(boh);
    } catch (err) {
      console.error("Error loading to-go staff:", err);
    } finally {
      setLoadingStaff(false);
    }
  }

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = subtotal * 0.08; // 8% tax
    const deliveryFee = orderType === ORDER_TYPE.DELIVERY ? 5.00 : 0; // $5 delivery fee
    const tip = tipAmount || 0;
    const total = subtotal + tax + deliveryFee + tip;

    return { subtotal, tax, deliveryFee, tip, total };
  };

  const handleTipPercentage = (percentage) => {
    const totals = calculateTotals();
    const amount = Math.round(totals.subtotal * percentage);
    setTipAmount(amount);
    setTipPercentage(percentage);
  };

  const handleTipAmountChange = (value) => {
    const amount = Math.max(0, parseFloat(value) || 0);
    setTipAmount(amount);
    setTipPercentage(null);
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!dinerName.trim()) {
      setError("Please enter your name");
      return;
    }

    if (!dinerPhone.trim()) {
      setError("Please enter your phone number");
      return;
    }

    if (!selectedPaymentMethod) {
      setError("Please select a payment method");
      return;
    }

    if (orderType === ORDER_TYPE.DELIVERY) {
      if (!deliveryAddress.line1.trim() || !deliveryAddress.city.trim() || !deliveryAddress.zip.trim()) {
        setError("Please enter a complete delivery address");
        return;
      }
    }

    setProcessing(true);

    try {
      const totals = calculateTotals();

      // Process payment first (order total includes tip)
      // Note: In production, this should call a Cloud Function
      const paymentResult = await processValetPayment({
        userId: currentUser.uid,
        valetCompanyId: null, // Not a valet payment
        restaurantId,
        amount: totals.total,
        paymentMethodId: selectedPaymentMethod.stripePaymentMethodId || selectedPaymentMethod.id,
        description: `To-Go order from ${restaurantData?.name || "restaurant"}${totals.tip > 0 ? ` (includes $${totals.tip.toFixed(2)} tip)` : ""}`,
      });

      // Create order first
      const orderId = await createToGoOrder({
        restaurantId,
        dinerId: currentUser.uid,
        dinerName: dinerName.trim(),
        dinerPhone: dinerPhone.trim(),
        dinerEmail: dinerEmail.trim() || null,
        items: cart,
        orderType,
        pickupInfo: orderType === ORDER_TYPE.PICKUP
          ? {
              preferredTime: pickupTime || null,
              notes: orderNotes.trim() || null,
            }
          : null,
        deliveryInfo: orderType === ORDER_TYPE.DELIVERY
          ? {
              address: deliveryAddress,
              preferredTime: deliveryTime || null,
              notes: orderNotes.trim() || null,
            }
          : null,
        subtotal: totals.subtotal,
        tax: totals.tax,
        deliveryFee: totals.deliveryFee,
        tip: totals.tip || 0,
        total: totals.total,
        paymentMethodId: selectedPaymentMethod.stripePaymentMethodId || selectedPaymentMethod.id,
        paymentIntentId: paymentResult.transactionId,
        toGoWorkerId: toGoWorker?.uid || toGoWorker?.id || null,
        toGoWorkerName: toGoWorker?.name || null,
      });

      // Process tip if provided (70% to to-go worker, 30% to BOH)
      if (tipAmount > 0 && toGoWorker && bohEmployees.length > 0) {
        const toGoWorkerTip = tipAmount * 0.7; // 70% to to-go worker
        const bohTipTotal = tipAmount * 0.3; // 30% to BOH
        const bohTipPerEmployee = bohTipTotal / bohEmployees.length; // Split equally

        const tipPromises = [];

        // Tip to-go worker
        tipPromises.push(
          createTipShareTransaction({
            dinerId: currentUser.uid,
            employeeId: toGoWorker.uid || toGoWorker.id,
            restaurantId,
            amount: toGoWorkerTip,
            source: "togo_order",
            sourceId: orderId,
            note: `Tip from To-Go order #${orderId.substring(0, 8).toUpperCase()}`,
            dinerName: dinerName.trim(),
            employeeName: toGoWorker.name,
          })
        );

        // Tip BOH employees
        bohEmployees.forEach((emp) => {
          tipPromises.push(
            createTipShareTransaction({
              dinerId: currentUser.uid,
              employeeId: emp.uid || emp.id,
              restaurantId,
              amount: bohTipPerEmployee,
              source: "togo_order",
              sourceId: orderId,
              note: `Tip from To-Go order #${orderId.substring(0, 8).toUpperCase()} (BOH split)`,
              dinerName: dinerName.trim(),
              employeeName: emp.name,
            })
          );
        });

        // Process all tips (don't wait - let them process in background)
        Promise.all(tipPromises).catch((err) => {
          console.error("Error processing tips:", err);
          // Don't fail the order if tip processing fails
        });
      }

      // Clear cart
      localStorage.removeItem(`togo_cart_${restaurantId}`);

      // Navigate to order tracking
      navigate(`/togo/order/${orderId}?restaurantId=${restaurantId}`);
    } catch (err) {
      console.error("Error placing order:", err);
      setError(err.message || "Failed to place order. Please try again.");
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="togo-checkout-page">
        <div className="togo-checkout-loading">Loading checkout...</div>
      </div>
    );
  }

  const totals = calculateTotals();

  return (
    <div className="togo-checkout-page">
      <div className="togo-checkout-container">
        <div className="togo-checkout-header">
          <button
            className="togo-checkout-back"
            onClick={() => navigate(`/togo/${restaurantId}`)}
          >
            ← Back to Menu
          </button>
          <h1>Checkout</h1>
        </div>

        <div className="togo-checkout-content">
          {/* Order Review */}
          <div className="togo-checkout-section">
            <h2>Order Review</h2>
            <div className="togo-checkout-items">
              {cart.map((item) => (
                <div key={item.menuItemId} className="togo-checkout-item">
                  <div className="togo-checkout-item-info">
                    <span className="togo-checkout-item-name">{item.name}</span>
                    <span className="togo-checkout-item-quantity">×{item.quantity}</span>
                  </div>
                  <span className="togo-checkout-item-price">
                    ${(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <div className="togo-checkout-totals">
              <div className="togo-checkout-total-row">
                <span>Subtotal</span>
                <span>${totals.subtotal.toFixed(2)}</span>
              </div>
              {totals.deliveryFee > 0 && (
                <div className="togo-checkout-total-row">
                  <span>Delivery Fee</span>
                  <span>${totals.deliveryFee.toFixed(2)}</span>
                </div>
              )}
              <div className="togo-checkout-total-row">
                <span>Tax</span>
                <span>${totals.tax.toFixed(2)}</span>
              </div>
              {totals.tip > 0 && (
                <div className="togo-checkout-total-row">
                  <span>Tip</span>
                  <span>${totals.tip.toFixed(2)}</span>
                </div>
              )}
              <div className="togo-checkout-total-row togo-checkout-total-final">
                <span>Total</span>
                <span>${totals.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Order Form */}
          <form className="togo-checkout-form" onSubmit={handlePlaceOrder}>
            {/* Order Type */}
            <div className="togo-checkout-section">
              <h2>Order Type</h2>
              <div className="togo-order-type-selector">
                <button
                  type="button"
                  className={`togo-order-type-btn ${orderType === ORDER_TYPE.PICKUP ? "active" : ""}`}
                  onClick={() => setOrderType(ORDER_TYPE.PICKUP)}
                >
                  Pickup
                </button>
                <button
                  type="button"
                  className={`togo-order-type-btn ${orderType === ORDER_TYPE.DELIVERY ? "active" : ""}`}
                  onClick={() => setOrderType(ORDER_TYPE.DELIVERY)}
                >
                  Delivery (+$5.00)
                </button>
              </div>
            </div>

            {/* Contact Information */}
            <div className="togo-checkout-section">
              <h2>Contact Information</h2>
              <div className="togo-checkout-form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={dinerName}
                  onChange={(e) => setDinerName(e.target.value)}
                  required
                />
              </div>
              <div className="togo-checkout-form-group">
                <label>Phone *</label>
                <input
                  type="tel"
                  value={dinerPhone}
                  onChange={(e) => setDinerPhone(e.target.value)}
                  placeholder="(555) 555-5555"
                  required
                />
              </div>
              <div className="togo-checkout-form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={dinerEmail}
                  onChange={(e) => setDinerEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Pickup/Delivery Details */}
            {orderType === ORDER_TYPE.PICKUP ? (
              <div className="togo-checkout-section">
                <h2>Pickup Details</h2>
                <div className="togo-checkout-form-group">
                  <label>Preferred Pickup Time</label>
                  <input
                    type="datetime-local"
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                  />
                </div>
              </div>
            ) : (
              <div className="togo-checkout-section">
                <h2>Delivery Address</h2>
                <div className="togo-checkout-form-group">
                  <label>Street Address *</label>
                  <input
                    type="text"
                    value={deliveryAddress.line1}
                    onChange={(e) =>
                      setDeliveryAddress({ ...deliveryAddress, line1: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="togo-checkout-form-group">
                  <label>Apartment, suite, etc.</label>
                  <input
                    type="text"
                    value={deliveryAddress.line2}
                    onChange={(e) =>
                      setDeliveryAddress({ ...deliveryAddress, line2: e.target.value })
                    }
                  />
                </div>
                <div className="togo-checkout-form-row">
                  <div className="togo-checkout-form-group">
                    <label>City *</label>
                    <input
                      type="text"
                      value={deliveryAddress.city}
                      onChange={(e) =>
                        setDeliveryAddress({ ...deliveryAddress, city: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="togo-checkout-form-group">
                    <label>State *</label>
                    <input
                      type="text"
                      value={deliveryAddress.state}
                      onChange={(e) =>
                        setDeliveryAddress({ ...deliveryAddress, state: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="togo-checkout-form-group">
                    <label>ZIP Code *</label>
                    <input
                      type="text"
                      value={deliveryAddress.zip}
                      onChange={(e) =>
                        setDeliveryAddress({ ...deliveryAddress, zip: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>
                <div className="togo-checkout-form-group">
                  <label>Preferred Delivery Time</label>
                  <input
                    type="datetime-local"
                    value={deliveryTime}
                    onChange={(e) => setDeliveryTime(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                  />
                </div>
              </div>
            )}

            {/* Order Notes */}
            <div className="togo-checkout-section">
              <h2>Special Instructions</h2>
              <div className="togo-checkout-form-group">
                <textarea
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Any special instructions for your order..."
                  maxLength={500}
                  rows={4}
                />
              </div>
            </div>

            {/* Tip Section */}
            <div className="togo-checkout-section">
              <h2>Tip Your To-Go Worker</h2>
              {loadingStaff ? (
                <p>Loading staff information...</p>
              ) : toGoWorker ? (
                <>
                  <p className="togo-tip-info">
                    Tip {toGoWorker.name} and the kitchen staff
                    <br />
                    <small>70% to {toGoWorker.name}, 30% split among kitchen staff</small>
                  </p>
                  <div className="togo-tip-input-group">
                    <div className="togo-tip-percentage-buttons">
                      <button
                        type="button"
                        className={`togo-tip-percentage-btn ${tipPercentage === 0.15 ? "active" : ""}`}
                        onClick={() => handleTipPercentage(0.15)}
                      >
                        15%
                      </button>
                      <button
                        type="button"
                        className={`togo-tip-percentage-btn ${tipPercentage === 0.18 ? "active" : ""}`}
                        onClick={() => handleTipPercentage(0.18)}
                      >
                        18%
                      </button>
                      <button
                        type="button"
                        className={`togo-tip-percentage-btn ${tipPercentage === 0.20 ? "active" : ""}`}
                        onClick={() => handleTipPercentage(0.20)}
                      >
                        20%
                      </button>
                      <button
                        type="button"
                        className={`togo-tip-percentage-btn ${tipPercentage === 0.22 ? "active" : ""}`}
                        onClick={() => handleTipPercentage(0.22)}
                      >
                        22%
                      </button>
                    </div>
                    <div className="togo-tip-custom-input">
                      <label>Custom Tip Amount</label>
                      <div className="togo-tip-amount-wrapper">
                        <span className="togo-tip-dollar-sign">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={tipAmount || ""}
                          onChange={(e) => handleTipAmountChange(e.target.value)}
                          placeholder="0.00"
                          className="togo-tip-amount-input"
                        />
                      </div>
                    </div>
                    {tipAmount > 0 && (
                      <div className="togo-tip-breakdown">
                        <p>
                          <strong>{toGoWorker.name}:</strong> ${(tipAmount * 0.7).toFixed(2)}
                        </p>
                        <p>
                          <strong>Kitchen Staff ({bohEmployees.length}):</strong> ${(tipAmount * 0.3).toFixed(2)} total
                          {bohEmployees.length > 0 && (
                            <span> (${(tipAmount * 0.3 / bohEmployees.length).toFixed(2)} each)</span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className="togo-tip-no-worker">
                  No to-go worker assigned. Tips will be split among available staff.
                </p>
              )}
            </div>

            {/* Payment Method */}
            <div className="togo-checkout-section">
              <h2>Payment Method</h2>
              {paymentMethods.length === 0 ? (
                <div className="togo-checkout-no-payment">
                  <p>No saved payment methods. Please add one in your profile settings.</p>
                  <button
                    type="button"
                    onClick={() => navigate("/profile-settings")}
                    className="togo-checkout-add-payment"
                  >
                    Add Payment Method
                  </button>
                </div>
              ) : (
                <div className="togo-checkout-payment-methods">
                  {paymentMethods.map((method) => (
                    <div
                      key={method.id}
                      className={`togo-checkout-payment-method ${
                        selectedPaymentMethod?.id === method.id ? "selected" : ""
                      }`}
                      onClick={() => setSelectedPaymentMethod(method)}
                    >
                      <div className="togo-payment-method-info">
                        <span className="togo-payment-method-brand">
                          {method.brand?.toUpperCase() || "CARD"}
                        </span>
                        <span className="togo-payment-method-last4">
                          •••• {method.last4}
                        </span>
                        {method.isDefault && (
                          <span className="togo-payment-method-default">Default</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="togo-checkout-error">{error}</div>
            )}

            <button
              type="submit"
              className="togo-checkout-submit"
              disabled={processing || !selectedPaymentMethod}
            >
              {processing ? "Processing..." : `Place Order - $${totals.total.toFixed(2)}`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

