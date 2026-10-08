// Shared scoring logic — mirrors the Netlify Function.
// Keep this in sync with netlify/functions/ingest.ts.

const clamp = (n: number) => Math.min(1, Math.max(0, n));

export type TestStatus = "Normal" | "Restrictive" | "Obstructive";

export interface ScoreResult {
  ratio: number;
  status: TestStatus;
  score: number;
}

export function scoreTest(fvc: number, fev1: number): ScoreResult {
  const ratio = (fev1 / fvc) * 100;
  let status: TestStatus;
  if (ratio < 70) {
    status = "Obstructive";
  } else if (fvc < 3.5) {
    status = "Restrictive";
  } else {
    status = "Normal";
  }

  const score = Math.round(
    (clamp((ratio - 50) / 30) * 0.6 + clamp((fvc - 1.5) / 2.5) * 0.4) * 100
  );
  return { ratio: parseFloat(ratio.toFixed(2)), status, score };
}

export function statusColor(status: TestStatus): string {
  switch (status) {
    case "Normal": return "#22c55e";
    case "Restrictive":   return "#f59e0b";
    case "Obstructive": return "#ef4444";
  }
}
