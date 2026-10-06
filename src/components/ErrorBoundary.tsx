import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production you would forward this to a service like Sentry
    console.error("[SpiroSense] Uncaught error:", error, info.componentStack);
  }

  handleReset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{
          minHeight: "100vh",
          background: "#0f172a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily: "'Inter', sans-serif",
        }}>
          {/* Ambient glow */}
          <div style={{ position:"fixed", top:"10%", left:"15%", width:500, height:500, borderRadius:"50%", background:"rgba(239,68,68,0.08)", filter:"blur(80px)", pointerEvents:"none" }} />

          <div style={{
            background:    "rgba(239,68,68,0.06)",
            border:        "1px solid rgba(239,68,68,0.2)",
            borderRadius:  "24px",
            padding:       "48px 40px",
            maxWidth:      "480px",
            width:         "100%",
            textAlign:     "center",
            backdropFilter:"blur(16px)",
          }}>
            <div style={{ fontSize:"3rem", marginBottom:"16px" }}>⚠️</div>
            <h1 style={{ fontSize:"1.4rem", fontWeight:800, color:"#fca5a5", margin:"0 0 10px" }}>
              Something went wrong
            </h1>
            <p style={{ color:"#64748b", fontSize:"0.85rem", margin:"0 0 8px", lineHeight:1.6 }}>
              An unexpected error occurred in SpiroSense AI.
            </p>
            {this.state.error && (
              <pre style={{
                background:"rgba(0,0,0,0.3)", borderRadius:"8px", padding:"12px 14px",
                fontSize:"0.72rem", color:"#94a3b8", textAlign:"left", overflow:"auto",
                maxHeight:"120px", margin:"16px 0",
              }}>
                {this.state.error.message}
              </pre>
            )}
            <div style={{ display:"flex", gap:"10px", justifyContent:"center", marginTop:"20px" }}>
              <button
                id="error-try-again"
                onClick={this.handleReset}
                style={{
                  background:   "linear-gradient(135deg,#6366f1,#4f46e5)",
                  border:       "none",
                  color:        "#fff",
                  borderRadius: "10px",
                  padding:      "10px 22px",
                  fontWeight:   700,
                  fontSize:     "0.9rem",
                  cursor:       "pointer",
                }}
              >
                Try again
              </button>
              <button
                id="error-reload"
                onClick={() => window.location.reload()}
                style={{
                  background:   "rgba(255,255,255,0.05)",
                  border:       "1px solid rgba(255,255,255,0.1)",
                  color:        "#94a3b8",
                  borderRadius: "10px",
                  padding:      "10px 22px",
                  fontWeight:   600,
                  fontSize:     "0.9rem",
                  cursor:       "pointer",
                }}
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
