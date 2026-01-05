// src/router/AppRouter.jsx

import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Pages
import HomePage from "../pages/HomePage/HomePage";
import Login from "../pages/Login/Login";
import ProfileSettings from "../pages/ProfileSettings/ProfileSettings";
import EmployeeProfileSettings from "../pages/ProfileSettings/EmployeeProfileSettings";
import StaffProfile from "../pages/StaffProfile/StaffProfile";
import MyReservations from "../pages/MyReservations/MyReservations";
import ShiftGamesHub from "../pages/Dashboards/RestaurantDashboard/pages/ShiftGamesHub";
import RestaurantReviewPage from "../pages/RestaurantReview/RestaurantReviewPage";
import MyReviewsPage from "../pages/Reviews/MyReviewsPage";
import PostReviewPage from "../pages/Reviews/PostReviewPage";
import ReadReviewsPage from "../pages/Reviews/ReadReviewsPage";
import FavoriteReviewersPage from "../pages/Reviews/FavoriteReviewersPage";
import TipshareWallet from "../pages/TipshareWallet/TipshareWallet";
import StorePage from "../pages/Store/StorePage";
import TestDashboard from "../pages/Dashboards/TestDashboard/TestDashboard";
import BowlingReservationExtension from "../pages/BowlingReservationExtension/BowlingReservationExtension";
import Reservation from "../pages/Reservation/Reservation";
import ValetPreBookingPage from "../pages/ValetPreBooking/ValetPreBookingPage";
import BowlingReservationPage from "../pages/BowlingReservation/BowlingReservationPage";
import VenueReservationPage from "../pages/VenueReservation/VenueReservationPage";
import FavoritesPage from "../pages/Favorites/FavoritesPage";
import PointsPage from "../pages/Badges/PointsPage";

// Try importing RestaurantDashboard with error handling
let RestaurantDashboard = null;
try {
  RestaurantDashboard = require("../pages/Dashboards/RestaurantDashboard/RestaurantDashboard").default;
} catch (error) {
  console.error("ERROR importing RestaurantDashboard:", error);
  RestaurantDashboard = function ErrorFallback() {
    return (
      <div style={{ padding: 40, color: "red", backgroundColor: "#000" }}>
        <h1>Import Error</h1>
        <p>Failed to load RestaurantDashboard</p>
      </div>
    );
  };
}

// Import Employee Dashboard
let EmployeeDashboard = null;
try {
  EmployeeDashboard = require("../pages/Dashboards/EmployeeDashboard/EmployeeDashboard").default;
} catch (error) {
  console.error("ERROR importing EmployeeDashboard:", error);
  EmployeeDashboard = function ErrorFallback() {
    return (
      <div style={{ padding: 40, color: "red", backgroundColor: "#000" }}>
        <h1>Import Error</h1>
        <p>Failed to load EmployeeDashboard</p>
      </div>
    );
  };
}

// Import Company Dashboard
let CompanyDashboard = null;
try {
  CompanyDashboard = require("../pages/Dashboards/CompanyDashboard/CompanyDashboard").default;
} catch (error) {
  console.error("ERROR importing CompanyDashboard:", error);
  CompanyDashboard = function ErrorFallback() {
    return (
      <div style={{ padding: 40, color: "red", backgroundColor: "#000" }}>
        <h1>Import Error</h1>
        <p>Failed to load CompanyDashboard</p>
      </div>
    );
  };
}

// Import Valet Driver Dashboard
let ValetDriverDashboard = null;
try {
  ValetDriverDashboard = require("../pages/Dashboards/ValetDriverDashboard/ValetDriverDashboard").default;
} catch (error) {
  console.error("ERROR importing ValetDriverDashboard:", error);
  ValetDriverDashboard = function ErrorFallback() {
    return (
      <div style={{ padding: 40, color: "red", backgroundColor: "#000" }}>
        <h1>Import Error</h1>
        <p>Failed to load ValetDriverDashboard</p>
      </div>
    );
  };
}

// Import Valet Company Dashboard
let ValetCompanyDashboard = null;
try {
  ValetCompanyDashboard = require("../pages/Dashboards/ValetCompanyDashboard/ValetCompanyDashboard").default;
} catch (error) {
  console.error("ERROR importing ValetCompanyDashboard:", error);
  ValetCompanyDashboard = function ErrorFallback() {
    return (
      <div style={{ padding: 40, color: "red", backgroundColor: "#000" }}>
        <h1>Import Error</h1>
        <p>Failed to load ValetCompanyDashboard</p>
      </div>
    );
  };
}

export default function AppRouter() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/profile-settings" element={<ProfileSettings />} />
        <Route path="/profile-settings/employee" element={<EmployeeProfileSettings />} />
        <Route path="/staff/:staffId" element={<StaffProfile />} />
        
        {/* Restaurant Dashboard */}
        {RestaurantDashboard && (
          <Route
            path="/restaurant/:restaurantId"
            element={<RestaurantDashboard />}
          />
        )}
        
        {/* Employee Dashboard */}
        {EmployeeDashboard && (
          <Route
            path="/dashboard/employee/:restaurantId"
            element={<EmployeeDashboard />}
          />
        )}
        
        {/* Company Dashboard */}
        {CompanyDashboard && (
          <Route
            path="/dashboard/company/:companyId"
            element={<CompanyDashboard />}
          />
        )}
        
        {/* Valet Driver Dashboard */}
        {ValetDriverDashboard && (
          <Route
            path="/dashboard/valet/:restaurantId"
            element={<ValetDriverDashboard />}
          />
        )}
        
        {/* Valet Company Dashboard */}
        {ValetCompanyDashboard && (
          <Route
            path="/dashboard/valet-company/:companyId"
            element={<ValetCompanyDashboard />}
          />
        )}
        
        {/* Test Dashboard */}
        <Route path="/dashboard/test" element={<TestDashboard />} />
        
        <Route path="/shift-games" element={<ShiftGamesHub />} />
        
        {/* Restaurant Review */}
        <Route path="/review/:restaurantId" element={<RestaurantReviewPage />} />
        
        {/* Review Pages */}
        <Route path="/reviews/my" element={<MyReviewsPage />} />
        <Route path="/reviews/post" element={<PostReviewPage />} />
        <Route path="/reviews/read" element={<ReadReviewsPage />} />
        <Route path="/reviews/favorites" element={<FavoriteReviewersPage />} />
        
        {/* Store */}
        <Route path="/store" element={<StorePage />} />
        
        {/* Reservations */}
        <Route path="/reservations" element={<MyReservations />} />
        <Route path="/reservation" element={<Reservation />} />
        
        {/* Valet Pre-Booking */}
        <Route path="/valet/prebook" element={<ValetPreBookingPage />} />
        
        {/* Bowling Reservations */}
        <Route path="/bowling/reservation/:reservationId" element={<BowlingReservationExtension />} />
        <Route path="/bowling/reservation/new" element={<BowlingReservationPage />} />
        
        {/* Venue Reservations */}
        <Route path="/venue/reservation" element={<VenueReservationPage />} />
        
        {/* Favorites */}
        <Route path="/favorites" element={<FavoritesPage />} />
        
        {/* Points & Badges */}
        <Route path="/badges" element={<PointsPage />} />
        <Route path="/lineup-points" element={<PointsPage />} />
        
        {/* TipShare Wallet */}
        <Route path="/tipshare-wallet" element={<TipshareWallet />} />
        <Route path="/tipshare" element={<TipshareWallet />} />
        
        <Route path="*" element={<div style={{ color: "white", padding: 40 }}>404</div>} />
      </Routes>
    </Router>
  );
}