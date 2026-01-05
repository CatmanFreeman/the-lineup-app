// src/pages/Dashboards/RestaurantDashboard/pages/ShiftGamesHub.jsx

import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  runTransaction,
  increment,
} from "firebase/firestore";
import { db } from "../../../../hooks/services/firebase";
import "./ShiftGamesHub.css";

const COMPANY_ID = "company-demo";
const WEEKLY_POINT_ALLOCATION = 1000;

// Helper function to get week ending Sunday (ISO format: YYYY-MM-DD)
function getWeekEndingISO(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const daysToSunday = (7 - day) % 7;
  const sunday = new Date(d);
  sunday.setDate(d.getDate() + daysToSunday);
  const yyyy = sunday.getFullYear();
  const mm = String(sunday.getMonth() + 1).padStart(2, "0");
  const dd = String(sunday.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// 20 Pre-made games (10 FOH, 10 BOH) - keeping existing games...
const PREMADE_GAMES = [
  // FOH Games
  {
    id: "foh-alc-push",
    name: "Alcohol Push",
    category: "Sales Mix",
    description: "Increase beer + cocktail attachment during peak hours.",
    howToPlay: "Servers and bartenders work together to increase alcohol sales by 3% during the game period. Track every beer and cocktail sold, with bonus points for featured cocktails and successful upsells.",
    duration: 180,
    teams: ["Servers", "Bartenders"],
    targetRole: "Front of House",
    defaultReward: "75 Lineup Points",
    defaultRewardType: "points",
    defaultRewardValue: 75,
    rules: [
      "Beer + cocktail attachment goal: +3% by end of shift",
      "Double points on featured cocktails",
      "Bartender callouts count as bonus assists",
      "Upsell points count only on check closes",
    ],
    metrics: ["alcoholMix", "attachmentRate"],
  },
  {
    id: "foh-featured-cocktail",
    name: "Featured Cocktail Blast",
    category: "Sales",
    description: "Promote one featured cocktail aggressively for a time block.",
    howToPlay: "The entire FOH team focuses on selling one designated featured cocktail during a specific time window. Every sale counts toward the team goal, with bonus points for creative presentation and customer engagement.",
    duration: 150,
    teams: ["Servers", "Bartenders", "Support"],
    targetRole: "Front of House",
    defaultReward: "50 Lineup Points",
    defaultRewardType: "points",
    defaultRewardValue: 50,
    rules: [
      "Feature one cocktail per shift",
      "Track sales of featured cocktail",
      "Bonus points for upselling featured cocktail",
    ],
    metrics: ["featuredCocktailSales"],
  },
  {
    id: "foh-app-sprint",
    name: "Appetizer Sprint",
    category: "Sales",
    description: "Boost appetizer attachment on first round orders.",
    howToPlay: "Servers focus on suggesting appetizers with every first round of drinks. The goal is to increase appetizer attachment rate by targeting tables during their initial order, with extra points for premium appetizer selections.",
    duration: 120,
    teams: ["Servers"],
    targetRole: "Front of House",
    defaultReward: "Shift Meal",
    defaultRewardType: "meal",
    defaultRewardValue: 0,
    rules: [
      "Track appetizer attachment rate",
      "Focus on first round orders",
      "Bonus for premium appetizer upsells",
    ],
    metrics: ["appetizerAttachment"],
  },
  {
    id: "foh-dessert-push",
    name: "Dessert Push",
    category: "Sales",
    description: "Increase dessert sales and attachment rate.",
    howToPlay: "Servers work to increase dessert sales by presenting the dessert menu at the right moment and highlighting featured desserts. Track dessert attachment rate and total dessert sales, with bonus points for premium dessert selections.",
    duration: 90,
    teams: ["Servers"],
    targetRole: "Front of House",
    defaultReward: "50 Lineup Points",
    defaultRewardType: "points",
    defaultRewardValue: 50,
    rules: [
      "Track dessert attachment rate",
      "Present dessert menu proactively",
      "Bonus for premium dessert upsells",
    ],
    metrics: ["dessertAttachment", "dessertSales"],
  },
  {
    id: "foh-upsell-challenge",
    name: "Upsell Challenge",
    category: "Sales",
    description: "Competitive upsell challenge across all menu categories.",
    howToPlay: "Servers compete to achieve the highest upsell rate across appetizers, entrees, drinks, and desserts. Track individual and team upsell performance, with bonus points for creative suggestions and customer satisfaction.",
    duration: 180,
    teams: ["Servers"],
    targetRole: "Front of House",
    defaultReward: "100 Lineup Points",
    defaultRewardType: "points",
    defaultRewardValue: 100,
    rules: [
      "Track upsell rate across all categories",
      "Individual and team scoring",
      "Bonus for customer satisfaction",
    ],
    metrics: ["upsellRate", "averageCheck"],
  },
  {
    id: "foh-table-turn",
    name: "Table Turn Sprint",
    category: "Efficiency",
    description: "Minimize table turn time while maintaining service quality.",
    howToPlay: "Hosts and support staff work together to minimize the time between when a table is cleared and when it's ready for the next party. Track average turn time and aim to reduce it by 15% while maintaining service quality.",
    duration: 240,
    teams: ["Hosts", "Support"],
    targetRole: "Front of House",
    defaultReward: "75 Lineup Points",
    defaultRewardType: "points",
    defaultRewardValue: 75,
    rules: [
      "Track table turn time",
      "Maintain service quality standards",
      "Team coordination bonus",
    ],
    metrics: ["tableTurnTime", "serviceQuality"],
  },
  {
    id: "foh-guest-satisfaction",
    name: "Guest Satisfaction Blitz",
    category: "Service",
    description: "Maximize guest satisfaction scores and positive reviews.",
    howToPlay: "The entire FOH team focuses on delivering exceptional service with attention to detail, proactive communication, and personalized touches. Track guest satisfaction scores, positive feedback, and review ratings.",
    duration: 300,
    teams: ["Servers", "Bartenders", "Hosts", "Support"],
    targetRole: "Front of House",
    defaultReward: "150 Lineup Points",
    defaultRewardType: "points",
    defaultRewardValue: 150,
    rules: [
      "Track guest satisfaction scores",
      "Proactive service approach",
      "Team collaboration bonus",
    ],
    metrics: ["guestSatisfaction", "positiveReviews"],
  },
  {
    id: "foh-wine-knowledge",
    name: "Wine Knowledge Master",
    category: "Training",
    description: "Test and improve wine knowledge and pairing suggestions.",
    howToPlay: "Servers and bartenders demonstrate wine knowledge by making accurate pairing suggestions and answering customer questions. Track successful pairings, customer engagement, and wine sales.",
    duration: 180,
    teams: ["Servers", "Bartenders"],
    targetRole: "Front of House",
    defaultReward: "Shift Meal",
    defaultRewardType: "meal",
    defaultRewardValue: 0,
    rules: [
      "Track wine pairing suggestions",
      "Customer engagement scoring",
      "Wine sales tracking",
    ],
    metrics: ["wineSales", "pairingAccuracy"],
  },
  {
    id: "foh-clean-stations",
    name: "Clean Stations Challenge",
    category: "Organization",
    description: "Maintain clean, organized service stations throughout the shift.",
    howToPlay: "FOH staff maintains clean and organized service stations, bar areas, and host stands throughout the shift. Track station cleanliness, organization, and maintenance standards.",
    duration: 240,
    teams: ["Servers", "Bartenders", "Support"],
    targetRole: "Front of House",
    defaultReward: "50 Lineup Points",
    defaultRewardType: "points",
    defaultRewardValue: 50,
    rules: [
      "Track station cleanliness",
      "Regular maintenance checks",
      "Team coordination bonus",
    ],
    metrics: ["stationCleanliness", "organization"],
  },
  {
    id: "foh-accuracy-master",
    name: "Order Accuracy Master",
    category: "Quality",
    description: "Achieve 100% order accuracy with zero mistakes.",
    howToPlay: "Servers and support staff focus on perfect order accuracy, from taking orders to delivering them correctly. Track order errors, corrections, and customer complaints related to order accuracy.",
    duration: 180,
    teams: ["Servers", "Support"],
    targetRole: "Front of House",
    defaultReward: "100 Lineup Points",
    defaultRewardType: "points",
    defaultRewardValue: 100,
    rules: [
      "Zero order errors goal",
      "Track corrections and complaints",
      "Team accuracy bonus",
    ],
    metrics: ["orderAccuracy", "errorRate"],
  },
  // BOH Games
  {
    id: "boh-ticket-time",
    name: "Ticket Time Champion",
    category: "Speed",
    description: "Reduce average ticket time while maintaining quality.",
    howToPlay: "Kitchen staff works together to reduce average ticket time by improving coordination, prep efficiency, and communication. Track ticket times, quality scores, and kitchen efficiency.",
    duration: 240,
    teams: ["Kitchen"],
    targetRole: "Back of House",
    defaultReward: "100 Lineup Points",
    defaultRewardType: "points",
    defaultRewardValue: 100,
    rules: [
      "Track average ticket time",
      "Maintain quality standards",
      "Team coordination bonus",
    ],
    metrics: ["ticketTime", "qualityScore"],
  },
  {
    id: "boh-waste-warrior",
    name: "Waste Warrior",
    category: "Efficiency",
    description: "Minimize food waste and maximize ingredient utilization.",
    howToPlay: "Kitchen staff focuses on reducing food waste through better prep planning, portion control, and creative use of ingredients. Track waste percentage, ingredient utilization, and cost savings.",
    duration: 300,
    teams: ["Kitchen"],
    targetRole: "Back of House",
    defaultReward: "150 Lineup Points",
    defaultRewardType: "points",
    defaultRewardValue: 150,
    rules: [
      "Track waste percentage",
      "Maximize ingredient utilization",
      "Cost savings tracking",
    ],
    metrics: ["wastePercentage", "ingredientUtilization"],
  },
  {
    id: "boh-prep-master",
    name: "Prep Master",
    category: "Efficiency",
    description: "Complete all prep tasks efficiently with minimal waste.",
    howToPlay: "Kitchen staff competes to complete all prep tasks efficiently with minimal waste. Track prep completion time, prep waste percentage, and prep quality. The team that finishes prep fastest with highest quality and lowest waste wins.",
    duration: 180,
    teams: ["Kitchen"],
    targetRole: "Back of House",
    defaultReward: "75 Lineup Points",
    defaultRewardType: "points",
    defaultRewardValue: 75,
    rules: [
      "Track prep completion time",
      "Minimize prep waste",
      "Maintain prep quality",
    ],
    metrics: ["prepCompletionTime", "prepWaste", "prepQuality"],
  },
  {
    id: "boh-quality-control",
    name: "Quality Control Excellence",
    category: "Quality",
    description: "Maintain perfect food quality and presentation standards.",
    howToPlay: "Kitchen staff focuses on maintaining perfect food quality, presentation, and consistency. Track quality scores, presentation standards, and customer feedback on food quality.",
    duration: 240,
    teams: ["Kitchen"],
    targetRole: "Back of House",
    defaultReward: "100 Lineup Points",
    defaultRewardType: "points",
    defaultRewardValue: 100,
    rules: [
      "Track quality scores",
      "Maintain presentation standards",
      "Zero quality complaints goal",
    ],
    metrics: ["qualityScore", "presentationScore"],
  },
  {
    id: "boh-clean-kitchen",
    name: "Clean Kitchen Challenge",
    category: "Organization",
    description: "Maintain clean, organized stations throughout the shift.",
    howToPlay: "Kitchen staff maintains clean, organized stations throughout the shift with regular cleaning breaks. Track station cleanliness, organization, and closing efficiency. The team with the cleanest stations and fastest closing wins.",
    duration: 300,
    teams: ["Kitchen"],
    targetRole: "Back of House",
    defaultReward: "Shift Meal",
    defaultRewardType: "meal",
    defaultRewardValue: 0,
    rules: [
      "Track station cleanliness",
      "Regular cleaning breaks",
      "Fast closing efficiency",
    ],
    metrics: ["stationCleanliness", "closingTime"],
  },
  {
    id: "boh-safety-first",
    name: "Safety First",
    category: "Quality",
    description: "Maintain food safety standards and reduce safety incidents.",
    howToPlay: "Kitchen staff focuses on maintaining all food safety protocols including temperature logs, cross-contamination prevention, and proper handling. Track safety compliance, temperature accuracy, and safety incidents. Zero incidents wins.",
    duration: 300,
    teams: ["Kitchen", "Managers"],
    targetRole: "Back of House",
    defaultReward: "150 Lineup Points",
    defaultRewardType: "points",
    defaultRewardValue: 150,
    rules: [
      "Maintain food safety protocols",
      "Track temperature logs",
      "Zero safety incidents goal",
    ],
    metrics: ["safetyCompliance", "temperatureAccuracy"],
  },
  {
    id: "boh-speed-demon",
    name: "Speed Demon",
    category: "Speed",
    description: "Complete orders faster during peak rush periods.",
    howToPlay: "Kitchen staff competes to complete orders as quickly as possible during peak rush periods while maintaining quality. Track order completion times, quality scores, and rush period efficiency.",
    duration: 120,
    teams: ["Kitchen"],
    targetRole: "Back of House",
    defaultReward: "100 Lineup Points",
    defaultRewardType: "points",
    defaultRewardValue: 100,
    rules: [
      "Track order completion times",
      "Maintain quality during rush",
      "Peak period efficiency bonus",
    ],
    metrics: ["orderCompletionTime", "rushEfficiency"],
  },
  {
    id: "boh-inventory-master",
    name: "Inventory Master",
    category: "Efficiency",
    description: "Accurate inventory tracking and management.",
    howToPlay: "Kitchen staff focuses on accurate inventory tracking, proper rotation, and minimizing discrepancies. Track inventory accuracy, rotation compliance, and waste reduction through better inventory management.",
    duration: 240,
    teams: ["Kitchen", "Managers"],
    targetRole: "Back of House",
    defaultReward: "75 Lineup Points",
    defaultRewardType: "points",
    defaultRewardValue: 75,
    rules: [
      "Track inventory accuracy",
      "Proper rotation compliance",
      "Minimize discrepancies",
    ],
    metrics: ["inventoryAccuracy", "rotationCompliance"],
  },
  {
    id: "boh-consistency-king",
    name: "Consistency King",
    category: "Quality",
    description: "Maintain perfect consistency across all dishes.",
    howToPlay: "Kitchen staff focuses on maintaining perfect consistency in portion sizes, cooking times, and presentation across all dishes. Track consistency scores, portion accuracy, and customer feedback on consistency.",
    duration: 240,
    teams: ["Kitchen"],
    targetRole: "Back of House",
    defaultReward: "100 Lineup Points",
    defaultRewardType: "points",
    defaultRewardValue: 100,
    rules: [
      "Track consistency scores",
      "Maintain portion accuracy",
      "Zero consistency complaints",
    ],
    metrics: ["consistencyScore", "portionAccuracy"],
  },
  {
    id: "boh-team-coordination",
    name: "Team Coordination Master",
    category: "Efficiency",
    description: "Perfect kitchen coordination and communication.",
    howToPlay: "Kitchen staff works together to achieve perfect coordination and communication during service. Track communication effectiveness, coordination scores, and overall kitchen efficiency.",
    duration: 300,
    teams: ["Kitchen"],
    targetRole: "Back of House",
    defaultReward: "150 Lineup Points",
    defaultRewardType: "points",
    defaultRewardValue: 150,
    rules: [
      "Track communication effectiveness",
      "Coordination scoring",
      "Overall efficiency bonus",
    ],
    metrics: ["coordinationScore", "communicationEffectiveness"],
  },
];

export default function ShiftGamesHub() {
  const navigate = useNavigate();
  const location = useLocation();
  const { restaurantId } = useParams();
  const routeRestaurantId = restaurantId || location.state?.restaurantId || "123";
  
  const [activeView, setActiveView] = useState("browse"); // browse | create | edit
  const [games, setGames] = useState([]);
  const [activeGames, setActiveGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState(null);
  const [filter, setFilter] = useState("all"); // all | foh | boh | custom
  
  // New state for game setup
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [gameToSetup, setGameToSetup] = useState(null);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  
  // Staff and attendance state
  const [staff, setStaff] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [loadingStaff, setLoadingStaff] = useState(false);
  
  // Lineup Points state
  const [pointsData, setPointsData] = useState({
    weeklyAllocation: WEEKLY_POINT_ALLOCATION,
    usedThisWeek: 0,
    remaining: WEEKLY_POINT_ALLOCATION,
    weekEndingISO: getWeekEndingISO(),
  });

  // Load staff from Firestore
  const loadStaff = useCallback(async () => {
    if (!routeRestaurantId) return;
    
    setLoadingStaff(true);
    try {
      const staffRef = collection(db, "restaurants", routeRestaurantId, "staff");
      const snap = await getDocs(staffRef);
      const staffList = snap.docs.map((d) => ({
        id: d.id,
        uid: d.id,
        ...d.data(),
      }));
      setStaff(staffList);
    } catch (err) {
      console.error("Failed to load staff:", err);
      setStaff([]);
    } finally {
      setLoadingStaff(false);
    }
  }, [routeRestaurantId]);

  // Load attendance (who's currently punched in)
  const loadAttendance = useCallback(async () => {
    if (!routeRestaurantId || staff.length === 0) return;
    
    try {
      const attendanceMap = {};
      
      await Promise.all(
        staff.map(async (s) => {
          try {
            // Check both possible paths
            const attendanceRef1 = doc(
              db,
              "restaurants",
              routeRestaurantId,
              "attendance",
              s.uid
            );
            
            const attendanceRef2 = doc(
              db,
              "companies",
              COMPANY_ID,
              "restaurants",
              routeRestaurantId,
              "attendance",
              s.uid
            );
            
            let snap = await getDoc(attendanceRef1);
            if (!snap.exists()) {
              snap = await getDoc(attendanceRef2);
            }
            
            if (snap.exists()) {
              const data = snap.data();
              attendanceMap[s.uid] = {
                status: data.status || "off",
                punchedInAt: data.punchedInAt,
                punchedOutAt: data.punchedOutAt,
                updatedAt: data.updatedAt,
              };
            }
          } catch (err) {
            console.error(`Failed to load attendance for ${s.uid}:`, err);
          }
        })
      );
      
      setAttendance(attendanceMap);
    } catch (err) {
      console.error("Failed to load attendance:", err);
      setAttendance({});
    }
  }, [routeRestaurantId, staff]);

  // Get currently punched-in staff
  const getPunchedInStaff = useCallback(() => {
    return staff.filter((s) => {
      const att = attendance[s.uid];
      return att && att.status === "active";
    });
  }, [staff, attendance]);

  // Auto-populate participants based on game requirements
  const autoPopulateParticipants = useCallback((game) => {
    const punchedIn = getPunchedInStaff();
    
    if (!game) return [];
    
    // Filter by target role (FOH or BOH)
    let eligible = punchedIn.filter((s) => {
      const role = (s.role || "").toLowerCase();
      if (game.targetRole === "Front of House") {
        return role.includes("front") || role === "foh";
      } else if (game.targetRole === "Back of House") {
        return role.includes("back") || role === "boh" || role.includes("kitchen");
      }
      return true; // If no target role, include all
    });
    
    // Further filter by specific teams if specified
    if (game.teams && game.teams.length > 0) {
      eligible = eligible.filter((s) => {
        const subRole = (s.subRole || "").toLowerCase();
        return game.teams.some((team) => 
          subRole.includes(team.toLowerCase()) || 
          (s.role || "").toLowerCase().includes(team.toLowerCase())
        );
      });
    }
    
    return eligible.map((s) => ({
      uid: s.uid,
      name: s.name || s.uid,
      role: s.role || "Unknown",
      subRole: s.subRole || "",
    }));
  }, [getPunchedInStaff]);

  // Load weekly points balance
  const loadPointsBalance = useCallback(async () => {
    if (!routeRestaurantId) return;
    
    try {
      const weekEndingISO = getWeekEndingISO();
      const pointsRef = doc(
        db,
        "companies",
        COMPANY_ID,
        "restaurants",
        routeRestaurantId,
        "lineupPoints",
        weekEndingISO
      );
      
      const snap = await getDoc(pointsRef);
      
      if (snap.exists()) {
        const data = snap.data();
        const used = data.usedThisWeek || 0;
        const remaining = WEEKLY_POINT_ALLOCATION - used;
        
        setPointsData({
          weeklyAllocation: WEEKLY_POINT_ALLOCATION,
          usedThisWeek: used,
          remaining: remaining,
          weekEndingISO: weekEndingISO,
        });
      } else {
        // First time this week - create the document
        await setDoc(pointsRef, {
          weeklyAllocation: WEEKLY_POINT_ALLOCATION,
          usedThisWeek: 0,
          weekEndingISO: weekEndingISO,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        
        setPointsData({
          weeklyAllocation: WEEKLY_POINT_ALLOCATION,
          usedThisWeek: 0,
          remaining: WEEKLY_POINT_ALLOCATION,
          weekEndingISO: weekEndingISO,
        });
      }
    } catch (err) {
      console.error("Failed to load points balance:", err);
    }
  }, [routeRestaurantId]);

  // Load games from Firestore
  const loadGames = useCallback(async () => {
    if (!routeRestaurantId) return;
    
    setLoading(true);
    try {
      const gamesRef = collection(
        db,
        "companies",
        COMPANY_ID,
        "restaurants",
        routeRestaurantId,
        "shiftGames"
      );
      
      const snap = await getDocs(query(gamesRef, orderBy("createdAt", "desc")));
      const gamesList = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      
      setGames(gamesList);
    } catch (err) {
      console.error("Failed to load games:", err);
    } finally {
      setLoading(false);
    }
  }, [routeRestaurantId]);

  // Load active games
  const loadActiveGames = useCallback(async () => {
    if (!routeRestaurantId) return;
    
    try {
      const activeGamesRef = collection(
        db,
        "companies",
        COMPANY_ID,
        "restaurants",
        routeRestaurantId,
        "activeShiftGames"
      );
      
      const snap = await getDocs(query(activeGamesRef, where("active", "==", true)));
      const activeList = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      
      setActiveGames(activeList);
    } catch (err) {
      console.error("Failed to load active games:", err);
    }
  }, [routeRestaurantId]);

 // Handle "Start New Game" - opens setup modal with auto-populated participants
const handleStartNewGame = useCallback((game) => {
  console.log("handleStartNewGame called with game:", game);
  const autoParticipants = autoPopulateParticipants(game);
  console.log("Auto-populated participants:", autoParticipants);
  setGameToSetup(game);
  setSelectedParticipants(autoParticipants);
  setShowSetupModal(true);
  console.log("Modal should now be visible, showSetupModal:", true);
}, [autoPopulateParticipants]);

  // Handle "Play Game" - actually starts the game with selected participants
  const handlePlayGame = useCallback(async () => {
    
    if (!routeRestaurantId || !gameToSetup || selectedParticipants.length === 0) {
      alert("Please select at least one participant.");
      return;
    }
    
    try {
      const activeGameRef = doc(
        db,
        "companies",
        COMPANY_ID,
        "restaurants",
        routeRestaurantId,
        "activeShiftGames",
        `${gameToSetup.id}-${Date.now()}`
      );
      
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + (gameToSetup.duration * 60 * 1000));
      
      // Get reward info (use default if not customized)
      const reward = gameToSetup.reward || gameToSetup.defaultReward || "Shift Meal";
      const rewardType = gameToSetup.rewardType || gameToSetup.defaultRewardType || "meal";
      const rewardValue = gameToSetup.rewardValue !== undefined ? gameToSetup.rewardValue : (gameToSetup.defaultRewardValue || 0);
      
      await setDoc(activeGameRef, {
        gameId: gameToSetup.id,
        gameName: gameToSetup.name,
        gameData: gameToSetup,
        active: true,
        startTime: serverTimestamp(),
        endTime: serverTimestamp(),
        reward: reward,
        rewardType: rewardType,
        rewardValue: rewardValue,
        participants: selectedParticipants,
        createdAt: serverTimestamp(),
      });
      
      await loadActiveGames();
      setShowSetupModal(false);
      setGameToSetup(null);
      setSelectedParticipants([]);
      alert(`Game "${gameToSetup.name}" started with ${selectedParticipants.length} participants!`);
    } catch (err) {
      console.error("Failed to start game:", err);
      alert("Failed to start game. Please try again.");
    }
  }, [routeRestaurantId, gameToSetup, selectedParticipants, loadActiveGames]);

  // End a game and deduct points if reward uses points
  const handleEndGame = useCallback(async (activeGame) => {
    if (!routeRestaurantId) return;
    
    if (!window.confirm(`End game "${activeGame.gameName}" and distribute rewards?`)) {
      return;
    }
    
    try {
      const activeGameRef = doc(
        db,
        "companies",
        COMPANY_ID,
        "restaurants",
        routeRestaurantId,
        "activeShiftGames",
        activeGame.id
      );
      
      // Mark game as inactive
      await updateDoc(activeGameRef, {
        active: false,
        endedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      // If reward uses points, deduct from weekly balance
      if (activeGame.rewardType === "points" && activeGame.rewardValue > 0) {
        const weekEndingISO = getWeekEndingISO();
        const pointsRef = doc(
          db,
          "companies",
          COMPANY_ID,
          "restaurants",
          routeRestaurantId,
          "lineupPoints",
          weekEndingISO
        );
        
        await runTransaction(db, async (transaction) => {
          const pointsSnap = await transaction.get(pointsRef);
          
          if (pointsSnap.exists()) {
            const currentUsed = pointsSnap.data().usedThisWeek || 0;
            transaction.update(pointsRef, {
              usedThisWeek: increment(activeGame.rewardValue),
              updatedAt: serverTimestamp(),
            });
          } else {
            transaction.set(pointsRef, {
              weeklyAllocation: WEEKLY_POINT_ALLOCATION,
              usedThisWeek: activeGame.rewardValue,
              weekEndingISO: weekEndingISO,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        });
        
        // Reload points balance
        await loadPointsBalance();
      }
      
      await loadActiveGames();
      alert(`Game "${activeGame.gameName}" ended and rewards distributed!`);
    } catch (err) {
      console.error("Failed to end game:", err);
      alert("Failed to end game. Please try again.");
    }
  }, [routeRestaurantId, loadActiveGames, loadPointsBalance]);

  // Create custom game
  const handleCreateGame = useCallback(async (gameData) => {
    if (!routeRestaurantId) return;
    
    try {
      const gamesRef = collection(
        db,
        "companies",
        COMPANY_ID,
        "restaurants",
        routeRestaurantId,
        "shiftGames"
      );
      
      const newGameRef = doc(gamesRef);
      await setDoc(newGameRef, {
        ...gameData,
        isCustom: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      await loadGames();
      setActiveView("browse");
      alert("Custom game created successfully!");
    } catch (err) {
      console.error("Failed to create game:", err);
      alert("Failed to create game. Please try again.");
    }
  }, [routeRestaurantId, loadGames]);

  // Load data on mount
  useEffect(() => {
    if (routeRestaurantId) {
      loadStaff();
    }
  }, [routeRestaurantId, loadStaff]);

  useEffect(() => {
    if (staff.length > 0) {
      loadAttendance();
    }
  }, [staff, loadAttendance]);

  useEffect(() => {
    loadGames();
    loadActiveGames();
    loadPointsBalance();
  }, [loadGames, loadActiveGames, loadPointsBalance]);

  // Combine pre-made and custom games
  const allGames = useMemo(() => {
    return [...PREMADE_GAMES, ...games];
  }, [games]);

  // Filter games
  const filteredGames = useMemo(() => {
    if (filter === "all") return allGames;
    if (filter === "foh") return allGames.filter((g) => g.targetRole === "Front of House");
    if (filter === "boh") return allGames.filter((g) => g.targetRole === "Back of House");
    if (filter === "custom") return allGames.filter((g) => g.isCustom);
    return allGames;
  }, [allGames, filter]);

  // Group games by category
  const groupedGames = useMemo(() => {
    const groups = {};
    filteredGames.forEach((game) => {
      const category = game.category || "Other";
      if (!groups[category]) groups[category] = [];
      groups[category].push(game);
    });
    return groups;
  }, [filteredGames]);

  // Check if game is active
  const isGameActive = useCallback((gameId) => {
    return activeGames.some((ag) => ag.gameId === gameId && ag.active);
  }, [activeGames]);

  const getActiveGame = useCallback((gameId) => {
    return activeGames.find((ag) => ag.gameId === gameId && ag.active);
  }, [activeGames]);

  if (loading) {
    return (
      <div className="shift-games-hub">
        <div className="loading">Loading games...</div>
      </div>
    );
  }

  return (
    <div className="shift-games-hub">
            <div className="hub-header">
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            onClick={() => {
              // Navigate back to restaurant dashboard
              if (routeRestaurantId) {
                navigate(`/dashboard/restaurant/${routeRestaurantId}?tab=overview`);
              } else {
                navigate(-1); // Fallback to browser back
              }
            }}
            style={{
              padding: "8px 16px",
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: "6px",
              color: "#fff",
              cursor: "pointer",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.target.style.background = "rgba(255, 255, 255, 0.15)";
            }}
            onMouseLeave={(e) => {
              e.target.style.background = "rgba(255, 255, 255, 0.1)";
            }}
          >
            ← Back to Dashboard
          </button>
          <h1 style={{ margin: 0 }}>Shift Games Hub</h1>
        </div>
        <div className="points-widget">
          <div className="points-label">Lineup Points</div>
          <div className="points-value">
            {pointsData.remaining.toLocaleString()} / {pointsData.weeklyAllocation.toLocaleString()}
          </div>
          <div className="points-subtext">
            Week ending: {pointsData.weekEndingISO}
          </div>
        </div>
      </div>

      <div className="hub-controls">
        <div className="filter-tabs">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            All Games
          </button>
          <button
            className={filter === "foh" ? "active" : ""}
            onClick={() => setFilter("foh")}
          >
            Front of House
          </button>
          <button
            className={filter === "boh" ? "active" : ""}
            onClick={() => setFilter("boh")}
          >
            Back of House
          </button>
          <button
            className={filter === "custom" ? "active" : ""}
            onClick={() => setFilter("custom")}
          >
            Custom
          </button>
        </div>
        <button
          className="create-btn"
          onClick={() => setActiveView("create")}
        >
          + Create Custom Game
        </button>
      </div>

      {activeView === "browse" ? (
        <div className="games-grid">
          {Object.entries(groupedGames).map(([category, categoryGames]) => (
            <section key={category} className="game-category">
              <h2>{category}</h2>
              <div className="games-list">
                {categoryGames.map((game) => {
                  const isActive = isGameActive(game.id);
                  const activeGame = getActiveGame(game.id);
                  const reward = game.reward || game.defaultReward || "Shift Meal";
                  
                  return (
                    <div key={game.id} className="game-card">
                      <div className="card-header">
                        <h3>{game.name}</h3>
                        {isActive && (
                          <span className="active-badge">ACTIVE</span>
                        )}
                      </div>

                      <p className="description">{game.description}</p>

                      {game.howToPlay && (
                        <div style={{
                          padding: "10px",
                          marginTop: "8px",
                          marginBottom: "12px",
                          background: "rgba(255, 255, 255, 0.05)",
                          borderRadius: "6px",
                          fontSize: "13px",
                          lineHeight: "1.5",
                          opacity: 0.9,
                          borderLeft: "3px solid rgba(74, 222, 128, 0.5)",
                        }}>
                          <strong style={{ display: "block", marginBottom: "4px", fontSize: "12px", opacity: 0.8 }}>How to Play:</strong>
                          {game.howToPlay}
                        </div>
                      )}

                      <div className="teams">
                        <strong>Teams:</strong> {game.teams?.join(", ") || "All"}
                      </div>

                      {game.targetRole && (
                        <div style={{ fontSize: "12px", opacity: 0.7, marginTop: "8px" }}>
                          Target: {game.targetRole}
                        </div>
                      )}

                      <div style={{
                        fontSize: "12px",
                        marginTop: "8px",
                        padding: "6px 10px",
                        background: "rgba(251, 191, 36, 0.15)",
                        borderRadius: "4px",
                        border: "1px solid rgba(251, 191, 36, 0.3)",
                      }}>
                        <strong>Reward:</strong> {reward}
                      </div>

                      <div className="card-actions">
                        {isActive ? (
                          <>
                            <button
                              className="secondary-btn"
                              onClick={() => {
                                setSelectedGame(game);
                                setActiveView("edit");
                              }}
                              style={{ minHeight: "44px" }}
                            >
                              View Details
                            </button>
                            <button
                              className="primary-btn"
                              onClick={() => handleEndGame(activeGame)}
                              style={{ minHeight: "44px" }}
                            >
                              End Game
                            </button>
                          </>
                        ) : (
                          <>
                            <button
  className="secondary-btn"
  onClick={() => {
    console.log("Start New Game button clicked for game:", game);
    handleStartNewGame(game);
  }}
  style={{ minHeight: "44px" }}
>
  Start New Game
</button>

<button
  className="primary-btn"
  onClick={() => {
    console.log("Play Game button clicked for game:", game);
    handleStartNewGame(game);
  }}
  disabled={pointsData.remaining < (game.rewardValue || game.defaultRewardValue || 0) && (game.rewardType || game.defaultRewardType) === "points"}
  style={{ minHeight: "44px" }}
>
  Play Game
</button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : activeView === "create" ? (
        <GameEditor
          onSave={handleCreateGame}
          onCancel={() => setActiveView("browse")}
          pointsRemaining={pointsData.remaining}
        />
      ) : (
        <GameEditor
          game={selectedGame}
          onSave={async (gameData) => {
            // Update existing game
            if (!routeRestaurantId || !selectedGame?.id) return;
            
            try {
              const gameRef = doc(
                db,
                "companies",
                COMPANY_ID,
                "restaurants",
                routeRestaurantId,
                "shiftGames",
                selectedGame.id
              );
              
              await updateDoc(gameRef, {
                ...gameData,
                updatedAt: serverTimestamp(),
              });
              
              await loadGames();
              setActiveView("browse");
              setSelectedGame(null);
              alert("Game updated successfully!");
            } catch (err) {
              console.error("Failed to update game:", err);
              alert("Failed to update game. Please try again.");
            }
          }}
          onCancel={() => {
            setActiveView("browse");
            setSelectedGame(null);
          }}
          pointsRemaining={pointsData.remaining}
        />
      )}

      {/* Setup Modal */}
      {showSetupModal && gameToSetup && (
        <div className="modal-overlay" onClick={() => {
          setShowSetupModal(false);
          setGameToSetup(null);
          setSelectedParticipants([]);
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Start New Game: {gameToSetup.name}</h2>
              <button
                className="close-btn"
                onClick={() => {
                  setShowSetupModal(false);
                  setGameToSetup(null);
                  setSelectedParticipants([]);
                }}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div style={{ marginBottom: "20px" }}>
                <p style={{ fontSize: "14px", opacity: 0.8, marginBottom: "12px" }}>
                  Participants automatically selected from currently punched-in staff matching this game's requirements.
                </p>
                
                {selectedParticipants.length === 0 ? (
                  <div style={{
                    padding: "20px",
                    background: "rgba(239, 68, 68, 0.1)",
                    borderRadius: "8px",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    textAlign: "center",
                  }}>
                    <p style={{ color: "#ef4444", margin: 0 }}>
                      No eligible staff members are currently punched in.
                    </p>
                    <p style={{ fontSize: "12px", opacity: 0.7, marginTop: "8px" }}>
                      Target: {gameToSetup.targetRole} {gameToSetup.teams ? `(${gameToSetup.teams.join(", ")})` : ""}
                    </p>
                  </div>
                ) : (
                  <div>
                    <div style={{
                      marginBottom: "12px",
                      padding: "10px",
                      background: "rgba(74, 222, 128, 0.1)",
                      borderRadius: "6px",
                      border: "1px solid rgba(74, 222, 128, 0.3)",
                    }}>
                      <strong style={{ display: "block", marginBottom: "4px" }}>
                        {selectedParticipants.length} participant{selectedParticipants.length !== 1 ? "s" : ""} selected
                      </strong>
                      <span style={{ fontSize: "12px", opacity: 0.8 }}>
                        {gameToSetup.targetRole} {gameToSetup.teams ? `• ${gameToSetup.teams.join(", ")}` : ""}
                      </span>
                    </div>
                    
                    <div style={{
                      maxHeight: "300px",
                      overflowY: "auto",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "6px",
                      padding: "8px",
                    }}>
                      {selectedParticipants.map((p) => (
                        <div
                          key={p.uid}
                          style={{
                            padding: "10px",
                            marginBottom: "6px",
                            background: "rgba(255, 255, 255, 0.05)",
                            borderRadius: "4px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <strong>{p.name}</strong>
                            <div style={{ fontSize: "12px", opacity: 0.7 }}>
                              {p.role} {p.subRole ? `• ${p.subRole}` : ""}
                            </div>
                          </div>
                          <button
                            className="remove-btn"
                            onClick={() => {
                              setSelectedParticipants(selectedParticipants.filter((sp) => sp.uid !== p.uid));
                            }}
                            style={{
                              padding: "4px 8px",
                              fontSize: "12px",
                              background: "rgba(239, 68, 68, 0.2)",
                              border: "1px solid rgba(239, 68, 68, 0.3)",
                              borderRadius: "4px",
                              color: "#ef4444",
                              cursor: "pointer",
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div style={{
                padding: "12px",
                background: "rgba(251, 191, 36, 0.1)",
                borderRadius: "6px",
                border: "1px solid rgba(251, 191, 36, 0.3)",
                marginBottom: "20px",
              }}>
                <strong>Reward:</strong> {gameToSetup.reward || gameToSetup.defaultReward || "Shift Meal"}
              </div>
            </div>
            
            <div className="modal-footer">
              <button
                className="secondary-btn"
                onClick={() => {
                  setShowSetupModal(false);
                  setGameToSetup(null);
                  setSelectedParticipants([]);
                }}
              >
                Cancel
              </button>
              <button
                className="primary-btn"
                onClick={handlePlayGame}
                disabled={selectedParticipants.length === 0}
              >
                Play Game
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Game Editor Component (keeping existing implementation)
function GameEditor({ game, onSave, onCancel, pointsRemaining = 1000 }) {
  const [formData, setFormData] = useState({
    name: game?.name || "",
    category: game?.category || "Sales",
    description: game?.description || "",
    howToPlay: game?.howToPlay || "",
    duration: game?.duration || 180,
    teams: game?.teams || [],
    targetRole: game?.targetRole || "Front of House",
    rules: game?.rules || [],
    reward: game?.reward || game?.defaultReward || "Shift Meal",
    rewardType: game?.rewardType || game?.defaultRewardType || "meal",
    rewardValue: game?.rewardValue !== undefined ? game?.rewardValue : (game?.defaultRewardValue || 0),
    metrics: game?.metrics || [],
  });

  const [newRule, setNewRule] = useState("");
  const [newTeam, setNewTeam] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="game-editor">
      <div className="editor-header">
        <h2>{game ? "Edit Game" : "Create Custom Game"}</h2>
        <button className="close-btn" onClick={onCancel}>×</button>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Game Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label>Category</label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          >
            <option>Sales</option>
            <option>Speed</option>
            <option>Quality</option>
            <option>Efficiency</option>
            <option>Service</option>
            <option>Training</option>
            <option>Organization</option>
          </select>
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            required
          />
        </div>

        <div className="form-group">
          <label>How to Play</label>
          <textarea
            value={formData.howToPlay}
            onChange={(e) => setFormData({ ...formData, howToPlay: e.target.value })}
            rows={4}
            placeholder="1-2 sentences explaining how the game is played..."
          />
        </div>

        <div className="form-group">
          <label>Duration (minutes)</label>
          <input
            type="number"
            value={formData.duration}
            onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 180 })}
            min={30}
            max={480}
            required
          />
        </div>

        <div className="form-group">
          <label>Target Role</label>
          <select
            value={formData.targetRole}
            onChange={(e) => setFormData({ ...formData, targetRole: e.target.value })}
          >
            <option>Front of House</option>
            <option>Back of House</option>
            <option>All</option>
          </select>
        </div>

        <div className="form-group">
          <label>Teams</label>
          <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
            <input
              type="text"
              value={newTeam}
              onChange={(e) => setNewTeam(e.target.value)}
              placeholder="Add team (e.g., Servers)"
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (newTeam.trim() && !formData.teams.includes(newTeam.trim())) {
                    setFormData({ ...formData, teams: [...formData.teams, newTeam.trim()] });
                    setNewTeam("");
                  }
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                if (newTeam.trim() && !formData.teams.includes(newTeam.trim())) {
                  setFormData({ ...formData, teams: [...formData.teams, newTeam.trim()] });
                  setNewTeam("");
                }
              }}
            >
              Add
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {formData.teams.map((team, idx) => (
              <span
                key={idx}
                style={{
                  padding: "4px 8px",
                  background: "rgba(74, 222, 128, 0.2)",
                  borderRadius: "4px",
                  fontSize: "12px",
                }}
              >
                {team}
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, teams: formData.teams.filter((_, i) => i !== idx) });
                  }}
                  style={{ marginLeft: "6px", background: "none", border: "none", color: "inherit", cursor: "pointer" }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Reward Type</label>
          <select
            value={formData.rewardType}
            onChange={(e) => setFormData({ ...formData, rewardType: e.target.value })}
          >
            <option value="meal">Shift Meal</option>
            <option value="points">Lineup Points</option>
          </select>
        </div>

        {formData.rewardType === "points" && (
          <div className="form-group">
            <label>Points Value</label>
            <input
              type="number"
              value={formData.rewardValue}
              onChange={(e) => setFormData({ ...formData, rewardValue: parseInt(e.target.value) || 0 })}
              min={0}
              max={pointsRemaining}
              required
            />
            <small>Available: {pointsRemaining} points</small>
          </div>
        )}

        <div className="form-group">
          <label>Rules</label>
          <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
            <input
              type="text"
              value={newRule}
              onChange={(e) => setNewRule(e.target.value)}
              placeholder="Add rule"
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (newRule.trim() && !formData.rules.includes(newRule.trim())) {
                    setFormData({ ...formData, rules: [...formData.rules, newRule.trim()] });
                    setNewRule("");
                  }
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                if (newRule.trim() && !formData.rules.includes(newRule.trim())) {
                  setFormData({ ...formData, rules: [...formData.rules, newRule.trim()] });
                  setNewRule("");
                }
              }}
            >
              Add
            </button>
          </div>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {formData.rules.map((rule, idx) => (
              <li key={idx} style={{ marginBottom: "6px" }}>
                <span style={{ marginRight: "8px" }}>•</span>
                {rule}
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, rules: formData.rules.filter((_, i) => i !== idx) });
                  }}
                  style={{ marginLeft: "8px", background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="form-actions">
          <button type="button" className="secondary-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="primary-btn">
            {game ? "Update Game" : "Create Game"}
          </button>
        </div>
      </form>
    </div>
  );
}