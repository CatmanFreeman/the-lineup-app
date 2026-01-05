// src/components/TipShareWallet.jsx
//
// IMPORTANT: TipShare handles are REQUIRED for all staff members.
// When adding staff members to a restaurant, ensure the TipShare handle field
// is required and follows the format: $handle$ (dollar sign on both sides).
// Staff members without TipShare handles will not be searchable via handle.
//
// REQUIREMENT: All staff signup/creation forms MUST include a required TipShare handle field.
// Format validation: Must start and end with $ (e.g., $johndoe$)
// This field should be validated on the frontend before submission.

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { collection, getDocs, doc, getDoc, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "../hooks/services/firebase";
import {
  getEmployeeTipShareBalance,
  getEmployeeTipShareTransactions,
  requestWithdrawal,
  createTipShareTransaction,
} from "../utils/tipshareService";
import "./TipShareWallet.css";

export default function TipShareWallet({ employeeId, restaurantId, userRole = null }) {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState({ total: 0, weeklyTotal: 0, available: 0, pending: 0 });
  const [transactions, setTransactions] = useState([]);
  const [nextPaymentDate, setNextPaymentDate] = useState(null);
  const [nextPaymentAmount, setNextPaymentAmount] = useState(0);
  const [depositsThisWeek, setDepositsThisWeek] = useState(0);
  const [withdrawalsThisWeek, setWithdrawalsThisWeek] = useState(0);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawType, setWithdrawType] = useState("instant"); // "instant" or "free"
  const [withdrawing, setWithdrawing] = useState(false);
  const [error, setError] = useState("");
  
  // Send money state
  const [showSendModal, setShowSendModal] = useState(false);
  const [searchInput, setSearchInput] = useState(""); // Can be email or handle
  const [restaurantSearchInput, setRestaurantSearchInput] = useState("");
  const [showRestaurantSuggestions, setShowRestaurantSuggestions] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [restaurantList, setRestaurantList] = useState([]);
  const [restaurantStaff, setRestaurantStaff] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState([]); // Array for multiple selection
  const [fohExpanded, setFohExpanded] = useState(false);
  const [bohExpanded, setBohExpanded] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null); // "foh" or "boh"
  const [searchedStaff, setSearchedStaff] = useState(null);
  const [savedHandles, setSavedHandles] = useState([]); // Saved TipShare handles
  const [tipAmount, setTipAmount] = useState("");
  const [tipNote, setTipNote] = useState("");
  const [sendingTip, setSendingTip] = useState(false);
  const [tipError, setTipError] = useState("");
  const [tipSuccess, setTipSuccess] = useState(false);
  
  // Determine if user is employee/valet (full view) or diner (limited view)
  const isEmployeeOrValet = userRole === "EMPLOYEE" || userRole === "SERVER" || userRole === "COOK" || userRole === "HOST" || userRole === "VALET" || !!employeeId;

  // Calculate next payment date (typically weekly payday - every Friday)
  const calculateNextPaymentDate = useCallback(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 5 = Friday
    const daysUntilFriday = dayOfWeek <= 5 ? (5 - dayOfWeek) : (5 + 7 - dayOfWeek);
    const nextFriday = new Date(today);
    nextFriday.setDate(today.getDate() + daysUntilFriday);
    nextFriday.setHours(23, 59, 59, 999); // End of day
    return nextFriday;
  }, []);

  const loadTipShareData = useCallback(async () => {
    // For diners, load sent transactions only
    if (!isEmployeeOrValet && currentUser) {
      setLoading(true);
      try {
        // Load transactions where dinerId matches current user
        const transactionsRef = collection(db, "tipshare_transactions");
        const q = query(
          transactionsRef,
          where("dinerId", "==", currentUser.uid),
          orderBy("createdAt", "desc"),
          limit(100)
        );
        const snap = await getDocs(q);
        const sentTransactions = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setTransactions(sentTransactions);
        setBalance({ total: 0, weeklyTotal: 0, available: 0, pending: 0 });
      } catch (err) {
        console.error("Error loading diner transactions:", err);
        // Fallback without orderBy
        try {
          const transactionsRef = collection(db, "tipshare_transactions");
          const q = query(
            transactionsRef,
            where("dinerId", "==", currentUser.uid),
            limit(100)
          );
          const snap = await getDocs(q);
          const sentTransactions = snap.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }));
          setTransactions(sentTransactions.sort((a, b) => {
            const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
            const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
            return bTime - aTime;
          }));
        } catch (fallbackErr) {
          console.error("Fallback query failed:", fallbackErr);
          setTransactions([]);
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!employeeId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const balanceData = await getEmployeeTipShareBalance(employeeId);
      const txns = await getEmployeeTipShareTransactions(employeeId, 100);

      // Calculate available vs pending
      // Available = tips that can be withdrawn now
      // Pending = tips waiting for free transfer (1-3 days)
      const available = balanceData.total || 0;
      const pending = 0; // Will be calculated based on transaction dates

      // Calculate weekly deposits and withdrawals
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay()); // Sunday
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      let deposits = 0;
      let withdrawals = 0;
      let pendingWithdrawalAmount = 0;

      txns.forEach((tx) => {
        const txDate = tx.createdAt?.toDate ? tx.createdAt.toDate() : tx.createdAt ? new Date(tx.createdAt) : null;
        if (txDate && txDate >= weekStart && txDate <= weekEnd) {
          if (tx.type === "withdrawal") {
            withdrawals += Math.abs(tx.amount || 0);
            if (tx.status === "pending" && tx.withdrawalType === "free") {
              pendingWithdrawalAmount += Math.abs(tx.amount || 0);
            }
          } else {
            deposits += tx.amount || 0;
          }
        }
      });

      setDepositsThisWeek(deposits);
      setWithdrawalsThisWeek(withdrawals);
      setNextPaymentAmount(pendingWithdrawalAmount);

      setBalance({
        total: balanceData.total || 0,
        weeklyTotal: balanceData.weeklyTotal || 0,
        available,
        pending,
      });

      setTransactions(txns);
      
      // Calculate next payment date
      const nextPayment = calculateNextPaymentDate();
      setNextPaymentDate(nextPayment);
    } catch (err) {
      console.error("Error loading TipShare data:", err);
      setError("Failed to load TipShare data");
    } finally {
      setLoading(false);
    }
  }, [employeeId, isEmployeeOrValet, currentUser, calculateNextPaymentDate]);

  useEffect(() => {
    loadTipShareData();
  }, [loadTipShareData]);

  // Load restaurants (for both diner and employee views)
  useEffect(() => {
    if (currentUser) {
      const loadRestaurants = async () => {
        try {
          const restaurantsRef = collection(db, "restaurants");
          const restaurantsSnap = await getDocs(restaurantsRef);
          const restaurants = restaurantsSnap.docs.map((doc) => ({
            id: doc.id,
            name: doc.data().name || doc.id,
          }));
          setRestaurantList(restaurants);
        } catch (err) {
          console.error("Error loading restaurants:", err);
        }
      };
      loadRestaurants();
    }
  }, [currentUser]);

  // Load saved handles from localStorage
  useEffect(() => {
    if (currentUser) {
      const saved = localStorage.getItem(`tipshare_saved_handles_${currentUser.uid}`);
      if (saved) {
        try {
          setSavedHandles(JSON.parse(saved));
        } catch (err) {
          console.error("Error loading saved handles:", err);
        }
      }
    }
  }, [currentUser]);

  // Filter restaurants based on search input
  const filteredRestaurants = restaurantList.filter((restaurant) =>
    restaurant.name.toLowerCase().includes(restaurantSearchInput.toLowerCase())
  );

  // Load staff for selected restaurant
  useEffect(() => {
    if (selectedRestaurant) {
      const loadRestaurantStaff = async () => {
        try {
          const staffRef = collection(db, "restaurants", selectedRestaurant.id, "staff");
          const staffSnap = await getDocs(staffRef);
          const staff = staffSnap.docs.map((doc) => ({
            id: doc.id,
            uid: doc.data().uid || doc.id,
            name: doc.data().name || "Unknown",
            role: doc.data().role || "",
            subRole: doc.data().subRole || "",
            email: doc.data().email || "",
            tipShareHandle: doc.data().tipShareHandle || "",
            imageURL: doc.data().imageURL || null,
            restaurantId: selectedRestaurant.id,
            restaurantName: selectedRestaurant.name,
          }));
          setRestaurantStaff(staff);
        } catch (err) {
          console.error("Error loading restaurant staff:", err);
          setRestaurantStaff([]);
        }
      };
      loadRestaurantStaff();
    } else {
      setRestaurantStaff([]);
    }
  }, [selectedRestaurant]);

  // Search staff by TipShare handle or email
  const searchStaff = async (query) => {
    if (!query.trim()) {
      setSearchedStaff(null);
      setTipError("");
      return;
    }

    const trimmedQuery = query.trim();

    try {
      // Determine search type
      const isHandle = trimmedQuery.startsWith("$") && trimmedQuery.endsWith("$");
      const isEmail = trimmedQuery.includes("@");

      if (isHandle) {
        // Search by handle
        const middlePart = trimmedQuery.slice(1, -1).trim();
        if (!middlePart) {
          setTipError("Handle cannot be empty. Format: $handle$");
          setSearchedStaff(null);
          return;
        }
        const cleanHandle = middlePart.toLowerCase();

        // Search across all restaurants
        const restaurantsRef = collection(db, "restaurants");
        const restaurantsSnap = await getDocs(restaurantsRef);
        
        for (const restaurantDoc of restaurantsSnap.docs) {
          const restaurantId = restaurantDoc.id;
          const staffRef = collection(db, "restaurants", restaurantId, "staff");
          const staffSnap = await getDocs(staffRef);
          
          for (const staffDoc of staffSnap.docs) {
            const staffData = staffDoc.data();
            const staffHandle = staffData.tipShareHandle || "";
            const cleanStaffHandle = staffHandle.replace(/\$/g, "").trim().toLowerCase();
            
            if (cleanStaffHandle === cleanHandle) {
              setSearchedStaff({
                id: staffDoc.id,
                uid: staffData.uid || staffDoc.id,
                restaurantId: restaurantId,
                restaurantName: restaurantDoc.data().name || restaurantId,
                name: staffData.name || "Unknown",
                role: staffData.role || "Staff",
                subRole: staffData.subRole || "",
                email: staffData.email || "",
                imageURL: staffData.imageURL || null,
                tipShareHandle: staffHandle,
              });
              setTipError("");
              return;
            }
          }
        }
      } else if (isEmail) {
        // Search by email
        const restaurantsRef = collection(db, "restaurants");
        const restaurantsSnap = await getDocs(restaurantsRef);
        
        for (const restaurantDoc of restaurantsSnap.docs) {
          const restaurantId = restaurantDoc.id;
          const staffRef = collection(db, "restaurants", restaurantId, "staff");
          const staffSnap = await getDocs(staffRef);
          
          for (const staffDoc of staffSnap.docs) {
            const staffData = staffDoc.data();
            const staffEmail = (staffData.email || "").toLowerCase();
            
            if (staffEmail === trimmedQuery.toLowerCase()) {
              setSearchedStaff({
                id: staffDoc.id,
                uid: staffData.uid || staffDoc.id,
                restaurantId: restaurantId,
                restaurantName: restaurantDoc.data().name || restaurantId,
                name: staffData.name || "Unknown",
                role: staffData.role || "Staff",
                subRole: staffData.subRole || "",
                email: staffData.email || "",
                imageURL: staffData.imageURL || null,
                tipShareHandle: staffData.tipShareHandle || "",
              });
              setTipError("");
              return;
            }
          }
        }
      } else {
        setTipError("Please enter a TipShare handle ($handle$) or email address");
        setSearchedStaff(null);
        return;
      }
      
      // Not found
      setSearchedStaff(null);
      setTipError("No staff member found");
    } catch (error) {
      console.error("Error searching for staff:", error);
      setTipError("Error searching for staff");
    }
  };

  // Toggle staff selection and save handle
  const toggleStaffSelection = (staff) => {
    setSelectedStaff((prev) => {
      const exists = prev.find((s) => (s.uid || s.id) === (staff.uid || staff.id));
      if (exists) {
        return prev.filter((s) => (s.uid || s.id) !== (staff.uid || staff.id));
      } else {
        // Save handle for future use
        if (staff.tipShareHandle && currentUser) {
          const handleToSave = {
            handle: staff.tipShareHandle,
            name: staff.name,
            restaurantName: staff.restaurantName,
            imageURL: staff.imageURL,
            savedAt: new Date().toISOString(),
          };
          const updated = [...savedHandles];
          const existingIndex = updated.findIndex(h => h.handle === staff.tipShareHandle);
          if (existingIndex >= 0) {
            updated[existingIndex] = handleToSave;
          } else {
            updated.push(handleToSave);
          }
          setSavedHandles(updated);
          localStorage.setItem(`tipshare_saved_handles_${currentUser.uid}`, JSON.stringify(updated));
        }
        return [...prev, staff];
      }
    });
  };

  // Select restaurant from search
  const handleRestaurantSelect = (restaurant) => {
    setSelectedRestaurant(restaurant);
    setRestaurantSearchInput(restaurant.name);
    setShowRestaurantSuggestions(false);
    setSelectedDepartment(null);
    setFohExpanded(false);
    setBohExpanded(false);
  };

  // Send tip to staff member(s)
  const handleSendTip = async () => {
    if (!currentUser) {
      setTipError("Please sign in to send tips");
      return;
    }

    const staffToTip = selectedStaff.length > 0 ? selectedStaff : (searchedStaff ? [searchedStaff] : []);
    
    if (staffToTip.length === 0) {
      setTipError("Please select at least one staff member to tip");
      return;
    }

    const amount = parseFloat(tipAmount);
    if (!amount || amount <= 0) {
      setTipError("Please enter a valid tip amount");
      return;
    }

    if (amount > 1000) {
      setTipError("Maximum tip amount is $1,000 per transaction");
      return;
    }

    if (tipNote.length > 200) {
      setTipError("Note must be 200 characters or less");
      return;
    }

    setSendingTip(true);
    setTipError("");

    try {
      // Send tip to each selected staff member
      const tipPromises = staffToTip.map((staff) =>
        createTipShareTransaction({
          dinerId: currentUser.uid,
          employeeId: staff.uid || staff.id,
          restaurantId: staff.restaurantId,
          amount: amount,
          source: "wallet",
          sourceId: null,
          note: tipNote.trim() || null,
          dinerName: currentUser.displayName || currentUser.email,
          employeeName: staff.name,
        })
      );

      await Promise.all(tipPromises);

      setTipSuccess(true);
      setSearchInput("");
      setSearchedStaff(null);
      setSelectedStaff([]);
      setTipAmount("");
      setTipNote("");
      
      // Reload transactions
      setTimeout(async () => {
        await loadTipShareData();
        setTipSuccess(false);
      }, 2000);
    } catch (error) {
      console.error("Error sending tip:", error);
      setTipError(error.message || "Failed to send tip. Please try again.");
    } finally {
      setSendingTip(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (amount > balance.available) {
      setError("Insufficient balance");
      return;
    }

    if (amount < 1) {
      setError("Minimum withdrawal is $1.00");
      return;
    }

    setWithdrawing(true);
    setError("");

    try {
      await requestWithdrawal({
        employeeId,
        amount,
        type: withdrawType, // "instant" or "free"
        restaurantId,
      });

      // Reload data
      await loadTipShareData();
      setShowWithdrawModal(false);
      setWithdrawAmount("");
      setWithdrawType("instant");
    } catch (err) {
      console.error("Error requesting withdrawal:", err);
      setError(err.message || "Failed to process withdrawal");
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <div className="tsw-container">
        <div className="tsw-loading">Loading TipShare account...</div>
      </div>
    );
  }

  const instantFee = withdrawAmount ? (parseFloat(withdrawAmount) * 0.02).toFixed(2) : "0.00";
  const instantAmount = withdrawAmount ? (parseFloat(withdrawAmount) - parseFloat(instantFee)).toFixed(2) : "0.00";

  return (
    <div className="tsw-container">
      {/* Employee/Valet Full View */}
      {isEmployeeOrValet && (
        <>
          {/* Balance Card */}
          <div className="tsw-balance-card">
            <div className="tsw-balance-header">
              <h2 className="tsw-tipshare-title">
                TIP<span className="tsw-tipshare-dollar">$</span>HARE Balance
              </h2>
            </div>
            <div className="tsw-balance-amount">${balance.total.toFixed(2)}</div>
            <div className="tsw-balance-details">
              <div className="tsw-balance-item">
                <span className="tsw-balance-label">Current Balance</span>
                <span className="tsw-balance-value">${balance.total.toFixed(2)}</span>
              </div>
              <div className="tsw-balance-item">
                <span className="tsw-balance-label">Available Balance</span>
                <span className="tsw-balance-value">${balance.available.toFixed(2)}</span>
              </div>
              {nextPaymentDate && (
                <div className="tsw-balance-item">
                  <span className="tsw-balance-label">Next Payment Date</span>
                  <span className="tsw-balance-value">
                    {nextPaymentDate.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
              {nextPaymentAmount > 0 && (
                <div className="tsw-balance-item">
                  <span className="tsw-balance-label">Next Payment Amount</span>
                  <span className="tsw-balance-value">${nextPaymentAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="tsw-balance-item">
                <span className="tsw-balance-label">Deposits This Week</span>
                <span className="tsw-balance-value">${depositsThisWeek.toFixed(2)}</span>
              </div>
              <div className="tsw-balance-item">
                <span className="tsw-balance-label">Withdrawals This Week</span>
                <span className="tsw-balance-value">${withdrawalsThisWeek.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Withdrawal Options - Two Prominent Buttons */}
          {balance.available > 0 && (
            <div className="tsw-withdrawal-options">
              <button
                className="tsw-withdraw-option-btn tsw-withdraw-instant"
                onClick={() => {
                  setWithdrawType("instant");
                  setShowWithdrawModal(true);
                }}
              >
                <div className="tsw-withdraw-option-header">
                  <span className="tsw-withdraw-option-title">Instant Transfer</span>
                  <span className="tsw-withdraw-option-badge">2% Fee</span>
                </div>
                <div className="tsw-withdraw-option-desc">Get your money in minutes</div>
              </button>
              <button
                className="tsw-withdraw-option-btn tsw-withdraw-free"
                onClick={() => {
                  setWithdrawType("free");
                  setShowWithdrawModal(true);
                }}
              >
                <div className="tsw-withdraw-option-header">
                  <span className="tsw-withdraw-option-title">Free Transfer</span>
                  <span className="tsw-withdraw-option-badge-free">No Fee</span>
                </div>
                <div className="tsw-withdraw-option-desc">1-3 business days</div>
              </button>
            </div>
          )}
        </>
      )}

      {/* Transaction History */}
      <div className="tsw-transactions">
        <h3 className="tsw-section-title">
          {isEmployeeOrValet ? "Transaction History" : "Transaction History"}
        </h3>
        {transactions.length === 0 ? (
          <div className="tsw-empty">
            {isEmployeeOrValet ? "No transactions yet" : "No sent transactions yet"}
          </div>
        ) : (
          <div className="tsw-transaction-list">
            {transactions.map((tx) => {
              const date = tx.createdAt?.toDate
                ? tx.createdAt.toDate()
                : tx.createdAt
                ? new Date(tx.createdAt)
                : null;
              const isWithdrawal = tx.type === "withdrawal";
              const isInstant = tx.withdrawalType === "instant";

              return (
                <div key={tx.id} className="tsw-transaction-item">
                  <div className="tsw-transaction-main">
                    <div className="tsw-transaction-info">
                      <div className="tsw-transaction-type">
                        {isWithdrawal
                          ? `Withdrawal ${isInstant ? "(Instant)" : "(Free Transfer)"}`
                          : isEmployeeOrValet
                          ? `Tip from ${tx.dinerName || "Guest"}`
                          : `Tip to ${tx.employeeName || "Staff Member"}`}
                      </div>
                      <div className="tsw-transaction-note">
                        {tx.note || tx.source || ""}
                      </div>
                      {date && (
                        <div className="tsw-transaction-date">
                          {date.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}{" "}
                          {date.toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      )}
                    </div>
                    <div className={`tsw-transaction-amount ${isWithdrawal ? "tsw-amount-negative" : isEmployeeOrValet ? "tsw-amount-positive" : "tsw-amount-negative"}`}>
                      {isEmployeeOrValet ? (isWithdrawal ? "-" : "+") : "-"}${Math.abs(tx.amount || 0).toFixed(2)}
                      {isWithdrawal && isInstant && tx.fee && (
                        <div className="tsw-transaction-fee">Fee: ${tx.fee.toFixed(2)}</div>
                      )}
                    </div>
                  </div>
                  {tx.status && (
                    <div className={`tsw-transaction-status tsw-status-${tx.status}`}>
                      {tx.status === "pending" && "Processing"}
                      {tx.status === "processed" && "Completed"}
                      {tx.status === "failed" && "Failed"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Send Money Module */}
      <div className="tsw-send-money-module">
        <h3 className="tsw-section-title">Send Money to Staff</h3>
        
        {/* TipShare Handle Section */}
        <div className="tsw-form-group">
          <div className="tsw-tipshare-handle-header">
            <span className="tsw-tipshare-logo-modal">
              TIP<span className="tsw-tipshare-dollar-modal">$</span>HARE
            </span>
            <span className="tsw-handle-label">Handle:</span>
          </div>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setTipError("");
              setSearchedStaff(null);
              // Clear restaurant search when typing handle
              if (e.target.value.trim()) {
                setRestaurantSearchInput("");
                setSelectedRestaurant(null);
                setSelectedDepartment(null);
                setFohExpanded(false);
                setBohExpanded(false);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (searchInput.trim()) {
                  searchStaff(searchInput);
                }
              }
            }}
            placeholder="$example$"
            className="tsw-handle-input-modal"
          />
          {searchInput.trim() && (
            <button
              className="tsw-search-btn-modal"
              onClick={() => searchStaff(searchInput)}
            >
              Search
            </button>
          )}
        </div>

        {/* Restaurant Search Section */}
        <div className="tsw-form-group">
          <label className="tsw-label">Search by Restaurant</label>
          <div className="tsw-restaurant-search-wrapper">
            <input
              type="text"
              value={restaurantSearchInput}
              onChange={(e) => {
                setRestaurantSearchInput(e.target.value);
                setShowRestaurantSuggestions(true);
                // Clear handle search when typing restaurant
                if (e.target.value.trim()) {
                  setSearchInput("");
                  setSearchedStaff(null);
                }
                if (!e.target.value) {
                  setSelectedRestaurant(null);
                  setSelectedDepartment(null);
                  setFohExpanded(false);
                  setBohExpanded(false);
                }
              }}
              onFocus={() => {
                if (restaurantSearchInput && filteredRestaurants.length > 0) {
                  setShowRestaurantSuggestions(true);
                }
              }}
              placeholder="Type restaurant name..."
              className="tsw-restaurant-search-input"
            />
            {showRestaurantSuggestions && restaurantSearchInput && filteredRestaurants.length > 0 && (
              <div 
                className="tsw-restaurant-suggestions"
                onClick={(e) => e.stopPropagation()}
              >
                {filteredRestaurants.slice(0, 5).map((restaurant) => (
                  <div
                    key={restaurant.id}
                    className="tsw-restaurant-suggestion-item"
                    onClick={() => handleRestaurantSelect(restaurant)}
                  >
                    {restaurant.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Department Selection (FOH/BOH) - Only show after restaurant is selected */}
        {selectedRestaurant && restaurantStaff.length > 0 && (
          <div className="tsw-form-group">
            <label className="tsw-label">Select Department</label>
            <div className="tsw-department-buttons">
              <button
                className={`tsw-department-btn ${selectedDepartment === "foh" ? "tsw-department-active" : ""}`}
                onClick={() => {
                  setSelectedDepartment("foh");
                  setFohExpanded(true);
                  setBohExpanded(false);
                }}
              >
                Front of House
              </button>
              <button
                className={`tsw-department-btn ${selectedDepartment === "boh" ? "tsw-department-active" : ""}`}
                onClick={() => {
                  setSelectedDepartment("boh");
                  setFohExpanded(false);
                  setBohExpanded(true);
                }}
              >
                Back of House
              </button>
            </div>
          </div>
        )}

        {/* Searched Staff Result */}
        {searchedStaff && (
          <div className="tsw-searched-staff">
            <div className="tsw-staff-info">
              {searchedStaff.imageURL && (
                <img
                  src={searchedStaff.imageURL}
                  alt={searchedStaff.name}
                  className="tsw-staff-avatar"
                />
              )}
              <div className="tsw-staff-details">
                <div className="tsw-staff-name">{searchedStaff.name}</div>
                <div className="tsw-staff-role">{searchedStaff.role} {searchedStaff.subRole && `- ${searchedStaff.subRole}`}</div>
                <div className="tsw-staff-restaurant">{searchedStaff.restaurantName}</div>
              </div>
            </div>
            <button
              className="tsw-select-staff-btn"
              onClick={() => toggleStaffSelection(searchedStaff)}
            >
              {selectedStaff.find(s => (s.uid || s.id) === (searchedStaff.uid || searchedStaff.id)) ? "Selected" : "Select"}
            </button>
          </div>
        )}

        {/* Restaurant Staff List (FOH/BOH) */}
        {selectedRestaurant && restaurantStaff.length > 0 && selectedDepartment && (() => {
          const fohStaff = restaurantStaff.filter(s => 
            s.role === "Front of House" || 
            (s.role && (s.role.toLowerCase().includes("front") || s.role.toLowerCase().includes("server") || s.role.toLowerCase().includes("host")))
          );
          const bohStaff = restaurantStaff.filter(s => 
            s.role === "Back of House" || 
            (s.role && (s.role.toLowerCase().includes("back") || s.role.toLowerCase().includes("cook") || s.role.toLowerCase().includes("prep")))
          );
          
          const staffToShow = selectedDepartment === "foh" ? fohStaff : bohStaff;
          
          return (
            <div className="tsw-restaurant-staff-list">
              <div className="tsw-staff-list-header">
                {selectedDepartment === "foh" ? "Front of House" : "Back of House"} Staff at {selectedRestaurant.name}
              </div>
              
              {(fohExpanded && selectedDepartment === "foh") || (bohExpanded && selectedDepartment === "boh") ? (
                <div className="tsw-staff-list">
                  {staffToShow.map((staff) => {
                    const isSelected = selectedStaff.find(s => (s.uid || s.id) === (staff.uid || staff.id));
                    return (
                      <div
                        key={staff.id}
                        className={`tsw-staff-list-item ${isSelected ? "tsw-staff-list-item-selected" : ""}`}
                        onClick={() => toggleStaffSelection(staff)}
                      >
                        <div className="tsw-staff-list-item-content">
                          {staff.imageURL ? (
                            <img src={staff.imageURL} alt={staff.name} className="tsw-staff-list-avatar" />
                          ) : (
                            <div className="tsw-staff-list-avatar-placeholder">
                              {staff.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="tsw-staff-list-info">
                            <div className="tsw-staff-list-name">{staff.name}</div>
                            {staff.tipShareHandle && (
                              <div className="tsw-staff-list-handle">{staff.tipShareHandle}</div>
                            )}
                            {staff.role && (
                              <div className="tsw-staff-list-role">{staff.role} {staff.subRole && `- ${staff.subRole}`}</div>
                            )}
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleStaffSelection(staff)}
                          onClick={(e) => e.stopPropagation()}
                          className="tsw-staff-list-checkbox"
                        />
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })()}

        {/* Selected Staff Display */}
        {selectedStaff.length > 0 && (
          <div className="tsw-selected-staff-section">
            <div className="tsw-selected-staff-header">
              Selected Staff <span className="tsw-selected-count-badge">{selectedStaff.length}</span>
            </div>
            <div className="tsw-selected-staff-list">
              {selectedStaff.map((staff) => (
                <div key={staff.id || staff.uid} className="tsw-selected-staff-item">
                  {staff.imageURL && (
                    <img src={staff.imageURL} alt={staff.name} className="tsw-selected-staff-avatar" />
                  )}
                  <div className="tsw-selected-staff-info">
                    <div className="tsw-selected-staff-name">{staff.name}</div>
                    {staff.tipShareHandle && (
                      <div className="tsw-selected-staff-handle">{staff.tipShareHandle}</div>
                    )}
                    {staff.restaurantName && (
                      <div className="tsw-selected-staff-restaurant">{staff.restaurantName}</div>
                    )}
                  </div>
                  <button
                    className="tsw-remove-staff-btn"
                    onClick={() => toggleStaffSelection(staff)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Amount and Note Inputs */}
        {(searchedStaff || selectedStaff.length > 0) && (
          <>
            <div className="tsw-form-group">
              <label className="tsw-label">Amount</label>
              <div className="tsw-amount-input-wrapper">
                <span className="tsw-currency">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={tipAmount}
                  onChange={(e) => {
                    setTipAmount(e.target.value);
                    setTipError("");
                  }}
                  placeholder="0.00"
                  className="tsw-amount-input"
                />
              </div>
              <div className="tsw-amount-hint">Minimum: $0.01</div>
            </div>

            <div className="tsw-form-group">
              <label className="tsw-label">Note (Optional)</label>
              <textarea
                value={tipNote}
                onChange={(e) => {
                  setTipNote(e.target.value);
                  setTipError("");
                }}
                placeholder="Add a note..."
                rows={3}
                className="tsw-note-input"
              />
              <div className="tsw-note-hint">Optional message to include with the tip</div>
            </div>

            {tipError && (
              <div className="tsw-error-message">{tipError}</div>
            )}

            <button
              className="tsw-send-btn tsw-send-btn-primary"
              onClick={handleSendTip}
              disabled={sendingTip || !tipAmount || parseFloat(tipAmount) <= 0}
            >
              {sendingTip ? "Sending..." : `Send $${tipAmount || "0.00"} ${selectedStaff.length > 0 ? `to ${selectedStaff.length} staff member${selectedStaff.length > 1 ? 's' : ''}` : searchedStaff ? `to ${searchedStaff.name}` : ""}`}
            </button>
          </>
        )}
      </div>

      {/* Withdrawal Modal */}
      {showWithdrawModal && (
        <div className="tsw-modal-overlay" onClick={() => setShowWithdrawModal(false)}>
          <div className="tsw-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tsw-modal-header">
              <h3>Withdraw Funds</h3>
              <button className="tsw-close-btn" onClick={() => setShowWithdrawModal(false)}>
                ×
              </button>
            </div>
            <div className="tsw-modal-body">
              <div className="tsw-withdraw-options">
                <button
                  className={`tsw-option-btn ${withdrawType === "instant" ? "tsw-option-active" : ""}`}
                  onClick={() => setWithdrawType("instant")}
                >
                  <div className="tsw-option-header">
                    <span className="tsw-option-title">Instant Transfer</span>
                    <span className="tsw-option-badge">2% Fee</span>
                  </div>
                  <div className="tsw-option-desc">Get your money in minutes</div>
                </button>
                <button
                  className={`tsw-option-btn ${withdrawType === "free" ? "tsw-option-active" : ""}`}
                  onClick={() => setWithdrawType("free")}
                >
                  <div className="tsw-option-header">
                    <span className="tsw-option-title">Free Transfer</span>
                    <span className="tsw-option-badge">No Fee</span>
                  </div>
                  <div className="tsw-option-desc">1-3 business days</div>
                </button>
              </div>

              <div className="tsw-withdraw-amount">
                <label className="tsw-label">Amount</label>
                <div className="tsw-amount-input-wrapper">
                  <span className="tsw-currency">$</span>
                  <input
                    type="number"
                    min="1"
                    max={balance.available}
                    step="0.01"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.00"
                    className="tsw-amount-input"
                  />
                </div>
                <div className="tsw-amount-hint">
                  Available: ${balance.available.toFixed(2)}
                </div>
              </div>

              {withdrawType === "instant" && withdrawAmount && (
                <div className="tsw-fee-breakdown">
                  <div className="tsw-fee-row">
                    <span>Withdrawal Amount</span>
                    <span>${parseFloat(withdrawAmount || 0).toFixed(2)}</span>
                  </div>
                  <div className="tsw-fee-row">
                    <span>Instant Fee (2%)</span>
                    <span>-${instantFee}</span>
                  </div>
                  <div className="tsw-fee-row tsw-fee-total">
                    <span>You'll Receive</span>
                    <span>${instantAmount}</span>
                  </div>
                </div>
              )}

              {error && <div className="tsw-error">{error}</div>}

              <div className="tsw-modal-footer">
                <button
                  className="tsw-btn tsw-btn-secondary"
                  onClick={() => setShowWithdrawModal(false)}
                  disabled={withdrawing}
                >
                  Cancel
                </button>
                <button
                  className="tsw-btn tsw-btn-primary"
                  onClick={handleWithdraw}
                  disabled={withdrawing || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
                >
                  {withdrawing ? "Processing..." : withdrawType === "instant" ? "Withdraw Instantly" : "Request Transfer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Money Modal */}
      {showSendModal && (
        <div className="tsw-modal-overlay" onClick={() => {
          setShowSendModal(false);
          setSearchInput("");
          setRestaurantSearchInput("");
          setShowRestaurantSuggestions(false);
          setSearchedStaff(null);
          setSelectedStaff([]);
          setSelectedRestaurant(null);
          setSelectedDepartment(null);
          setFohExpanded(false);
          setBohExpanded(false);
          setTipAmount("");
          setTipNote("");
          setTipError("");
          setTipSuccess(false);
        }}>
          <div className="tsw-modal tsw-send-modal-large" onClick={(e) => {
            e.stopPropagation();
            setShowRestaurantSuggestions(false);
          }}>
            <div className="tsw-modal-header">
              <h3>Send Money to Staff</h3>
              <button className="tsw-close-btn" onClick={() => {
                setShowSendModal(false);
                setSearchInput("");
                setRestaurantSearchInput("");
                setShowRestaurantSuggestions(false);
                setSearchedStaff(null);
                setSelectedStaff([]);
                setSelectedRestaurant(null);
                setSelectedDepartment(null);
                setFohExpanded(false);
                setBohExpanded(false);
                setTipAmount("");
                setTipNote("");
                setTipError("");
                setTipSuccess(false);
              }}>
                ×
              </button>
            </div>
            <div className="tsw-modal-body">
              {tipSuccess ? (
                <div className="tsw-success-message">
                  <div className="tsw-success-icon">✓</div>
                  <h4>Tip Sent Successfully!</h4>
                  <p>Your tip has been sent to {selectedStaff.length > 0 ? `${selectedStaff.length} staff member${selectedStaff.length > 1 ? 's' : ''}` : searchedStaff?.name}.</p>
                </div>
              ) : (
                <>
                  <div className="tsw-send-form">
                    {/* TipShare Handle Section */}
                    <div className="tsw-form-group">
                      <div className="tsw-tipshare-handle-header">
                        <span className="tsw-tipshare-logo-modal">
                          TIP<span className="tsw-tipshare-dollar-modal">$</span>HARE
                        </span>
                        <span className="tsw-handle-label">Handle:</span>
                      </div>
                      <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => {
                          setSearchInput(e.target.value);
                          setTipError("");
                          setSearchedStaff(null);
                          // Clear restaurant search when typing handle
                          if (e.target.value.trim()) {
                            setRestaurantSearchInput("");
                            setSelectedRestaurant(null);
                            setSelectedDepartment(null);
                            setFohExpanded(false);
                            setBohExpanded(false);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (searchInput.trim()) {
                              searchStaff(searchInput);
                            }
                          }
                        }}
                        placeholder="$example$"
                        className="tsw-handle-input-modal"
                      />
                      {searchInput.trim() && (
                        <button
                          className="tsw-search-btn-modal"
                          onClick={() => searchStaff(searchInput)}
                        >
                          Search
                        </button>
                      )}
                    </div>

                    {/* Restaurant Search Section */}
                    <div className="tsw-form-group">
                      <label className="tsw-label">Search by Restaurant</label>
                      <div className="tsw-restaurant-search-wrapper">
                        <input
                          type="text"
                          value={restaurantSearchInput}
                          onChange={(e) => {
                            setRestaurantSearchInput(e.target.value);
                            setShowRestaurantSuggestions(true);
                            // Clear handle search when typing restaurant
                            if (e.target.value.trim()) {
                              setSearchInput("");
                              setSearchedStaff(null);
                            }
                            if (!e.target.value) {
                              setSelectedRestaurant(null);
                              setSelectedDepartment(null);
                              setFohExpanded(false);
                              setBohExpanded(false);
                            }
                          }}
                          onFocus={() => {
                            if (restaurantSearchInput && filteredRestaurants.length > 0) {
                              setShowRestaurantSuggestions(true);
                            }
                          }}
                          placeholder="Type restaurant name..."
                          className="tsw-restaurant-search-input"
                        />
                        {showRestaurantSuggestions && restaurantSearchInput && filteredRestaurants.length > 0 && (
                          <div 
                            className="tsw-restaurant-suggestions"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {filteredRestaurants.slice(0, 5).map((restaurant) => (
                              <div
                                key={restaurant.id}
                                className="tsw-restaurant-suggestion-item"
                                onClick={() => handleRestaurantSelect(restaurant)}
                              >
                                {restaurant.name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Department Selection (FOH/BOH) - Only show after restaurant is selected */}
                    {selectedRestaurant && restaurantStaff.length > 0 && (
                      <div className="tsw-form-group">
                        <label className="tsw-label">Select Department</label>
                        <div className="tsw-department-buttons">
                          <button
                            className={`tsw-department-btn ${selectedDepartment === "foh" ? "tsw-department-active" : ""}`}
                            onClick={() => {
                              setSelectedDepartment("foh");
                              setFohExpanded(true);
                              setBohExpanded(false);
                            }}
                          >
                            Front of House
                          </button>
                          <button
                            className={`tsw-department-btn ${selectedDepartment === "boh" ? "tsw-department-active" : ""}`}
                            onClick={() => {
                              setSelectedDepartment("boh");
                              setFohExpanded(false);
                              setBohExpanded(true);
                            }}
                          >
                            Back of House
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Searched Staff Result */}
                    {searchedStaff && (
                      <div className="tsw-searched-staff">
                        <div className="tsw-staff-info">
                          {searchedStaff.imageURL && (
                            <img
                              src={searchedStaff.imageURL}
                              alt={searchedStaff.name}
                              className="tsw-staff-avatar"
                            />
                          )}
                          <div className="tsw-staff-details">
                            <div className="tsw-staff-name">{searchedStaff.name}</div>
                            <div className="tsw-staff-role">{searchedStaff.role} {searchedStaff.subRole && `- ${searchedStaff.subRole}`}</div>
                            <div className="tsw-staff-restaurant">{searchedStaff.restaurantName}</div>
                          </div>
                        </div>
                        <button
                          className="tsw-select-staff-btn"
                          onClick={() => toggleStaffSelection(searchedStaff)}
                        >
                          {selectedStaff.find(s => (s.uid || s.id) === (searchedStaff.uid || searchedStaff.id)) ? "Selected" : "Select"}
                        </button>
                      </div>
                    )}

                    {/* Restaurant Staff Cards (FOH/BOH) */}
                    {selectedRestaurant && restaurantStaff.length > 0 && selectedDepartment && (() => {
                      const fohStaff = restaurantStaff.filter(s => 
                        s.role === "Front of House" || 
                        (s.role && (s.role.toLowerCase().includes("front") || s.role.toLowerCase().includes("server") || s.role.toLowerCase().includes("host")))
                      );
                      const bohStaff = restaurantStaff.filter(s => 
                        s.role === "Back of House" || 
                        (s.role && (s.role.toLowerCase().includes("back") || s.role.toLowerCase().includes("cook") || s.role.toLowerCase().includes("prep")))
                      );
                      
                      const staffToShow = selectedDepartment === "foh" ? fohStaff : bohStaff;
                      
                      return (
                        <div className="tsw-restaurant-staff-list">
                          <div className="tsw-staff-list-header">
                            {selectedDepartment === "foh" ? "Front of House" : "Back of House"} Staff at {selectedRestaurant.name}
                          </div>
                          
                          {(fohExpanded && selectedDepartment === "foh") || (bohExpanded && selectedDepartment === "boh") ? (
                            <div className="tsw-staff-list">
                              {staffToShow.map((staff) => {
                                const isSelected = selectedStaff.find(s => (s.uid || s.id) === (staff.uid || staff.id));
                                return (
                                  <div
                                    key={staff.id}
                                    className={`tsw-staff-list-item ${isSelected ? "tsw-staff-list-item-selected" : ""}`}
                                    onClick={() => toggleStaffSelection(staff)}
                                  >
                                    <div className="tsw-staff-list-item-content">
                                      {staff.imageURL ? (
                                        <img src={staff.imageURL} alt={staff.name} className="tsw-staff-list-avatar" />
                                      ) : (
                                        <div className="tsw-staff-list-avatar-placeholder">
                                          {staff.name.charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                      <div className="tsw-staff-list-info">
                                        <div className="tsw-staff-list-name">{staff.name}</div>
                                        {staff.tipShareHandle && (
                                          <div className="tsw-staff-list-handle">{staff.tipShareHandle}</div>
                                        )}
                                        {staff.role && (
                                          <div className="tsw-staff-list-role">{staff.role} {staff.subRole && `- ${staff.subRole}`}</div>
                                        )}
                                      </div>
                                    </div>
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleStaffSelection(staff)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="tsw-staff-list-checkbox"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      );
                    })()}

                    {/* Selected Staff Display */}
                    {(selectedStaff.length > 0 || searchedStaff) && (
                      <div className="tsw-selected-staff-section">
                        <div className="tsw-selected-staff-header">
                          <h4>Selected Staff Members</h4>
                          <span className="tsw-selected-count-badge">
                            {selectedStaff.length > 0 ? selectedStaff.length : 1} selected
                          </span>
                        </div>
                        <div className="tsw-selected-staff-list">
                          {selectedStaff.length > 0 ? (
                            selectedStaff.map((staff) => (
                              <div key={staff.uid || staff.id} className="tsw-selected-staff-item">
                                {staff.imageURL && (
                                  <img src={staff.imageURL} alt={staff.name} className="tsw-selected-staff-avatar" />
                                )}
                                <div className="tsw-selected-staff-info">
                                  <div className="tsw-selected-staff-name">{staff.name}</div>
                                  {staff.tipShareHandle && (
                                    <div className="tsw-selected-staff-handle">{staff.tipShareHandle}</div>
                                  )}
                                  <div className="tsw-selected-staff-restaurant">{staff.restaurantName}</div>
                                </div>
                                <button
                                  className="tsw-remove-staff-btn"
                                  onClick={() => toggleStaffSelection(staff)}
                                  title="Remove"
                                >
                                  ×
                                </button>
                              </div>
                            ))
                          ) : searchedStaff ? (
                            <div className="tsw-selected-staff-item">
                              {searchedStaff.imageURL && (
                                <img src={searchedStaff.imageURL} alt={searchedStaff.name} className="tsw-selected-staff-avatar" />
                              )}
                              <div className="tsw-selected-staff-info">
                                <div className="tsw-selected-staff-name">{searchedStaff.name}</div>
                                {searchedStaff.tipShareHandle && (
                                  <div className="tsw-selected-staff-handle">{searchedStaff.tipShareHandle}</div>
                                )}
                                <div className="tsw-selected-staff-restaurant">{searchedStaff.restaurantName}</div>
                              </div>
                              <button
                                className="tsw-remove-staff-btn"
                                onClick={() => setSearchedStaff(null)}
                                title="Remove"
                              >
                                ×
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}

                    {/* Amount and Note */}
                    {(searchedStaff || selectedStaff.length > 0) && (
                      <>
                        <div className="tsw-form-group">
                          <label className="tsw-label">Amount</label>
                          <div className="tsw-amount-input-wrapper">
                            <span className="tsw-currency">$</span>
                            <input
                              type="number"
                              min="0.01"
                              max="1000"
                              step="0.01"
                              value={tipAmount}
                              onChange={(e) => setTipAmount(e.target.value)}
                              placeholder="0.00"
                              className="tsw-amount-input"
                            />
                          </div>
                          <div className="tsw-amount-hint">Maximum: $1,000 per transaction</div>
                        </div>

                        <div className="tsw-form-group">
                          <label className="tsw-label">Note (Optional)</label>
                          <textarea
                            value={tipNote}
                            onChange={(e) => {
                              if (e.target.value.length <= 200) {
                                setTipNote(e.target.value);
                              }
                            }}
                            placeholder="Add a note..."
                            className="tsw-note-input"
                            rows="3"
                            maxLength={200}
                          />
                          <div className="tsw-note-hint">{tipNote.length}/200 characters</div>
                        </div>
                      </>
                    )}

                    {tipError && <div className="tsw-error">{tipError}</div>}

                    <div className="tsw-modal-footer">
                      <button
                        className="tsw-btn tsw-btn-secondary"
                        onClick={() => {
                          setShowSendModal(false);
                          setSearchInput("");
                          setRestaurantSearchInput("");
                          setShowRestaurantSuggestions(false);
                          setSearchedStaff(null);
                          setSelectedStaff([]);
                          setSelectedRestaurant(null);
                          setSelectedDepartment(null);
                          setFohExpanded(false);
                          setBohExpanded(false);
                          setTipAmount("");
                          setTipNote("");
                          setTipError("");
                        }}
                        disabled={sendingTip}
                      >
                        Cancel
                      </button>
                      <button
                        className="tsw-btn tsw-btn-primary"
                        onClick={handleSendTip}
                        disabled={sendingTip || (selectedStaff.length === 0 && !searchedStaff) || !tipAmount || parseFloat(tipAmount) <= 0}
                      >
                        {sendingTip ? "Sending..." : `Send Tip${selectedStaff.length > 0 ? ` to ${selectedStaff.length}` : ''}`}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}