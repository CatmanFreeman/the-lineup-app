export default function ChartPlaceholder({ label }) {
  return (
    <div
      style={{
        height: "120px",
        borderRadius: "8px",
        background:
          "repeating-linear-gradient(45deg, rgba(255,255,255,0.06), rgba(255,255,255,0.06) 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(255,255,255,0.6)",
        fontSize: "13px",
        fontWeight: 600,
      }}
    >
      {label}
    </div>
  );
}
