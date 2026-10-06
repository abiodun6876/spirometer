import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth, db } from "../firebase";

// ── Types ──────────────────────────────────────────────────────────────────────
interface DeviceCtx {
  deviceId:  string;
  setDevice: (id: string) => void;
  loading:   boolean;
}

const FALLBACK_DEVICE_ID = "ESP32-SPIRO-01";
const LS_KEY = "spirosense_device_id";

// ── Context ────────────────────────────────────────────────────────────────────
const DeviceContext = createContext<DeviceCtx>({
  deviceId:  FALLBACK_DEVICE_ID,
  setDevice: () => {},
  loading:   false,
});

// ── Provider ───────────────────────────────────────────────────────────────────
export function DeviceProvider({ children }: { children: ReactNode }) {
  const [deviceId, setDeviceId] = useState<string>(
    () => localStorage.getItem(LS_KEY) ?? FALLBACK_DEVICE_ID
  );
  const [loading, setLoading] = useState(true);

  // On auth change, try to pull the user's preferred device from Firestore
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user: User | null) => {
      if (!user) { setLoading(false); return; }
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.data();
        if (data?.deviceId) {
          setDeviceId(data.deviceId as string);
          localStorage.setItem(LS_KEY, data.deviceId as string);
        }
      } catch {
        // Firestore unavailable — use cached value silently
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  const setDevice = useCallback((id: string) => {
    setDeviceId(id);
    localStorage.setItem(LS_KEY, id);
  }, []);

  return (
    <DeviceContext.Provider value={{ deviceId, setDevice, loading }}>
      {children}
    </DeviceContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────────
export function useDeviceId() {
  return useContext(DeviceContext);
}
