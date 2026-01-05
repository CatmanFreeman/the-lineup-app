// src/pages/RestaurantReview/RestaurantReviewPage.jsx

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { loadRestaurantMenu, getAllMenuItems } from "../../utils/menuService";
import { parseReceiptImage, matchReceiptItemsToMenu } from "../../utils/receiptOCRService";
import { createFullRestaurantReview } from "../../utils/reviewService";
import { getStaffDuringVisit, getBohEmployeesForStation, getEmployeesFromSchedule } from "../../utils/visitStaffService";
import { uploadReviewPhotos, validateReviewPhoto } from "../../utils/photoUploadService";
import TipShareModal from "../../components/TipShareModal";
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "../../hooks/services/firebase";
import { createChilisMenuForRestaurant, createBravoKitchenMenuForRestaurant, createTexasRoadhouseMenuForRestaurant, updateMenuItemsWithImages } from "../../utils/mockMenuService";
import "./RestaurantReviewPage.css";

const MENU_SECTIONS = [
  { key: "beverages", label: "Beverages" },
  { key: "alcoholic_drinks", label: "Beer / Wine / Cocktails" },
  { key: "appetizers", label: "Appetizers" },
  { key: "entrees", label: "Entrees" },
  { key: "sides", label: "Side/Extras" },
  { key: "desserts", label: "Desserts" },
];

