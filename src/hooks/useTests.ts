import { useState, useEffect } from "react";
import {
  collection, query, orderBy, limit, onSnapshot, doc, updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import type { TestStatus } from "../lib/scoring";

export interface SpiroTest {
  id: string;
  fvc: number;
  fev1: number;
  ratio: number;
  peakFlow: number | null;
  status: TestStatus;
  score: number;
  recordedAt: Date;
  dayKey: string;
  patientId?: string | null;
  patientName?: string | null;
  patientGender?: "male" | "female" | "other" | null;
  patientAge?: number | null;
  patientHeightCm?: number | null;
  patientNotes?: string | null;
}

export interface UpdateTestPatientParams {
  deviceId: string;
  testId: string;
  patientId: string;
  patientName: string;
  patientGender?: "male" | "female" | "other";
  patientAge?: number;
  patientHeightCm?: number;
  patientNotes?: string;
  applyToSameDay?: boolean;
  dayKey?: string;
}

export async function updateTestPatientDetails(params: UpdateTestPatientParams) {
  const payload = {
    ...params,
    patientId: params.patientId.trim().toUpperCase(),
    patientName: params.patientName.trim(),
  };

  // 1. Try Netlify serverless function first (Admin SDK bypasses client permissions)
  try {
    const res = await fetch("/api/update-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Continue to fallback
  }

  // 2. Fallback to direct client-side update
  const testRef = doc(db, "devices", params.deviceId, "tests", params.testId);
  await updateDoc(testRef, {
    patientId: payload.patientId,
    patientName: payload.patientName,
    patientGender: params.patientGender || null,
    patientAge: params.patientAge || null,
    patientHeightCm: params.patientHeightCm || null,
    patientNotes: params.patientNotes?.trim() || null,
  });
}

export function useTests(deviceId: string | null, maxDocs = 100) {
  const [tests, setTests]     = useState<SpiroTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!deviceId) { setLoading(false); return; }

    const q = query(
      collection(db, "devices", deviceId, "tests"),
      orderBy("recordedAt", "desc"),
      limit(maxDocs)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setTests(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id:              d.id,
              fvc:             data.fvc,
              fev1:            data.fev1,
              ratio:           data.ratio,
              peakFlow:        data.peakFlow ?? null,
              status:          data.status,
              score:           data.score,
              recordedAt:      data.recordedAt?.toDate() ?? new Date(),
              dayKey:          data.dayKey,
              patientId:       data.patientId ?? null,
              patientName:     data.patientName ?? null,
              patientGender:   data.patientGender ?? null,
              patientAge:      data.patientAge ?? null,
              patientHeightCm: data.patientHeightCm ?? null,
              patientNotes:    data.patientNotes ?? null,
            };
          })
        );
        setLoading(false);
      },
      (err) => { setError(err.message); setLoading(false); }
    );

    return unsub;
  }, [deviceId, maxDocs]);

  return { tests, loading, error };
}

export function useLatestTest(deviceId: string | null): {
  test: SpiroTest | null; loading: boolean;
} {
  const { tests, loading } = useTests(deviceId, 1);
  return { test: tests[0] ?? null, loading };
}
