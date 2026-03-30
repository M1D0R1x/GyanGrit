import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost } from "../services/api";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading]       = useState(false);
  const [sent, setSent]             = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    setLoading(true);
    setError(null);

    try {
      await apiPost("/accounts/forgot-password/", { username: identifier });
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
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
        <p className="login-card__tagline">Password Recovery</p>
        <hr className="login-card__divider" />

        {sent ? (
          <div style={{ textAlign: "center", padding: "var(--space-4) 0" }}>
            <div style={{
              background: "var(--success-bg, #f0fdf4)",
              border: "1px solid var(--success-border, #bbf7d0)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-5)",
              marginBottom: "var(--space-5)",
            }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
                stroke="var(--success, #16a34a)" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
                style={{ display: "block", margin: "0 auto var(--space-3)" }}>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <p style={{ margin: 0, fontWeight: 600, color: "var(--ink-primary)" }}>
                Check your email
              </p>
              <p style={{ margin: "var(--space-2) 0 0", fontSize: "0.9rem", color: "var(--ink-secondary)" }}>
                If an account with that username or email exists, we've sent a reset link. Check your inbox (and spam folder).
              </p>
            </div>
            <button
              className="btn btn--ghost btn--full"
              onClick={() => navigate("/login")}
            >
              Back to Login
            </button>
          </div>
        ) : (
          <>
            <p style={{ color: "var(--ink-secondary)", marginBottom: "var(--space-5)", fontSize: "0.9rem" }}>
              Enter your username or email address and we'll send a password reset link.
            </p>

            {error && (
              <div className="alert alert--error" role="alert" style={{ marginBottom: "var(--space-4)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="identifier">
                  Username or Email
                </label>
                <input
                  id="identifier"
                  className="form-input"
                  type="text"
                  placeholder="Enter your username or email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                  required
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading || !identifier.trim()}
                className="btn btn--primary btn--full btn--lg"
                style={{ marginTop: "var(--space-2)" }}
              >
                {loading ? (
                  <>
                    <span className="btn__spinner" aria-hidden="true" />
                    Sending...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </button>
            </form>

            <div className="login-card__footer">
              <button onClick={() => navigate("/login")}>
                Back to Login
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
