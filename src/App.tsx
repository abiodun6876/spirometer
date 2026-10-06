import { useState, useEffect, type ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth } from "./firebase";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { History } from "./pages/History";
import { Device } from "./pages/Device";

// Minimal client-side router using location.pathname
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

export default function App() {
  const [user, setUser]         = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  if (!authReady) {
    return (
      <div style={{
        minHeight:"100vh", background:"#0f172a",
        display:"flex", alignItems:"center", justifyContent:"center",
      }}>
        <div style={{ color:"#64748b", fontSize:"0.9rem" }}>Loading…</div>
      </div>
    );
  }

  return (
    <ProtectedRoute user={user}>
      <Router />
    </ProtectedRoute>
  );
}
