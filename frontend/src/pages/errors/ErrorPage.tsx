// pages/errors/ErrorPage.tsx — Infinite Obsidian v2
import { useNavigate } from "react-router-dom";

type Props = {
  code: number;
  title: string;
  message: string;
  action?: { label: string; to: string };
  icon?: string;
};

export default function ErrorPage({ code, title, message, action, icon = "\u26A0\uFE0F" }: Props) {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight:      "100dvh",
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        padding:        "var(--space-8)",
        background:     "var(--bg-canvas)",
        textAlign:      "center",
        position:       "relative",
        overflow:       "hidden",      }}
    >
      {/* Ambient glow */}
      <div aria-hidden="true" style={{
        position:      "absolute",
        top:           "20%",
        left:          "50%",
        transform:     "translateX(-50%)",
        width:         500,
        height:        500,
        background:    "radial-gradient(ellipse, rgba(245,158,11,0.08) 0%, transparent 65%)",
        pointerEvents: "none",
      }} />

      <div style={{
        position:  "relative",
        zIndex:    1,
        maxWidth:  480,
        animation: "fadeInUp 0.4s ease both",
      }}>
        {/* Large code */}
        <div
          aria-hidden="true"
          style={{
            fontFamily:       "var(--font-display)",
            fontSize:         "clamp(80px, 16vw, 140px)",
            fontWeight:       900,
            color:            "transparent",
            WebkitTextStroke: "2px var(--border-medium)",
            lineHeight:       1,
            letterSpacing:    "-0.04em",
            marginBottom:     "var(--space-2)",
            userSelect:       "none",
          }}
        >
          {code}
        </div>

        {/* Icon */}
        <div style={{ fontSize: 40, marginBottom: "var(--space-5)", lineHeight: 1 }} aria-hidden="true">
          {icon}
        </div>

        {/* Glass card */}
        <div style={{
          background:     "var(--bg-surface)",
          border:         "1px solid var(--border-medium)",
          borderRadius:   "var(--radius-2xl)",
          padding:        "var(--space-8) var(--space-8)",
          boxShadow:      "var(--shadow-xl)",
          marginBottom:   "var(--space-6)",
        }}>
          <h1 style={{
            fontFamily:   "var(--font-display)",
            fontSize:     "var(--text-2xl)",
            fontWeight:   700,
            color:        "var(--ink-primary)",
            marginBottom: "var(--space-3)",
          }}>
            {title}
          </h1>
          <p style={{
            fontSize:   "var(--text-base)",
            color:      "var(--ink-muted)",
            lineHeight: 1.6,
            margin:     0,
          }}>
            {message}
          </p>
        </div>

        <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "center", flexWrap: "wrap" }}>
          <button className="btn btn--secondary" onClick={() => navigate(-1)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Go Back
          </button>

          {action && (
            <button className="btn btn--primary" onClick={() => navigate(action.to)}>
              {action.label}
            </button>
          )}
        </div>

        <div style={{
          marginTop:     "var(--space-10)",
          fontSize:      "var(--text-xs)",
          color:         "var(--ink-muted)",
          fontFamily:    "var(--font-display)",
          letterSpacing: "0.1em",
        }}>
          GYANGRIT
        </div>
      </div>
    </div>
  );
}
