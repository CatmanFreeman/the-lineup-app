// src/pages/TipshareWallet/TipshareWallet.jsx

import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { Link } from "react-router-dom";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../hooks/services/firebase";
import { createTipShareTransaction, requestWithdrawal } from "../../utils/tipshareService";
import { createJordanBlakeHandle } from "../../utils/createTipShareHandle";
import "./TipshareWallet.css";

export default function TipshareWallet() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [dateFilter, setDateFilter] = useState("");
  const [transactionTypeFilter, setTransactionTypeFilter] = useState("all"); // "all", "sent", "received"
  
  // Test mode: allow forcing a view
  const [forceView, setForceView] = useState(null); // "diner" | "employee" | null
  
  // Employee/Server state
  const [isEmployee, setIsEmployee] = useState(false);
  const [employeeIds, setEmployeeIds] = useState(new Set());
  const [balance, setBalance] = useState(0);
  const [lastDeposit, setLastDeposit] = useState(null);
  const [lastWithdrawal, setLastWithdrawal] = useState(null);
  const [nextPaymentDue, setNextPaymentDue] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawalError, setWithdrawalError] = useState("");
  const [withdrawalSuccess, setWithdrawalSuccess] = useState(false);
  
  // Tip sending state
  const [handleInput, setHandleInput] = useState("");
  const [restaurantSearchInput, setRestaurantSearchInput] = useState("");
  const [restaurantSuggestions, setRestaurantSuggestions] = useState([]);
  const [showRestaurantSuggestions, setShowRestaurantSuggestions] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [restaurantStaff, setRestaurantStaff] = useState([]);
  const [fohExpanded, setFohExpanded] = useState(true);
  const [bohExpanded, setBohExpanded] = useState(true);
  const [searchedStaff, setSearchedStaff] = useState(null);
  const [tipAmount, setTipAmount] = useState("");
  const [tipNote, setTipNote] = useState("");
  const [sendingTip, setSendingTip] = useState(false);
  const [tipError, setTipError] = useState("");
  const [tipSuccess, setTipSuccess] = useState(false);
  
  // Thank you message state
  const [showThankYouModal, setShowThankYouModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [thankYouMessage, setThankYouMessage] = useState("");
  const [sendingThankYou, setSendingThankYou] = useState(false);

  // Check if user is an employee and load balance info
  useEffect(() => {
    async function checkEmployeeStatus() {
      if (!currentUser) {
        setIsEmployee(false);
        return;
      }

      try {
        const restaurantsRef = collection(db, "restaurants");
        const restaurantsSnap = await getDocs(restaurantsRef);
        const foundEmployeeIds = new Set();
        
        for (const restaurantDoc of restaurantsSnap.docs) {
          const restaurantId = restaurantDoc.id;
          const staffRef = collection(db, "restaurants", restaurantId, "staff");
          const staffSnap = await getDocs(staffRef);
          
          staffSnap.docs.forEach(staffDoc => {
            const staffData = staffDoc.data();
            const staffId = staffDoc.id;
            const staffUid = staffData.uid || staffId;
            
            if (staffUid === currentUser.uid || staffId === currentUser.uid) {
              foundEmployeeIds.add(staffId);
              foundEmployeeIds.add(staffUid);
            }
          });
        }

        if (foundEmployeeIds.size > 0) {
          setIsEmployee(true);
          setEmployeeIds(foundEmployeeIds);
          // Load balance for the first employee ID found
          await loadBalanceInfo(Array.from(foundEmployeeIds)[0]);
        } else {
          setIsEmployee(false);
        }
      } catch (error) {
        console.error("Error checking employee status:", error);
      }
    }

    checkEmployeeStatus();
  }, [currentUser]);

  // Handle withdrawal
  const handleWithdrawal = async (type) => {
    if (!currentUser || balance <= 0) {
      setWithdrawalError("No balance available to withdraw");
      return;
    }

    setWithdrawing(true);
    setWithdrawalError("");
    setWithdrawalSuccess(false);

    try {
      const employeeId = Array.from(employeeIds)[0];
      if (!employeeId) {
        throw new Error("Employee ID not found");
      }

      // Get restaurant ID
      let restaurantId = null;
      try {
        const restaurantsRef = collection(db, "restaurants");
        const restaurantsSnap = await getDocs(restaurantsRef);
        
        for (const restaurantDoc of restaurantsSnap.docs) {
          const staffRef = collection(db, "restaurants", restaurantDoc.id, "staff");
          const staffSnap = await getDocs(staffRef);
          
          for (const staffDoc of staffSnap.docs) {
            const staffData = staffDoc.data();
            const staffId = staffDoc.id;
            const staffUid = staffData.uid || staffId;
            
            if (staffUid === employeeId || staffId === employeeId) {
              restaurantId = restaurantDoc.id;
              break;
            }
          }
          if (restaurantId) break;
        }
      } catch (err) {
        console.error("Error finding restaurant:", err);
      }

      await requestWithdrawal({
        employeeId: employeeId,
        amount: balance,
        type: type, // "instant" or "free"
        restaurantId: restaurantId,
      });

      setWithdrawalSuccess(true);
      
      // Reload balance after withdrawal
      setTimeout(async () => {
        await loadBalanceInfo(employeeId);
        setWithdrawalSuccess(false);
      }, 2000);
    } catch (error) {
      console.error("Error initiating withdrawal:", error);
      setWithdrawalError(error.message || "Failed to initiate withdrawal. Please try again.");
    } finally {
      setWithdrawing(false);
    }
  };

  // Load balance information for employee
  const loadBalanceInfo = async (employeeId) => {
    setLoadingBalance(true);
    try {
      // Get balance
      const balanceRef = doc(db, "users", employeeId, "tipshare", "balance");
      const balanceSnap = await getDoc(balanceRef);
      
      if (balanceSnap.exists()) {
        const balanceData = balanceSnap.data();
        setBalance(balanceData.total || 0);
      } else {
        setBalance(0);
      }

      // Get last deposit (from transactions where employee received tips)
      const transactionsRef = collection(db, "tipshare_transactions");
      try {
        const depositsQuery = query(
          transactionsRef,
          where("employeeId", "==", employeeId),
          orderBy("createdAt", "desc"),
          limit(100)
        );
        const depositsSnap = await getDocs(depositsQuery);
        if (!depositsSnap.empty) {
          // Find the most recent received tip (not a withdrawal)
          const deposits = depositsSnap.docs
            .map(d => d.data())
            .filter(tx => tx.type !== "withdrawal" && tx.amount > 0)
            .sort((a, b) => {
              const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
              const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
              return bTime - aTime;
            });
          
          if (deposits.length > 0) {
            const lastDepositData = deposits[0];
            setLastDeposit({
              amount: lastDepositData.amount || 0,
              date: lastDepositData.createdAt?.toDate ? lastDepositData.createdAt.toDate() : (lastDepositData.createdAt ? new Date(lastDepositData.createdAt) : null),
            });
          } else {
            setLastDeposit(null);
          }
        } else {
          setLastDeposit(null);
        }
      } catch (err) {
        console.error("Error loading last deposit:", err);
        setLastDeposit(null);
      }

      // Get last withdrawal
      const withdrawalsRef = collection(db, "tipshare_withdrawals");
      try {
        const withdrawalsQuery = query(
          withdrawalsRef,
          where("employeeId", "==", employeeId),
          orderBy("completedAt", "desc"),
          limit(1)
        );
        const withdrawalsSnap = await getDocs(withdrawalsQuery);
        if (!withdrawalsSnap.empty) {
          const withdrawalData = withdrawalsSnap.docs[0].data();
          setLastWithdrawal({
            amount: withdrawalData.netAmount || withdrawalData.amount || 0,
            date: withdrawalData.completedAt?.toDate ? withdrawalData.completedAt.toDate() : (withdrawalData.completedAt ? new Date(withdrawalData.completedAt) : null),
          });
        } else {
          setLastWithdrawal(null);
        }
      } catch (err) {
        // If query fails (no index), try without orderBy
        try {
          const allWithdrawalsSnap = await getDocs(
            query(withdrawalsRef, where("employeeId", "==", employeeId))
          );
          if (!allWithdrawalsSnap.empty) {
            const withdrawals = allWithdrawalsSnap.docs.map(d => ({
              ...d.data(),
              completedAt: d.data().completedAt?.toDate ? d.data().completedAt.toDate() : (d.data().completedAt ? new Date(d.data().completedAt) : null),
            })).filter(w => w.completedAt).sort((a, b) => b.completedAt - a.completedAt);
            
            if (withdrawals.length > 0) {
              setLastWithdrawal({
                amount: withdrawals[0].netAmount || withdrawals[0].amount || 0,
                date: withdrawals[0].completedAt,
              });
            } else {
              setLastWithdrawal(null);
            }
          } else {
            setLastWithdrawal(null);
          }
        } catch (fallbackErr) {
          console.error("Error loading last withdrawal:", fallbackErr);
          setLastWithdrawal(null);
        }
      }

      // Calculate next payment due (mock: 7 days from now or from last deposit)
      const nextDueDate = new Date();
      const deposit = lastDeposit;
      if (deposit?.date) {
        nextDueDate.setTime(deposit.date.getTime() + 7 * 24 * 60 * 60 * 1000);
      } else {
        nextDueDate.setDate(nextDueDate.getDate() + 7);
      }
      setNextPaymentDue(nextDueDate);
    } catch (error) {
      console.error("Error loading balance info:", error);
    } finally {
      setLoadingBalance(false);
    }
  };

  // Load user's transactions (both sent and received)
  useEffect(() => {
    async function loadTransactions() {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const transactionsRef = collection(db, "tipshare_transactions");
        
        // Get sent tips (where user is the diner)
        const sentQuery = query(
          transactionsRef,
          where("dinerId", "==", currentUser.uid),
          orderBy("createdAt", "desc"),
          limit(100)
        );

        // Get received tips (where user is the employee)
        // First, we need to find all restaurants where user might be staff
        const restaurantsRef = collection(db, "restaurants");
        const restaurantsSnap = await getDocs(restaurantsRef);
        const employeeIds = new Set();
        
        for (const restaurantDoc of restaurantsSnap.docs) {
          const restaurantId = restaurantDoc.id;
          const staffRef = collection(db, "restaurants", restaurantId, "staff");
          const staffSnap = await getDocs(staffRef);
          
          staffSnap.docs.forEach(staffDoc => {
            const staffData = staffDoc.data();
            const staffId = staffDoc.id;
            const staffUid = staffData.uid || staffId;
            
            if (staffUid === currentUser.uid || staffId === currentUser.uid) {
              employeeIds.add(staffId);
              employeeIds.add(staffUid);
            }
          });
        }

        const allTransactions = [];

        // Get sent tips
        try {
          const sentSnap = await getDocs(sentQuery);
          sentSnap.docs.forEach(doc => {
            allTransactions.push({
              id: doc.id,
              ...doc.data(),
              type: "sent",
            });
          });
        } catch (err) {
          console.error("Error loading sent tips:", err);
        }

        // Get received tips
        if (employeeIds.size > 0) {
          try {
            const receivedQuery = query(
              transactionsRef,
              where("employeeId", "in", Array.from(employeeIds)),
              orderBy("createdAt", "desc"),
              limit(100)
            );
            const receivedSnap = await getDocs(receivedQuery);
            receivedSnap.docs.forEach(doc => {
              allTransactions.push({
                id: doc.id,
                ...doc.data(),
                type: "received",
              });
            });
          } catch (err) {
            // Fallback: query each employee ID separately
            for (const empId of employeeIds) {
              try {
                const receivedQuery = query(
                  transactionsRef,
                  where("employeeId", "==", empId),
                  limit(50)
                );
                const receivedSnap = await getDocs(receivedQuery);
                receivedSnap.docs.forEach(doc => {
                  const data = doc.data();
                  // Avoid duplicates
                  if (!allTransactions.find(t => t.id === doc.id)) {
                    allTransactions.push({
                      id: doc.id,
                      ...data,
                      type: "received",
                    });
                  }
                });
              } catch (e) {
                console.error(`Error loading tips for employee ${empId}:`, e);
              }
            }
          }
        }

        // Sort by date
        allTransactions.sort((a, b) => {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return bTime - aTime;
        });

        setTransactions(allTransactions);
        setFilteredTransactions(allTransactions);
      } catch (error) {
        console.error("Error loading transactions:", error);
      } finally {
        setLoading(false);
      }
    }

    loadTransactions();
  }, [currentUser]);

  // Filter transactions by date and type
  useEffect(() => {
    let filtered = transactions;

    // Filter by type (for employees)
    if (isEmployee && transactionTypeFilter !== "all") {
      filtered = filtered.filter((tx) => {
        if (transactionTypeFilter === "sent") {
          return tx.type === "sent";
        } else if (transactionTypeFilter === "received") {
          return tx.type === "received";
        }
        return true;
      });
    } else if (!isEmployee) {
      // Diners only see sent transactions
      filtered = filtered.filter((tx) => tx.type === "sent");
    }

    // Filter by date
    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      filterDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(filterDate);
      nextDay.setDate(filterDate.getDate() + 1);

      filtered = filtered.filter((tx) => {
        const txDate = tx.createdAt?.toDate
          ? tx.createdAt.toDate()
          : tx.createdAt
          ? new Date(tx.createdAt)
          : null;
        
        if (!txDate) return false;
        
        return txDate >= filterDate && txDate < nextDay;
      });
    }

    setFilteredTransactions(filtered);
  }, [dateFilter, transactions, transactionTypeFilter, isEmployee]);

  // Load restaurants for search
  const [restaurants, setRestaurants] = useState([]);
  useEffect(() => {
    async function loadRestaurants() {
      try {
        const restaurantsRef = collection(db, "restaurants");
        const snap = await getDocs(restaurantsRef);
        const restaurantsList = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || d.id,
          ...d.data(),
        }));
        setRestaurants(restaurantsList);
      } catch (error) {
        console.error("Error loading restaurants:", error);
      }
    }
    loadRestaurants();
  }, []);

  // Filter restaurant suggestions as user types
  useEffect(() => {
    if (!restaurantSearchInput.trim()) {
      setRestaurantSuggestions([]);
      setShowRestaurantSuggestions(false);
      setSelectedRestaurant(null);
      setRestaurantStaff([]);
      return;
    }

    const searchTerm = restaurantSearchInput.toLowerCase();
    const filtered = restaurants
      .filter((r) => r.name.toLowerCase().includes(searchTerm))
      .slice(0, 10);
    
    setRestaurantSuggestions(filtered);
    setShowRestaurantSuggestions(filtered.length > 0);
  }, [restaurantSearchInput, restaurants]);

  // Load staff for selected restaurant
  useEffect(() => {
    async function loadRestaurantStaff() {
      if (!selectedRestaurant) {
        setRestaurantStaff([]);
        return;
      }

      try {
        const staffRef = collection(db, "restaurants", selectedRestaurant.id, "staff");
        const staffSnap = await getDocs(staffRef);
        const staffList = staffSnap.docs.map((d) => ({
          id: d.id,
          uid: d.data().uid || d.id,
          restaurantId: selectedRestaurant.id,
          restaurantName: selectedRestaurant.name,
          name: d.data().name || "Unknown",
          role: d.data().role || "Staff",
          subRole: d.data().subRole || "",
          imageURL: d.data().imageURL || null,
          tipShareHandle: d.data().tipShareHandle || null,
        }));
        setRestaurantStaff(staffList);
      } catch (error) {
        console.error("Error loading restaurant staff:", error);
        setRestaurantStaff([]);
      }
    }

    loadRestaurantStaff();
  }, [selectedRestaurant]);

  // Search staff by TipShare handle
  const searchByHandle = async (handle) => {
    if (!handle.trim()) {
      setSearchedStaff(null);
      setTipError("");
      return;
    }

    // Validate handle format: must be $something$ (dollar sign on both sides)
    const trimmedHandle = handle.trim();
    const hasLeadingDollar = trimmedHandle.startsWith("$");
    const hasTrailingDollar = trimmedHandle.endsWith("$");
    
    if (!hasLeadingDollar || !hasTrailingDollar) {
      setTipError("Handle must be in format: $handle$ (dollar sign on both sides)");
      setSearchedStaff(null);
      return;
    }

    // Extract the middle part (remove $ from both sides)
    const middlePart = trimmedHandle.slice(1, -1).trim();
    if (!middlePart) {
      setTipError("Handle cannot be empty. Format: $handle$");
      setSearchedStaff(null);
      return;
    }

    // Clean handle: normalize the middle part
    const cleanHandle = middlePart.toLowerCase();

    try {
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
              imageURL: staffData.imageURL || null,
              tipShareHandle: staffHandle,
            });
            setTipError("");
            return;
          }
        }
      }
      
      // Not found
      setSearchedStaff(null);
      setTipError("No staff member found with that handle");
    } catch (error) {
      console.error("Error searching by handle:", error);
      setTipError("Error searching for handle");
    }
  };

  // Send tip
  const handleSendTip = async () => {
    if (!currentUser) {
      setTipError("Please sign in to send tips");
      return;
    }

    if (!searchedStaff) {
      setTipError("Please search for a staff member first");
      return;
    }

    const amount = parseFloat(tipAmount);
    if (!amount || amount <= 0) {
      setTipError("Please enter a valid tip amount");
      return;
    }

    if (amount > 1000) {
      setTipError("Maximum tip amount is $1,000");
      return;
    }

    if (tipNote.length > 200) {
      setTipError("Note must be 200 characters or less");
      return;
    }

    setSendingTip(true);
    setTipError("");

    try {
      await createTipShareTransaction({
        dinerId: currentUser.uid,
        employeeId: searchedStaff.uid || searchedStaff.id,
        restaurantId: searchedStaff.restaurantId,
        amount: amount,
        source: "wallet",
        sourceId: null,
        note: tipNote.trim() || null,
        dinerName: currentUser.displayName || currentUser.email,
        employeeName: searchedStaff.name,
      });

      setTipSuccess(true);
      setHandleInput("");
      setSearchedStaff(null);
      setTipAmount("");
      setTipNote("");
      
      // Reload transactions
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error("Error sending tip:", error);
      setTipError(error.message || "Failed to send tip. Please try again.");
    } finally {
      setSendingTip(false);
    }
  };

  // Generate AI response suggestions (for responding to diner messages)
  const generateResponseSuggestions = (dinerMessage) => {
    if (!dinerMessage) {
      // If no diner message, show thank you suggestions
      return [
      "Thank you so much! I really appreciate it! 🙏",
      "You're amazing! Thanks for the tip! 💙",
      "Thank you! This means a lot to me! ✨",
    ];
    }
    // AI-generated responses based on diner's message
    return [
      `Thank you so much for your kind words! I'm so glad you enjoyed your experience. 🙏`,
      `I really appreciate your support and the thoughtful message! It means the world to me. 💙`,
      `Thank you for the tip and your kind words! I'm thrilled you had a great time. ✨`,
    ];
  };

  // Send thank you message
  const handleSendThankYou = async (suggestion = null) => {
    if (!currentUser || !selectedTransaction) return;

    const message = suggestion || thankYouMessage.trim();
    if (!message) {
      setTipError("Please enter a thank you message");
      return;
    }

    if (message.length > 200) {
      setTipError("Message must be 200 characters or less");
      return;
    }

    setSendingThankYou(true);
    setTipError("");

    try {
      // Update transaction with thank you message
      const transactionRef = doc(db, "tipshare_transactions", selectedTransaction.id);
      await updateDoc(transactionRef, {
        thankYouMessage: message,
        thankYouSentAt: serverTimestamp(),
      });

      // Update local state
      setTransactions(prev => prev.map(tx => 
        tx.id === selectedTransaction.id 
          ? { ...tx, thankYouMessage: message, thankYouSentAt: new Date() }
          : tx
      ));

      setShowThankYouModal(false);
      setSelectedTransaction(null);
      setThankYouMessage("");
    } catch (error) {
      console.error("Error sending thank you:", error);
      setTipError("Failed to send thank you message");
    } finally {
      setSendingThankYou(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="tipshare-wallet-page">
        <div className="tipshare-wallet-container">
          <div className="tipshare-wallet-header">
            <div className="tipshare-wallet-logo">
              TIP<span className="tipshare-dollar">$</span>HARE
            </div>
          </div>
          <div className="empty-state">
            <p>Please sign in to view your TipShare Wallet.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tipshare-wallet-page">
      <div className="tipshare-wallet-container">
        {/* Back Link - Top Right */}
        <Link to="/" className="tipshare-back-link-top">← Back</Link>
        
        {/* Header with Logo - Centered */}
        <div className="tipshare-wallet-header">
          <div className="tipshare-wallet-logo">
            TIP<span className="tipshare-dollar">$</span>HARE
          </div>
          
          {/* Test mode toggle - only show in development */}
          {process.env.NODE_ENV === "development" && (
            <div className="tipshare-view-toggle-buttons">
              <button
                onClick={() => setForceView(forceView === "diner" ? null : "diner")}
                className={`tipshare-view-toggle-btn ${forceView === "diner" ? "active" : ""}`}
              >
                View Diner
              </button>
              <button
                onClick={() => setForceView(forceView === "employee" ? null : "employee")}
                className={`tipshare-view-toggle-btn ${forceView === "employee" ? "active" : ""}`}
              >
                View Employee
              </button>
            </div>
          )}
        </div>

        {/* DINER LAYOUT: Send Tip first, then Transaction Log */}
        {((!isEmployee && !forceView) || forceView === "diner") && (
          <>
            {/* Send Tip Module - FIRST for diners */}
        <div className="tipshare-send-section">
              <h2 className="section-title">Send a Tip to a Staff Member</h2>
              {/* Temporary: Create handle for testing */}
              {process.env.NODE_ENV === "development" && (
                <button
                  onClick={async () => {
                    try {
                      await createJordanBlakeHandle();
                      alert("Jordan Blake handle created! Try searching for: $jordanblake$");
                    } catch (error) {
                      console.error("Error creating handle:", error);
                      alert("Error creating handle. Check console.");
                    }
                  }}
                  style={{
                    marginBottom: "16px",
                    padding: "8px 16px",
                    background: "#4da3ff",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "12px"
                  }}
                >
                  Create Test Handle ($jordanblake$)
                </button>
              )}
          <div className="tipshare-send-form">
            <div className="form-group">
              <label>Enter TipShare Handle</label>
              <input
                type="text"
                value={handleInput}
                onChange={(e) => {
                  setHandleInput(e.target.value);
                  setTipError("");
                      if (e.target.value.trim()) {
                        setRestaurantSearchInput("");
                        setSelectedRestaurant(null);
                        setRestaurantStaff([]);
                      }
                }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                  if (handleInput.trim()) {
                    searchByHandle(handleInput);
                        }
                  }
                }}
                    placeholder="$handle$"
                className="handle-input"
              />
                  <div className="handle-hint">Format: $yourhandle$ (dollar sign on both sides)</div>
            </div>

                <div className="form-group">
                  <label>Or Search by Restaurant</label>
                  <div className="restaurant-autocomplete-wrapper">
                    <input
                      type="text"
                      value={restaurantSearchInput}
                      onChange={(e) => {
                        setRestaurantSearchInput(e.target.value);
                        if (!e.target.value) {
                          setSelectedRestaurant(null);
                          setRestaurantStaff([]);
                        }
                        setHandleInput("");
                        setSearchedStaff(null);
                      }}
                      onFocus={() => {
                        if (restaurantSuggestions.length > 0) {
                          setShowRestaurantSuggestions(true);
                        }
                      }}
                      onBlur={() => {
                        setTimeout(() => setShowRestaurantSuggestions(false), 200);
                      }}
                      placeholder="Start typing restaurant name..."
                      className="restaurant-search-input"
                    />
                    {showRestaurantSuggestions && restaurantSuggestions.length > 0 && (
                      <div className="restaurant-suggestions-dropdown">
                        {restaurantSuggestions.map((restaurant) => (
                          <div
                            key={restaurant.id}
                            className="restaurant-suggestion-item"
                            onClick={() => {
                              setRestaurantSearchInput(restaurant.name);
                              setSelectedRestaurant(restaurant);
                              setShowRestaurantSuggestions(false);
                              setSearchedStaff(null);
                            }}
                          >
                            {restaurant.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Staff list with accordions - same as employee version */}
                {selectedRestaurant && restaurantStaff.length > 0 && (() => {
                  const fohStaff = restaurantStaff.filter(s => 
                    s.role === "Front of House" || 
                    (s.role && s.role.toLowerCase().includes("front"))
                  );
                  const bohStaff = restaurantStaff.filter(s => 
                    s.role === "Back of House" || 
                    (s.role && s.role.toLowerCase().includes("back"))
                  );
                  
                  return (
                    <div className="restaurant-staff-list">
                      <div className="staff-list-header">Staff at {selectedRestaurant.name}</div>
                      
                      {fohStaff.length > 0 && (
                        <div className="staff-accordion">
                          <button
                            className="staff-accordion-header"
                            onClick={() => setFohExpanded(!fohExpanded)}
                          >
                            <span className="accordion-title">Front of House</span>
                            <span className="accordion-icon">{fohExpanded ? "−" : "+"}</span>
                          </button>
                          {fohExpanded && (
                            <div className="staff-list-grid">
                              {fohStaff.map((staff) => (
                                <div
                                  key={staff.id}
                                  className={`staff-list-item ${searchedStaff?.id === staff.id ? "selected" : ""}`}
                                  onClick={() => {
                                    setSearchedStaff(staff);
                                    setTipError("");
                                  }}
                                >
                                  {staff.imageURL ? (
                                    <img src={staff.imageURL} alt={staff.name} className="staff-list-avatar" />
                                  ) : (
                                    <div className="staff-list-avatar-placeholder">
                                      {staff.name.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  <div className="staff-list-info">
                                    <div className="staff-list-name">{staff.name}</div>
                                    <div className="staff-list-role">{staff.subRole || staff.role}</div>
                                    {staff.tipShareHandle && (
                                      <div className="staff-list-handle">{staff.tipShareHandle}</div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {bohStaff.length > 0 && (
                        <div className="staff-accordion">
                          <button
                            className="staff-accordion-header"
                            onClick={() => setBohExpanded(!bohExpanded)}
                          >
                            <span className="accordion-title">Back of House</span>
                            <span className="accordion-icon">{bohExpanded ? "−" : "+"}</span>
                          </button>
                          {bohExpanded && (
                            <div className="staff-list-grid">
                              {bohStaff.map((staff) => (
                                <div
                                  key={staff.id}
                                  className={`staff-list-item ${searchedStaff?.id === staff.id ? "selected" : ""}`}
                                  onClick={() => {
                                    setSearchedStaff(staff);
                                    setTipError("");
                                  }}
                                >
                                  {staff.imageURL ? (
                                    <img src={staff.imageURL} alt={staff.name} className="staff-list-avatar" />
                                  ) : (
                                    <div className="staff-list-avatar-placeholder">
                                      {staff.name.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  <div className="staff-list-info">
                                    <div className="staff-list-name">{staff.name}</div>
                                    <div className="staff-list-role">{staff.subRole || staff.role}</div>
                                    {staff.tipShareHandle && (
                                      <div className="staff-list-handle">{staff.tipShareHandle}</div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {selectedRestaurant && restaurantStaff.length === 0 && (
                  <div className="empty-state" style={{ padding: "20px", textAlign: "center" }}>
                    No staff members found at {selectedRestaurant.name}
                  </div>
                )}

            {searchedStaff && (
              <div className="searched-staff-card">
                <div className="staff-card-photo">
                  {searchedStaff.imageURL ? (
                    <img src={searchedStaff.imageURL} alt={searchedStaff.name} />
                  ) : (
                    <div className="staff-card-photo-placeholder">
                      {searchedStaff.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="staff-card-info">
                  <div className="staff-card-name">{searchedStaff.name}</div>
                  <div className="staff-card-position">{searchedStaff.subRole || searchedStaff.role}</div>
                  <div className="staff-card-restaurant">{searchedStaff.restaurantName}</div>
                </div>
              </div>
            )}

            {searchedStaff && (
              <>
                <div className="form-group">
                  <label>Tip Amount ($)</label>
                  <input
                    type="number"
                    min="0.01"
                    max="1000"
                    step="0.01"
                    value={tipAmount}
                    onChange={(e) => setTipAmount(e.target.value)}
                    placeholder="0.00"
                    className="amount-input"
                  />
                </div>

                <div className="form-group">
                  <label>Note (Optional, max 200 characters)</label>
                  <textarea
                    value={tipNote}
                    onChange={(e) => setTipNote(e.target.value)}
                    placeholder="Add a note..."
                    maxLength={200}
                    rows={3}
                    className="note-input"
                  />
                  <div className="char-count">{tipNote.length}/200</div>
                </div>

                {tipError && <div className="error-message">{tipError}</div>}
                {tipSuccess && (
                  <div className="success-message">
                    Tip sent successfully! Refreshing transactions...
                  </div>
                )}

                <button
                  className="send-tip-btn"
                  onClick={handleSendTip}
                  disabled={sendingTip || !tipAmount || parseFloat(tipAmount) <= 0}
                >
                  {sendingTip ? "Sending..." : "Send Tip"}
                </button>
              </>
            )}
          </div>
        </div>

            {/* Transaction Log - SECOND for diners */}
        <div className="tipshare-transactions-section">
          <div className="transactions-header">
          <h2 className="section-title">Transaction Log</h2>
            <div className="date-filter-group">
              <label htmlFor="date-filter">Filter by Date:</label>
              <input
                id="date-filter"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="date-filter-input"
              />
              {dateFilter && (
                <button
                  className="clear-date-filter-btn"
                  onClick={() => setDateFilter("")}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          {loading ? (
            <div className="empty-state">Loading transactions...</div>
          ) : filteredTransactions.length === 0 ? (
            <div className="empty-state">
              {dateFilter ? "No transactions found for selected date." : "No transactions yet. Send your first tip!"}
            </div>
          ) : (
            <div className="transactions-list">
              {filteredTransactions.map((tx) => {
                const date = tx.createdAt?.toDate
                  ? tx.createdAt.toDate()
                  : tx.createdAt
                  ? new Date(tx.createdAt)
                  : null;
                const isSent = tx.type === "sent";
                const hasThankYou = tx.thankYouMessage;

                return (
                  <div key={tx.id} className="transaction-item">
                    <div className="transaction-main">
                      <div className="transaction-info">
                        <div className="transaction-type">
                          {isSent ? (
                            <>
                              Sent to <span className="highlight">{tx.employeeName || "Staff"}</span>
                            </>
                          ) : (
                            <>
                              Received from <span className="highlight">{tx.dinerName || "Guest"}</span>
                            </>
                          )}
                        </div>
                        {tx.note && (
                          <div className="transaction-note">"{tx.note}"</div>
                        )}
                        {date && (
                          <div className="transaction-date">
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
                        {!isSent && hasThankYou && (
                          <div className="thank-you-badge">✓ Thank you sent</div>
                        )}
                      </div>
                      <div className={`transaction-amount ${isSent ? "amount-negative" : "amount-positive"}`}>
                        {isSent ? "-" : "+"}${Math.abs(tx.amount || 0).toFixed(2)}
                      </div>
                    </div>
                    {!isSent && !hasThankYou && (
                      <button
                        className="thank-you-btn"
                        onClick={() => {
                          setSelectedTransaction(tx);
                          setShowThankYouModal(true);
                        }}
                      >
                        Send Thank You
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

          </>
        )}

        {/* EMPLOYEE LAYOUT: Balance first, then Transaction Log, then Send Tip */}
        {(isEmployee || forceView === "employee") && (
          <>
            {/* Balance Section - FIRST for employees */}
            <div className="tipshare-balance-section">
              <h2 className="section-title">Your TIP<span className="tipshare-dollar">$</span>HARE Account</h2>
              {loadingBalance ? (
                <div className="balance-loading">Loading balance...</div>
              ) : (
                <>
                  <div className="balance-current-card">
                    <div className="balance-label">Current Balance</div>
                    <div className="balance-amount">${balance.toFixed(2)}</div>
                  </div>
                  
                  <div className="balance-deposit-withdrawal-grid">
                    <div className="balance-card">
                      <div className="balance-label">Last Deposit</div>
                      {lastDeposit ? (
                        <>
                          <div className="balance-date">
                            {lastDeposit.date.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </div>
                          <div className="balance-amount-small">${lastDeposit.amount.toFixed(2)}</div>
                        </>
                      ) : (
                        <div className="balance-empty">No deposits yet</div>
                      )}
                    </div>
                    <div className="balance-card">
                      <div className="balance-label">Last Withdrawal</div>
                      {lastWithdrawal ? (
                        <>
                          <div className="balance-date">
                            {lastWithdrawal.date.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </div>
                          <div className="balance-amount-small">${lastWithdrawal.amount.toFixed(2)}</div>
                        </>
                      ) : (
                        <div className="balance-empty">No withdrawals yet</div>
                      )}
                    </div>
                  </div>
                  
                  {/* Next Payment Due - Full Width */}
                  <div className="balance-card balance-card-full-width">
                    <div className="balance-label">Next Payment Due</div>
                    <div className="balance-value">
                      {nextPaymentDue ? (
                        <div className="balance-date">
                          {nextPaymentDue.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                      ) : (
                        <div className="balance-empty">Not scheduled</div>
                      )}
                    </div>
                  </div>
                  
                  {/* Withdrawal Section */}
                  <div className="withdrawal-section">
                    <div className="withdrawal-label">Withdrawal</div>
                    <div className="withdrawal-buttons-container">
                      <button
                        className="withdrawal-btn withdrawal-btn-instant"
                        onClick={async () => {
                          if (balance <= 0) {
                            setWithdrawalError("No balance available to withdraw");
                            return;
                          }
                          
                          const fee = balance * 0.02;
                          const netAmount = balance - fee;
                          
                          if (!window.confirm(`Instant Withdrawal\n\nAmount: $${balance.toFixed(2)}\nFee (2%): $${fee.toFixed(2)}\nYou'll receive: $${netAmount.toFixed(2)}\n\nProceed with instant withdrawal?`)) {
                            return;
                          }
                          
                          await handleWithdrawal("instant");
                        }}
                        disabled={withdrawing || balance <= 0}
                      >
                        <div className="withdrawal-btn-title">Instant</div>
                        <div className="withdrawal-btn-fee">2% Fee</div>
                      </button>
                      <button
                        className="withdrawal-btn withdrawal-btn-free"
                        onClick={async () => {
                          if (balance <= 0) {
                            setWithdrawalError("No balance available to withdraw");
                            return;
                          }
                          
                          if (!window.confirm(`Free Withdrawal (1-3 days)\n\nAmount: $${balance.toFixed(2)}\nFee: $0.00\nYou'll receive: $${balance.toFixed(2)}\n\nProceed with free withdrawal?`)) {
                            return;
                          }
                          
                          await handleWithdrawal("free");
                        }}
                        disabled={withdrawing || balance <= 0}
                      >
                        <div className="withdrawal-btn-title">Free</div>
                        <div className="withdrawal-btn-fee">1-3 Days</div>
                      </button>
                    </div>
                  </div>
                  
                  {withdrawalError && (
                    <div className="withdrawal-error">{withdrawalError}</div>
                  )}
                  {withdrawalSuccess && (
                    <div className="withdrawal-success">Withdrawal initiated successfully!</div>
                  )}
                </>
              )}
            </div>

            {/* Transaction Log - SECOND for employees */}
            <div className="tipshare-transactions-section">
              <div className="transactions-header">
                <h2 className="section-title">Transaction Log</h2>
                <div className="transactions-filters">
                  {/* Transaction Type Toggle - Only for employees */}
                  <div className="transaction-type-toggle">
                    <button
                      className={`toggle-btn ${transactionTypeFilter === "all" ? "active" : ""}`}
                      onClick={() => setTransactionTypeFilter("all")}
                    >
                      All
                    </button>
                    <button
                      className={`toggle-btn ${transactionTypeFilter === "sent" ? "active" : ""}`}
                      onClick={() => setTransactionTypeFilter("sent")}
                    >
                      Sent
                    </button>
                    <button
                      className={`toggle-btn ${transactionTypeFilter === "received" ? "active" : ""}`}
                      onClick={() => setTransactionTypeFilter("received")}
                    >
                      Received
                    </button>
                  </div>
                  <div className="date-filter-group">
                    <label htmlFor="date-filter-employee">Filter by Date:</label>
                    <input
                      id="date-filter-employee"
                      type="date"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="date-filter-input"
                    />
                    {dateFilter && (
                      <button
                        className="clear-date-filter-btn"
                        onClick={() => setDateFilter("")}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {loading ? (
                <div className="empty-state">Loading transactions...</div>
              ) : filteredTransactions.length === 0 ? (
                <div className="empty-state">
                  {dateFilter ? "No transactions found for selected date." : "No transactions yet."}
                </div>
              ) : (
                <div className="transactions-list">
                  {filteredTransactions.map((tx) => {
                    const date = tx.createdAt?.toDate
                      ? tx.createdAt.toDate()
                      : tx.createdAt
                      ? new Date(tx.createdAt)
                      : null;
                    const isSent = tx.type === "sent";
                    const hasThankYou = tx.thankYouMessage;

                    return (
                      <div key={tx.id} className="transaction-item">
                        <div className="transaction-main">
                          <div className="transaction-info">
                            <div className="transaction-type">
                              {isSent ? (
                                <>
                                  Sent to <span className="highlight">{tx.employeeName || "Staff"}</span>
                                </>
                              ) : (
                                <>
                                  Received from <span className="highlight">{tx.dinerName || "Guest"}</span>
                                </>
                              )}
                            </div>
                            {tx.note && (
                              <div className="transaction-note">"{tx.note}"</div>
                            )}
                            {date && (
                              <div className="transaction-date">
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
                            {!isSent && hasThankYou && (
                              <div className="thank-you-badge">✓ Thank you sent</div>
                            )}
                          </div>
                          <div className={`transaction-amount ${isSent ? "amount-negative" : "amount-positive"}`}>
                            {isSent ? "-" : "+"}${Math.abs(tx.amount || 0).toFixed(2)}
                          </div>
                        </div>
                        {!isSent && !hasThankYou && (
                          <button
                            className="thank-you-btn"
                            onClick={() => {
                              setSelectedTransaction(tx);
                              setShowThankYouModal(true);
                            }}
                          >
                            Send Thank You
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Send Tip Module - THIRD for employees */}
            <div className="tipshare-send-section">
              <h2 className="section-title">Send a Tip to a Staff Member</h2>
          {/* Temporary: Create handle for testing */}
          {process.env.NODE_ENV === "development" && (
            <button
              onClick={async () => {
                try {
                  await createJordanBlakeHandle();
                  alert("Jordan Blake handle created! Try searching for: $jordanblake$");
                } catch (error) {
                  console.error("Error creating handle:", error);
                  alert("Error creating handle. Check console.");
                }
              }}
              style={{
                marginBottom: "16px",
                padding: "8px 16px",
                background: "#4da3ff",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "12px"
              }}
            >
              Create Test Handle ($jordanblake$)
            </button>
          )}
          <div className="tipshare-send-form">
            <div className="form-group">
              <label>Enter TipShare Handle</label>
              <input
                type="text"
                value={handleInput}
                onChange={(e) => {
                  setHandleInput(e.target.value);
                  setTipError("");
                  // Clear restaurant search when typing handle
                  if (e.target.value.trim()) {
                    setRestaurantSearchInput("");
                    setSelectedRestaurant(null);
                    setRestaurantStaff([]);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (handleInput.trim()) {
                      searchByHandle(handleInput);
                    }
                  }
                }}
                placeholder="$handle$"
                className="handle-input"
              />
              <div className="handle-hint">Format: $yourhandle$ (dollar sign on both sides)</div>
            </div>

            <div className="form-group">
              <label>Or Search by Restaurant</label>
              <div className="restaurant-autocomplete-wrapper">
                <input
                  type="text"
                  value={restaurantSearchInput}
                  onChange={(e) => {
                    setRestaurantSearchInput(e.target.value);
                    if (!e.target.value) {
                      setSelectedRestaurant(null);
                      setRestaurantStaff([]);
                    }
                    // Clear handle search when typing restaurant
                    setHandleInput("");
                    setSearchedStaff(null);
                  }}
                  onFocus={() => {
                    if (restaurantSuggestions.length > 0) {
                      setShowRestaurantSuggestions(true);
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowRestaurantSuggestions(false), 200);
                  }}
                  placeholder="Start typing restaurant name..."
                  className="restaurant-search-input"
                />
                {showRestaurantSuggestions && restaurantSuggestions.length > 0 && (
                  <div className="restaurant-suggestions-dropdown">
                    {restaurantSuggestions.map((restaurant) => (
                      <div
                        key={restaurant.id}
                        className="restaurant-suggestion-item"
                        onClick={() => {
                          setRestaurantSearchInput(restaurant.name);
                          setSelectedRestaurant(restaurant);
                          setShowRestaurantSuggestions(false);
                          setSearchedStaff(null);
                        }}
                      >
                        {restaurant.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Show staff list when restaurant is selected */}
            {selectedRestaurant && restaurantStaff.length > 0 && (() => {
              const fohStaff = restaurantStaff.filter(s => 
                s.role === "Front of House" || 
                (s.role && s.role.toLowerCase().includes("front"))
              );
              const bohStaff = restaurantStaff.filter(s => 
                s.role === "Back of House" || 
                (s.role && s.role.toLowerCase().includes("back"))
              );
              
              return (
                <div className="restaurant-staff-list">
                  <div className="staff-list-header">Staff at {selectedRestaurant.name}</div>
                  
                  {/* Front of House Accordion */}
                  {fohStaff.length > 0 && (
                    <div className="staff-accordion">
                      <button
                        className="staff-accordion-header"
                        onClick={() => setFohExpanded(!fohExpanded)}
                      >
                        <span className="accordion-title">Front of House</span>
                        <span className="accordion-icon">{fohExpanded ? "−" : "+"}</span>
                      </button>
                      {fohExpanded && (
                        <div className="staff-list-grid">
                          {fohStaff.map((staff) => (
                            <div
                              key={staff.id}
                              className={`staff-list-item ${searchedStaff?.id === staff.id ? "selected" : ""}`}
                              onClick={() => {
                                setSearchedStaff(staff);
                                setTipError("");
                              }}
                            >
                              {staff.imageURL ? (
                                <img src={staff.imageURL} alt={staff.name} className="staff-list-avatar" />
                              ) : (
                                <div className="staff-list-avatar-placeholder">
                                  {staff.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="staff-list-info">
                                <div className="staff-list-name">{staff.name}</div>
                                <div className="staff-list-role">{staff.subRole || staff.role}</div>
                                {staff.tipShareHandle && (
                                  <div className="staff-list-handle">{staff.tipShareHandle}</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Back of House Accordion */}
                  {bohStaff.length > 0 && (
                    <div className="staff-accordion">
                      <button
                        className="staff-accordion-header"
                        onClick={() => setBohExpanded(!bohExpanded)}
                      >
                        <span className="accordion-title">Back of House</span>
                        <span className="accordion-icon">{bohExpanded ? "−" : "+"}</span>
                      </button>
                      {bohExpanded && (
                        <div className="staff-list-grid">
                          {bohStaff.map((staff) => (
                            <div
                              key={staff.id}
                              className={`staff-list-item ${searchedStaff?.id === staff.id ? "selected" : ""}`}
                              onClick={() => {
                                setSearchedStaff(staff);
                                setTipError("");
                              }}
                            >
                              {staff.imageURL ? (
                                <img src={staff.imageURL} alt={staff.name} className="staff-list-avatar" />
                              ) : (
                                <div className="staff-list-avatar-placeholder">
                                  {staff.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="staff-list-info">
                                <div className="staff-list-name">{staff.name}</div>
                                <div className="staff-list-role">{staff.subRole || staff.role}</div>
                                {staff.tipShareHandle && (
                                  <div className="staff-list-handle">{staff.tipShareHandle}</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {selectedRestaurant && restaurantStaff.length === 0 && (
              <div className="empty-state" style={{ padding: "20px", textAlign: "center" }}>
                No staff members found at {selectedRestaurant.name}
              </div>
            )}

            {searchedStaff && (
              <div className="searched-staff-card">
                <div className="staff-card-photo">
                  {searchedStaff.imageURL ? (
                    <img src={searchedStaff.imageURL} alt={searchedStaff.name} />
                  ) : (
                    <div className="staff-card-photo-placeholder">
                      {searchedStaff.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="staff-card-info">
                  <div className="staff-card-name">{searchedStaff.name}</div>
                  <div className="staff-card-position">{searchedStaff.subRole || searchedStaff.role}</div>
                  <div className="staff-card-restaurant">{searchedStaff.restaurantName}</div>
                </div>
              </div>
            )}

            {searchedStaff && (
              <>
                <div className="form-group">
                  <label>Tip Amount ($)</label>
                  <input
                    type="number"
                    min="0.01"
                    max="1000"
                    step="0.01"
                    value={tipAmount}
                    onChange={(e) => setTipAmount(e.target.value)}
                    placeholder="0.00"
                    className="amount-input"
                  />
                </div>

                <div className="form-group">
                  <label>Note (Optional, max 200 characters)</label>
                  <textarea
                    value={tipNote}
                    onChange={(e) => setTipNote(e.target.value)}
                    placeholder="Add a note..."
                    maxLength={200}
                    rows={3}
                    className="note-input"
                  />
                  <div className="char-count">{tipNote.length}/200</div>
                </div>

                {tipError && <div className="error-message">{tipError}</div>}
                {tipSuccess && (
                  <div className="success-message">
                    Tip sent successfully! Refreshing transactions...
                  </div>
                )}

                <button
                  className="send-tip-btn"
                  onClick={handleSendTip}
                  disabled={sendingTip || !tipAmount || parseFloat(tipAmount) <= 0}
                >
                  {sendingTip ? "Sending..." : "Send Tip"}
                </button>
              </>
            )}
            </div>
          </div>
          </>
        )}

        {/* Thank You Modal (shared for both layouts) */}
        {showThankYouModal && selectedTransaction && (
          <div className="modal-overlay" onClick={() => setShowThankYouModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>
                  {selectedTransaction.note ? "Respond to Message" : "Send Thank You Message"}
                </h3>
                <button className="modal-close" onClick={() => setShowThankYouModal(false)}>
                  ×
                </button>
              </div>
              <div className="modal-body">
                <p className="modal-description">
                  {selectedTransaction.note ? (
                    <>
                      <span className="highlight">{selectedTransaction.dinerName || "Guest"}</span> sent you ${selectedTransaction.amount?.toFixed(2) || "0.00"} with a message.
                    </>
                  ) : (
                    <>
                  Thank <span className="highlight">{selectedTransaction.dinerName || "Guest"}</span> for their tip of ${selectedTransaction.amount?.toFixed(2) || "0.00"}
                    </>
                  )}
                </p>
                
                {selectedTransaction.thankYouMessage ? (
                  <div className="response-sent-notice">
                    ✓ You've already responded to this message.
                    <div className="sent-response-display">
                      Your response: "{selectedTransaction.thankYouMessage}"
                    </div>
                  </div>
                ) : (
                  <>
                    {selectedTransaction.note && (
                      <div className="diner-message-display">
                        <strong>Their message:</strong> "{selectedTransaction.note}"
                      </div>
                    )}
                    <div className="thank-you-suggestions">
                      <p className="suggestions-label">Quick Replies:</p>
                      {generateResponseSuggestions(selectedTransaction.note).map((suggestion, idx) => (
                        <button
                          key={idx}
                          className="suggestion-btn"
                          onClick={() => handleSendThankYou(suggestion)}
                          disabled={sendingThankYou}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>

                    <div className="form-group">
                      <label>Or write your own response (max 200 characters):</label>
                      <textarea
                        value={thankYouMessage}
                        onChange={(e) => setThankYouMessage(e.target.value)}
                        placeholder={selectedTransaction.note ? "Type your response to their message..." : "Type your custom thank you message..."}
                        maxLength={200}
                        rows={3}
                        className="note-input"
                      />
                      <div className="char-count">{thankYouMessage.length}/200</div>
                    </div>

                    {tipError && <div className="error-message">{tipError}</div>}

                    <div className="modal-footer">
                      <button
                        className="btn-secondary"
                        onClick={() => setShowThankYouModal(false)}
                        disabled={sendingThankYou}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn-primary"
                        onClick={() => handleSendThankYou()}
                        disabled={sendingThankYou || !thankYouMessage.trim()}
                      >
                        {sendingThankYou ? "Sending..." : selectedTransaction.note ? "Send Response" : "Send Thank You"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
