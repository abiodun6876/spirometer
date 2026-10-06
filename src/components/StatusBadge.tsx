import type { TestStatus } from "../lib/scoring";
import { statusColor } from "../lib/scoring";

interface StatusBadgeProps {
  status: TestStatus;
  size?: "sm" | "md" | "lg";
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const color = statusColor(status);
  const sizes = { sm: "0.65rem", md: "0.8rem", lg: "1rem" };
  const pad   = { sm: "2px 8px", md: "4px 12px", lg: "6px 16px" };

  return (
    <span
      style={{
        display:       "inline-block",
        background:    `${color}22`,
        color,
        border:        `1px solid ${color}55`,
        borderRadius:  "999px",
        fontSize:      sizes[size],
        fontWeight:    700,
        letterSpacing: "0.06em",
        padding:       pad[size],
        textTransform: "uppercase",
      }}
    >
      {status}
    </span>
  );
}
