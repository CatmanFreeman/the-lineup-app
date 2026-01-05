import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function LaborVsSalesChart({ data }) {
  return (
    <div style={{ width: "100%", height: 160 }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <XAxis
            dataKey="label"
            stroke="rgba(255,255,255,0.4)"
            fontSize={11}
          />
          <YAxis
            yAxisId="left"
            stroke="rgba(255,255,255,0.4)"
            fontSize={11}
            tickFormatter={(v) => `$${v / 1000}k`}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="rgba(255,255,255,0.4)"
            fontSize={11}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              background: "#111827",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              color: "#fff",
            }}
            formatter={(value, name) =>
              name === "sales"
                ? [`$${value.toLocaleString()}`, "Sales"]
                : [`${value}%`, "Labor"]
            }
          />

          {/* SALES LINE */}
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="sales"
            stroke="#4ade80"
            strokeWidth={2}
            dot={false}
          />

          {/* LABOR % LINE */}
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="labor"
            stroke="#a78bfa"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
