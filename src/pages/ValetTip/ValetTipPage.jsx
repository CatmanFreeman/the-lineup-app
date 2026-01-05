// src/pages/ValetTip/ValetTipPage.jsx
//
// VALET TIP PAGE
//
// Diner can tip valet driver when car is ready
// Valet tips are separate from FOH tip pool

import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../hooks/services/firebase";
import { tipValetDriver } from "../../utils/valetService";
import { processValetTip, getStoredPaymentMethods } from "../../utils/stripeService";
import "./ValetTipPage.css";

export default function ValetTipPage() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const restaurantId = searchParams.get("restaurantId");
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [amount, setAmount] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [note, setNote] = useState("");
  const [tipping, setTipping] = useState(false);
  const [success, setSuccess] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);

  const presetAmounts = [5, 10, 15, 20, 25, 50];

  useEffect(() => {
    loadTicket();
  }, [ticketId]);

  useEffect(() => {
    if (currentUser) {
      loadPaymentMethods();
    }
  }, [currentUser]);

  const loadPaymentMethods = async () => {
    if (!currentUser) return;
    try {
      const methods = await getStoredPaymentMethods(currentUser.uid);
      setPaymentMethods(methods);
      if (methods.length > 0) {
        setSelectedPaymentMethod(methods[0]);
      }
    } catch (error) {
      console.error("Error loading payment methods:", error);
    }
  };

  const loadTicket = async () => {
    if (!ticketId || !restaurantId) {
      setError("Missing ticket or restaurant information");
      setLoading(false);
      return;
    }

    try {
      // Get ticket by ID directly
      const ticketRef = doc(db, "restaurants", restaurantId, "valetTickets", ticketId);
      const ticketSnap = await getDoc(ticketRef);
      
      if (ticketSnap.exists()) {
        setTicket({
          id: ticketSnap.id,
          ...ticketSnap.data(),
        });
      } else {
        setError("Ticket not found");
      }
      setLoading(false);
    } catch (err) {
      console.error("Error loading ticket:", err);
      setError("Failed to load ticket information");
      setLoading(false);
    }
  };

  const handleAmountSelect = (value) => {
    setAmount(value.toString());
    setCustomAmount("");
  };

  const handleCustomAmountChange = (e) => {
    const value = e.target.value;
    setCustomAmount(value);
    if (value) {
      setAmount("");
    }
  };

  const handleTip = async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
      setError("Please log in to tip the valet");
      return;
    }

    if (!ticket) {
      setError("Ticket information not available");
      return;
    }

    const tipAmount = customAmount ? parseFloat(customAmount) : parseFloat(amount);
    
    if (!tipAmount || tipAmount <= 0) {
      setError("Please enter a valid tip amount");
      return;
    }

    if (tipAmount > 1000) {
      setError("Maximum tip amount is $1,000");
      return;
    }

    if (!selectedPaymentMethod && paymentMethods.length > 0) {
      setError("Please select a payment method");
      return;
    }

    setTipping(true);
    setError("");

    try {
      // Use Stripe payment for tip if payment method available
      if (selectedPaymentMethod && paymentMethods.length > 0) {
        // Get valet company ID from ticket
        const valetCompanyId = ticket.valetCompanyId || null;
        
        await processValetTip({
          dinerId: currentUser.uid,
          valetDriverId: ticket.valetEmployeeId || null,
          valetCompanyId,
          restaurantId: restaurantId || ticket.restaurantId,
          locationId: ticket.locationId || null,
          amount: tipAmount,
          paymentMethodId: selectedPaymentMethod.stripePaymentMethodId || selectedPaymentMethod.id,
          note: note.trim() || null,
        });
      } else {
        // Fallback to old TipShare method (no payment processing)
        await tipValetDriver(restaurantId || ticket.restaurantId, ticketId, currentUser.uid, tipAmount, note.trim() || null);
      }
      
      setSuccess(true);
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (err) {
      console.error("Error tipping valet:", err);
      setError(err.message || "Failed to send tip. Please try again.");
    } finally {
      setTipping(false);
    }
  };

  if (loading) {
    return (
      <div className="valet-tip-container">
        <div className="valet-tip-loading">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !ticket) {
    return (
      <div className="valet-tip-container">
        <div className="valet-tip-error">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="valet-tip-container">
        <div className="valet-tip-card">
          <div className="success-message">
            <h2>✓ Tip Sent!</h2>
            <p>Thank you for tipping your valet driver.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="valet-tip-container">
      <div className="valet-tip-card">
        <h2>Tip Your Valet Driver</h2>
        <p className="tip-subtitle">
          Your car is ready! Show your appreciation with a tip.
        </p>

        {ticket && (
          <div className="ticket-info">
            <p><strong>Valet:</strong> {ticket.valetEmployeeName || "Valet Driver"}</p>
            <p><strong>Ticket:</strong> {ticket.ticketNumber || ticket.id.substring(0, 8)}</p>
          </div>
        )}

        <form onSubmit={handleTip}>
          <div className="tip-amounts">
            <label>Select Tip Amount</label>
            <div className="preset-amounts">
              {presetAmounts.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleAmountSelect(preset)}
                  className={`preset-btn ${amount === preset.toString() ? "active" : ""}`}
                >
                  ${preset}
                </button>
              ))}
            </div>
            
            <div className="custom-amount">
              <label>Or enter custom amount</label>
              <input
                type="number"
                min="1"
                max="1000"
                step="0.01"
                value={customAmount}
                onChange={handleCustomAmountChange}
                placeholder="Enter amount"
              />
            </div>
          </div>

          <div className="tip-note">
            <label>Add a note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Thank you for great service!"
              maxLength={200}
              rows={3}
            />
          </div>

          {error && (
            <div className="tip-error">
              {error}
            </div>
          )}

          <div className="tip-actions">
            <button
              type="submit"
              disabled={tipping || (!amount && !customAmount)}
              className="tip-submit-btn"
            >
              {tipping ? "Sending..." : `Send $${customAmount || amount || "0"} Tip`}
            </button>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="tip-skip-btn"
            >
              Skip
            </button>
          </div>

          <p className="tip-info">
            Valet tips are separate from restaurant staff tips. Your tip goes directly to the valet driver.
          </p>
        </form>
      </div>
    </div>
  );
}

