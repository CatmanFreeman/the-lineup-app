//src/pages/Dashboards/RestaurantDashboard/tabs/Scheduling/ShiftBoard.jsx
import React, { useMemo } from "react";
import ShiftSlot from "./ShiftSlot";

/**
 * ShiftBoard
 * - Center board of slots
 * - Accepts drops from pools and other slots
 * - AI suggestions integration
 */
export default function ShiftBoard({ 
  date, 
  slots = [], 
  schedule = {}, 
  onDrop, 
  onClearSlot,
  onSuggest,
  suggestions = null,
  loadingSuggestions = false,
}) {
  const grouped = useMemo(() => {
    const foh = slots.filter((s) => s.side === "foh");
    const boh = slots.filter((s) => s.side === "boh");
    return { foh, boh };
  }, [slots]);

  // Get suggestions for current slot if available
  const getSuggestionsForSlot = (slotId) => {
    if (!suggestions || suggestions.slotId !== slotId) return null;
    return suggestions.suggestions;
  };

  return (
    <div className="sched-board">
      <div className="sched-boardHead">
        <div className="sched-boardTitle">Shift Board</div>
        <div className="sched-boardSub">{date}</div>
      </div>
      <div className="sched-boardCols">
        <div className="sched-col">
          <div className="sched-colTitle">FOH Slots</div>
          <div className="sched-colBody">
            {grouped.foh.map((slot) => (
              <ShiftSlot
                key={slot.id}
                slot={slot}
                assigned={schedule[slot.id]}
                onDrop={onDrop}
                onClear={() => onClearSlot(slot.id)}
                onSuggest={onSuggest}
                suggestions={getSuggestionsForSlot(slot.id)}
                loadingSuggestions={loadingSuggestions && suggestions?.slotId === slot.id}
                dateISO={date}
              />
            ))}
          </div>
        </div>
        <div className="sched-col">
          <div className="sched-colTitle">BOH Slots</div>
          <div className="sched-colBody">
            {grouped.boh.map((slot) => (
              <ShiftSlot
                key={slot.id}
                slot={slot}
                assigned={schedule[slot.id]}
                onDrop={onDrop}
                onClear={() => onClearSlot(slot.id)}
                onSuggest={onSuggest}
                suggestions={getSuggestionsForSlot(slot.id)}
                loadingSuggestions={loadingSuggestions && suggestions?.slotId === slot.id}
                dateISO={date}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="sched-note">
        Tip: Drag from a slot to another slot to move someone. Use ✨ Suggest for AI recommendations.
      </div>
    </div>
  );
}