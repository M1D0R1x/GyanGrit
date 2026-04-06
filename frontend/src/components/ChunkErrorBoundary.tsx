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
 *
 * TWO cases:
 * 1. ONLINE  → stale chunk after deploy → hard reload once → gets fresh bundle
 * 2. OFFLINE → chunk never cached → can't reload → show friendly offline screen
 */
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError:  boolean;
  isOffline: boolean;
}

function isChunkError(error: Error): boolean {
  const msg = error.message || "";
  return (
    msg === "OFFLINE_CHUNK" ||
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
    this.state = { hasError: false, isOffline: false };
  }

  static getDerivedStateFromError(error: Error): State | null {
    if (isChunkError(error)) {
      return {
        hasError:  true,
        // Mark as offline error so we skip the reload attempt
        isOffline: !navigator.onLine || error.message === "OFFLINE_CHUNK",
      };
    }
    return null;
  }

  componentDidCatch(error: Error) {
    // Don't reload if offline — it won't help and causes an infinite loop
    if (isChunkError(error) && navigator.onLine && error.message !== "OFFLINE_CHUNK") {
      const key = `chunk-reload-${window.location.pathname}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
      }
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const key = `chunk-reload-${window.location.pathname}`;

    // ── Offline: page not cached ────────────────────────────────────────────
    if (this.state.isOffline) {
      return (
        <div style={{
          minHeight:      "100dvh",
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "center",
          padding:        "2rem",
          textAlign:      "center",
          fontFamily:     "'DM Sans', 'Nunito', system-ui, sans-serif",
          background:     "#0D1117",
          color:          "#e2e8f0",
        }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>📶</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
            Page not available offline
          </h2>
          <p style={{ fontSize: 14, color: "#94a3b8", marginBottom: 28, maxWidth: 340, lineHeight: 1.7 }}>
            This page wasn't cached before you went offline.
            Connect to the internet and visit once — it'll be available offline after that.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <button
              onClick={() => window.location.href = "/downloads"}
              style={{
                padding: "12px 24px", background: "#F5A623", color: "#fff",
                border: "none", borderRadius: 10, fontSize: 14,
                fontWeight: 700, cursor: "pointer", minHeight: 48,
              }}
            >
              My Downloads
            </button>
            <button
              onClick={() => window.location.href = "/dashboard"}
              style={{
                padding: "12px 24px",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#e2e8f0", borderRadius: 10, fontSize: 14,
                fontWeight: 600, cursor: "pointer", minHeight: 48,
              }}
            >
              Dashboard
            </button>
          </div>
        </div>
      );
    }

    // ── Online: stale chunk after deploy ────────────────────────────────────
    // Return null while reload is happening; if already retried, show UI
    if (sessionStorage.getItem(key)) {
      sessionStorage.removeItem(key);
      return (
        <div style={{
          minHeight:      "100dvh",
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "center",
          padding:        "2rem",
          textAlign:      "center",
          fontFamily:     "'DM Sans', 'Nunito', system-ui, sans-serif",
          background:     "#FDF8F0",
          color:          "#1A1208",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔄</div>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
            App Updated
          </h2>
          <p style={{ fontSize: 14, color: "#9B8E7E", marginBottom: 24, maxWidth: 400, lineHeight: 1.6 }}>
            A new version of GyanGrit was deployed. Please refresh to load the latest version.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 24px", background: "#F59E0B", color: "#fff",
              border: "none", borderRadius: 9999, fontSize: 14,
              fontWeight: 700, cursor: "pointer",
            }}
          >
            Refresh Now
          </button>
        </div>
      );
    }

    return null; // reload in componentDidCatch will handle it
  }
}
