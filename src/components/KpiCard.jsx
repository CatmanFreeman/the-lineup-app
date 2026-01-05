export default function KpiCard({ title, value, subtext, status }) {
  return (
    <div
      style={{
        background: "#111827",
        borderRadius: "16px",
        padding: "20px",
        minWidth: "220px",
      }}
    >
      <div style={{ fontSize: "14px", opacity: 0.8 }}>{title}</div>

      <div style={{ fontSize: "28px", fontWeight: "600", margin: "8px 0" }}>
        {value}
      </div>

      {subtext && (
        <div style={{ fontSize: "13px", opacity: 0.7 }}>{subtext}</div>
      )}

      {status && (
        <div style={{ marginTop: "8px", fontSize: "12px", color: "#22c55e" }}>
          {status}
        </div>
      )}
    </div>
  );
}
