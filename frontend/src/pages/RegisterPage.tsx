import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost } from "../services/api";

interface ValidateJoinCodeResponse {
  valid: boolean;
  role: string;
  institution?: string | null;
  section?: string | null;
  district?: string | null;
}

/**
 * Parses the raw error string from api.ts and returns a clean human-readable message.
 * api.ts throws: "API POST error: 400 - {"error":"Invalid join code"}"
 */
function parseApiError(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const msg = err.message;
  // Try to extract the JSON payload from the error string
  const jsonStart = msg.indexOf("{");
  if (jsonStart !== -1) {
    try {
      const payload = JSON.parse(msg.slice(jsonStart));
      if (payload.error) return payload.error;
      if (payload.detail) return payload.detail;
    } catch {
      // fall through to raw message
    }
  }
  return fallback;
}

export default function RegisterPage() {
  const navigate = useNavigate();

  const [username, setUsername]         = useState("");
  const [password, setPassword]         = useState("");
  const [joinCode, setJoinCode]         = useState("");
  const [detectedRole, setDetectedRole] = useState<string | null>(null);
  const [detectedInfo, setDetectedInfo] = useState<ValidateJoinCodeResponse | null>(null);
  const [validating, setValidating]     = useState(false);
  const [validationError, setValidationError] = useState("");
  const [success, setSuccess]           = useState("");
  const [error, setError]               = useState("");
  const [loading, setLoading]           = useState(false);

  useEffect(() => {
    if (joinCode.length < 8) {
      setDetectedRole(null);
      setDetectedInfo(null);
      setValidationError("");
      return;
    }

    const timeout = setTimeout(async () => {
      setValidating(true);
      setValidationError("");

      try {
        const res = await apiPost<ValidateJoinCodeResponse>(
          "/accounts/validate-join-code/",
          { join_code: joinCode }
        );
        setDetectedRole(res.role);
        setDetectedInfo(res);
      } catch (err: unknown) {
        // Parse the clean error message from the API response
        const message = parseApiError(err, "Invalid or expired join code");
        setValidationError(message);
        setDetectedRole(null);
        setDetectedInfo(null);
      } finally {
        setValidating(false);
      }
    }, 600);

    return () => clearTimeout(timeout);
  }, [joinCode]);

  const handleRegister = async () => {
    if (!username || !password || !joinCode) {
      setError("Username, password and join code are required.");
      return;
    }
    if (!detectedRole) {
      setError("Please enter a valid join code first.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await apiPost("/accounts/register/", {
        username,
        password,
        join_code: joinCode,
      });
      setSuccess("Account created! Redirecting to login…");
      setTimeout(() => navigate("/login"), 1800);
    } catch (err: unknown) {
      setError(parseApiError(err, "Registration failed. Please check your join code."));
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
        <p className="login-card__tagline">Create your account</p>

        <hr className="login-card__divider" />

        {success && (
          <div className="alert alert--success" role="status">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {success}
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

        <div className="form-group">
          <label className="form-label" htmlFor="reg-username">Username</label>
          <input
            id="reg-username"
            className="form-input"
            type="text"
            placeholder="Choose a username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="reg-password">Password</label>
          <input
            id="reg-password"
            className="form-input"
            type="password"
            placeholder="Choose a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="reg-joincode">
            Join Code
          </label>
          <input
            id="reg-joincode"
            className="form-input"
            type="text"
            placeholder="Paste your join code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            disabled={loading}
            style={{
              borderColor: detectedRole
                ? "var(--success)"
                : validationError
                ? "var(--error)"
                : undefined,
            }}
          />
          <span style={{
            display: "block",
            fontSize: "var(--text-xs)",
            color: "var(--ink-muted)",
            marginTop: "var(--space-2)",
          }}>
            Provided by your teacher, principal, or admin
          </span>

          {validating && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              marginTop: "var(--space-2)",
              fontSize: "var(--text-xs)",
              color: "var(--ink-muted)",
            }}>
              <span className="btn__spinner" style={{ width: 10, height: 10 }} />
              Validating…
            </div>
          )}

          {detectedRole && detectedInfo && (
            <div className="alert alert--success" style={{ marginTop: "var(--space-3)", padding: "var(--space-3) var(--space-4)" }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: "var(--space-1)" }}>
                  ✓ Valid code — you will join as <strong>{detectedRole}</strong>
                </div>
                {detectedInfo.institution && (
                  <div style={{ fontSize: "var(--text-xs)", opacity: 0.9 }}>
                    Institution: {detectedInfo.institution}
                  </div>
                )}
                {detectedInfo.section && (
                  <div style={{ fontSize: "var(--text-xs)", opacity: 0.9 }}>
                    Section: {detectedInfo.section}
                  </div>
                )}
                {detectedInfo.district && (
                  <div style={{ fontSize: "var(--text-xs)", opacity: 0.9 }}>
                    District: {detectedInfo.district}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Clean error message — no raw API string */}
          {validationError && !detectedRole && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              marginTop: "var(--space-2)",
              fontSize: "var(--text-xs)",
              color: "var(--error)",
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {validationError}
            </div>
          )}
        </div>

        <button
          onClick={handleRegister}
          disabled={loading || !detectedRole || validating}
          className="btn btn--primary btn--full btn--lg"
        >
          {loading ? (
            <>
              <span className="btn__spinner" aria-hidden="true" />
              Creating Account…
            </>
          ) : (
            "Create Account"
          )}
        </button>

        <div className="login-card__footer">
          Already have an account?{" "}
          <button onClick={() => navigate("/login")}>Sign in</button>
        </div>
      </div>
    </div>
  );
}