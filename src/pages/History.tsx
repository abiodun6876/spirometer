import { useState, useMemo } from "react";
import { format } from "date-fns";
import { useTests } from "../hooks/useTests";
import { StatusBadge } from "../components/StatusBadge";
import type { TestStatus } from "../lib/scoring";
import { useDeviceId } from "../context/DeviceContext";
import { useToast } from "../components/Toast";


function exportCsv(data: ReturnType<typeof useTests>["tests"]) {
  const header = "Date,Time,FVC (L),FEV1 (L),FEV1/FVC (%),Score,Status";
  const rows = data.map((t) =>
    [
      format(t.recordedAt, "yyyy-MM-dd"),
      format(t.recordedAt, "HH:mm:ss"),
      t.fvc.toFixed(3),
      t.fev1.toFixed(3),
      t.ratio.toFixed(2),
      t.score,
      t.status,
    ].join(",")
  );
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "spirosense_history.csv"; a.click();
  URL.revokeObjectURL(url);
}

export function History() {
  const { deviceId } = useDeviceId();
  const { showToast } = useToast();
  const { tests, loading } = useTests(deviceId, 500);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | TestStatus>("ALL");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const filtered = useMemo(() => {
    return tests.filter((t) => {
      const dk = t.dayKey;
      if (dateFrom && dk < dateFrom) return false;
      if (dateTo   && dk > dateTo)   return false;
      if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
      return true;
    });
  }, [tests, dateFrom, dateTo, statusFilter]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div style={{ minHeight:"100vh", background:"#0f172a", color:"#f1f5f9", fontFamily:"'Inter',sans-serif" }}>
      {/* Header */}
      <header style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"16px 32px", borderBottom:"1px solid rgba(255,255,255,0.07)",
        background:"rgba(15,23,42,0.95)", backdropFilter:"blur(12px)",
        position:"sticky", top:0, zIndex:100,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
          <span style={{ fontSize:"1.5rem" }}>🫁</span>
          <span style={{ fontWeight:800, fontSize:"1.1rem", color:"#818cf8" }}>SpiroSense AI</span>
        </div>
        <nav style={{ display:"flex", gap:"8px" }}>
          {[{ to:"/", label:"Dashboard" }, { to:"/history", label:"History" }, { to:"/device", label:"Device" }].map(({ to, label }) => (
            <a key={to} href={to} style={{ color:"#94a3b8", textDecoration:"none", fontWeight:600, fontSize:"0.85rem", padding:"6px 12px", borderRadius:"8px" }}>{label}</a>
          ))}
        </nav>
      </header>

      <main style={{ maxWidth:1100, margin:"0 auto", padding:"32px 24px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"16px", marginBottom:"24px" }}>
          <h1 style={{ fontSize:"1.6rem", fontWeight:800, margin:0 }}>Test History</h1>
          <button
            id="export-csv-btn"
            onClick={() => {
              try { exportCsv(filtered); showToast(`Exported ${filtered.length} records.`, "success"); }
              catch { showToast("CSV export failed.", "error"); }
            }}
            style={{ background:"rgba(99,102,241,0.15)", border:"1px solid rgba(99,102,241,0.3)", color:"#818cf8", borderRadius:"10px", padding:"8px 18px", fontWeight:700, cursor:"pointer", fontSize:"0.85rem" }}
          >
            ⬇ Export CSV
          </button>
        </div>

        {/* Filters */}
        <div style={{ display:"flex", gap:"12px", flexWrap:"wrap", marginBottom:"20px" }}>
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
              <option value="GOOD">GOOD</option>
              <option value="OK">OK</option>
              <option value="POOR">POOR</option>
            </select>
          </div>
          <div style={{ alignSelf:"flex-end", fontSize:"0.8rem", color:"#64748b", paddingBottom:"2px" }}>
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign:"center", color:"#64748b", padding:"60px" }}>Loading…</div>
        ) : (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.85rem" }}>
              <thead>
                <tr style={{ borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
                  {["Date & Time","FVC (L)","FEV1 (L)","FEV1/FVC (%)","Score","Status"].map((h) => (
                    <th key={h} style={{ padding:"10px 14px", textAlign:"left", color:"#64748b", fontWeight:600, fontSize:"0.72rem", letterSpacing:"0.06em", textTransform:"uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageData.map((t) => (
                  <tr key={t.id} style={{ borderBottom:"1px solid rgba(255,255,255,0.04)", transition:"background 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={td}>{format(t.recordedAt, "d MMM yyyy, HH:mm")}</td>
                    <td style={td}>{t.fvc.toFixed(3)}</td>
                    <td style={td}>{t.fev1.toFixed(3)}</td>
                    <td style={td}>{t.ratio.toFixed(2)}</td>
                    <td style={{ ...td, fontWeight:700 }}>{t.score}</td>
                    <td style={td}><StatusBadge status={t.status} size="sm" /></td>
                  </tr>
                ))}
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
