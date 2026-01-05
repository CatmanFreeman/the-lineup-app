// src/components/TipShareModal.jsx

import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { createTipShareTransaction } from "../utils/tipshareService";
import "./TipShareModal.css";

export default function TipShareModal({
  isOpen,
  onClose,
  employeeId,
  employeeName,
  restaurantId,
  source = "staff_profile", // "staff_profile", "live_lineup", "review"
  sourceId = null,
}) {
  const { currentUser } = useAuth();
  const [amount, setAmount] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const presetAmounts = [5, 10, 15, 20, 25, 50];

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
      setError("Please log in to send a tip");
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

    setLoading(true);
    setError("");

    try {
      await createTipShareTransaction({
        dinerId: currentUser.uid,
        employeeId,
        restaurantId,
        amount: tipAmount,
        source,
        sourceId,
        note: note.trim() || null,
        dinerName: currentUser.displayName || currentUser.email,
        employeeName,
      });

      setSuccess(true);
      
      // Reset form after 2 seconds
      setTimeout(() => {
        setSuccess(false);
        setAmount("");
        setCustomAmount("");
        setNote("");
        onClose();
      }, 2000);
    } catch (err) {
      console.error("Error sending tip:", err);
      setError(err.message || "Failed to send tip. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="ts-modal-overlay" onClick={onClose}>
      <div className="ts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ts-modal-header">
          <h2>TipShare</h2>
          <button className="ts-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="ts-modal-body">
          {success ? (
            <div className="ts-success">
              <div className="ts-success-icon">✓</div>
              <h3>Tip Sent!</h3>
              <p>Your tip of ${customAmount || amount} has been sent to {employeeName}.</p>
            </div>
          ) : (
            <>
              <div className="ts-employee-info">
                <p className="ts-employee-label">Tipping:</p>
                <p className="ts-employee-name">{employeeName}</p>
              </div>

              <form onSubmit={handleSubmit} className="ts-form">
                <div className="ts-amount-section">
                  <label className="ts-label">Select Amount</label>
                  <div className="ts-preset-amounts">
                    {presetAmounts.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={`ts-preset-btn ${amount === preset.toString() ? "ts-preset-btn-active" : ""}`}
                        onClick={() => handleAmountSelect(preset)}
                      >
                        ${preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="ts-custom-amount">
                  <label className="ts-label">Or Enter Custom Amount</label>
                  <div className="ts-custom-input-wrapper">
                    <span className="ts-currency">$</span>
                    <input
                      type="number"
                      min="0.01"
                      max="1000"
                      step="0.01"
                      value={customAmount}
                      onChange={handleCustomAmountChange}
                      placeholder="0.00"
                      className="ts-custom-input"
                    />
                  </div>
                </div>

                <div className="ts-note-section">
                  <label className="ts-label">Add a Note (Optional)</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Thank you for great service!"
                    className="ts-note-input"
                    rows={3}
                    maxLength={200}
                  />
                  <div className="ts-note-count">{note.length}/200</div>
                </div>

                {error && <div className="ts-error">{error}</div>}

                <div className="ts-modal-footer">
                  <button
                    type="button"
                    className="ts-btn ts-btn-secondary"
                    onClick={onClose}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="ts-btn ts-btn-primary"
                    disabled={loading || (!amount && !customAmount)}
                  >
                    {loading ? "Sending..." : `Send $${customAmount || amount || "0.00"}`}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}