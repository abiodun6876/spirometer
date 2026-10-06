import { useState, type FormEvent } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";

export function Login() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode]         = useState<"login" | "register">("login");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display:   "flex",
      alignItems:"center",
      justifyContent:"center",
      background: "radial-gradient(ellipse at 20% 60%, #1e1b4b 0%, #0f172a 60%)",
      padding:   "20px",
    }}>
      {/* ambient glow */}
      <div style={{
        position:"fixed", top:"10%", left:"15%",
        width:500, height:500, borderRadius:"50%",
        background:"rgba(99,102,241,0.15)", filter:"blur(80px)", pointerEvents:"none",
      }}/>
      <div style={{
        position:"fixed", bottom:"10%", right:"10%",
        width:400, height:400, borderRadius:"50%",
        background:"rgba(34,211,238,0.1)", filter:"blur(80px)", pointerEvents:"none",
      }}/>

      <div style={{
        background:   "rgba(255,255,255,0.04)",
        border:       "1px solid rgba(255,255,255,0.1)",
        borderRadius: "24px",
        padding:      "48px 40px",
        width:        "100%",
        maxWidth:     "400px",
        backdropFilter:"blur(20px)",
        position:     "relative",
      }}>
        {/* logo */}
        <div style={{ textAlign:"center", marginBottom:"32px" }}>
          <div style={{ fontSize:"2.5rem", marginBottom:"8px" }}>🫁</div>
          <h1 style={{ fontSize:"1.6rem", fontWeight:800, color:"#f1f5f9", margin:0 }}>SpiroSense AI</h1>
          <p style={{ color:"#64748b", fontSize:"0.82rem", margin:"6px 0 0" }}>Smart spirometry monitoring</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
          <div>
            <label style={{ fontSize:"0.75rem", color:"#94a3b8", fontWeight:600, letterSpacing:"0.06em", display:"block", marginBottom:"6px" }}>
              EMAIL
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize:"0.75rem", color:"#94a3b8", fontWeight:600, letterSpacing:"0.06em", display:"block", marginBottom:"6px" }}>
              PASSWORD
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{ background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:"10px", padding:"10px 14px", fontSize:"0.8rem", color:"#fca5a5" }}>
              {error}
            </div>
          )}

          <button
            id="login-submit"
            type="submit"
            disabled={loading}
            style={{
              background:    loading ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg,#6366f1,#4f46e5)",
              color:         "#fff",
              border:        "none",
              borderRadius:  "12px",
              padding:       "14px",
              fontWeight:    700,
              fontSize:      "0.95rem",
              cursor:        loading ? "not-allowed" : "pointer",
              marginTop:     "4px",
              transition:    "opacity 0.2s",
            }}
          >
            {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p style={{ textAlign:"center", fontSize:"0.8rem", color:"#64748b", marginTop:"20px" }}>
          {mode === "login" ? "No account? " : "Have an account? "}
          <button
            id="login-toggle"
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
            style={{ background:"none", border:"none", color:"#818cf8", cursor:"pointer", fontWeight:600, padding:0 }}
          >
            {mode === "login" ? "Register" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width:        "100%",
  background:   "rgba(255,255,255,0.05)",
  border:       "1px solid rgba(255,255,255,0.1)",
  borderRadius: "10px",
  padding:      "12px 14px",
  color:        "#f1f5f9",
  fontSize:     "0.9rem",
  outline:      "none",
  boxSizing:    "border-box",
};
