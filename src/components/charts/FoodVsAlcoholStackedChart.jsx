import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function FoodVsAlcoholStackedChart({ data }) {
  return (
    <div style={{ width: "100%", height: 160 }}>
      <ResponsiveContainer>
        <BarChart data={data}>
          <XAxis dataKey="label" stroke="rgba(255,255,255,0.4)" fontSize={11} />
          <YAxis
            stroke="rgba(255,255,255,0.4)"
            fontSize={11}
            tickFormatter={(v) => `$${v / 1000}k`}
          />
          <Tooltip
            contentStyle={{
              background: "#111827",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              color: "#fff",
            }}
            formatter={(value, name) => [`$${value.toLocaleString()}`, name]}
          />

          <Bar dataKey="food" stackId="a" fill="#4ade80" />
          <Bar dataKey="alcohol" stackId="a" fill="#60a5fa" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
