import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CUISINE_OPTIONS } from "../../constants/cuisineOptions";
import "./SignupCompany.css";

const DAYS = [
"Monday",
"Tuesday",
"Wednesday",
"Thursday",
"Friday",
"Saturday",
"Sunday",
];

function makeEmptyAddress() {
return { line1: "", line2: "", city: "", state: "", zip: "" };
}

function makeEmptyRestaurant() {
return {

// logo
logoFile: null,

// images (per restaurant, max 10)
images: [],

// identity
restaurantName: "",
restaurantPhone: "",
website: "",

// login (stored only; not creating Auth users yet)
username: "",
email: "",
confirmEmail: "",
password: "",
confirmPassword: "",

// address
address: makeEmptyAddress(),

// cuisines (max 2)
cuisines: [],
preferences: {},
attractions: {},

// hours (legacy string field kept for payload compatibility)
hours: "",

// hours (per restaurant)
hoursOfOperation: DAYS.reduce((acc, day) => {
acc[day] = {
openTime: "",
openMeridiem: "AM",
closeTime: "",
closeMeridiem: "PM",
};
return acc;
}, {}),
};
}

export default function SignupCompany() {

  const handleRestaurantLogoFileChange = (idx, file) => {
    if (!file) return;

    const previewURL = URL.createObjectURL(file);

    setRestaurants(prev =>
      prev.map((r, i) =>
        i === idx
          ? {
              ...r,
              logoFile: file,
              logoPreview: previewURL,
            }
          : r
      )
    );
  };

// Company logo
const [companyLogoFile, setCompanyLogoFile] = useState(null);

// Company info
const [companyName, setCompanyName] = useState("");
const [companyPhone, setCompanyPhone] = useState("");
const [companyWebsite, setCompanyWebsite] = useState("");

// Login info (company account)
const [username, setUsername] = useState("");
const [email, setEmail] = useState("");
const [confirmEmail, setConfirmEmail] = useState("");
const [password, setPassword] = useState("");
const [confirmPassword, setConfirmPassword] = useState("");

// Company address
const [companyAddress, setCompanyAddress] = useState(makeEmptyAddress());

// Restaurants (multi)
const [restaurants, setRestaurants] = useState([makeEmptyRestaurant()]);

// Terms + modal
const [agree, setAgree] = useState(false);
const [termsOpen, setTermsOpen] = useState(false);

// Errors
const [error, setError] = useState("");

// --- Logo previews (safe + cleaned up) ---
const companyLogoPreview = useMemo(() => {
if (!companyLogoFile) return "";
return URL.createObjectURL(companyLogoFile);
}, [companyLogoFile]);

useEffect(() => {
return () => {

if (companyLogoPreview) URL.revokeObjectURL(companyLogoPreview);
};
}, [companyLogoPreview]);

const restaurantPreviews = useMemo(() => {
return restaurants.map((r) => (r.logoFile ? URL.createObjectURL(r.logoFile) : ""));
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [restaurants.map((r) => r.logoFile).join("|")]);

useEffect(() => {
return () => {
restaurantPreviews.forEach((src) => {
if (src) URL.revokeObjectURL(src);
});
};
}, [restaurantPreviews]);

// --- helpers ---
function updateCompanyAddress(key, value) {
setCompanyAddress((prev) => ({ ...prev, [key]: value }));
}

function updateRestaurant(index, patch) {
setRestaurants((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
}

function updateRestaurantAddress(index, key, value) {
setRestaurants((prev) =>
prev.map((r, i) =>
i === index ? { ...r, address: { ...r.address, [key]: value } } : r
)
);
}
function toggleRestaurantPreference(index, key) {
setRestaurants((prev) =>
prev.map((r, i) => {
if (i !== index) return r;

return {
...r,
preferences: {
...r.preferences,
[key]: !r.preferences?.[key],
},
};
})
);
}

function toggleRestaurantAttraction(index, key) {
setRestaurants((prev) =>
prev.map((r, i) => {
if (i !== index) return r;

return {
...r,
attractions: {
...r.attractions,
[key]: !r.attractions?.[key],
},
};
})
);
}

function toggleRestaurantCuisine(index, cuisine) {
setRestaurants((prev) =>
prev.map((r, i) => {
if (i !== index) return r;

const has = r.cuisines.includes(cuisine);
if (has) {
return { ...r, cuisines: r.cuisines.filter((c) => c !== cuisine) };
}

// Max 2 enforcement
if (r.cuisines.length >= 2) return r;

return { ...r, cuisines: [...r.cuisines, cuisine] };
})
);
}

function addRestaurant() {
setRestaurants((prev) => [...prev, makeEmptyRestaurant()]);
}

function removeRestaurant(index) {
setRestaurants((prev) => {

if (prev.length <= 1) return prev; // keep at least 1
return prev.filter((_, i) => i !== index);
});
}

function updateRestaurantHours(index, day, field, value) {
setRestaurants((prev) =>
prev.map((r, i) => {
if (i !== index) return r;
return {
...r,
hoursOfOperation: {
...r.hoursOfOperation,
[day]: {
...r.hoursOfOperation[day],
[field]: value,
},
},
};
})
);
}

function addRestaurantImage(index, file) {
if (!file) return;
setRestaurants((prev) =>
prev.map((r, i) => {
if (i !== index) return r;
if (r.images.length >= 10) return r;
return { ...r, images: [...r.images, file] };
})
);
}

function removeRestaurantImage(index, imgIndex) {
setRestaurants((prev) =>
prev.map((r, i) => {
if (i !== index) return r;
return { ...r, images: r.images.filter((_, j) => j !== imgIndex) };
})
);
}

function formatHours(hoursOfOperation) {
// UI-only: stored as a string in payload for now
return DAYS.map((day) => {
const h = hoursOfOperation?.[day];
const open = h?.openTime ? `${h.openTime} ${h.openMeridiem || "AM"}` : "";
const close = h?.closeTime ? `${h.closeTime} ${h.closeMeridiem || "PM"}` : "";
if (!open && !close) return `${day}: `;
if (open && !close) return `${day}: ${open}`;
if (!open && close) return `${day}: ${close}`;
return `${day}: ${open} - ${close}`;
}).join(", ");
}

// --- validation (UI + submit) ---
function validate() {
// Company login validation
if (email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
return "Company Email and Confirm Email must match.";
}
if (password !== confirmPassword) {
return "Company Password and Confirm Password must match.";
}
if (!agree) {
return "You must agree to the Terms & Conditions.";
}

// Restaurants validation
for (let i = 0; i < restaurants.length; i++) {
const r = restaurants[i];

if (!r.restaurantName.trim()) {
return `Restaurant #${i + 1}: Restaurant Name is required.`;
}

if (r.email.trim().toLowerCase() !== r.confirmEmail.trim().toLowerCase()) {
return `Restaurant #${i + 1}: Email and Confirm Email must match.`;
}

if (r.password !== r.confirmPassword) {
return `Restaurant #${i + 1}: Password and Confirm Password must match.`;
}

if (r.cuisines.length > 2) {
return `Restaurant #${i + 1}: Select up to 2 cuisines.`;
}
}

return "";
}

function handleSubmit(e) {
e.preventDefault();
setError("");

const msg = validate();
if (msg) {
setError(msg);
return;
}

// Stored-only for now (no Firebase wiring here)
const payload = {
company: {
companyName: companyName.trim(),
companyPhone: companyPhone.trim(),
companyWebsite: companyWebsite.trim(),
username: username.trim(),
email: email.trim(),
companyAddress,
// companyLogoFile stored later
},
restaurants: restaurants.map((r) => ({
restaurantName: r.restaurantName.trim(),
restaurantPhone: r.restaurantPhone.trim(),
website: r.website.trim(),
username: r.username.trim(),
email: r.email.trim(),
address: r.address,
cuisines: r.cuisines,
hours: formatHours(r.hoursOfOperation),
// logoFile stored later
// images stored later
})),
};

// eslint-disable-next-line no-console
console.log("Company Signup Payload (stored-only MVP):", payload);

alert("Company account form validated. (Backend wiring comes next.)");
}

// NOTE: previews for restaurant images (avoid leaking object URLs)
// ---- Restaurant image previews (safe + cleaned dependency) ----
const restaurantImagesKey = useMemo(() => {
return restaurants
.map((r) => r.images.map((f) => f?.name || "").join("|"))
.join("::");

}, [restaurants]);

const restaurantImagePreviews = useMemo(() => {
return restaurants.map((r) => r.images.map((f) => URL.createObjectURL(f)));
}, [restaurantImagesKey, restaurants]);

useEffect(() => {
return () => {
restaurantImagePreviews.forEach((arr) => {
arr.forEach((src) => {
if (src) URL.revokeObjectURL(src);
});
});
};
}, [restaurantImagePreviews]);

return (
<div className="signup-page">
<form className="signup-card" onSubmit={handleSubmit}>

{/* Company Logo */}
<div className="logo-block">
<label className="logo-preview logo-clickable">
  {companyLogoPreview ? (
    <img src={companyLogoPreview} alt="Company logo preview" />
  ) : (
    <div className="logo-placeholder">Add Logo</div>
  )}

  <input
    type="file"
    accept="image/*"
    hidden
    onChange={(e) => setCompanyLogoFile(e.target.files?.[0] || null)}
  />
</label>
</div>


<h1>Create Company Account</h1>
 
<div className="signup-subline">
<span>Already have an account?</span>{" "}
<Link className="signup-link" to="/login">
Log in
</Link>
</div>

{error && <div className="signup-error">{error}</div>}

{/* Company Information */}
<div className="signup-section">
<h2>Company Information</h2>
<input
placeholder="Company Name"
value={companyName}
onChange={(e) => setCompanyName(e.target.value)}
required
/>
<input

placeholder="Company Phone"
value={companyPhone}
onChange={(e) => setCompanyPhone(e.target.value)}
/>
<input
placeholder="Company Website (optional)"
value={companyWebsite}
onChange={(e) => setCompanyWebsite(e.target.value)}
/>
</div>

{/* Login Information */}
<div className="signup-section">
<h2>Login Information</h2>
<input
placeholder="Username"
value={username}
onChange={(e) => setUsername(e.target.value)}
required
/>
<input
placeholder="Email Address"
type="email"
value={email}
onChange={(e) => setEmail(e.target.value)}
required
/>
<input
placeholder="Confirm Email"
type="email"
value={confirmEmail}
onChange={(e) => setConfirmEmail(e.target.value)}
required
/>
<input
placeholder="Password"
type="password"
value={password}
onChange={(e) => setPassword(e.target.value)}
required
/>
<input
placeholder="Confirm Password"
type="password"
value={confirmPassword}
onChange={(e) => setConfirmPassword(e.target.value)}
required
/>
</div>

{/* Company Address */}
<div className="signup-section">
<h2>Company Address</h2>
<input
placeholder="Address Line 1"
value={companyAddress.line1}
onChange={(e) => updateCompanyAddress("line1", e.target.value)}
/>
<input
placeholder="Address Line 2"
value={companyAddress.line2}
onChange={(e) => updateCompanyAddress("line2", e.target.value)}
/>
<input
placeholder="City"
value={companyAddress.city}
onChange={(e) => updateCompanyAddress("city", e.target.value)}
/>
<input
placeholder="State"
value={companyAddress.state}
onChange={(e) => updateCompanyAddress("state", e.target.value)}
/>
<input
placeholder="ZIP"
value={companyAddress.zip}
onChange={(e) => updateCompanyAddress("zip", e.target.value)}
/>
</div>

{/* Restaurants */}
<div className="signup-section">
<div className="section-row">
<h2>Restaurants</h2>
<button
type="button"
className="secondary-btn"
onClick={addRestaurant}
>
Add a Restaurant
</button>
</div>

{restaurants.map((r, idx) => {
const cuisinesCount = r.cuisines.length;
return (
<div key={idx} className="restaurant-card"> 
<div className="restaurant-header">
<div className="restaurant-title">
Restaurant #{idx + 1}
{r.restaurantName ? ` - ${r.restaurantName}` : ""}
</div>
<button
type="button"
className="danger-link"
onClick={() => removeRestaurant(idx)}
disabled={restaurants.length <= 1}
title={
restaurants.length <= 1
? "At least one restaurant is required"
: "Remove"
}
>
Remove
</button>
</div>

{/* Restaurant Logo */}
<div className="logo-block">
  <label className="logo-preview logo-clickable">
    {r.logoFile ? (
      <img
        src={URL.createObjectURL(r.logoFile)}
        alt="Restaurant logo preview"
      />
    ) : (
      <div className="logo-placeholder">Add Logo</div>
    )}

    <input
      type="file"
      accept="image/*"
      hidden
      onChange={(e) =>
        handleRestaurantLogoFileChange(idx, e.target.files?.[0] || null)
      }

    />
  </label>
</div>

{/* Restaurant Identity */}
<div className="subsection">
<h3>Restaurant Information</h3>
<input
placeholder="Restaurant Name"
value={r.restaurantName}
onChange={(e) => updateRestaurant(idx, { restaurantName: e.target.value })}
required
/>
<input
placeholder="Restaurant Phone"
value={r.restaurantPhone}
onChange={(e) => updateRestaurant(idx, { restaurantPhone: e.target.value })}
/>
<input
placeholder="Restaurant Website (optional)"
value={r.website}
onChange={(e) => updateRestaurant(idx, { website: e.target.value })}
/>
</div>

{/* Restaurant Login (stored-only) */}
<div className="subsection">
<h3>Restaurant Login (Stored Only)</h3>
<input
placeholder="Restaurant Username"
value={r.username}
onChange={(e) => updateRestaurant(idx, { username: e.target.value })}
required
/>
<input
placeholder="Restaurant Email"
type="email"
value={r.email}
onChange={(e) => updateRestaurant(idx, { email: e.target.value })}
required
/>
<input
placeholder="Confirm Restaurant Email"
type="email"
value={r.confirmEmail}
onChange={(e) => updateRestaurant(idx, { confirmEmail: e.target.value })}
required
/>
<input
placeholder="Restaurant Password"
type="password"
value={r.password}
onChange={(e) => updateRestaurant(idx, { password: e.target.value })}
required
/>
<input
placeholder="Confirm Restaurant Password"
type="password"
value={r.confirmPassword}
onChange={(e) => updateRestaurant(idx, { confirmPassword: e.target.value })}
required
/>
</div>

{/* Restaurant Address */}
<div className="subsection">
<h3>Restaurant Address</h3>
<input
placeholder="Address Line 1"
value={r.address.line1}
onChange={(e) => updateRestaurantAddress(idx, "line1", e.target.value)}
/>
<input
placeholder="Address Line 2"
value={r.address.line2}
onChange={(e) => updateRestaurantAddress(idx, "line2", e.target.value)}
/>
<input
placeholder="City"
value={r.address.city}
onChange={(e) => updateRestaurantAddress(idx, "city", e.target.value)}
/>
<input
placeholder="State"
value={r.address.state}
onChange={(e) => updateRestaurantAddress(idx, "state", e.target.value)}
/>
<input
placeholder="ZIP"
value={r.address.zip}
onChange={(e) => updateRestaurantAddress(idx, "zip", e.target.value)}
/>
</div>

{/* Cuisine Selection */}
<div className="subsection">
<div className="cuisine-head">
<h3>Cuisine Type</h3>
<div className="cuisine-hint">Select up to 2 ({cuisinesCount}/2)</div>
</div>
<div className="signup-checkgrid">
{CUISINE_OPTIONS.map((c) => {
const checked = r.cuisines.includes(c);
const disable = !checked && r.cuisines.length >= 2;

return (
<label key={c} className={`signup-check ${disable ? "disabled" : ""}`}>
<input
type="checkbox"
checked={checked}
disabled={disable}
onChange={() => toggleRestaurantCuisine(idx, c)}
/>
<span>{c}</span>
</label>
);
})}
</div>
</div>
 
{/* Attractions */}
<div className="subsection">
<h3>Attractions</h3>
<div className="signup-checkgrid">
{[
["bowling", "Bowling"],
["gamingVenue", "Gaming Venue (Arcade/Entertainment)"],
].map(([key, label]) => (
<label key={key} className="signup-check">
<input
type="checkbox"
checked={r.attractions?.[key] || false}
onChange={() => toggleRestaurantAttraction(idx, key)}
/>
<span>{label}</span>
</label>
))}
</div>
</div>

{/* Restaurant Preferences */}
<div className="subsection">
<h3>Restaurant Preferences</h3>
<div className="signup-checkgrid">
{[
["oceanView", "Ocean View"],
["waterView", "Water View"],
["riverfront", "Riverfront"],
["patioSeating", "Patio Seating"],
["rooftop", "Rooftop"],
["outdoorSeating", "Outdoor Seating"],
["privateDining", "Private Dining"],
["largeParties", "Large Parties"],
["smallIntimate", "Small / Intimate"],
["liveMusic", "Live Music"],
["valetparking", "Valet Parking"],
["streetParking", "Street Parking"],
["garageParking", "Garage Parking"],
["gamingVenue", "Gaming Venue"],
["vegetarianOptions", "Vegetarian Options"],
["veganOptions", "Vegan Options"],
["glutenFreeOptions", "Gluten-Free Options"],

].map(([key, label]) => (
<label key={key} className="signup-check">
<input
type="checkbox"
checked={r.preferences?.[key] || false}
onChange={() => toggleRestaurantPreference(idx, key)}
/>
<span>{label}</span>
</label>
))}
</div>
</div>

{/* RESTAURANT IMAGES (PER RESTAURANT, ABOVE HOURS) */}
<div className="subsection">
<div className="images-header">
<h3>Add Images</h3>
<div className="images-hint">Upload up to 10 photos</div>
</div>
<div className="restaurant-image-grid">
{restaurantImagePreviews[idx]?.map((src, imgIdx) => (
<div key={`${idx}-${imgIdx}`} className="restaurant-image-item">
<img src={src} alt={`Restaurant ${idx + 1} upload ${imgIdx + 1}`} />
<button
type="button"
className="image-remove-btn"
onClick={() => removeRestaurantImage(idx, imgIdx)}
aria-label="Remove image"
title="Remove"
>
</button>
</div>
))}

{r.images.length < 10 && (
<label className="restaurant-image-upload">
+ Add Image
<input
type="file"
hidden
accept="image/*"
onChange={(e) => addRestaurantImage(idx, e.target.files?.[0] || null)}
/>
</label>
)}
</div>
</div>
 
{/* Hours of Operation (PER RESTAURANT) */}
<div className="subsection">
<div className="hours-header">
<h3>Hours of Operation</h3>
<div className="hours-hint">Select hours</div>
</div>
<div className="hours-grid">
{DAYS.map((day) => (
<div key={day} className="hours-row">
{/* Day */}
<div className="hours-left">
<div className="hours-day">{day}</div>
</div>

{/* OPEN TIME (OPEN / CLOSED INSIDE DROPDOWN) */}
<div className="hours-controls">
<select
className="hours-time"
value={r.hoursOfOperation[day].openTime}
onChange={(e) =>
updateRestaurantHours(idx, day, "openTime", e.target.value)
}
>
<option value="">CLOSED</option>
{Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
<option key={`open-${day}-${h}`} value={h}>
{h}
</option>
))}
</select>
<select

className="hours-meridiem"
value={r.hoursOfOperation[day].openMeridiem}
onChange={(e) =>
updateRestaurantHours(idx, day, "openMeridiem", e.target.value)
}
>
<option value="AM">AM</option>
<option value="PM">PM</option>
</select>
</div>
 
{/* CLOSE TIME */}
<div className="hours-controls">
<select
className="hours-time"
value={r.hoursOfOperation[day].closeTime}
onChange={(e) =>
updateRestaurantHours(idx, day, "closeTime", e.target.value)
}
>
<option value="">—</option>
{Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
<option key={`close-${day}-${h}`} value={h}>
{h}
</option>
))}
</select>
<select
className="hours-meridiem"
value={r.hoursOfOperation[day].closeMeridiem}
onChange={(e) =>
updateRestaurantHours(idx, day, "closeMeridiem", e.target.value)
}
>
<option value="AM">AM</option>
<option value="PM">PM</option>
</select>
</div>
</div>
))} 
</div>
</div>
</div>
);
})}

</div>

{/* Terms and Conditions */}
<div className="signup-terms single-line">
  <label>
    <input
      type="checkbox"
      checked={agree}
      onChange={(e) => setAgree(e.target.checked)}
    />
    <span>
      I agree to the{" "}
      <button
        type="button"
        className="terms-link white"
        onClick={() => setTermsOpen(true)}
      >
        Terms & Conditions
      </button>
    </span>
  </label>
</div>

<button
  type="submit"
  className="primary-btn submit-btn"
  disabled={!agree}
>
  Create Company Account
</button>
</form>

{termsOpen && (
  <div className="modal-overlay">
    <div className="modal-card">
      <div className="modal-title">Terms & Conditions</div>
      <div className="modal-body">
        By creating an account, you agree to The Lineup platform terms.
      </div>
      <button
        type="button"
        className="primary-btn"
        onClick={() => setTermsOpen(false)}
      >
        Close
      </button>
    </div>
  </div>
)}
</div>
);
}
