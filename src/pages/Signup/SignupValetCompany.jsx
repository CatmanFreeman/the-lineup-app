// src/pages/Signup/SignupValetCompany.jsx
//
// VALET COMPANY SIGNUP
//
// Valet companies create their company profile
// Similar to restaurant company signup but for valet services

import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../../hooks/services/firebase";
import { createOrUpdateValetCompany } from "../../utils/valetCompanyService";
import { uploadImage } from "../../utils/uploadImage";
import lineupLogo from "../../assets/logos/the_lineup_logo.png";
import "./SignupValetCompany.css";

export default function SignupValetCompany() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Company Info
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState({
    line1: "",
    line2: "",
    city: "",
    state: "",
    zip: "",
  });

  // Login Credentials
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Logo
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  const [agree, setAgree] = useState(false);

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoFile(file);
    const previewURL = URL.createObjectURL(file);
    setLogoPreview(previewURL);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!companyName.trim()) {
      setError("Company name is required.");
      return;
    }

    if (contactEmail.toLowerCase() !== confirmEmail.toLowerCase()) {
      setError("Email and Confirm Email must match.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Password and Confirm Password must match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (!agree) {
      setError("You must agree to the Terms & Conditions.");
      return;
    }

    try {
      setLoading(true);

      // Create Firebase Auth user
      const userCred = await createUserWithEmailAndPassword(
        auth,
        contactEmail.trim(),
        password
      );
      const uid = userCred.user.uid;

      // Upload logo if provided
      let logoURL = "";
      if (logoFile) {
        logoURL = await uploadImage(logoFile, `valetCompanies/${uid}/logo`);
      }

      // Create valet company
      const companyId = await createOrUpdateValetCompany({
        name: companyName.trim(),
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
        address: `${address.line1}${address.line2 ? `, ${address.line2}` : ""}, ${address.city}, ${address.state} ${address.zip}`.trim(),
      });

      // Create user profile linked to valet company
      await setDoc(doc(db, "users", uid), {
        email: contactEmail.trim(),
        name: contactName.trim(),
        role: "VALET_COMPANY_ADMIN",
        valetCompanyId: companyId,
        companyId: companyId,
        phone: contactPhone.trim(),
        address: address,
        logoURL: logoURL,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Update valet company with admin user ID
      await setDoc(
        doc(db, "valetCompanies", companyId),
        {
          adminUserId: uid,
          logoURL: logoURL,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Success - redirect to valet company dashboard (to be created)
      navigate(`/dashboard/valet-company/${companyId}`, { replace: true });
    } catch (err) {
      console.error("Signup error:", err);
      setError(err?.message || "Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-valet-company-page">
      <img src={lineupLogo} className="signup-valet-company-logo" alt="The Lineup" />

      <div className="signup-valet-company-card">
        <h1 className="signup-valet-company-title">Valet Company Signup</h1>
        <p className="signup-valet-company-subtitle">
          Create your valet company profile
        </p>

        {error && <div className="signup-valet-company-error">{error}</div>}

        <form onSubmit={handleSubmit} className="signup-valet-company-form">
          {/* Company Info */}
          <div className="signup-valet-company-section">
            <h2>Company Information</h2>

            <div className="signup-valet-company-form-group">
              <label>Company Name *</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                placeholder="ABC Valet Services"
              />
            </div>

            <div className="signup-valet-company-form-group">
              <label>Contact Name *</label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                required
                placeholder="John Doe"
              />
            </div>

            <div className="signup-valet-company-form-group">
              <label>Contact Email *</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                required
                placeholder="contact@company.com"
              />
            </div>

            <div className="signup-valet-company-form-group">
              <label>Confirm Email *</label>
              <input
                type="email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                required
                placeholder="contact@company.com"
              />
            </div>

            <div className="signup-valet-company-form-group">
              <label>Contact Phone</label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>

            <div className="signup-valet-company-form-group">
              <label>Address Line 1</label>
              <input
                type="text"
                value={address.line1}
                onChange={(e) =>
                  setAddress({ ...address, line1: e.target.value })
                }
                placeholder="123 Main St"
              />
            </div>

            <div className="signup-valet-company-form-group">
              <label>Address Line 2</label>
              <input
                type="text"
                value={address.line2}
                onChange={(e) =>
                  setAddress({ ...address, line2: e.target.value })
                }
                placeholder="Suite 100"
              />
            </div>

            <div className="signup-valet-company-form-row">
              <div className="signup-valet-company-form-group">
                <label>City</label>
                <input
                  type="text"
                  value={address.city}
                  onChange={(e) =>
                    setAddress({ ...address, city: e.target.value })
                  }
                  placeholder="Austin"
                />
              </div>

              <div className="signup-valet-company-form-group">
                <label>State</label>
                <input
                  type="text"
                  value={address.state}
                  onChange={(e) =>
                    setAddress({ ...address, state: e.target.value })
                  }
                  placeholder="TX"
                  maxLength={2}
                />
              </div>

              <div className="signup-valet-company-form-group">
                <label>ZIP</label>
                <input
                  type="text"
                  value={address.zip}
                  onChange={(e) =>
                    setAddress({ ...address, zip: e.target.value })
                  }
                  placeholder="78701"
                />
              </div>
            </div>

            <div className="signup-valet-company-form-group">
              <label>Company Logo</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="signup-valet-company-file-input"
              />
              {logoPreview && (
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  className="signup-valet-company-logo-preview"
                />
              )}
            </div>
          </div>

          {/* Login Credentials */}
          <div className="signup-valet-company-section">
            <h2>Login Credentials</h2>

            <div className="signup-valet-company-form-group">
              <label>Password *</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="At least 6 characters"
              />
            </div>

            <div className="signup-valet-company-form-group">
              <label>Confirm Password *</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Confirm your password"
              />
            </div>
          </div>

          {/* Terms */}
          <div className="signup-valet-company-form-group">
            <label className="signup-valet-company-checkbox-label">
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                required
              />
              <span>
                I agree to the{" "}
                <Link to="/terms" className="signup-valet-company-link">
                  Terms & Conditions
                </Link>
              </span>
            </label>
          </div>

          <button
            type="submit"
            className="signup-valet-company-submit"
            disabled={loading}
          >
            {loading ? "Creating Account..." : "Create Valet Company Account"}
          </button>
        </form>

        <div className="signup-valet-company-footer">
          <p>
            Already have an account?{" "}
            <Link to="/login" className="signup-valet-company-link">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}








