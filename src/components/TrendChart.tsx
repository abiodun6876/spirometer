import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
import type { DailySummary } from "../lib/analytics";
import { linearRegression } from "../lib/analytics";

interface TrendChartProps {
  data: DailySummary[];
  metric?: "avgFvc" | "avgFev1" | "avgRatio" | "avgScore";
}

const LABELS: Record<string, string> = {
  avgFvc:   "FVC (L)",
  avgFev1:  "FEV1 (L)",
  avgRatio: "FEV1/FVC (%)",
  avgScore: "Score",
};

const COLORS: Record<string, string> = {
  avgFvc:   "#6366f1",
  avgFev1:  "#22d3ee",
  avgRatio: "#f59e0b",
  avgScore: "#22c55e",
};

// Custom tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background:   "rgba(15,23,42,0.95)",
      border:       "1px solid rgba(255,255,255,0.1)",
      borderRadius: "10px",
      padding:      "10px 14px",
      fontSize:     "0.8rem",
    }}>
      <div style={{ color: "#94a3b8", marginBottom: "4px" }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color, fontWeight: 700 }}>
          {LABELS[p.dataKey] ?? p.dataKey}: {typeof p.value === "number" ? p.value.toFixed(2) : p.value}
        </div>
      ))}
    </div>
  );
};

export function TrendChart({ data, metric = "avgFvc" }: TrendChartProps) {
  // Compute regression line
  const values = data.map((d) => d[metric] as number);
  const { slope, intercept } = linearRegression(values);
  const chartData = data.map((d, i) => ({
    ...d,
    trend: parseFloat((intercept + slope * i).toFixed(3)),
  }));

  const color = COLORS[metric];

  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="dayKey"
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickFormatter={(v) => v.slice(5)} // show MM-DD
          />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: "0.78rem", color: "#94a3b8" }} />

          {metric === "avgRatio" && (
            <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 4"
              label={{ value: "70%", fill: "#ef4444", fontSize: 11 }} />
          )}

          <Line
            type="monotone"
            dataKey={metric}
            name={LABELS[metric]}
            stroke={color}
            strokeWidth={2.5}
            dot={{ r: 3, fill: color }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="trend"
            name="Trend"
            stroke={`${color}66`}
            strokeWidth={1.5}
            strokeDasharray="5 5"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
