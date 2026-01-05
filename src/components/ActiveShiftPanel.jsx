export default function ActiveShiftPanel() {
  return (
    <div
      style={{
        background: "#111827",
        borderRadius: "14px",
        padding: "20px",
        marginBottom: "24px",
      }}
    >
      <h2 style={{ marginBottom: "12px" }}>Active Shift</h2>

      {/* Shift Health */}
      <div style={{ marginBottom: "14px" }}>
        <strong>Status:</strong>{" "}
        <span style={{ color: "#f59e0b" }}>Watch</span>
      </div>

      {/* Active Game */}
      <div style={{ marginBottom: "14px" }}>
        <strong>Active Game:</strong> Alcohol Push  
        <br />
        <small>Time Remaining: 42 min</small>
      </div>

      {/* Countdown / Reminder */}
      <div style={{ marginBottom: "14px" }}>
        <strong>Next Reminder:</strong> Pre-Rush Line Check  
        <br />
        <small>Starts in 18 min</small>
      </div>

      {/* Quick Insight */}
      <div>
        <small style={{ color: "#9ca3af" }}>
          Focus areas: Alcohol mix slightly below target.
        </small>
      </div>
    </div>
  );
}
