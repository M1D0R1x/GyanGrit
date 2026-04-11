import { Component, type ErrorInfo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

/* ─────────────────────────────────────────────────────────────────────
 * RouteErrorBoundary
 *
 * Wraps route-level page components so that if one page throws during
 * render, the shell (nav, sidebar, TopBar) stays intact. The user sees
 * a friendly error card with a "Try Again" button instead of a white
 * screen.
 *
 * Usage:
 *   <RouteErrorBoundary>
 *     <DashboardPage />
 *   </RouteErrorBoundary>
 * ──────────────────────────────────────────────────────────────────── */

type Props = { children: ReactNode };
type State = { error: Error | null };

class ErrorBoundaryInner extends Component<
  Props & { onReset: () => void },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[RouteErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorFallback
          error={this.state.error}
          onReset={() => {
            this.setState({ error: null });
            this.props.onReset();
          }}
        />
      );
    }
    return this.props.children;
  }
}

/* ── Fallback UI ──────────────────────────────────────────────────── */

function ErrorFallback({
  error,
  onReset,
}: {
  error: Error;
  onReset: () => void;
}) {
  const navigate = useNavigate();
  const isChunkError =
    error.message.includes("Failed to fetch") ||
    error.message.includes("dynamically imported module") ||
    error.message.includes("Loading chunk") ||
    error.message === "OFFLINE_CHUNK";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: "var(--space-8)",
        textAlign: "center",
      }}
    >
      {/* Ambient glow */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "30%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 400,
          height: 400,
          background:
            "radial-gradient(ellipse, rgba(239,68,68,0.06) 0%, transparent 65%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 440,
          animation: "fadeInUp 0.4s ease both",
        }}
      >
        {/* Icon */}
        <div
          style={{ fontSize: 48, marginBottom: "var(--space-4)", lineHeight: 1 }}
          aria-hidden="true"
        >
          {isChunkError ? "📡" : "⚠️"}
        </div>

        {/* Glass card */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-medium)",
            borderRadius: "var(--radius-2xl)",
            padding: "var(--space-6) var(--space-8)",
            boxShadow: "var(--shadow-xl)",
            marginBottom: "var(--space-6)",
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-xl)",
              fontWeight: 700,
              color: "var(--ink-primary)",
              marginBottom: "var(--space-3)",
            }}
          >
            {isChunkError ? "Connection Lost" : "Something Went Wrong"}
          </h2>
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--ink-muted)",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            {isChunkError
              ? "This page couldn't load — you may be offline or a new version was deployed. Try refreshing."
              : "An unexpected error occurred while loading this page. You can try again or go back to the dashboard."}
          </p>

          {/* DEV-only error details */}
          {import.meta.env.DEV && !isChunkError && (
            <pre
              style={{
                marginTop: "var(--space-4)",
                padding: "var(--space-3)",
                background: "var(--bg-canvas)",
                borderRadius: "var(--radius-lg)",
                fontSize: "var(--text-xs)",
                color: "var(--ink-muted)",
                textAlign: "left",
                overflow: "auto",
                maxHeight: 120,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {error.message}
            </pre>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: "var(--space-3)",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button className="btn btn--secondary" onClick={onReset}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Try Again
          </button>
          <button
            className="btn btn--primary"
            onClick={() => navigate("/dashboard")}
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Public export ────────────────────────────────────────────────── */

export default function RouteErrorBoundary({ children }: Props) {
  return (
    <ErrorBoundaryInner onReset={() => {}}>
      {children}
    </ErrorBoundaryInner>
  );
}
