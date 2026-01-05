import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { Link } from "react-router-dom";
import { db } from "../../hooks/services/firebase";
import { uploadImage } from "../../utils/uploadImage";
import { getStoredPaymentMethods, savePaymentMethod, getOrCreateStripeCustomer } from "../../utils/stripeService";
import { requestEmploymentVerification } from "../../utils/employmentVerificationService";
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

export default function EmployeeProfileSettings() {
  const auth = getAuth();
  const user = auth.currentUser;
  const isAuthed = !!user;

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

  // Employment Information
  const [currentJob, setCurrentJob] = useState({
    restaurant: "",
    restaurantId: "",
    company: "",
    companyId: "",
    position: "",
    startDate: "",
  });
  const [pastJobs, setPastJobs] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [verificationStatuses, setVerificationStatuses] = useState({}); // Track verification status per job

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

        // Load employment info
        if (data.employment) {
          if (data.employment.currentJob) {
            setCurrentJob(data.employment.currentJob);
          }
          if (Array.isArray(data.employment.pastJobs)) {
            setPastJobs(data.employment.pastJobs);
            // Load verification statuses for past jobs
            const statuses = {};
            const pastJobsList = data.employment.pastJobs;
            
            pastJobsList.forEach((job, index) => {
              if (job.verified || job.vetted) {
                statuses[index] = "verified";
              } else if (job.verificationRequested) {
                statuses[index] = "pending";
              }
            });
            
            // Also check vettedJobs for verified status
            if (Array.isArray(data.employment.vettedJobs)) {
              data.employment.vettedJobs.forEach((vettedJob) => {
                // Match vetted jobs to past jobs by restaurant and position
                pastJobsList.forEach((job, index) => {
                  if (
                    (job.restaurantId === vettedJob.restaurantId || job.restaurant === vettedJob.restaurantName) &&
                    job.position === vettedJob.position
                  ) {
                    statuses[index] = "verified";
                  }
                });
              });
            }
            
            setVerificationStatuses(statuses);
          }
        }

        // Load vehicles for valet
        if (Array.isArray(data.vehicles) && data.vehicles.length > 0) {
          setVehicles(data.vehicles);
        } else if (data.vehicle) {
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

    async function loadRestaurantsAndCompanies() {
      if (!user) return;
      try {
        // Load restaurants
        const restaurantsRef = collection(db, "restaurants");
        const restaurantsSnap = await getDocs(restaurantsRef);
        const restaurantsList = restaurantsSnap.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || "",
        }));
        setRestaurants(restaurantsList);

        // Load companies
        const companiesRef = collection(db, "companies");
        const companiesSnap = await getDocs(companiesRef);
        const companiesList = companiesSnap.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || "",
        }));
        setCompanies(companiesList);
      } catch (error) {
        console.error("Error loading restaurants/companies:", error);
      }
    }

    loadProfile();
    loadRestaurantsAndCompanies();
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
        vehicle: vehicles?.[0] || null, // compat
        employment: {
          currentJob,
          pastJobs,
        },
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
  // EMPLOYMENT
  // -----------------------------
  function updateCurrentJob(field, value) {
    setCurrentJob((prev) => ({ ...prev, [field]: value }));
  }

  function addPastJob() {
    setPastJobs((prev) => [
      ...prev,
      { restaurant: "", restaurantId: "", company: "", companyId: "", position: "", startDate: "", endDate: "" },
    ]);
  }

  function updatePastJob(index, field, value) {
    setPastJobs((prev) =>
      prev.map((job, i) => (i === index ? { ...job, [field]: value } : job))
    );
  }

  function removePastJob(index) {
    setPastJobs((prev) => prev.filter((_, i) => i !== index));
  }

  // -----------------------------
  // EMPLOYMENT VERIFICATION
  // -----------------------------
  async function handleRequestVerification(jobIndex) {
    if (!user || !fullName) {
      alert("Please fill in your full name first");
      return;
    }

    const job = pastJobs[jobIndex];
    if (!job.restaurant || !job.position || !job.startDate) {
      alert("Please fill in restaurant name, position, and start date before requesting verification");
      return;
    }

    try {
      const result = await requestEmploymentVerification({
        employeeUid: user.uid,
        employeeName: fullName,
        restaurantName: job.restaurant,
        restaurantId: job.restaurantId || null,
        position: job.position,
        startDate: job.startDate,
        endDate: job.endDate || null,
      });

      if (result.success) {
        setVerificationStatuses((prev) => ({ ...prev, [jobIndex]: "pending" }));
        // Update the job to mark verification as requested
        updatePastJob(jobIndex, "verificationRequested", true);
        alert(result.message || "Verification request sent successfully!");
      } else {
        alert(result.message || "Failed to send verification request");
      }
    } catch (error) {
      console.error("Error requesting verification:", error);
      alert("An error occurred while requesting verification");
    }
  }

  // -----------------------------
  // PAYMENT METHODS
  // -----------------------------
  async function handleAddCard() {
    if (!user) return;
    setAddingCard(true);

    try {
      if (!cardForm.cardNumber || !cardForm.expiryDate || !cardForm.cvv || !cardForm.cardholderName) {
        alert("Please fill in all card fields");
        setAddingCard(false);
        return;
      }

      await getOrCreateStripeCustomer(user.uid, user.email || email, fullName);
      
      const last4 = cardForm.cardNumber.slice(-4);
      const expParts = cardForm.expiryDate.split("/");
      const expMonth = parseInt(expParts[0]) || null;
      const expYear = parseInt(expParts[1]) ? (2000 + parseInt(expParts[1])) : null;
      
      const firstDigit = cardForm.cardNumber[0];
      let brand = "unknown";
      if (firstDigit === "4") brand = "visa";
      else if (firstDigit === "5") brand = "mastercard";
      else if (firstDigit === "3") brand = "amex";
      else if (firstDigit === "6") brand = "discover";

      const paymentMethodId = `pm_${Date.now()}_${last4}`;
      const isDefault = paymentMethods.length === 0;
      await savePaymentMethod(
        user.uid,
        paymentMethodId,
        { last4, brand, expMonth, expYear },
        isDefault
      );

      const methods = await getStoredPaymentMethods(user.uid);
      setPaymentMethods(methods);

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
      const updatePromises = paymentMethods.map(async (pm) => {
        const pmRef = doc(db, "users", user.uid, "paymentMethods", pm.id);
        if (pm.id === paymentMethodId) {
          await setDoc(pmRef, { isDefault: true }, { merge: true });
        } else if (pm.isDefault) {
          await setDoc(pmRef, { isDefault: false }, { merge: true });
        }
      });
      await Promise.all(updatePromises);
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
      const methods = await getStoredPaymentMethods(user.uid);
      setPaymentMethods(methods);
    } catch (error) {
      console.error("Error removing card:", error);
      alert("Error removing card. Please try again.");
    }
  }

  function formatCardNumber(value) {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || "";
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(" ") : v;
  }

  function formatExpiryDate(value) {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    return v.length >= 2 ? v.substring(0, 2) + "/" + v.substring(2, 4) : v;
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
      setVehicles([{ licensePlate: "", make: "", model: "", color: "" }]);
    } else {
      setVehicles((prev) => prev.filter((_, i) => i !== index));
    }
  }

  // -----------------------------
  // IMAGE FALLBACK
  // -----------------------------
  const fallbackImg = profilePlaceholder;

  return (
    <div className="profile-settings-page">
      <Link to="/profile-settings" className="profile-back-link">← Back</Link>
      <div className="profile-card">
        {/* Non-blocking banner (instead of killing the page) */}
        {!isAuthed && (
          <div className="not-signed-in">
            Please sign in to save changes. (Page stays visible until login is built.)
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
          <h1 className="profile-title" style={{ margin: 0 }}>Employee Profile Settings</h1>
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

        {/* CURRENT EMPLOYMENT */}
        <section className="profile-section">
          <h2>Current Employment</h2>

          <label>
            Restaurant
            <select
              value={currentJob.restaurantId}
              onChange={(e) => {
                const selected = restaurants.find((r) => r.id === e.target.value);
                updateCurrentJob("restaurantId", e.target.value);
                updateCurrentJob("restaurant", selected?.name || "");
              }}
            >
              <option value="">Select Restaurant</option>
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Company
            <select
              value={currentJob.companyId}
              onChange={(e) => {
                const selected = companies.find((c) => c.id === e.target.value);
                updateCurrentJob("companyId", e.target.value);
                updateCurrentJob("company", selected?.name || "");
              }}
            >
              <option value="">Select Company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <input
            type="text"
            placeholder="Position (e.g., Server, Cook, Host)"
            value={currentJob.position}
            onChange={(e) => updateCurrentJob("position", e.target.value)}
          />

          <input
            type="date"
            placeholder="Start Date"
            value={currentJob.startDate}
            onChange={(e) => updateCurrentJob("startDate", e.target.value)}
          />
        </section>

        {/* PAST EMPLOYMENT */}
        <section className="profile-section">
          <h2>Past Employment</h2>

          {pastJobs.map((job, i) => (
            <div key={i} className="vehicle-block">
              <div className="address-subtitle">Previous Job #{i + 1}</div>

              <label>
                Restaurant
                <select
                  value={job.restaurantId || ""}
                  onChange={(e) => {
                    if (e.target.value === "manual") {
                      updatePastJob(i, "restaurantId", "");
                      updatePastJob(i, "restaurant", "");
                    } else {
                      const selected = restaurants.find((r) => r.id === e.target.value);
                      updatePastJob(i, "restaurantId", e.target.value);
                      updatePastJob(i, "restaurant", selected?.name || "");
                    }
                  }}
                >
                  <option value="">Select Restaurant</option>
                  {restaurants.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                  <option value="manual">+ Enter Restaurant Name Manually</option>
                </select>
              </label>
              {(!job.restaurantId || job.restaurantId === "") && (
                <input
                  type="text"
                  placeholder="Restaurant Name (if not in list above)"
                  value={job.restaurant || ""}
                  onChange={(e) => updatePastJob(i, "restaurant", e.target.value)}
                />
              )}

              <label>
                Company
                <select
                  value={job.companyId}
                  onChange={(e) => {
                    const selected = companies.find((c) => c.id === e.target.value);
                    updatePastJob(i, "companyId", e.target.value);
                    updatePastJob(i, "company", selected?.name || "");
                  }}
                >
                  <option value="">Select Company</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <input
                type="text"
                placeholder="Position"
                value={job.position}
                onChange={(e) => updatePastJob(i, "position", e.target.value)}
              />

              <div className="vehicle-form-row">
                <input
                  type="date"
                  placeholder="Start Date"
                  value={job.startDate}
                  onChange={(e) => updatePastJob(i, "startDate", e.target.value)}
                />

                <input
                  type="date"
                  placeholder="End Date"
                  value={job.endDate}
                  onChange={(e) => updatePastJob(i, "endDate", e.target.value)}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", gap: "8px", flexWrap: "wrap" }}>
                <button
                  className="remove-vehicle-btn"
                  onClick={() => removePastJob(i)}
                  type="button"
                >
                  Remove Job
                </button>
                {job.restaurant && job.position && job.startDate && (
                  <button
                    className="payment-method-btn payment-method-btn-primary"
                    onClick={() => handleRequestVerification(i)}
                    disabled={verificationStatuses[i] === "pending" || verificationStatuses[i] === "verified"}
                    style={{
                      opacity: (verificationStatuses[i] === "pending" || verificationStatuses[i] === "verified") ? 0.5 : 1,
                      cursor: (verificationStatuses[i] === "pending" || verificationStatuses[i] === "verified") ? "not-allowed" : "pointer",
                    }}
                  >
                    {verificationStatuses[i] === "verified" ? "✓ Verified" : verificationStatuses[i] === "pending" ? "⏳ Pending Verification" : "Request Verification"}
                  </button>
                )}
              </div>
              {verificationStatuses[i] === "verified" && (
                <div style={{
                  background: "rgba(16, 185, 129, 0.1)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  borderRadius: "6px",
                  padding: "8px",
                  fontSize: "12px",
                  color: "#10b981",
                  marginTop: "8px",
                }}>
                  ✓ This employment has been verified. You earned points!
                </div>
              )}
            </div>
          ))}

          <button className="add-address-btn" onClick={addPastJob}>
            + Add Past Job
          </button>
          <p style={{ fontSize: "13px", opacity: 0.8, marginTop: "12px" }}>
            Request verification for past employment to earn points and build your verified work history.
          </p>
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

