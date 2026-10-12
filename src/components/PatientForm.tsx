import { useState, useEffect } from "react";
import type { PatientProfile } from "../hooks/usePatient";

// ── Types ──────────────────────────────────────────────────────────────────────
interface PatientFormProps {
  patient: PatientProfile;
  saving: boolean;
  onSave: (profile: Omit<PatientProfile, "updatedAt">) => Promise<void>;
  /** If true, shows the form even when a profile exists */
  forceEdit?: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────────
export function PatientForm({ patient, saving, onSave, forceEdit = false }: PatientFormProps) {
  const hasData = Boolean(patient.name && patient.age > 0 && patient.heightCm > 0);
  const [editing, setEditing] = useState(!hasData || forceEdit);
  const [name, setName]       = useState(patient.name);
  const [gender, setGender]   = useState<"male" | "female" | "other">(patient.gender);
  const [age, setAge]         = useState(patient.age || "");
  const [height, setHeight]   = useState(patient.heightCm || "");
  const [error, setError]     = useState("");

  // Sync from props when patient data loads
  useEffect(() => {
    setName(patient.name);
    setGender(patient.gender);
    setAge(patient.age || "");
    setHeight(patient.heightCm || "");
    if (patient.name && patient.age > 0 && patient.heightCm > 0) {
      if (!forceEdit) setEditing(false);
    }
  }, [patient.name, patient.gender, patient.age, patient.heightCm, forceEdit]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const trimmedName = name.trim();
    const ageNum = Number(age);
    const heightNum = Number(height);

    if (!trimmedName)                       { setError("Please enter the patient's name."); return; }
    if (!ageNum || ageNum < 1 || ageNum > 120)   { setError("Please enter a valid age (1–120)."); return; }
    if (!heightNum || heightNum < 50 || heightNum > 250) { setError("Please enter a valid height (50–250 cm)."); return; }

    await onSave({ name: trimmedName, gender, age: ageNum, heightCm: heightNum });
    setEditing(false);
  }

  // ── Read-only card ─────────────────────────────────────────────────────────
  if (!editing && hasData) {
    return (
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <h2 style={cardTitle}>👤 Patient Profile</h2>
          <button
            id="edit-patient-btn"
            onClick={() => setEditing(true)}
            style={editBtn}
          >
            Edit
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          <InfoCell label="Name"   value={patient.name} />
          <InfoCell label="Gender" value={patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)} />
          <InfoCell label="Age"    value={`${patient.age} years`} />
          <InfoCell label="Height" value={`${patient.heightCm} cm`} />
        </div>
      </div>
    );
  }

  // ── Editable form ──────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} style={card}>
      <h2 style={cardTitle}>👤 {hasData ? "Edit Patient Profile" : "Patient Profile"}</h2>
      {!hasData && (
        <p style={{ color: "#94a3b8", fontSize: "0.82rem", margin: "0 0 18px", lineHeight: 1.5 }}>
          Please fill in the patient's demographic information before starting the spirometry test.
          This data helps produce accurate predicted values.
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "18px" }}>
        {/* Name */}
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="patient-name" style={labelStyle}>Full Name</label>
          <input
            id="patient-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. John Doe"
            style={inputStyle}
            autoFocus
          />
        </div>

        {/* Gender */}
        <div>
          <label htmlFor="patient-gender" style={labelStyle}>Gender</label>
          <select
            id="patient-gender"
            value={gender}
            onChange={(e) => setGender(e.target.value as "male" | "female" | "other")}
            style={{ ...inputStyle, cursor: "pointer" }}
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Age */}
        <div>
          <label htmlFor="patient-age" style={labelStyle}>Age (years)</label>
          <input
            id="patient-age"
            type="number"
            min={1}
            max={120}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="e.g. 35"
            style={inputStyle}
          />
        </div>

        {/* Height */}
        <div>
          <label htmlFor="patient-height" style={labelStyle}>Height (cm)</label>
          <input
            id="patient-height"
            type="number"
            min={50}
            max={250}
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            placeholder="e.g. 175"
            style={inputStyle}
          />
        </div>
      </div>

      {error && (
        <div style={{ color: "#fca5a5", fontSize: "0.82rem", marginBottom: "12px", padding: "8px 14px", background: "rgba(239,68,68,0.08)", borderRadius: "8px", border: "1px solid rgba(239,68,68,0.2)" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: "10px" }}>
        <button
          id="save-patient-btn"
          type="submit"
          disabled={saving}
          style={primaryBtn}
        >
          {saving ? "Saving…" : hasData ? "Update Profile" : "Save & Continue"}
        </button>
        {hasData && (
          <button type="button" onClick={() => setEditing(false)} style={secondaryBtn}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "4px" }}>
        {label}
      </div>
      <div style={{ color: "#e2e8f0", fontSize: "0.92rem", fontWeight: 600 }}>
        {value}
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background:   "rgba(255,255,255,0.03)",
  border:       "1px solid rgba(255,255,255,0.07)",
  borderRadius: "16px",
  padding:      "24px",
  marginBottom: "28px",
};

const cardTitle: React.CSSProperties = {
  fontSize: "1rem", fontWeight: 700, margin: 0,
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.72rem", color: "#94a3b8", fontWeight: 600, letterSpacing: "0.06em",
  textTransform: "uppercase", display: "block", marginBottom: "6px",
};

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "10px",
  padding: "10px 14px",
  color: "#f1f5f9",
  fontSize: "0.88rem",
  outline: "none",
  transition: "border-color 0.2s",
};

const primaryBtn: React.CSSProperties = {
  background: "rgba(99,102,241,0.35)", border: "1px solid rgba(99,102,241,0.5)",
  color: "#c7d2fe", borderRadius: "10px", padding: "10px 22px",
  fontSize: "0.85rem", fontWeight: 700, cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
  color: "#94a3b8", borderRadius: "10px", padding: "10px 18px",
  fontSize: "0.85rem", fontWeight: 600, cursor: "pointer",
};

const editBtn: React.CSSProperties = {
  background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)",
  color: "#818cf8", borderRadius: "8px", padding: "5px 14px",
  fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
};
