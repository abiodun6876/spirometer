import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  sub?: string;
  accent?: string;
  icon?: string;
}

export function StatCard({ label, value, sub, accent = "#6366f1", icon }: StatCardProps) {
  return (
    <div
      style={{
        background:   "rgba(255,255,255,0.04)",
        border:       "1px solid rgba(255,255,255,0.08)",
        borderRadius: "16px",
        padding:      "20px 24px",
        display:      "flex",
        flexDirection:"column",
        gap:          "6px",
        position:     "relative",
        overflow:     "hidden",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* accent glow */}
      <div style={{
        position:     "absolute",
        top: -40, left: -40,
        width:        120, height: 120,
        borderRadius: "50%",
        background:   `${accent}22`,
        filter:       "blur(30px)",
        pointerEvents:"none",
      }} />

      <div style={{ fontSize: "1.4rem" }}>{icon}</div>
      <div style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: "2rem", fontWeight: 800, color: "#f1f5f9", lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{sub}</div>
      )}
    </div>
  );
}
