// pages.LoginPage — Chalk & Sunlight v3
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost } from "../services/api";
import { useAuth } from "../auth/AuthContext";
import type { Role } from "../auth/authTypes";
import { Helmet } from "react-helmet-async";

type LoginApiResponse =
  | { otp_required: true; username: string; role: Role }
  | { otp_required: false; id: number; username: string; role: Role };

const ROLE_PATHS: Record<Role, string> = {
  STUDENT:   "/dashboard",
  TEACHER:   "/teacher",
  PRINCIPAL: "/principal",
  OFFICIAL:  "/official",
  ADMIN:     "/admin-panel",
};

function isSafari(): boolean {
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/Chrome/.test(ua) && !/Chromium/.test(ua);
}

export default function LoginPage() {
  const navigate = useNavigate();
  const auth     = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Detect offline before hitting the network
    if (!navigator.onLine) {
      setError("No internet connection. Connect to the internet and try again.");
      return;
    }

    setLoading(true);
    setError(null);
    auth.clearKicked();

    try {
      const response = await apiPost<LoginApiResponse>("/accounts/login/", { username, password });

      if (response.otp_required) {
        navigate("/verify-otp", {
          state: { username, otp_channel: (response as { otp_channel?: string }).otp_channel },
          replace: true,
        });
        return;
      }

      await auth.refresh();
      navigate(ROLE_PATHS[response.role] ?? "/", { replace: true });

    } catch (err: unknown) {
      let message = err instanceof Error ? err.message : "Login failed. Please try again.";
      // Sanitize: hide internal API URLs and raw fetch errors from users
      if (
        message.toLowerCase().includes("failed to fetch") ||
        message.toLowerCase().includes("networkerror") ||
        message.toLowerCase().includes("api.") ||
        message.startsWith("TypeError")
      ) {
        message = "Unable to connect. Check your internet connection and try again.";
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Login | GyanGrit Student Portal</title>
        <meta name="description" content="Sign in to GyanGrit to access your courses, flashcards, and live sessions." />
      </Helmet>

      <main className="login-page">
        <div className="login-card">

          {/* Brand */}
          <div className="login-card__brand">
            Gyan<span>Grit</span>
          </div>
          <p className="login-card__tagline">
            Empowering rural students, one lesson at a time
          </p>

          <hr className="login-card__divider" />

          {/* Alerts */}
          {isSafari() && (
            <div className="alert alert--warning" role="alert" style={{ marginBottom: "var(--space-4)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Safari may block login due to cross-site cookie restrictions. Please use Chrome or Edge.
            </div>
          )}

          {auth.kickedMessage && (
            <div className="alert alert--warning" role="alert" style={{ marginBottom: "var(--space-4)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              {auth.kickedMessage}
            </div>
          )}

          {error && (
            <div className="alert alert--error" role="alert" style={{ marginBottom: "var(--space-4)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="username">Username</label>
              <input
                id="username"
                className="form-input"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--space-2)" }}>
                <label className="form-label" htmlFor="password" style={{ margin: 0 }}>Password</label>
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--saffron)", fontSize: "var(--text-xs)",
                    padding: 0, fontWeight: 700, fontFamily: "var(--font-display)",
                  }}
                >
                  Forgot password?
                </button>
              </div>

              <div style={{ position: "relative" }}>
                <input
                  id="password"
                  className="form-input"
                  type={showPass ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={loading}
                  style={{ paddingRight: "var(--space-10)" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute", right: "var(--space-2)", top: "50%",
                    transform: "translateY(-50%)", background: "none", border: "none",
                    cursor: "pointer", color: "var(--ink-muted)",
                    width: 28, height: 28, padding: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-primary)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-muted)"; }}
                >
                  {showPass ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn--primary btn--full btn--lg"
              style={{ marginTop: "var(--space-2)" }}
            >
              {loading ? (
                <>
                  <span className="btn__spinner" aria-hidden="true" />
                  Signing in…
                </>
              ) : "Sign in"}
            </button>
          </form>

          <div className="login-card__footer">
            Don't have an account?{" "}
            <button onClick={() => navigate("/register")}>Register here</button>
          </div>

          <div className="login-card__footer" style={{
            marginTop: "var(--space-3)",
            paddingTop: "var(--space-3)",
            borderTop: "1px solid var(--border-light)",
          }}>
            <button onClick={() => navigate("/about")}>About</button>
            {" · "}
            <button onClick={() => navigate("/contact")}>Contact</button>
            {" · "}
            <button onClick={() => navigate("/faq")}>FAQ</button>
          </div>
        </div>
        </main>
    </>
  );
}
