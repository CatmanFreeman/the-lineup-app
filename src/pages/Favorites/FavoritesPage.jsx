import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../../hooks/services/firebase";
import { unfavoriteUserOrRestaurant } from "../../utils/favoritesService";
import { removeFavoriteReviewer } from "../../utils/favoriteReviewerService";
import "./FavoritesPage.css";

const TABS = {
  RESTAURANT: "restaurant",
  MENU_ITEM: "menuItem",
  DINER: "diner",
  FOH: "foh",
  BOH: "boh",
};

export default function FavoritesPage() {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState(TABS.RESTAURANT);
  const [loading, setLoading] = useState(true);

  // Data states
  const [favoriteRestaurants, setFavoriteRestaurants] = useState([]);
  const [favoriteMenuItems, setFavoriteMenuItems] = useState([]);
  const [favoriteDiners, setFavoriteDiners] = useState([]);
  const [favoriteFOH, setFavoriteFOH] = useState([]);
  const [favoriteBOH, setFavoriteBOH] = useState([]);

  // Mock city/state data for diners (for testing)
  const getDinerLocation = (dinerId, dinerName, dinerCity, dinerState) => {
    // Use actual data if available
    if (dinerCity && dinerState && dinerCity !== "Unknown" && dinerState !== "Unknown") {
      return { city: dinerCity, state: dinerState };
    }
    // Mock data for testing
    if (dinerName?.toLowerCase().includes("sarah")) {
      return { city: "Austin", state: "Texas" };
    }
    if (dinerName?.toLowerCase().includes("amanda")) {
      return { city: "Cincinnati", state: "Ohio" };
    }
    // Default
    return { city: "Unknown", state: "Unknown" };
  };

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    loadAllFavorites();
  }, [currentUser]);

  const loadAllFavorites = async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      // Load all favorites from subcollection
      const favoritesRef = collection(db, "users", currentUser.uid, "favorites");
      const favoritesSnap = await getDocs(favoritesRef);

      const restaurants = [];
      const menuItems = [];
      const diners = [];
      const foh = [];
      const boh = [];

      for (const favDoc of favoritesSnap.docs) {
        const favData = favDoc.data();
        const { targetId, targetType } = favData;

        if (targetType === "restaurant") {
          try {
            const restaurantRef = doc(db, "restaurants", targetId);
            const restaurantSnap = await getDoc(restaurantRef);
            if (restaurantSnap.exists()) {
              restaurants.push({
                id: targetId,
                favoriteId: favDoc.id,
                ...restaurantSnap.data(),
              });
            }
          } catch (err) {
            console.error(`Error loading restaurant ${targetId}:`, err);
          }
        } else if (targetType === "menuItem") {
          try {
            // Menu items might be stored differently - check if there's a menuItems collection
            // For now, we'll store menu item favorites with restaurant reference
            menuItems.push({
              id: targetId,
              favoriteId: favDoc.id,
              ...favData,
            });
          } catch (err) {
            console.error(`Error loading menu item ${targetId}:`, err);
          }
        } else if (targetType === "staff") {
          try {
            const staffRef = doc(db, "users", targetId);
            const staffSnap = await getDoc(staffRef);
            if (staffSnap.exists()) {
              const staffData = staffSnap.data();
              // Check if FOH or BOH based on position
              const position = staffData.position || "";
              const isFOH = ["Server", "Bartender", "Host", "Manager", "Server Assistant"].some(
                (p) => position.toLowerCase().includes(p.toLowerCase())
              );
              const isBOH = ["Chef", "Cook", "Expo", "Grill", "Saute", "Prep", "Dishwasher", "Head Chef"].some(
                (p) => position.toLowerCase().includes(p.toLowerCase())
              );

              const staffInfo = {
                id: targetId,
                favoriteId: favDoc.id,
                name: staffData.displayName || staffData.name || "Unknown",
                picture: staffData.profilePicture || staffData.photoURL || null,
                position: position,
                restaurantId: staffData.restaurantId || null,
                restaurantName: null,
                city: null,
                state: null,
              };

              // Load restaurant info if available
              if (staffData.restaurantId) {
                try {
                  const restaurantRef = doc(db, "restaurants", staffData.restaurantId);
                  const restaurantSnap = await getDoc(restaurantRef);
                  if (restaurantSnap.exists()) {
                    const restaurantData = restaurantSnap.data();
                    staffInfo.restaurantName = restaurantData.name;
                    staffInfo.city = restaurantData.city;
                    staffInfo.state = restaurantData.state;
                  }
                } catch (err) {
                  console.error(`Error loading restaurant for staff:`, err);
                }
              }

              if (isFOH) {
                foh.push(staffInfo);
              } else if (isBOH) {
                boh.push(staffInfo);
              }
            }
          } catch (err) {
            console.error(`Error loading staff ${targetId}:`, err);
          }
        } else if (targetType === "diner") {
          try {
            const dinerRef = doc(db, "users", targetId);
            const dinerSnap = await getDoc(dinerRef);
            if (dinerSnap.exists()) {
              const dinerData = dinerSnap.data();
              const dinerLocation = getDinerLocation(
                targetId,
                dinerData.displayName || dinerData.name || "Unknown",
                dinerData.city,
                dinerData.state
              );
              diners.push({
                id: targetId,
                favoriteId: favDoc.id,
                name: dinerData.displayName || dinerData.name || "Unknown",
                picture: dinerData.profilePicture || dinerData.photoURL || null,
                city: dinerLocation.city,
                state: dinerLocation.state,
                email: dinerData.email || null,
              });
            }
          } catch (err) {
            console.error(`Error loading diner ${targetId}:`, err);
          }
        }
      }

      // Also load favorite reviewers (diners) from user document
      try {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const favoriteReviewerIds = userData.favoriteReviewers || [];
          
          for (const reviewerId of favoriteReviewerIds) {
            // Check if already loaded from favorites subcollection
            if (!diners.find(d => d.id === reviewerId)) {
              try {
                const dinerRef = doc(db, "users", reviewerId);
                const dinerSnap = await getDoc(dinerRef);
                if (dinerSnap.exists()) {
                  const dinerData = dinerSnap.data();
                  const dinerLocation = getDinerLocation(
                    reviewerId,
                    dinerData.displayName || dinerData.name || "Unknown",
                    dinerData.city,
                    dinerData.state
                  );
                  diners.push({
                    id: reviewerId,
                    favoriteId: `reviewer_${reviewerId}`, // Virtual ID for favoriteReviewers
                    name: dinerData.displayName || dinerData.name || "Unknown",
                    picture: dinerData.profilePicture || dinerData.photoURL || null,
                    city: dinerLocation.city,
                    state: dinerLocation.state,
                    email: dinerData.email || null,
                    isFromReviewers: true, // Flag to handle removal differently
                  });
                }
              } catch (err) {
                console.error(`Error loading favorite reviewer ${reviewerId}:`, err);
              }
            }
          }
        }
      } catch (err) {
        console.error("Error loading favorite reviewers:", err);
      }

      setFavoriteRestaurants(restaurants);
      setFavoriteMenuItems(menuItems);
      setFavoriteDiners(diners);
      setFavoriteFOH(foh);
      setFavoriteBOH(boh);
    } catch (error) {
      console.error("Error loading favorites:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnfavorite = async (favoriteId, targetId, targetType, isFromReviewers = false) => {
    if (!currentUser) return;

    // Show confirmation dialog
    const confirmed = window.confirm("Remove from favorites?");
    if (!confirmed) return;

    try {
      if (isFromReviewers && targetType === "diner") {
        // Handle favoriteReviewers array removal
        await removeFavoriteReviewer(currentUser.uid, targetId);
      } else {
        await unfavoriteUserOrRestaurant(currentUser.uid, targetId, targetType);
      }
      // Reload favorites
      loadAllFavorites();
    } catch (error) {
      console.error("Error unfavoriting:", error);
      alert("Failed to remove favorite. Please try again.");
    }
  };

  // Group restaurants by city and state
  const restaurantsByLocation = useMemo(() => {
    const grouped = {};
    favoriteRestaurants.forEach((restaurant) => {
      const key = `${restaurant.city || "Unknown"}, ${restaurant.state || "Unknown"}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(restaurant);
    });
    return grouped;
  }, [favoriteRestaurants]);

  // Group menu items by city and state (based on restaurant location)
  const menuItemsByLocation = useMemo(() => {
    const grouped = {};
    favoriteMenuItems.forEach((item) => {
      const key = `${item.city || "Unknown"}, ${item.state || "Unknown"}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(item);
    });
    return grouped;
  }, [favoriteMenuItems]);

  // Group FOH by position
  const fohByPosition = useMemo(() => {
    const grouped = {};
    favoriteFOH.forEach((staff) => {
      const position = staff.position || "Other";
      if (!grouped[position]) {
        grouped[position] = [];
      }
      grouped[position].push(staff);
    });
    return grouped;
  }, [favoriteFOH]);

  // Group BOH by position
  const bohByPosition = useMemo(() => {
    const grouped = {};
    favoriteBOH.forEach((staff) => {
      const position = staff.position || "Other";
      if (!grouped[position]) {
        grouped[position] = [];
      }
      grouped[position].push(staff);
    });
    return grouped;
  }, [favoriteBOH]);

  if (loading) {
    return (
      <div className="favorites-page">
        <div className="favorites-loading">Loading favorites...</div>
      </div>
    );
  }

  return (
    <div className="favorites-page">
      <div className="favorites-container">
        <div className="favorites-header-row">
          <div style={{ width: "100px" }}></div>
          <h1 className="favorites-title">Favorites</h1>
          <Link to="/" className="back-link">
            ← Back
          </Link>
        </div>

        <div className="favorites-tabs">
          <button
            className={`tab-button ${activeTab === TABS.RESTAURANT ? "active" : ""}`}
            onClick={() => setActiveTab(TABS.RESTAURANT)}
          >
            Restaurant
          </button>
          <button
            className={`tab-button ${activeTab === TABS.MENU_ITEM ? "active" : ""}`}
            onClick={() => setActiveTab(TABS.MENU_ITEM)}
          >
            Menu Item
          </button>
          <button
            className={`tab-button ${activeTab === TABS.DINER ? "active" : ""}`}
            onClick={() => setActiveTab(TABS.DINER)}
          >
            Diner
          </button>
          <button
            className={`tab-button ${activeTab === TABS.FOH ? "active" : ""}`}
            onClick={() => setActiveTab(TABS.FOH)}
          >
            Front of House
          </button>
          <button
            className={`tab-button ${activeTab === TABS.BOH ? "active" : ""}`}
            onClick={() => setActiveTab(TABS.BOH)}
          >
            Back of House
          </button>
        </div>

        <div className="favorites-content">
          {/* RESTAURANT TAB */}
          {activeTab === TABS.RESTAURANT && (
            <div>
              {Object.keys(restaurantsByLocation).length === 0 ? (
                <div className="favorites-empty">
                  <p>No favorite restaurants yet</p>
                </div>
              ) : (
                Object.entries(restaurantsByLocation).map(([location, restaurants]) => (
                  <div key={location} className="favorites-location-group">
                    <h2 className="location-header">{location}</h2>
                    <div className="favorites-grid">
                      {restaurants.map((restaurant) => (
                        <div key={restaurant.id} className="favorite-card">
                          <Link
                            to={`/restaurant/${restaurant.id}`}
                            className="favorite-card-link"
                          >
                            <div className="favorite-card-header">
                              {restaurant.imageURL ? (
                                <div className="card-image">
                                  <img src={restaurant.imageURL} alt={restaurant.name} />
                                </div>
                              ) : (
                                <div className="card-image-placeholder">
                                  <span>🍽️</span>
                                </div>
                              )}
                            </div>
                            <div className="favorite-card-body">
                              <h3 className="favorite-card-title">{restaurant.name}</h3>
                              {restaurant.cuisine && (
                                <p className="favorite-card-subtitle">
                                  {Array.isArray(restaurant.cuisine)
                                    ? restaurant.cuisine.join(", ")
                                    : restaurant.cuisine}
                                </p>
                              )}
                            </div>
                          </Link>
                          <button
                            className="favorite-heart-btn"
                            onClick={(e) => {
                              e.preventDefault();
                              handleUnfavorite(restaurant.favoriteId, restaurant.id, "restaurant");
                            }}
                            title="Remove from favorites"
                          >
                            <span className="heart">❤️</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* MENU ITEM TAB */}
          {activeTab === TABS.MENU_ITEM && (
            <div>
              {Object.keys(menuItemsByLocation).length === 0 ? (
                <div className="favorites-empty">
                  <p>No favorite menu items yet</p>
                </div>
              ) : (
                Object.entries(menuItemsByLocation).map(([location, items]) => (
                  <div key={location} className="favorites-location-group">
                    <h2 className="location-header">{location}</h2>
                    <div className="favorites-grid">
                      {items.map((item) => (
                        <div key={item.id} className="favorite-card">
                          <div className="favorite-card-header">
                            {item.imageURL || item.picture ? (
                              <div className="card-image">
                                <img
                                  src={item.imageURL || item.picture}
                                  alt={item.name || "Menu Item"}
                                />
                              </div>
                            ) : (
                              <div className="card-image-placeholder">
                                <span>🍴</span>
                              </div>
                            )}
                          </div>
                          <div className="favorite-card-body">
                            <h3 className="favorite-card-title">
                              {item.name || "Menu Item"}
                            </h3>
                            {item.restaurantName && (
                              <p className="favorite-card-subtitle">
                                {item.restaurantName}
                                {item.city && item.state && ` • ${item.city}, ${item.state}`}
                              </p>
                            )}
                          </div>
                          <button
                            className="favorite-heart-btn"
                            onClick={(e) => {
                              e.preventDefault();
                              handleUnfavorite(item.favoriteId, item.id, "menuItem");
                            }}
                            title="Remove from favorites"
                          >
                            <span className="heart">❤️</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* DINER TAB */}
          {activeTab === TABS.DINER && (
            <div>
              {favoriteDiners.length === 0 ? (
                <div className="favorites-empty">
                  <p>No favorite diners yet</p>
                </div>
              ) : (
                <div className="favorites-grid">
                  {favoriteDiners.map((diner) => {
                    const location = getDinerLocation(diner.id, diner.name, diner.city, diner.state);
                    return (
                      <div key={diner.id} className="favorite-card">
                        <Link
                          to={`/staff/${diner.id}`}
                          className="favorite-card-link"
                        >
                          <div className="favorite-card-header">
                            {diner.picture ? (
                              <div className="card-image">
                                <img src={diner.picture} alt={diner.name} />
                              </div>
                            ) : (
                              <div className="card-image-placeholder">
                                <span>👤</span>
                              </div>
                            )}
                          </div>
                          <div className="favorite-card-body">
                            <h3 className="favorite-card-title">{diner.name}</h3>
                            <p className="favorite-card-subtitle">
                              {location.city}, {location.state}
                            </p>
                          </div>
                        </Link>
                        <button
                          className="favorite-heart-btn"
                          onClick={(e) => {
                            e.preventDefault();
                            handleUnfavorite(diner.favoriteId, diner.id, "diner", diner.isFromReviewers);
                          }}
                          title="Remove from favorites"
                        >
                          <span className="heart">❤️</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* FRONT OF HOUSE TAB */}
          {activeTab === TABS.FOH && (
            <div>
              {Object.keys(fohByPosition).length === 0 ? (
                <div className="favorites-empty">
                  <p>No favorite front of house staff yet</p>
                </div>
              ) : (
                Object.entries(fohByPosition).map(([position, staffList]) => (
                  <div key={position} className="favorites-position-group">
                    <h2 className="position-header">{position}</h2>
                    <div className="favorites-grid">
                      {staffList.map((staff) => (
                        <div key={staff.id} className="favorite-card">
                          <Link
                            to={`/staff/${staff.id}`}
                            className="favorite-card-link"
                          >
                            <div className="favorite-card-header">
                              {staff.picture ? (
                                <div className="card-image">
                                  <img src={staff.picture} alt={staff.name} />
                                </div>
                              ) : (
                                <div className="card-image-placeholder">
                                  <span>👤</span>
                                </div>
                              )}
                            </div>
                            <div className="favorite-card-body">
                              <h3 className="favorite-card-title">{staff.name}</h3>
                              {staff.restaurantName && (
                                <p className="favorite-card-subtitle">
                                  {staff.restaurantName}
                                  {staff.city && staff.state && ` • ${staff.city}, ${staff.state}`}
                                </p>
                              )}
                            </div>
                          </Link>
                          <button
                            className="favorite-heart-btn"
                            onClick={(e) => {
                              e.preventDefault();
                              handleUnfavorite(staff.favoriteId, staff.id, "staff");
                            }}
                            title="Remove from favorites"
                          >
                            <span className="heart">❤️</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* BACK OF HOUSE TAB */}
          {activeTab === TABS.BOH && (
            <div>
              {Object.keys(bohByPosition).length === 0 ? (
                <div className="favorites-empty">
                  <p>No favorite back of house staff yet</p>
                </div>
              ) : (
                Object.entries(bohByPosition).map(([position, staffList]) => (
                  <div key={position} className="favorites-position-group">
                    <h2 className="position-header">{position}</h2>
                    <div className="favorites-grid">
                      {staffList.map((staff) => (
                        <div key={staff.id} className="favorite-card">
                          <Link
                            to={`/staff/${staff.id}`}
                            className="favorite-card-link"
                          >
                            <div className="favorite-card-header">
                              {staff.picture ? (
                                <div className="card-image">
                                  <img src={staff.picture} alt={staff.name} />
                                </div>
                              ) : (
                                <div className="card-image-placeholder">
                                  <span>👨‍🍳</span>
                                </div>
                              )}
                            </div>
                            <div className="favorite-card-body">
                              <h3 className="favorite-card-title">{staff.name}</h3>
                              {staff.restaurantName && (
                                <p className="favorite-card-subtitle">
                                  {staff.restaurantName}
                                  {staff.city && staff.state && ` • ${staff.city}, ${staff.state}`}
                                </p>
                              )}
                            </div>
                          </Link>
                          <button
                            className="favorite-heart-btn"
                            onClick={(e) => {
                              e.preventDefault();
                              handleUnfavorite(staff.favoriteId, staff.id, "staff");
                            }}
                            title="Remove from favorites"
                          >
                            <span className="heart">❤️</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
