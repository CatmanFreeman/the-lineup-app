// src/pages/ValetPayment/ValetPaymentPage.jsx
//
// VALET PAYMENT PAGE
//
// Allows diners to pay for valet service
// - Select car
// - Select payment method (or add new)
// - Pay for valet service
// - Optional: Tip valet driver

import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../hooks/services/firebase";
import {
  getStoredPaymentMethods,
  processValetPayment,
} from "../../utils/stripeService";
import { getAllValetCompaniesWithLocations } from "../../utils/valetCompanyLocationService";
import { getValetCompany } from "../../utils/valetCompanyService";
import "./ValetPaymentPage.css";

export default function ValetPaymentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const locationId = searchParams.get("locationId");
  const restaurantId = searchParams.get("restaurantId");
  const valetCompanyId = searchParams.get("valetCompanyId");
  const amount = parseFloat(searchParams.get("amount")) || 6.00; // Default $6
  
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [location, setLocation] = useState(null);
  const [valetCompany, setValetCompany] = useState(null);
  const [userVehicles, setUserVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false);
  const [tipAmount, setTipAmount] = useState(0);
  const [tipNote, setTipNote] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
      return;
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, locationId, restaurantId, valetCompanyId]);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      // Load location
      if (locationId) {
        const companies = await getAllValetCompaniesWithLocations();
        for (const company of companies) {
          const loc = company.locations.find((l) => l.id === locationId);
          if (loc) {
            setLocation(loc);
            setValetCompany(company);
            break;
          }
        }
      } else if (valetCompanyId) {
        const company = await getValetCompany(valetCompanyId);
        setValetCompany(company);
      }

      // Load user vehicles
      const userRef = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        setUserVehicles(userData.vehicles || []);
        if (userData.vehicles && userData.vehicles.length > 0) {
          setSelectedVehicle(userData.vehicles[0]);
        }
      }

      // Load payment methods
      const methods = await getStoredPaymentMethods(currentUser.uid);
      setPaymentMethods(methods);
      if (methods.length > 0) {
        setSelectedPaymentMethod(methods[0]);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      setError("Failed to load payment information. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const handlePayment = async (e) => {
    e.preventDefault();
    
    if (!selectedPaymentMethod) {
      setError("Please select a payment method");
      return;
    }

    if (!selectedVehicle && userVehicles.length > 0) {
      setError("Please select a vehicle");
      return;
    }

    setProcessing(true);
    setError("");

    try {
      // Process valet payment
      await processValetPayment({
        userId: currentUser.uid,
        valetCompanyId: valetCompany?.id || valetCompanyId,
        locationId,
        restaurantId,
        amount,
        paymentMethodId: selectedPaymentMethod.stripePaymentMethodId || selectedPaymentMethod.id,
        description: `Valet service at ${location?.name || valetCompany?.name || "location"}`,
      });

      // Process pre-tip if provided
      if (tipAmount > 0) {
        // Get valet driver ID from pre-booking or ticket
        const valetDriverId = searchParams.get("valetDriverId");
        if (valetDriverId) {
          try {
            const { processValetTip } = await import("../../utils/stripeService");
            await processValetTip({
              dinerId: currentUser.uid,
              valetDriverId,
              valetCompanyId: valetCompany?.id || valetCompanyId,
              restaurantId,
              locationId,
              amount: tipAmount,
              paymentMethodId: selectedPaymentMethod.stripePaymentMethodId || selectedPaymentMethod.id,
              note: tipNote.trim() || "Pre-tip",
            });
          } catch (tipError) {
            console.error("Error processing pre-tip:", tipError);
            // Continue even if tip fails
          }
        }
      }

      setSuccess(true);
      
      // Redirect after 2 seconds
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (error) {
      console.error("Error processing payment:", error);
      setError(error.message || "Payment failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="valet-payment-page">
        <div className="valet-payment-loading">Loading...</div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="valet-payment-page">
        <div className="valet-payment-success">
          <h2>✓ Payment Successful!</h2>
          <p>Your valet service has been paid for.</p>
          <p>Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="valet-payment-page">
      <div className="valet-payment-container">
        <div className="valet-payment-header">
          <h1>Pay for Valet Service</h1>
          <button className="valet-payment-back" onClick={() => navigate(-1)}>
            ← Back
          </button>
        </div>

        {error && (
          <div className="valet-payment-error">
            {error}
          </div>
        )}

        <form onSubmit={handlePayment} className="valet-payment-form">
          {/* Location Info */}
          <div className="valet-payment-section">
            <h2>Location</h2>
            <div className="valet-payment-info-card">
              <h3>{location?.name || valetCompany?.name || "Valet Service"}</h3>
              {location?.address && <p>{location.address}</p>}
              <div className="valet-payment-amount">
                <span>Amount:</span>
                <span className="valet-payment-amount-value">${amount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Vehicle Selection */}
          {userVehicles.length > 0 && (
            <div className="valet-payment-section">
              <h2>Select Vehicle</h2>
              <div className="valet-payment-vehicle-list">
                {userVehicles.map((vehicle, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`valet-payment-vehicle-card ${
                      selectedVehicle === vehicle ? "selected" : ""
                    }`}
                    onClick={() => setSelectedVehicle(vehicle)}
                  >
                    <div className="valet-payment-vehicle-info">
                      <h4>
                        {vehicle.make} {vehicle.model}
                      </h4>
                      <p>
                        {vehicle.color} • {vehicle.licensePlate}
                      </p>
                    </div>
                    {selectedVehicle === vehicle && (
                      <div className="valet-payment-vehicle-check">✓</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Payment Method Selection */}
          <div className="valet-payment-section">
            <h2>Payment Method</h2>
            {paymentMethods.length > 0 ? (
              <div className="valet-payment-method-list">
                {paymentMethods.map((method) => (
                  <button
                    key={method.id}
                    type="button"
                    className={`valet-payment-method-card ${
                      selectedPaymentMethod?.id === method.id ? "selected" : ""
                    }`}
                    onClick={() => setSelectedPaymentMethod(method)}
                  >
                    <div className="valet-payment-method-info">
                      <div className="valet-payment-method-brand">
                        {method.brand ? (
                          <span className={`valet-payment-brand valet-payment-brand-${method.brand.toLowerCase()}`}>
                            {method.brand.toUpperCase()}
                          </span>
                        ) : (
                          <span className="valet-payment-brand">CARD</span>
                        )}
                      </div>
                      <div className="valet-payment-method-details">
                        <span>•••• {method.last4 || "0000"}</span>
                        {method.expMonth && method.expYear && (
                          <span>
                            {method.expMonth}/{method.expYear}
                          </span>
                        )}
                      </div>
                      {method.isDefault && (
                        <span className="valet-payment-method-default">Default</span>
                      )}
                    </div>
                    {selectedPaymentMethod?.id === method.id && (
                      <div className="valet-payment-method-check">✓</div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="valet-payment-no-methods">
                <p>No payment methods saved</p>
                <button
                  type="button"
                  className="valet-payment-btn valet-payment-btn-secondary"
                  onClick={() => setShowAddPaymentMethod(true)}
                >
                  Add Payment Method
                </button>
              </div>
            )}
            
            {showAddPaymentMethod && (
              <div className="valet-payment-add-method">
                <p>Payment method integration coming soon...</p>
                <p>For now, please use a saved payment method.</p>
                <button
                  type="button"
                  className="valet-payment-btn valet-payment-btn-secondary"
                  onClick={() => setShowAddPaymentMethod(false)}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Optional Tip */}
          <div className="valet-payment-section">
            <h2>Tip Valet Driver (Optional)</h2>
            <div className="valet-payment-tip-options">
              {[2, 3, 5, 10].map((tip) => (
                <button
                  key={tip}
                  type="button"
                  className={`valet-payment-tip-btn ${
                    tipAmount === tip ? "selected" : ""
                  }`}
                  onClick={() => setTipAmount(tip)}
                >
                  ${tip}
                </button>
              ))}
              <input
                type="number"
                className="valet-payment-tip-custom"
                placeholder="Custom"
                min="0"
                step="0.01"
                value={tipAmount > 0 && ![2, 3, 5, 10].includes(tipAmount) ? tipAmount : ""}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  setTipAmount(value);
                }}
              />
            </div>
            {tipAmount > 0 && (
              <textarea
                className="valet-payment-tip-note"
                placeholder="Add a note (optional)"
                value={tipNote}
                onChange={(e) => setTipNote(e.target.value)}
                rows={3}
              />
            )}
          </div>

          {/* Total */}
          <div className="valet-payment-total">
            <div className="valet-payment-total-row">
              <span>Valet Service</span>
              <span>${amount.toFixed(2)}</span>
            </div>
            {tipAmount > 0 && (
              <div className="valet-payment-total-row">
                <span>Tip</span>
                <span>${tipAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="valet-payment-total-row valet-payment-total-final">
              <span>Total</span>
              <span>${(amount + tipAmount).toFixed(2)}</span>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="valet-payment-btn valet-payment-btn-primary"
            disabled={processing || !selectedPaymentMethod}
          >
            {processing ? "Processing..." : `Pay $${(amount + tipAmount).toFixed(2)}`}
          </button>
        </form>
      </div>
    </div>
  );
}

