import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from "recharts";

export default function AlcoholMixTargetChart({ data, min, max, target }) {
  return (
    <div style={{ width: "100%", height: 160 }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <ReferenceArea
            y1={min}
            y2={max}
            fill="rgba(96,165,250,0.12)"
            strokeOpacity={0}
          />
          <ReferenceLine
            y={target}
            stroke="rgba(255,255,255,0.35)"
            strokeDasharray="4 4"
          />

          <XAxis dataKey="label" stroke="rgba(255,255,255,0.4)" fontSize={11} />
          <YAxis
            stroke="rgba(255,255,255,0.4)"
            fontSize={11}
            tickFormatter={(v) => `${v}%`}
            domain={[0, 50]}
          />
          <Tooltip
            contentStyle={{
              background: "#111827",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              color: "#fff",
            }}
            formatter={(value) => [`${value}%`, "Alcohol Mix"]}
          />

          <Line
            type="monotone"
            dataKey="mix"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
