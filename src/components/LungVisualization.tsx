import React, { useEffect, useState } from "react";

interface LungVisualizationProps {
  fvc: number;
  fev1: number;
}

export function LungVisualization({ fvc, fev1 }: LungVisualizationProps) {
  const [phase, setPhase] = useState<"idle" | "inhale" | "exhale">("idle");
  const ratio = fvc > 0 ? (fev1 / fvc) * 100 : 0;

  // Calculate animation parameters based on medical data
  // Normal FVC ~ 4-5L. Scale size based on FVC (cap at 6L)
  const scale = Math.min(Math.max(fvc / 4, 0.6), 1.2); 
  
  // Exhalation duration: Lower ratio (obstructive) means it takes much longer to exhale
  const exhaleDurationSec = ratio < 70 ? 4.0 : 1.5; 

  useEffect(() => {
    // Animation loop: Inhale (2s) -> Hold (0.5s) -> Exhale (dynamic) -> Rest (2s)
    let timeoutId: ReturnType<typeof setTimeout>;

    const playSequence = () => {
      setPhase("inhale");
      timeoutId = setTimeout(() => {
        setPhase("exhale");
        timeoutId = setTimeout(() => {
          setPhase("idle");
          timeoutId = setTimeout(playSequence, 2000); // 2 second rest before next breath
        }, exhaleDurationSec * 1000);
      }, 2500); // 2s inhale + 0.5s hold
    };

    playSequence();
    return () => clearTimeout(timeoutId);
  }, [exhaleDurationSec]);

  // CSS variables for dynamic animation
  const lungTransform = phase === "inhale" ? `scale(${scale})` : "scale(0.8)";
  const lungTransition = phase === "inhale" ? "transform 2s ease-out" : `transform ${exhaleDurationSec}s ease-in-out`;

  const particleOpacity = phase === "exhale" ? 0.6 : 0;
  const particleAnimation = phase === "exhale" ? `flowOut ${exhaleDurationSec}s linear infinite` : "none";

  return (
    <div style={container}>
      <div style={header}>
        <h3 style={{ margin: 0, fontSize: "1rem", color: "#f8fafc", display: "flex", alignItems: "center", gap: "8px" }}>
          🫁 Airflow Simulation
        </h3>
        <span style={{ fontSize: "0.75rem", background: "rgba(99,102,241,0.2)", color: "#818cf8", padding: "4px 10px", borderRadius: "999px", fontWeight: 700 }}>
          {phase === "inhale" ? "INHALING..." : phase === "exhale" ? "EXHALING..." : "RESTING"}
        </span>
      </div>
      
      <p style={{ fontSize: "0.85rem", color: "#94a3b8", marginBottom: "24px" }}>
        Visualizing the most recent test (FVC: {fvc}L, FEV1: {fev1}L). 
        {ratio < 70 ? " Notice the prolonged exhalation phase typical of an obstructive pattern." : " Exhalation speed is normal."}
      </p>

      <div style={visualizationArea}>
        {/* Lungs */}
        <div style={{ ...lungsContainer, transform: lungTransform, transition: lungTransition }}>
          {/* Trachea */}
          <div style={trachea}></div>
          <div style={lobesContainer}>
            {/* Left Lung */}
            <div style={{ ...lungLobe, borderTopRightRadius: "60px", borderBottomRightRadius: "40px" }} />
            {/* Right Lung */}
            <div style={{ ...lungLobe, borderTopLeftRadius: "60px", borderBottomLeftRadius: "40px" }} />
          </div>
        </div>

        {/* Airflow Particles traveling from lungs to spirometer */}
        <div style={airflowContainer}>
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              style={{
                ...particle,
                opacity: particleOpacity,
                animation: particleAnimation,
                animationDelay: `${i * (exhaleDurationSec / 5)}s`
              }}
            />
          ))}
        </div>

        {/* Stylized Spirometer Device */}
        <div style={spirometerDevice}>
          <div style={mouthpiece}></div>
          <div style={deviceBody}>
            <div style={screen}>
              <div style={{...bar, height: phase === "exhale" ? "80%" : "10%"}}></div>
              <div style={{...bar, height: phase === "exhale" ? "60%" : "10%"}}></div>
              <div style={{...bar, height: phase === "exhale" ? "90%" : "10%"}}></div>
            </div>
            <div style={espChip}>ESP32</div>
          </div>
        </div>
      </div>

      <style>
        {`
          @keyframes flowOut {
            0% { transform: translateY(0) scale(1); opacity: 0; }
            10% { opacity: 0.6; }
            90% { opacity: 0.6; }
            100% { transform: translateY(120px) scale(0.5); opacity: 0; }
          }
        `}
      </style>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const container: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "16px",
  padding: "24px",
  marginTop: "24px",
  boxShadow: "0 4px 20px rgba(0,0,0,0.2)"
};

const header: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px"
};

const visualizationArea: React.CSSProperties = {
  height: "300px",
  background: "radial-gradient(circle at center, rgba(30,41,59,1) 0%, rgba(15,23,42,1) 100%)",
  borderRadius: "12px",
  position: "relative",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.05)"
};

const lungsContainer: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  marginTop: "30px",
  zIndex: 2,
};

const trachea: React.CSSProperties = {
  width: "20px", height: "40px",
  background: "linear-gradient(to right, #fb7185, #f43f5e)",
  borderRadius: "4px",
  marginBottom: "-10px",
  zIndex: 3
};

const lobesContainer: React.CSSProperties = {
  display: "flex", gap: "10px"
};

const lungLobe: React.CSSProperties = {
  width: "70px", height: "100px",
  background: "linear-gradient(135deg, #f43f5e, #be123c)",
  borderRadius: "50px",
  boxShadow: "inset -5px -5px 15px rgba(0,0,0,0.3), 0 10px 20px rgba(0,0,0,0.4)"
};

const airflowContainer: React.CSSProperties = {
  position: "absolute",
  top: "160px",
  width: "40px",
  height: "120px",
  display: "flex",
  justifyContent: "center",
  zIndex: 1
};

const particle: React.CSSProperties = {
  position: "absolute",
  width: "8px", height: "8px",
  background: "#38bdf8",
  borderRadius: "50%",
  boxShadow: "0 0 10px #38bdf8, 0 0 20px #7dd3fc"
};

const spirometerDevice: React.CSSProperties = {
  position: "absolute",
  bottom: "20px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  zIndex: 2
};

const mouthpiece: React.CSSProperties = {
  width: "30px", height: "40px",
  background: "linear-gradient(to right, #cbd5e1, #94a3b8)",
  borderRadius: "4px 4px 0 0",
  marginBottom: "-5px",
  zIndex: 1
};

const deviceBody: React.CSSProperties = {
  width: "120px", height: "60px",
  background: "linear-gradient(135deg, #1e293b, #0f172a)",
  border: "2px solid #334155",
  borderRadius: "12px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 16px",
  boxShadow: "0 10px 25px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.1)"
};

const screen: React.CSSProperties = {
  width: "35px", height: "35px",
  background: "#020617",
  border: "1px solid #334155",
  borderRadius: "4px",
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-evenly",
  padding: "2px"
};

const bar: React.CSSProperties = {
  width: "6px",
  background: "#22c55e",
  borderRadius: "1px",
  transition: "height 0.3s ease"
};

const espChip: React.CSSProperties = {
  fontSize: "0.6rem",
  fontWeight: 800,
  color: "#e2e8f0",
  letterSpacing: "0.05em",
  fontFamily: "monospace"
};
