import { useState, useEffect, useCallback } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";

// ── Types ──────────────────────────────────────────────────────────────────────
export interface PatientProfile {
  name: string;
  gender: "male" | "female" | "other";
  age: number;
  heightCm: number;        // height in centimetres
  updatedAt?: Date | null;
}

const EMPTY: PatientProfile = {
  name: "",
  gender: "male",
  age: 0,
  heightCm: 0,
  updatedAt: null,
};

// ── Hook ───────────────────────────────────────────────────────────────────────
export function usePatient(deviceId: string | null) {
  const [patient, setPatient]   = useState<PatientProfile | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  // Real-time listener on devices/{deviceId} — patient fields live on the device doc
  useEffect(() => {
    if (!deviceId) { setLoading(false); return; }

    const unsub = onSnapshot(doc(db, "devices", deviceId), (snap) => {
      if (!snap.exists()) { setPatient(null); setLoading(false); return; }
      const d = snap.data();
      setPatient({
        name:      d.patientName     ?? "",
        gender:    d.patientGender   ?? "male",
        age:       d.patientAge      ?? 0,
        heightCm:  d.patientHeightCm ?? 0,
        updatedAt: d.patientUpdatedAt?.toDate() ?? null,
      });
      setLoading(false);
    });
    return unsub;
  }, [deviceId]);

  // Save patient info — merge into the device document
  const savePatient = useCallback(
    async (profile: Omit<PatientProfile, "updatedAt">) => {
      if (!deviceId) return;
      setSaving(true);
      try {
        await setDoc(
          doc(db, "devices", deviceId),
          {
            patientName:      profile.name,
            patientGender:    profile.gender,
            patientAge:       profile.age,
            patientHeightCm:  profile.heightCm,
            patientUpdatedAt: new Date(),
          },
          { merge: true }
        );
      } finally {
        setSaving(false);
      }
    },
    [deviceId]
  );

  const hasProfile = Boolean(
    patient && patient.name && patient.age > 0 && patient.heightCm > 0
  );

  return { patient: patient ?? EMPTY, loading, saving, savePatient, hasProfile };
}
