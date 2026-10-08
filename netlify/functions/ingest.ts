import { createHash, timingSafeEqual } from "node:crypto";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import type { Handler, HandlerEvent } from "@netlify/functions";

// ── Firebase Admin init ───────────────────────────────────────────────────────
function getDb() {
  if (!getApps().length) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!);
    initializeApp({ credential: cert(sa) });
  }
  return getFirestore();
}

// ── Scoring (mirrors src/lib/scoring.ts) ──────────────────────────────────────
const clamp = (n: number) => Math.min(1, Math.max(0, n));

function scoreTest(fvc: number, fev1: number) {
  const ratio = (fev1 / fvc) * 100;
  let status: "Normal" | "Restrictive" | "Obstructive";
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

// ── Day key in UTC ────────────────────────────────────────────────────────────
function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

// ── Handler ───────────────────────────────────────────────────────────────────
export const handler: Handler = async (event: HandlerEvent) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST")
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { deviceId?: string; fvc?: number; fev1?: number; peakFlow?: number };
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { deviceId, fvc, fev1, peakFlow } = body;

  if (
    typeof deviceId !== "string" ||
    typeof fvc !== "number" || fvc <= 0 || fvc > 10 ||
    typeof fev1 !== "number" || fev1 <= 0 || fev1 > fvc
  ) {
    return {
      statusCode: 400,
      headers: cors,
      body: JSON.stringify({ error: "Invalid or out-of-range body fields" }),
    };
  }

  const safepeakFlow = typeof peakFlow === "number" ? Math.min(15, Math.max(0, peakFlow)) : null;

  // ── Authenticate device ───────────────────────────────────────────────────
  const rawKey = event.headers["x-api-key"] ?? "";
  if (!rawKey) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: "Missing API key" }) };

  const db = getDb();
  const deviceRef = db.collection("devices").doc(deviceId);
  const deviceSnap = await deviceRef.get();

  if (!deviceSnap.exists)
    return { statusCode: 401, headers: cors, body: JSON.stringify({ error: "Unknown device" }) };

  const { apiKeyHash } = deviceSnap.data()!;
  const incomingHash = createHash("sha256").update(rawKey).digest("hex");

  let match = false;
  try {
    match = timingSafeEqual(Buffer.from(incomingHash, "hex"), Buffer.from(apiKeyHash, "hex"));
  } catch {
    match = false;
  }
  if (!match) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: "Bad API key" }) };

  // ── Compute result ────────────────────────────────────────────────────────
  const { ratio, status, score } = scoreTest(fvc, fev1);
  const now = new Date();
  const dk = dayKey(now);

  // ── Write test document ───────────────────────────────────────────────────
  const testRef = deviceRef.collection("tests").doc();
  const batch = db.batch();

  batch.set(testRef, {
    fvc,
    fev1,
    ratio,
    peakFlow: safepeakFlow,
    status,
    score,
    recordedAt: Timestamp.fromDate(now),
    dayKey: dk,
  });

  // ── Upsert daily summary ──────────────────────────────────────────────────
  const dailyRef = deviceRef.collection("daily").doc(dk);
  const dailySnap = await dailyRef.get();

  if (!dailySnap.exists) {
    batch.set(dailyRef, {
      tests: 1,
      avgFvc: fvc,
      avgFev1: fev1,
      avgRatio: ratio,
      avgScore: score,
    });
  } else {
    const d = dailySnap.data()!;
    const n = d.tests + 1;
    batch.update(dailyRef, {
      tests: FieldValue.increment(1),
      avgFvc:   parseFloat(((d.avgFvc   * d.tests + fvc  ) / n).toFixed(3)),
      avgFev1:  parseFloat(((d.avgFev1  * d.tests + fev1 ) / n).toFixed(3)),
      avgRatio: parseFloat(((d.avgRatio * d.tests + ratio) / n).toFixed(2)),
      avgScore: Math.round((d.avgScore  * d.tests + score) / n),
    });
  }

  // ── Update lastSeenAt ─────────────────────────────────────────────────────
  batch.update(deviceRef, { lastSeenAt: Timestamp.fromDate(now) });

  await batch.commit();

  return {
    statusCode: 201,
    headers: { ...cors, "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true, id: testRef.id, ratio, status, score }),
  };
};
