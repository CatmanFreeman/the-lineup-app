// src/pages/Login/Login.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../hooks/services/firebase";
import lineupLogo from "../../assets/logos/the_lineup_logo.png";
import "./Login.css";
export default function Login() {
 const navigate = useNavigate();
 const [email, setEmail] = useState("");
 const [password, setPassword] = useState("");
 const [showPassword, setShowPassword] = useState(false);
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState("");
 async function handleSubmit(e) {
 e.preventDefault();
 setError("");
 setLoading(true);
 try {
   const trimmedEmail = email.trim();
   if (!trimmedEmail || !password) {
     setError("Please enter both email and password");
     setLoading(false);
     return;
   }
   await signInWithEmailAndPassword(auth, trimmedEmail, password);
   // After successful login, go home
   navigate("/", { replace: true });
 } catch (err) {
   console.error("Login error:", err);
   let errorMessage = "Login failed. Please try again.";
   if (err.code === "auth/user-not-found") {
     errorMessage = "No account found with this email.";
   } else if (err.code === "auth/wrong-password") {
     errorMessage = "Incorrect password.";
   } else if (err.code === "auth/invalid-email") {
     errorMessage = "Invalid email address.";
   } else if (err.code === "auth/too-many-requests") {
     errorMessage = "Too many failed attempts. Please try again later.";
   } else if (err.code === "auth/network-request-failed") {
     errorMessage = "Network error. Please check your internet connection and try again.";
   } else if (err.code === "auth/invalid-credential") {
     errorMessage = "Invalid email or password.";
   } else if (err.message) {
     errorMessage = err.message;
   }
   setError(errorMessage);
 } finally {
   setLoading(false);
 }
 }
 return (
 <div className="login-page">
   <img src={lineupLogo} className="login-logo" alt="The Lineup" />
 <div className="login-card">
 <h1 className="login-title">Log In</h1>
 <form onSubmit={handleSubmit} className="login-form" name="loginForm" autoComplete="on">
 <input
 className="login-input"
 type="email"
 name="email"
 placeholder="Email Address"
 autoComplete="email"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 required
 />
 <div className="login-password-wrapper">
 <input
 className="login-input login-input-password"
 type={showPassword ? "text" : "password"}
 name="password"
 placeholder="Password"
 autoComplete="current-password"
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 required
 />
 <button
 type="button"
 className="login-show-password"
 onClick={() => setShowPassword(!showPassword)}
 aria-label={showPassword ? "Hide password" : "Show password"}
 >
 {showPassword ? (
   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
     <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
     <line x1="1" y1="1" x2="23" y2="23"></line>
   </svg>
 ) : (
   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
     <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
     <circle cx="12" cy="12" r="3"></circle>
   </svg>
 )}
 </button>
 </div>
 {error ? <div className="login-error">{error}</div> : null}
 <button className="login-submit" type="submit" disabled={loading}>
 {loading ? "Logging in..." : "Log In"}
 </button>
 </form>
        <div className="login-footer">
          <span>Don't have an account? </span>
          <Link className="login-link" to="/signup">
            Create one
          </Link>
        </div>
 </div>
 </div>
 );
}