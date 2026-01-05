// src/components/CurrentShiftGame.jsx
//
// CURRENT SHIFT GAME - Employee Dashboard
//
// Displays active shift games with accordion support for multiple games
// Toggle between game/instructions and leaderboard
// Shows countdown for game closest to finishing

import React, { useState, useEffect, useCallback } from "react";
import { collection, query, where, getDocs, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "../hooks/services/firebase";
import "./CurrentShiftGame.css";

const COMPANY_ID = "company-demo";

export default function CurrentShiftGame({ employeeUid, restaurantId }) {
  const [activeGames, setActiveGames] = useState([]);
  const [expandedGames, setExpandedGames] = useState(new Set());
  const [viewMode, setViewMode] = useState({}); // { gameId: "game" | "leaderboard" }
  const [loading, setLoading] = useState(true);

  // Load all active shift games
  const loadActiveGames = useCallback(async () => {
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
        orderBy("startTime", "desc")
      );

      const snap = await getDocs(q);

      if (!snap.empty) {
        const gamesData = snap.docs.map((gameDoc) => {
          const gameData = gameDoc.data();
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

          return {
            id: gameDoc.id,
            name: gameData.gameName || gameData.gameData?.name || "Active Game",
            remainingMinutes,
            endTime,
            reward: gameData.reward || "Shift Meal",
            gameData: gameData.gameData,
            leaderboard: leaderboardData,
            employeeRank: employeeRankData,
            startTime,
          };
        });

        // Sort by remaining time (closest to finishing first)
        gamesData.sort((a, b) => a.remainingMinutes - b.remainingMinutes);

        setActiveGames(gamesData);

        // Expand first game by default
        if (gamesData.length > 0 && expandedGames.size === 0) {
          setExpandedGames(new Set([gamesData[0].id]));
          setViewMode({ [gamesData[0].id]: "game" });
        }
      } else {
        setActiveGames([]);
      }
    } catch (err) {
      console.error("Error loading active games:", err);
      setActiveGames([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, employeeUid, expandedGames]);

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
      orderBy("startTime", "desc")
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      loadActiveGames();
    });

    return () => unsubscribe();
  }, [restaurantId, loadActiveGames]);

  // Initial load
  useEffect(() => {
    loadActiveGames();
  }, [loadActiveGames]);

  // Update remaining time every second for countdown
  useEffect(() => {
    if (activeGames.length === 0) return;

    const interval = setInterval(() => {
      setActiveGames((prevGames) => {
        return prevGames.map((game) => {
          if (game.endTime) {
            const now = new Date();
            const remainingMs = Math.max(0, game.endTime.getTime() - now.getTime());
            const remainingMinutes = Math.floor(remainingMs / 60000);
            return { ...game, remainingMinutes, endTime: game.endTime }; // Preserve endTime for countdown
          }
          return game;
        }).sort((a, b) => {
          // Sort by remaining time (closest to finishing first)
          const aRemaining = a.endTime ? Math.max(0, a.endTime.getTime() - new Date().getTime()) : Infinity;
          const bRemaining = b.endTime ? Math.max(0, b.endTime.getTime() - new Date().getTime()) : Infinity;
          return aRemaining - bRemaining;
        });
      });
    }, 1000); // Update every second for real-time countdown

    return () => clearInterval(interval);
  }, [activeGames]);

  const toggleGame = (gameId) => {
    setExpandedGames((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(gameId)) {
        newSet.delete(gameId);
      } else {
        newSet.add(gameId);
      }
      return newSet;
    });
  };

  const toggleViewMode = (gameId, e) => {
    e.stopPropagation();
    setViewMode((prev) => ({
      ...prev,
      [gameId]: prev[gameId] === "leaderboard" ? "game" : "leaderboard",
    }));
  };

  const formatTime = (minutes) => {
    if (minutes <= 0) return "Ended";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatCountdown = (endTime) => {
    if (!endTime) return "";
    const now = new Date();
    const remainingMs = Math.max(0, endTime.getTime() - now.getTime());
    if (remainingMs === 0) return "Ended";
    
    const hours = Math.floor(remainingMs / 3600000);
    const minutes = Math.floor((remainingMs % 3600000) / 60000);
    const seconds = Math.floor((remainingMs % 60000) / 1000);
    
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="csg-container">
        <div className="csg-header">
          <h3>Current Shift Games</h3>
        </div>
        <div className="csg-body">
          <div className="csg-loading">Loading game data...</div>
        </div>
      </div>
    );
  }

  if (activeGames.length === 0) {
    return (
      <div className="csg-container">
        <div className="csg-header">
          <h3>Current Shift Games</h3>
        </div>
        <div className="csg-body">
          <div className="csg-empty">
            <div className="csg-empty-icon">🎮</div>
            <p>No active shift games</p>
            <p className="csg-empty-sub">Check back when a game starts!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="csg-container">
      <div className="csg-header">
        <h3>Current Shift Games</h3>
        {activeGames.length > 0 && (
          <div className="csg-countdown">
            {formatCountdown(activeGames[0].endTime)}
          </div>
        )}
      </div>
      <div className="csg-body">
        {activeGames.map((game, index) => {
          const isExpanded = expandedGames.has(game.id);
          const currentView = viewMode[game.id] || "game";
          const isFirst = index === 0;

          return (
            <div key={game.id} className={`csg-game-accordion ${isExpanded ? "expanded" : ""}`}>
              {/* Accordion Header */}
              <div
                className="csg-accordion-header"
                onClick={() => toggleGame(game.id)}
              >
                <div className="csg-accordion-title">
                  <span className="csg-accordion-icon">
                    {isExpanded ? "−" : "+"}
                  </span>
                  <span className="csg-game-name">{game.name}</span>
                  {isFirst && (
                    <span className="csg-countdown-badge">
                      {formatCountdown(game.endTime)}
                    </span>
                  )}
                </div>
                <div className="csg-accordion-meta">
                  <span className="csg-time-remaining">
                    {formatTime(game.remainingMinutes)} left
                  </span>
                </div>
              </div>

              {/* Accordion Content */}
              {isExpanded && (
                <div className="csg-accordion-content">
                  {/* Toggle Buttons */}
                  <div className="csg-view-toggle">
                    <button
                      className={`csg-toggle-btn ${currentView === "game" ? "active" : ""}`}
                      onClick={(e) => toggleViewMode(game.id, e)}
                    >
                      Game & Instructions
                    </button>
                    <button
                      className={`csg-toggle-btn ${currentView === "leaderboard" ? "active" : ""}`}
                      onClick={(e) => toggleViewMode(game.id, e)}
                    >
                      Leaderboard
                    </button>
                  </div>

                  {/* Game View */}
                  {currentView === "game" && (
                    <div className="csg-game-view">
                      <div className="csg-reward">Reward: {game.reward}</div>
                      {game.gameData?.instructions && (
                        <div className="csg-instructions">
                          <h4>How to Play</h4>
                          <p>{game.gameData.instructions}</p>
                        </div>
                      )}
                      {game.gameData?.rules && (
                        <div className="csg-rules">
                          <h4>Rules</h4>
                          <ul>
                            {game.gameData.rules.map((rule, idx) => (
                              <li key={idx}>{rule}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {game.employeeRank && (
                        <div className="csg-your-status">
                          <div className="csg-status-label">Your Status</div>
                          <div className="csg-status-value">
                            Rank #{game.employeeRank.rank} • {game.employeeRank.score} points
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Leaderboard View */}
                  {currentView === "leaderboard" && (
                    <div className="csg-leaderboard-view">
                      {game.leaderboard.length > 0 ? (
                        <>
                          <div className="csg-leaderboard-list">
                            {game.leaderboard.slice(0, 10).map((player, idx) => {
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
                          {game.employeeRank && game.employeeRank.rank > 10 && (
                            <div className="csg-leaderboard-footer">
                              Your rank: #{game.employeeRank.rank} ({game.employeeRank.score} points)
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="csg-empty-leaderboard">No participants yet</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

