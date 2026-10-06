interface InsightListProps {
  insights: string[];
  disclaimer?: string;
  loading?: boolean;
}

export function InsightList({ insights, disclaimer, loading }: InsightListProps) {
  if (loading) {
    return (
      <div style={{ color: "#64748b", fontSize: "0.85rem", padding: "12px 0" }}>
        Analysing your data…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {insights.map((ins, i) => (
        <div
          key={i}
          style={{
            background:   "rgba(99,102,241,0.08)",
            border:       "1px solid rgba(99,102,241,0.2)",
            borderRadius: "12px",
            padding:      "12px 16px",
            fontSize:     "0.85rem",
            color:        "#cbd5e1",
            lineHeight:   1.5,
          }}
        >
          {ins}
        </div>
      ))}
      {disclaimer && (
        <p style={{ fontSize: "0.7rem", color: "#475569", marginTop: "4px", lineHeight: 1.5 }}>
          ⚕️ {disclaimer}
        </p>
      )}
    </div>
  );
}
