// src/pages/Dashboards/RestaurantDashboard/tabs/Scheduling/SchedulingTab.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import ShiftBoard from "./ShiftBoard";
import EmployeePool from "./EmployeePool";
import "./scheduling.css";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../../../../../hooks/services/firebase";

export default function SchedulingTab() {
  const { restaurantId: routeRestaurantId } = useParams();
  const restaurantId = routeRestaurantId || "123";
  const companyId = "company-demo";

  // -----------------------------
  // Slots (center board) with shift time definitions
  // -----------------------------
  const slots = useMemo(
    () => [
      { 
        id: "foh-host", 
        label: "Host", 
        side: "foh",
        startTime: "10:00",
        endTime: "18:00",
        hours: 8
      },
      { 
        id: "foh-server-1", 
        label: "Server 1", 
        side: "foh",
        startTime: "11:00",
        endTime: "19:00",
        hours: 8
      },
      { 
        id: "foh-server-2", 
        label: "Server 2", 
        side: "foh",
        startTime: "11:00",
        endTime: "19:00",
        hours: 8
      },
      { 
        id: "foh-bartender", 
        label: "Bartender", 
        side: "foh",
        startTime: "16:00",
        endTime: "00:00",
        hours: 8
      },
      { 
        id: "boh-grill", 
        label: "Grill", 
        side: "boh",
        startTime: "10:00",
        endTime: "18:00",
        hours: 8
      },
      { 
        id: "boh-fry", 
        label: "Fry", 
        side: "boh",
        startTime: "11:00",
        endTime: "19:00",
        hours: 8
      },
      { 
        id: "boh-saute", 
        label: "Saute", 
        side: "boh",
        startTime: "11:00",
        endTime: "19:00",
        hours: 8
      },
      { 
        id: "boh-salad", 
        label: "Salad", 
        side: "boh",
        startTime: "10:00",
        endTime: "18:00",
        hours: 8
      },
    ],
    []
  );

  // -----------------------------
  // Date helpers
  // -----------------------------
  const pad2 = useCallback((n) => String(n).padStart(2, "0"), []);

  const toISODate = useCallback(
    (d) => {
      const yyyy = d.getFullYear();
      const mm = pad2(d.getMonth() + 1);
      const dd = pad2(d.getDate());
      return `${yyyy}-${mm}-${dd}`;
    },
    [pad2]
  );

  const parseISODate = useCallback((iso) => {
    const [y, m, d] = String(iso || "").split("-").map((x) => Number(x));
    if (!y || !m || !d) return null;
    const dt = new Date(y, m - 1, d);
    if (Number.isNaN(dt.getTime())) return null;
    return dt;
  }, []);

  const addDays = useCallback((dateObj, n) => {
    const d = new Date(dateObj.getTime());
    d.setDate(d.getDate() + n);
    return d;
  }, []);

  const isSundayISO = useCallback(
    (iso) => {
      const d = parseISODate(iso);
      if (!d) return false;
      return d.getDay() === 0;
    },
    [parseISODate]
  );

  const nearestSundayISO = useCallback(
    (iso) => {
      const d = parseISODate(iso);
      if (!d) return null;
      const day = d.getDay();
      if (day === 0) return toISODate(d);
      const delta = (7 - day) % 7;
      return toISODate(addDays(d, delta));
    },
    [addDays, parseISODate, toISODate]
  );

  const upcomingSundayISO = useCallback(() => {
    const now = new Date();
    const day = now.getDay();
    const daysToSunday = (7 - day) % 7;
    return toISODate(addDays(now, daysToSunday));
  }, [addDays, toISODate]);

  const startOfWeekFromWeekEndingSunday = useCallback(
    (weekEndingISO) => {
      const sunday = parseISODate(weekEndingISO);
      if (!sunday) return null;
      return addDays(sunday, -6);
    },
    [addDays, parseISODate]
  );

  const formatBubbleLabel = useCallback(
    (d) => {
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const name = dayNames[d.getDay()];
      const mm = pad2(d.getMonth() + 1);
      const dd = pad2(d.getDate());
      return `${name} ${mm}/${dd}`;
    },
    [pad2]
  );

  // -----------------------------
  // Employee Preferences Helper Functions
  // -----------------------------
  const getDayNameFromISO = useCallback((iso) => {
    const d = parseISODate(iso);
    if (!d) return null;
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[d.getDay()];
  }, [parseISODate]);

  const getTimePeriod = useCallback((timeStr) => {
    if (!timeStr) return null;
    const [hours] = timeStr.split(":").map(Number);
    if (hours >= 5 && hours < 12) return "morning";
    if (hours >= 12 && hours < 17) return "afternoon";
    if (hours >= 17 && hours < 22) return "evening";
    return "night";
  }, []);

  const isTimeInPreferredRange = useCallback((slotStartTime, slotEndTime, prefStart, prefEnd) => {
    if (!prefStart || !prefEnd) return null; // No preference
    
    const slotStart = slotStartTime.split(":").map(Number);
    const slotEnd = slotEndTime.split(":").map(Number);
    const prefStartTime = prefStart.split(":").map(Number);
    const prefEndTime = prefEnd.split(":").map(Number);
    
    const slotStartMinutes = slotStart[0] * 60 + (slotStart[1] || 0);
    const slotEndMinutes = slotEnd[0] * 60 + (slotEnd[1] || 0);
    const prefStartMinutes = prefStartTime[0] * 60 + (prefStartTime[1] || 0);
    const prefEndMinutes = prefEndTime[0] * 60 + (prefEndTime[1] || 0);
    
    // Check if slot overlaps with preferred time range
    return slotStartMinutes >= prefStartMinutes && slotEndMinutes <= prefEndMinutes;
  }, []);

  // -----------------------------
  // Staff pools
  // - UI requires a stable "id" for drag/drop; we will set id === uid
  // - We still keep name/subRole for display
  // -----------------------------
  const fallbackPools = useMemo(
    () => ({
      foh: [
        { uid: "emp_jessica_taylor", id: "emp_jessica_taylor", name: "Jessica Taylor", subRole: "Host" },
        { uid: "emp_sarah_lopez", id: "emp_sarah_lopez", name: "Sarah Lopez", subRole: "Server" },
        { uid: "emp_mike_evans", id: "emp_mike_evans", name: "Mike Evans", subRole: "Bartender" },
      ],
      boh: [
        { uid: "emp_tom_grill", id: "emp_tom_grill", name: "Tom", subRole: "Grill" },
        { uid: "emp_mike_fry", id: "emp_mike_fry", name: "Mike", subRole: "Fry" },
        { uid: "emp_jen_saute", id: "emp_jen_saute", name: "Jen", subRole: "Saute" },
      ],
    }),
    []
  );

  const [pools, setPools] = useState(fallbackPools);
  const [loadingStaff, setLoadingStaff] = useState(true);

  // Try loading staff from:
  // companies/{companyId}/restaurants/{restaurantId}/staff
  // Each doc should have: uid (string), name (string), role, subRole
  const loadStaff = useCallback(async () => {
    setLoadingStaff(true);
    try {
      const staffRef = collection(db, "companies", companyId, "restaurants", restaurantId, "staff");
      const snap = await getDocs(staffRef);

      if (!snap.empty) {
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const normalized = all
          .map((s) => {
            const uid = String(s.uid || s.id || "").trim();
            const name = String(s.name || "").trim() || uid;
            const role = String(s.role || "").trim();
            const subRole = String(s.subRole || "").trim();
            return {
              uid,
              id: uid, // IMPORTANT: drag/drop stable key
              name,
              role,
              subRole,
            };
          })
          .filter((x) => x.uid);

        const foh = normalized.filter((x) => String(x.role || "").toLowerCase().includes("front"));
        const boh = normalized.filter((x) => String(x.role || "").toLowerCase().includes("back"));

        if (foh.length || boh.length) {
          setPools({
            foh: foh.length ? foh : fallbackPools.foh,
            boh: boh.length ? boh : fallbackPools.boh,
          });
        } else {
          setPools(fallbackPools);
        }
      } else {
        setPools(fallbackPools);
      }
    } catch (e) {
      setPools(fallbackPools);
    } finally {
      setLoadingStaff(false);
    }
  }, [companyId, restaurantId, fallbackPools]);

  // -----------------------------
  // Scheduling week state
  // -----------------------------
  const [weekEndingDate, setWeekEndingDate] = useState(() => upcomingSundayISO());
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [employeePreferences, setEmployeePreferences] = useState({});
  // schedulesByDate: { [yyyy-mm-dd]: { [slotId]: employee|null } }
  const [schedulesByDate, setSchedulesByDate] = useState(() => ({}));
  const [dirtyByDate, setDirtyByDate] = useState(() => ({}));

  const [saveMsg, setSaveMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [weekStatus, setWeekStatus] = useState("draft");
  const [rankingSnapshot, setRankingSnapshot] = useState(null);
  const [showRanking, setShowRanking] = useState(false);
  const [loadingRanking, setLoadingRanking] = useState(false);

  // -----------------------------
  // Schedule publish / lock state
  // -----------------------------
  const [isPublished, setIsPublished] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [loadingWeek, setLoadingWeek] = useState(false);
  const [savedDays, setSavedDays] = useState({});

  // -----------------------------
  // Employee stats for scheduling decisions
  // -----------------------------
  const [employeeStats, setEmployeeStats] = useState({});
  const [previousRankingSnapshot, setPreviousRankingSnapshot] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // -----------------------------
  // AI Suggestions state
  // -----------------------------
  const [suggestionsForSlot, setSuggestionsForSlot] = useState(null); // { slotId, dateISO, suggestions }
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  // -----------------------------
  // Requests (approved days off) state
  // -----------------------------
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [approvedRequests, setApprovedRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // -----------------------------
  // Mobile-specific state
  // -----------------------------
  const [selectedPosition, setSelectedPosition] = useState(null); // For mobile position selector
  const [daySliderIndex, setDaySliderIndex] = useState(0); // For mobile day slider

  // -----------------------------
  // AI Full Week Suggestions state
  // -----------------------------
  const [aiSuggestions, setAiSuggestions] = useState(null); // Full week AI suggestions
  const [loadingAiSuggestions, setLoadingAiSuggestions] = useState(false);
  const [showAiSuggestions, setShowAiSuggestions] = useState(false);
  // -----------------------------
  // Week days calculation (must be before calculateEmployeeStats)
  // -----------------------------
  const weekDays = useMemo(() => {
    const start = startOfWeekFromWeekEndingSunday(weekEndingDate);
    if (!start) return [];
    return Array.from({ length: 7 }).map((_, i) => {
      const d = addDays(start, i);
      return {
        index: i,
        dateObj: d,
        iso: toISODate(d),
        label: formatBubbleLabel(d),
      };
    });
  }, [weekEndingDate, addDays, toISODate, startOfWeekFromWeekEndingSunday, formatBubbleLabel]);

  const selectedDate = useMemo(() => {
    const day = weekDays.find((d) => d.index === activeDayIndex);
    return day?.iso || weekEndingDate;
  }, [weekDays, activeDayIndex, weekEndingDate]);

  // -----------------------------
  // Ensure schedule object exists for current day
  // -----------------------------
  const currentSchedule = useMemo(() => {
    const existing = schedulesByDate[selectedDate];
    if (existing) return existing;
    const init = {};
    slots.forEach((s) => (init[s.id] = null));
    return init;
  }, [schedulesByDate, selectedDate, slots]);

  // -----------------------------
  // Assigned IDs + available pools (per active day)
  // -----------------------------
  const assignedEmployeeIds = useMemo(() => {
    const ids = new Set();
    Object.values(currentSchedule).forEach((emp) => {
      if (emp?.id) ids.add(emp.id);
    });
    return ids;
  }, [currentSchedule]);

  const availablePools = useMemo(() => {
    const filterOutAssigned = (list) => (list || []).filter((e) => !assignedEmployeeIds.has(e.id));
    return {
      foh: filterOutAssigned(pools.foh),
      boh: filterOutAssigned(pools.boh),
    };
  }, [pools, assignedEmployeeIds]);

  // Calculate hours/shifts scheduled per employee for current week
  const calculateEmployeeStats = useCallback(() => {
    const stats = {};

    // Initialize all employees
    [...pools.foh, ...pools.boh].forEach((emp) => {
      stats[emp.uid] = {
        hoursScheduled: 0,
        shiftsScheduled: 0,
        attendanceReliability: null,
        performanceBand: null,
        performanceScore: null,
        rankingPosition: null,
        performanceTrend: null,
        needsTraining: false,
        trainingStatus: null,
      };
    });

    // Count shifts scheduled this week using actual shift hours
    weekDays.forEach((d) => {
      const daySchedule = schedulesByDate[d.iso] || {};
      Object.entries(daySchedule).forEach(([slotId, emp]) => {
        if (emp?.uid) {
          if (!stats[emp.uid]) {
            stats[emp.uid] = {
              hoursScheduled: 0,
              shiftsScheduled: 0,
              attendanceReliability: null,
              performanceBand: null,
              performanceScore: null,
              rankingPosition: null,
              performanceTrend: null,
              needsTraining: false,
              trainingStatus: null,
            };
          }
          
          // Find the slot definition to get actual hours
          const slotDef = slots.find((s) => s.id === slotId);
          const shiftHours = slotDef?.hours || 8; // Default to 8 if not found
          
          stats[emp.uid].shiftsScheduled += 1;
          stats[emp.uid].hoursScheduled += shiftHours;
        }
      });
    });

    // Add performance data from ranking snapshot
    if (rankingSnapshot?.bands) {
      let totalEmployees = 0;
      const bandOrder = ["elite", "strong", "developing", "needsTraining"];

      bandOrder.forEach((band) => {
        const employees = rankingSnapshot.bands[band] || [];
        totalEmployees += employees.length;

        employees.forEach((emp, idx) => {
          if (stats[emp.uid]) {
            stats[emp.uid].performanceBand = band;
            stats[emp.uid].performanceScore = emp.score;
            stats[emp.uid].rankingPosition = totalEmployees - employees.length + idx + 1;
            stats[emp.uid].needsTraining = band === "needsTraining";
          }
        });
      });
    }

    // Calculate performance trends if we have previous snapshot
    if (previousRankingSnapshot?.bands && rankingSnapshot?.bands) {
      const getPreviousBand = (uid) => {
        for (const [band, employees] of Object.entries(previousRankingSnapshot.bands)) {
          const found = employees.find((e) => e.uid === uid);
          if (found) return { band, score: found.score };
        }
        return null;
      };

      Object.keys(stats).forEach((uid) => {
        const current = rankingSnapshot.bands
          ? (() => {
              for (const [band, employees] of Object.entries(rankingSnapshot.bands)) {
                const found = employees.find((e) => e.uid === uid);
                if (found) return { band, score: found.score };
              }
              return null;
            })()
          : null;
        const previous = getPreviousBand(uid);

        if (current && previous) {
          const bandOrder = { elite: 4, strong: 3, developing: 2, needsTraining: 1 };
          const currentLevel = bandOrder[current.band] || 0;
          const previousLevel = bandOrder[previous.band] || 0;

          if (currentLevel > previousLevel) stats[uid].performanceTrend = "↑";
          else if (currentLevel < previousLevel) stats[uid].performanceTrend = "↓";
          else if (current.score > previous.score) stats[uid].performanceTrend = "↑";
          else if (current.score < previous.score) stats[uid].performanceTrend = "↓";
          else stats[uid].performanceTrend = "→";
        }
      });
    }

    return stats;
  }, [pools, weekDays, schedulesByDate, rankingSnapshot, previousRankingSnapshot, slots]);

  // Load attendance reliability from Firestore
  // Path options:
  // 1. companies/{companyId}/restaurants/{restaurantId}/attendanceRecords/{employeeUid}/records/{dateISO}
  // 2. companies/{companyId}/restaurants/{restaurantId}/attendance/{employeeUid} (fallback)
  const loadAttendanceReliability = useCallback(async () => {
    const reliabilityMap = {};
    const allEmployeeUids = [...pools.foh, ...pools.boh].map((e) => e.uid);

    if (allEmployeeUids.length === 0) return reliabilityMap;

    try {
      // Calculate date range: last 4 weeks (28 days)
      const today = new Date();
      const fourWeeksAgo = addDays(today, -28);
      const startDateISO = toISODate(fourWeeksAgo);

      // For each employee, try to load attendance records
      await Promise.all(
        allEmployeeUids.map(async (uid) => {
          try {
            // Try subcollection first: attendanceRecords/{uid}/records
            const recordsRef = collection(
              db,
              "companies",
              companyId,
              "restaurants",
              restaurantId,
              "attendanceRecords",
              uid,
              "records"
            );

            const q = query(
              recordsRef,
              where("dateISO", ">=", startDateISO),
              where("dateISO", "<=", toISODate(today))
            );

            const snap = await getDocs(q);

            if (!snap.empty) {
              // Calculate reliability from records
              const records = snap.docs.map((d) => d.data());
              let totalShifts = 0;
              let attendedShifts = 0;
              let onTimeShifts = 0;
              let lateShifts = 0;
              let noShows = 0;

              records.forEach((record) => {
                totalShifts += 1;
                const status = String(record.status || "").toLowerCase();

                if (status === "completed" || status === "active") {
                  attendedShifts += 1;
                  
                  // Check if on-time (within 15 minutes of scheduled start)
                  if (record.scheduledStartTime && record.punchedInAt) {
                    const scheduledTime = new Date(record.scheduledStartTime);
                    const actualTime = record.punchedInAt.toDate
                      ? record.punchedInAt.toDate()
                      : new Date(record.punchedInAt);
                    const diffMinutes = (actualTime - scheduledTime) / (1000 * 60);
                    
                    if (diffMinutes <= 15) {
                      onTimeShifts += 1;
                    } else {
                      lateShifts += 1;
                    }
                  } else {
                    // If no scheduled time, assume on-time if attended
                    onTimeShifts += 1;
                  }
                } else if (status === "no-show" || status === "absent") {
                  noShows += 1;
                }
              });

              // Calculate reliability score (0-100)
              // Formula: (attended shifts / total shifts) * 100
              // Bonus: +5 points if on-time rate > 80%
              // Penalty: -10 points per no-show
              let reliability = totalShifts > 0 
                ? Math.round((attendedShifts / totalShifts) * 100) 
                : 100;

              const onTimeRate = attendedShifts > 0 
                ? onTimeShifts / attendedShifts 
                : 0;

              if (onTimeRate > 0.8) {
                reliability = Math.min(100, reliability + 5);
              }

              // Apply no-show penalty
              reliability = Math.max(0, reliability - (noShows * 10));

              reliabilityMap[uid] = {
                reliability: Math.max(0, Math.min(100, reliability)),
                totalShifts,
                attendedShifts,
                onTimeShifts,
                lateShifts,
                noShows,
                onTimeRate: Math.round(onTimeRate * 100),
              };
            } else {
              // Fallback: Check main attendance document
              const attendanceRef = doc(
                db,
                "companies",
                companyId,
                "restaurants",
                restaurantId,
                "attendance",
                uid
              );

              const attendanceSnap = await getDoc(attendanceRef);
              
              if (attendanceSnap.exists()) {
                const data = attendanceSnap.data();
                // If we have recent activity, give a default score
                const lastUpdate = data.updatedAt?.toDate 
                  ? data.updatedAt.toDate() 
                  : new Date(data.updatedAt || 0);
                const daysSinceUpdate = (today - lastUpdate) / (1000 * 60 * 60 * 24);

                if (daysSinceUpdate <= 7 && data.status === "completed") {
                  // Recent completion, assume good reliability
                  reliabilityMap[uid] = {
                    reliability: 85,
                    totalShifts: 1,
                    attendedShifts: 1,
                    onTimeShifts: 1,
                    lateShifts: 0,
                    noShows: 0,
                    onTimeRate: 100,
                  };
                } else {
                  // No recent data, default to neutral
                  reliabilityMap[uid] = {
                    reliability: 70,
                    totalShifts: 0,
                    attendedShifts: 0,
                    onTimeShifts: 0,
                    lateShifts: 0,
                    noShows: 0,
                    onTimeRate: 0,
                  };
                }
              } else {
                // No attendance data at all, default to neutral
                reliabilityMap[uid] = {
                  reliability: 70,
                  totalShifts: 0,
                  attendedShifts: 0,
                  onTimeShifts: 0,
                  lateShifts: 0,
                  noShows: 0,
                  onTimeRate: 0,
                };
              }
            }
          } catch (err) {
            console.error(`Failed to load attendance for ${uid}:`, err);
            // Default to neutral on error
            reliabilityMap[uid] = {
              reliability: 70,
              totalShifts: 0,
              attendedShifts: 0,
              onTimeShifts: 0,
              lateShifts: 0,
              noShows: 0,
              onTimeRate: 0,
            };
          }
        })
      );
    } catch (err) {
      console.error("Failed to load attendance reliability:", err);
    }

    return reliabilityMap;
  }, [companyId, restaurantId, pools, addDays, toISODate]);

  // Load employee preferences from Firestore
  const loadEmployeePreferences = useCallback(async () => {
    const preferencesMap = {};
    const allEmployeeUids = [...pools.foh, ...pools.boh].map((e) => e.uid);

    if (allEmployeeUids.length === 0) return preferencesMap;

    try {
      await Promise.all(
        allEmployeeUids.map(async (uid) => {
          try {
            // Try path: restaurants/{restaurantId}/staff/{uid}/preferences/scheduling
            const prefRef = doc(
              db,
              "restaurants",
              restaurantId,
              "staff",
              uid,
              "preferences",
              "scheduling"
            );
            
            const snap = await getDoc(prefRef);
            
            if (snap.exists()) {
              const data = snap.data();
              preferencesMap[uid] = {
                preferredDays: data.preferredDays || [],
                preferredTimes: data.preferredTimes || [],
                avoidDays: data.avoidDays || [],
                preferredStartTime: data.preferredStartTime || null,
                preferredEndTime: data.preferredEndTime || null,
                maxHoursPerWeek: data.maxHoursPerWeek || null,
                minHoursPerWeek: data.minHoursPerWeek || null,
              };
            } else {
              preferencesMap[uid] = {
                preferredDays: [],
                preferredTimes: [],
                avoidDays: [],
                preferredStartTime: null,
                preferredEndTime: null,
                maxHoursPerWeek: null,
                minHoursPerWeek: null,
              };
            }
          } catch (err) {
            console.error(`Failed to load preferences for ${uid}:`, err);
            preferencesMap[uid] = {
              preferredDays: [],
              preferredTimes: [],
              avoidDays: [],
              preferredStartTime: null,
              preferredEndTime: null,
              maxHoursPerWeek: null,
              minHoursPerWeek: null,
            };
          }
        })
      );
    } catch (err) {
      console.error("Failed to load employee preferences:", err);
    }

    return preferencesMap;
  }, [restaurantId, pools]);

  // Load previous ranking snapshot for trend calculation
  const loadPreviousRankingSnapshot = useCallback(async (currentPeriodId) => {
    try {
      // Calculate previous period (assuming 2-week periods)
      const currentDate = parseISODate(currentPeriodId);
      if (!currentDate) return null;

      const previousDate = addDays(currentDate, -14);
      const previousPeriodId = toISODate(previousDate);

      const ref = doc(
        db,
        "companies",
        companyId,
        "restaurants",
        restaurantId,
        "rankingSnapshots",
        previousPeriodId
      );

      const snap = await getDoc(ref);
      if (snap.exists()) {
        return snap.data();
      }
      return null;
    } catch (err) {
      console.error("Failed to load previous ranking snapshot", err);
      return null;
    }
  }, [companyId, restaurantId, parseISODate, addDays, toISODate]);

  // Update stats when dependencies change (including attendance reliability)
  useEffect(() => {
    const updateStats = async () => {
      const baseStats = calculateEmployeeStats();
      
      // Load attendance reliability and merge
      const attendanceData = await loadAttendanceReliability();
      const mergedStats = { ...baseStats };
      
      Object.keys(mergedStats).forEach((uid) => {
        if (attendanceData[uid]) {
          mergedStats[uid].attendanceReliability = attendanceData[uid].reliability;
        }
      });
      
      setEmployeeStats(mergedStats);
    };
    
    updateStats();
  }, [calculateEmployeeStats, loadAttendanceReliability]);

  // Load employee preferences when pools change
  useEffect(() => {
    if (pools.foh.length > 0 || pools.boh.length > 0) {
      loadEmployeePreferences().then(setEmployeePreferences);
    }
  }, [pools, loadEmployeePreferences]);

  // Load previous ranking snapshot when current one loads
  useEffect(() => {
    if (rankingSnapshot && weekEndingDate) {
      loadPreviousRankingSnapshot(weekEndingDate).then(setPreviousRankingSnapshot);
    }
  }, [rankingSnapshot, weekEndingDate, loadPreviousRankingSnapshot]);

  // -----------------------------
  // Approved requests → block index
  // Each request: { uid, name, dateISO, reason, status, weekEndingISO }
  // -----------------------------
  const blockedByDate = useMemo(() => {
    const map = {};
    approvedRequests.forEach((r) => {
      const iso = String(r.dateISO || "").trim();
      const uid = String(r.uid || "").trim();
      if (!iso || !uid) return;
      if (!map[iso]) map[iso] = new Set();
      map[iso].add(uid);
    });
    return map;
  }, [approvedRequests]);

  const isBlocked = useCallback(
    (dateISO, uid) => {
      const set = blockedByDate[dateISO];
      if (!set) return false;
      return set.has(uid);
    },
    [blockedByDate]
  );

  // -----------------------------
  // AI SCHEDULING ENGINE
  // Production-grade scoring system for intelligent scheduling suggestions
  // -----------------------------

  /**
   * Scoring weights configuration
   * Adjust these to fine-tune AI behavior
   * Total should ideally sum to ~1.0 for clarity
   */
  const SCORING_WEIGHTS = {
    performance: 0.30,      // Employee performance score (0-100)
    attendance: 0.20,       // Attendance reliability (0-100)
    hoursBalance: 0.15,     // Fair distribution of hours
    availability: 0.15,     // Availability/preferences match
    teamChemistry: 0.10,    // Works well with scheduled team
    training: 0.05,         // Training needs/opportunities
    preferences: 0.05,      // Employee shift preferences
  };

  /**
   * Calculate comprehensive score for assigning an employee to a slot
   * 
   * @param {Object} employee - Employee object with uid, name, etc.
   * @param {Object} slot - Slot definition (id, label, side, hours, startTime, endTime)
   * @param {string} dateISO - Date in YYYY-MM-DD format
   * @param {Object} context - Additional context (current schedule, employee stats, etc.)
   * @returns {Object} Score breakdown with total score and detailed factors
   */
  const calculateEmployeeScore = useCallback((employee, slot, dateISO, context) => {
    if (!employee?.uid || !slot || !dateISO) {
      return { totalScore: 0, factors: {}, reasons: [] };
    }

    const stats = context.employeeStats?.[employee.uid] || {};
    const isBlockedForDate = context.isBlocked?.(dateISO, employee.uid) || false;
    
    // If blocked (approved time off), return zero score
    if (isBlockedForDate) {
      return {
        totalScore: 0,
        factors: {},
        reasons: ["Blocked: Approved time off for this date"],
        blocked: true,
      };
    }

    const factors = {};
    const reasons = [];
    let totalScore = 0;

    // 1. PERFORMANCE SCORE (0-30 points)
    const performanceScore = stats.performanceScore || 0;
    const performanceNormalized = Math.min(100, Math.max(0, performanceScore));
    factors.performance = (performanceNormalized / 100) * SCORING_WEIGHTS.performance * 100;
    totalScore += factors.performance;
    
    if (performanceScore >= 80) {
      reasons.push(`High performer (${performanceScore})`);
    } else if (performanceScore < 50) {
      reasons.push(`Performance concerns (${performanceScore})`);
    }

    // 2. ATTENDANCE RELIABILITY (0-20 points)
    const attendanceReliability = stats.attendanceReliability || 70; // Default to neutral
    const attendanceNormalized = Math.min(100, Math.max(0, attendanceReliability));
    factors.attendance = (attendanceNormalized / 100) * SCORING_WEIGHTS.attendance * 100;
    totalScore += factors.attendance;
    
    if (attendanceReliability >= 90) {
      reasons.push(`Excellent attendance (${attendanceReliability}%)`);
    } else if (attendanceReliability < 70) {
      reasons.push(`Attendance concerns (${attendanceReliability}%)`);
    }

    // 3. HOURS BALANCE (0-15 points)
    // Reward employees who are under-scheduled, penalize over-scheduled
    const hoursScheduled = stats.hoursScheduled || 0;
    const idealHours = 30; // Target hours per week
    const hoursDiff = idealHours - hoursScheduled;
    
    let hoursBalanceScore = 0;
    if (hoursDiff > 10) {
      // Under-scheduled by more than 10 hours - high priority
      hoursBalanceScore = 15;
      reasons.push(`Under-scheduled (${hoursScheduled}h, needs ${idealHours - hoursScheduled}h more)`);
    } else if (hoursDiff > 5) {
      // Under-scheduled by 5-10 hours
      hoursBalanceScore = 12;
      reasons.push(`Could use more hours (${hoursScheduled}h)`);
    } else if (hoursDiff >= -5) {
      // Within 5 hours of ideal - good balance
      hoursBalanceScore = 10;
    } else if (hoursDiff >= -10) {
      // Over-scheduled by 5-10 hours
      hoursBalanceScore = 5;
      reasons.push(`Already scheduled ${hoursScheduled}h this week`);
    } else {
      // Over-scheduled by more than 10 hours
      hoursBalanceScore = 0;
      reasons.push(`Over-scheduled (${hoursScheduled}h)`);
    }
    
    factors.hoursBalance = hoursBalanceScore;
    totalScore += hoursBalanceScore;

    // 4. AVAILABILITY & PREFERENCES (0-15 points)
    // Check if employee is already scheduled elsewhere today
    const daySchedule = context.schedulesByDate?.[dateISO] || {};
    const alreadyScheduledToday = Object.values(daySchedule).some(
      (emp) => emp?.uid === employee.uid
    );
    
    let availabilityScore = 0;
    const dayName = getDayNameFromISO(dateISO);
    const prefs = context.employeePreferences?.[employee.uid] || {
      preferredDays: [],
      preferredTimes: [],
      avoidDays: [],
      preferredStartTime: null,
      preferredEndTime: null,
    };

    if (alreadyScheduledToday) {
      availabilityScore = 0;
      reasons.push("Already scheduled for this day");
    } else {
      // Base availability score
      availabilityScore = 10;
      
      // Check preferred days
      if (prefs.preferredDays.length > 0) {
        if (prefs.preferredDays.includes(dayName)) {
          availabilityScore += 3;
          reasons.push(`Prefers ${dayName}`);
        }
      }
      
      // Check avoid days
      if (prefs.avoidDays.includes(dayName)) {
        availabilityScore -= 5;
        reasons.push(`Avoids ${dayName}`);
      }
      
      // Check preferred times
      const slotTimePeriod = getTimePeriod(slot.startTime);
      if (prefs.preferredTimes.length > 0 && slotTimePeriod) {
        if (prefs.preferredTimes.includes(slotTimePeriod)) {
          availabilityScore += 2;
          reasons.push(`Prefers ${slotTimePeriod} shifts`);
        }
      }
      
      // Check preferred time range
      if (prefs.preferredStartTime && prefs.preferredEndTime) {
        const inRange = isTimeInPreferredRange(slot.startTime, slot.endTime, prefs.preferredStartTime, prefs.preferredEndTime);
        if (inRange === true) {
          availabilityScore += 2;
          reasons.push("Matches preferred time range");
        } else if (inRange === false) {
          availabilityScore -= 2;
          reasons.push("Outside preferred time range");
        }
      }
    }
    
    factors.availability = availabilityScore;
    totalScore += availabilityScore;

    // 5. TEAM CHEMISTRY (0-10 points)
    // Check who else is scheduled for this day/side
    const sameSideEmployees = Object.entries(daySchedule)
      .filter(([slotId, emp]) => {
        if (!emp?.uid) return false;
        const slotDef = context.slots?.find((s) => s.id === slotId);
        return slotDef?.side === slot.side;
      })
      .map(([, emp]) => emp.uid);
    
    // For now, simple check: don't penalize, but could enhance with historical data
    // Future: Check historical schedules for team combinations that worked well
    let teamScore = 8; // Default neutral score
    
    // If this is the first person on this side, slightly boost
    if (sameSideEmployees.length === 0) {
      teamScore = 10;
      reasons.push("First person scheduled for this side");
    }
    
    factors.teamChemistry = teamScore;
    totalScore += teamScore;

    // 6. TRAINING CONSIDERATIONS (0-5 points)
    let trainingScore = 5; // Default
    if (stats.needsTraining) {
      // If needs training, slightly reduce score but don't eliminate
      trainingScore = 2;
      reasons.push("Training required");
    } else if (stats.performanceBand === "elite" || stats.performanceBand === "strong") {
      trainingScore = 5;
    }
    
    factors.training = trainingScore;
    totalScore += trainingScore;

    // 7. PREFERENCES (0-5 points)
    const prefsForScoring = context.employeePreferences?.[employee.uid] || {
      preferredDays: [],
      preferredTimes: [],
      avoidDays: [],
    };

    const dayNameForPrefs = getDayNameFromISO(dateISO);
    const slotTimePeriodForPrefs = getTimePeriod(slot.startTime);

    let preferenceScore = 5; // Default neutral

    // Boost if matches preferences
    if (prefsForScoring.preferredDays.includes(dayNameForPrefs)) {
      preferenceScore = 5;
      reasons.push("Preferred day match");
    } else if (prefsForScoring.preferredDays.length > 0) {
      preferenceScore = 3; // Not preferred but not avoided
    }

    if (slotTimePeriodForPrefs && prefsForScoring.preferredTimes.includes(slotTimePeriodForPrefs)) {
      preferenceScore = Math.min(5, preferenceScore + 1);
      reasons.push("Preferred time match");
    }

    // Penalize if on avoid list
    if (prefsForScoring.avoidDays.includes(dayNameForPrefs)) {
      preferenceScore = 0;
      reasons.push("Day is on avoid list");
    }

    factors.preferences = preferenceScore;
    totalScore += preferenceScore;

    // Normalize total score to 0-100 range
    const normalizedScore = Math.min(100, Math.max(0, totalScore));

    return {
      totalScore: Math.round(normalizedScore * 10) / 10, // Round to 1 decimal
      factors,
      reasons: reasons.length > 0 ? reasons : ["Good fit for this shift"],
      confidence: normalizedScore >= 70 ? "high" : normalizedScore >= 50 ? "medium" : "low",
    };
  }, [getDayNameFromISO, getTimePeriod, isTimeInPreferredRange]);

  /**
   * Get top N suggestions for a specific slot
   * 
   * @param {string} slotId - Slot ID to fill
   * @param {string} dateISO - Date in YYYY-MM-DD format
   * @param {number} topN - Number of top suggestions to return (default: 3)
   * @returns {Array} Array of suggestions with employee, score, and reasoning
   */
  const getSuggestionsForSlot = useCallback((slotId, dateISO, topN = 3) => {
    if (!slotId || !dateISO) return [];

    const slot = slots.find((s) => s.id === slotId);
    if (!slot) return [];

    // Get all available employees for this slot's side
    const availableEmployees = slot.side === "foh" 
      ? availablePools.foh 
      : availablePools.boh;

    if (availableEmployees.length === 0) {
      return [];
    }

    // Calculate scores for all available employees
    const suggestions = availableEmployees
      .map((employee) => {
        const scoreResult = calculateEmployeeScore(employee, slot, dateISO, {
          employeeStats,
          schedulesByDate,
          isBlocked,
          slots,
          employeePreferences,
        });

        return {
          employee,
          score: scoreResult.totalScore,
          factors: scoreResult.factors,
          reasons: scoreResult.reasons,
          confidence: scoreResult.confidence,
          blocked: scoreResult.blocked || false,
        };
      })
      .filter((s) => !s.blocked) // Remove blocked employees
      .sort((a, b) => b.score - a.score) // Sort by score descending
      .slice(0, topN); // Get top N

    return suggestions;
  }, [slots, availablePools, calculateEmployeeScore, employeeStats, schedulesByDate, isBlocked, employeePreferences]);

  /**
   * Load suggestions for a slot (with loading state)
   */
  const loadSuggestionsForSlot = useCallback((slotId, dateISO) => {
    if (!slotId || !dateISO) {
      setSuggestionsForSlot(null);
      return;
    }

    setLoadingSuggestions(true);
    
    // Use setTimeout to allow UI to update, then calculate
    setTimeout(() => {
      const suggestions = getSuggestionsForSlot(slotId, dateISO, 3);
      setSuggestionsForSlot({
        slotId,
        dateISO,
        suggestions,
      });
      setLoadingSuggestions(false);
    }, 50);
  }, [getSuggestionsForSlot]);

  /**
   * Generate AI suggestions for entire week
   * Returns suggestions for all empty slots across all days
   */
  const generateFullWeekSuggestions = useCallback(() => {
    setLoadingAiSuggestions(true);
    
    setTimeout(() => {
      const weekSuggestions = {};
      
      weekDays.forEach((day) => {
        const daySchedule = schedulesByDate[day.iso] || {};
        const daySuggestions = {};
        
        slots.forEach((slot) => {
          // Only suggest for empty slots
          if (!daySchedule[slot.id]) {
            const suggestions = getSuggestionsForSlot(slot.id, day.iso, 3);
            if (suggestions.length > 0) {
              daySuggestions[slot.id] = suggestions;
            }
          }
        });
        
        if (Object.keys(daySuggestions).length > 0) {
          weekSuggestions[day.iso] = daySuggestions;
        }
      });
      
      setAiSuggestions(weekSuggestions);
      setLoadingAiSuggestions(false);
      setShowAiSuggestions(true);
    }, 100);
  }, [weekDays, schedulesByDate, slots, getSuggestionsForSlot]);

 
  const closeBannersTimer = useRef(null);

  const clearBannersSoon = useCallback(() => {
    if (closeBannersTimer.current) clearTimeout(closeBannersTimer.current);
    closeBannersTimer.current = setTimeout(() => {
      setSaveMsg("");
      setErrorMsg("");
    }, 2500);
  }, []);

  useEffect(() => {
    return () => {
      if (closeBannersTimer.current) clearTimeout(closeBannersTimer.current);
    };
  }, []);

  const dirty = Boolean(dirtyByDate[selectedDate]);

  // -----------------------------
  // Completion logic (red → green)
  // -----------------------------
  const isDayComplete = useCallback(
    (scheduleObj) => {
      if (!scheduleObj) return false;
      return slots.every((s) => Boolean(scheduleObj[s.id]?.id));
    },
    [slots]
  );
  const dayCompletion = useMemo(() => {
    const map = {};
    weekDays.forEach((d) => {
      const sch = schedulesByDate[d.iso];
      const init = {};
      slots.forEach((s) => (init[s.id] = null));
      const effective = sch || init;
      map[d.iso] = isDayComplete(effective);
    });
    return map;
  }, [weekDays, schedulesByDate, slots, isDayComplete]);

  const isWeekComplete = useMemo(() => {
    return weekDays.every((d) => dayCompletion[d.iso]);
  }, [weekDays, dayCompletion]);

  const isWeekSaved = useMemo(() => {
    return weekDays.every((d) => savedDays[d.iso]);
  }, [weekDays, savedDays]);
  // -----------------------------
  // Schedule mutations (per day)
  // -----------------------------
  const writeScheduleForSelectedDate = useCallback(
    (nextSchedule) => {
      setSchedulesByDate((prev) => ({
        ...prev,
        [selectedDate]: nextSchedule,
      }));
    },
    [selectedDate]
  );

  const markDirtyForSelectedDate = useCallback(
    (nextDirty) => {
      setDirtyByDate((prev) => ({
        ...prev,
        [selectedDate]: Boolean(nextDirty),
      }));
    },
    [selectedDate]
  );

  const assignToSlot = useCallback(
    (slotId, employee) => {
      if (!slotId) return;
      if (isPublished) {
        setErrorMsg("Schedule is published and locked");
        clearBannersSoon();
        return;
      }

      const uid = employee?.uid || employee?.id;
      if (!uid) return;

      if (isBlocked(selectedDate, uid)) {
        setErrorMsg(`Unable to comply — approved day off already (${employee?.name || uid})`);
        setSaveMsg("");
        clearBannersSoon();
        return;
      }

      const next = {
        ...currentSchedule,
        [slotId]: {
          ...employee,
          uid,
          id: uid,
        },
      };
      writeScheduleForSelectedDate(next);
      markDirtyForSelectedDate(true);
      setSaveMsg("");
      setErrorMsg("");
    },
    [
      currentSchedule,
      markDirtyForSelectedDate,
      selectedDate,
      writeScheduleForSelectedDate,
      isBlocked,
      isPublished,
      clearBannersSoon,
    ]
  );

  const clearSlot = useCallback(
    (slotId) => {
      if (!slotId) return;
      const next = {
        ...currentSchedule,
        [slotId]: null,
      };
      writeScheduleForSelectedDate(next);
      markDirtyForSelectedDate(true);
      setSaveMsg("");
      setErrorMsg("");
    },
    [currentSchedule, writeScheduleForSelectedDate, markDirtyForSelectedDate]
  );

  const handleDrop = useCallback(
    (slotId, payload) => {
      const employee = payload?.employee || payload; // Support both formats
      const fromSlotId = payload?.fromSlotId;
      const uid = employee?.uid || employee?.id;

      if (!uid || !slotId) return;

      if (isBlocked(selectedDate, uid)) {
        setErrorMsg(`Unable to comply — approved day off already (${employee?.name || uid})`);
        setSaveMsg("");
        clearBannersSoon();
        return;
      }
      if (isPublished) {
        setErrorMsg("Schedule is published and locked");
        clearBannersSoon();
        return;
      }

      if (fromSlotId && fromSlotId !== slotId) {
        const next = {
          ...currentSchedule,
          [fromSlotId]: null,
          [slotId]: { ...employee, uid, id: uid },
        };
        writeScheduleForSelectedDate(next);
      } else {
        assignToSlot(slotId, { ...employee, uid, id: uid });
        return;
      }

      markDirtyForSelectedDate(true);
      setSaveMsg("");
      setErrorMsg("");
    },
    [
      currentSchedule,
      assignToSlot,
      markDirtyForSelectedDate,
      selectedDate,
      writeScheduleForSelectedDate,
      isBlocked,
      isPublished,
      clearBannersSoon,
    ]
  );

  /**
   * Apply AI suggestion to a specific slot
   */
  const applyAiSuggestion = useCallback((dateISO, slotId, employee) => {
    if (!dateISO || !slotId || !employee) return;
    
    // Switch to the target date first
    const targetDay = weekDays.find((d) => d.iso === dateISO);
    if (!targetDay) return;
    
    const originalIndex = activeDayIndex;
    setActiveDayIndex(targetDay.index);
    
    // Wait for state to update, then assign
    setTimeout(() => {
      // Directly update the schedule for that date
      setSchedulesByDate((prev) => {
        const daySchedule = prev[dateISO] || {};
        const uid = employee?.uid || employee?.id;
        
        if (!uid) return prev;
        
        // Check if blocked
        if (isBlocked(dateISO, uid)) {
          setErrorMsg(`Unable to comply — approved day off already (${employee?.name || uid})`);
          clearBannersSoon();
          return prev;
        }
        
        const next = {
          ...prev,
          [dateISO]: {
            ...daySchedule,
            [slotId]: { ...employee, uid, id: uid },
          },
        };
        
        // Mark as dirty
        setDirtyByDate((prevDirty) => ({
          ...prevDirty,
          [dateISO]: true,
        }));
        
        return next;
      });
      
      // Update suggestions to remove this slot
      setAiSuggestions((prev) => {
        if (!prev || !prev[dateISO]) return prev;
        const next = { ...prev };
        const daySuggestions = { ...next[dateISO] };
        delete daySuggestions[slotId];
        if (Object.keys(daySuggestions).length === 0) {
          delete next[dateISO];
        } else {
          next[dateISO] = daySuggestions;
        }
        return Object.keys(next).length > 0 ? next : null;
      });
      
      // Restore original day index
      setTimeout(() => {
        setActiveDayIndex(originalIndex);
      }, 100);
    }, 50);
  }, [weekDays, activeDayIndex, isBlocked, clearBannersSoon]);

  const handleClearDay = useCallback(() => {
    const cleared = {};
    slots.forEach((s) => (cleared[s.id] = null));
    writeScheduleForSelectedDate(cleared);
    markDirtyForSelectedDate(true);
    setSaveMsg("");
    setErrorMsg("");
  }, [slots, writeScheduleForSelectedDate, markDirtyForSelectedDate]);

  // -----------------------------
  // Firestore paths
  // schedules/{weekEndingISO}
  // -----------------------------
  const scheduleDocRef = useMemo(() => {
    return doc(
      db,
      "companies",
      companyId,
      "restaurants",
      restaurantId,
      "schedules",
      weekEndingDate
    );
  }, [companyId, restaurantId, weekEndingDate]);

  // -----------------------------
  // Serialize/Deserialize schedule for Firestore
  // We store ONLY uid strings per slot to avoid name collisions
  // days: { [isoDate]: { slots: { [slotId]: uid|null } } }
  // -----------------------------
  const scheduleToFirestoreDays = useCallback(
    (byDate) => {
      const out = {};
      weekDays.forEach((d) => {
        const sch = byDate[d.iso];
        const slotsObj = {};
        slots.forEach((s) => {
          const emp = sch?.[s.id];
          const uid = emp?.uid || emp?.id || null;
          slotsObj[s.id] = uid || null;
        });
        out[d.iso] = {
          slots: slotsObj,
        };
      });
      return out;
    },
    [slots, weekDays]
  );

  const buildEmployeeIndex = useCallback((poolState) => {
    const idx = {};
    ["foh", "boh"].forEach((side) => {
      (poolState?.[side] || []).forEach((e) => {
        const uid = e?.uid || e?.id;
        if (uid) idx[uid] = { ...e, uid, id: uid };
      });
    });
    return idx;
  }, []);

  const firestoreDaysToSchedule = useCallback(
    (daysObj, poolState) => {
      const empIndex = buildEmployeeIndex(poolState);
      const result = {};
      const safeDays = daysObj && typeof daysObj === "object" ? daysObj : {};

      Object.keys(safeDays).forEach((iso) => {
        const slotsMap = safeDays[iso]?.slots || {};
        const sch = {};
        slots.forEach((s) => {
          const uid = slotsMap?.[s.id] || null;
          sch[s.id] = uid ? (empIndex[uid] || { uid, id: uid, name: uid, subRole: "—" }) : null;
        });
        result[iso] = sch;
      });

      return result;
    },
    [slots, buildEmployeeIndex]
  );

  const loadRankingSnapshot = useCallback(async (periodId) => {
    if (!periodId) return;

    setLoadingRanking(true);

    try {
      const ref = doc(
        db,
        "companies",
        companyId,
        "restaurants",
        restaurantId,
        "rankingSnapshots",
        periodId
      );

      const snap = await getDoc(ref);

      if (snap.exists()) {
        setRankingSnapshot(snap.data());
      } else {
        setRankingSnapshot(null);
      }
    } catch (err) {
      console.error("Failed to load ranking snapshot", err);
      setRankingSnapshot(null);
    } finally {
      setLoadingRanking(false);
    }
  }, [companyId, restaurantId]);

  // -----------------------------
  // Load schedule week from Firestore
  // -----------------------------
  const loadWeek = useCallback(async () => {
    setLoadingWeek(true);
    try {
      const snap = await getDoc(scheduleDocRef);
      if (!snap.exists()) {
        setSchedulesByDate((prev) => {
          setWeekStatus("draft");

          // keep local edits for other weeks; clear only this week view
          const next = { ...prev };
          weekDays.forEach((d) => {
            if (next[d.iso]) delete next[d.iso];
          });
          return next;
        });
        setDirtyByDate((prev) => {
          const next = { ...prev };
          weekDays.forEach((d) => {
            if (next[d.iso]) delete next[d.iso];
          });
          return next;
        });
        setLoadingWeek(false);
        return;
      }

      const data = snap.data() || {};
      const status = data.status || "draft";
      setWeekStatus(status);

      setIsPublished(data.status === "published");

      const fsDays = data.days || {};
      const hydrated = firestoreDaysToSchedule(fsDays, pools);

      setSchedulesByDate((prev) => {
        const next = { ...prev };
        weekDays.forEach((d) => {
          if (hydrated[d.iso]) next[d.iso] = hydrated[d.iso];
          else {
            const blank = {};
            slots.forEach((s) => (blank[s.id] = null));
            next[d.iso] = blank;
          }
        });
        return next;
      });

      setDirtyByDate((prev) => {
        const next = { ...prev };
        weekDays.forEach((d) => (next[d.iso] = false));
        return next;
      });
    } catch (e) {
      setErrorMsg("Unable to load schedule week from Firestore");
      setSaveMsg("");
      clearBannersSoon();
    } finally {
      setLoadingWeek(false);
    }
  }, [scheduleDocRef, weekDays, firestoreDaysToSchedule, pools, slots, clearBannersSoon]);

  // -----------------------------
  // Save ACTIVE DAY to Firestore (merge)
  // - Writes days[selectedDate].slots
  // - Leaves other days intact
  // - Stores ONLY uid strings
  // -----------------------------
  const saveActiveDayToFirestore = useCallback(async () => {
    if (!selectedDate) return;
    if (saving) return;

    setSaving(true);
    setSaveMsg("");
    setErrorMsg("");

    try {
      const slotsObj = {};

      slots.forEach((s) => {
        const emp = currentSchedule[s.id];

        // NOTE: normalize to UID only; explicit null if empty
        const uid = emp?.uid ?? null;
        slotsObj[s.id] = uid;
      });

      const payload = {
        status: "draft", // NOTE: day save always keeps week in draft
        updatedAt: serverTimestamp(),
        days: {
          [selectedDate]: {
            slots: slotsObj,
            updatedAt: serverTimestamp(),
          },
        },
      };

      await setDoc(scheduleDocRef, payload, { merge: true });

      setSavedDays((prev) => ({
        ...prev,
        // NOTE: mark THIS ISO day as saved so Save Week can unlock later
        [weekDays[activeDayIndex].iso]: true,
      }));

      markDirtyForSelectedDate(false);
      setSaveMsg(`Saved — ${selectedDate}`);
      clearBannersSoon();
    } catch (e) {
      setErrorMsg("Save failed — Firestore error");
      clearBannersSoon();
    } finally {
      setSaving(false);
    }
  }, [
    selectedDate,
    saving,
    slots,
    currentSchedule,
    scheduleDocRef,
    weekDays,
    activeDayIndex,
    markDirtyForSelectedDate,
    clearBannersSoon,
  ]);

  // -----------------------------
  // Publish WEEK (lock schedule)
  // -----------------------------
  const publishWeekToFirestore = useCallback(async () => {
    if (saving) return;
    if (!isWeekComplete) return;
    if (weekStatus !== "draft") return;

    setSaving(true);
    setPublishing(true);

    try {
      // Build payload for all days (UID-only per slot)
      const daysPayload = {};

      weekDays.forEach((d) => {
        const daySchedule = schedulesByDate[d.iso] || {};
        const slotsObj = {};

        slots.forEach((s) => {
          const emp = daySchedule[s.id];
          const uid = emp?.uid ?? null;
          slotsObj[s.id] = uid;
        });

        daysPayload[d.iso] = {
          slots: slotsObj,
          updatedAt: serverTimestamp(),
        };
      });

      await setDoc(
        scheduleDocRef,
        {
          status: "published",
          updatedAt: serverTimestamp(),
          days: daysPayload,
        },
        { merge: true }
      );

      setWeekStatus("published");
      setIsPublished(true);
      setSaveMsg(`Week published — Week Ending ${weekEndingDate}`);
      clearBannersSoon();
    } catch (e) {
      setErrorMsg("Publish failed — Firestore error");
      clearBannersSoon();
    } finally {
      setSaving(false);
      setPublishing(false);
    }
  }, [saving, isWeekComplete, weekStatus, weekDays, schedulesByDate, slots, scheduleDocRef, weekEndingDate, clearBannersSoon]);

  // -----------------------------
  // Save ALL WEEK (draft only)
  // -----------------------------
  const saveFullWeekToFirestore = useCallback(async () => {
    if (saving) return;

    setSaving(true);
    setSaveMsg("");
    setErrorMsg("");

    try {
      const daysPayload = {};

      weekDays.forEach((d) => {
        const daySchedule = schedulesByDate[d.iso] || {};
        const slotsObj = {};

        slots.forEach((s) => {
          const emp = daySchedule[s.id];

          // NOTE: enforce UID-only storage across entire week
          const uid = emp?.uid ?? null;
          slotsObj[s.id] = uid;
        });

        daysPayload[d.iso] = {
          slots: slotsObj,
          updatedAt: serverTimestamp(),
        };
      });

      await setDoc(
        scheduleDocRef,
        {
          status: "draft", // NOTE: Save Week never publishes
          updatedAt: serverTimestamp(),
          days: daysPayload,
        },
        { merge: true }
      );

      setSaveMsg("Week saved (draft)");
      clearBannersSoon();
    } catch (e) {
      setErrorMsg("Week save failed — Firestore error");
      clearBannersSoon();
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    weekDays,
    schedulesByDate,
    slots,
    scheduleDocRef,
    clearBannersSoon,
  ]);

  // -----------------------------
  // Requests loading (approved)
  // Collection: companies/{companyId}/restaurants/{restaurantId}/scheduleRequests
  // Expected fields: uid, name, dateISO, status, weekEndingISO, reason
  // -----------------------------
  const loadApprovedRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const reqRef = collection(db, "companies", companyId, "restaurants", restaurantId, "scheduleRequests");
      const q = query(
        reqRef,
        where("status", "==", "approved"),
        where("weekEndingISO", "==", weekEndingDate)
      );

      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const normalized = rows
        .map((r) => {
          const uid = String(r.uid || "").trim();
          const name = String(r.name || "").trim() || uid;
          const dateISO = String(r.dateISO || "").trim();
          const status = String(r.status || "").trim();
          const reason = String(r.reason || "").trim();
          const weekEndingISO = String(r.weekEndingISO || "").trim();
          return { uid, name, dateISO, status, reason, weekEndingISO };
        })
        .filter((x) => x.uid && x.dateISO);

      setApprovedRequests(normalized);
    } catch (e) {
      setApprovedRequests([]);
    } finally {
      setLoadingRequests(false);
    }
  }, [companyId, restaurantId, weekEndingDate]);

  // -----------------------------
  // Week ending change behavior
  // - Enforce Sundays ONLY:
  //   If user picks a non-Sunday with native date input, we auto-correct to nearest upcoming Sunday.
  // -----------------------------
  const handleWeekEndingChange = useCallback(
    (nextISO) => {
      if (!nextISO) return;

      if (!isSundayISO(nextISO)) {
        const corrected = nearestSundayISO(nextISO);
        if (corrected) {
          setWeekEndingDate(corrected);
          setActiveDayIndex(0);
          setErrorMsg("Week Ending must be a Sunday — auto-corrected");
          setSaveMsg("");
          clearBannersSoon();
          return;
        }
      }

      setWeekEndingDate(nextISO);
      setActiveDayIndex(0);
      setSaveMsg("");
      setErrorMsg("");
      setRequestsOpen(false);
    },
    [isSundayISO, nearestSundayISO, clearBannersSoon]
  );

  // -----------------------------
  // Lifecycle: load staff once, then load week + requests per week
  // -----------------------------
  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  useEffect(() => {
    // When week changes OR staff loads, pull week schedule
    if (!weekEndingDate) return;
    loadWeek();
    loadApprovedRequests();
  }, [weekEndingDate, pools, loadWeek, loadApprovedRequests]);

  // 🔧 CHANGE (Catman): load ranking snapshot when week changes
  useEffect(() => {
    if (!weekEndingDate) return;
    loadRankingSnapshot(weekEndingDate);
  }, [weekEndingDate, loadRankingSnapshot]);

  // -----------------------------
  // "Requests" bubble (first bubble)
  // -----------------------------
  const requestsCount = useMemo(() => approvedRequests.length, [approvedRequests]);

  const requestsSummary = useMemo(() => {
    const byDay = {};
    approvedRequests.forEach((r) => {
      if (!byDay[r.dateISO]) byDay[r.dateISO] = [];
      byDay[r.dateISO].push(r);
    });
    return byDay;
  }, [approvedRequests]);

  // -----------------------------
  // Mobile: Get unique positions from slots
  // -----------------------------
  const uniquePositions = useMemo(() => {
    const positions = new Set();
    slots.forEach((slot) => {
      positions.add(slot.label);
    });
    return Array.from(positions).sort();
  }, [slots]);

  // -----------------------------
  // Mobile: Filter employees by selected position
  // -----------------------------
  const employeesForPosition = useMemo(() => {
    if (!selectedPosition) return [];
    // Find the slot to determine which side (foh/boh) it belongs to
    const slot = slots.find((s) => s.label === selectedPosition);
    if (!slot) return [];
    
    // Get employees from the appropriate side
    const sideEmployees = slot.side === "foh" ? pools.foh : pools.boh;
    
    // Filter out already assigned employees for this day
    return sideEmployees.filter((emp) => !assignedEmployeeIds.has(emp.id));
  }, [selectedPosition, slots, pools, assignedEmployeeIds]);

  // -----------------------------
  // Mobile: Filter slots by selected position
  // -----------------------------
  const slotsForPosition = useMemo(() => {
    if (!selectedPosition) return [];
    return slots.filter((slot) => slot.label === selectedPosition);
  }, [selectedPosition, slots]);

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <div className="sched-wrap">
      <div className="sched-topbar">
        <div className="sched-title">
          <div className="sched-h2">Scheduling</div>
          <div
            className={`sched-status sched-status--${weekStatus}`}
            style={{ fontSize: 13, fontWeight: 700 }}
          >
            Status: {weekStatus.toUpperCase()}
          </div>

          <div className="sched-sub">Manual drag & drop scheduler (Phase 1)</div>
        </div>

        <div className="sched-controls">
          {/* Desktop: Week strip: Requests + Mon..Sun */}
          <div className="sched-weekstrip sched-weekstrip--desktop" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              className={[
                "sched-day",
                "sched-day--requests",
                requestsOpen ? "sched-day--active" : "",
                requestsCount > 0 ? "sched-day--todo" : "sched-day--done",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => {
                setRequestsOpen((v) => !v);
                setSaveMsg("");
                setErrorMsg("");
              }}
              title={requestsCount > 0 ? `${requestsCount} approved request(s)` : "No approved requests"}
            >
              Requests {requestsCount > 0 ? `(${requestsCount})` : ""}
            </button>

            {weekDays.map((d) => {
              const isActive = d.index === activeDayIndex && !requestsOpen;
              const done = Boolean(dayCompletion[d.iso]);
              const cls = [
                "sched-day",
                isActive ? "sched-day--active" : "",
                done ? "sched-day--done" : "sched-day--todo",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <button
                  key={d.iso}
                  type="button"
                  className={cls}
                  onClick={() => {
                    setActiveDayIndex(d.index);
                    setRequestsOpen(false);
                    setSaveMsg("");
                    setErrorMsg("");
                  }}
                  title={done ? "Complete" : "Incomplete"}
                >
                  {d.label}
                </button>
              );
            })}
          </div>

          {/* Mobile: Slider for Requests + Mon..Sun */}
          <div className="sched-weekstrip sched-weekstrip--mobile">
            <div className="sched-day-slider">
              <div 
                className="sched-day-slider__track"
                style={{ 
                  transform: `translateX(-${daySliderIndex * 100}%)`,
                  display: "flex",
                  gap: 8,
                  transition: "transform 0.3s ease"
                }}
              >
                <button
                  type="button"
                  className={[
                    "sched-day",
                    "sched-day--requests",
                    requestsOpen ? "sched-day--active" : "",
                    requestsCount > 0 ? "sched-day--todo" : "sched-day--done",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => {
                    setRequestsOpen((v) => !v);
                    setSaveMsg("");
                    setErrorMsg("");
                  }}
                  style={{ minWidth: "100px", flexShrink: 0 }}
                >
                  Requests {requestsCount > 0 ? `(${requestsCount})` : ""}
                </button>

                {weekDays.map((d) => {
                  const isActive = d.index === activeDayIndex && !requestsOpen;
                  const done = Boolean(dayCompletion[d.iso]);
                  const cls = [
                    "sched-day",
                    isActive ? "sched-day--active" : "",
                    done ? "sched-day--done" : "sched-day--todo",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <button
                      key={d.iso}
                      type="button"
                      className={cls}
                      onClick={() => {
                        setActiveDayIndex(d.index);
                        setRequestsOpen(false);
                        setSaveMsg("");
                        setErrorMsg("");
                      }}
                      style={{ minWidth: "100px", flexShrink: 0 }}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
              <div className="sched-day-slider__controls">
                <button
                  type="button"
                  className="sched-day-slider__btn"
                  onClick={() => setDaySliderIndex(Math.max(0, daySliderIndex - 1))}
                  disabled={daySliderIndex === 0}
                >
                  ←
                </button>
                <div className="sched-day-slider__dots">
                  {Array.from({ length: Math.ceil((weekDays.length + 1) / 3) }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`sched-day-slider__dot ${i === Math.floor(daySliderIndex / 3) ? "active" : ""}`}
                      onClick={() => setDaySliderIndex(i * 3)}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="sched-day-slider__btn"
                  onClick={() => setDaySliderIndex(Math.min(Math.ceil((weekDays.length + 1) / 3) * 3 - 3, daySliderIndex + 1))}
                  disabled={daySliderIndex >= Math.ceil((weekDays.length + 1) / 3) * 3 - 3}
                >
                  →
                </button>
              </div>
            </div>
          </div>

          {/* Desktop: Week ending selector */}
          <label className="sched-label sched-label--desktop" style={{ marginLeft: 12 }}>
            Week Ending
            <input
              className="sched-date"
              type="date"
              value={weekEndingDate}
              onChange={(e) => handleWeekEndingChange(e.target.value)}
            />
          </label>

          {/* Mobile: Week ending + Clear side by side */}
          <div className="sched-mobile-row">
            <label className="sched-label sched-label--mobile">
              Week Ending
              <input
                className="sched-date"
                type="date"
                value={weekEndingDate}
                onChange={(e) => handleWeekEndingChange(e.target.value)}
              />
            </label>

            <button
              className="sched-btn"
              type="button"
              onClick={handleClearDay}
              disabled={isPublished || requestsOpen || loadingWeek}
            >
              Clear
            </button>
          </div>

          {/* Desktop: Clear button */}
          <button
            className="sched-btn sched-btn--desktop"
            type="button"
            onClick={handleClearDay}
            disabled={isPublished || requestsOpen || loadingWeek}
          >
            Clear
          </button>

          {/* Desktop: Save ACTIVE DAY */}
          <button
            className="sched-btn sched-btn--primary sched-btn--desktop"
            type="button"
            onClick={saveActiveDayToFirestore}
            disabled={
              isPublished ||
              requestsOpen ||
              saving ||
              loadingWeek ||
              !dirty ||
              !dayCompletion[weekDays[activeDayIndex].iso]
            }
            title={
              !dayCompletion[weekDays[activeDayIndex].iso]
                ? "Fill all slots for this day to enable Save"
                : !dirty
                ? "No changes"
                : "Save active day"
            }
          >
            {saving ? "Saving…" : "Save Day"}
          </button>

          {/* Desktop: Save FULL WEEK */}
          <button
            className="sched-btn sched-btn--desktop"
            type="button"
            onClick={saveFullWeekToFirestore}
            disabled={
              isPublished ||
              requestsOpen ||
              saving ||
              loadingWeek ||
              !isWeekComplete ||
              !isWeekSaved
            }
            title={
              !isWeekComplete
                ? "Complete all 7 days to enable Save Week"
                : !isWeekSaved
                ? "Save each day before saving the week"
                : "Save full week"
            }
          >
            Save Week
          </button>

          {/* Desktop: Publish Week */}
          <button
            className="sched-btn sched-btn--danger sched-btn--desktop"
            type="button"
            onClick={publishWeekToFirestore}
            disabled={publishing || isPublished || !isWeekComplete}
            title={
              isPublished
                ? "Schedule already published"
                : !isWeekComplete
                ? "Complete all days before publishing"
                : "Publish and lock schedule"
            }
          >
            {publishing ? "Publishing…" : isPublished ? "Published" : "Publish Week"}
          </button>

          {/* Mobile: Save Day + Save Week side by side */}
          <div className="sched-mobile-row">
            <button
              className="sched-btn sched-btn--primary sched-btn--mobile"
              type="button"
              onClick={saveActiveDayToFirestore}
              disabled={
                isPublished ||
                requestsOpen ||
                saving ||
                loadingWeek ||
                !dirty ||
                !dayCompletion[weekDays[activeDayIndex].iso]
              }
            >
              {saving ? "Saving…" : "Save Day"}
            </button>

            <button
              className="sched-btn sched-btn--mobile"
              type="button"
              onClick={saveFullWeekToFirestore}
              disabled={
                isPublished ||
                requestsOpen ||
                saving ||
                loadingWeek ||
                !isWeekComplete ||
                !isWeekSaved
              }
            >
              Save Week
            </button>
          </div>

          {/* Mobile: Publish Week */}
          <button
            className="sched-btn sched-btn--danger sched-btn--mobile"
            type="button"
            onClick={publishWeekToFirestore}
            disabled={publishing || isPublished || !isWeekComplete}
          >
            {publishing ? "Publishing…" : isPublished ? "Published" : "Publish Week"}
          </button>
        </div>
      </div>

      {isPublished && (
        <div className="sched-banner" style={{ background: "#5b1f1f", borderColor: "#ff5a5a" }}>
          <strong>Schedule Locked:</strong> This week has been published and cannot be edited.
        </div>
      )}

      {(saveMsg || errorMsg) && (
        <div className="sched-banner" style={{ marginBottom: 10 }}>
          {errorMsg ? <span style={{ fontWeight: 700 }}>{errorMsg}</span> : null}
          {!errorMsg && saveMsg ? <span style={{ fontWeight: 700 }}>{saveMsg}</span> : null}
        </div>
      )}

      {loadingStaff ? <div className="sched-banner">Loading staff…</div> : null}

      {loadingWeek ? <div className="sched-banner">Loading schedule week…</div> : null}

      {/* Mobile: Performance Rankings */}
      <div className="sched-mobile-section sched-mobile-performance">
        <div className="metric-card info">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
            }}
            onClick={() => setShowRanking(!showRanking)}
          >
            <div className="metric-title">
              Performance Rankings
              {rankingSnapshot?.periodLabel ? ` (${rankingSnapshot.periodLabel})` : ""}
            </div>
            <div>{showRanking ? "▾" : "▸"}</div>
          </div>

          {showRanking && (
            <div style={{ marginTop: 10 }}>
              {loadingRanking ? (
                <div className="metric-subtext">Loading rankings…</div>
              ) : !rankingSnapshot ? (
                <div className="metric-subtext">No ranking snapshot for this period</div>
              ) : (
                Object.entries(rankingSnapshot.bands || {}).map(([band, employees]) => (
                  <div key={band} style={{ marginBottom: 10 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        marginBottom: 6,
                        textTransform: "capitalize",
                      }}
                    >
                      {band}
                    </div>

                    {employees.length === 0 ? (
                      <div className="metric-subtext">—</div>
                    ) : (
                      employees.map((emp) => (
                        <div
                          key={emp.uid}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 14,
                            padding: "2px 0",
                          }}
                        >
                          <span>
                            {emp.name} — {emp.role}
                          </span>
                          <span>{emp.score}</span>
                        </div>
                      ))
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile: Position Selector */}
      <div className="sched-mobile-section sched-mobile-selector">
        <label className="sched-label">
          Select Position
          <select
            className="sched-date"
            value={selectedPosition || ""}
            onChange={(e) => setSelectedPosition(e.target.value || null)}
            style={{ width: "100%" }}
          >
            <option value="">-- Select Position --</option>
            {uniquePositions.map((pos) => (
              <option key={pos} value={pos}>
                {pos}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Requests dropdown panel */}
      {requestsOpen ? (
        <div className="metric-card info" style={{ marginTop: 12 }}>
          <div className="metric-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Approved Requests (Week Ending {weekEndingDate})</span>
            <button
              type="button"
              className="sched-btn"
              onClick={() => setRequestsOpen(false)}
              style={{ padding: "6px 10px" }}
            >
              Close
            </button>
          </div>

          {loadingRequests ? (
            <div className="metric-subtext">Loading requests…</div>
          ) : approvedRequests.length === 0 ? (
            <div className="metric-subtext">No approved requests for this week</div>
          ) : (
            <div style={{ marginTop: 10 }}>
              {weekDays.map((d) => {
                const list = requestsSummary[d.iso] || [];
                if (!list.length) return null;

                return (
                  <div key={d.iso} style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>{d.label}</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {list.map((r, idx) => (
                        <div
                          key={`${r.uid}-${idx}`}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                            padding: "8px 10px",
                            border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: 10,
                            background: "rgba(255,255,255,0.03)",
                          }}
                        >
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <div style={{ fontWeight: 800 }}>{r.name}</div>
                            <div style={{ opacity: 0.9, fontSize: 13 }}>UID: {r.uid}</div>
                            {r.reason ? (
                              <div style={{ opacity: 0.9, fontSize: 13 }}>Reason: {r.reason}</div>
                            ) : null}
                          </div>

                          <div style={{ textAlign: "right", fontSize: 13, opacity: 0.9 }}>
                            <div>Status: Approved</div>
                            <div>Date: {r.dateISO}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="metric-subtext" style={{ marginTop: 10 }}>
            Scheduling rule: If an employee has an approved request for a day, the system will block dropping them into a slot for that date.
          </div>
        </div>
      ) : null}

      {/* Mobile: Two-column layout (50-50) for selected position */}
      {!requestsOpen && selectedPosition ? (
        <div className="sched-mobile-layout">
          {/* Left Column: Employees for selected position */}
          <div className="sched-mobile-left">
            <div className="sched-pool">
              <div className="sched-poolHead">
                <div className="sched-poolTitle">{selectedPosition} Employees</div>
                <div className="sched-poolSub">{employeesForPosition.length} available</div>
              </div>
              <div className="sched-poolList">
                {employeesForPosition.length === 0 ? (
                  <div className="sched-empty">No employees found for {selectedPosition}</div>
                ) : (
                  employeesForPosition.map((emp) => {
                    const blocked = isBlocked(selectedDate, emp.uid);
                    const assigned = assignedEmployeeIds.has(emp.id);
                    const cls = [
                      "sched-emp",
                      blocked ? "sched-emp--unavailable" : "",
                      assigned ? "sched-emp--assigned" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <div
                        key={emp.id}
                        className={cls}
                        draggable={!blocked && !assigned}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("application/json", JSON.stringify(emp));
                          e.dataTransfer.effectAllowed = "move";
                        }}
                      >
                        <div className="sched-empName">{emp.name}</div>
                        <div className="sched-empSub">{emp.role || emp.position || "Staff"}</div>
                        {blocked && <div className="sched-empStatus">Blocked</div>}
                        {assigned && <div className="sched-empStatus">Assigned</div>}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Schedule slots for selected position */}
          <div className="sched-mobile-right">
            <div className="sched-board">
              <div className="sched-boardHead">
                <div className="sched-boardTitle">{selectedPosition} Schedule</div>
                <div className="sched-boardSub">{selectedDate}</div>
              </div>
              <div className="sched-boardCols">
                <div className="sched-colBody">
                  {slotsForPosition.length === 0 ? (
                    <div className="sched-empty">No slots found for {selectedPosition}</div>
                  ) : (
                    slotsForPosition.map((slot) => {
                      const assigned = currentSchedule[slot.id];
                      const cls = [
                        "sched-slot",
                        assigned ? "sched-slot--filled" : "",
                      ]
                        .filter(Boolean)
                        .join(" ");

                      return (
                        <div
                          key={slot.id}
                          className={cls}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                            e.currentTarget.classList.add("sched-slot--over");
                          }}
                          onDragLeave={(e) => {
                            e.currentTarget.classList.remove("sched-slot--over");
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.currentTarget.classList.remove("sched-slot--over");
                            try {
                              const emp = JSON.parse(e.dataTransfer.getData("application/json"));
                              handleDrop(slot.id, emp);
                            } catch (err) {
                              console.error("Drop failed", err);
                            }
                          }}
                        >
                          <div className="sched-slotTop">
                            <div className="sched-slotLabel">{slot.label}</div>
                            <button
                              type="button"
                              className="sched-clear"
                              onClick={() => clearSlot(slot.id)}
                              disabled={isPublished || !assigned}
                            >
                              ✕
                            </button>
                          </div>
                          {assigned ? (
                            <div className="sched-assigned">
                              <div className="sched-assignedName">{assigned.name}</div>
                              <div className="sched-assignedSub">
                                {slot.startTime} - {slot.endTime} ({slot.hours}h)
                              </div>
                            </div>
                          ) : (
                            <div className="sched-slotEmpty">Drop employee here</div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Main grid - Desktop only (hidden when mobile layout is active) */}
      {!requestsOpen && !selectedPosition ? (
        <div className="sched-grid">
          {/* Column 1: Left Column (Stacked: FOH Pool + BOH Pool) */}
          <div className="sched-left">
            <EmployeePool
              title="Front of House"
              side="foh"
              employees={availablePools.foh}
              selectedDate={selectedDate}
              isBlocked={isBlocked}
              employeeStats={employeeStats}
              rankingSnapshot={rankingSnapshot}
              previousRankingSnapshot={previousRankingSnapshot}
            />

            {/* 5px gap */}
            <div className="sched-gap" />

            <EmployeePool
              title="Back of House"
              side="boh"
              employees={availablePools.boh}
              selectedDate={selectedDate}
              isBlocked={isBlocked}
              employeeStats={employeeStats}
              rankingSnapshot={rankingSnapshot}
              previousRankingSnapshot={previousRankingSnapshot}
            />
          </div>

          {/* Column 2: Shift Board (Center - Focal Point) */}
          <div className="sched-center">
            <ShiftBoard
              date={selectedDate}
              slots={slots}
              schedule={currentSchedule}
              onDrop={handleDrop}
              onClearSlot={clearSlot}
              onSuggest={loadSuggestionsForSlot}
              suggestions={suggestionsForSlot}
              loadingSuggestions={loadingSuggestions}
            />
          </div>

          {/* Column 3: Right Column (Performance Rankings + Coverage Recommendations) */}
          <div className="sched-right">
            {/* Performance Rankings */}
            <div className="metric-card info">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                }}
                onClick={() => setShowRanking(!showRanking)}
              >
                <div className="metric-title">
                  Performance Rankings
                  {rankingSnapshot?.periodLabel ? ` (${rankingSnapshot.periodLabel})` : ""}
                </div>
                <div>{showRanking ? "▾" : "▸"}</div>
              </div>

              {showRanking && (
                <div style={{ marginTop: 10 }}>
                  {loadingRanking ? (
                    <div className="metric-subtext">Loading rankings…</div>
                  ) : !rankingSnapshot ? (
                    <div className="metric-subtext">No ranking snapshot for this period</div>
                  ) : (
                    Object.entries(rankingSnapshot.bands || {}).map(([band, employees]) => (
                      <div key={band} style={{ marginBottom: 10 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            marginBottom: 6,
                            textTransform: "capitalize",
                          }}
                        >
                          {band}
                        </div>

                        {employees.length === 0 ? (
                          <div className="metric-subtext">—</div>
                        ) : (
                          employees.map((emp) => (
                            <div
                              key={emp.uid}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: 14,
                                padding: "2px 0",
                              }}
                            >
                              <span>
                                {emp.name} — {emp.role}
                              </span>
                              <span>{emp.score}</span>
                            </div>
                          ))
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* 5px gap */}
            <div className="sched-gap" />

            {/* Coverage Recommendations */}
            <div className="metric-card info">
              <div className="metric-title">Coverage Recommendations</div>
              <div style={{ marginTop: 10, fontSize: 13 }}>
                {(() => {
                  // Calculate coverage stats
                  const totalSlots = slots.length;
                  const filledSlots = Object.values(currentSchedule).filter(Boolean).length;
                  const coveragePercent = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;

                  // Find employees who need more hours (under 20 hours)
                  const allEmployees = [...pools.foh, ...pools.boh];
                  const underScheduled = allEmployees
                    .filter((emp) => {
                      const stats = employeeStats[emp.uid] || {};
                      return stats.hoursScheduled < 20 && !isBlocked(selectedDate, emp.uid);
                    })
                    .slice(0, 3);

                  // Find top performers available
                  const topPerformers = availablePools.foh
                    .concat(availablePools.boh)
                    .filter((e) => !isBlocked(selectedDate, e.uid))
                    .map((e) => ({
                      ...e,
                      stats: employeeStats[e.uid] || {},
                    }))
                    .sort((a, b) => {
                      const aScore = a.stats.performanceScore || 0;
                      const bScore = b.stats.performanceScore || 0;
                      return bScore - aScore;
                    })
                    .slice(0, 3);

                  return (
                    <div>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>
                          Today's Coverage: {coveragePercent}%
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.8 }}>
                          {filledSlots} of {totalSlots} slots filled
                        </div>
                      </div>

                      {coveragePercent < 100 && topPerformers.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 12 }}>
                            Top Available Performers:
                          </div>
                          {topPerformers.map((emp) => (
                            <div
                              key={emp.uid}
                              style={{
                                fontSize: 12,
                                padding: "4px 0",
                                opacity: 0.9,
                              }}
                            >
                              {emp.name} ({emp.stats.performanceScore || "N/A"})
                            </div>
                          ))}
                        </div>
                      )}

                      {underScheduled.length > 0 && (
                        <div>
                          <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 12 }}>
                            Consider Scheduling (Low Hours):
                          </div>
                          {underScheduled.map((emp) => {
                            const stats = employeeStats[emp.uid] || {};
                            return (
                              <div
                                key={emp.uid}
                                style={{
                                  fontSize: 12,
                                  padding: "4px 0",
                                  opacity: 0.9,
                                }}
                              >
                                {emp.name} ({stats.hoursScheduled || 0}h this week)
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Future: Additional read-only info panels for scheduling decisions */}
            {/* Placeholder for future panels like:
                - Availability trends
                - Predictive insights
                - etc.
            */}
          </div>
        </div>
      ) : null}

      {/* AI Scheduling Suggestions Module - At the bottom */}
      {!requestsOpen && (
        <div className="sched-ai-suggestions" style={{ marginTop: 24 }}>
          <div className="metric-card info">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: showAiSuggestions ? 12 : 0,
              }}
            >
              <div className="metric-title">AI Scheduling Suggestions</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {!showAiSuggestions && (
                  <button
                    type="button"
                    className="sched-btn sched-btn--primary"
                    onClick={generateFullWeekSuggestions}
                    disabled={loadingAiSuggestions || isPublished}
                    style={{ fontSize: 13, padding: "8px 16px" }}
                  >
                    {loadingAiSuggestions ? "Generating…" : "Generate Suggestions"}
                  </button>
                )}
                {showAiSuggestions && (
                  <button
                    type="button"
                    className="sched-btn"
                    onClick={() => setShowAiSuggestions(false)}
                    style={{ fontSize: 13, padding: "8px 16px" }}
                  >
                    Hide
                  </button>
                )}
              </div>
            </div>

            {showAiSuggestions && (
              <div style={{ marginTop: 12 }}>
                {loadingAiSuggestions ? (
                  <div className="metric-subtext">Generating AI suggestions for the week…</div>
                ) : !aiSuggestions || Object.keys(aiSuggestions).length === 0 ? (
                  <div className="metric-subtext">All slots are filled! No suggestions needed.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {weekDays.map((day) => {
                      const daySuggestions = aiSuggestions[day.iso];
                      if (!daySuggestions || Object.keys(daySuggestions).length === 0) return null;

                      return (
                        <div key={day.iso} style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 12 }}>
                          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 14 }}>
                            {day.label} ({day.iso})
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {Object.entries(daySuggestions).map(([slotId, suggestions]) => {
                              const slot = slots.find((s) => s.id === slotId);
                              if (!slot || suggestions.length === 0) return null;

                              return (
                                <div
                                  key={slotId}
                                  style={{
                                    background: "rgba(255,255,255,0.03)",
                                    borderRadius: 8,
                                    padding: 10,
                                    border: "1px solid rgba(255,255,255,0.08)",
                                  }}
                                >
                                  <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>
                                    {slot.label} ({slot.startTime} - {slot.endTime})
                                  </div>
                                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                    {suggestions.map((suggestion, idx) => (
                                      <div
                                        key={suggestion.employee.uid}
                                        style={{
                                          display: "flex",
                                          justifyContent: "space-between",
                                          alignItems: "center",
                                          padding: "6px 8px",
                                          background: idx === 0 ? "rgba(56, 189, 248, 0.1)" : "rgba(255,255,255,0.02)",
                                          borderRadius: 6,
                                          border: idx === 0 ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid rgba(255,255,255,0.05)",
                                        }}
                                      >
                                        <div style={{ flex: 1 }}>
                                          <div style={{ fontWeight: 600, fontSize: 13 }}>
                                            {suggestion.employee.name}
                                            {idx === 0 && (
                                              <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.8 }}>
                                                ⭐ Best Match
                                              </span>
                                            )}
                                          </div>
                                          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                                            Score: {suggestion.score.toFixed(1)} | {suggestion.confidence} confidence
                                          </div>
                                          {suggestion.reasons.length > 0 && (
                                            <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>
                                              {suggestion.reasons[0]}
                                            </div>
                                          )}
                                        </div>
                                        <button
                                          type="button"
                                          className="sched-btn"
                                          onClick={() => applyAiSuggestion(day.iso, slotId, suggestion.employee)}
                                          disabled={isPublished}
                                          style={{
                                            fontSize: 11,
                                            padding: "4px 10px",
                                            height: "auto",
                                            minHeight: "auto",
                                          }}
                                        >
                                          Apply
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {!showAiSuggestions && (
              <div className="metric-subtext" style={{ marginTop: 8 }}>
                AI will analyze employee performance, attendance, availability, and preferences to suggest optimal schedules for empty slots.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}