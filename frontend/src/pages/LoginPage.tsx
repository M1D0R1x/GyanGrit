import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost } from "../services/api";
import { useAuth } from "../auth/AuthContext";
import type { Role } from "../auth/authTypes";

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

// Safari blocks cross-site cookies by default (ITP). Since the API is on
// a different domain (gyangrit.onrender.com), session cookies get blocked.
// Detect and show a warning.
function isSafari(): boolean {
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/Chrome/.test(ua) && !/Chromium/.test(ua);
}

export default function LoginPage() {
  const navigate = useNavigate();
  const auth = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    auth.clearKicked();

    try {
      const response = await apiPost<LoginApiResponse>("/accounts/login/", {
        username,
        password,
      });

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
      const message = err instanceof Error ? err.message : "Login failed. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card__brand">
          Gyan<span>Grit</span>
        </div>
        <p className="login-card__tagline">
          Empowering rural students, one lesson at a time
        </p>

        <hr className="login-card__divider" />

        {isSafari() && (
          <div className="alert alert--warning" role="alert" style={{ marginBottom: "var(--space-4)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Safari may block login due to cross-site cookie restrictions. Please use Chrome or Edge for the best experience.
          </div>
        )}

        {auth.kickedMessage && (
          <div className="alert alert--warning" role="alert" style={{ marginBottom: "var(--space-4)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            {auth.kickedMessage}
          </div>
        )}

        {error && (
          <div className="alert alert--error" role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="username">
              Username
            </label>
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
            <label className="form-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="form-input"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              disabled={loading}
            />
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
                Signing in
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <div className="login-card__footer">
          Don't have an account?{" "}
          <button onClick={() => navigate("/register")}>
            Register here
          </button>
        </div>
      </div>
    </div>
  );
}