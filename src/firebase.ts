import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// ── Production config validation ──────────────────────────────────────────────
const requiredVars = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_FIREBASE_MEASUREMENT_ID",
] as const;

const missing = requiredVars.filter(
  (k) => !import.meta.env[k] || import.meta.env[k] === ""
);

if (missing.length > 0) {
  const msg =
    `[SpiroSense] Missing required environment variables:\n` +
    missing.map((k) => `  • ${k}`).join("\n") +
    `\n\nCopy .env.example → .env.local and fill in your Firebase credentials.`;

  if (import.meta.env.PROD) {
    // In production: render a visible error instead of crashing silently
    document.body.innerHTML = `
      <div style="min-height:100vh;background:#0f172a;display:flex;align-items:center;justify-content:center;font-family:Inter,sans-serif;padding:24px">
        <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:18px;padding:36px;max-width:480px;width:100%">
          <div style="font-size:2rem;margin-bottom:12px">⚠️</div>
          <h1 style="color:#fca5a5;font-size:1.2rem;margin:0 0 10px;font-weight:800">App configuration error</h1>
          <p style="color:#94a3b8;font-size:0.82rem;margin:0 0 16px;line-height:1.6">
            One or more Firebase environment variables are missing.
            Please check the Netlify environment settings and redeploy.
          </p>
          <pre style="background:rgba(0,0,0,0.3);border-radius:8px;padding:12px;font-size:0.72rem;color:#64748b;overflow:auto">${missing.join("\n")}</pre>
        </div>
      </div>`;
    throw new Error(msg);
  } else {
    // In development: loud console warning so devs notice immediately
    console.warn(msg);
  }
}

// ── Firebase init ─────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);
export const analytics = getAnalytics(app);
