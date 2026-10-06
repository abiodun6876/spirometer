import { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useToast } from "./Toast";

export function Header() {
  const { showToast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);

  const currentPath = window.location.pathname;

  const links = [
    { to: "/",        label: "Dashboard" },
    { to: "/history", label: "History"   },
    { to: "/device",  label: "Device"    },
  ];

  return (
    <header style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "16px 32px",
      borderBottom: "1px solid rgba(255,255,255,0.07)",
      background: "rgba(15,23,42,0.95)",
      backdropFilter: "blur(12px)",
      position: "sticky", top: 0, zIndex: 100,
      flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{ fontSize: "1.5rem" }}>🫁</span>
        <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "#818cf8" }}>SpiroSense AI</span>
      </div>

      {/* Hamburger icon for mobile */}
      <button 
        onClick={() => setMenuOpen(!menuOpen)}
        style={{
          display: "flex", flexDirection: "column", gap: "4px",
          background: "transparent", border: "none", cursor: "pointer",
          padding: "8px", zIndex: 101,
        }}
        className="hamburger-btn"
      >
        <div style={{ width: "24px", height: "2px", background: "#f1f5f9", transition: "0.3s", transform: menuOpen ? "rotate(45deg) translate(4px, 4px)" : "none" }} />
        <div style={{ width: "24px", height: "2px", background: "#f1f5f9", transition: "0.3s", opacity: menuOpen ? 0 : 1 }} />
        <div style={{ width: "24px", height: "2px", background: "#f1f5f9", transition: "0.3s", transform: menuOpen ? "rotate(-45deg) translate(4px, -4px)" : "none" }} />
      </button>

      {/* Navigation Links */}
      <nav 
        className="main-nav"
        style={{ 
          display: "flex", gap: "16px", alignItems: "center",
          flexDirection: "row",
        }}
      >
        {links.map(({ to, label }) => (
          <a 
            key={to} 
            href={to} 
            style={{
              color: currentPath === to ? "#fff" : "#94a3b8",
              textDecoration: "none", 
              fontWeight: 600, 
              fontSize: "0.9rem",
              padding: "6px 12px", 
              borderRadius: "8px",
              background: currentPath === to ? "rgba(99,102,241,0.15)" : "transparent",
              transition: "0.2s"
            }}
          >
            {label}
          </a>
        ))}
        <button
          onClick={() =>
            signOut(auth).catch(() =>
              showToast("Sign-out failed. Please try again.", "error")
            )
          }
          style={{ 
            background: "rgba(239,68,68,0.1)", 
            border: "1px solid rgba(239,68,68,0.2)", 
            color: "#fca5a5", 
            borderRadius: "8px", 
            padding: "6px 14px", 
            cursor: "pointer", 
            fontSize: "0.85rem", 
            fontWeight: 600 
          }}
        >
          Sign out
        </button>
      </nav>

      <style>{`
        @media (max-width: 768px) {
          .main-nav {
            display: ${menuOpen ? "flex" : "none"} !important;
            flex-direction: column !important;
            width: 100%;
            padding-top: 16px;
            align-items: flex-start !important;
          }
        }
        @media (min-width: 769px) {
          .hamburger-btn {
            display: none !important;
          }
        }
      `}</style>
    </header>
  );
}
