// components/ChunkErrorBoundary.tsx
/**
 * Global safety net for stale chunk errors after Vercel deploys.
 *
 * When Vercel deploys a new build, old JS chunk filenames (with content hashes)
 * become 404s. If a user has the app open and navigates to a lazy-loaded route,
 * the old chunk URL returns index.html (text/html MIME) instead of JS.
 *
 * This ErrorBoundary catches those errors BEFORE React Router's default
 * ErrorBoundary shows the ugly red "Unexpected Application Error!" screen.
 * It does a one-time hard reload so the browser fetches the new index.html
 * with updated chunk references. SessionStorage prevents infinite reload loops.
 */
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

function isChunkError(error: Error): boolean {
  const msg = error.message || "";
  return (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Failed to fetch") ||
    msg.includes("Loading chunk") ||
    msg.includes("Loading CSS chunk") ||
    msg.includes("text/html")
  );
}

export class ChunkErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State | null {
    if (isChunkError(error)) {
      return { hasError: true };
    }
    return null;
  }

  componentDidCatch(error: Error) {
    if (isChunkError(error)) {
      const key = `chunk-reload-${window.location.pathname}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.hasError) {
      // Return null — the reload in componentDidCatch will handle it.
      // If we already retried (sessionStorage has the key), show a message.
      const key = `chunk-reload-${window.location.pathname}`;
      if (sessionStorage.getItem(key)) {
        sessionStorage.removeItem(key);
        return (
          <div style={{
            minHeight: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔄</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              App Updated
            </h2>
            <p style={{ fontSize: 14, color: "#666", marginBottom: 24, maxWidth: 400 }}>
              A new version of GyanGrit was deployed. Please refresh the page to load the latest version.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "10px 24px",
                background: "#3b82f6",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Refresh Now
            </button>
          </div>
        );
      }
      return null;
    }
    return this.props.children;
  }
}
