import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { doc, setDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../firebase";
import { useDevice } from "../hooks/useDevice";
import { useDeviceId } from "../context/DeviceContext";
import { useToast } from "../components/Toast";
import { Header } from "../components/Header";

export function Device() {
  const { deviceId, setDevice } = useDeviceId();
  const { showToast }           = useToast();
  const { device, loading }     = useDevice(deviceId);
  const [copied, setCopied]     = useState(false);
  const [editId, setEditId]     = useState("");
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);

  function copyId() {
    navigator.clipboard.writeText(deviceId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function saveDeviceId() {
    const trimmed = editId.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const user = getAuth().currentUser;
      if (user) {
        await setDoc(doc(db, "users", user.uid), { deviceId: trimmed }, { merge: true });
      }
      setDevice(trimmed);
      showToast("Device ID updated successfully.", "success");
      setEditing(false);
      setEditId("");
    } catch {
      showToast("Failed to save device ID. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  const isOnline = device?.lastSeenAt
    ? Date.now() - device.lastSeenAt.getTime() < 3_600_000
    : false;

  return (
    <div style={{ minHeight:"100vh", background:"#0f172a", color:"#f1f5f9", fontFamily:"'Inter',sans-serif" }}>
      <Header />

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

                {/* Device ID row with inline edit */}
                <Row label="Device ID">
                  {editing ? (
                    <div style={{ display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap" }}>
                      <input
                        id="device-id-input"
                        value={editId}
                        onChange={(e) => setEditId(e.target.value)}
                        placeholder={deviceId}
                        style={{
                          background:"rgba(255,255,255,0.06)", border:"1px solid rgba(99,102,241,0.4)",
                          borderRadius:"8px", padding:"5px 10px", color:"#f1f5f9",
                          fontSize:"0.85rem", outline:"none", minWidth:"200px",
                        }}
                        autoFocus
                        onKeyDown={(e) => { if (e.key === "Enter") saveDeviceId(); if (e.key === "Escape") setEditing(false); }}
                      />
                      <button id="save-device-id" onClick={saveDeviceId} disabled={saving} style={primarySmallBtn}>
                        {saving ? "Saving…" : "Save"}
                      </button>
                      <button onClick={() => setEditing(false)} style={smallBtn}>Cancel</button>
                    </div>
                  ) : (
                    <>
                      <code style={{ background:"rgba(255,255,255,0.05)", padding:"3px 8px", borderRadius:"6px", fontSize:"0.85rem" }}>
                        {deviceId}
                      </code>
                      <button id="copy-device-id" onClick={copyId} style={smallBtn}>
                        {copied ? "✓ Copied" : "Copy"}
                      </button>
                      <button id="change-device-id" onClick={() => { setEditing(true); setEditId(deviceId); }} style={smallBtn}>
                        Change
                      </button>
                    </>
                  )}
                </Row>

                <Row label="Name">{device?.name ?? "—"}</Row>
                <Row label="Last seen">
                  {device?.lastSeenAt
                    ? `${formatDistanceToNow(device.lastSeenAt, { addSuffix:true })} (${format(device.lastSeenAt, "d MMM yyyy, HH:mm")})`
                    : "Never"}
                </Row>
                <Row label="Status">
                  <span style={{
                    background: isOnline ? "rgba(34,197,94,0.15)" : "rgba(100,116,139,0.15)",
                    color:      isOnline ? "#4ade80" : "#94a3b8",
                    border:     isOnline ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(100,116,139,0.3)",
                    borderRadius:"999px", padding:"2px 10px", fontSize:"0.75rem", fontWeight:700,
                  }}>
                    {isOnline ? "● Online" : "○ Offline"}
                  </span>
                </Row>
              </div>
            </section>

            {/* Setup instructions */}
            <section style={card}>
              <h2 style={cardTitle}>⚙️ Setup Instructions</h2>
              <ol style={{ margin:0, paddingLeft:"20px", display:"flex", flexDirection:"column", gap:"10px", color:"#94a3b8", fontSize:"0.85rem", lineHeight:1.6 }}>
                <li>Create a Firebase project with <strong>Firestore</strong> and <strong>Email/Password Auth</strong>.</li>
                <li>Add a service account key and set <code style={codeStyle}>FIREBASE_SERVICE_ACCOUNT</code> in Netlify env vars.</li>
                <li>Create a device document in Firestore: <code style={codeStyle}>devices/{deviceId}</code> with <code style={codeStyle}>apiKeyHash</code> = SHA-256 of your chosen key.</li>
                <li>Flash the <code style={codeStyle}>firmware/spirometer.ino</code> sketch onto your ESP32. Fill in <code style={codeStyle}>WIFI_SSID</code>, <code style={codeStyle}>WIFI_PASS</code>, <code style={codeStyle}>API_URL</code>, and <code style={codeStyle}>API_KEY</code>.</li>
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
                <li>Generate a new random key (e.g. <code style={codeStyle}>openssl rand -hex 32</code>).</li>
                <li>Compute its SHA-256 and update <code style={codeStyle}>devices/{"{deviceId}"}/apiKeyHash</code> in Firestore (use the Firebase console or Admin SDK).</li>
                <li>Update <code style={codeStyle}>API_KEY</code> in your firmware and re-flash.</li>
              </ol>
            </section>

            {/* Privacy */}
            <section style={card}>
              <h2 style={cardTitle}>🔒 Privacy &amp; Data</h2>
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
const codeStyle: React.CSSProperties = {
  background:"rgba(255,255,255,0.08)", padding:"2px 6px", borderRadius:"4px", fontFamily:"monospace", fontSize:"0.82em",
};
const smallBtn: React.CSSProperties = {
  background:"rgba(99,102,241,0.12)", border:"1px solid rgba(99,102,241,0.2)",
  color:"#818cf8", borderRadius:"6px", padding:"3px 10px", fontSize:"0.75rem",
  fontWeight:600, cursor:"pointer",
};
const primarySmallBtn: React.CSSProperties = {
  background:"rgba(99,102,241,0.35)", border:"1px solid rgba(99,102,241,0.5)",
  color:"#c7d2fe", borderRadius:"6px", padding:"3px 10px", fontSize:"0.75rem",
  fontWeight:700, cursor:"pointer",
};
