import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { Handler, HandlerEvent } from "@netlify/functions";

// ── Types ─────────────────────────────────────────────────────────────────────
interface DailySummary {
  tests: number;
  avgFvc: number;
  avgFev1: number;
  avgRatio: number;
  avgScore: number;
}

// ── Firebase Admin init ───────────────────────────────────────────────────────
function getDb() {
  if (!getApps().length) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!);
    initializeApp({ credential: cert(sa) });
  }
  return getFirestore();
}

// ── Linear regression ─────────────────────────────────────────────────────────
function linearRegression(values: number[]) {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0 };
  const sumX = values.reduce((a, _, i) => a + i, 0);
  const sumY = values.reduce((a, v) => a + v, 0);
  const sumXY = values.reduce((a, v, i) => a + i * v, 0);
  const sumX2 = values.reduce((a, _, i) => a + i * i, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope: parseFloat(slope.toFixed(4)), intercept: parseFloat(intercept.toFixed(4)) };
}

// ── Z-score ───────────────────────────────────────────────────────────────────
function zScore(values: number[], latest: number) {
  if (values.length < 3) return 0;
  const mean = values.reduce((a, v) => a + v, 0) / values.length;
  const std = Math.sqrt(values.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / values.length);
  return std === 0 ? 0 : parseFloat(((latest - mean) / std).toFixed(2));
}

// ── Handler ───────────────────────────────────────────────────────────────────
export const handler: Handler = async (event: HandlerEvent) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST")
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };

  let body: { deviceId?: string };
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { deviceId } = body;
  if (!deviceId)
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "deviceId required" }) };

  const db = getDb();

  // Fetch last 14 daily summaries sorted by dayKey
  const dailySnap = await db
    .collection("devices")
    .doc(deviceId)
    .collection("daily")
    .orderBy("__name__", "desc")
    .limit(14)
    .get();

  const dailies: DailySummary[] = dailySnap.docs
    .reverse()
    .map((d) => d.data() as DailySummary);

  const fvcValues   = dailies.map((d) => d.avgFvc);
  const fev1Values  = dailies.map((d) => d.avgFev1);
  const ratioValues = dailies.map((d) => d.avgRatio);
  const scoreValues = dailies.map((d) => d.avgScore);

  const latestFvc   = fvcValues.length > 0 ? fvcValues[fvcValues.length - 1] : 0;
  const latestRatio = ratioValues.length > 0 ? ratioValues[ratioValues.length - 1] : 0;

  // ── Trend ─────────────────────────────────────────────────────────────────
  const fvcTrend   = linearRegression(fvcValues);
  const ratioTrend = linearRegression(ratioValues);

  // ── Anomaly ───────────────────────────────────────────────────────────────
  const fvcZ   = zScore(fvcValues.slice(0, -1), latestFvc);
  const ratioZ = zScore(ratioValues.slice(0, -1), latestRatio);

  // ── Obstructive pattern flag ──────────────────────────────────────────────
  const last5Ratio = ratioValues.slice(-5);
  const meanLast5Ratio = last5Ratio.length
    ? last5Ratio.reduce((a, v) => a + v, 0) / last5Ratio.length
    : null;
  const obstructiveFlag = meanLast5Ratio !== null && meanLast5Ratio < 70;

  // ── Build plain-language insights ─────────────────────────────────────────
  const insights: string[] = [];

  // Trend insight
  if (fvcValues.length >= 7) {
    if (fvcTrend.slope > 0.02)
      insights.push(`📈 Your FVC has been trending upward over the past ${fvcValues.length} days — great progress!`);
    else if (fvcTrend.slope < -0.02)
      insights.push(`📉 Your FVC has been declining over the past ${fvcValues.length} days. Consider discussing with your clinician.`);
    else
      insights.push(`➡️ Your FVC has been stable over the past ${fvcValues.length} days.`);
  }

  // Anomaly insight
  if (Math.abs(fvcZ) > 2)
    insights.push(
      `⚠️ Today's FVC is unusually ${fvcZ > 0 ? "high" : "low"} compared to your recent history (Z-score ${fvcZ}). This may be worth noting.`
    );
  if (Math.abs(ratioZ) > 2)
    insights.push(
      `⚠️ Today's FEV1/FVC ratio is an outlier (Z-score ${ratioZ}). Check technique or retry the test.`
    );

  // Obstructive pattern
  if (obstructiveFlag)
    insights.push(
      `🔴 Your average FEV1/FVC over the last 5 tests is ${meanLast5Ratio!.toFixed(1)}% — below 70%, which may suggest an obstructive pattern. Please consult your healthcare provider.`
    );

  // Encouraging default
  if (insights.length === 0)
    insights.push("✅ Everything looks consistent. Keep up the regular testing!");

  const disclaimer =
    "These insights are generated automatically from your test data and are not a medical diagnosis. Always consult a qualified healthcare professional for medical advice.";

  return {
    statusCode: 200,
    headers: { ...cors, "Content-Type": "application/json" },
    body: JSON.stringify({
      insights,
      disclaimer,
      analytics: {
        fvcTrend,
        ratioTrend,
        fvcZ,
        ratioZ,
        obstructiveFlag,
        meanLast5Ratio,
        dailyCount: dailies.length,
        scoreValues,
      },
    }),
  };
};
