// Client-side analytics: trend, anomaly, streak.
// Heavy ML lives in the Netlify Function; these are lightweight daily helpers.

export interface DailySummary {
  dayKey: string;
  tests: number;
  avgFvc: number;
  avgFev1: number;
  avgRatio: number;
  avgScore: number;
}

// ── Linear regression ─────────────────────────────────────────────────────────
export function linearRegression(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0 };
  const sumX  = values.reduce((a, _, i) => a + i, 0);
  const sumY  = values.reduce((a, v) => a + v, 0);
  const sumXY = values.reduce((a, v, i) => a + i * v, 0);
  const sumX2 = values.reduce((a, _, i) => a + i * i, 0);
  const slope     = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

// ── Z-score of the latest value against history ───────────────────────────────
export function zScore(history: number[], latest: number): number {
  if (history.length < 3) return 0;
  const mean = history.reduce((a, v) => a + v, 0) / history.length;
  const std  = Math.sqrt(history.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / history.length);
  return std === 0 ? 0 : (latest - mean) / std;
}

// ── Consecutive-day streak ────────────────────────────────────────────────────
export function computeStreak(dayKeys: string[]): number {
  if (!dayKeys.length) return 0;
  const sorted = [...new Set(dayKeys)].sort().reverse();
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = (prev.getTime() - curr.getTime()) / 86_400_000;
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}

// ── Obstructive flag: mean FEV1/FVC of last 5 tests < 70 % ───────────────────
export function isObstructivePattern(ratios: number[]): boolean {
  const last5 = ratios.slice(-5);
  if (!last5.length) return false;
  return last5.reduce((a, v) => a + v, 0) / last5.length < 70;
}

// ── Trend direction tag ───────────────────────────────────────────────────────
export type TrendDir = "up" | "down" | "stable";
export function trendDir(slope: number, threshold = 0.02): TrendDir {
  if (slope > threshold)  return "up";
  if (slope < -threshold) return "down";
  return "stable";
}
