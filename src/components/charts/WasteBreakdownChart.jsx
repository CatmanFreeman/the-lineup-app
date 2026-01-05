import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

function normalizeKey(label) {
  return String(label || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z]/g, "");
}

export default function WasteBreakdownChart({ data, thresholds }) {
  const safe = Array.isArray(data) ? data : [];

  return (
    <div style={{ width: "100%", height: 160 }}>
      <ResponsiveContainer>
        <BarChart data={safe}>
          <XAxis dataKey="label" stroke="rgba(255,255,255,0.4)" fontSize={11} />
          <YAxis
            stroke="rgba(255,255,255,0.4)"
            fontSize={11}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            contentStyle={{
              background: "#111827",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              color: "#fff",
            }}
            formatter={(value) => [`$${value}`, "Waste"]}
          />

          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {safe.map((row, idx) => {
              const k = normalizeKey(row.label);
              const th = thresholds?.[k] ?? null;
              const over = th != null && Number(row.value) > Number(th);

              // green when ok, red when over threshold
              const fill = over ? "#f87171" : "#4ade80";

              return <Cell key={`cell-${idx}`} fill={fill} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
