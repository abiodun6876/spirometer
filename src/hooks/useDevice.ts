import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export interface DeviceInfo {
  id: string;
  name: string;
  ownerUid: string;
  lastSeenAt: Date | null;
}

export function useDevice(deviceId: string | null) {
  const [device, setDevice]   = useState<DeviceInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!deviceId) { setLoading(false); return; }

    const unsub = onSnapshot(doc(db, "devices", deviceId), (snap) => {
      if (!snap.exists()) { setDevice(null); setLoading(false); return; }
      const d = snap.data();
      setDevice({
        id:         snap.id,
        name:       d.name ?? deviceId,
        ownerUid:   d.ownerUid,
        lastSeenAt: d.lastSeenAt?.toDate() ?? null,
      });
      setLoading(false);
    });
    return unsub;
  }, [deviceId]);

  return { device, loading };
}
