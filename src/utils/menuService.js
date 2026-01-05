// src/utils/menuService.js

import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../hooks/services/firebase";

const MENU_SECTIONS = [
  "beverages",
  "alcoholic_drinks", 
  "appetizers",
  "entrees",
  "sides",
  "desserts"
];

/**
 * Load all menu items for a restaurant, organized by section
 * @param {string} restaurantId - Restaurant ID
 * @param {string} menuType - Optional menu type filter: "breakfast", "lunch", "dinner", or null for all
 * @returns {Promise<Object>} Menu items organized by section
 */
export async function loadRestaurantMenu(restaurantId, menuType = null) {
  try {
    const menu = {
      beverages: [],
      alcoholic_drinks: [],
      appetizers: [],
      entrees: [],
      sides: [],
      desserts: [],
    };

    // Load all menu items from the menu collection and filter by section
    try {
      const menuRef = collection(db, "restaurants", restaurantId, "menu");
      const snapshot = await getDocs(menuRef);
      
      console.log(`Loading menu collection for restaurant ${restaurantId}: ${snapshot.size} total items found${menuType ? ` (filtering by ${menuType})` : ''}`);
      
      snapshot.forEach((docSnap) => {
        const itemData = docSnap.data();
        const section = itemData.section || "";
        const itemMenuType = itemData.menuType || null;
        
        // Filter by menuType if provided
        // Show items that match the menuType OR have no menuType (all-day items)
        if (menuType && itemMenuType && itemMenuType !== menuType) {
          return; // Skip this item
        }
        
        // Map section to our menu structure
        if (menu.hasOwnProperty(section)) {
          menu[section].push({
            id: docSnap.id,
            section,
            ...itemData,
          });
        } else {
          console.warn(`Unknown section "${section}" for item ${docSnap.id}`);
        }
      });

      // Sort each section by name
      MENU_SECTIONS.forEach((section) => {
        menu[section].sort((a, b) => 
          (a.name || "").localeCompare(b.name || "")
        );
        console.log(`Section "${section}": ${menu[section].length} items`);
      });
    } catch (err) {
      console.error(`Error loading menu collection for restaurant ${restaurantId}:`, err);
      console.error("Full error:", err.message, err.code);
    }

    return menu;
  } catch (error) {
    console.error("Error loading restaurant menu:", error);
    return {
      beverages: [],
      alcoholic_drinks: [],
      appetizers: [],
      entrees: [],
      sides: [],
      desserts: [],
    };
  }
}

/**
 * Get all menu items as a flat array
 * @param {string} restaurantId - Restaurant ID
 * @param {string} menuType - Optional menu type filter: "breakfast", "lunch", "dinner", or null for all
 */
export async function getAllMenuItems(restaurantId, menuType = null) {
  const menu = await loadRestaurantMenu(restaurantId, menuType);
  return Object.values(menu).flat();
}

/**
 * Get employees working at a specific station during a shift
 * @param {string} restaurantId - Restaurant ID
 * @param {string} station - Station name (e.g., "grill", "fry")
 * @param {Date} visitDate - Date of the visit
 * @returns {Promise<Array>} Array of employee objects
 */
export async function getEmployeesAtStation(restaurantId, station, visitDate) {
  try {
    // Load staff
    const staffRef = collection(db, "restaurants", restaurantId, "staff");
    const staffSnap = await getDocs(staffRef);
    
    const stationEmployees = [];
    staffSnap.forEach((docSnap) => {
      const data = docSnap.data();
      // Check if employee works at this station
      if (
        data.role === "Back of House" &&
        (data.station === station || data.stations?.includes(station))
      ) {
        stationEmployees.push({
          id: docSnap.id,
          uid: data.uid || docSnap.id,
          name: data.name,
          station: data.station || station,
        });
      }
    });

    // TODO: Filter by who was actually working during the visit time
    // This would require checking the schedule for that date/time
    
    return stationEmployees;
  } catch (error) {
    console.error("Error getting employees at station:", error);
    return [];
  }
}