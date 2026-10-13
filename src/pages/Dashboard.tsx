import { useState, useMemo } from "react";
import { format } from "date-fns";
import { useTests } from "../hooks/useTests";
import { StatCard } from "../components/StatCard";
import { StatusBadge } from "../components/StatusBadge";
import { TrendChart } from "../components/TrendChart";
import { AirflowSimulation } from "../components/AirflowSimulation";
import { PredictiveInsights } from "../components/PredictiveInsights";
import { Header } from "../components/Header";
import { calculatePredictedValues } from "../hooks/usePatient";
import { computeStreak, isObstructivePattern, linearRegression, trendDir } from "../lib/analytics";
import { useDeviceId } from "../context/DeviceContext";

type Metric = "avgFvc" | "avgFev1" | "avgRatio" | "avgScore";

export function Dashboard() {
  const { deviceId } = useDeviceId();
  const { tests, loading: testsLoading } = useTests(deviceId, 500);

  // Patient selector: "ALL" for Clinic Overview, or a specific patient ID
  const [selectedPatientId, setSelectedPatientId] = useState<string>("ALL");
  const [metric, setMetric]                       = useState<Metric>("avgFvc");

  const today = format(new Date(), "yyyy-MM-dd");

  // Extract unique patient list from tests
  const uniquePatients = useMemo(() => {
    const map = new Map<string, {
      id: string;
      name: string;
      gender?: "male" | "female" | "other";
      age?: number;
      heightCm?: number;
      notes?: string;
      testCount: number;
      lastDate: Date;
    }>();

    for (const t of tests) {
      if (t.patientId) {
        const existing = map.get(t.patientId);
        if (existing) {
          existing.testCount++;
          if (t.recordedAt > existing.lastDate) {
            existing.lastDate = t.recordedAt;
            if (t.patientName) existing.name = t.patientName;
            if (t.patientAge) existing.age = t.patientAge;
            if (t.patientGender) existing.gender = t.patientGender;
            if (t.patientHeightCm) existing.heightCm = t.patientHeightCm;
          }
        } else {
          map.set(t.patientId, {
            id: t.patientId,
            name: t.patientName || "Unnamed Patient",
            gender: t.patientGender || undefined,
            age: t.patientAge || undefined,
            heightCm: t.patientHeightCm || undefined,
            notes: t.patientNotes || undefined,
            testCount: 1,
            lastDate: t.recordedAt,
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.lastDate.getTime() - a.lastDate.getTime());
  }, [tests]);

  // Tests filtered by selected patient (or all if "ALL")
  const activeTests = useMemo(() => {
    if (selectedPatientId === "ALL") return tests;
    return tests.filter((t) => t.patientId === selectedPatientId);
  }, [tests, selectedPatientId]);

  const activePatientInfo = useMemo(() => {
    if (selectedPatientId === "ALL") return null;
    return uniquePatients.find((p) => p.id === selectedPatientId) ?? null;
  }, [uniquePatients, selectedPatientId]);

  const latestTest = activeTests[0] ?? null;

  // Station level statistics (across all tests)
  const stationStats = useMemo(() => {
    const total = tests.length;
    const todayTests = tests.filter((t) => t.dayKey === today).length;
    const unassignedCount = tests.filter((t) => !t.patientId).length;
    const normalCount = tests.filter((t) => t.status === "Normal").length;
    const abnormalCount = tests.filter((t) => t.status === "Restrictive" || t.status === "Obstructive").length;
    const normalPct = total > 0 ? Math.round((normalCount / total) * 100) : 0;

    return {
      total,
      todayTests,
      unassignedCount,
      normalCount,
      abnormalCount,
      normalPct,
      patientCount: uniquePatients.length,
    };
  }, [tests, today, uniquePatients]);

  // Individual patient trend data (chronological)
  const patientTrend = useMemo(() => {
    if (activeTests.length < 2) return { data: [], title: "Patient Trend", sub: "" };
    const chronological = activeTests.slice(0, 20).reverse().map((t) => ({
      dayKey: format(t.recordedAt, "d MMM HH:mm"),
      avgFvc: t.fvc,
      avgFev1: t.fev1,
      avgRatio: t.ratio,
      avgScore: t.score,
      tests: 1,
    }));
    return { data: chronological, title: "Session Trend", sub: `Last ${chronological.length} tests` };
  }, [activeTests]);

  // Streak & Linear Regression for the selected patient
  const patientStreak = computeStreak(activeTests.map((t) => t.dayKey));
  const fvcValues     = patientTrend.data.map((d) => d.avgFvc);
  const { slope }     = linearRegression(fvcValues);
  const trend         = trendDir(slope);
  const trendEmoji    = { up: "📈", down: "📉", stable: "➡️" }[trend];

  // Obstructive pattern flag for selected patient
  const ratios        = activeTests.map((t) => t.ratio);
  const obstFlag      = selectedPatientId !== "ALL" && isObstructivePattern(ratios);

  // ATS/ERS predicted values for selected patient
  const predicted = useMemo(() => {
    if (!activePatientInfo?.gender || !activePatientInfo?.age || !activePatientInfo?.heightCm) {
      return null;
    }
    return calculatePredictedValues(activePatientInfo.gender, activePatientInfo.age, activePatientInfo.heightCm);
  }, [activePatientInfo]);

  const metricTabs: Metric[] = ["avgFvc", "avgFev1", "avgRatio", "avgScore"];
  const metricLabels: Record<Metric, string> = {
    avgFvc: "FVC", avgFev1: "FEV1", avgRatio: "FEV1/FVC", avgScore: "Score"
  };

  return (
    <div style={{ minHeight:"100vh", background:"#0f172a", color:"#f1f5f9", fontFamily:"'Inter',sans-serif" }}>
      <Header />

      <main style={{ maxWidth:1100, margin:"0 auto", padding:"32px 24px" }}>
        {/* Top Control Bar: Station Header & Patient Switcher */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"16px", marginBottom:"28px" }}>
          <div>
            <h1 style={{ fontSize:"1.6rem", fontWeight:800, margin:0, display:"flex", alignItems:"center", gap:"10px" }}>
              <span>🫁 Spirometer Station</span>
              <span style={{ fontSize:"0.72rem", background:"rgba(99,102,241,0.15)", border:"1px solid rgba(99,102,241,0.3)", color:"#c7d2fe", padding:"3px 10px", borderRadius:"8px", fontWeight:700 }}>
                {deviceId}
              </span>
            </h1>
            <p style={{ color:"#64748b", fontSize:"0.82rem", margin:"4px 0 0" }}>
              {format(new Date(), "EEEE, d MMMM yyyy")} · Multi-Patient Clinical Workstation
            </p>
          </div>

          {/* Patient Selector Dropdown */}
          <div style={{ display:"flex", alignItems:"center", gap:"10px", background:"rgba(255,255,255,0.04)", padding:"8px 14px", borderRadius:"12px", border:"1px solid rgba(255,255,255,0.08)" }}>
            <span style={{ fontSize:"0.75rem", color:"#94a3b8", fontWeight:700 }}>VIEW PATIENT:</span>
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              style={{
                background: "#1e293b",
                border: "1px solid rgba(99,102,241,0.4)",
                color: "#f1f5f9",
                borderRadius: "8px",
                padding: "6px 12px",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                outline: "none",
                minWidth: "220px",
              }}
            >
              <option value="ALL">🌐 All Patients (Station Overview)</option>
              {uniquePatients.map((p) => (
                <option key={p.id} value={p.id}>
                  👤 {p.id} — {p.name} ({p.testCount} tests)
                </option>
              ))}
            </select>
          </div>
        </div>

        {testsLoading ? (
          <div style={{ color:"#64748b", padding:"60px", textAlign:"center" }}>Loading station tests…</div>
        ) : selectedPatientId === "ALL" ? (
          /* ══════════════════════════════════════════════════════════════════════════
             VIEW: STATION OVERVIEW (All Patients Combined)
             ══════════════════════════════════════════════════════════════════════════ */
          <>
            {/* Station Stat Cards */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:"16px", marginBottom:"28px" }}>
              <StatCard label="Total Tests" value={stationStats.total} icon="📊" accent="#6366f1" sub="Across all sessions" />
              <StatCard label="Patients Seen" value={stationStats.patientCount} icon="👥" accent="#38bdf8" sub="Unique patient IDs" />
              <StatCard label="Today's Tests" value={stationStats.todayTests} icon="⏱" accent="#22c55e" sub="Recorded today" />
              <StatCard label="Normal Ratio" value={`${stationStats.normalPct}%`} icon="🟢" accent="#10b981" sub={`${stationStats.normalCount} normal results`} />
              <StatCard label="Abnormal Flagged" value={stationStats.abnormalCount} icon="⚠️" accent="#f59e0b" sub="Restrictive / Obstructive" />
              <StatCard label="Unassigned Tests" value={stationStats.unassignedCount} icon="📝" accent="#f97316" sub="Pending patient link" />
            </div>

            {/* Quick Station Alert if unassigned tests exist */}
            {stationStats.unassignedCount > 0 && (
              <div style={{ background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.25)", borderRadius:"14px", padding:"14px 20px", marginBottom:"28px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"12px" }}>
                <div style={{ fontSize:"0.85rem", color:"#fde68a" }}>
                  ⚠️ <strong>{stationStats.unassignedCount} test{stationStats.unassignedCount > 1 ? "s" : ""}</strong> recorded from hardware require patient demographic details.
                </div>
                <a
                  href="/history"
                  style={{ background:"rgba(245,158,11,0.2)", border:"1px solid rgba(245,158,11,0.4)", color:"#fde047", padding:"6px 14px", borderRadius:"8px", fontSize:"0.8rem", fontWeight:700, textDecoration:"none" }}
                >
                  Go to History to Assign →
                </a>
              </div>
            )}

            {/* Latest Reading Card */}
            {latestTest && (
              <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:"16px", padding:"20px 24px", marginBottom:"28px" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"12px", marginBottom:"14px" }}>
                  <div>
                    <div style={{ fontSize:"0.7rem", color:"#64748b", fontWeight:700, letterSpacing:"0.08em" }}>LATEST HARDWARE RECORDING</div>
                    <div style={{ fontSize:"0.95rem", color:"#f1f5f9", fontWeight:600, marginTop:"2px" }}>
                      {latestTest.patientName || "Unassigned Patient"}
                      {latestTest.patientId && <span style={{ color:"#818cf8", fontFamily:"monospace", marginLeft:"8px" }}>({latestTest.patientId})</span>}
                    </div>
                    <div style={{ fontSize:"0.78rem", color:"#94a3b8" }}>{format(latestTest.recordedAt, "d MMM yyyy, HH:mm")}</div>
                  </div>
                  <StatusBadge status={latestTest.status} size="lg" />
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(110px, 1fr))", gap:"12px", background:"rgba(0,0,0,0.2)", padding:"12px 16px", borderRadius:"12px" }}>
                  <div><span style={statMiniLabel}>FVC</span><div style={statMiniVal}>{latestTest.fvc.toFixed(3)} L</div></div>
                  <div><span style={statMiniLabel}>FEV1</span><div style={statMiniVal}>{latestTest.fev1.toFixed(3)} L</div></div>
                  <div><span style={statMiniLabel}>FEV1/FVC</span><div style={statMiniVal}>{latestTest.ratio.toFixed(1)}%</div></div>
                  <div><span style={statMiniLabel}>SCORE</span><div style={{ ...statMiniVal, color:"#a5b4fc" }}>{latestTest.score} / 100</div></div>
                </div>
              </div>
            )}

            {/* Recent Tests Stream across Station */}
            <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:"16px", padding:"24px", marginBottom:"28px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
                <h2 style={{ fontSize:"1rem", fontWeight:700, margin:0 }}>📡 Recent Activity on Hardware</h2>
                <a href="/history" style={{ color:"#818cf8", fontSize:"0.8rem", fontWeight:600, textDecoration:"none" }}>View All in History →</a>
              </div>

              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.82rem" }}>
                  <thead>
                    <tr style={{ borderBottom:"1px solid rgba(255,255,255,0.06)", color:"#64748b", textAlign:"left" }}>
                      <th style={{ padding:"8px 10px" }}>PATIENT</th>
                      <th style={{ padding:"8px 10px" }}>TIME</th>
                      <th style={{ padding:"8px 10px" }}>FVC</th>
                      <th style={{ padding:"8px 10px" }}>FEV1</th>
                      <th style={{ padding:"8px 10px" }}>RATIO</th>
                      <th style={{ padding:"8px 10px" }}>STATUS</th>
                      <th style={{ padding:"8px 10px", textAlign:"right" }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tests.slice(0, 8).map((t) => (
                      <tr key={t.id} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
                        <td style={{ padding:"10px 10px" }}>
                          {t.patientId ? (
                            <div>
                              <strong style={{ color:"#f1f5f9" }}>{t.patientName || t.patientId}</strong>
                              <span style={{ fontSize:"0.72rem", color:"#818cf8", fontFamily:"monospace", marginLeft:"6px" }}>({t.patientId})</span>
                            </div>
                          ) : (
                            <span style={{ color:"#eab308", fontWeight:600 }}>⚠️ Unassigned</span>
                          )}
                        </td>
                        <td style={{ padding:"10px 10px", color:"#94a3b8" }}>{format(t.recordedAt, "d MMM, HH:mm")}</td>
                        <td style={{ padding:"10px 10px", color:"#cbd5e1" }}>{t.fvc.toFixed(2)} L</td>
                        <td style={{ padding:"10px 10px", color:"#cbd5e1" }}>{t.fev1.toFixed(2)} L</td>
                        <td style={{ padding:"10px 10px", color:"#cbd5e1" }}>{t.ratio.toFixed(1)}%</td>
                        <td style={{ padding:"10px 10px" }}><StatusBadge status={t.status} size="sm" /></td>
                        <td style={{ padding:"10px 10px", textAlign:"right" }}>
                          {t.patientId ? (
                            <button
                              onClick={() => setSelectedPatientId(t.patientId!)}
                              style={{ background:"rgba(99,102,241,0.15)", border:"1px solid rgba(99,102,241,0.3)", color:"#818cf8", borderRadius:"6px", padding:"3px 8px", fontSize:"0.72rem", cursor:"pointer", fontWeight:600 }}
                            >
                              View Trend
                            </button>
                          ) : (
                            <a
                              href="/history"
                              style={{ background:"rgba(234,179,8,0.15)", border:"1px solid rgba(234,179,8,0.3)", color:"#facc15", borderRadius:"6px", padding:"3px 8px", fontSize:"0.72rem", textDecoration:"none", fontWeight:600 }}
                            >
                              + Assign
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Virtual Airflow Simulation of latest hardware test */}
            <AirflowSimulation fvc={latestTest?.fvc} fev1={latestTest?.fev1} />

            {/* AI Predictive Model */}
            <PredictiveInsights />
          </>
        ) : (
          /* ══════════════════════════════════════════════════════════════════════════
             VIEW: INDIVIDUAL PATIENT (Drill-Down Mode)
             ══════════════════════════════════════════════════════════════════════════ */
          <>
            {/* Patient Header Banner */}
            <div style={{ background:"rgba(99,102,241,0.08)", border:"1px solid rgba(99,102,241,0.25)", borderRadius:"16px", padding:"20px 24px", marginBottom:"28px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"14px" }}>
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"4px" }}>
                  <span style={{ background:"rgba(99,102,241,0.3)", color:"#c7d2fe", borderRadius:"6px", padding:"3px 10px", fontFamily:"monospace", fontWeight:800, fontSize:"0.95rem" }}>
                    {activePatientInfo?.id}
                  </span>
                  <h2 style={{ margin:0, fontSize:"1.25rem", fontWeight:800 }}>{activePatientInfo?.name}</h2>
                </div>
                <div style={{ fontSize:"0.82rem", color:"#94a3b8" }}>
                  {activePatientInfo?.gender ? activePatientInfo.gender.toUpperCase() : "—"}
                  {activePatientInfo?.age ? ` · ${activePatientInfo.age} yrs` : ""}
                  {activePatientInfo?.heightCm ? ` · ${activePatientInfo.heightCm} cm` : ""}
                  {` · ${activeTests.length} tests recorded`}
                </div>
              </div>

              <div style={{ display:"flex", gap:"10px" }}>
                <button
                  onClick={() => setSelectedPatientId("ALL")}
                  style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", color:"#cbd5e1", borderRadius:"8px", padding:"6px 14px", fontSize:"0.8rem", fontWeight:600, cursor:"pointer" }}
                >
                  ← Back to Station Overview
                </button>
                <a
                  href="/history"
                  style={{ background:"rgba(99,102,241,0.25)", border:"1px solid rgba(99,102,241,0.4)", color:"#c7d2fe", borderRadius:"8px", padding:"6px 14px", fontSize:"0.8rem", fontWeight:700, textDecoration:"none" }}
                >
                  Edit in History
                </a>
              </div>
            </div>

            {/* Pattern Alert if Obstructive */}
            {obstFlag && (
              <div style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.25)", borderRadius:"14px", padding:"14px 20px", marginBottom:"24px", fontSize:"0.85rem", color:"#fca5a5" }}>
                🔴 <strong>Pattern alert for {activePatientInfo?.name}:</strong> Mean FEV1/FVC over recent tests is below 70%, suggesting an obstructive pattern.
              </div>
            )}

            {/* Individual Patient Stat Cards */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:"16px", marginBottom:"28px" }}>
              <StatCard label="Latest FVC" value={latestTest ? `${latestTest.fvc.toFixed(2)} L` : "—"} icon="💨" accent="#22d3ee" sub="Forced vital capacity" />
              <StatCard label="Latest FEV1" value={latestTest ? `${latestTest.fev1.toFixed(2)} L` : "—"} icon="⏱" accent="#f59e0b" sub="First-second volume" />
              <StatCard label="FEV1/FVC" value={latestTest ? `${latestTest.ratio.toFixed(1)}%` : "—"} icon="📊" accent="#22c55e" sub={latestTest?.status} />
              <StatCard label="Total Tests" value={activeTests.length} icon="📋" accent="#6366f1" sub="For this patient" />
              <StatCard label="Streak" value={`${patientStreak} 🔥`} icon="📅" accent="#f97316" sub={patientStreak === 1 ? "day" : "days"} />
              <StatCard label="FVC Trend" value={trendEmoji} icon="📈" accent="#818cf8" sub={{ up:"Improving", down:"Declining", stable:"Stable" }[trend]} />
            </div>

            {/* ATS/ERS Target Baseline for this Patient */}
            {predicted && predicted.predFvc && (
              <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:"14px", padding:"16px 20px", marginBottom:"28px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"16px" }}>
                <div>
                  <div style={{ fontSize:"0.72rem", color:"#38bdf8", fontWeight:700, letterSpacing:"0.06em" }}>ATS/ERS TARGET PREDICTIONS</div>
                  <div style={{ fontSize:"0.85rem", color:"#94a3b8" }}>Standard medical reference baselines based on age, gender & height:</div>
                </div>
                <div style={{ display:"flex", gap:"20px", flexWrap:"wrap" }}>
                  <div><span style={statMiniLabel}>PRED FVC</span><div style={statMiniVal}>{predicted.predFvc} L</div></div>
                  <div><span style={statMiniLabel}>PRED FEV1</span><div style={statMiniVal}>{predicted.predFev1} L</div></div>
                  <div><span style={statMiniLabel}>PRED RATIO</span><div style={statMiniVal}>{predicted.predRatio}%</div></div>
                </div>
              </div>
            )}

            {/* Trend Chart for this Patient Only */}
            <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:"16px", padding:"24px", marginBottom:"28px" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"16px", flexWrap:"wrap", gap:"10px" }}>
                <div>
                  <h2 style={{ fontSize:"1rem", fontWeight:700, margin:0 }}>{patientTrend.title} — {activePatientInfo?.name}</h2>
                  {patientTrend.sub && <span style={{ fontSize:"0.72rem", color:"#64748b", fontWeight:500 }}>{patientTrend.sub}</span>}
                </div>
                <div style={{ display:"flex", gap:"6px" }}>
                  {metricTabs.map((m) => (
                    <button
                      key={m}
                      onClick={() => setMetric(m)}
                      style={{
                        background: metric === m ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.05)",
                        border:     metric === m ? "1px solid #6366f1" : "1px solid rgba(255,255,255,0.08)",
                        borderRadius:"8px", padding:"4px 12px", color: metric===m ? "#818cf8" : "#64748b",
                        fontSize:"0.75rem", fontWeight:600, cursor:"pointer",
                      }}
                    >{metricLabels[m]}</button>
                  ))}
                </div>
              </div>
              {patientTrend.data.length < 2 ? (
                <div style={{ color:"#64748b", textAlign:"center", padding:"40px", fontSize:"0.85rem" }}>
                  Need at least 2 tests for {activePatientInfo?.name} to visualize trend curve.
                </div>
              ) : (
                <TrendChart data={patientTrend.data} metric={metric} />
              )}
            </div>

            {/* Airflow Simulation for this patient's latest blow */}
            <AirflowSimulation fvc={latestTest?.fvc} fev1={latestTest?.fev1} />
          </>
        )}
      </main>
    </div>
  );
}

const statMiniLabel: React.CSSProperties = {
  fontSize:"0.65rem", color:"#64748b", fontWeight:700, letterSpacing:"0.06em", display:"block", marginBottom:"2px",
};
const statMiniVal: React.CSSProperties = {
  fontSize:"0.95rem", color:"#f1f5f9", fontWeight:700,
};
