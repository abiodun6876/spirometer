import { useState, useEffect } from "react";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import type { DailySummary } from "../lib/analytics";

export function useDaily(deviceId: string | null, days = 30) {
  const [daily, setDaily]     = useState<DailySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!deviceId) { setLoading(false); return; }

    const q = query(
      collection(db, "devices", deviceId, "daily"),
      orderBy("__name__", "desc"),
      limit(days)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const sorted = snap.docs
          .map((d) => ({ dayKey: d.id, ...(d.data() as Omit<DailySummary, "dayKey">) }))
          .sort((a, b) => a.dayKey.localeCompare(b.dayKey));
        setDaily(sorted);
        setLoading(false);
      },
      (err) => { setError(err.message); setLoading(false); }
    );
    return unsub;
  }, [deviceId, days]);

  return { daily, loading, error };
}
