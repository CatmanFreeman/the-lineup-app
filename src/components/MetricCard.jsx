// src/components/MetricCard.jsx

export default function MetricCard({
  title,
  value,
  subtext,
  status,
  expanded,
  onToggle,
  onClick,
  timeScope,
  onScopeChange,
  children,
}) {
  // Use onClick if provided, otherwise fall back to onToggle
  const handleClick = onClick || onToggle;

  return (
    <div
      className={`metric-card ${status || ""} ${expanded ? "expanded" : ""} ${onClick ? "clickable" : ""}`}
      onClick={handleClick}
      style={onClick ? { cursor: "pointer" } : {}}
    >
      {/* HEADER */}
      <div className="metric-header">
        <div className="metric-title">{title}</div>
        <div className="metric-value">{value}</div>
        {subtext && <div className="metric-subtext">{subtext}</div>}
      </div>

      {/* TIME SCOPE TOGGLE (LEVEL 2 ONLY) */}
      {expanded && onScopeChange && (
        <div className="metric-toggle">
          {["shift", "today", "week"].map((scope) => (
            <button
              key={scope}
              className={timeScope === scope ? "active" : ""}
              onClick={(e) => {
                e.stopPropagation();
                onScopeChange(scope);
              }}
            >
              {scope}
            </button>
          ))}
        </div>
      )}

      {/* EXPANDED CONTENT */}
      {expanded && (
        <div
          className="metric-expanded"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      )}
    </div>
  );
}