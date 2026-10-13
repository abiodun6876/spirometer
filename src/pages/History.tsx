import { useState, useMemo } from "react";
import { format } from "date-fns";
import { useTests, updateTestPatientDetails } from "../hooks/useTests";
import type { SpiroTest } from "../hooks/useTests";
import { generatePatientId, calculatePredictedValues } from "../hooks/usePatient";
import { StatusBadge } from "../components/StatusBadge";
import { Header } from "../components/Header";
import type { TestStatus } from "../lib/scoring";
import { useDeviceId } from "../context/DeviceContext";
import { useToast } from "../components/Toast";

function exportCsv(data: SpiroTest[]) {
  const header = "Patient ID,Patient Name,Gender,Age,Height (cm),Date,Time,FVC (L),FEV1 (L),FEV1/FVC (%),Score,Status";
  const rows = data.map((t) => [
    `"${t.patientId || "Unassigned"}"`,
    `"${t.patientName || "Unassigned"}"`,
    `"${t.patientGender || "—"}"`,
    t.patientAge ? t.patientAge : "—",
    t.patientHeightCm ? t.patientHeightCm : "—",
    format(t.recordedAt, "yyyy-MM-dd"),
    format(t.recordedAt, "HH:mm:ss"),
    t.fvc.toFixed(3),
    t.fev1.toFixed(3),
    t.ratio.toFixed(2),
    t.score,
    t.status,
  ].join(","));
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `spirosense_history_${format(new Date(), "yyyyMMdd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function History() {
  const { deviceId } = useDeviceId();
  const { showToast } = useToast();
  const { tests, loading } = useTests(deviceId, 500);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | TestStatus>("ALL");
  const [patientSearch, setPatientSearch] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  // Derive known patients directly from test history (100% permission-safe, no external collection)
  const knownPatients = useMemo(() => {
    const map = new Map<string, {
      id: string;
      name: string;
      gender?: "male" | "female" | "other";
      age?: number;
      heightCm?: number;
      notes?: string;
    }>();
    for (const t of tests) {
      if (t.patientId && !map.has(t.patientId)) {
        map.set(t.patientId, {
          id: t.patientId,
          name: t.patientName || "",
          gender: (t.patientGender as any) || "male",
          age: t.patientAge || undefined,
          heightCm: t.patientHeightCm || undefined,
          notes: t.patientNotes || undefined,
        });
      }
    }
    return Array.from(map.values());
  }, [tests]);

  // Modal State
  const [assigningTest, setAssigningTest]             = useState<SpiroTest | null>(null);
  const [assignTargetId, setAssignTargetId]           = useState("");
  const [assignTargetName, setAssignTargetName]       = useState("");
  const [assignTargetGender, setAssignTargetGender]   = useState<"male" | "female" | "other">("male");
  const [assignTargetAge, setAssignTargetAge]         = useState("");
  const [assignTargetHeight, setAssignTargetHeight]   = useState("");
  const [assignTargetNotes, setAssignTargetNotes]     = useState("");
  const [applyToSameDay, setApplyToSameDay]           = useState(false);
  const [assigning, setAssigning]                     = useState(false);

  // Live ATS/ERS prediction preview inside modal
  const modalPred = useMemo(() => {
    return calculatePredictedValues(assignTargetGender, Number(assignTargetAge), Number(assignTargetHeight));
  }, [assignTargetGender, assignTargetAge, assignTargetHeight]);

  const filtered = useMemo(() => {
    return tests.filter((t) => {
      const dk = t.dayKey;
      if (dateFrom && dk < dateFrom) return false;
      if (dateTo   && dk > dateTo)   return false;
      if (statusFilter !== "ALL" && t.status !== statusFilter) return false;

      if (patientSearch.trim()) {
        const q = patientSearch.trim().toLowerCase();
        const pid = (t.patientId || "").toLowerCase();
        const pname = (t.patientName || "").toLowerCase();
        if (q === "unassigned") {
          if (t.patientId) return false;
        } else {
          if (!pid.includes(q) && !pname.includes(q)) return false;
        }
      }

      return true;
    });
  }, [tests, dateFrom, dateTo, statusFilter, patientSearch]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function openAssignModal(test: SpiroTest) {
    setAssigningTest(test);
    const existingPid = test.patientId || "";
    const existingPatient = knownPatients.find((p) => p.id === existingPid);

    if (existingPatient) {
      setAssignTargetId(existingPatient.id);
      setAssignTargetName(existingPatient.name);
      setAssignTargetGender(existingPatient.gender || "male");
      setAssignTargetAge(existingPatient.age ? String(existingPatient.age) : "");
      setAssignTargetHeight(existingPatient.heightCm ? String(existingPatient.heightCm) : "");
      setAssignTargetNotes(existingPatient.notes || "");
    } else {
      setAssignTargetId(existingPid || generatePatientId());
      setAssignTargetName(test.patientName || "");
      setAssignTargetGender((test.patientGender as any) || "male");
      setAssignTargetAge(test.patientAge ? String(test.patientAge) : "");
      setAssignTargetHeight(test.patientHeightCm ? String(test.patientHeightCm) : "");
      setAssignTargetNotes(test.patientNotes || "");
    }
    setApplyToSameDay(false);
  }

  function handleSelectExistingPatient(patientId: string) {
    const found = knownPatients.find((p) => p.id === patientId);
    if (found) {
      setAssignTargetId(found.id);
      setAssignTargetName(found.name);
      setAssignTargetGender(found.gender || "male");
      setAssignTargetAge(found.age ? String(found.age) : "");
      setAssignTargetHeight(found.heightCm ? String(found.heightCm) : "");
      setAssignTargetNotes(found.notes || "");
    }
  }

  async function handleConfirmSavePatient(e: React.FormEvent) {
    e.preventDefault();
    if (!deviceId || !assigningTest) return;

    const pid = assignTargetId.trim().toUpperCase();
    const pname = assignTargetName.trim();
    const ageNum = Number(assignTargetAge);
    const heightNum = Number(assignTargetHeight);

    if (!pid) {
      showToast("Please enter or generate a Patient ID.", "error");
      return;
    }
    if (!pname) {
      showToast("Please enter the patient's full name.", "error");
      return;
    }
    if (!ageNum || ageNum < 1 || ageNum > 120) {
      showToast("Please enter a valid age (1–120 years).", "error");
      return;
    }
    if (!heightNum || heightNum < 50 || heightNum > 250) {
      showToast("Please enter a valid height (50–250 cm).", "error");
      return;
    }

    setAssigning(true);
    try {
      await updateTestPatientDetails({
        deviceId,
        testId: assigningTest.id,
        patientId: pid,
        patientName: pname,
        patientGender: assignTargetGender,
        patientAge: ageNum,
        patientHeightCm: heightNum,
        patientNotes: assignTargetNotes,
        applyToSameDay,
        dayKey: assigningTest.dayKey,
      });

      showToast(`Patient details saved & linked to test!`, "success");
      setAssigningTest(null);
    } catch (err: any) {
      showToast(err?.message || "Failed to save patient details.", "error");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div style={{ minHeight:"100vh", background:"#0f172a", color:"#f1f5f9", fontFamily:"'Inter',sans-serif" }}>
      <Header />

      <main style={{ maxWidth:1100, margin:"0 auto", padding:"32px 24px" }}>
        {/* Header Title */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"16px", marginBottom:"24px" }}>
          <div>
            <h1 style={{ fontSize:"1.6rem", fontWeight:800, margin:0 }}>Test History</h1>
            <p style={{ margin:"4px 0 0", fontSize:"0.82rem", color:"#94a3b8" }}>
              Update patient demographics (Name, Age, Gender, Height) and attach tests recorded from hardware.
            </p>
          </div>
          <button
            id="export-csv-btn"
            onClick={() => {
              try {
                exportCsv(filtered);
                showToast(`Exported ${filtered.length} records with demographics.`, "success");
              } catch {
                showToast("CSV export failed.", "error");
              }
            }}
            style={{ background:"rgba(99,102,241,0.15)", border:"1px solid rgba(99,102,241,0.3)", color:"#818cf8", borderRadius:"10px", padding:"8px 18px", fontWeight:700, cursor:"pointer", fontSize:"0.85rem" }}
          >
            ⬇ Export CSV (with Demographics)
          </button>
        </div>

        {/* Quick Filter Buttons */}
        <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", marginBottom:"16px" }}>
          <button
            onClick={() => { setPatientSearch(""); setPage(0); }}
            style={{
              ...filterChip,
              background: !patientSearch ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.04)",
              color: !patientSearch ? "#c7d2fe" : "#94a3b8",
              borderColor: !patientSearch ? "#6366f1" : "rgba(255,255,255,0.08)",
            }}
          >
            All Tests ({tests.length})
          </button>

          <button
            onClick={() => { setPatientSearch("unassigned"); setPage(0); }}
            style={{
              ...filterChip,
              background: patientSearch.toLowerCase() === "unassigned" ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.04)",
              color: patientSearch.toLowerCase() === "unassigned" ? "#fca5a5" : "#94a3b8",
              borderColor: patientSearch.toLowerCase() === "unassigned" ? "#ef4444" : "rgba(255,255,255,0.08)",
            }}
          >
            ⚠️ Unassigned Hardware Tests
          </button>
        </div>

        {/* Filters Bar */}
        <div style={{ display:"flex", gap:"12px", flexWrap:"wrap", alignItems:"flex-end", marginBottom:"20px", background:"rgba(255,255,255,0.02)", padding:"16px", borderRadius:"12px", border:"1px solid rgba(255,255,255,0.05)" }}>
          {/* Patient ID Search */}
          <div style={{ flex: "1 1 200px" }}>
            <label style={labelStyle}>SEARCH PATIENT ID / NAME</label>
            <input
              id="filter-patient"
              type="text"
              value={patientSearch}
              onChange={(e) => { setPatientSearch(e.target.value); setPage(0); }}
              placeholder="e.g. PAT-3046 or Akinpelu..."
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>FROM</label>
            <input id="filter-from" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>TO</label>
            <input id="filter-to" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>STATUS</label>
            <select
              id="filter-status"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as any); setPage(0); }}
              style={{ ...inputStyle, cursor:"pointer" }}
            >
              <option value="ALL">All</option>
              <option value="Normal">Normal</option>
              <option value="Restrictive">Restrictive</option>
              <option value="Obstructive">Obstructive</option>
            </select>
          </div>

          <div style={{ fontSize:"0.8rem", color:"#64748b", paddingBottom:"8px" }}>
            {filtered.length} record{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign:"center", color:"#64748b", padding:"60px" }}>Loading tests…</div>
        ) : (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.85rem" }}>
              <thead>
                <tr style={{ borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
                  {["Patient ID","Patient Name & Info","Date & Time","FVC (L)","FEV1 (L)","FEV1/FVC (%)","Score","Status","Actions"].map((h) => (
                    <th key={h} style={{ padding:"10px 14px", textAlign:"left", color:"#64748b", fontWeight:600, fontSize:"0.72rem", letterSpacing:"0.06em", textTransform:"uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageData.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign:"center", padding:"40px", color:"#64748b" }}>
                      No tests found matching the selected filters.
                    </td>
                  </tr>
                ) : (
                  pageData.map((t) => (
                    <tr
                      key={t.id}
                      style={{ borderBottom:"1px solid rgba(255,255,255,0.04)", transition:"background 0.15s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Patient ID */}
                      <td style={td}>
                        {t.patientId ? (
                          <button
                            onClick={() => { setPatientSearch(t.patientId!); setPage(0); }}
                            style={tableIdBadge}
                            title="Filter all tests by this Patient ID"
                          >
                            {t.patientId}
                          </button>
                        ) : (
                          <span style={{ color:"#eab308", fontSize:"0.75rem", fontWeight:600, display:"inline-flex", alignItems:"center", gap:"4px" }}>
                            ⚠️ Unassigned
                          </span>
                        )}
                      </td>

                      {/* Patient Name & Demographics */}
                      <td style={td}>
                        <div style={{ fontWeight: 600, color: t.patientName ? "#f1f5f9" : "#64748b" }}>
                          {t.patientName || "—"}
                        </div>
                        {((t.patientAge && t.patientAge > 0) || (t.patientHeightCm && t.patientHeightCm > 0)) && (
                          <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "2px" }}>
                            {t.patientGender ? t.patientGender.charAt(0).toUpperCase() + t.patientGender.slice(1) : ""}
                            {t.patientAge && ` · ${t.patientAge}y`}
                            {t.patientHeightCm && ` · ${t.patientHeightCm}cm`}
                          </div>
                        )}
                      </td>

                      {/* Date & Time */}
                      <td style={td}>{format(t.recordedAt, "d MMM yyyy, HH:mm")}</td>

                      {/* FVC */}
                      <td style={td}>{t.fvc.toFixed(3)}</td>

                      {/* FEV1 */}
                      <td style={td}>{t.fev1.toFixed(3)}</td>

                      {/* Ratio */}
                      <td style={td}>{t.ratio.toFixed(2)}</td>

                      {/* Score */}
                      <td style={{ ...td, fontWeight:700 }}>{t.score}</td>

                      {/* Status */}
                      <td style={td}><StatusBadge status={t.status} size="sm" /></td>

                      {/* Action: Update Patient Details */}
                      <td style={td}>
                        <button
                          onClick={() => openAssignModal(t)}
                          style={{
                            background: t.patientId ? "rgba(99,102,241,0.12)" : "rgba(34,197,94,0.15)",
                            border: t.patientId ? "1px solid rgba(99,102,241,0.3)" : "1px solid rgba(34,197,94,0.35)",
                            color: t.patientId ? "#818cf8" : "#4ade80",
                            borderRadius: "8px",
                            padding: "5px 12px",
                            fontSize: "0.75rem",
                            cursor: "pointer",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                          title="Update patient details (Name, Age, Gender, Height) for this test"
                        >
                          {t.patientId ? "✏️ Edit Patient Details" : "+ Assign Details"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
            </tbody>
          </table>

          {/* Pagination */}
          {pageCount > 1 && (
            <div style={{ display:"flex", justifyContent:"center", gap:"8px", marginTop:"20px" }}>
              <button id="prev-page" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} style={pageBtn}>‹ Prev</button>
              <span style={{ color:"#64748b", fontSize:"0.82rem", alignSelf:"center" }}>Page {page + 1} of {pageCount}</span>
              <button id="next-page" onClick={() => setPage(Math.min(pageCount - 1, page + 1))} disabled={page === pageCount - 1} style={pageBtn}>Next ›</button>
            </div>
          )}
        </div>
      )}

      {/* Modal: Full Patient Details & Assignment */}
      {assigningTest && (
        <div
          style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <form
            onSubmit={handleConfirmSavePatient}
            style={{
              background: "#1e293b",
              border: "1px solid rgba(99,102,241,0.4)",
              borderRadius: "18px",
              padding: "28px",
              maxWidth: "520px",
              width: "100%",
              boxShadow: "0 25px 50px rgba(0,0,0,0.6)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            {/* Modal Header */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"16px" }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: "1.2rem", fontWeight: 800 }}>
                  👤 Update Patient Details
                </h3>
                <p style={{ color: "#94a3b8", fontSize: "0.82rem", margin: 0 }}>
                  Attach demographics to test from {format(assigningTest.recordedAt, "d MMM yyyy, HH:mm")} (FVC: {assigningTest.fvc.toFixed(2)} L, FEV1: {assigningTest.fev1.toFixed(2)} L)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssigningTest(null)}
                style={{ background:"transparent", border:"none", color:"#94a3b8", cursor:"pointer", fontSize:"1.2rem" }}
              >
                ✕
              </button>
            </div>

            {/* Quick Select from Previously Entered Patients */}
            {knownPatients.length > 0 && (
              <div style={{ marginBottom: "18px", background:"rgba(255,255,255,0.03)", padding:"10px 14px", borderRadius:"10px", border:"1px solid rgba(255,255,255,0.06)" }}>
                <label style={labelStyle}>USE PREVIOUSLY ENTERED PATIENT</label>
                <select
                  onChange={(e) => handleSelectExistingPatient(e.target.value)}
                  value={knownPatients.some(p => p.id === assignTargetId) ? assignTargetId : ""}
                  style={{ ...inputStyle, width: "100%", cursor: "pointer" }}
                >
                  <option value="">-- Choose previously entered patient --</option>
                  {knownPatients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id} - {p.name} {p.age ? `(${p.gender}, ${p.age}y, ${p.heightCm}cm)` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Patient ID with Auto-Generate Button */}
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>PATIENT ID *</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  value={assignTargetId}
                  onChange={(e) => setAssignTargetId(e.target.value.toUpperCase())}
                  placeholder="e.g. PAT-3046"
                  style={{ ...inputStyle, flex: 1, fontFamily: "monospace", fontWeight: 800, fontSize: "1rem", color: "#a5b4fc" }}
                  required
                />
                <button
                  type="button"
                  onClick={() => {
                    const newId = generatePatientId();
                    setAssignTargetId(newId);
                    showToast(`Generated: ${newId}`, "info");
                  }}
                  style={secondaryBtn}
                  title="Generate a new Patient ID code"
                >
                  ⚡ Auto ID
                </button>
              </div>
              <span style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "4px", display: "block" }}>
                Write this ID down on the patient's paper chart to reference later.
              </span>
            </div>

            {/* Full Name */}
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>PATIENT FULL NAME *</label>
              <input
                type="text"
                value={assignTargetName}
                onChange={(e) => setAssignTargetName(e.target.value)}
                placeholder="e.g. Akinpelu Abiodun Moses"
                style={{ ...inputStyle, width: "100%" }}
                required
              />
            </div>

            {/* Demographics Row: Gender, Age, Height */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "16px" }}>
              <div>
                <label style={labelStyle}>GENDER *</label>
                <select
                  value={assignTargetGender}
                  onChange={(e) => setAssignTargetGender(e.target.value as "male" | "female" | "other")}
                  style={{ ...inputStyle, width: "100%", cursor: "pointer" }}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>AGE (YEARS) *</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={assignTargetAge}
                  onChange={(e) => setAssignTargetAge(e.target.value)}
                  placeholder="e.g. 28"
                  style={{ ...inputStyle, width: "100%" }}
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>HEIGHT (CM) *</label>
                <input
                  type="number"
                  min={50}
                  max={250}
                  value={assignTargetHeight}
                  onChange={(e) => setAssignTargetHeight(e.target.value)}
                  placeholder="e.g. 175"
                  style={{ ...inputStyle, width: "100%" }}
                  required
                />
              </div>
            </div>

            {/* Clinical Notes */}
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>CLINICAL NOTES (OPTIONAL)</label>
              <input
                type="text"
                value={assignTargetNotes}
                onChange={(e) => setAssignTargetNotes(e.target.value)}
                placeholder="e.g. Post-bronchodilator, non-smoker"
                style={{ ...inputStyle, width: "100%" }}
              />
            </div>

            {/* Live ATS/ERS Reference Norms Preview */}
            {modalPred.predFvc && (
              <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: "10px", padding: "10px 14px", marginBottom: "18px", fontSize: "0.78rem" }}>
                <div style={{ color: "#38bdf8", fontWeight: 700, marginBottom: "4px" }}>
                  ATS/ERS Target Norms for this Patient:
                </div>
                <div style={{ display: "flex", gap: "14px", color: "#cbd5e1" }}>
                  <span>Pred FVC: <strong style={{ color: "#f1f5f9" }}>{modalPred.predFvc} L</strong></span>
                  <span>Pred FEV1: <strong style={{ color: "#f1f5f9" }}>{modalPred.predFev1} L</strong></span>
                  <span>Pred Ratio: <strong style={{ color: "#f1f5f9" }}>{modalPred.predRatio}%</strong></span>
                </div>
              </div>
            )}

            {/* Batch option: apply to all other unassigned tests from today */}
            <div style={{ marginBottom: "22px", background: "rgba(255,255,255,0.02)", padding: "10px 14px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "0.82rem", color: "#cbd5e1" }}>
                <input
                  type="checkbox"
                  checked={applyToSameDay}
                  onChange={(e) => setApplyToSameDay(e.target.checked)}
                  style={{ accentColor: "#6366f1", width: "16px", height: "16px", cursor: "pointer" }}
                />
                <span>Also assign other unassigned tests from this same date ({assigningTest.dayKey})</span>
              </label>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setAssigningTest(null)}
                style={secondaryBtn}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={assigning}
                style={primaryBtn}
              >
                {assigning ? "Saving…" : "💾 Save Patient Details"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  </div>
);
}

const labelStyle: React.CSSProperties = {
  fontSize:"0.7rem", color:"#94a3b8", fontWeight:600, letterSpacing:"0.07em",
  display:"block", marginBottom:"5px",
};
const inputStyle: React.CSSProperties = {
  background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
  borderRadius:"8px", padding:"8px 12px", color:"#f1f5f9", fontSize:"0.85rem", outline:"none",
};
const td: React.CSSProperties = { padding:"12px 14px", color:"#cbd5e1" };
const pageBtn: React.CSSProperties = {
  background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
  borderRadius:"8px", padding:"6px 14px", color:"#94a3b8", cursor:"pointer", fontSize:"0.82rem",
};
const filterChip: React.CSSProperties = {
  border: "1px solid", borderRadius: "20px", padding: "5px 12px",
  fontSize: "0.78rem", cursor: "pointer", fontWeight: 600, transition: "all 0.2s",
};
const tableIdBadge: React.CSSProperties = {
  background: "rgba(99,102,241,0.18)", border: "1px solid rgba(99,102,241,0.35)",
  color: "#c7d2fe", borderRadius: "6px", padding: "2px 8px",
  fontFamily: "monospace", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
};
const primaryBtn: React.CSSProperties = {
  background: "rgba(99,102,241,0.35)", border: "1px solid rgba(99,102,241,0.5)",
  color: "#c7d2fe", borderRadius: "10px", padding: "10px 20px",
  fontSize: "0.85rem", fontWeight: 700, cursor: "pointer",
};
const secondaryBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
  color: "#94a3b8", borderRadius: "10px", padding: "10px 16px",
  fontSize: "0.85rem", fontWeight: 600, cursor: "pointer",
};
