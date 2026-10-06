import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────
export type ToastKind = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  message: string;
  kind: ToastKind;
}

interface ToastCtx {
  showToast: (message: string, kind?: ToastKind) => void;
}

// ── Context ────────────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastCtx>({ showToast: () => {} });

// ── Config ─────────────────────────────────────────────────────────────────────
const DURATION_MS = 3800;
const MAX_TOASTS  = 4;

const kindStyle: Record<ToastKind, { border: string; accent: string; bg: string }> = {
  success: { bg:"rgba(34,197,94,0.12)",  border:"rgba(34,197,94,0.3)",  accent:"#4ade80" },
  error:   { bg:"rgba(239,68,68,0.12)",  border:"rgba(239,68,68,0.3)",  accent:"#fca5a5" },
  info:    { bg:"rgba(99,102,241,0.12)", border:"rgba(99,102,241,0.3)", accent:"#818cf8" },
  warning: { bg:"rgba(245,158,11,0.12)", border:"rgba(245,158,11,0.3)", accent:"#fcd34d" },
};
const kindIcon: Record<ToastKind, string> = {
  success:"✓", error:"✕", info:"ℹ", warning:"⚠",
};

// ── Provider ───────────────────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const showToast = useCallback((message: string, kind: ToastKind = "info") => {
    const id = `toast-${++counter.current}`;
    setToasts((prev) => [{ id, message, kind }, ...prev].slice(0, MAX_TOASTS));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, DURATION_MS);
  }, []);

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast stack */}
      <div
        aria-live="polite"
        aria-atomic="false"
        style={{
          position: "fixed",
          bottom:   "24px",
          right:    "24px",
          zIndex:   9999,
          display:  "flex",
          flexDirection: "column-reverse",
          gap:      "10px",
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => {
          const s = kindStyle[t.kind];
          return (
            <div
              key={t.id}
              role="alert"
              style={{
                display:       "flex",
                alignItems:    "center",
                gap:           "10px",
                background:    s.bg,
                border:        `1px solid ${s.border}`,
                backdropFilter:"blur(16px)",
                borderRadius:  "12px",
                padding:       "12px 16px",
                minWidth:      "260px",
                maxWidth:      "380px",
                pointerEvents: "all",
                boxShadow:     "0 8px 32px rgba(0,0,0,0.4)",
                animation:     "toastIn 0.25s ease",
                fontFamily:    "'Inter', sans-serif",
              }}
            >
              <span style={{
                width:"22px", height:"22px", borderRadius:"50%",
                background: s.border, color:"#0f172a",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:"0.7rem", fontWeight:800, flexShrink:0,
              }}>
                {kindIcon[t.kind]}
              </span>
              <span style={{ color:"#f1f5f9", fontSize:"0.84rem", fontWeight:500, flex:1, lineHeight:1.45 }}>
                {t.message}
              </span>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                style={{
                  background:"none", border:"none", color:"#64748b",
                  cursor:"pointer", padding:"2px 4px", fontSize:"0.85rem", flexShrink:0,
                }}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes toastIn {
          from { opacity:0; transform:translateY(12px) scale(0.95); }
          to   { opacity:1; transform:translateY(0)    scale(1);    }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────────
export function useToast() {
  return useContext(ToastContext);
}
