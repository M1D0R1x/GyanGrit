import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiPost } from "../services/api";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { uidb64, token } = useParams<{ uidb64: string; token: string }>();

  const [newPassword, setNewPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading]                 = useState(false);
  const [success, setSuccess]                 = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [showNew, setShowNew]                 = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);

  // Redirect if params are missing (someone navigated here directly)
  useEffect(() => {
    if (!uidb64 || !token) {
      navigate("/login", { replace: true });
    }
  }, [uidb64, token, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await apiPost("/accounts/reset-password/", {
        uidb64,
        token,
        new_password: newPassword,
      });
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid or expired link. Please request a new one.");
    } finally {
      setLoading(false);
    }
  };

  const EyeIcon = ({ open }: { open: boolean }) => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {open ? (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </>
      ) : (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card__brand">
          Gyan<span>Grit</span>
        </div>
        <p className="login-card__tagline">Set New Password</p>
        <hr className="login-card__divider" />

        {success ? (
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
              <p style={{ margin: 0, fontWeight: 600, color: "var(--text-primary)" }}>
                Password updated!
              </p>
              <p style={{ margin: "var(--space-2) 0 0", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                Your password has been changed. Please log in with your new password.
              </p>
            </div>
            <button
              className="btn btn--primary btn--full"
              onClick={() => navigate("/login", { replace: true })}
            >
              Go to Login
            </button>
          </div>
        ) : (
          <>
            <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-5)", fontSize: "0.9rem" }}>
              Choose a strong new password for your GyanGrit account.
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
                <label className="form-label" htmlFor="new-password">New Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    id="new-password"
                    className="form-input"
                    type={showNew ? "text" : "password"}
                    placeholder="At least 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    disabled={loading}
                    style={{ paddingRight: "2.75rem" }}
                  />
                  <button
                    type="button"
                    aria-label={showNew ? "Hide password" : "Show password"}
                    onClick={() => setShowNew((p) => !p)}
                    style={{
                      position: "absolute", right: "0.75rem", top: "50%",
                      transform: "translateY(-50%)", background: "none",
                      border: "none", cursor: "pointer", color: "var(--text-muted)",
                      display: "flex", alignItems: "center", padding: 0,
                    }}
                  >
                    <EyeIcon open={showNew} />
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="confirm-password">Confirm Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    id="confirm-password"
                    className="form-input"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Re-enter your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    disabled={loading}
                    style={{ paddingRight: "2.75rem" }}
                  />
                  <button
                    type="button"
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                    onClick={() => setShowConfirm((p) => !p)}
                    style={{
                      position: "absolute", right: "0.75rem", top: "50%",
                      transform: "translateY(-50%)", background: "none",
                      border: "none", cursor: "pointer", color: "var(--text-muted)",
                      display: "flex", alignItems: "center", padding: 0,
                    }}
                  >
                    <EyeIcon open={showConfirm} />
                  </button>
                </div>
              </div>

              {/* Strength hint */}
              {newPassword.length > 0 && (
                <p style={{
                  fontSize: "0.8rem",
                  marginTop: "calc(var(--space-2) * -1)",
                  marginBottom: "var(--space-4)",
                  color: newPassword.length >= 8 ? "var(--success, #16a34a)" : "var(--warning, #d97706)",
                }}>
                  {newPassword.length < 8
                    ? `${8 - newPassword.length} more character${8 - newPassword.length !== 1 ? "s" : ""} required`
                    : "✓ Minimum length met"}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn btn--primary btn--full btn--lg"
                style={{ marginTop: "var(--space-2)" }}
              >
                {loading ? (
                  <>
                    <span className="btn__spinner" aria-hidden="true" />
                    Updating...
                  </>
                ) : (
                  "Update Password"
                )}
              </button>
            </form>

            <div className="login-card__footer">
              <button onClick={() => navigate("/login")}>Back to Login</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
