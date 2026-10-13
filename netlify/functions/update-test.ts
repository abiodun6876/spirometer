import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import type { Handler, HandlerEvent } from "@netlify/functions";

function getDb() {
  if (!getApps().length) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
    initializeApp({ credential: cert(sa) });
  }
  return getFirestore();
}

export const handler: Handler = async (event: HandlerEvent) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const {
      deviceId,
      testId,
      patientId,
      patientName,
      patientGender,
      patientAge,
      patientHeightCm,
      patientNotes,
      applyToSameDay,
      dayKey,
    } = body;

    if (!deviceId || !testId || !patientId) {
      return {
        statusCode: 400,
        headers: cors,
        body: JSON.stringify({ error: "Missing required fields: deviceId, testId, patientId" }),
      };
    }

    const db = getDb();
    const updateData: Record<string, any> = {
      patientId: String(patientId).trim().toUpperCase(),
      patientName: patientName ? String(patientName).trim() : null,
      patientGender: patientGender || null,
      patientAge: typeof patientAge === "number" ? patientAge : (Number(patientAge) || null),
      patientHeightCm: typeof patientHeightCm === "number" ? patientHeightCm : (Number(patientHeightCm) || null),
      patientNotes: patientNotes ? String(patientNotes).trim() : null,
      patientUpdatedAt: Timestamp.fromDate(new Date()),
    };

    const deviceRef = db.collection("devices").doc(deviceId);
    const testRef = deviceRef.collection("tests").doc(testId);

    await testRef.update(updateData);

    // If applyToSameDay is requested, batch update other unassigned tests from that day
    let batchCount = 1;
    if (applyToSameDay && dayKey) {
      const testsSnap = await deviceRef
        .collection("tests")
        .where("dayKey", "==", dayKey)
        .get();

      const batch = db.batch();
      for (const docSnap of testsSnap.docs) {
        if (docSnap.id !== testId && !docSnap.data().patientId) {
          batch.update(docSnap.ref, updateData);
          batchCount++;
        }
      }
      if (batchCount > 1) {
        await batch.commit();
      }
    }

    return {
      statusCode: 200,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, updated: batchCount, patientId }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: err?.message || "Internal server error" }),
    };
  }
};
