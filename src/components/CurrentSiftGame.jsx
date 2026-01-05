// src/components/CurrentShiftGame.jsx

import React, { useState, useEffect, useCallback } from "react";
import { collection, query, where, getDocs, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "../hooks/services/firebase";
import "./CurrentShiftGame.css";

const COMPANY_ID = "company-demo";

export default function CurrentShiftGame({ employeeUid, restaurantId }) {
  const [activeGame, setActiveGame] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [employeeRank, setEmployeeRank] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load active shift game
  const loadActiveGame = useCallback(async () => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    try {
      const activeGamesRef = collection(
        db,
        "companies",
        COMPANY_ID,
        "restaurants",
        restaurantId,
        "activeShiftGames"
      );

      const q = query(
        activeGamesRef,
        where("active", "==", true),
        orderBy("startTime", "desc"),
        limit(1)
      );

      const snap = await getDocs(q);

      if (!snap.empty) {
        const gameDoc = snap.docs[0];
        const gameData = gameDoc.data();

        // Calculate remaining time
        const startTime = gameData.startTime?.toDate();
        const duration = gameData.gameData?.duration || 180;
        const endTime = startTime ? new Date(startTime.getTime() + duration * 60 * 1000) : null;
        const now = new Date();
        const remainingMs = endTime ? Math.max(0, endTime.getTime() - now.getTime()) : 0;
        const remainingMinutes = Math.floor(remainingMs / 60000);

        // Build leaderboard from participants
        const participants = gameData.participants || [];
        const leaderboardData = participants
          .map((p) => ({
            uid: p.uid,
            name: p.name,
            score: p.score || 0,
            role: p.role || "",
          }))
          .sort((a, b) => (b.score || 0) - (a.score || 0));

        // Find employee's rank
        const employeeIndex = leaderboardData.findIndex((p) => p.uid === employeeUid);
        const employeeRankData = employeeIndex >= 0 ? {
          rank: employeeIndex + 1,
          ...leaderboardData[employeeIndex],
        } : null;

        // Generate notifications
        const gameNotifications = [];
        if (employeeRankData && employeeIndex > 0) {
          const personAhead = leaderboardData[employeeIndex - 1];
          const scoreDiff = personAhead.score - employeeRankData.score;
          if (scoreDiff > 0 && scoreDiff <= 5) {
            gameNotifications.push({
              type: "close",
              message: `You're only ${scoreDiff} point${scoreDiff !== 1 ? "s" : ""} behind ${personAhead.name}!`,
            });
          }
        }

        setActiveGame({
          id: gameDoc.id,
          name: gameData.gameName || gameData.gameData?.name || "Active Game",
          remainingMinutes,
          endTime,
          reward: gameData.reward || "Shift Meal",
          gameData: gameData.gameData,
        });

        setLeaderboard(leaderboardData);
        setEmployeeRank(employeeRankData);
        setNotifications(gameNotifications);
      } else {
        setActiveGame(null);
        setLeaderboard([]);
        setEmployeeRank(null);
        setNotifications([]);
      }
    } catch (err) {
      console.error("Error loading active game:", err);
      setActiveGame(null);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, employeeUid]);

  // Set up real-time listener
  useEffect(() => {
    if (!restaurantId) return;

    const activeGamesRef = collection(
      db,
      "companies",
      COMPANY_ID,
      "restaurants",
      restaurantId,
      "activeShiftGames"
    );

    const q = query(
      activeGamesRef,
      where("active", "==", true),
      orderBy("startTime", "desc"),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        loadActiveGame();
      } else {
        setActiveGame(null);
        setLeaderboard([]);
        setEmployeeRank(null);
        setNotifications([]);
      }
    });

    return () => unsubscribe();
  }, [restaurantId, loadActiveGame]);

  // Initial load
  useEffect(() => {
    loadActiveGame();
  }, [loadActiveGame]);

  // Update remaining time every minute
  useEffect(() => {
    if (!activeGame) return;

    const interval = setInterval(() => {
      if (activeGame.endTime) {
        const now = new Date();
        const remainingMs = Math.max(0, activeGame.endTime.getTime() - now.getTime());
        const remainingMinutes = Math.floor(remainingMs / 60000);

        setActiveGame((prev) => ({
          ...prev,
          remainingMinutes,
        }));

        if (remainingMinutes === 0) {
          loadActiveGame(); // Reload to check if game ended
        }
      }
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [activeGame, loadActiveGame]);

  if (loading) {
    return (
      <div className="ed-card">
        <div className="ed-card-header">
          <h3>Current Shift Game</h3>
        </div>
        <div className="ed-card-body">
          <div className="csg-loading">Loading game data...</div>
        </div>
      </div>
    );
  }

  if (!activeGame) {
    return (
      <div className="ed-card">
        <div className="ed-card-header">
          <h3>Current Shift Game</h3>
        </div>
        <div className="ed-card-body">
          <div className="csg-empty">
            <div className="csg-empty-icon">🎮</div>
            <p>No active shift game</p>
            <p className="csg-empty-sub">Check back when a game starts!</p>
          </div>
        </div>
      </div>
    );
  }

  const formatTime = (minutes) => {
    if (minutes <= 0) return "Game Ended";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <div className="ed-card">
      <div className="ed-card-header">
        <h3>Current Shift Game</h3>
        <div className="csg-time-remaining">
          {formatTime(activeGame.remainingMinutes)} left
        </div>
      </div>
      <div className="ed-card-body">
        <div className="csg-game-name">{activeGame.name}</div>
        <div className="csg-reward">Reward: {activeGame.reward}</div>

        {/* Notifications */}
        {notifications.length > 0 && (
          <div className="csg-notifications">
            {notifications.map((notif, idx) => (
              <div key={idx} className={`csg-notification csg-notification-${notif.type}`}>
                {notif.message}
              </div>
            ))}
          </div>
        )}

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <div className="csg-leaderboard">
            <div className="csg-leaderboard-title">Leaderboard</div>
            <div className="csg-leaderboard-list">
              {leaderboard.slice(0, 5).map((player, idx) => {
                const isEmployee = player.uid === employeeUid;
                return (
                  <div
                    key={player.uid}
                    className={`csg-leaderboard-item ${isEmployee ? "csg-leaderboard-item--me" : ""}`}
                  >
                    <div className="csg-leaderboard-rank">#{idx + 1}</div>
                    <div className="csg-leaderboard-info">
                      <div className="csg-leaderboard-name">
                        {player.name}
                        {isEmployee && <span className="csg-leaderboard-badge">You</span>}
                      </div>
                      <div className="csg-leaderboard-role">{player.role}</div>
                    </div>
                    <div className="csg-leaderboard-score">{player.score}</div>
                  </div>
                );
              })}
            </div>
            {employeeRank && employeeRank.rank > 5 && (
              <div className="csg-leaderboard-footer">
                Your rank: #{employeeRank.rank} ({employeeRank.score} points)
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}