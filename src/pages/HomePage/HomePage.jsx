// src/pages/HomePage/HomePage.jsx
import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";

import "./HomePage.css";
import MapView from "../../components/MapView/MapView";
import { HOME_PAGE_CUISINE_OPTIONS } from "../../constants/cuisineOptions";

import lineupLogo from "../../assets/logos/the_lineup_logo.png";
import forkIcon from "../../assets/icons/icon_fork.png";
import knifeIcon from "../../assets/icons/icon_knife.png";
import spoonIcon from "../../assets/icons/icon_spoon.png";
import RestaurantList from "../../components/RestaurantList";
import PointsDisplay from "../../components/PointsDisplay";
import { db } from "../../hooks/services/firebase";
import ProfileToggle from "../../components/ProfileToggle/ProfileToggle";

export default function HomePage() {
  const auth = getAuth();
  const [viewMode, setViewMode] = useState("map");

  const [currentUser, setCurrentUser] = useState(null);

  const [cuisineOpen, setCuisineOpen] = useState(false);
  const [radiusOpen, setRadiusOpen] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const [selectedCuisine, setSelectedCuisine] = useState("Cuisines");
  const [selectedRadius, setSelectedRadius] = useState("10 miles");
  const [selectedRating, setSelectedRating] = useState("Live Rating");

  const [userName, setUserName] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [isEmployee, setIsEmployee] = useState(false);
  const [employeeRestaurantId, setEmployeeRestaurantId] = useState(null);
  const navigate = useNavigate();

  const cuisineOptions = HOME_PAGE_CUISINE_OPTIONS;

  const radiusOptions = ["Any Radius", "5 miles", "10 miles", "15 miles", "25 miles"];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, [auth]);

  const loadUserData = useCallback(async () => {
    if (!currentUser) {
      setUserName(null);
      setUserRole(null);
      setIsEmployee(false);
      setEmployeeRestaurantId(null);
      return;
    }

    try {
      const userRef = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        setUserName(userData.name || currentUser.displayName || "User");
        const role = userData.role;
        setUserRole(role);
        
        // Check if user is an employee
        const isEmp = role === "EMPLOYEE" || role === "SERVER" || role === "COOK" || role === "HOST" || role === "VALET";
        setIsEmployee(isEmp);
        
        // If employee, find their restaurant
        if (isEmp) {
          try {
            const restaurantsRef = collection(db, "restaurants");
            const restaurantsSnap = await getDocs(restaurantsRef);
            
            for (const restaurantDoc of restaurantsSnap.docs) {
              const restaurantId = restaurantDoc.id;
              const staffRef = collection(db, "restaurants", restaurantId, "staff");
              const staffSnap = await getDocs(staffRef);
              
              const found = staffSnap.docs.find(staffDoc => {
                const staffData = staffDoc.data();
                return (staffData.uid === currentUser.uid || staffDoc.id === currentUser.uid);
              });
              
              if (found) {
                setEmployeeRestaurantId(restaurantId);
                break;
              }
            }
          } catch (err) {
            console.error("Error finding employee restaurant:", err);
          }
        }
      } else {
        setUserName(currentUser.displayName || "User");
        setUserRole(null);
        setIsEmployee(false);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
      setUserName(currentUser?.displayName || "User");
      setUserRole(null);
      setIsEmployee(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      const target = e.target;
      
      if (
        target.closest(".dropdown-menu") ||
        target.closest(".row-two-section") ||
        target.closest(".user-menu") ||
        target.closest(".user-bubble")
      ) {
        return;
      }
      
      setCuisineOpen(false);
      setRadiusOpen(false);
      setRatingOpen(false);
      setUserMenuOpen(false);
    };
    
    const delayedHandler = (e) => {
      setTimeout(() => handleClickOutside(e), 0);
    };
    
    document.addEventListener("click", delayedHandler);
    
    return () => {
      document.removeEventListener("click", delayedHandler);
    };
  }, []);

  return (
    <div className="homepage-root">
      <div className="homepage-shell">

        <div className="row-one">
          <img src={lineupLogo} className="homepage-logo" alt="The Lineup" />
        </div>

        <div className="row-two">

          <div
            className="row-two-section"
            onClick={(e) => {
              e.stopPropagation();
              setCuisineOpen(!cuisineOpen);
              setRadiusOpen(false);
              setRatingOpen(false);
            }}
          >
            <span className="row-two-text">{selectedCuisine}</span>
            <img src={forkIcon} className="filter-icon" alt="" />

            {cuisineOpen && (
              <div className="dropdown-menu" onClick={(e) => e.stopPropagation()}>
                {cuisineOptions.map((c) => (
                  <div
                    key={c}
                    className="dropdown-item"
                    onClick={() => {
                      setSelectedCuisine(c);
                      setCuisineOpen(false);
                    }}
                  >
                    {c}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            className="row-two-section"
            onClick={(e) => {
              e.stopPropagation();
              setRadiusOpen(!radiusOpen);
              setCuisineOpen(false);
              setRatingOpen(false);
            }}
          >
            <span className="row-two-text">{selectedRadius}</span>
            <img src={knifeIcon} className="filter-icon" alt="" />

            {radiusOpen && (
              <div className="dropdown-menu" onClick={(e) => e.stopPropagation()}>
                {radiusOptions.map((r) => (
                  <div
                    key={r}
                    className="dropdown-item"
                    onClick={() => {
                      setSelectedRadius(r);
                      setRadiusOpen(false);
                    }}
                  >
                    {r}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            className="row-two-section"
            onClick={(e) => {
              e.stopPropagation();
              setRatingOpen(!ratingOpen);
              setCuisineOpen(false);
              setRadiusOpen(false);
            }}
          >
            <span className="row-two-text">{selectedRating}</span>
            <img src={spoonIcon} className="filter-icon" alt="" />

            {ratingOpen && (
              <div className="dropdown-menu" onClick={(e) => e.stopPropagation()}>
                <div
                  key="5stars"
                  className="dropdown-item rating-star-item rating-5"
                  onClick={() => {
                    setSelectedRating("5 Stars");
                    setRatingOpen(false);
                  }}
                >
                  ★★★★★
                </div>
                <div
                  key="4stars"
                  className="dropdown-item rating-star-item rating-4"
                  onClick={() => {
                    setSelectedRating("4 Stars");
                    setRatingOpen(false);
                  }}
                >
                  ★★★★
                </div>
                <div
                  key="3stars"
                  className="dropdown-item rating-star-item rating-3"
                  onClick={() => {
                    setSelectedRating("3 Stars");
                    setRatingOpen(false);
                  }}
                >
                  ★★★
                </div>
                <div
                  key="2stars"
                  className="dropdown-item rating-star-item rating-2"
                  onClick={() => {
                    setSelectedRating("2 Stars");
                    setRatingOpen(false);
                  }}
                >
                  ★★
                </div>
                <div
                  key="1star"
                  className="dropdown-item rating-star-item rating-1"
                  onClick={() => {
                    setSelectedRating("1 Star");
                    setRatingOpen(false);
                  }}
                >
                  ★
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="row-three">
          {!currentUser ? (
            <Link to="/login" className="login-link">SIGN UP/LOG IN</Link>
          ) : (
            <div className="user-bubble-container">
              <div style={{ pointerEvents: 'none' }}>
                <PointsDisplay size="small" />
              </div>
              {isEmployee && <ProfileToggle />}
              <div 
                className="user-bubble"
                onClick={(e) => {
                  e.stopPropagation();
                  setUserMenuOpen(!userMenuOpen);
                  setCuisineOpen(false);
                  setRadiusOpen(false);
                  setRatingOpen(false);
                }}
              >
                <span className="username" style={{ pointerEvents: 'none' }}>{userName || "User"}</span>

                {userMenuOpen && (
                  <div className="user-menu" onClick={(e) => e.stopPropagation()}>
                    <Link to="/profile-settings" className="user-menu-item">
                      Profile Settings
                    </Link>
                    <Link to="/reservations" className="user-menu-item">
                      My Reservations
                    </Link>
                    <Link to="/favorites" className="user-menu-item">
                      My Favorites
                    </Link>
                    <Link to="/store" className="user-menu-item">
                      The Lineup Store
                    </Link>
                    <Link to="/badges" className="user-menu-item">
                      My Lineup Points / Badges
                    </Link>
                    <Link to="/tipshare-wallet" className="user-menu-item tipshare-menu-item">
                      TIP<span className="tipshare-dollar">$</span>HARE
                    </Link>
                    <Link 
                      to={`/dashboard/test`} 
                      className="user-menu-item"
                    >
                      Test Dashboard
                    </Link>
                    <div 
                      className="user-menu-item" 
                      onClick={async () => {
                        try {
                          await signOut(auth);
                          setUserMenuOpen(false);
                          navigate("/login");
                        } catch (error) {
                          console.error("Error signing out:", error);
                        }
                      }}
                    >
                      Log Out
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {viewMode === "map" ? (
          <MapView
            selectedCuisine={selectedCuisine}
            selectedRadius={selectedRadius}
            viewMode={viewMode}
            setViewMode={setViewMode}
          />
        ) : (
          <RestaurantList
            selectedCuisine={selectedCuisine}
            selectedRadius={selectedRadius}
            setViewMode={setViewMode}
          />
        )}

      </div>
    </div>
  );
}
