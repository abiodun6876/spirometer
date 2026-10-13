import { useState, useEffect, useMemo } from "react";
import type { PatientProfile } from "../hooks/usePatient";
import {
  calculatePredictedValues,
  generatePatientId,
} from "../hooks/usePatient";
import { useToast } from "./Toast";

// ── Types ──────────────────────────────────────────────────────────────────────
interface PatientFormProps {
  patient: PatientProfile;
  allPatients: PatientProfile[];
  saving: boolean;
  onSave: (profile: Omit<PatientProfile, "updatedAt" | "createdAt"> & { id?: string }) => Promise<string | undefined>;
  onSwitch: (patient: PatientProfile) => Promise<void>;
  onUpdate: (patient: PatientProfile) => Promise<void>;
  forceEdit?: boolean;
}

type Mode = "VIEW" | "SEARCH" | "CREATE" | "EDIT" | "DIRECTORY";

// ── Component ──────────────────────────────────────────────────────────────────
export function PatientForm({
  patient,
  allPatients,
  saving,
  onSave,
  onSwitch,
  onUpdate,
  forceEdit = false,
}: PatientFormProps) {
  const { showToast } = useToast();
  const hasData = Boolean(patient.id && patient.name && patient.age > 0 && patient.heightCm > 0);

  const [mode, setMode]               = useState<Mode>(forceEdit || !hasData ? "CREATE" : "VIEW");
  const [searchTerm, setSearchTerm]   = useState("");
  const [copiedId, setCopiedId]       = useState(false);

  // Form fields
  const [formId, setFormId]           = useState(patient.id || generatePatientId());
  const [formName, setFormName]       = useState(patient.name);
  const [formGender, setFormGender]   = useState<"male" | "female" | "other">(patient.gender);
  const [formAge, setFormAge]         = useState(patient.age ? String(patient.age) : "");
  const [formHeight, setFormHeight]   = useState(patient.heightCm ? String(patient.heightCm) : "");
  const [formNotes, setFormNotes]     = useState(patient.notes || "");
  const [error, setError]             = useState("");

  // Target patient being edited in directory/search
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);

  // When active patient changes from outside
  useEffect(() => {
    if (patient.id) {
      if (mode === "VIEW" || !hasData) {
        setFormId(patient.id);
        setFormName(patient.name);
        setFormGender(patient.gender);
        setFormAge(patient.age ? String(patient.age) : "");
        setFormHeight(patient.heightCm ? String(patient.heightCm) : "");
        setFormNotes(patient.notes || "");
      }
    }
  }, [patient.id, patient.name, patient.gender, patient.age, patient.heightCm, patient.notes]);

  // Live ATS/ERS calculation for form
  const livePred = useMemo(() => {
    const a = Number(formAge);
    const h = Number(formHeight);
    return calculatePredictedValues(formGender, a, h);
  }, [formGender, formAge, formHeight]);

  // Active patient predicted norms
  const activePred = useMemo(() => {
    return calculatePredictedValues(patient.gender, patient.age, patient.heightCm);
  }, [patient.gender, patient.age, patient.heightCm]);

  // Filtered patients for search & directory
  const filteredPatients = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return allPatients;
    return allPatients.filter(
      (p) =>
        p.id.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.notes && p.notes.toLowerCase().includes(q))
    );
  }, [allPatients, searchTerm]);

  function copyPatientId(idToCopy: string) {
    if (!idToCopy) return;
    navigator.clipboard.writeText(idToCopy).then(() => {
      setCopiedId(true);
      showToast(`Copied Patient ID: ${idToCopy}`, "success");
      setTimeout(() => setCopiedId(false), 2000);
    });
  }

  function handleStartCreate() {
    const newId = generatePatientId();
    setFormId(newId);
    setFormName("");
    setFormGender("male");
    setFormAge("");
    setFormHeight("");
    setFormNotes("");
    setError("");
    setEditingTargetId(null);
    setMode("CREATE");
  }

  function handleStartEdit(p?: PatientProfile) {
    const target = p || patient;
    setFormId(target.id || generatePatientId());
    setFormName(target.name);
    setFormGender(target.gender);
    setFormAge(target.age ? String(target.age) : "");
    setFormHeight(target.heightCm ? String(target.heightCm) : "");
    setFormNotes(target.notes || "");
    setError("");
    setEditingTargetId(target.id);
    setMode("EDIT");
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const trimmedId = formId.trim() || generatePatientId();
    const trimmedName = formName.trim();
    const ageNum = Number(formAge);
    const heightNum = Number(formHeight);

    if (!trimmedName) {
      setError("Please enter the patient's full name.");
      return;
    }
    if (!ageNum || ageNum < 1 || ageNum > 120) {
      setError("Please enter a valid age (1–120 years).");
      return;
    }
    if (!heightNum || heightNum < 50 || heightNum > 250) {
      setError("Please enter a valid height (50–250 cm).");
      return;
    }

    try {
      if (mode === "EDIT" && editingTargetId) {
        // Updating existing patient record
        const updatedProfile: PatientProfile = {
          id: editingTargetId,
          name: trimmedName,
          gender: formGender,
          age: ageNum,
          heightCm: heightNum,
          notes: formNotes.trim(),
        };
        await onUpdate(updatedProfile);
        showToast(`Patient ${trimmedId} (${trimmedName}) updated successfully.`, "success");
      } else {
        // Creating and activating new patient
        const savedId = await onSave({
          id: trimmedId,
          name: trimmedName,
          gender: formGender,
          age: ageNum,
          heightCm: heightNum,
          notes: formNotes.trim(),
        });
        showToast(`Patient ${savedId || trimmedId} linked to hardware!`, "success");
      }
      setMode("VIEW");
    } catch (err: any) {
      setError(err?.message || "Failed to save patient. Please check permissions.");
    }
  }

  async function handleSelectPatient(p: PatientProfile) {
    try {
      await onSwitch(p);
      showToast(`Active patient switched to: ${p.id} (${p.name})`, "success");
      setMode("VIEW");
    } catch {
      showToast("Failed to switch patient on device.", "error");
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: Search Modal / Section
  // ─────────────────────────────────────────────────────────────────────────────
  if (mode === "SEARCH") {
    return (
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h2 style={cardTitle}>🔍 Search Patient by ID or Name</h2>
          <button onClick={() => setMode("VIEW")} style={secondaryBtn}>✕ Close</button>
        </div>

        <div style={{ position: "relative", marginBottom: "16px" }}>
          <input
            id="search-patient-input"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by ID (e.g. PAT-4821) or patient name..."
            style={{ ...inputStyle, paddingLeft: "36px", fontSize: "0.95rem" }}
            autoFocus
          />
          <span style={{ position: "absolute", left: "12px", top: "11px", color: "#64748b" }}>🔍</span>
        </div>

        <div style={{ maxHeight: "320px", overflowY: "auto", display: "grid", gap: "10px", marginBottom: "16px" }}>
          {filteredPatients.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px", color: "#64748b", background: "rgba(255,255,255,0.02)", borderRadius: "10px" }}>
              <p style={{ margin: "0 0 12px", fontSize: "0.88rem", color: "#cbd5e1" }}>
                {searchTerm.trim()
                  ? `No record found yet for Patient ID "${searchTerm.trim().toUpperCase()}".`
                  : "No matching patients found."}
              </p>
              {searchTerm.trim() ? (
                <button
                  onClick={() => {
                    setFormId(searchTerm.trim().toUpperCase());
                    setFormName("");
                    setFormGender("male");
                    setFormAge("");
                    setFormHeight("");
                    setFormNotes("");
                    setError("");
                    setEditingTargetId(null);
                    setMode("CREATE");
                  }}
                  style={primaryBtn}
                >
                  ➕ Attach Name, Age & Details to ID: {searchTerm.trim().toUpperCase()}
                </button>
              ) : (
                <button onClick={handleStartCreate} style={primaryBtn}>
                  ➕ Create Patient with Auto ID
                </button>
              )}
            </div>
          ) : (
            filteredPatients.map((p) => {
              const isActive = p.id === patient.id;
              return (
                <div
                  key={p.id}
                  style={{
                    background: isActive ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.04)",
                    border: isActive ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "12px",
                    padding: "14px 18px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "12px",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                      <span style={idBadge}>{p.id}</span>
                      <strong style={{ color: "#f1f5f9", fontSize: "0.95rem" }}>{p.name || "Unnamed Patient"}</strong>
                      {isActive && (
                        <span style={{ background: "rgba(34,197,94,0.18)", color: "#4ade80", fontSize: "0.68rem", fontWeight: 700, padding: "2px 8px", borderRadius: "6px" }}>
                          ACTIVE ON HARDWARE
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                      {p.gender.charAt(0).toUpperCase() + p.gender.slice(1)} · {p.age ? `${p.age} yrs` : "Age not set"} · {p.heightCm ? `${p.heightCm} cm` : "Height not set"}
                      {p.totalTests ? ` · ${p.totalTests} tests recorded` : ""}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    {!isActive && (
                      <button
                        onClick={() => handleSelectPatient(p)}
                        style={primarySmallBtn}
                      >
                        ⚡ Set Active
                      </button>
                    )}
                    <button
                      onClick={() => handleStartEdit(p)}
                      style={secondarySmallBtn}
                    >
                      ✏️ Update Name, Age & Height
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "14px" }}>
          <button onClick={handleStartCreate} style={secondaryBtn}>
            ➕ Register New Patient
          </button>
          <button onClick={() => setMode("VIEW")} style={secondaryBtn}>
            Back
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: Patient Directory Modal
  // ─────────────────────────────────────────────────────────────────────────────
  if (mode === "DIRECTORY") {
    return (
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h2 style={cardTitle}>📋 Patient Directory ({allPatients.length})</h2>
            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>All patients saved in Firebase</span>
          </div>
          <button onClick={() => setMode("VIEW")} style={secondaryBtn}>✕ Close</button>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter by ID or Name..."
            style={inputStyle}
          />
        </div>

        <div style={{ overflowX: "auto", maxHeight: "360px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", color: "#64748b", textAlign: "left" }}>
                <th style={{ padding: "8px 12px" }}>PATIENT ID</th>
                <th style={{ padding: "8px 12px" }}>NAME</th>
                <th style={{ padding: "8px 12px" }}>GENDER</th>
                <th style={{ padding: "8px 12px" }}>AGE</th>
                <th style={{ padding: "8px 12px" }}>HEIGHT</th>
                <th style={{ padding: "8px 12px" }}>TESTS</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredPatients.map((p) => {
                const isActive = p.id === patient.id;
                return (
                  <tr
                    key={p.id}
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      background: isActive ? "rgba(99,102,241,0.08)" : "transparent",
                    }}
                  >
                    <td style={{ padding: "10px 12px" }}>
                      <span style={idBadge}>{p.id}</span>
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: "#f1f5f9" }}>{p.name}</td>
                    <td style={{ padding: "10px 12px", color: "#94a3b8" }}>{p.gender}</td>
                    <td style={{ padding: "10px 12px", color: "#94a3b8" }}>{p.age} y</td>
                    <td style={{ padding: "10px 12px", color: "#94a3b8" }}>{p.heightCm} cm</td>
                    <td style={{ padding: "10px 12px", color: "#94a3b8" }}>{p.totalTests ?? 0}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "6px" }}>
                        {!isActive ? (
                          <button onClick={() => handleSelectPatient(p)} style={primarySmallBtn}>
                            Activate
                          </button>
                        ) : (
                          <span style={{ fontSize: "0.72rem", color: "#4ade80", fontWeight: 700, padding: "4px 8px" }}>
                            Active
                          </span>
                        )}
                        <button onClick={() => handleStartEdit(p)} style={secondarySmallBtn}>
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "16px", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "14px" }}>
          <button onClick={handleStartCreate} style={primaryBtn}>➕ Add New Patient</button>
          <button onClick={() => setMode("VIEW")} style={secondaryBtn}>Back</button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: Create or Edit Form
  // ─────────────────────────────────────────────────────────────────────────────
  if (mode === "CREATE" || mode === "EDIT") {
    const isEdit = mode === "EDIT";
    return (
      <form onSubmit={handleFormSubmit} style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h2 style={cardTitle}>
              {isEdit ? "✏️ Edit Patient Record" : "➕ Register Patient & Assign ID"}
            </h2>
            <p style={{ color: "#94a3b8", fontSize: "0.8rem", margin: "4px 0 0" }}>
              {isEdit
                ? "Update patient demographic information in Firebase."
                : "Auto-generated Patient ID can be written on paper notes to link hardware spirometer tests."}
            </p>
          </div>
          {hasData && (
            <button type="button" onClick={() => setMode("VIEW")} style={secondaryBtn}>
              ✕ Cancel
            </button>
          )}
        </div>

        {/* Auto Generated Patient ID section */}
        <div
          style={{
            background: "rgba(99,102,241,0.08)",
            border: "1px dashed rgba(99,102,241,0.35)",
            borderRadius: "12px",
            padding: "14px 18px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <span style={{ fontSize: "0.7rem", color: "#818cf8", fontWeight: 700, letterSpacing: "0.08em", display: "block" }}>
              PATIENT ID (AUTO-GENERATED)
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
              <input
                id="patient-id-input"
                type="text"
                value={formId}
                onChange={(e) => setFormId(e.target.value.toUpperCase())}
                style={{
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(99,102,241,0.4)",
                  borderRadius: "8px",
                  padding: "6px 12px",
                  color: "#a5b4fc",
                  fontSize: "1.05rem",
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  width: "150px",
                }}
              />
              <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                📝 Write this down on patient's chart / report!
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const newGen = generatePatientId();
              setFormId(newGen);
              showToast(`Generated new ID: ${newGen}`, "info");
            }}
            style={secondarySmallBtn}
            title="Generate another unique Patient ID"
          >
            ⚡ Re-roll ID
          </button>
        </div>

        {/* Demographics inputs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "18px" }}>
          {/* Full Name */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="patient-name" style={labelStyle}>Full Name *</label>
            <input
              id="patient-name"
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. John Doe"
              style={inputStyle}
              autoFocus
            />
          </div>

          {/* Gender */}
          <div>
            <label htmlFor="patient-gender" style={labelStyle}>Gender *</label>
            <select
              id="patient-gender"
              value={formGender}
              onChange={(e) => setFormGender(e.target.value as "male" | "female" | "other")}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Age */}
          <div>
            <label htmlFor="patient-age" style={labelStyle}>Age (years) *</label>
            <input
              id="patient-age"
              type="number"
              min={1}
              max={120}
              value={formAge}
              onChange={(e) => setFormAge(e.target.value)}
              placeholder="e.g. 35"
              style={inputStyle}
            />
          </div>

          {/* Height */}
          <div>
            <label htmlFor="patient-height" style={labelStyle}>Height (cm) *</label>
            <input
              id="patient-height"
              type="number"
              min={50}
              max={250}
              value={formHeight}
              onChange={(e) => setFormHeight(e.target.value)}
              placeholder="e.g. 175"
              style={inputStyle}
            />
          </div>

          {/* Clinical Notes */}
          <div>
            <label htmlFor="patient-notes" style={labelStyle}>Clinical Notes (Optional)</label>
            <input
              id="patient-notes"
              type="text"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="e.g. Routine check, non-smoker"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Live ATS/ERS Reference preview */}
        {livePred.predFvc && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "10px", padding: "10px 16px", marginBottom: "18px", fontSize: "0.78rem", color: "#94a3b8", display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <span style={{ color: "#38bdf8", fontWeight: 600 }}>ATS/ERS Predicted Norms:</span>
            <span>Pred FVC: <strong style={{ color: "#f1f5f9" }}>{livePred.predFvc} L</strong></span>
            <span>Pred FEV1: <strong style={{ color: "#f1f5f9" }}>{livePred.predFev1} L</strong></span>
            <span>Pred Ratio: <strong style={{ color: "#f1f5f9" }}>{livePred.predRatio}%</strong></span>
          </div>
        )}

        {error && (
          <div style={{ color: "#fca5a5", fontSize: "0.82rem", marginBottom: "14px", padding: "8px 14px", background: "rgba(239,68,68,0.08)", borderRadius: "8px", border: "1px solid rgba(239,68,68,0.2)" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button
            id="save-patient-btn"
            type="submit"
            disabled={saving}
            style={primaryBtn}
          >
            {saving ? "Saving to Firebase…" : isEdit ? "💾 Update Patient Record" : "⚡ Save & Link to Hardware"}
          </button>
          {hasData && (
            <button type="button" onClick={() => setMode("VIEW")} style={secondaryBtn}>
              Cancel
            </button>
          )}
          <button type="button" onClick={() => setMode("SEARCH")} style={secondaryBtn}>
            🔍 Search Existing Instead
          </button>
        </div>
      </form>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: Default View - Active Patient Connected to Hardware
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={card}>
      {/* Top Banner: Status + Actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: hasData ? "#22c55e" : "#eab308", boxShadow: hasData ? "0 0 10px #22c55e" : "0 0 10px #eab308" }} />
          <h2 style={cardTitle}>
            {hasData ? "👤 Active Hardware Patient" : "👤 No Patient Assigned"}
          </h2>
          {hasData && (
            <span style={{ fontSize: "0.72rem", color: "#4ade80", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", padding: "2px 8px", borderRadius: "6px", fontWeight: 700 }}>
              LINKED TO ESP32
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            id="search-patient-btn"
            onClick={() => { setSearchTerm(""); setMode("SEARCH"); }}
            style={secondarySmallBtn}
          >
            🔍 Search Patient by ID
          </button>
          <button
            id="new-patient-btn"
            onClick={handleStartCreate}
            style={primarySmallBtn}
          >
            ➕ New Patient (Auto ID)
          </button>
          <button
            id="directory-btn"
            onClick={() => { setSearchTerm(""); setMode("DIRECTORY"); }}
            style={secondarySmallBtn}
          >
            📋 Directory ({allPatients.length})
          </button>
          {hasData && (
            <button
              id="edit-patient-btn"
              onClick={() => handleStartEdit(patient)}
              style={editBtn}
            >
              ✏️ Edit
            </button>
          )}
        </div>
      </div>

      {/* Main Info */}
      {hasData ? (
        <div>
          {/* Patient ID Banner */}
          <div
            style={{
              background: "rgba(99,102,241,0.07)",
              border: "1px solid rgba(99,102,241,0.25)",
              borderRadius: "12px",
              padding: "14px 18px",
              marginBottom: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ ...idBadge, fontSize: "1rem", padding: "6px 14px" }}>
                {patient.id}
              </span>
              <button
                id="copy-patient-id-btn"
                onClick={() => copyPatientId(patient.id)}
                style={secondarySmallBtn}
              >
                {copiedId ? "✓ Copied!" : "📋 Copy ID"}
              </button>
              <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                Write down <strong style={{ color: "#c7d2fe" }}>{patient.id}</strong> on physical charts to reference this record.
              </span>
            </div>
            <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
              Incoming hardware blows will be automatically attached to this Patient ID.
            </div>
          </div>

          {/* Demographics Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "14px", marginBottom: "16px" }}>
            <InfoCell label="Full Name" value={patient.name} highlight />
            <InfoCell label="Gender"    value={patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)} />
            <InfoCell label="Age"       value={`${patient.age} yrs`} />
            <InfoCell label="Height"    value={`${patient.heightCm} cm`} />
            {patient.notes && <InfoCell label="Clinical Notes" value={patient.notes} />}
          </div>

          {/* Predicted Values baseline */}
          {activePred.predFvc && (
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "10px", padding: "10px 16px", display: "flex", gap: "20px", flexWrap: "wrap", fontSize: "0.78rem", color: "#94a3b8" }}>
              <span style={{ color: "#38bdf8", fontWeight: 600 }}>ATS/ERS Target Baselines:</span>
              <span>Predicted FVC: <strong style={{ color: "#f1f5f9" }}>{activePred.predFvc} L</strong></span>
              <span>Predicted FEV1: <strong style={{ color: "#f1f5f9" }}>{activePred.predFev1} L</strong></span>
              <span>Predicted Ratio: <strong style={{ color: "#f1f5f9" }}>{activePred.predRatio}%</strong></span>
            </div>
          )}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "28px 20px", background: "rgba(255,255,255,0.02)", borderRadius: "12px", border: "1px dashed rgba(255,255,255,0.1)" }}>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem", margin: "0 0 16px", maxWidth: "480px", marginLeft: "auto", marginRight: "auto" }}>
            No patient is currently linked to the spirometer hardware. You can auto-generate a new Patient ID or search an existing patient by their ID.
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <button onClick={handleStartCreate} style={primaryBtn}>
              ⚡ Auto-Generate Patient ID
            </button>
            <button onClick={() => { setSearchTerm(""); setMode("SEARCH"); }} style={secondaryBtn}>
              🔍 Search Existing Patient
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function InfoCell({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "4px" }}>
        {label}
      </div>
      <div style={{ color: highlight ? "#f1f5f9" : "#cbd5e1", fontSize: "0.92rem", fontWeight: 600 }}>
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
  fontSize: "1.05rem", fontWeight: 700, margin: 0,
};

const idBadge: React.CSSProperties = {
  background: "rgba(99,102,241,0.2)",
  border: "1px solid rgba(99,102,241,0.45)",
  color: "#c7d2fe",
  borderRadius: "8px",
  padding: "4px 10px",
  fontSize: "0.82rem",
  fontWeight: 800,
  letterSpacing: "0.05em",
  fontFamily: "monospace",
  display: "inline-block",
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
};

const primaryBtn: React.CSSProperties = {
  background: "rgba(99,102,241,0.35)", border: "1px solid rgba(99,102,241,0.5)",
  color: "#c7d2fe", borderRadius: "10px", padding: "10px 20px",
  fontSize: "0.85rem", fontWeight: 700, cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
  color: "#94a3b8", borderRadius: "10px", padding: "10px 18px",
  fontSize: "0.85rem", fontWeight: 600, cursor: "pointer",
};

const primarySmallBtn: React.CSSProperties = {
  background: "rgba(99,102,241,0.25)", border: "1px solid rgba(99,102,241,0.4)",
  color: "#c7d2fe", borderRadius: "8px", padding: "6px 12px",
  fontSize: "0.75rem", fontWeight: 700, cursor: "pointer",
};

const secondarySmallBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
  color: "#94a3b8", borderRadius: "8px", padding: "6px 12px",
  fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
};

const editBtn: React.CSSProperties = {
  background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)",
  color: "#818cf8", borderRadius: "8px", padding: "6px 12px",
  fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
};
