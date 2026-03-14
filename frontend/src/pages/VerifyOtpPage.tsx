import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiPost } from "../services/api";
import { useAuth } from "../auth/AuthContext";
import { ROLE_PATHS } from "../auth/authTypes";
import type { Role } from "../auth/authTypes";

type OtpLocationState = { username: string };
type VerifyOtpResponse = { success: true; role: Role };

export default function VerifyOtpPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const auth      = useAuth();

  const state    = location.state as OtpLocationState | undefined;
  const username = state?.username;

  const [otp, setOtp]       = useState("");
  const [error, setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!username) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-card__brand">Gyan<span>Grit</span></div>
          <div className="alert alert--error" style={{ marginTop: "var(--space-6)" }}>
            Invalid session. Please log in again.
          </div>
          <button
            className="btn btn--primary btn--full"
            style={{ marginTop: "var(--space-4)" }}
            onClick={() => navigate("/login")}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await apiPost<VerifyOtpResponse>(
        "/accounts/verify-otp/",
        { username, otp }
      );
      await auth.refresh();
      navigate(ROLE_PATHS[response.role] ?? "/", { replace: true });
    } catch {
      setError("Invalid OTP. Please check the code and try again.");
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
          Enter the 6-digit code to verify your identity
        </p>

        <hr className="login-card__divider" />

        <div style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-sm)",
          padding: "var(--space-3) var(--space-4)",
          marginBottom: "var(--space-6)",
          fontSize: "var(--text-sm)",
          color: "var(--text-secondary)",
        }}>
          Verifying as <strong style={{ color: "var(--text-primary)" }}>{username}</strong>
        </div>

        {error && (
          <div className="alert alert--error" role="alert" style={{ marginBottom: "var(--space-4)" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="otp-input">
              One-Time Password
            </label>
            <input
              id="otp-input"
              className="form-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
              disabled={loading}
              autoComplete="one-time-code"
              style={{
                textAlign: "center",
                fontSize: "var(--text-2xl)",
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                letterSpacing: "0.3em",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading || otp.length !== 6}
            className="btn btn--primary btn--full btn--lg"
          >
            {loading ? (
              <>
                <span className="btn__spinner" aria-hidden="true" />
                Verifying…
              </>
            ) : (
              "Verify OTP"
            )}
          </button>
        </form>

        <div className="login-card__footer" style={{ marginTop: "var(--space-6)" }}>
          <button onClick={() => navigate("/login")}>
            ← Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}