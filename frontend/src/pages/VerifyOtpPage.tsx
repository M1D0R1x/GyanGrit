import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiPost } from "../services/api";
import { useAuth } from "../auth/AuthContext";
import { ROLE_PATHS } from "../auth/authTypes";
import type { Role } from "../auth/authTypes";

type OtpLocationState = { username: string; otp_channel?: string };
type VerifyOtpResponse = { success: true; role: Role };
type ResendResponse = { resent: boolean; otp_channel: string };

const RESEND_COOLDOWN = 60; // seconds

export default function VerifyOtpPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const auth      = useAuth();

  const state    = location.state as OtpLocationState | undefined;
  const username = state?.username;

  const [otp, setOtp]               = useState("");
  const [error, setError]           = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);
  const [resending, setResending]   = useState(false);
  const [resendMsg, setResendMsg]   = useState<string | null>(null);
  const [countdown, setCountdown]   = useState(RESEND_COOLDOWN);
  const [channel, setChannel]       = useState(state?.otp_channel ?? "email");

  // Countdown timer — ticks every second, enables resend button at 0
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleResend = useCallback(async () => {
    if (!username || countdown > 0) return;
    setResending(true);
    setError(null);
    setResendMsg(null);

    try {
      const res = await apiPost<ResendResponse>("/accounts/resend-otp/", { username });
      setChannel(res.otp_channel);
      setCountdown(RESEND_COOLDOWN);
      setResendMsg(
        res.otp_channel === "sms"
          ? "A new OTP has been sent to your phone."
          : res.otp_channel === "email"
            ? "A new OTP has been sent to your email."
            : "A new OTP has been generated. Check with your administrator."
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to resend OTP.";
      // Extract retry_after from 429 response if present
      if (msg.includes("429")) {
        setCountdown(30); // fallback cooldown
      }
      setError(msg.includes("{") ? "Please wait before requesting a new OTP." : msg);
    } finally {
      setResending(false);
    }
  }, [username, countdown]);

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
    setResendMsg(null);

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
          border: "1px solid var(--border-medium)",
          borderRadius: "var(--radius-sm)",
          padding: "var(--space-3) var(--space-4)",
          marginBottom: "var(--space-6)",
          fontSize: "var(--text-sm)",
          color: "var(--ink-secondary)",
        }}>
          Verifying as <strong style={{ color: "var(--ink-primary)" }}>{username}</strong>
          {channel && (
            <span style={{ display: "block", marginTop: 4, fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
              OTP sent via {channel === "sms" ? "SMS" : channel === "email" ? "email" : "system log"}
            </span>
          )}
        </div>

        {resendMsg && (
          <div className="alert alert--success" role="status" style={{ marginBottom: "var(--space-4)" }}>
            {resendMsg}
          </div>
        )}

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

        {/* Resend OTP with countdown */}
        <div style={{ textAlign: "center", marginTop: "var(--space-5)" }}>
          {countdown > 0 ? (
            <span style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>
              Resend OTP in <strong style={{ color: "var(--ink-secondary)" }}>{countdown}s</strong>
            </span>
          ) : (
            <button
              type="button"
              disabled={resending}
              onClick={handleResend}
              style={{
                background: "none",
                border: "none",
                color: "var(--saffron)",
                cursor: resending ? "wait" : "pointer",
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                textDecoration: "underline",
                padding: 0,
              }}
            >
              {resending ? "Sending…" : "Resend OTP"}
            </button>
          )}
        </div>

        <div className="login-card__footer" style={{ marginTop: "var(--space-4)" }}>
          <button onClick={() => navigate("/login")}>
            ← Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
