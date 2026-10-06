// Shared scoring logic — mirrors the Netlify Function.
// Keep this in sync with netlify/functions/ingest.ts.

const clamp = (n: number) => Math.min(1, Math.max(0, n));

export type TestStatus = "GOOD" | "OK" | "POOR";

export interface ScoreResult {
  ratio: number;
  status: TestStatus;
  score: number;
}

export function scoreTest(fvc: number, fev1: number): ScoreResult {
  const ratio = (fev1 / fvc) * 100;
  let status: TestStatus = "POOR";
  if (ratio >= 75 && fvc >= 3.5) status = "GOOD";
  else if (ratio >= 65 && fvc >= 2.5) status = "OK";

  const score = Math.round(
    (clamp((ratio - 50) / 30) * 0.6 + clamp((fvc - 1.5) / 2.5) * 0.4) * 100
  );
  return { ratio: parseFloat(ratio.toFixed(2)), status, score };
}

export function statusColor(status: TestStatus): string {
  switch (status) {
    case "GOOD": return "#22c55e";
    case "OK":   return "#f59e0b";
    case "POOR": return "#ef4444";
  }
}
