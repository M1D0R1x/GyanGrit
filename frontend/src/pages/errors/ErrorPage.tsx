import { useNavigate } from "react-router-dom";

type Props = {
  code: number;
  title: string;
  message: string;
  action?: {
    label: string;
    to: string;
  };
  icon?: string;
};

export default function ErrorPage({
  code,
  title,
  message,
  action,
  icon = "⚠️",
}: Props) {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-8)",
        background: "var(--bg-base)",
        textAlign: "center",
      }}
    >
      {/* Subtle grid background */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage: `
            linear-gradient(var(--border-subtle) 1px, transparent 1px),
            linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
          opacity: 0.4,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 480,
          animation: "fadeInUp 0.4s ease both",
        }}
      >
        {/* Error code — large typographic element */}
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(72px, 15vw, 120px)",
            fontWeight: 900,
            color: "transparent",
            WebkitTextStroke: "2px var(--border-strong)",
            lineHeight: 1,
            letterSpacing: "-0.04em",
            marginBottom: "var(--space-2)",
            userSelect: "none",
          }}
          aria-hidden="true"
        >
          {code}
        </div>

        {/* Icon */}
        <div
          style={{
            fontSize: 40,
            marginBottom: "var(--space-5)",
            lineHeight: 1,
          }}
          aria-hidden="true"
        >
          {icon}
        </div>

        {/* Title */}
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-2xl)",
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: "var(--space-3)",
          }}
        >
          {title}
        </h1>

        {/* Message */}
        <p
          style={{
            fontSize: "var(--text-base)",
            color: "var(--text-muted)",
            lineHeight: 1.6,
            marginBottom: "var(--space-8)",
          }}
        >
          {message}
        </p>

        {/* Actions */}
        <div
          style={{
            display: "flex",
            gap: "var(--space-3)",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            className="btn btn--secondary"
            onClick={() => navigate(-1)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Go Back
          </button>

          {action && (
            <button
              className="btn btn--primary"
              onClick={() => navigate(action.to)}
            >
              {action.label}
            </button>
          )}
        </div>

        {/* Subtle brand */}
        <div
          style={{
            marginTop: "var(--space-12)",
            fontSize: "var(--text-xs)",
            color: "var(--text-muted)",
            opacity: 0.5,
            fontFamily: "var(--font-display)",
            letterSpacing: "0.08em",
          }}
        >
          GYANGRIT
        </div>
      </div>
    </div>
  );
}