export default function RestaurantReviewPage() {
  const { restaurantId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const visitId = searchParams.get("visit");

  // State
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Restaurant data
  const [restaurant, setRestaurant] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);

  // Menu data
  const [menu, setMenu] = useState(null);
  const [allMenuItems, setAllMenuItems] = useState([]);

  // Receipt upload
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [parsingReceipt, setParsingReceipt] = useState(false);
  const [receiptItems, setReceiptItems] = useState([]);

  // Visit date and shift (if no receipt uploaded)
  const [visitDate, setVisitDate] = useState("");
  const [visitShift, setVisitShift] = useState(""); // "breakfast", "lunch", "dinner"

  // Server selection (if no receipt uploaded)
  const [selectedServerId, setSelectedServerId] = useState(null);
  const [serverRating, setServerRating] = useState(0);
  const [serverComment, setServerComment] = useState("");
  const [serverPhoto, setServerPhoto] = useState(null);
  const [serverPhotoPreview, setServerPhotoPreview] = useState(null);
  const [availableServers, setAvailableServers] = useState([]); // Servers available for selected date/shift
  const [favoriteStaffIds, setFavoriteStaffIds] = useState(new Set()); // Track favorited staff

  // Selected items for review
  const [selectedItems, setSelectedItems] = useState({}); // { itemId: { rating, comment, photos, quantity, serverRating, serverComment, bohRating, bohComment } }
  
  // Accordion state for menu sections - auto-expand first section if menu loads
  const [expandedSections, setExpandedSections] = useState(new Set());
  // Expanded menu items
  const [expandedItems, setExpandedItems] = useState(new Set());
  
  // Auto-expand first section when menu loads
  useEffect(() => {
    if (menu && expandedSections.size === 0) {
      // Find first section with items
      for (const section of MENU_SECTIONS) {
        const sectionItems = menu[section.key] || [];
        if (sectionItems.length > 0) {
          setExpandedSections(new Set([section.key]));
          break;
        }
      }
    }
  }, [menu]);

  // Helper function to get selected server info
  const getSelectedServer = () => {
    // If receipt was uploaded, use server from receipt
    if (receiptFile && staff.server) {
      return staff.server;
    }
    // If server was selected from date/shift, use that
    if (selectedServerId) {
      const server = availableServers.find(s => (s.id || s.uid) === selectedServerId);
      if (server) return server;
    }
    // Fallback to staff.server if available
    return staff.server || null;
  };

  // Helper function to get front of house staff for group tip (selected server + hostess + bussers only)
  const getFrontOfHouseStaff = () => {
    const selectedServer = getSelectedServer();
    const fohStaff = [];
    
    // Add selected server (only if one was selected)
    if (selectedServer) {
      fohStaff.push(selectedServer);
    }
    
    // Add hostess/host from staff data
    if (staff.hostess && staff.hostess.length > 0) {
      staff.hostess.forEach(host => {
        if (!fohStaff.find(s => (s.id || s.uid) === (host.id || host.uid))) {
          fohStaff.push(host);
        }
      });
    }
    
    // Add bussers (filter from all FOH staff)
    const bussers = staff.all.filter(s => 
      s.role === "Front of House" &&
      (s.subRole?.toLowerCase().includes("busser") ||
       s.subRole?.toLowerCase().includes("bus"))
    );
    bussers.forEach(busser => {
      if (!fohStaff.find(s => (s.id || s.uid) === (busser.id || busser.uid))) {
        fohStaff.push(busser);
      }
    });
    
    return fohStaff;
  };

  // Helper function to get image URL for menu item
  const getItemImageURL = (itemName) => {
    const name = itemName.toLowerCase();
    
    // Beverages
    if (name.includes('coca-cola') || name.includes('coke')) return 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=200&h=200&fit=crop';
    if (name.includes('diet coke')) return 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=200&h=200&fit=crop';
    if (name.includes('sprite')) return 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=200&h=200&fit=crop';
    if (name.includes('dr pepper')) return 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=200&h=200&fit=crop';
    if (name.includes('tea')) return 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=200&h=200&fit=crop';
    if (name.includes('lemonade')) return 'https://images.unsplash.com/photo-1523677011787-c91d1bbe2fdc?w=200&h=200&fit=crop';
    if (name.includes('coffee') || name.includes('espresso')) return 'https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?w=200&h=200&fit=crop';
    if (name.includes('water')) return 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=200&h=200&fit=crop';
    if (name.includes('juice')) return 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=200&h=200&fit=crop';
    if (name.includes('wine')) return name.includes('red') ? 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=200&h=200&fit=crop' : 'https://images.unsplash.com/photo-1506377247727-4b6f2f4a1e4a?w=200&h=200&fit=crop';
    if (name.includes('beer')) return 'https://images.unsplash.com/photo-1535958637004-8967b619ed4b?w=200&h=200&fit=crop';
    if (name.includes('margarita') || name.includes('mojito') || name.includes('cocktail')) return 'https://images.unsplash.com/photo-1536935338788-846bb9981813?w=200&h=200&fit=crop';
    
    // Steaks & Ribs
    if (name.includes('steak') || name.includes('ribeye') || name.includes('sirloin') || name.includes('filet') || name.includes('porterhouse') || name.includes('t-bone')) return 'https://images.unsplash.com/photo-1546833614-9e3b8b0b1f1a?w=200&h=200&fit=crop';
    if (name.includes('ribs')) return 'https://images.unsplash.com/photo-1528607929212-2636ec44253e?w=200&h=200&fit=crop';
    
    // Chicken
    if (name.includes('chicken')) return 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=200&h=200&fit=crop';
    if (name.includes('wings')) return 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=200&h=200&fit=crop';
    
    // Seafood
    if (name.includes('salmon')) return 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=200&h=200&fit=crop';
    if (name.includes('fish')) return 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=200&h=200&fit=crop';
    if (name.includes('shrimp')) return 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=200&h=200&fit=crop';
    if (name.includes('lobster')) return 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=200&h=200&fit=crop';
    
    // Pizza
    if (name.includes('pizza')) return 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=200&h=200&fit=crop';
    
    // Burgers
    if (name.includes('burger')) return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&h=200&fit=crop';
    
    // Pasta
    if (name.includes('pasta') || name.includes('alfredo') || name.includes('carbonara')) return 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=200&h=200&fit=crop';
    
    // Salads
    if (name.includes('salad')) return 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=200&h=200&fit=crop';
    
    // Sides
    if (name.includes('fries')) return 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=200&h=200&fit=crop';
    if (name.includes('potato')) return 'https://images.unsplash.com/photo-1518977822534-7049a61ee0c2?w=200&h=200&fit=crop';
    if (name.includes('rice')) return 'https://images.unsplash.com/photo-1512058564366-18510b2e7af8?w=200&h=200&fit=crop';
    if (name.includes('broccoli') || name.includes('corn') || name.includes('vegetable')) return 'https://images.unsplash.com/photo-1512058564366-18510b2e7af8?w=200&h=200&fit=crop';
    if (name.includes('onion rings')) return 'https://images.unsplash.com/photo-1615367427256-7b3c711f45c1?w=200&h=200&fit=crop';
    
    // Appetizers
    if (name.includes('nachos')) return 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=200&h=200&fit=crop';
    if (name.includes('queso') || name.includes('dip')) return 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=200&h=200&fit=crop';
    if (name.includes('mozzarella sticks')) return 'https://images.unsplash.com/photo-1615367427256-7b3c711f45c1?w=200&h=200&fit=crop';
    if (name.includes('bruschetta')) return 'https://images.unsplash.com/photo-1572441713132-51c75654db73?w=200&h=200&fit=crop';
    if (name.includes('calamari')) return 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=200&h=200&fit=crop';
    
    // Mexican/Tex-Mex
    if (name.includes('tacos') || name.includes('fajitas') || name.includes('enchiladas')) return 'https://images.unsplash.com/photo-1565299585323-38174c0a5c5a?w=200&h=200&fit=crop';
    
    // BBQ
    if (name.includes('brisket') || name.includes('pork') || name.includes('bbq')) return 'https://images.unsplash.com/photo-1544025162-d76694265947?w=200&h=200&fit=crop';
    
    // Desserts
    if (name.includes('cake') || name.includes('cheesecake') || name.includes('brownie')) return 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=200&h=200&fit=crop';
    if (name.includes('pie')) return 'https://images.unsplash.com/photo-1621303837174-89787a7d4729?w=200&h=200&fit=crop';
    if (name.includes('cookie')) return 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=200&h=200&fit=crop';
    if (name.includes('sundae') || name.includes('ice cream')) return 'https://images.unsplash.com/photo-1563805042-3a32c1c5b5e5?w=200&h=200&fit=crop';
    if (name.includes('tiramisu')) return 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=200&h=200&fit=crop';
    
    // Default food image
    return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200&h=200&fit=crop';
  };

  // Overall review
  const [overallRating, setOverallRating] = useState(0);
  const [overallComment, setOverallComment] = useState("");

  // Staff
  const [staff, setStaff] = useState({ server: null, hostess: [], boh: [], all: [] });
  const [serverId, setServerId] = useState(null);

  // TipShare
  const [billTotal, setBillTotal] = useState(0); // Bill total for tip calculation
  const [tipShare, setTipShare] = useState({
    tipOnlyServer: false,
    tipOnlyServerAmount: 0,
    tipFrontOfHouse: false,
    tipFrontOfHouseAmount: 0,
    tipBackOfHouse: false,
    tipBackOfHouseAmount: 0,
    tipBohIndividual: false,
    serverId: null,
    bohStaff: [], // Individual BOH staff tips { id, name, amount, imageURL }
  });
  const [bohStaffList, setBohStaffList] = useState([]); // BOH staff who worked that shift

  // Calculate bill total from receipt or selected menu items
  useEffect(() => {
    let calculatedTotal = 0;

    // First, try to get total from receipt items
    if (receiptItems.length > 0) {
      calculatedTotal = receiptItems.reduce((sum, item) => {
        return sum + (item.price || 0) * (item.quantity || 1);
      }, 0);
    } else if (Object.keys(selectedItems).length > 0) {
      // Calculate from selected menu items
      Object.entries(selectedItems).forEach(([itemId, itemData]) => {
        const menuItem = allMenuItems.find(item => item.id === itemId);
        if (menuItem && menuItem.price) {
          const quantity = itemData.quantity || 1;
          calculatedTotal += menuItem.price * quantity;
        }
      });
    }

    if (calculatedTotal > 0) {
      setBillTotal(calculatedTotal);
    }
  }, [receiptItems, selectedItems, allMenuItems]);

  // Helper function to map shift to menuType
  const getMenuTypeFromShift = (shift) => {
    if (!shift) return null;
    if (shift === "breakfast") return "breakfast";
    if (shift === "lunch") return "lunch";
    if (shift === "dinner") return "dinner";
    return null;
  };

  // Load favorite staff for current user
  useEffect(() => {
    async function loadFavoriteStaff() {
      if (!currentUser) {
        setFavoriteStaffIds(new Set());
        return;
      }

      try {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const favoriteIds = userData.favoriteStaff || [];
          setFavoriteStaffIds(new Set(favoriteIds));
        }
      } catch (error) {
        console.error("Error loading favorite staff:", error);
      }
    }

    loadFavoriteStaff();
  }, [currentUser]);

  // Load restaurant, menu and staff
  useEffect(() => {
    if (!restaurantId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        // Load restaurant data
        const restaurantRef = doc(db, "restaurants", restaurantId);
        const restaurantSnap = await getDoc(restaurantRef);
        let restaurantName = "";
        if (restaurantSnap.exists()) {
          const restaurantData = restaurantSnap.data();
          restaurantName = restaurantData?.name || "";
          setRestaurant({
            id: restaurantSnap.id,
            ...restaurantData,
          });
        }

        // Load menu (initially load all, will be filtered when shift is selected)
        let [menuData, allItems] = await Promise.all([
          loadRestaurantMenu(restaurantId),
          getAllMenuItems(restaurantId),
        ]);

        // Log menu status
        console.log("Menu check - Restaurant:", restaurantName, "Has items:", allItems.length);

        setMenu(menuData);
        setAllMenuItems(allItems);
        
        // Debug: Log menu data to help troubleshoot
        console.log("=== MENU LOADING DEBUG ===");
        console.log("Restaurant ID:", restaurantId);
        console.log("Restaurant Name:", restaurantName);
        console.log("Menu data structure:", menuData);
        console.log("Total menu items:", allItems.length);
        console.log("Menu sections:", Object.keys(menuData));
        MENU_SECTIONS.forEach(section => {
          const items = menuData[section.key] || [];
          console.log(`Section "${section.label}" (${section.key}): ${items.length} items`);
          if (items.length > 0) {
            console.log(`  Sample items:`, items.slice(0, 3).map(i => ({ 
              id: i.id, 
              name: i.name, 
              imageURL: i.imageURL || 'MISSING' 
            })));
          }
        });
        
        // Debug: Check if any items have imageURLs
        const itemsWithImages = allItems.filter(item => item.imageURL);
        const itemsWithoutImages = allItems.filter(item => !item.imageURL);
        console.log(`📸 Items WITH images: ${itemsWithImages.length}`);
        console.log(`❌ Items WITHOUT images: ${itemsWithoutImages.length}`);
        if (itemsWithoutImages.length > 0 && itemsWithoutImages.length <= 5) {
          console.log("Items missing images:", itemsWithoutImages.map(i => i.name));
        }
        
        // Check if menu exists in Firestore directly
        if (allItems.length === 0) {
          console.log("⚠️ NO MENU ITEMS FOUND - Checking Firestore directly...");
          try {
            const testSectionRef = collection(db, "restaurants", restaurantId, "menu", "beverages");
            const testSnap = await getDocs(testSectionRef);
            console.log(`Direct Firestore check - beverages section: ${testSnap.size} items`);
            testSnap.forEach((doc) => {
              console.log(`  Found item: ${doc.id} - ${doc.data().name}`);
            });
          } catch (err) {
            console.error("Error checking Firestore directly:", err);
          }
        }
        console.log("==========================");

        // Load staff (for now, we'll get all staff - can be filtered by visit time later)
        const visitDate = new Date();
        const staffData = await getStaffDuringVisit(restaurantId, visitDate);
        setStaff(staffData);

        // Auto-select server if only one
        if (staffData.server) {
          setServerId(staffData.server.id || staffData.server.uid);
        }

        // Load BOH staff who worked on this date from schedule
        try {
          const employeeIds = await getEmployeesFromSchedule(restaurantId, visitDate);
          if (employeeIds.length > 0) {
            // Get full staff details for BOH employees
            const bohStaff = staffData.boh.filter(emp => 
              employeeIds.includes(emp.id) || employeeIds.includes(emp.uid)
            );
            setBohStaffList(bohStaff);
          } else {
            // If no schedule, use all BOH staff
            setBohStaffList(staffData.boh);
          }
        } catch (error) {
          console.error("Error loading BOH staff from schedule:", error);
          // Fallback to all BOH staff
          setBohStaffList(staffData.boh);
        }
      } catch (err) {
        console.error("Error loading data:", err);
        setError("Failed to load menu. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [restaurantId]);

  // Load menu when shift changes
  useEffect(() => {
    async function loadMenuForShift() {
      if (!restaurantId) return;

      const menuType = getMenuTypeFromShift(visitShift);
      
      try {
        const [menuData, allItems] = await Promise.all([
          loadRestaurantMenu(restaurantId, menuType),
          getAllMenuItems(restaurantId, menuType),
        ]);

        setMenu(menuData);
        setAllMenuItems(allItems);
      } catch (error) {
        console.error("Error loading menu for shift:", error);
      }
    }

    // Only reload menu if shift is selected (if no shift, keep all items)
    if (visitShift) {
      loadMenuForShift();
    }
  }, [restaurantId, visitShift]);

  // Load available servers and staff when date/shift changes
  useEffect(() => {
    async function loadAvailableStaff() {
      if (!restaurantId || !visitDate || !visitShift) {
        setAvailableServers([]);
        return;
      }

      try {
        // Get employees from schedule for the selected date/shift
        const visitDateObj = new Date(visitDate);
        const employeeIds = await getEmployeesFromSchedule(restaurantId, visitDateObj);
        
        // Get all staff and filter for servers
        const staffData = await getStaffDuringVisit(restaurantId, visitDateObj);
        const servers = staffData.all.filter((s) => 
          s.role === "Front of House" &&
          (s.subRole?.toLowerCase().includes("server") ||
           s.subRole?.toLowerCase().includes("waiter") ||
           s.subRole?.toLowerCase().includes("waitress")) &&
          (employeeIds.length === 0 || employeeIds.includes(s.id) || employeeIds.includes(s.uid))
        );
        
        setAvailableServers(servers);
        
        // Update staff state with filtered staff for this date/shift
        const filteredStaff = {
          server: selectedServerId ? servers.find(s => (s.id || s.uid) === selectedServerId) : null,
          hostess: staffData.hostess.filter(h => 
            employeeIds.length === 0 || employeeIds.includes(h.id) || employeeIds.includes(h.uid)
          ),
          boh: staffData.boh.filter(b => 
            employeeIds.length === 0 || employeeIds.includes(b.id) || employeeIds.includes(b.uid)
          ),
          all: staffData.all.filter(a => 
            employeeIds.length === 0 || employeeIds.includes(a.id) || employeeIds.includes(a.uid)
          ),
        };
        setStaff(filteredStaff);
        
        // Update BOH staff list
        setBohStaffList(filteredStaff.boh);
      } catch (error) {
        console.error("Error loading available staff:", error);
        setAvailableServers([]);
      }
    }

    loadAvailableStaff();
  }, [restaurantId, visitDate, visitShift, selectedServerId]);

  // Load favorite status
  useEffect(() => {
    async function loadFavoriteStatus() {
      if (!currentUser || !restaurantId) {
        setIsFavorite(false);
        return;
      }
      try {
        const favRef = doc(db, "users", currentUser.uid, "favorites", restaurantId);
        const favSnap = await getDoc(favRef);
        setIsFavorite(favSnap.exists());
      } catch (err) {
        console.error("Error loading favorite status:", err);
      }
    }
    loadFavoriteStatus();
  }, [currentUser, restaurantId]);

  // Handle favorite toggle
  const handleFavorite = async () => {
    if (!currentUser) {
      alert("Please sign in to add favorites");
      return;
    }

    try {
      const favRef = doc(db, "users", currentUser.uid, "favorites", restaurantId);
      if (isFavorite) {
        await deleteDoc(favRef);
        setIsFavorite(false);
      } else {
        await setDoc(
          favRef,
          { restaurantId, createdAt: serverTimestamp() },
          { merge: true }
        );
        setIsFavorite(true);
      }
    } catch (err) {
      console.error("Error toggling favorite:", err);
    }
  };

  // Handle receipt upload
  const handleReceiptUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setReceiptFile(file);
    setParsingReceipt(true);
    setError("");

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setReceiptPreview(e.target.result);
    };
    reader.readAsDataURL(file);

    try {
      // Parse receipt
      const result = await parseReceiptImage(file);
      
      if (!result.success) {
        setError("Failed to parse receipt. You can still select items manually.");
        setParsingReceipt(false);
        return;
      }

      // Match items to menu
      const matched = matchReceiptItemsToMenu(result.items, allMenuItems);
      setReceiptItems(matched);

      // Auto-select matched items and expand them
      const newSelected = { ...selectedItems };
      const newExpandedItems = new Set(expandedItems);
      const newExpandedSections = new Set(expandedSections);
      
      matched.forEach((item) => {
        if (item.matched && item.id) {
          if (!newSelected[item.id]) {
            newSelected[item.id] = {
              rating: 0,
              comment: "",
              photos: [],
              photoFiles: [],
              quantity: 1,
              serverRating: 0,
              serverComment: "",
              bohRating: 0,
              bohComment: "",
            };
          }
          // Expand the item
          newExpandedItems.add(item.id);
          // Expand the section containing this item
          const itemSection = MENU_SECTIONS.find((s) => {
            const sectionItems = menu?.[s.key] || [];
            return sectionItems.some((i) => i.id === item.id);
          });
          if (itemSection) {
            newExpandedSections.add(itemSection.key);
          }
        }
      });
      setSelectedItems(newSelected);
      setExpandedItems(newExpandedItems);
      setExpandedSections(newExpandedSections);
    } catch (err) {
      console.error("Error parsing receipt:", err);
      setError("Failed to parse receipt. You can still select items manually.");
    } finally {
      setParsingReceipt(false);
    }
  };

  // Toggle item selection (for receipt matching - takes item object)
  const toggleItemSelectionByItem = (item) => {
    const newSelected = { ...selectedItems };
    if (newSelected[item.id]) {
      delete newSelected[item.id];
    } else {
      newSelected[item.id] = {
        rating: 0,
        comment: "",
        photos: [],
        photoFiles: [],
        quantity: 1,
        serverRating: 0,
        serverComment: "",
        bohRating: 0,
        bohComment: "",
        station: item.station,
        bohEmployees: getBohEmployeesForStation(staff.boh, item.station),
      };
    }
    setSelectedItems(newSelected);
  };

  // Update item rating
  const updateItemRating = (itemId, rating) => {
    const newSelected = { ...selectedItems };
    if (newSelected[itemId]) {
      newSelected[itemId].rating = rating;
      setSelectedItems(newSelected);
    }
  };

  // Update item comment
  const updateItemComment = (itemId, comment) => {
    const newSelected = { ...selectedItems };
    if (newSelected[itemId]) {
      newSelected[itemId].comment = comment.substring(0, 200);
      setSelectedItems(newSelected);
    }
  };

  // Update item quantity
  const updateItemQuantity = (itemId, quantity) => {
    const newSelected = { ...selectedItems };
    if (newSelected[itemId]) {
      newSelected[itemId].quantity = parseInt(quantity) || 1;
      setSelectedItems(newSelected);
    }
  };

  // Toggle section accordion
  const toggleSection = (sectionKey) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionKey)) {
        newSet.delete(sectionKey);
      } else {
        newSet.add(sectionKey);
      }
      return newSet;
    });
  };

  // Toggle item selection (checkbox)
  const toggleItemSelection = (itemId) => {
    setSelectedItems((prev) => {
      const newSelected = { ...prev };
      if (newSelected[itemId]) {
        // Unselect: remove from selected items and collapse
        delete newSelected[itemId];
        setExpandedItems((prevExpanded) => {
          const newExpanded = new Set(prevExpanded);
          newExpanded.delete(itemId);
          return newExpanded;
        });
      } else {
        // Select: add to selected items and expand
        newSelected[itemId] = {
          rating: 0,
          comment: "",
          photoFiles: [],
          quantity: 1, // Default quantity
        };
        setExpandedItems((prevExpanded) => {
          const newExpanded = new Set(prevExpanded);
          newExpanded.add(itemId);
          return newExpanded;
        });
      }
      return newSelected;
    });
  };

  // Toggle item expansion (for clicking the item itself, not the checkbox)
  const toggleItemExpansion = (itemId) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
        // Auto-select item when expanded
        if (!selectedItems[itemId]) {
          setSelectedItems((prevSelected) => {
            const newSelected = { ...prevSelected };
            newSelected[itemId] = {
              rating: 0,
              comment: "",
              photoFiles: [],
              quantity: 1, // Default quantity
            };
            return newSelected;
          });
        }
      }
      return newSet;
    });
  };

  // Handle photo upload for item
  const handleItemPhotoUpload = async (itemId, files) => {
    if (!files || files.length === 0) return;

    const validFiles = Array.from(files).slice(0, 2); // Max 2 photos

    // Validate files
    for (const file of validFiles) {
      const validation = validateReviewPhoto(file);
      if (!validation.valid) {
        setError(validation.error);
        return;
      }
    }

    try {
      // Upload photos (we'll do this after review is created)
      // For now, store file objects
      const newSelected = { ...selectedItems };
      if (newSelected[itemId]) {
        newSelected[itemId].photoFiles = [
          ...(newSelected[itemId].photoFiles || []),
          ...validFiles,
        ].slice(0, 2);
        setSelectedItems(newSelected);
      }
    } catch (err) {
      console.error("Error handling photo upload:", err);
      setError("Failed to upload photos. Please try again.");
    }
  };

  // Remove photo
  const removeItemPhoto = (itemId, index) => {
    const newSelected = { ...selectedItems };
    if (newSelected[itemId] && newSelected[itemId].photoFiles) {
      newSelected[itemId].photoFiles.splice(index, 1);
      setSelectedItems(newSelected);
    }
  };

  // Submit review
  const handleSubmit = async () => {
    if (!currentUser) {
      setError("Please log in to submit a review");
      return;
    }

    const selectedItemIds = Object.keys(selectedItems);
    if (selectedItemIds.length === 0) {
      setError("Please select at least one item to review");
      return;
    }

    if (overallRating === 0) {
      setError("Please provide an overall rating");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      // Create review ID
      const reviewId = `review_${Date.now()}_${currentUser.uid}`;

      // Upload photos for all items
      const itemsWithPhotos = await Promise.all(
        selectedItemIds.map(async (itemId) => {
          const itemData = selectedItems[itemId];
          const menuItem = allMenuItems.find((m) => m.id === itemId);
          
          let photos = [];
          if (itemData.photoFiles && itemData.photoFiles.length > 0) {
            photos = await uploadReviewPhotos(
              itemData.photoFiles,
              restaurantId,
              reviewId,
              itemId
            );
          }

          return {
            id: itemId,
            name: menuItem?.name || "Menu Item",
            rating: itemData.rating,
            comment: itemData.comment,
            photos,
            serverRating: itemData.serverRating || overallRating,
            serverComment: itemData.serverComment,
            bohRating: itemData.bohRating || itemData.rating,
            bohComment: itemData.bohComment,
            station: itemData.station,
            bohEmployees: itemData.bohEmployees || [],
          };
        })
      );

      // Prepare tip share data
      const tipShareData = {
        server: tipShare.server > 0 ? tipShare.server : null,
        hostess: tipShare.hostess > 0 ? tipShare.hostess : null,
        hostessId: tipShare.hostessId,
        boh: tipShare.boh > 0 ? tipShare.boh : null,
        bohEmployees: tipShare.bohEmployees,
        employees: tipShare.employees.filter((e) => e.amount > 0),
      };

      // Submit review
      await createFullRestaurantReview({
        dinerId: currentUser.uid,
        dinerName: currentUser.displayName || currentUser.email,
        restaurantId,
        items: itemsWithPhotos,
        overallRating,
        overallComment: overallComment.trim().substring(0, 500),
        serverId: serverId || staff.server?.id,
        serverName: staff.server?.name || "Server",
        tipShare: tipShareData,
        visitId,
      });

      setSuccess(true);
      
      // Redirect after 3 seconds
      setTimeout(() => {
        navigate(`/reviews`);
      }, 3000);
    } catch (err) {
      console.error("Error submitting review:", err);
      setError(err.message || "Failed to submit review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Star rating component
  const StarRating = ({ rating, onRatingClick, disabled = false }) => (
    <div className="star-rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`star ${rating >= star ? "star-filled" : ""}`}
          onClick={() => !disabled && onRatingClick(star)}
          disabled={disabled}
        >
          ★
        </button>
      ))}
      {rating > 0 && <span className="rating-value">{rating}/5</span>}
    </div>
  );

  if (loading) {
    return (
      <div className="review-page">
        <div className="review-loading">Loading menu...</div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="review-page">
        <div className="review-success-screen">
          <div className="success-icon">✓</div>
          <h2>Thank You!</h2>
          <p>Your review has been submitted successfully.</p>
          <p>Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="review-page">
      <div className="review-header">
        <h1 className="review-header-title">Review Your Experience</h1>
        <button className="close-btn" onClick={() => navigate(-1)}>×</button>
      </div>

      {error && <div className="review-error">{error}</div>}

      {/* Restaurant Card (same as Post Review page) */}
      {restaurant && (
        <div className="review-restaurant-card-wrapper">
          <div className="post-review-restaurant-card" style={{ position: "relative" }}>
            {/* FAVORITE HEART - Top Right */}
            <button
              onClick={handleFavorite}
              className="review-restaurant-favorite"
              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
              style={{
                position: "absolute",
                top: "12px",
                right: "12px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: "20px",
                color: isFavorite ? "#ff4d4d" : "#ffffff",
                opacity: isFavorite ? 1 : 0.7,
                zIndex: 10,
                padding: "4px",
                transition: "all 0.2s"
              }}
            >
              {isFavorite ? "♥" : "♡"}
            </button>
            {/* HEADER */}
            <div className="post-review-card-header">
              {restaurant.imageURL && (
                <img
                  src={restaurant.imageURL}
                  alt={restaurant.name}
                  className="post-review-logo"
                />
              )}
              <div className="post-review-title-block">
                <div className="post-review-title-link">{restaurant.name}</div>
                {(() => {
                  const cuisineText = Array.isArray(restaurant.cuisine)
                    ? restaurant.cuisine.join(" • ")
                    : restaurant.cuisine || "";
                  return cuisineText && (
                    <div className="post-review-cuisine">{cuisineText}</div>
                  );
                })()}
                <div
                  className={`post-review-open-status ${
                    restaurant.isOpen ? "open" : "closed"
                  }`}
                >
                  {restaurant.isOpen ? "Open Now" : "Closed"}
                </div>
              </div>
            </div>

            {/* RATINGS ROW */}
            <div className="post-review-ratings">
              <div className="post-review-rating-row">
                <span className="rating-label">Live:</span>
                <span className="rating-star">★</span>
                <span className="rating-value">
                  {typeof restaurant.liveRating === "number"
                    ? restaurant.liveRating.toFixed(1)
                    : "-"}
                </span>
              </div>
              <div className="post-review-rating-row">
                <span className="rating-label">Avg:</span>
                <span className="rating-star">★</span>
                <span className="rating-value">
                  {typeof restaurant.avgRating === "number"
                    ? restaurant.avgRating.toFixed(1)
                    : "-"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Upload Section */}
      <div className="receipt-section">
        <h2>Upload Receipt (Optional)</h2>
        <p className="section-description">
          Upload your receipt and we'll automatically select the items you ordered.
        </p>
        <div className="receipt-upload-area">
          <input
            type="file"
            id="receipt-upload"
            accept="image/*"
            onChange={handleReceiptUpload}
            disabled={parsingReceipt}
            className="receipt-input"
          />
          <label htmlFor="receipt-upload" className="receipt-upload-label">
            {parsingReceipt ? "Parsing receipt..." : receiptFile ? "Change Receipt" : "Upload Receipt"}
          </label>
          {receiptPreview && (
            <div className="receipt-preview">
              <img src={receiptPreview} alt="Receipt preview" />
            </div>
          )}
        </div>
      </div>

      {/* Date and Shift Selection (if no receipt uploaded) */}
      {!receiptFile && (
        <div className="visit-info-section">
          <div className="visit-info-inputs">
            <div className="form-group">
              <label htmlFor="visit-date">Date of Visit</label>
              <input
                type="date"
                id="visit-date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="visit-date-input"
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="form-group">
              <label htmlFor="visit-shift">Shift You're Reviewing</label>
              <select
                id="visit-shift"
                value={visitShift}
                onChange={(e) => setVisitShift(e.target.value)}
                className="visit-shift-select"
              >
                <option value="">Select shift</option>
                <option value="breakfast">Breakfast / Brunch</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Menu Selections Section */}
      <div className="menu-selections-section">
        <h2>Menu Selections</h2>
        <p className="section-description">
          Select items from the menu to rate and review your experience.
        </p>

        {!menu ? (
          <div className="loading-menu">Loading menu...</div>
        ) : (() => {
          // Always show accordion, even if menu is empty
          const hasAnyItems = MENU_SECTIONS.some(section => {
            const items = menu[section.key] || [];
            return items.length > 0;
          });

          return (
            <div className="menu-accordion">
            {!hasAnyItems && (
              <div className="empty-menu-message" style={{ marginBottom: "20px", padding: "20px", background: "rgba(77, 163, 255, 0.1)", borderRadius: "8px", border: "1px solid #4da3ff" }}>
                <p style={{ marginBottom: "10px" }}>No menu items found. The menu may need to be recreated with the correct structure.</p>
                <button
                  onClick={async () => {
                    console.log("Recreating menu for:", restaurantId, restaurant?.name);
                    const restaurantNameLower = (restaurant?.name || "").toLowerCase();
                    let success = false;
                    
                    if (restaurantNameLower.includes("chili")) {
                      success = await createChilisMenuForRestaurant(restaurantId);
                    } else if (restaurantNameLower.includes("bravo")) {
                      success = await createBravoKitchenMenuForRestaurant(restaurantId);
                    } else if (restaurantNameLower.includes("texas") && restaurantNameLower.includes("roadhouse")) {
                      success = await createTexasRoadhouseMenuForRestaurant(restaurantId);
                    }
                    
                    if (success) {
                      // Reload the menu
                      const [newMenuData, newAllItems] = await Promise.all([
                        loadRestaurantMenu(restaurantId),
                        getAllMenuItems(restaurantId),
                      ]);
                      setMenu(newMenuData);
                      setAllMenuItems(newAllItems);
                      console.log("✅ Menu recreated and reloaded! Items:", newAllItems.length);
                    } else {
                      alert("Failed to create menu. Check console for errors.");
                    }
                  }}
                  style={{
                    padding: "12px 24px",
                    backgroundColor: "#4da3ff",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "16px",
                    fontWeight: "600"
                  }}
                >
                  Recreate Menu
                </button>
                <button
                  onClick={async () => {
                    console.log("Updating existing menu items with images...");
                    const success = await updateMenuItemsWithImages(restaurantId);
                    if (success) {
                      // Reload the menu
                      const [newMenuData, newAllItems] = await Promise.all([
                        loadRestaurantMenu(restaurantId),
                        getAllMenuItems(restaurantId),
                      ]);
                      setMenu(newMenuData);
                      setAllMenuItems(newAllItems);
                      console.log("✅ Menu reloaded with images! Total items:", newAllItems.length);
                    } else {
                      setError("Failed to update menu items with images. Check console for details.");
                    }
                  }}
                  style={{
                    padding: "12px 24px",
                    backgroundColor: "#4da3ff",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "16px",
                    fontWeight: "600",
                    marginLeft: "10px"
                  }}
                >
                  Add Images to Existing Menu
                </button>
              </div>
            )}
        {MENU_SECTIONS.map((section) => {
          const sectionItems = menu?.[section.key] || [];
              // Always show all sections, even if empty
              const isSectionExpanded = expandedSections.has(section.key);

          return (
                <div key={section.key} className="accordion-section">
                  <button
                    className="accordion-header"
                    onClick={() => toggleSection(section.key)}
                    type="button"
                  >
                    <span className="accordion-title">
                      {section.label}
                      {sectionItems.length > 0 && (
                        <span className="item-count"> ({sectionItems.length})</span>
                      )}
                    </span>
                    <span className="accordion-icon">{isSectionExpanded ? "−" : "+"}</span>
                  </button>

                {isSectionExpanded && (
                  <div className="accordion-content">
                    {sectionItems.length === 0 ? (
                      <div className="empty-section-message">
                        <p>No items in this section.</p>
                      </div>
                    ) : (
                      <div className="menu-items-list">
                {sectionItems.map((item) => {
                        const isItemExpanded = expandedItems.has(item.id);
                  const isSelected = !!selectedItems[item.id];
                  const itemData = selectedItems[item.id] || {};

                  return (
                          <div key={item.id} className="menu-item-list-item">
                            <div className="menu-item-list-header-wrapper">
                              <button
                                className={`menu-item-list-header ${isItemExpanded ? "expanded" : ""}`}
                                onClick={() => toggleItemExpansion(item.id)}
                                type="button"
                              >
                                <div className="menu-item-preview">
                                  <img 
                                    src={getItemImageURL(item.name)} 
                                    alt={item.name}
                                    className="menu-item-image"
                                    onError={(e) => {
                                      // Fallback to colored placeholder if image fails
                                      e.target.style.display = 'none';
                                      const placeholder = e.target.nextElementSibling;
                                      if (placeholder) {
                                        placeholder.style.display = 'flex';
                                      }
                                    }}
                                  />
                                  <div 
                                    className="menu-item-image-placeholder"
                                    style={{
                                      backgroundColor: '#4da3ff',
                                      color: '#ffffff',
                                      display: 'none',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '11px',
                                      fontWeight: 'bold',
                                      textAlign: 'center',
                                      padding: '8px 4px',
                                      minHeight: '60px',
                                      minWidth: '60px',
                                      borderRadius: '4px',
                                      wordBreak: 'break-word'
                                    }}
                                  >
                                    {item.name.substring(0, 8)}
                                  </div>
                                  <span className="item-list-name">{item.name}</span>
                                </div>
                              </button>
                              <div className="item-checkbox-wrapper">
                          <input
                            type="checkbox"
                            checked={isSelected}
                                  onChange={() => toggleItemSelection(item.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="item-checkbox-input"
                          />
                              </div>
                      </div>

                            {isItemExpanded && (
                        <div className="item-review-form">
                                {/* Item Rating and Quantity */}
                          <div className="rating-group">
                            <label>Rate this item</label>
                                  <div className="rating-quantity-row">
                            <StarRating
                              rating={itemData.rating}
                              onRatingClick={(rating) => updateItemRating(item.id, rating)}
                            />
                                    <div className="quantity-selector">
                                      <label htmlFor={`quantity-${item.id}`}>Quantity:</label>
                                      <select
                                        id={`quantity-${item.id}`}
                                        value={itemData.quantity || 1}
                                        onChange={(e) => updateItemQuantity(item.id, e.target.value)}
                                        className="quantity-dropdown"
                                      >
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                                          <option key={num} value={num}>
                                            {num}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                          </div>

                          {/* Item Comment */}
                          <div className="comment-group">
                            <label>Comment (Optional, max 200 characters)</label>
                            <textarea
                              value={itemData.comment || ""}
                              onChange={(e) => updateItemComment(item.id, e.target.value)}
                              placeholder="How was the taste, presentation, temperature?"
                              maxLength={200}
                              rows={3}
                            />
                            <div className="char-count">{itemData.comment?.length || 0}/200</div>
                          </div>

                          {/* Photo Upload */}
                          <div className="photo-group">
                                  <label>Photos (Optional, up to 2)</label>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(e) => handleItemPhotoUpload(item.id, e.target.files)}
                                    disabled={(itemData.photoFiles?.length || 0) >= 2}
                                    className="photo-upload-input"
                            />
                            {itemData.photoFiles && itemData.photoFiles.length > 0 && (
                              <div className="photo-preview-list">
                                {itemData.photoFiles.map((file, idx) => (
                                  <div key={idx} className="photo-preview">
                                    <img
                                      src={URL.createObjectURL(file)}
                                      alt={`Preview ${idx + 1}`}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => removeItemPhoto(item.id, idx)}
                                      className="remove-photo"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
                    )}
                  </div>
                )}
            </div>
          );
        })}
          </div>
          );
        })()}
      </div>

      {/* Server Selection Section (if no receipt uploaded) */}
      {!receiptFile && visitDate && visitShift && (
        <div className="server-selection-section">
          <div className="form-group">
            <label htmlFor="server-select">Your Server</label>
            <select
              id="server-select"
              value={selectedServerId || ""}
              onChange={(e) => setSelectedServerId(e.target.value || null)}
              className="server-select-dropdown"
            >
              <option value="">Choose your server</option>
              {availableServers.map((server) => (
                <option key={server.id || server.uid} value={server.id || server.uid}>
                  {server.name}
                </option>
              ))}
            </select>
          </div>
          {selectedServerId && (() => {
            const selectedServer = availableServers.find(s => (s.id || s.uid) === selectedServerId);
            if (!selectedServer) return null;
            
            return (
              <div className="server-rating-section">
                <div className="server-selected-card">
                  <div className="server-selection-photo">
                    {selectedServer.imageURL ? (
                      <img src={selectedServer.imageURL} alt={selectedServer.name} />
                    ) : (
                      <div className="server-selection-photo-placeholder">
                        {selectedServer.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="server-selection-info">
                    <div className="server-selection-name-row">
                      <Link
                        to={`/staff/${restaurantId}/${selectedServer.id || selectedServer.uid}`}
                        className="server-selection-name-link"
                      >
                        {selectedServer.name}
                      </Link>
                      <button
                        type="button"
                        className="server-favorite-btn"
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          
                          if (!currentUser) {
                            alert("Please sign in to favorite staff members");
                            return;
                          }

                          const staffId = selectedServer.id || selectedServer.uid;
                          const isFavorited = favoriteStaffIds.has(staffId);
                          
                          try {
                            const userRef = doc(db, "users", currentUser.uid);
                            const userSnap = await getDoc(userRef);
                            const userData = userSnap.exists() ? userSnap.data() : {};
                            const favoriteIds = userData.favoriteStaff || [];

                            let updatedFavorites;
                            if (isFavorited) {
                              updatedFavorites = favoriteIds.filter(id => id !== staffId);
                            } else {
                              updatedFavorites = [...favoriteIds, staffId];
                            }

                            await setDoc(
                              userRef,
                              { favoriteStaff: updatedFavorites },
                              { merge: true }
                            );

                            setFavoriteStaffIds(new Set(updatedFavorites));
                          } catch (error) {
                            console.error("Error toggling favorite staff:", error);
                            alert("Failed to update favorite. Please try again.");
                          }
                        }}
                        title={favoriteStaffIds.has(selectedServer.id || selectedServer.uid) ? "Remove from favorites" : "Add to favorites"}
                      >
                        <span className={favoriteStaffIds.has(selectedServer.id || selectedServer.uid) ? "heart heart-on" : "heart"}>♥</span>
                      </button>
                    </div>
                    {selectedServer.subRole && (
                      <div className="server-selection-role">{selectedServer.subRole}</div>
                    )}
                  </div>
                </div>
                <div className="rating-group">
                  <label>Rate Your Server</label>
                  <StarRating
                    rating={serverRating}
                    onRatingClick={setServerRating}
                  />
                </div>
                <div className="comment-group">
                  <label>Server Comment (Optional, max 200 characters)</label>
                  <textarea
                    value={serverComment}
                    onChange={(e) => setServerComment(e.target.value)}
                    placeholder="How was the service?"
                    maxLength={200}
                    rows={3}
                  />
                  <div className="char-count">{serverComment.length}/200</div>
                </div>
                <div className="photo-group">
                  <label>Photo with Server (Optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setServerPhoto(file);
                        const reader = new FileReader();
                        reader.onload = (e) => setServerPhotoPreview(e.target.result);
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="photo-upload-input"
                  />
                  {serverPhotoPreview && (
                    <div className="photo-preview-list">
                      <div className="photo-preview">
                        <img src={serverPhotoPreview} alt="Server photo" />
                        <button
                          type="button"
                          className="remove-photo"
                          onClick={() => {
                            setServerPhoto(null);
                            setServerPhotoPreview(null);
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Overall Review Section */}
      <div className="overall-section">
        <h2>Overall Experience</h2>
        <div className="rating-group">
          <label>Overall Rating</label>
          <StarRating
            rating={overallRating}
            onRatingClick={setOverallRating}
          />
        </div>
        <div className="comment-group">
          <label>Overall Review (Optional, max 500 characters)</label>
          <textarea
            value={overallComment}
            onChange={(e) => setOverallComment(e.target.value)}
            placeholder="Share your overall experience..."
            maxLength={500}
            rows={5}
          />
          <div className="char-count">{overallComment.length}/500</div>
        </div>
      </div>

      {/* TipShare Section */}
      <div className="tipshare-section">
        <div className="tipshare-logo">
          Tip<span className="tipshare-dollar">$</span>hare
        </div>
        <p className="tipshare-description">
          Show your appreciation by tipping the staff who made your experience great.
        </p>

        <div className="tipshare-options">
          {/* Tip Only Server */}
          <div className="tipshare-option">
            <label className="tipshare-checkbox-label">
              <input
                type="checkbox"
                checked={tipShare.tipOnlyServer}
                onChange={(e) => {
                  const checked = e.target.checked;
                  const suggestedAmount = billTotal > 0 ? Math.round(billTotal * 0.2) : 0;
                  setTipShare({
                    ...tipShare,
                    tipOnlyServer: checked,
                    tipOnlyServerAmount: checked ? suggestedAmount : 0,
                    tipFrontOfHouse: checked ? false : tipShare.tipFrontOfHouse,
                    tipBackOfHouse: checked ? false : tipShare.tipBackOfHouse,
                    tipBohIndividual: checked ? false : tipShare.tipBohIndividual,
                    serverId: checked ? (selectedServerId || (staff.server ? (staff.server.id || staff.server.uid) : null)) : null,
                  });
                }}
                className="tipshare-checkbox"
              />
              <span>Tip only your server</span>
            </label>
            {tipShare.tipOnlyServer && (() => {
              const selectedServer = getSelectedServer();
              if (!selectedServer) return null;
              
              return (
                <div className="tipshare-staff-display">
                  <div className="tipshare-staff-card">
                    <div className="tipshare-staff-photo">
                      {selectedServer.imageURL ? (
                        <img src={selectedServer.imageURL} alt={selectedServer.name} />
                      ) : (
                        <div className="tipshare-staff-photo-placeholder">
                          {selectedServer.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="tipshare-staff-info">
                      <div className="tipshare-staff-name-row">
                        <span className="tipshare-staff-name">{selectedServer.name}</span>
                        <button
                          type="button"
                          className="tipshare-favorite-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            // TODO: Implement favorite toggle
                          }}
                          title="Add to favorites"
                        >
                          <span className="heart">♥</span>
                        </button>
                      </div>
                      <div className="tipshare-staff-position">
                        {selectedServer.subRole || "Server"}
                      </div>
                    </div>
                  </div>
                  <div className="tipshare-amount-group-horizontal">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={tipShare.tipOnlyServerAmount || ""}
                      onChange={(e) =>
                        setTipShare({ ...tipShare, tipOnlyServerAmount: Math.round(parseFloat(e.target.value) || 0) })
                      }
                      className="tipshare-amount-input"
                      placeholder="0"
                    />
                    {billTotal > 0 && (
                      <div className="tipshare-percentage-buttons-vertical">
                        <button
                          type="button"
                          className="tipshare-percentage-btn"
                          onClick={() => {
                            const amount = Math.round(billTotal * 0.15);
                            setTipShare({ ...tipShare, tipOnlyServerAmount: amount });
                          }}
                        >
                          15%
                        </button>
                        <button
                          type="button"
                          className="tipshare-percentage-btn"
                          onClick={() => {
                            const amount = Math.round(billTotal * 0.18);
                            setTipShare({ ...tipShare, tipOnlyServerAmount: amount });
                          }}
                        >
                          18%
                        </button>
                        <button
                          type="button"
                          className="tipshare-percentage-btn"
                          onClick={() => {
                            const amount = Math.round(billTotal * 0.2);
                            setTipShare({ ...tipShare, tipOnlyServerAmount: amount });
                          }}
                        >
                          20%
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Tip Front of House Staff as a Group */}
          <div className="tipshare-option">
            <label className="tipshare-checkbox-label">
              <input
                type="checkbox"
                checked={tipShare.tipFrontOfHouse}
                onChange={(e) => {
                  const checked = e.target.checked;
                  const suggestedAmount = billTotal > 0 ? Math.round(billTotal * 0.2) : 0;
                  setTipShare({
                    ...tipShare,
                    tipFrontOfHouse: checked,
                    tipFrontOfHouseAmount: checked ? suggestedAmount : 0,
                    tipOnlyServer: checked ? false : tipShare.tipOnlyServer,
                  });
                }}
                className="tipshare-checkbox"
              />
              <span>Tip front house staff as a group</span>
            </label>
            {tipShare.tipFrontOfHouse && (() => {
              const fohStaff = getFrontOfHouseStaff();
              
              return (
                <div className="tipshare-staff-display">
                  <div className="tipshare-staff-list">
                    {fohStaff.map((employee) => (
                      <div key={employee.id || employee.uid} className="tipshare-staff-card">
                        <div className="tipshare-staff-photo">
                          {employee.imageURL ? (
                            <img src={employee.imageURL} alt={employee.name} />
                          ) : (
                            <div className="tipshare-staff-photo-placeholder">
                              {employee.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="tipshare-staff-info">
                          <div className="tipshare-staff-name-row">
                            <span className="tipshare-staff-name">{employee.name}</span>
                            <button
                              type="button"
                              className="tipshare-favorite-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                // TODO: Implement favorite toggle
                              }}
                              title="Add to favorites"
                            >
                              <span className="heart">♥</span>
                            </button>
                          </div>
                          <div className="tipshare-staff-position">
                            {employee.subRole || "Staff"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="tipshare-amount-group-horizontal">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={tipShare.tipFrontOfHouseAmount || ""}
                      onChange={(e) =>
                        setTipShare({ ...tipShare, tipFrontOfHouseAmount: Math.round(parseFloat(e.target.value) || 0) })
                      }
                      className="tipshare-amount-input"
                      placeholder="0"
                    />
                    {billTotal > 0 && (
                      <div className="tipshare-percentage-buttons-vertical">
                        <button
                          type="button"
                          className="tipshare-percentage-btn"
                          onClick={() => {
                            const amount = Math.round(billTotal * 0.15);
                            setTipShare({ ...tipShare, tipFrontOfHouseAmount: amount });
                          }}
                        >
                          15%
                        </button>
                        <button
                          type="button"
                          className="tipshare-percentage-btn"
                          onClick={() => {
                            const amount = Math.round(billTotal * 0.18);
                            setTipShare({ ...tipShare, tipFrontOfHouseAmount: amount });
                          }}
                        >
                          18%
                        </button>
                        <button
                          type="button"
                          className="tipshare-percentage-btn"
                          onClick={() => {
                            const amount = Math.round(billTotal * 0.2);
                            setTipShare({ ...tipShare, tipFrontOfHouseAmount: amount });
                          }}
                        >
                          20%
                        </button>
                      </div>
                    )}
                    <div className="tipshare-breakdown">
                      Server: 70%, Hostess: 15%, Busser: 15%
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Tip Back of House */}
          <div className="tipshare-option">
            <label className="tipshare-checkbox-label">
              <input
                type="checkbox"
                checked={tipShare.tipBackOfHouse}
                onChange={(e) => {
                  const checked = e.target.checked;
                  const suggestedAmount = billTotal > 0 ? Math.round(billTotal * 0.2) : 0;
                  setTipShare({
                    ...tipShare,
                    tipBackOfHouse: checked,
                    tipBackOfHouseAmount: checked ? suggestedAmount : 0,
                    tipOnlyServer: checked ? false : tipShare.tipOnlyServer,
                    tipBohIndividual: checked ? false : tipShare.tipBohIndividual,
                  });
                }}
                className="tipshare-checkbox"
              />
              <span>Tip Back of House staff</span>
            </label>
            {tipShare.tipBackOfHouse && (
              <div className="tipshare-amount-group">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={tipShare.tipBackOfHouseAmount || ""}
                  onChange={(e) =>
                    setTipShare({ ...tipShare, tipBackOfHouseAmount: Math.round(parseFloat(e.target.value) || 0) })
                  }
                  className="tipshare-amount-input"
                  placeholder="0"
                />
                {billTotal > 0 && (
                  <div className="tipshare-percentage-buttons-vertical">
                    <button
                      type="button"
                      className="tipshare-percentage-btn"
                      onClick={() => {
                        const amount = Math.round(billTotal * 0.15);
                        setTipShare({ ...tipShare, tipBackOfHouseAmount: amount });
                      }}
                    >
                      15%
                    </button>
                    <button
                      type="button"
                      className="tipshare-percentage-btn"
                      onClick={() => {
                        const amount = Math.round(billTotal * 0.18);
                        setTipShare({ ...tipShare, tipBackOfHouseAmount: amount });
                      }}
                    >
                      18%
                    </button>
                    <button
                      type="button"
                      className="tipshare-percentage-btn"
                      onClick={() => {
                        const amount = Math.round(billTotal * 0.2);
                        setTipShare({ ...tipShare, tipBackOfHouseAmount: amount });
                      }}
                    >
                      20%
                    </button>
                  </div>
                )}
                <div className="tipshare-boh-options">
                  <label className="tipshare-checkbox-label">
                    <input
                      type="checkbox"
                      checked={tipShare.tipBohIndividual}
                      onChange={(e) =>
                        setTipShare({ ...tipShare, tipBohIndividual: e.target.checked })
                      }
                      className="tipshare-checkbox"
                    />
                    <span>Tip individual back of house members</span>
                  </label>
                  {tipShare.tipBohIndividual && bohStaffList.length > 0 && (
                    <div className="tipshare-boh-staff-list">
                      {bohStaffList.map((employee) => {
                        const isFavorited = false; // TODO: Implement favorite logic
                        const isSelected = tipShare.bohStaff.some(
                          (s) => (s.id || s.uid) === (employee.id || employee.uid)
                        );
                        return (
                          <div key={employee.id || employee.uid} className="tipshare-boh-staff-card-wide">
                            <div className="tipshare-staff-photo-small">
                              {employee.imageURL ? (
                                <img src={employee.imageURL} alt={employee.name} />
                              ) : (
                                <div className="tipshare-staff-photo-placeholder-small">
                                  {employee.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="tipshare-staff-info-wide">
                              <div className="tipshare-staff-name-row">
                                <span className="tipshare-staff-name">{employee.name}</span>
                                <span className="tipshare-staff-position-inline">
                                  {employee.station || employee.subRole || "Back of House"}
                                </span>
                                <button
                                  type="button"
                                  className="tipshare-favorite-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // TODO: Implement favorite toggle
                                  }}
                                  title={isFavorited ? "Remove from favorites" : "Add to favorites"}
                                >
                                  <span className={isFavorited ? "heart heart-on" : "heart"}>♥</span>
                                </button>
                              </div>
                              <div className="tipshare-boh-select-row">
                                <label className="tipshare-checkbox-label">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setTipShare({
                                        ...tipShare,
                                        bohStaff: checked
                                          ? [
                                              ...tipShare.bohStaff,
                                              {
                                                id: employee.id || employee.uid,
                                                uid: employee.uid || employee.id,
                                                name: employee.name,
                                                amount: 0,
                                                imageURL: employee.imageURL || null,
                                              },
                                            ]
                                          : tipShare.bohStaff.filter(
                                              (s) => (s.id || s.uid) !== (employee.id || employee.uid)
                                            ),
                                      });
                                    }}
                                    className="tipshare-checkbox"
                                  />
                                  <span>Select to tip</span>
                                </label>
                                {isSelected && (
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={
                                      tipShare.bohStaff.find(
                                        (s) => (s.id || s.uid) === (employee.id || employee.uid)
                                      )?.amount || 0
                                    }
                                    onChange={(e) => {
                                      const amount = Math.round(parseFloat(e.target.value) || 0);
                                      setTipShare({
                                        ...tipShare,
                                        bohStaff: tipShare.bohStaff.map((s) =>
                                          (s.id || s.uid) === (employee.id || employee.uid)
                                            ? { ...s, amount }
                                            : s
                                        ),
                                      });
                                    }}
                                    className="tipshare-individual-amount"
                                    placeholder="0"
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bill Total Input */}
        <div className="tipshare-bill-total">
          <label>Bill Total (auto-calculated from receipt/menu, adjust if needed):</label>
          <input
            type="number"
            min="0"
            step="1"
            value={billTotal || ""}
            onChange={(e) => setBillTotal(Math.round(parseFloat(e.target.value) || 0))}
            className="tipshare-bill-input"
            placeholder="0"
          />
        </div>
      </div>

      {/* Submit Button */}
      <div className="review-footer">
        <button
          className="submit-btn"
          onClick={handleSubmit}
          disabled={submitting || Object.keys(selectedItems).length === 0 || overallRating === 0}
        >
          {submitting ? "Submitting..." : "Submit Review"}
        </button>
      </div>
    </div>
  );
}

