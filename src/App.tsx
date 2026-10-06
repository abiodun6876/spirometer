import { useState, useEffect, type ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth } from "./firebase";
import { Login }     from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { History }   from "./pages/History";
import { Device }    from "./pages/Device";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastProvider } from "./components/Toast";
import { DeviceProvider } from "./context/DeviceContext";

// ── Minimal pathname router ────────────────────────────────────────────────────
function Router() {
  const path = window.location.pathname;
  if (path === "/history") return <History />;
  if (path === "/device")  return <Device />;
  return <Dashboard />;
}

function ProtectedRoute({ user, children }: { user: User | null; children: ReactNode }) {
  if (!user) return <Login />;
  return <>{children}</>;
}

// ── Loading splash ─────────────────────────────────────────────────────────────
function LoadingSplash() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at 20% 60%, #1e1b4b 0%, #0f172a 60%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: "16px",
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ fontSize: "2.5rem" }}>🫁</div>
      <div style={{ color: "#818cf8", fontWeight: 800, fontSize: "1.1rem" }}>SpiroSense AI</div>
      <div style={{
        width: "32px", height: "32px", border: "3px solid rgba(99,102,241,0.2)",
        borderTop: "3px solid #6366f1", borderRadius: "50%",
        animation: "spin 0.75s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────────
export default function App() {
  const [user,     setUser]     = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  if (!authReady) return <LoadingSplash />;

  return (
    <ErrorBoundary>
      <ToastProvider>
        <DeviceProvider>
          <ProtectedRoute user={user}>
            <Router />
          </ProtectedRoute>
        </DeviceProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
