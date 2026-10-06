import { useState, useEffect } from "react";
import {
  collection, query, orderBy, limit, onSnapshot,
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
              id:         d.id,
              fvc:        data.fvc,
              fev1:       data.fev1,
              ratio:      data.ratio,
              peakFlow:   data.peakFlow ?? null,
              status:     data.status,
              score:      data.score,
              recordedAt: data.recordedAt?.toDate() ?? new Date(),
              dayKey:     data.dayKey,
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
