import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiPatch } from "../services/api";
import { ROLE_PATHS } from "../auth/authTypes";
import Logo from "../components/Logo";

type FieldErrors = {
  first_name?:       string;
  middle_name?:      string;
  last_name?:        string;
  email?:            string;
  mobile_primary?:   string;
  mobile_secondary?: string;
};

export default function CompleteProfilePage() {
  const auth     = useAuth();
  const navigate = useNavigate();

  const [firstName,       setFirstName]       = useState(auth.user?.first_name       ?? "");
  const [middleName,      setMiddleName]      = useState(auth.user?.middle_name      ?? "");
  const [lastName,        setLastName]        = useState(auth.user?.last_name        ?? "");
  const [email,           setEmail]           = useState(auth.user?.email            ?? "");
  const [mobilePrimary,   setMobilePrimary]   = useState(auth.user?.mobile_primary   ?? "");
  const [mobileSecondary, setMobileSecondary] = useState(auth.user?.mobile_secondary ?? "");
  const [saving,          setSaving]          = useState(false);
  const [fieldErrs,       setFieldErrs]       = useState<FieldErrors>({});
  const [globalErr,       setGlobalErr]       = useState("");

  const role = auth.user?.role ?? "STUDENT";

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

    // Client-side pre-validation
    const errs: FieldErrors = {};
    if (!firstName.trim())      errs.first_name     = "First name is required.";
    if (!lastName.trim())       errs.last_name      = "Last name is required.";
    if (!email.trim())          errs.email           = "Email is required.";
    if (!mobilePrimary.trim())  errs.mobile_primary  = "Primary mobile number is required.";

    // Validate mobile format client-side
    if (mobilePrimary.trim()) {
      const digits = mobilePrimary.replace(/\D/g, "");
      if (digits.length < 10) errs.mobile_primary = "Enter a valid 10-digit mobile number.";
    }
    if (mobileSecondary.trim()) {
      const digits = mobileSecondary.replace(/\D/g, "");
      if (digits.length < 10) errs.mobile_secondary = "Enter a valid 10-digit mobile number.";
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrs(errs);
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, string> = {
        first_name:     firstName.trim(),
        last_name:      lastName.trim(),
        email:          email.trim(),
        mobile_primary: mobilePrimary.trim(),
      };
      // Only send optional fields if they have values
      if (middleName.trim())      payload.middle_name      = middleName.trim();
      if (mobileSecondary.trim()) payload.mobile_secondary = mobileSecondary.trim();

      const res = await apiPatch<{
        profile_complete:  boolean;
        first_name:        string;
        middle_name:       string;
        last_name:         string;
        display_name:      string;
        email:             string;
        mobile_primary:    string;
        mobile_secondary:  string;
        errors?:           FieldErrors;
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
      <div className="login-card" style={{ maxWidth: 480 }}>

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
          We need your details to set up your account.
          Fields marked * are required.
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

        {/* ── Name fields ─────────────────────────────────────────────────── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--space-4)",
        }}>
          {/* First name */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="cp-firstname">
              First Name *
            </label>
            <input
              id="cp-firstname"
              className={`form-input ${fieldErrs.first_name ? "form-input--error" : ""}`}
              type="text"
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={saving}
              autoComplete="given-name"
              autoFocus
            />
            {fieldErrs.first_name && (
              <span className="form-error">{fieldErrs.first_name}</span>
            )}
          </div>

          {/* Last name */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="cp-lastname">
              Last Name *
            </label>
            <input
              id="cp-lastname"
              className={`form-input ${fieldErrs.last_name ? "form-input--error" : ""}`}
              type="text"
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={saving}
              autoComplete="family-name"
            />
            {fieldErrs.last_name && (
              <span className="form-error">{fieldErrs.last_name}</span>
            )}
          </div>
        </div>

        {/* Middle name — full width, optional */}
        <div className="form-group">
          <label className="form-label" htmlFor="cp-middlename">
            Middle Name{" "}
            <span style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)" }}>(optional)</span>
          </label>
          <input
            id="cp-middlename"
            className="form-input"
            type="text"
            placeholder="Middle name"
            value={middleName}
            onChange={(e) => setMiddleName(e.target.value)}
            disabled={saving}
            autoComplete="additional-name"
          />
        </div>

        {/* ── Email ───────────────────────────────────────────────────────── */}
        <div className="form-group">
          <label className="form-label" htmlFor="cp-email">
            Email Address *
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
          ) : (
            <span className="form-hint">
              Used for account verification and report sharing
            </span>
          )}
        </div>

        {/* ── Mobile numbers ──────────────────────────────────────────────── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--space-4)",
        }}>
          {/* Primary mobile */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="cp-mobile1">
              Mobile 1 *
            </label>
            <input
              id="cp-mobile1"
              className={`form-input ${fieldErrs.mobile_primary ? "form-input--error" : ""}`}
              type="tel"
              placeholder="Parent / guardian"
              value={mobilePrimary}
              onChange={(e) => setMobilePrimary(e.target.value)}
              disabled={saving}
              autoComplete="tel"
              inputMode="numeric"
            />
            {fieldErrs.mobile_primary ? (
              <span className="form-error">{fieldErrs.mobile_primary}</span>
            ) : (
              <span className="form-hint">Parent / guardian number</span>
            )}
          </div>

          {/* Secondary mobile */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="cp-mobile2">
              Mobile 2{" "}
              <span style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)" }}>(opt.)</span>
            </label>
            <input
              id="cp-mobile2"
              className={`form-input ${fieldErrs.mobile_secondary ? "form-input--error" : ""}`}
              type="tel"
              placeholder="Student / 2nd parent"
              value={mobileSecondary}
              onChange={(e) => setMobileSecondary(e.target.value)}
              disabled={saving}
              autoComplete="tel"
              inputMode="numeric"
            />
            {fieldErrs.mobile_secondary ? (
              <span className="form-error">{fieldErrs.mobile_secondary}</span>
            ) : (
              <span className="form-hint">Student or 2nd parent</span>
            )}
          </div>
        </div>

        {/* Privacy note */}
        <div style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-3) var(--space-4)",
          marginTop: "var(--space-4)",
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
            Your information is stored securely and used only for
            account verification and sharing progress reports.
            Contact numbers are never shared with third parties.
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