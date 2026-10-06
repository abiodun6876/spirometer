import { useState, useEffect } from "react";
import { format } from "date-fns";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useTests } from "../hooks/useTests";
import { useDaily } from "../hooks/useDaily";
import { StatCard } from "../components/StatCard";
import { StatusBadge } from "../components/StatusBadge";
import { TrendChart } from "../components/TrendChart";
import { InsightList } from "../components/InsightList";
import { computeStreak, isObstructivePattern, linearRegression, trendDir } from "../lib/analytics";

const DEVICE_ID = "ESP32-SPIRO-01"; // TODO: pull from user profile / Firestore

type Metric = "avgFvc" | "avgFev1" | "avgRatio" | "avgScore";

export function Dashboard() {
  const { tests, loading: testsLoading }  = useTests(DEVICE_ID);
  const { daily, loading: dailyLoading }  = useDaily(DEVICE_ID, 30);
  const [insights, setInsights]           = useState<string[]>([]);
  const [disclaimer, setDisclaimer]       = useState<string>("");
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [metric, setMetric]               = useState<Metric>("avgFvc");

  const latest = tests[0] ?? null;
  const today  = format(new Date(), "yyyy-MM-dd");
  const todayData = daily.find((d) => d.dayKey === today);

  // Streak
  const streak = computeStreak(tests.map((t) => t.dayKey));

  // Trend tag
  const fvcValues  = daily.map((d) => d.avgFvc);
  const { slope }  = linearRegression(fvcValues);
  const trend      = trendDir(slope);

  // Obstructive flag
  const ratios   = tests.map((t) => t.ratio);
  const obstFlag = isObstructivePattern(ratios);

  // Fetch server insights on mount
  useEffect(() => {
    setInsightsLoading(true);
    fetch("/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: DEVICE_ID }),
    })
      .then((r) => r.json())
      .then((d) => {
        setInsights(d.insights ?? []);
        setDisclaimer(d.disclaimer ?? "");
      })
      .catch(() => {
        // Fallback to client-side insights
        const fb: string[] = [];
        if (trend === "up")   fb.push("📈 Your FVC is trending upward over recent days.");
        if (trend === "down") fb.push("📉 Your FVC is trending down — consider checking in with your clinician.");
        if (obstFlag) fb.push("🔴 Mean FEV1/FVC across last 5 tests is below 70%. Please consult your healthcare provider.");
        if (!fb.length) fb.push("✅ Everything looks consistent. Keep up the regular testing!");
        setInsights(fb);
        setDisclaimer("These insights are generated locally and are not a medical diagnosis.");
      })
      .finally(() => setInsightsLoading(false));
  }, [tests.length]);

  const trendEmoji = { up: "📈", down: "📉", stable: "➡️" }[trend];
  const metricTabs: Metric[] = ["avgFvc", "avgFev1", "avgRatio", "avgScore"];
  const metricLabels: Record<Metric, string> = {
    avgFvc:"FVC", avgFev1:"FEV1", avgRatio:"FEV1/FVC", avgScore:"Score"
  };

  return (
    <div style={{ minHeight:"100vh", background:"#0f172a", color:"#f1f5f9", fontFamily:"'Inter',sans-serif" }}>
      {/* Header */}
      <header style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"16px 32px",
        borderBottom:"1px solid rgba(255,255,255,0.07)",
        background:"rgba(15,23,42,0.95)",
        backdropFilter:"blur(12px)",
        position:"sticky", top:0, zIndex:100,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
          <span style={{ fontSize:"1.5rem" }}>🫁</span>
          <span style={{ fontWeight:800, fontSize:"1.1rem", color:"#818cf8" }}>SpiroSense AI</span>
        </div>
        <nav style={{ display:"flex", gap:"8px" }}>
          {[
            { to:"/",        label:"Dashboard" },
            { to:"/history", label:"History"   },
            { to:"/device",  label:"Device"    },
          ].map(({ to, label }) => (
            <a key={to} href={to} style={navLink}>{label}</a>
          ))}
        </nav>
        <button
          id="logout-btn"
          onClick={() => signOut(auth)}
          style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.2)", color:"#fca5a5", borderRadius:"8px", padding:"6px 14px", cursor:"pointer", fontSize:"0.8rem", fontWeight:600 }}
        >
          Sign out
        </button>
      </header>

      <main style={{ maxWidth:1100, margin:"0 auto", padding:"32px 24px" }}>
        {/* Page title */}
        <div style={{ marginBottom:"28px" }}>
          <h1 style={{ fontSize:"1.6rem", fontWeight:800, margin:0 }}>Dashboard</h1>
          <p style={{ color:"#64748b", fontSize:"0.82rem", margin:"4px 0 0" }}>
            {format(new Date(), "EEEE, d MMMM yyyy")}
          </p>
        </div>

        {testsLoading ? (
          <div style={{ color:"#64748b", padding:"40px", textAlign:"center" }}>Loading data…</div>
        ) : (
          <>
            {/* Obstructive alert */}
            {obstFlag && (
              <div style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.25)", borderRadius:"14px", padding:"14px 20px", marginBottom:"24px", fontSize:"0.85rem", color:"#fca5a5" }}>
                🔴 <strong>Pattern alert:</strong> Your mean FEV1/FVC over the last 5 tests is below 70%, which may suggest an obstructive pattern. Please consult your healthcare provider.
              </div>
            )}

            {/* Stat cards */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:"16px", marginBottom:"28px" }}>
              <StatCard label="Today's Score" value={todayData?.avgScore ?? (latest?.score ?? "—")} icon="🎯" accent="#6366f1" sub="Daily average" />
              <StatCard label="Latest FVC" value={latest ? `${latest.fvc.toFixed(2)} L` : "—"} icon="💨" accent="#22d3ee" sub="Forced vital capacity" />
              <StatCard label="Latest FEV1" value={latest ? `${latest.fev1.toFixed(2)} L` : "—"} icon="⏱" accent="#f59e0b" sub="First-second volume" />
              <StatCard label="FEV1/FVC" value={latest ? `${latest.ratio.toFixed(1)}%` : "—"} icon="📊" accent="#22c55e" sub={latest ? undefined : undefined} />
              <StatCard label="Streak" value={`${streak} 🔥`} icon="📅" accent="#f97316" sub={streak === 1 ? "day" : "days"} />
              <StatCard label="FVC Trend" value={trendEmoji} icon="📈" accent="#818cf8" sub={{ up:"Improving", down:"Declining", stable:"Stable" }[trend]} />
            </div>

            {/* Latest result */}
            {latest && (
              <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:"16px", padding:"20px 24px", marginBottom:"28px" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"12px" }}>
                  <div>
                    <div style={{ fontSize:"0.72rem", color:"#64748b", fontWeight:600, letterSpacing:"0.08em", marginBottom:"6px" }}>LATEST TEST</div>
                    <div style={{ fontSize:"0.85rem", color:"#94a3b8" }}>
                      {format(latest.recordedAt, "d MMM yyyy, HH:mm")}
                    </div>
                  </div>
                  <StatusBadge status={latest.status} size="lg" />
                </div>
              </div>
            )}

            {/* Trend chart */}
            <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:"16px", padding:"24px", marginBottom:"28px" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"16px", flexWrap:"wrap", gap:"10px" }}>
                <h2 style={{ fontSize:"1rem", fontWeight:700, margin:0 }}>14-Day Trend</h2>
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
              {dailyLoading ? (
                <div style={{ color:"#64748b", textAlign:"center", padding:"40px" }}>Loading chart…</div>
              ) : daily.length < 2 ? (
                <div style={{ color:"#64748b", textAlign:"center", padding:"40px", fontSize:"0.85rem" }}>
                  Not enough data yet — complete more tests to see the trend chart.
                </div>
              ) : (
                <TrendChart data={daily.slice(-14)} metric={metric} />
              )}
            </div>

            {/* AI Insights */}
            <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:"16px", padding:"24px" }}>
              <h2 style={{ fontSize:"1rem", fontWeight:700, margin:"0 0 16px" }}>✨ AI Insights</h2>
              <InsightList insights={insights} disclaimer={disclaimer} loading={insightsLoading} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

const navLink: React.CSSProperties = {
  color:"#94a3b8", textDecoration:"none", fontWeight:600, fontSize:"0.85rem",
  padding:"6px 12px", borderRadius:"8px",
};
