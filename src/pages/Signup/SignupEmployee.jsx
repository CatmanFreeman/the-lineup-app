import React, { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../hooks/services/firebase";
import { useAuth } from "../../context/AuthContext";
import { uploadImage } from "../../utils/uploadImage";
import "./SignupEmployee.css";

export default function SignupEmployee() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const accountType = "employee";
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

  const [photoFile, setPhotoFile] = useState(null);
  const [agree, setAgree] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [currentJob, setCurrentJob] = useState({
    restaurant: "",
    position: "",
    startDate: "",
  });

  const [pastJobs, setPastJobs] = useState([]);

  const cuisineOptions = useMemo(
    () => [
      "American",
      "Barbecue",
      "Bistro",
      "Breakfast / Brunch",
      "Burgers",
      "Cafe / Coffee",
      "Chinese",
      "Desserts",
      "Indian",
      "Italian",
      "Mexican",
      "Middle Eastern",
      "Pizza",
      "Seafood",
      "Sushi",
      "Thai",
      "Vegan",
    ],
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
  }

  const previewSrc = useMemo(() => {
    if (photoFile) return URL.createObjectURL(photoFile);
    return "";
  }, [photoFile]);

  function addPastJob() {
    if (pastJobs.length >= 10) return;
    setPastJobs((prev) => [
      ...prev,
      { restaurant: "", position: "", startDate: "", endDate: "" },
    ]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (email.toLowerCase() !== confirmEmail.toLowerCase()) {
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
      const uid = userCred.user.uid;

      let imageURL = "";
      if (photoFile) {
        imageURL = await uploadImage(photoFile, `users/${uid}/profile`);
      }

      await setDoc(
        doc(db, "users", uid),
        {
          accountType,
          fullName,
          username,
          email,
          bio,
          favoriteCuisines,
          preferences,
          primaryAddress,
          employment: {
            currentJob,
            pastJobs,
          },
          imageURL,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      navigate("/profile");
    } catch (err) {
      setError("Failed to create account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="signup-page">
      <form className="signup-card" onSubmit={handleSubmit}>
        {/* Photo Preview */}
        <label className="signup-photo-preview-wrapper">
          {previewSrc ? (
            <img src={previewSrc} className="signup-photo-preview" alt="Preview" />
          ) : (
            <div className="signup-photo-placeholder">Add Photo</div>
          )}

          {/* ONLY ADDITION: this input makes the box clickable */}
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={onPickPhoto}
          />
        </label>

        <h1>Create Employee Account</h1>

        <div className="signup-subline">
          <span>Already have an account?</span>{" "}
          <Link className="signup-link" to="/login">
            Log in
          </Link>
        </div>

        {error && <div className="signup-error">{error}</div>}

        {/* Basics */}
        <div className="signup-section">
          <h2>Basics</h2>
          <input placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <input placeholder="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input placeholder="Confirm Email" type="email" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} required />
          <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <input placeholder="Confirm Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          <textarea placeholder="Bio (optional)" value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>

        {/* Favorite Cuisines */}
        <div className="signup-section">
          <h2>Favorite Cuisines</h2>
          <div className="signup-checkgrid">
            {cuisineOptions.map((c) => (
              <label key={c} className="signup-check">
                <input type="checkbox" checked={favoriteCuisines.includes(c)} onChange={() => toggleInList(c, favoriteCuisines, setFavoriteCuisines)} />
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
                <input type="checkbox" checked={preferences.includes(p)} onChange={() => toggleInList(p, preferences, setPreferences)} />
                <span>{p}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Delivery Address */}
        <div className="signup-section">
          <h2>Delivery Address (Primary)</h2>
          <input placeholder="Address Line 1" />
          <input placeholder="Address Line 2" />
          <input placeholder="City" />
          <input placeholder="State" />
          <input placeholder="ZIP" />
        </div>

        {/* CURRENT EMPLOYER */}
        <div className="signup-section">
          <h2>Current Employer</h2>

          <div className="employment-top-row">
            <input
              type="text"
              placeholder="Restaurant"
            />

            <select>
              <option value="">Select Position</option>
              <option>Server</option>
              <option>Hostess</option>
              <option>Bartender</option>
              <option>Cook</option>
              <option>Manager</option>
            </select>
          </div>

          <div className="employment-date-row">
            <label className="date-label">
              Start Date
              <input type="date" />
            </label>
          </div>
        </div>

        {/* PAST EMPLOYMENT */}
        <div className="signup-section">
          <h2>Past Employment</h2>

          {pastJobs.map((_, idx) => (
            <div key={idx} className="past-job-block">
              <div className="employment-top-row">
                <input
                  type="text"
                  placeholder="Restaurant"
                />

                <select>
                  <option value="">Select Position</option>
                  <option>Server</option>
                  <option>Hostess</option>
                  <option>Bartender</option>
                  <option>Cook</option>
                  <option>Manager</option>
                </select>
              </div>

              <div className="employment-date-row two-dates">
                <label className="date-label">
                  Start Date
                  <input type="date" />
                </label>

                <label className="date-label">
                  End Date
                  <input type="date" />
                </label>
              </div>
            </div>
          ))}

          <button
            type="button"
            className="add-job-btn"
            onClick={addPastJob}
            disabled={pastJobs.length >= 10}
          >
            Add Past Job
          </button>
        </div>

        {/* TERMS */}
        <div className="signup-terms">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>
            I agree to the{" "}
            <button type="button" className="terms-link" onClick={() => setShowTerms(true)}>
              Terms & Conditions
            </button>
          </span>
        </div>

        <button className="signup-submit" type="submit" disabled={loading}>
          Create Employee Account
        </button>

        {showTerms && (
          <div className="terms-modal-overlay">
            <div className="terms-modal">
              <h2>Terms & Conditions</h2>
              <button className="terms-close-btn" onClick={() => setShowTerms(false)}>
                Close
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
