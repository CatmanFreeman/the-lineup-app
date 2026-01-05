import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import { db } from "../../hooks/services/firebase";
import { uploadImage } from "../../utils/uploadImage";
import { getStoredPaymentMethods, savePaymentMethod, getOrCreateStripeCustomer } from "../../utils/stripeService";
import "../ProfileSettings/ProfileSettings.css";
import profilePlaceholder from "../../assets/images/profile_placeholder_chef.jpg";
import { CUISINE_OPTIONS } from "../../constants/cuisineOptions";

// Use centralized cuisine options
const CUISINES = CUISINE_OPTIONS;

const PREFERENCES = [
  "Gluten Free",
  "Vegetarian",
  "Pescatarian",
  "Wheelchair Accessible",
  "Blind",
  "Deaf",
];

export default function ProfileSettings() {
  const auth = getAuth();
  const user = auth.currentUser;
  const isAuthed = !!user;
  const navigate = useNavigate();

  // Check if user is anthony.doby@gmail.com for employee profile toggle
  const isAnthonyDoby = user?.email?.toLowerCase() === "anthony.doby@gmail.com";

  // -----------------------------
  // STATE (hooks ALWAYS run)
  // -----------------------------
  const [imageURL, setImageURL] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");

  const [favoriteCuisines, setFavoriteCuisines] = useState([]);
  const [preferences, setPreferences] = useState([]);

  // Primary + additional addresses (index 0 = primary)
  const [addresses, setAddresses] = useState([
    { line1: "", line2: "", city: "", state: "", zip: "" },
  ]);

  // Payment Methods
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [showAddCard, setShowAddCard] = useState(false);
  const [addingCard, setAddingCard] = useState(false);
  const [cardForm, setCardForm] = useState({
    cardNumber: "",
    expiryDate: "",
    cvv: "",
    cardholderName: "",
    zipCode: "",
  });

  // Car Information for Valet
  const [vehicles, setVehicles] = useState([
    { licensePlate: "", make: "", model: "", color: "" },
  ]);

  // -----------------------------
  // LOAD PROFILE (only if signed in)
  // -----------------------------
  useEffect(() => {
    async function loadProfile() {
      // If not signed in, do NOT block the page. Just show defaults.
      if (!user) return;

      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);

      setEmail(user.email || "");

      if (snap.exists()) {
        const data = snap.data();

        setImageURL(data.imageURL || "");
        setFullName(data.fullName || "");
        setUsername(data.username || "");
        setBio(data.bio || "");
        setFavoriteCuisines(data.favoriteCuisines || []);
        setPreferences(data.preferences || []);

        if (Array.isArray(data.addresses) && data.addresses.length > 0) {
          setAddresses(data.addresses);
        } else if (data.address) {
          setAddresses([data.address]);
        }

        // Load vehicles for valet
        if (Array.isArray(data.vehicles) && data.vehicles.length > 0) {
          setVehicles(data.vehicles);
        } else if (data.vehicle) {
          // Support single vehicle format for backward compatibility
          setVehicles([data.vehicle]);
        }
      }
    }

    async function loadPaymentMethods() {
      if (!user) return;
      try {
        const methods = await getStoredPaymentMethods(user.uid);
        setPaymentMethods(methods);
      } catch (error) {
        console.error("Error loading payment methods:", error);
      }
    }

    loadProfile();
    loadPaymentMethods();
  }, [user]);

  // -----------------------------
  // IMAGE UPLOAD (only if signed in)
  // -----------------------------
  async function handleImageChange(e) {
    if (!user) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const url = await uploadImage(file, `users/${user.uid}/profile`);
    setImageURL(url);
  }

  // -----------------------------
  // SAVE PROFILE (only if signed in)
  // -----------------------------
  async function handleSave() {
    if (!user) return;

    await setDoc(
      doc(db, "users", user.uid),
      {
        imageURL,
        fullName,
        username,
        email: user.email || email || "",
        bio,
        favoriteCuisines,
        preferences,
        addresses,
        address: addresses?.[0] || { line1: "", line2: "", city: "", state: "", zip: "" }, // compat
        vehicles,
        vehicle: vehicles?.[0] || null, // compat - store first vehicle as single vehicle
        updatedAt: new Date(),
      },
      { merge: true }
    );
  }

  // -----------------------------
  // TOGGLES
  // -----------------------------
  function toggleItem(value, list, setList) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  // -----------------------------
  // ADDRESSES
  // -----------------------------
  function addAddress() {
    setAddresses((prev) => [
      ...prev,
      { line1: "", line2: "", city: "", state: "", zip: "" },
    ]);
  }

  function updateAddress(index, field, value) {
    setAddresses((prev) =>
      prev.map((a, i) => (i === index ? { ...a, [field]: value } : a))
    );
  }

  // -----------------------------
  // VEHICLES (for Valet)
  // -----------------------------
  function addVehicle() {
    setVehicles((prev) => [
      ...prev,
      { licensePlate: "", make: "", model: "", color: "" },
    ]);
  }

  function updateVehicle(index, field, value) {
    setVehicles((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    );
  }

  function removeVehicle(index) {
    if (vehicles.length === 1) {
      // Keep at least one vehicle form
      setVehicles([{ licensePlate: "", make: "", model: "", color: "" }]);
    } else {
      setVehicles((prev) => prev.filter((_, i) => i !== index));
    }
  }

  // -----------------------------
  // PAYMENT METHODS
  // -----------------------------
  async function handleAddCard() {
    if (!user) return;
    setAddingCard(true);

    try {
      // Validate card form
      if (!cardForm.cardNumber || !cardForm.expiryDate || !cardForm.cvv || !cardForm.cardholderName) {
        alert("Please fill in all card fields");
        setAddingCard(false);
        return;
      }

      // In production, this would:
      // 1. Create a Stripe Payment Method using Stripe Elements or Stripe.js
      // 2. Call a Cloud Function to securely create the payment method
      // 3. Save the payment method ID to Firestore
      
      // For now, we'll create a placeholder payment method
      // In production, replace this with actual Stripe integration:
      await getOrCreateStripeCustomer(user.uid, user.email || email, fullName);
      
      // Extract card details
      const last4 = cardForm.cardNumber.slice(-4);
      const expParts = cardForm.expiryDate.split("/");
      const expMonth = parseInt(expParts[0]) || null;
      const expYear = parseInt(expParts[1]) ? (2000 + parseInt(expParts[1])) : null;
      
      // Detect card brand from first digit
      const firstDigit = cardForm.cardNumber[0];
      let brand = "unknown";
      if (firstDigit === "4") brand = "visa";
      else if (firstDigit === "5") brand = "mastercard";
      else if (firstDigit === "3") brand = "amex";
      else if (firstDigit === "6") brand = "discover";

      // Placeholder payment method ID (in production, this comes from Stripe)
      const paymentMethodId = `pm_${Date.now()}_${last4}`;

      // Save payment method
      const isDefault = paymentMethods.length === 0; // First card is default
      await savePaymentMethod(
        user.uid,
        paymentMethodId,
        {
          last4,
          brand,
          expMonth,
          expYear,
        },
        isDefault
      );

      // Reload payment methods
      const methods = await getStoredPaymentMethods(user.uid);
      setPaymentMethods(methods);

      // Reset form
      setCardForm({
        cardNumber: "",
        expiryDate: "",
        cvv: "",
        cardholderName: "",
        zipCode: "",
      });
      setShowAddCard(false);
      alert("Card added successfully!");
    } catch (error) {
      console.error("Error adding card:", error);
      alert("Error adding card. Please try again.");
    } finally {
      setAddingCard(false);
    }
  }

  async function handleSetDefault(paymentMethodId) {
    if (!user) return;

    try {
      // Update all payment methods
      const updatePromises = paymentMethods.map(async (pm) => {
        const pmRef = doc(db, "users", user.uid, "paymentMethods", pm.id);
        if (pm.id === paymentMethodId) {
          await setDoc(pmRef, { isDefault: true }, { merge: true });
        } else if (pm.isDefault) {
          await setDoc(pmRef, { isDefault: false }, { merge: true });
        }
      });

      await Promise.all(updatePromises);

      // Reload payment methods
      const methods = await getStoredPaymentMethods(user.uid);
      setPaymentMethods(methods);
    } catch (error) {
      console.error("Error setting default payment method:", error);
      alert("Error updating default card. Please try again.");
    }
  }

  async function handleRemoveCard(paymentMethodId) {
    if (!user) return;
    if (!window.confirm("Are you sure you want to remove this card?")) return;

    try {
      await deleteDoc(doc(db, "users", user.uid, "paymentMethods", paymentMethodId));

      // Reload payment methods
      const methods = await getStoredPaymentMethods(user.uid);
      setPaymentMethods(methods);
    } catch (error) {
      console.error("Error removing card:", error);
      alert("Error removing card. Please try again.");
    }
  }

  function formatCardNumber(value) {
    // Remove all non-digits
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    // Add spaces every 4 digits
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || "";
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(" ");
    } else {
      return v;
    }
  }

  function formatExpiryDate(value) {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    if (v.length >= 2) {
      return v.substring(0, 2) + "/" + v.substring(2, 4);
    }
    return v;
  }

  // -----------------------------
  // IMAGE FALLBACK
  // -----------------------------
  const fallbackImg = profilePlaceholder;

  return (
    <div className="profile-settings-page">
      <Link to="/" className="profile-back-link">← Back</Link>
      <div className="profile-card">
        {/* Non-blocking banner (instead of killing the page) */}
        {!isAuthed && (
          <div className="not-signed-in">
            Please sign in to save changes. (Page stays visible until login is built.)
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
          <h1 className="profile-title" style={{ margin: 0 }}>Diner Profile Settings</h1>
          {isAnthonyDoby && (
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <a
                href="/profile-settings/employee"
                style={{
                  color: "#4da3ff",
                  textDecoration: "none",
                  fontSize: "14px",
                  fontWeight: 600,
                  padding: "8px 16px",
                  border: "1px solid rgba(77, 163, 255, 0.5)",
                  borderRadius: "6px",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "rgba(77, 163, 255, 0.1)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "transparent";
                }}
              >
                View Employee Profile →
              </a>
            </div>
          )}
        </div>

        {/* PHOTO */}
        <div className="profile-photo-row">
          <img
            src={imageURL || fallbackImg}
            alt="Profile"
            className="profile-photo"
          />

          <label
            className="change-photo-btn"
            style={{ opacity: isAuthed ? 1 : 0.45, pointerEvents: isAuthed ? "auto" : "none" }}
            title={isAuthed ? "Change photo" : "Sign in to change photo"}
          >
            Change Photo
            <input type="file" accept="image/*" onChange={handleImageChange} />
          </label>
        </div>

        {/* BASICS */}
        <section className="profile-section">
          <h2>Basics</h2>

          <input
            type="text"
            placeholder="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />

          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <input
            type="email"
            placeholder="Email Address"
            value={isAuthed ? (user.email || "") : email}
            disabled
          />

          <textarea
            placeholder="Bio (200 max)"
            maxLength={200}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </section>

        {/* CUISINES */}
        <section className="profile-section">
          <h2>Favorite Cuisines</h2>

          <div className="checkbox-grid">
            {CUISINES.map((c) => (
              <label key={c} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={favoriteCuisines.includes(c)}
                  onChange={() => toggleItem(c, favoriteCuisines, setFavoriteCuisines)}
                />
                <span className="checkbox-text">{c}</span>
              </label>
            ))}
          </div>
        </section>

        {/* PREFERENCES */}
        <section className="profile-section">
          <h2>Preferences</h2>

          <div className="checkbox-grid">
            {PREFERENCES.map((p) => (
              <label key={p} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={preferences.includes(p)}
                  onChange={() => toggleItem(p, preferences, setPreferences)}
                />
                <span className="checkbox-text">{p}</span>
              </label>
            ))}
          </div>
        </section>

        {/* ADDRESSES */}
        <section className="profile-section">
          <h2>Delivery Address (Primary)</h2>

          {addresses.map((addr, i) => (
            <div key={i} className="address-block">
              {i > 0 && <div className="address-subtitle">Additional Address #{i}</div>}

              <input
                type="text"
                placeholder="Address Line 1"
                value={addr.line1}
                onChange={(e) => updateAddress(i, "line1", e.target.value)}
              />

              <input
                type="text"
                placeholder="Address Line 2"
                value={addr.line2}
                onChange={(e) => updateAddress(i, "line2", e.target.value)}
              />

              <input
                type="text"
                placeholder="City"
                value={addr.city}
                onChange={(e) => updateAddress(i, "city", e.target.value)}
              />

              <input
                type="text"
                placeholder="State"
                value={addr.state}
                onChange={(e) => updateAddress(i, "state", e.target.value)}
              />

              <input
                type="text"
                placeholder="ZIP"
                value={addr.zip}
                onChange={(e) => updateAddress(i, "zip", e.target.value)}
              />
            </div>
          ))}

          <button className="add-address-btn" onClick={addAddress}>
            + Add Another Address
          </button>
        </section>

        {/* CAR INFORMATION FOR VALET */}
        <section className="profile-section">
          <h2>Car Information (for Valet Service)</h2>
          <p style={{ fontSize: "14px", opacity: 0.8, marginBottom: "16px" }}>
            Save your car details to quickly use valet services. License plate is required.
          </p>

          {vehicles.map((vehicle, i) => (
            <div key={i} className="vehicle-block">
              {i > 0 && <div className="address-subtitle">Car #{i + 1}</div>}

              <input
                type="text"
                placeholder="License Plate *"
                value={vehicle.licensePlate}
                onChange={(e) => updateVehicle(i, "licensePlate", e.target.value.toUpperCase())}
                maxLength={10}
              />

              <div className="vehicle-form-row">
                <input
                  type="text"
                  placeholder="Make (e.g., Toyota)"
                  value={vehicle.make}
                  onChange={(e) => updateVehicle(i, "make", e.target.value)}
                  maxLength={30}
                />

                <input
                  type="text"
                  placeholder="Model (e.g., Camry)"
                  value={vehicle.model}
                  onChange={(e) => updateVehicle(i, "model", e.target.value)}
                  maxLength={30}
                />
              </div>

              <div className="vehicle-form-row">
                <input
                  type="text"
                  placeholder="Color (e.g., Red)"
                  value={vehicle.color}
                  onChange={(e) => updateVehicle(i, "color", e.target.value)}
                  maxLength={20}
                />

                {vehicles.length > 1 && (
                  <button
                    className="remove-vehicle-btn"
                    onClick={() => removeVehicle(i)}
                    type="button"
                  >
                    Remove Car
                  </button>
                )}
              </div>
            </div>
          ))}

          <button className="add-address-btn" onClick={addVehicle}>
            + Add Another Car
          </button>
        </section>

        {/* PAYMENT METHODS */}
        <section className="profile-section">
          <h2>Payment Methods</h2>
          <p style={{ fontSize: "14px", opacity: 0.8, marginBottom: "16px" }}>
            Manage your saved cards for valet services, store purchases, and other in-app transactions.
          </p>

          {/* Saved Payment Methods */}
          {paymentMethods.length > 0 && (
            <div className="payment-methods-list">
              {paymentMethods.map((pm) => (
                <div key={pm.id} className="payment-method-card">
                  <div className="payment-method-info">
                    <div className="payment-method-brand">
                      {pm.brand === "visa" && "💳"}
                      {pm.brand === "mastercard" && "💳"}
                      {pm.brand === "amex" && "💳"}
                      {pm.brand === "discover" && "💳"}
                      {!pm.brand && "💳"}
                      <span className="payment-method-brand-name">
                        {pm.brand ? pm.brand.charAt(0).toUpperCase() + pm.brand.slice(1) : "Card"}
                      </span>
                    </div>
                    <div className="payment-method-details">
                      <span className="payment-method-number">•••• •••• •••• {pm.last4 || "****"}</span>
                      {pm.expMonth && pm.expYear && (
                        <span className="payment-method-expiry">
                          {String(pm.expMonth).padStart(2, "0")}/{pm.expYear}
                        </span>
                      )}
                    </div>
                    {pm.isDefault && (
                      <span className="payment-method-default-badge">Default</span>
                    )}
                  </div>
                  <div className="payment-method-actions">
                    {!pm.isDefault && (
                      <button
                        className="payment-method-btn payment-method-btn-secondary"
                        onClick={() => handleSetDefault(pm.id)}
                        disabled={!isAuthed}
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      className="payment-method-btn payment-method-btn-danger"
                      onClick={() => handleRemoveCard(pm.id)}
                      disabled={!isAuthed}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Card Form */}
          {showAddCard ? (
            <div className="add-card-form">
              <h3 style={{ fontSize: "18px", marginBottom: "16px" }}>Add New Card</h3>
              
              <input
                type="text"
                placeholder="Cardholder Name"
                value={cardForm.cardholderName}
                onChange={(e) => setCardForm({ ...cardForm, cardholderName: e.target.value })}
                maxLength={50}
              />

              <input
                type="text"
                placeholder="Card Number"
                value={cardForm.cardNumber}
                onChange={(e) => {
                  const formatted = formatCardNumber(e.target.value);
                  setCardForm({ ...cardForm, cardNumber: formatted });
                }}
                maxLength={19}
              />

              <div className="card-form-row">
                <input
                  type="text"
                  placeholder="MM/YY"
                  value={cardForm.expiryDate}
                  onChange={(e) => {
                    const formatted = formatExpiryDate(e.target.value);
                    setCardForm({ ...cardForm, expiryDate: formatted });
                  }}
                  maxLength={5}
                />

                <input
                  type="text"
                  placeholder="CVV"
                  value={cardForm.cvv}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "");
                    setCardForm({ ...cardForm, cvv: v });
                  }}
                  maxLength={4}
                />
              </div>

              <input
                type="text"
                placeholder="ZIP Code"
                value={cardForm.zipCode}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "");
                  setCardForm({ ...cardForm, zipCode: v });
                }}
                maxLength={10}
              />

              <div className="card-form-actions">
                <button
                  className="payment-method-btn payment-method-btn-secondary"
                  onClick={() => {
                    setShowAddCard(false);
                    setCardForm({
                      cardNumber: "",
                      expiryDate: "",
                      cvv: "",
                      cardholderName: "",
                      zipCode: "",
                    });
                  }}
                  disabled={addingCard}
                >
                  Cancel
                </button>
                <button
                  className="payment-method-btn payment-method-btn-primary"
                  onClick={handleAddCard}
                  disabled={!isAuthed || addingCard}
                >
                  {addingCard ? "Adding..." : "Add Card"}
                </button>
              </div>

              <div style={{
                background: "rgba(59, 130, 246, 0.1)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                borderRadius: "6px",
                padding: "10px",
                fontSize: "12px",
                color: "rgba(255, 255, 255, 0.8)",
                marginTop: "12px",
              }}>
                <strong>Note:</strong> Card information is securely processed through Stripe. We never store your full card number.
              </div>
            </div>
          ) : (
            <button
              className="add-address-btn"
              onClick={() => setShowAddCard(true)}
              disabled={!isAuthed}
              style={{ opacity: isAuthed ? 1 : 0.45 }}
            >
              + Add Payment Method
            </button>
          )}
        </section>

        {/* TipShare Section */}
        <section className="profile-section">
          <h2 className="profile-section-title">
            TIP<span style={{ color: "#22c55e" }}>$</span>HARE
          </h2>
          <div className="tipshare-links">
            <Link to="/tipshare?view=diner" className="tipshare-link-btn">
              Diner TipShare
            </Link>
            {isAuthed && (
              <Link to="/tipshare?view=employee" className="tipshare-link-btn">
                Employee TipShare
              </Link>
            )}
          </div>
        </section>

        <button
          className="save-profile-btn"
          onClick={handleSave}
          disabled={!isAuthed}
          style={{ opacity: isAuthed ? 1 : 0.45, cursor: isAuthed ? "pointer" : "not-allowed" }}
          title={isAuthed ? "Save Profile" : "Sign in to save"}
        >
          Save Profile
        </button>
      </div>
    </div>
  );
}
