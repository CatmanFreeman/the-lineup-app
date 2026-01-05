import React, { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../hooks/services/firebase";
import { useAuth } from "../../context/AuthContext";
import { uploadImage } from "../../utils/uploadImage";
import { CUISINE_OPTIONS } from "../../constants/cuisineOptions";
import "./SignupDiner.css";

/* Emoji avatars */
const AVATAR_EMOJIS = ["🍔", "🍕", "🌮", "🍣", "🥗", "🍩", "☕", "🍺", "🔥", "😋"];

export default function SignupDiner() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const accountType = params.get("type") || "user";
  const { signup } = useAuth();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [bio, setBio] = useState("");

  const [favoriteCuisines, setFavoriteCuisines] = useState([]);
  const [preferences, setPreferences] = useState([]);

  const [primaryAddress, setPrimaryAddress] = useState({
    line1: "",
    line2: "",
    city: "",
    state: "",
    zip: "",
  });

  const [useValet, setUseValet] = useState(false);
  const [vehicles, setVehicles] = useState([]);

  const [photoFile, setPhotoFile] = useState(null);
  const [avatarEmoji, setAvatarEmoji] = useState("");
  const [agree, setAgree] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const cuisineOptions = useMemo(
    () => CUISINE_OPTIONS,
    []
  );

  const preferenceOptions = useMemo(
    () => [
      "Gluten Free",
      "Vegetarian",
      "Pescatarian",
      "Wheelchair Accessible",
      "Blind",
      "Deaf",
    ],
    []
  );

  function toggleInList(value, list, setList) {
    setList((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  function onPickPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setAvatarEmoji("");
  }

  const previewSrc = useMemo(() => {
    if (photoFile) return URL.createObjectURL(photoFile);
    return "";
  }, [photoFile]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
      setError("Email and Confirm Email must match.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Password and Confirm Password must match.");
      return;
    }

    if (!agree) {
      setError("You must agree to the Terms & Conditions.");
      return;
    }

    try {
      setLoading(true);

      const userCred = await signup(email.trim(), password);
      const uid = userCred?.user?.uid;
      if (!uid) throw new Error("User ID missing after signup.");

      let imageURL = "";
      if (photoFile) {
        imageURL = await uploadImage(photoFile, `users/${uid}/profile`);
      }

      const userDoc = {
        accountType,
        fullName: fullName.trim(),
        username: username.trim(),
        email: email.trim(),
        bio: bio.trim(),
        favoriteCuisines,
        preferences,
        primaryAddress,
        imageURL,
        avatarEmoji: imageURL ? "" : avatarEmoji,
        useValet,
        vehicles: useValet ? vehicles.filter(v => v.licensePlate.trim()) : [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, "users", uid), userDoc, { merge: true });
      navigate("/profile");
    } catch (err) {
      setError(err?.message || "Failed to create account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="signup-page">
      <form className="signup-card" onSubmit={handleSubmit}>
        {/* Photo Preview */}
        <div className="signup-photo-preview-wrapper">
          {previewSrc ? (
            <img src={previewSrc} alt="Preview" className="signup-photo-preview" />
          ) : avatarEmoji ? (
            <div className="signup-photo-preview signup-photo-emoji">
              {avatarEmoji}
            </div>
          ) : (
            <div className="signup-photo-placeholder">Add Photo</div>
          )}
        </div>

        <h1>Create Diner Account</h1>

        <div className="signup-subline">
          <span>Already have an account?</span>{" "}
          <Link className="signup-link" to="/login">
            Log in
          </Link>
        </div>

        {error && <div className="signup-error">{error}</div>}

        {/* Avatar */}
        <div className="signup-avatar-block">
          <div className="signup-avatar-header">
            <label className="signup-upload-label">
              <input type="file" accept="image/*" onChange={onPickPhoto} />
              Upload Photo
            </label>
            <div className="signup-avatar-hint">or choose an avatar</div>
          </div>

          <div className="signup-emoji-row">
            {AVATAR_EMOJIS.map((em) => (
              <button
                key={em}
                type="button"
                className={`signup-emoji-btn ${
                  avatarEmoji === em ? "active" : ""
                }`}
                onClick={() => {
                  setAvatarEmoji(em);
                  setPhotoFile(null);
                }}
              >
                {em}
              </button>
            ))}
          </div>
        </div>

        {/* Basics */}
        <div className="signup-section">
          <h2>Basics</h2>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full Name" required />
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" required />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email Address" type="email" required />
          <input value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} placeholder="Confirm Email" type="email" required />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" required />
          <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm Password" type="password" required />
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Bio (optional)" maxLength={200} />
        </div>

        {/* Favorite Cuisines */}
        <div className="signup-section">
          <h2>Favorite Cuisines</h2>
          <div className="signup-checkgrid">
            {cuisineOptions.map((c) => (
              <label key={c} className="signup-check">
                <input
                  type="checkbox"
                  checked={favoriteCuisines.includes(c)}
                  onChange={() =>
                    toggleInList(c, favoriteCuisines, setFavoriteCuisines)
                  }
                />
                <span>{c}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Preferences */}
        <div className="signup-section">
          <h2>Preferences / Requirements</h2>
          <div className="signup-checkgrid">
            {preferenceOptions.map((p) => (
              <label key={p} className="signup-check">
                <input
                  type="checkbox"
                  checked={preferences.includes(p)}
                  onChange={() =>
                    toggleInList(p, preferences, setPreferences)
                  }
                />
                <span>{p}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Address */}
        <div className="signup-section">
          <h2>Delivery Address (Primary)</h2>
          <input placeholder="Address Line 1" value={primaryAddress.line1} onChange={(e) => setPrimaryAddress((p) => ({ ...p, line1: e.target.value }))} />
          <input placeholder="Address Line 2" value={primaryAddress.line2} onChange={(e) => setPrimaryAddress((p) => ({ ...p, line2: e.target.value }))} />
          <input placeholder="City" value={primaryAddress.city} onChange={(e) => setPrimaryAddress((p) => ({ ...p, city: e.target.value }))} />
          <input placeholder="State" value={primaryAddress.state} onChange={(e) => setPrimaryAddress((p) => ({ ...p, state: e.target.value }))} />
          <input placeholder="ZIP" value={primaryAddress.zip} onChange={(e) => setPrimaryAddress((p) => ({ ...p, zip: e.target.value }))} />
        </div>

        {/* Vehicle Information for Valet */}
        <div className="signup-section">
          <h2>Vehicle Information (for Valet Service)</h2>
          <label className="signup-check" style={{ marginBottom: "16px" }}>
            <input
              type="checkbox"
              checked={useValet}
              onChange={(e) => setUseValet(e.target.checked)}
            />
            <span>I use valet parking</span>
          </label>

          {useValet && (
            <div className="signup-vehicles">
              {vehicles.map((vehicle, index) => (
                <div key={index} className="signup-vehicle-card">
                  <h3>Car {index + 1}</h3>
                  <input
                    placeholder="License Plate *"
                    value={vehicle.licensePlate || ""}
                    onChange={(e) => {
                      const newVehicles = [...vehicles];
                      newVehicles[index] = { ...newVehicles[index], licensePlate: e.target.value };
                      setVehicles(newVehicles);
                    }}
                    required={useValet}
                  />
                  <input
                    placeholder="Make (e.g., Toyota)"
                    value={vehicle.make || ""}
                    onChange={(e) => {
                      const newVehicles = [...vehicles];
                      newVehicles[index] = { ...newVehicles[index], make: e.target.value };
                      setVehicles(newVehicles);
                    }}
                  />
                  <input
                    placeholder="Model (e.g., Camry)"
                    value={vehicle.model || ""}
                    onChange={(e) => {
                      const newVehicles = [...vehicles];
                      newVehicles[index] = { ...newVehicles[index], model: e.target.value };
                      setVehicles(newVehicles);
                    }}
                  />
                  <input
                    placeholder="Color"
                    value={vehicle.color || ""}
                    onChange={(e) => {
                      const newVehicles = [...vehicles];
                      newVehicles[index] = { ...newVehicles[index], color: e.target.value };
                      setVehicles(newVehicles);
                    }}
                  />
                  {vehicles.length > 1 && (
                    <button
                      type="button"
                      className="signup-remove-vehicle"
                      onClick={() => setVehicles(vehicles.filter((_, i) => i !== index))}
                    >
                      Remove Car
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="signup-add-vehicle"
                onClick={() => setVehicles([...vehicles, { licensePlate: "", make: "", model: "", color: "" }])}
              >
                + Add Another Car
              </button>
              {vehicles.length === 0 && (
                <button
                  type="button"
                  className="signup-add-vehicle"
                  onClick={() => setVehicles([{ licensePlate: "", make: "", model: "", color: "" }])}
                >
                  + Add Car
                </button>
              )}
            </div>
          )}
        </div>

        {/* TERMS */}
        <div className="signup-terms">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
          />
          <span>
            I agree to the{" "}
            <button
              type="button"
              className="terms-link"
              onClick={() => setShowTerms(true)}
            >
              Terms & Conditions
            </button>
          </span>
        </div>

        <button className="signup-submit" type="submit" disabled={loading}>
          Create Account
        </button>

        {/* TERMS MODAL */}
        {showTerms && (
          <div className="terms-modal-overlay">
            <div className="terms-modal">
              <h2>Terms & Conditions</h2>
              <p style={{ opacity: 0.7 }}>(Content coming soon)</p>
              <button
                type="button"
                className="terms-close-btn"
                onClick={() => setShowTerms(false)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
