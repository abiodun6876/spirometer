import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { useDevice } from "../hooks/useDevice";

const DEVICE_ID = "ESP32-SPIRO-01";

export function Device() {
  const { device, loading } = useDevice(DEVICE_ID);
  const [copied, setCopied] = useState(false);

  function copyId() {
    navigator.clipboard.writeText(DEVICE_ID);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

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

      <main style={{ maxWidth:800, margin:"0 auto", padding:"32px 24px" }}>
        <h1 style={{ fontSize:"1.6rem", fontWeight:800, margin:"0 0 28px" }}>Device</h1>

        {loading ? (
          <div style={{ color:"#64748b", textAlign:"center", padding:"60px" }}>Loading…</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:"20px" }}>
            {/* Device info card */}
            <section style={card}>
              <h2 style={cardTitle}>📡 Device Info</h2>
              <div style={{ display:"grid", gap:"14px" }}>
                <Row label="Device ID">
                  <code style={{ background:"rgba(255,255,255,0.05)", padding:"3px 8px", borderRadius:"6px", fontSize:"0.85rem" }}>
                    {DEVICE_ID}
                  </code>
                  <button id="copy-device-id" onClick={copyId} style={smallBtn}>
                    {copied ? "✓ Copied" : "Copy"}
                  </button>
                </Row>
                <Row label="Name">{device?.name ?? "—"}</Row>
                <Row label="Last seen">
                  {device?.lastSeenAt
                    ? `${formatDistanceToNow(device.lastSeenAt, { addSuffix:true })} (${format(device.lastSeenAt, "d MMM yyyy, HH:mm")})`
                    : "Never"}
                </Row>
                <Row label="Status">
                  <span style={{
                    background: device?.lastSeenAt && Date.now() - device.lastSeenAt.getTime() < 3_600_000
                      ? "rgba(34,197,94,0.15)" : "rgba(100,116,139,0.15)",
                    color: device?.lastSeenAt && Date.now() - device.lastSeenAt.getTime() < 3_600_000
                      ? "#4ade80" : "#94a3b8",
                    border: device?.lastSeenAt && Date.now() - device.lastSeenAt.getTime() < 3_600_000
                      ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(100,116,139,0.3)",
                    borderRadius:"999px", padding:"2px 10px", fontSize:"0.75rem", fontWeight:700,
                  }}>
                    {device?.lastSeenAt && Date.now() - device.lastSeenAt.getTime() < 3_600_000 ? "● Online" : "○ Offline"}
                  </span>
                </Row>
              </div>
            </section>

            {/* Setup instructions */}
            <section style={card}>
              <h2 style={cardTitle}>⚙️ Setup Instructions</h2>
              <ol style={{ margin:0, paddingLeft:"20px", display:"flex", flexDirection:"column", gap:"10px", color:"#94a3b8", fontSize:"0.85rem", lineHeight:1.6 }}>
                <li>Create a Firebase project with <strong>Firestore</strong> and <strong>Email/Password Auth</strong>.</li>
                <li>Add a service account key and set <code style={code}>FIREBASE_SERVICE_ACCOUNT</code> in Netlify env vars.</li>
                <li>Create a device document in Firestore: <code style={code}>devices/ESP32-SPIRO-01</code> with <code style={code}>apiKeyHash</code> = SHA-256 of your chosen key.</li>
                <li>Flash the <code style={code}>firmware/spirometer.ino</code> sketch onto your ESP32. Fill in <code style={code}>WIFI_SSID</code>, <code style={code}>WIFI_PASS</code>, <code style={code}>API_URL</code>, and <code style={code}>API_KEY</code>.</li>
                <li>Deploy to Netlify, set the client env vars, and blow into the mouthpiece!</li>
              </ol>
            </section>

            {/* API Key rotation */}
            <section style={card}>
              <h2 style={cardTitle}>🔑 API Key</h2>
              <p style={{ color:"#64748b", fontSize:"0.82rem", margin:"0 0 14px" }}>
                Your device authenticates using a secret key stored only as a SHA-256 hash in Firestore. To rotate it:
              </p>
              <ol style={{ margin:0, paddingLeft:"20px", color:"#94a3b8", fontSize:"0.83rem", lineHeight:1.7 }}>
                <li>Generate a new random key (e.g. <code style={code}>openssl rand -hex 32</code>).</li>
                <li>Compute its SHA-256 and update <code style={code}>devices/{"{deviceId}"}/apiKeyHash</code> in Firestore (use the Firebase console or Admin SDK).</li>
                <li>Update <code style={code}>API_KEY</code> in your firmware and re-flash.</li>
              </ol>
            </section>

            {/* Privacy */}
            <section style={card}>
              <h2 style={cardTitle}>🔒 Privacy & Data</h2>
              <p style={{ color:"#64748b", fontSize:"0.82rem", margin:"0 0 12px" }}>
                All test data is stored in Firebase Firestore, scoped to your account. No personal identifiers are sent to any third-party service by this application.
              </p>
              <p style={{ color:"#64748b", fontSize:"0.82rem", margin:0 }}>
                To delete all your data, contact your administrator or remove the device documents directly from the Firebase console.
              </p>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"12px", flexWrap:"wrap" }}>
      <span style={{ fontSize:"0.75rem", color:"#64748b", fontWeight:600, width:"90px", flexShrink:0 }}>{label}</span>
      <span style={{ color:"#cbd5e1", fontSize:"0.85rem", display:"flex", alignItems:"center", gap:"8px" }}>{children}</span>
    </div>
  );
}

const card: React.CSSProperties = {
  background:   "rgba(255,255,255,0.03)",
  border:       "1px solid rgba(255,255,255,0.07)",
  borderRadius: "16px",
  padding:      "24px",
};
const cardTitle: React.CSSProperties = {
  fontSize:"1rem", fontWeight:700, margin:"0 0 18px",
};
const code: React.CSSProperties = {
  background:"rgba(255,255,255,0.08)", padding:"2px 6px", borderRadius:"4px", fontFamily:"monospace", fontSize:"0.82em",
};
const smallBtn: React.CSSProperties = {
  background:"rgba(99,102,241,0.12)", border:"1px solid rgba(99,102,241,0.2)",
  color:"#818cf8", borderRadius:"6px", padding:"3px 10px", fontSize:"0.75rem",
  fontWeight:600, cursor:"pointer",
};
