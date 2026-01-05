//src/pages/Dashboards/RestaurantDashboard/tabs/Scheduling/ShiftSlot.jsx
import React, { useMemo, useState, useRef, useEffect } from "react";

/**
 * ShiftSlot
 * - Drop target for employees
 * - Shows assigned employee (if any)
 * - Allows drag OUT to another slot
 * - AI Suggestions button for empty slots
 */
export default function ShiftSlot({ 
  slot, 
  assigned, 
  onDrop, 
  onClear,
  onSuggest,
  suggestions = null,
  loadingSuggestions = false,
  dateISO,
}) {
  const [isOver, setIsOver] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef(null);
  const filled = !!assigned?.id;

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }

    if (showSuggestions) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSuggestions]);

  const subtitle = useMemo(() => {
    if (!filled) return "Drop employee here";
    return assigned.subRole ? assigned.subRole : "Assigned";
  }, [filled, assigned]);

  const handleSuggestClick = () => {
    if (filled) return;
    if (onSuggest) {
      onSuggest(slot.id, dateISO);
      setShowSuggestions(true);
    }
  };

  const handleApplySuggestion = (employee) => {
    if (onDrop && employee) {
      onDrop(slot.id, {
        employee: { ...employee, side: slot.side },
        fromSlotId: null,
      });
      setShowSuggestions(false);
    }
  };

  // Show shift time if available
  const shiftTimeDisplay = useMemo(() => {
    if (slot.startTime && slot.endTime) {
      return `${slot.startTime} - ${slot.endTime}`;
    }
    return null;
  }, [slot]);

  return (
    <div
      className={`sched-slot ${filled ? "sched-slot--filled" : ""} ${isOver ? "sched-slot--over" : ""}`}
      onDragOver={(ev) => {
        ev.preventDefault();
        setIsOver(true);
        ev.dataTransfer.dropEffect = "move";
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(ev) => {
        ev.preventDefault();
        setIsOver(false);
        try {
          const raw = ev.dataTransfer.getData("application/json");
          const payload = raw ? JSON.parse(raw) : null;
          if (payload) onDrop(slot.id, payload);
        } catch (e) {
          // ignore bad payloads
        }
      }}
    >
      <div className="sched-slotTop">
        <div>
          <div className="sched-slotLabel">{slot.label}</div>
          {shiftTimeDisplay && (
            <div className="sched-slotTime" style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
              {shiftTimeDisplay}
            </div>
          )}
        </div>
        {filled ? (
          <button 
            className="sched-clear" 
            type="button" 
            onClick={onClear} 
            title="Clear slot"
          >
            Clear
          </button>
        ) : (
          <div style={{ position: "relative" }} ref={suggestionsRef}>
            <button
              className="sched-suggest"
              type="button"
              onClick={handleSuggestClick}
              disabled={loadingSuggestions}
              title="Get AI suggestions for this slot"
              style={{
                padding: "4px 8px",
                fontSize: 11,
                background: loadingSuggestions ? "rgba(255,255,255,0.1)" : "rgba(74, 144, 226, 0.2)",
                border: "1px solid rgba(74, 144, 226, 0.4)",
                borderRadius: 6,
                color: "#4a90e2",
                cursor: loadingSuggestions ? "wait" : "pointer",
                fontWeight: 600,
              }}
            >
              {loadingSuggestions ? "..." : "✨ Suggest"}
            </button>

            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions && suggestions.length > 0 && (
              <div
                className="sched-suggestions"
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  marginTop: 8,
                  background: "rgba(20, 20, 30, 0.98)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 12,
                  padding: 12,
                  zIndex: 1000,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                  minWidth: 280,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "#4a90e2" }}>
                  AI Suggestions
                </div>
                {suggestions.map((suggestion, idx) => (
                  <div
                    key={suggestion.employee.uid}
                    onClick={() => handleApplySuggestion(suggestion.employee)}
                    style={{
                      padding: "10px 12px",
                      marginBottom: idx < suggestions.length - 1 ? 8 : 0,
                      background: idx === 0 
                        ? "rgba(74, 144, 226, 0.15)" 
                        : "rgba(255,255,255,0.05)",
                      border: idx === 0 
                        ? "1px solid rgba(74, 144, 226, 0.3)" 
                        : "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = idx === 0 
                        ? "rgba(74, 144, 226, 0.25)" 
                        : "rgba(255,255,255,0.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = idx === 0 
                        ? "rgba(74, 144, 226, 0.15)" 
                        : "rgba(255,255,255,0.05)";
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>
                        {suggestion.employee.name}
                      </div>
                      <div style={{ 
                        fontSize: 11, 
                        fontWeight: 600,
                        color: suggestion.confidence === "high" ? "#4ade80" : suggestion.confidence === "medium" ? "#fbbf24" : "#f87171"
                      }}>
                        {suggestion.score.toFixed(1)}%
                      </div>
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>
                      {suggestion.reasons.slice(0, 2).join(" • ")}
                    </div>
                    {idx === 0 && (
                      <div style={{ 
                        fontSize: 10, 
                        marginTop: 6, 
                        color: "#4a90e2",
                        fontWeight: 600 
                      }}>
                        ⭐ Best Match
                      </div>
                    )}
                  </div>
                ))}
                <div style={{ 
                  fontSize: 10, 
                  marginTop: 8, 
                  paddingTop: 8, 
                  borderTop: "1px solid rgba(255,255,255,0.1)",
                  opacity: 0.6 
                }}>
                  Click to apply suggestion
                </div>
              </div>
            )}

            {showSuggestions && suggestions && suggestions.length === 0 && !loadingSuggestions && (
              <div
                className="sched-suggestions"
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  marginTop: 8,
                  background: "rgba(20, 20, 30, 0.98)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 12,
                  padding: 12,
                  zIndex: 1000,
                  fontSize: 12,
                  opacity: 0.7,
                }}
              >
                No suggestions available
              </div>
            )}
          </div>
        )}
      </div>
      {!filled ? (
        <div className="sched-slotEmpty">{subtitle}</div>
      ) : (
        <div
          className="sched-assigned"
          draggable
          onDragStart={(ev) => {
            ev.dataTransfer.setData(
              "application/json",
              JSON.stringify({
                employee: { ...assigned, side: slot.side },
                fromSlotId: slot.id,
              })
            );
            ev.dataTransfer.effectAllowed = "move";
          }}
          title="Drag to another slot"
        >
          <div className="sched-assignedName">{assigned.name}</div>
          <div className="sched-assignedSub">{subtitle}</div>
        </div>
      )}
    </div>
  );
}