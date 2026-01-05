import React from "react";
import { CUISINE_OPTIONS } from "../../constants/cuisineOptions";

/**
 * Shared Profile Form UI
 * Used by:
 *  - Signup (Create Account)
 *  - ProfileSettings (Edit Profile)
 *
 * IMPORTANT:
 * - This file contains UI only.
 * - No Firebase logic in here.
 * - Parent passes state + handlers.
 */
export default function ProfileForm({
  title,
  submitLabel,

  // Image
  imageURL,
  placeholderImageURL,
  onPickImageFile,

  // Basics
  fullName,
  setFullName,
  username,
  setUsername,
  email,
  setEmail, // (signup only; profile settings can pass a no-op)
  emailDisabled = false,
  bio,
  setBio,

  // Favorites & Preferences
  favoriteCuisines,
  setFavoriteCuisines,
  preferences,
  setPreferences,

  // Address (primary + optional additional)
  primaryAddress,
  setPrimaryAddress,
  additionalAddresses,
  setAdditionalAddresses,

  // Submit
  onSubmit,
  submitDisabled = false,
}) {
  // Use centralized cuisine options (matches HomePage dropdown)

  const PREFERENCE_OPTIONS = [
    "Gluten Free",
    "Vegetarian",
    "Pescatarian",
    "Blind",
    "Deaf",
    "Handicapped",
    "Wheelchair Accessible",
  ];

  function toggleInList(value, list, setList) {
    if (list.includes(value)) {
      setList(list.filter((v) => v !== value));
    } else {
      setList([...list, value]);
    }
  }

  function updatePrimary(field, value) {
    setPrimaryAddress({ ...primaryAddress, [field]: value });
  }

  function addAnotherAddress() {
    const next = [
      ...additionalAddresses,
      {
        id: `${Date.now()}`,
        label: "",
        line1: "",
        line2: "",
        city: "",
        state: "",
        zip: "",
        notes: "",
      },
    ];
    setAdditionalAddresses(next);
  }

  function updateAdditional(id, field, value) {
    const next = additionalAddresses.map((a) =>
      a.id === id ? { ...a, [field]: value } : a
    );
    setAdditionalAddresses(next);
  }

  function removeAdditional(id) {
    const next = additionalAddresses.filter((a) => a.id !== id);
    setAdditionalAddresses(next);
  }

  return (
    <div className="profile-settings-page">
      <h1>{title}</h1>

      {/* PHOTO ROW */}
      <div className="profile-photo-row">
        <img
          src={imageURL || placeholderImageURL}
          alt="Profile"
          className="profile-photo"
        />

        <label className="change-photo-btn">
          Change Photo
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              onPickImageFile(file);
              // allow same file re-pick
              e.target.value = "";
            }}
          />
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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={emailDisabled}
        />

        <textarea
          placeholder="Bio (200 max)"
          maxLength={200}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
      </section>

      {/* FAVORITE CUISINES */}
      <section className="profile-section">
        <h2>Favorite Cuisines</h2>

        <div className="checkbox-grid">
          {CUISINE_OPTIONS.map((c) => (
            <label key={c} className="checkbox-item">
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
      </section>

      {/* PREFERENCES */}
      <section className="profile-section">
        <h2>Preferences</h2>

        <div className="checkbox-grid">
          {PREFERENCE_OPTIONS.map((p) => (
            <label key={p} className="checkbox-item">
              <input
                type="checkbox"
                checked={preferences.includes(p)}
                onChange={() => toggleInList(p, preferences, setPreferences)}
              />
              <span>{p}</span>
            </label>
          ))}
        </div>
      </section>

      {/* PRIMARY ADDRESS */}
      <section className="profile-section">
        <h2>Delivery Address (Primary)</h2>

        <input
          type="text"
          placeholder="Address Line 1"
          value={primaryAddress.line1 || ""}
          onChange={(e) => updatePrimary("line1", e.target.value)}
        />

        <input
          type="text"
          placeholder="Address Line 2"
          value={primaryAddress.line2 || ""}
          onChange={(e) => updatePrimary("line2", e.target.value)}
        />

        <input
          type="text"
          placeholder="City"
          value={primaryAddress.city || ""}
          onChange={(e) => updatePrimary("city", e.target.value)}
        />

        <input
          type="text"
          placeholder="State"
          value={primaryAddress.state || ""}
          onChange={(e) => updatePrimary("state", e.target.value)}
        />

        <input
          type="text"
          placeholder="ZIP"
          value={primaryAddress.zip || ""}
          onChange={(e) => updatePrimary("zip", e.target.value)}
        />
      </section>

      {/* ADDITIONAL ADDRESSES (OPTIONAL) */}
      <section className="profile-section">
        <h2>Additional Addresses (Optional)</h2>

        <button
          type="button"
          className="add-address-btn"
          onClick={addAnotherAddress}
        >
          Add Another Address
        </button>

        {additionalAddresses.length > 0 && (
          <div className="additional-addresses">
            {additionalAddresses.map((a, idx) => (
              <div key={a.id} className="address-card">
                <div className="address-card-title">
                  Address #{idx + 2}
                  <button
                    type="button"
                    className="remove-address-btn"
                    onClick={() => removeAdditional(a.id)}
                  >
                    Remove
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Label (e.g., Work / Mom’s house)"
                  value={a.label || ""}
                  onChange={(e) => updateAdditional(a.id, "label", e.target.value)}
                />

                <input
                  type="text"
                  placeholder="Address Line 1"
                  value={a.line1 || ""}
                  onChange={(e) => updateAdditional(a.id, "line1", e.target.value)}
                />

                <input
                  type="text"
                  placeholder="Address Line 2"
                  value={a.line2 || ""}
                  onChange={(e) => updateAdditional(a.id, "line2", e.target.value)}
                />

                <input
                  type="text"
                  placeholder="City"
                  value={a.city || ""}
                  onChange={(e) => updateAdditional(a.id, "city", e.target.value)}
                />

                <input
                  type="text"
                  placeholder="State"
                  value={a.state || ""}
                  onChange={(e) => updateAdditional(a.id, "state", e.target.value)}
                />

                <input
                  type="text"
                  placeholder="ZIP"
                  value={a.zip || ""}
                  onChange={(e) => updateAdditional(a.id, "zip", e.target.value)}
                />

                <input
                  type="text"
                  placeholder="Notes (optional)"
                  value={a.notes || ""}
                  onChange={(e) => updateAdditional(a.id, "notes", e.target.value)}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <button
        type="button"
        className="save-profile-btn"
        onClick={onSubmit}
        disabled={submitDisabled}
      >
        {submitLabel}
      </button>
    </div>
  );
}
