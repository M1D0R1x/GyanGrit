import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiPatch } from "../services/api";
import { ROLE_PATHS } from "../auth/authTypes";
import Logo from "../components/Logo";

type FieldErrors = {
  full_name?:     string;
  mobile_number?: string;
  email?:         string;
};

export default function CompleteProfilePage() {
  const auth     = useAuth();
  const navigate = useNavigate();

  const [fullName,  setFullName]  = useState(auth.user?.full_name    ?? "");
  const [mobile,    setMobile]    = useState(auth.user?.mobile_number ?? "");
  const [email,     setEmail]     = useState(auth.user?.email         ?? "");
  const [saving,    setSaving]    = useState(false);
  const [fieldErrs, setFieldErrs] = useState<FieldErrors>({});
  const [globalErr, setGlobalErr] = useState("");

  const role = auth.user?.role ?? "STUDENT";
  const needsEmail = ["TEACHER", "PRINCIPAL", "OFFICIAL"].includes(role);

  // If already complete, redirect immediately
  useEffect(() => {
    if (!auth.loading && auth.user?.profile_complete) {
      navigate(ROLE_PATHS[auth.user.role] ?? "/", { replace: true });
    }
  }, [auth.loading, auth.user, navigate]);

  // Not logged in at all → login
  useEffect(() => {
    if (!auth.loading && !auth.authenticated) {
      navigate("/login", { replace: true });
    }
  }, [auth.loading, auth.authenticated, navigate]);

  const handleSave = async () => {
    setFieldErrs({});
    setGlobalErr("");

    // Client-side validation before hitting the server
    const errs: FieldErrors = {};
    if (!fullName.trim())  errs.full_name     = "Full name is required.";
    if (!mobile.trim())    errs.mobile_number = "Mobile number is required.";
    if (needsEmail && !email.trim()) errs.email = "Email is required for your role.";

    if (Object.keys(errs).length > 0) {
      setFieldErrs(errs);
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, string> = {
        full_name:     fullName.trim(),
        mobile_number: mobile.trim(),
      };
      if (needsEmail || email.trim()) payload.email = email.trim();

      const res = await apiPatch<{
        profile_complete: boolean;
        full_name:        string;
        mobile_number:    string;
        email:            string;
        errors?:          FieldErrors;
      }>("/accounts/profile/", payload);

      if (res.errors) {
        setFieldErrs(res.errors);
        return;
      }

      // Refresh auth context so profile_complete = true propagates everywhere
      await auth.refresh();
      navigate(ROLE_PATHS[role] ?? "/", { replace: true });

    } catch (err: unknown) {
      // Try to parse field errors from response body
      const msg = err instanceof Error ? err.message : "";
      const jsonStart = msg.indexOf("{");
      if (jsonStart !== -1) {
        try {
          const parsed = JSON.parse(msg.slice(jsonStart));
          if (parsed.errors) { setFieldErrs(parsed.errors); return; }
          if (parsed.error)  { setGlobalErr(parsed.error);  return; }
        } catch { /* fall through */ }
      }
      setGlobalErr("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (auth.loading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading__logo">Gyan<span>Grit</span></div>
        <div className="auth-loading__spinner" />
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 440 }}>

        {/* Brand */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "var(--space-2)" }}>
          <Logo size="md" variant="full" />
        </div>

        <h2 style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-xl)",
          fontWeight: 700,
          color: "var(--text-primary)",
          textAlign: "center",
          marginBottom: "var(--space-2)",
        }}>
          Complete Your Profile
        </h2>

        <p style={{
          fontSize: "var(--text-sm)",
          color: "var(--text-muted)",
          textAlign: "center",
          marginBottom: "var(--space-6)",
          lineHeight: 1.5,
        }}>
          This information is required before you can access GyanGrit.
          {needsEmail && " Your email will be used for OTP verification."}
        </p>

        {/* Role badge */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "var(--space-5)",
        }}>
          <span style={{
            padding: "4px 14px",
            borderRadius: "var(--radius-full)",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            fontSize: "var(--text-xs)",
            fontWeight: 700,
            color: "var(--text-secondary)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}>
            {auth.user?.username} · {role}
          </span>
        </div>

        {globalErr && (
          <div className="alert alert--error" style={{ marginBottom: "var(--space-4)" }}>
            {globalErr}
          </div>
        )}

        <hr className="login-card__divider" />

        {/* Full name */}
        <div className="form-group">
          <label className="form-label" htmlFor="cp-fullname">
            Full Name *
          </label>
          <input
            id="cp-fullname"
            className={`form-input ${fieldErrs.full_name ? "form-input--error" : ""}`}
            type="text"
            placeholder="Your full legal name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={saving}
            autoComplete="name"
            autoFocus
          />
          {fieldErrs.full_name && (
            <span className="form-error">{fieldErrs.full_name}</span>
          )}
        </div>

        {/* Mobile */}
        <div className="form-group">
          <label className="form-label" htmlFor="cp-mobile">
            Mobile Number *
          </label>
          <input
            id="cp-mobile"
            className={`form-input ${fieldErrs.mobile_number ? "form-input--error" : ""}`}
            type="tel"
            placeholder="10-digit mobile number"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            disabled={saving}
            autoComplete="tel"
            inputMode="numeric"
          />
          {fieldErrs.mobile_number ? (
            <span className="form-error">{fieldErrs.mobile_number}</span>
          ) : (
            <span className="form-hint">
              Used for OTP verification on new devices
            </span>
          )}
        </div>

        {/* Email — required for teacher/principal/official, optional for student */}
        <div className="form-group">
          <label className="form-label" htmlFor="cp-email">
            Email Address {needsEmail ? "*" : <span style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)" }}>(optional)</span>}
          </label>
          <input
            id="cp-email"
            className={`form-input ${fieldErrs.email ? "form-input--error" : ""}`}
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={saving}
            autoComplete="email"
          />
          {fieldErrs.email ? (
            <span className="form-error">{fieldErrs.email}</span>
          ) : needsEmail ? (
            <span className="form-hint">
              Required for OTP login — use a personal or school email
            </span>
          ) : null}
        </div>

        {/* Privacy note */}
        <div style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-3) var(--space-4)",
          marginBottom: "var(--space-5)",
          display: "flex",
          gap: "var(--space-3)",
          alignItems: "flex-start",
        }}>
          <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>🔒</span>
          <p style={{
            fontSize: "var(--text-xs)",
            color: "var(--text-muted)",
            lineHeight: 1.5,
            margin: 0,
          }}>
            Your information is stored securely and only used for
            account verification. Mobile numbers are never shared with third parties.
          </p>
        </div>

        <button
          className="btn btn--primary btn--full btn--lg"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <>
              <span className="btn__spinner" aria-hidden="true" />
              Saving…
            </>
          ) : "Save & Continue"}
        </button>

        {/* Logout escape hatch — in case they registered under wrong code */}
        <div className="login-card__footer" style={{ marginTop: "var(--space-4)" }}>
          Wrong account?{" "}
          <button
            onClick={async () => {
              try { await apiPatch("/accounts/logout/", {}); } catch { /* ignore */ }
              window.location.href = "/login";
            }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--brand-primary)", fontSize: "inherit" }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}