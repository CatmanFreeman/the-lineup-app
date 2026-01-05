// src/components/charts/SimpleLineChart.jsx

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function SimpleLineChart({
  data,
  dataKey,
  color,
  valueFormatter,
}) {
  const safeData = Array.isArray(data) ? data : [];

  return (
    <div style={{ width: "100%", height: 160 }}>
      <ResponsiveContainer>
        <LineChart data={safeData}>
          <XAxis
            dataKey="label"
            stroke="rgba(255,255,255,0.4)"
            fontSize={11}
          />
          <YAxis
            stroke="rgba(255,255,255,0.4)"
            fontSize={11}
            tickFormatter={valueFormatter}
          />
          <Tooltip
            contentStyle={{
              background: "#111827",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              color: "#fff",
            }}
            formatter={(value) =>
              valueFormatter ? valueFormatter(value) : value
            }
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
