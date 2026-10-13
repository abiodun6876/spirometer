import { useState, useEffect, useCallback } from "react";
import {
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

// ── Types ──────────────────────────────────────────────────────────────────────
export interface PatientProfile {
  id: string;               // e.g. "PAT-4821"
  name: string;
  gender: "male" | "female" | "other";
  age: number;
  heightCm: number;         // in centimetres
  notes?: string;
  totalTests?: number;
  lastTestAt?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

/** Generate an easy-to-read, 4-digit numeric ID like PAT-4821 for easy writing on charts */
export function generatePatientId(): string {
  const randNum = Math.floor(1000 + Math.random() * 9000);
  return `PAT-${randNum}`;
}

/** Standard ATS/ERS predicted spirometry values based on demographic parameters */
export function calculatePredictedValues(gender: "male" | "female" | "other", age: number, heightCm: number) {
  if (!age || !heightCm || age < 5 || heightCm < 50) {
    return { predFvc: null, predFev1: null, predRatio: null };
  }
  const isMale = gender === "male";
  // GLI/Hankinson adult reference approximations
  let predFvc = isMale
    ? 0.0576 * heightCm - 0.026 * age - 4.34
    : 0.0443 * heightCm - 0.026 * age - 2.89;
  let predFev1 = isMale
    ? 0.0430 * heightCm - 0.029 * age - 2.49
    : 0.0395 * heightCm - 0.025 * age - 2.60;

  predFvc = Math.max(1.0, parseFloat(predFvc.toFixed(2)));
  predFev1 = Math.max(0.8, parseFloat(predFev1.toFixed(2)));
  const predRatio = parseFloat(((predFev1 / predFvc) * 100).toFixed(1));

  return { predFvc, predFev1, predRatio };
}

export const EMPTY_PATIENT: PatientProfile = {
  id: "",
  name: "",
  gender: "male",
  age: 0,
  heightCm: 0,
  notes: "",
  totalTests: 0,
  lastTestAt: null,
  createdAt: null,
  updatedAt: null,
};

// ── Hook ───────────────────────────────────────────────────────────────────────
export function usePatient(deviceId: string | null) {
  const [patient, setPatient]         = useState<PatientProfile>(EMPTY_PATIENT);
  const [allPatients]                 = useState<PatientProfile[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);

  // Listen on devices/{deviceId} to track the currently active patient
  useEffect(() => {
    if (!deviceId) {
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      doc(db, "devices", deviceId),
      (snap) => {
        if (!snap.exists()) {
          setPatient(EMPTY_PATIENT);
          setLoading(false);
          return;
        }
        const d = snap.data();
        const activeId = d.activePatientId ?? d.patientId ?? "";
        setPatient({
          id:         activeId,
          name:       d.patientName     ?? "",
          gender:     d.patientGender   ?? "male",
          age:        d.patientAge      ?? 0,
          heightCm:   d.patientHeightCm ?? 0,
          notes:      d.patientNotes    ?? "",
          totalTests: d.patientTotalTests ?? 0,
          lastTestAt: d.patientLastTestAt?.toDate() ?? null,
          createdAt:  d.patientCreatedAt?.toDate() ?? null,
          updatedAt:  d.patientUpdatedAt?.toDate() ?? null,
        });
        setLoading(false);
      },
      (err) => {
        console.warn("Error listening to device active patient:", err);
        setLoading(false);
      }
    );
    return unsub;
  }, [deviceId]);

  // 3. Save / Update Patient and set as Active on the hardware device
  const saveAndActivatePatient = useCallback(
    async (profile: Omit<PatientProfile, "updatedAt" | "createdAt"> & { id?: string }) => {
      const patientId = (profile.id && profile.id.trim()) ? profile.id.trim() : generatePatientId();
      setSaving(true);
      try {
        const now = new Date();
        const patientData = {
          id:         patientId,
          name:       profile.name.trim(),
          gender:     profile.gender,
          age:        profile.age,
          heightCm:   profile.heightCm,
          notes:      profile.notes?.trim() ?? "",
          updatedAt:  serverTimestamp(),
        };

        // Save into Firestore patients collection
        await setDoc(doc(db, "patients", patientId), patientData, { merge: true });

        // Update active patient on device if deviceId is connected
        if (deviceId) {
          await setDoc(
            doc(db, "devices", deviceId),
            {
              activePatientId:  patientId,
              patientId:        patientId,
              patientName:      profile.name.trim(),
              patientGender:    profile.gender,
              patientAge:       profile.age,
              patientHeightCm:  profile.heightCm,
              patientNotes:     profile.notes?.trim() ?? "",
              patientUpdatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }

        setPatient({
          id:         patientId,
          name:       profile.name.trim(),
          gender:     profile.gender,
          age:        profile.age,
          heightCm:   profile.heightCm,
          notes:      profile.notes?.trim() ?? "",
          totalTests: 0,
          lastTestAt: null,
          createdAt:  now,
          updatedAt:  now,
        });

        return patientId;
      } finally {
        setSaving(false);
      }
    },
    [deviceId]
  );

  // 4. Switch the active patient on the hardware device by selecting an existing patient
  const switchActivePatient = useCallback(
    async (targetPatient: PatientProfile) => {
      if (!deviceId) return;
      setSaving(true);
      try {
        await setDoc(
          doc(db, "devices", deviceId),
          {
            activePatientId:  targetPatient.id,
            patientId:        targetPatient.id,
            patientName:      targetPatient.name,
            patientGender:    targetPatient.gender,
            patientAge:       targetPatient.age,
            patientHeightCm:  targetPatient.heightCm,
            patientNotes:     targetPatient.notes ?? "",
            patientUpdatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        setPatient(targetPatient);
      } finally {
        setSaving(false);
      }
    },
    [deviceId]
  );

  // 5. Update patient in patients table (and update device if it's currently active)
  const updatePatientRecord = useCallback(
    async (updated: PatientProfile) => {
      setSaving(true);
      try {
        await updateDoc(doc(db, "patients", updated.id), {
          name:      updated.name.trim(),
          gender:    updated.gender,
          age:       updated.age,
          heightCm:  updated.heightCm,
          notes:     updated.notes?.trim() ?? "",
          updatedAt: serverTimestamp(),
        });

        // If this patient is the currently active patient on the device, sync changes
        if (deviceId && patient.id === updated.id) {
          await setDoc(
            doc(db, "devices", deviceId),
            {
              patientName:      updated.name.trim(),
              patientGender:    updated.gender,
              patientAge:       updated.age,
              patientHeightCm:  updated.heightCm,
              patientNotes:     updated.notes?.trim() ?? "",
              patientUpdatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }
      } finally {
        setSaving(false);
      }
    },
    [deviceId, patient.id]
  );

  const hasProfile = Boolean(
    patient && patient.name && patient.age > 0 && patient.heightCm > 0
  );

  return {
    patient,
    allPatients,
    loading,
    saving,
    hasProfile,
    saveAndActivatePatient,
    switchActivePatient,
    updatePatientRecord,
    generatePatientId,
  };
}
