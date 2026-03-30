// pages.ProfilePage
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getMySummary, type MySummary } from "../services/gamification";
import { getStudentGrades, type GradeEntry } from "../services/gradebook";
import { apiPatch, apiPost } from "../services/api";
import TopBar from "../components/TopBar";
import LogoutButton from "../components/LogoutButton";
import BottomNav from "../components/BottomNav";

// ── Types ──────────────────────────────────────────────────────────────────

type EditFields = {
  first_name:       string;
  middle_name:      string;
  last_name:        string;
  email:            string;
  mobile_primary:   string;
  mobile_secondary: string;
};

type EditErrors = Partial<Record<keyof EditFields, string>>;

// ── Helpers ────────────────────────────────────────────────────────────────

function pctColor(pct: number) {
  if (pct >= 70) return "var(--success)";
  if (pct >= 40) return "var(--warning)";
  return "var(--error)";
}

function humanLabel(raw: string) {
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ProfileField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div style={{
      display:        "flex",
      justifyContent: "space-between",
      alignItems:     "center",
      padding:        "var(--space-4) 0",
      borderBottom:   "1px solid var(--border-light)",
    }}>
      <span style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)", fontWeight: 500, minWidth: 140 }}>
        {label}
      </span>
      <span style={{
        fontSize:  "var(--text-sm)",
        color:     value ? "var(--ink-primary)" : "var(--ink-muted)",
        fontWeight: value ? 500 : 400,
        fontStyle:  value ? "normal" : "italic",
      }}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function FormField({
  label, name, value, error, required, type = "text", onChange,
}: {
  label:     string;
  name:      keyof EditFields;
  value:     string;
  error?:    string;
  required?: boolean;
  type?:     string;
  onChange:  (name: keyof EditFields, val: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", marginBottom: "var(--space-4)" }}>
      <label
        htmlFor={`profile-${name}`}
        style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}
      >
        {label}{required && <span style={{ color: "var(--error)", marginLeft: 2 }}>*</span>}
      </label>
      <input
        id={`profile-${name}`}
        type={type}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        className={`form-input${error ? " form-input--error" : ""}`}
        placeholder={label}
        autoComplete="off"
      />
      {error && (
        <span style={{ fontSize: "var(--text-xs)", color: "var(--error)" }}>{error}</span>
      )}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="card">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "var(--space-4) 0", borderBottom: "1px solid var(--border-light)" }}>
          <div className="skeleton skeleton-line" style={{ width: 100, height: 14 }} />
          <div className="skeleton skeleton-line" style={{ width: 160, height: 14 }} />
        </div>
      ))}
    </div>
  );
}

// ── Grades section (students only) ────────────────────────────────────────

function GradesSection({ studentId }: { studentId: number }) {
  const [entries,  setEntries]  = useState<GradeEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    getStudentGrades(studentId)
      .then((d) => setEntries(d.entries))
      .catch(() => { /* non-fatal — section stays empty */ })
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) {
    return (
      <div style={{ marginTop: "var(--space-8)" }}>
        <div className="section-header" style={{ marginBottom: "var(--space-4)" }}>
          <h3 className="section-header__title">My Grades</h3>
        </div>
        <div className="skeleton" style={{ height: 80, borderRadius: "var(--radius-lg)" }} />
      </div>
    );
  }

  if (entries.length === 0) return null;

  // Group by subject
  const bySubject: Record<string, GradeEntry[]> = {};
  entries.forEach((e) => {
    if (!bySubject[e.subject]) bySubject[e.subject] = [];
    bySubject[e.subject].push(e);
  });

  const subjectKeys = Object.keys(bySubject).sort();
  const shownKeys   = expanded ? subjectKeys : subjectKeys.slice(0, 3);

  // Overall average
  const avgPct = Math.round(
    entries.reduce((s, e) => s + e.percentage, 0) / entries.length
  );

  return (
    <div style={{ marginTop: "var(--space-8)" }}>
      <div className="section-header" style={{ marginBottom: "var(--space-4)" }}>
        <div>
          <h3 className="section-header__title">My Grades</h3>
          <p className="section-header__subtitle">
            {entries.length} mark{entries.length !== 1 ? "s" : ""} across {subjectKeys.length} subject{subjectKeys.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{
          fontFamily: "var(--font-display)", fontWeight: 800,
          fontSize: "var(--text-2xl)", color: pctColor(avgPct),
        }}>
          {avgPct}%
          <div style={{ fontSize: "var(--text-xs)", fontWeight: 500, color: "var(--ink-muted)", textAlign: "right" }}>avg</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {shownKeys.map((subject) => {
          const subEntries = bySubject[subject];
          const subAvg     = Math.round(subEntries.reduce((s, e) => s + e.percentage, 0) / subEntries.length);
          return (
            <div key={subject} className="card" style={{ padding: "var(--space-4) var(--space-5)" }}>
              {/* Subject header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
                <span style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--ink-primary)" }}>
                  {subject}
                </span>
                <span style={{
                  fontFamily: "var(--font-display)", fontWeight: 800,
                  fontSize: "var(--text-lg)", color: pctColor(subAvg),
                }}>
                  {subAvg}%
                </span>
              </div>
              {/* Progress bar */}
              <div className="progress-bar" style={{ marginBottom: "var(--space-3)" }}>
                <div className="progress-bar__fill" style={{ width: `${subAvg}%`, background: pctColor(subAvg) }} />
              </div>
              {/* Entry rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {subEntries.map((e) => (
                  <div key={e.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    fontSize: "var(--text-xs)", color: "var(--ink-muted)",
                  }}>
                    <span>{humanLabel(e.term)} · {humanLabel(e.category)}</span>
                    <span style={{ fontWeight: 700, color: pctColor(e.percentage) }}>
                      {e.marks}/{e.total_marks} ({e.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {subjectKeys.length > 3 && (
        <button
          className="btn btn--secondary"
          style={{ marginTop: "var(--space-3)", width: "100%", justifyContent: "center" }}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : `Show all ${subjectKeys.length} subjects`}
        </button>
      )}
    </div>
  );
}

// ── Change Password card ───────────────────────────────────────────────────

function ChangePasswordCard() {
  const [open,        setOpen]        = useState(false);
  const [oldPw,       setOldPw]       = useState("");
  const [newPw,       setNewPw]       = useState("");
  const [confirmPw,   setConfirmPw]   = useState("");
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [success,     setSuccess]     = useState(false);
  const [showOld,     setShowOld]     = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const reset = () => {
    setOldPw(""); setNewPw(""); setConfirmPw("");
    setError(null); setShowOld(false); setShowNew(false); setShowConfirm(false);
  };

  const handleToggle = () => {
    if (open) reset();
    setOpen((v) => !v);
    setSuccess(false);
  };

  const EyeBtn = ({ show, toggle, label }: { show: boolean; toggle: () => void; label: string }) => (
    <button
      type="button"
      aria-label={label}
      onClick={toggle}
      style={{
        position: "absolute", right: "0.75rem", top: "50%",
        transform: "translateY(-50%)", background: "none",
        border: "none", cursor: "pointer", color: "var(--ink-muted)",
        display: "flex", alignItems: "center", padding: 0,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {show ? (
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
    </button>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPw.length < 8)    { setError("New password must be at least 8 characters."); return; }
    if (newPw !== confirmPw) { setError("Passwords do not match."); return; }
    if (newPw === oldPw)     { setError("New password must differ from current."); return; }
    setSaving(true);
    try {
      await apiPost("/accounts/change-password/", { old_password: oldPw, new_password: newPw });
      setSuccess(true);
      setOpen(false);
      reset();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = { paddingRight: "2.5rem" };

  return (
    <div className="card" style={{ marginTop: "var(--space-6)", padding: "var(--space-5)" }}>
      <button
        type="button"
        onClick={handleToggle}
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--ink-primary)" }}>
          🔑 Change Password
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="var(--ink-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {success && !open && (
        <div className="alert alert--success" role="alert" style={{ marginTop: "var(--space-4)" }}>
          ✓ Password changed successfully
        </div>
      )}

      {open && (
        <form onSubmit={(e) => void handleSubmit(e)} noValidate style={{ marginTop: "var(--space-5)" }}>
          {error && (
            <div className="alert alert--error" role="alert" style={{ marginBottom: "var(--space-4)" }}>
              {error}
            </div>
          )}

          {[
            { id: "cp-old",     label: "Current Password", val: oldPw,     setVal: setOldPw,     show: showOld,     setShow: setShowOld,     ac: "current-password" },
            { id: "cp-new",     label: "New Password",     val: newPw,     setVal: setNewPw,     show: showNew,     setShow: setShowNew,     ac: "new-password" },
            { id: "cp-confirm", label: "Confirm New",      val: confirmPw, setVal: setConfirmPw, show: showConfirm, setShow: setShowConfirm, ac: "new-password" },
          ].map(({ id, label, val, setVal, show, setShow, ac }) => (
            <div key={id} style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", marginBottom: "var(--space-4)" }}>
              <label htmlFor={id} style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {label}
              </label>
              <div style={{ position: "relative" }}>
                <input id={id} className="form-input"
                  type={show ? "text" : "password"}
                  value={val}
                  onChange={(e) => setVal(e.target.value)}
                  style={inputStyle} disabled={saving} autoComplete={ac} />
                <EyeBtn show={show} toggle={() => setShow((p) => !p)} label={show ? "Hide" : "Show"} />
              </div>
            </div>
          ))}

          <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-2)" }}>
            <button type="submit" className="btn btn--primary" style={{ flex: 1, justifyContent: "center" }}
              disabled={saving || !oldPw || !newPw || !confirmPw}>
              {saving ? <><span className="btn__spinner" aria-hidden="true" />Saving…</> : "Update Password"}
            </button>
            <button type="button" className="btn btn--secondary" style={{ flex: 1, justifyContent: "center" }}
              onClick={handleToggle} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const auth     = useAuth();
  const navigate = useNavigate();
  const user     = auth.user;

  const [gamification, setGamification] = useState<MySummary | null>(null);
  const [editing,      setEditing]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [saveError,    setSaveError]    = useState<string | null>(null);
  const [saveSuccess,  setSaveSuccess]  = useState(false);
  const [fields,       setFields]       = useState<EditFields>({
    first_name: "", middle_name: "", last_name: "",
    email: "", mobile_primary: "", mobile_secondary: "",
  });
  const [errors, setErrors] = useState<EditErrors>({});

  // Load gamification — students only
  useEffect(() => {
    if (user?.role !== "STUDENT") return;
    let cancelled = false;
    async function load() {
      try {
        const data = await getMySummary();
        if (!cancelled) setGamification(data);
      } catch { /* non-fatal */ }
    }
    void load();
    return () => { cancelled = true; };
  }, [user?.role]);

  // Populate form fields when user data is available
  useEffect(() => {
    if (!user) return;
    setFields({
      first_name:       user.first_name       ?? "",
      middle_name:      user.middle_name      ?? "",
      last_name:        user.last_name        ?? "",
      email:            user.email            ?? "",
      mobile_primary:   user.mobile_primary   ?? "",
      mobile_secondary: user.mobile_secondary ?? "",
    });
  }, [user]);

  const handleChange = (name: keyof EditFields, val: string) => {
    setFields((prev) => ({ ...prev, [name]: val }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validate = (): boolean => {
    const errs: EditErrors = {};
    if (!fields.first_name.trim())     errs.first_name     = "First name is required";
    if (!fields.last_name.trim())      errs.last_name      = "Last name is required";
    if (!fields.email.trim())          errs.email          = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email))
                                       errs.email          = "Enter a valid email address";
    if (!fields.mobile_primary.trim()) errs.mobile_primary = "Primary mobile is required";
    else if (!/^\d{10}$/.test(fields.mobile_primary.replace(/\s/g, "")))
                                       errs.mobile_primary = "Enter a 10-digit mobile number";
    if (fields.mobile_secondary.trim() && !/^\d{10}$/.test(fields.mobile_secondary.replace(/\s/g, "")))
                                       errs.mobile_secondary = "Enter a 10-digit mobile number";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setSaveError(null);
    try {
      await apiPatch("/accounts/profile/", {
        first_name:       fields.first_name.trim(),
        middle_name:      fields.middle_name.trim() || "",
        last_name:        fields.last_name.trim(),
        email:            fields.email.trim(),
        mobile_primary:   fields.mobile_primary.trim(),
        mobile_secondary: fields.mobile_secondary.trim() || "",
      });
      await auth.refresh();
      setEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save changes.";
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setErrors({});
    setSaveError(null);
    if (user) {
      setFields({
        first_name:       user.first_name       ?? "",
        middle_name:      user.middle_name      ?? "",
        last_name:        user.last_name        ?? "",
        email:            user.email            ?? "",
        mobile_primary:   user.mobile_primary   ?? "",
        mobile_secondary: user.mobile_secondary ?? "",
      });
    }
  };

  return (
    <div className="page-shell">
      <TopBar title="Profile" />
      <main className="page-content page-content--narrow page-enter has-bottom-nav">

        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>

        {/* Avatar header */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-5)", marginBottom: "var(--space-8)" }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "var(--saffron-glow)",
            border: "2px solid var(--saffron)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-display)", fontSize: "var(--text-xl)",
            fontWeight: 800, color: "var(--saffron)", flexShrink: 0,
          }}>
            {user
              ? `${(user.first_name ?? "").charAt(0)}${(user.last_name ?? "").charAt(0)}`.toUpperCase() || user.username.slice(0, 2).toUpperCase()
              : "??"}
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{
              fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)",
              fontWeight: 800, color: "var(--ink-primary)",
              letterSpacing: "-0.03em", marginBottom: "var(--space-1)",
            }}>
              {user?.display_name ?? user?.username ?? "—"}
            </h1>
            {user && (
              <span className={`topbar__role-badge topbar__role-badge--${user.role.toLowerCase()}`}>
                {user.role}
              </span>
            )}
          </div>
          {!editing && user && (
            <button
              className="btn btn--secondary"
              style={{ fontSize: "var(--text-sm)", flexShrink: 0 }}
              onClick={() => { setEditing(true); setSaveSuccess(false); }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ marginRight: "var(--space-1)" }}>
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
          )}
        </div>

        {/* ── Gamification summary (students only) ────────────────── */}
        {user?.role === "STUDENT" && gamification && !editing && (
          <>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
              gap: "var(--space-3)", marginBottom: "var(--space-6)",
            }}>
              {[
                { icon: "⭐", value: gamification.total_points,   label: "Points" },
                { icon: "🔥", value: gamification.current_streak, label: "Day Streak" },
                { icon: "🏅", value: gamification.badge_count,    label: "Badges" },
              ].map(({ icon, value, label }) => (
                <div key={label} className="card" style={{ textAlign: "center", padding: "var(--space-4) var(--space-2)" }}>
                  <div style={{ fontSize: 22, marginBottom: "var(--space-1)" }}>{icon}</div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-xl)", color: "var(--role-student)", lineHeight: 1 }}>
                    {value}
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: "var(--space-1)" }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>

            {gamification.badges.length > 0 && (
              <div style={{ marginBottom: "var(--space-8)" }}>
                <div className="section-header" style={{ marginBottom: "var(--space-4)" }}>
                  <h3 className="section-header__title">Badges Earned</h3>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
                  {gamification.badges.map((badge) => (
                    <div key={badge.code} style={{
                      display: "flex", flexDirection: "column", alignItems: "center",
                      gap: "var(--space-1)", padding: "var(--space-3) var(--space-4)",
                      background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)",
                      borderRadius: "var(--radius-lg)", minWidth: 80, textAlign: "center",
                    }}>
                      <div style={{ fontSize: 28 }}>{badge.emoji}</div>
                      <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--ink-primary)", lineHeight: 1.3 }}>
                        {badge.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Content area ────────────────────────────────────────── */}
        {auth.loading ? (
          <ProfileSkeleton />
        ) : !user ? (
          <div className="empty-state">
            <div className="empty-state__icon">👤</div>
            <h3 className="empty-state__title">Not signed in</h3>
          </div>
        ) : editing ? (
          /* ── Edit form ────────────────────────────────────────── */
          <div>
            {saveError && (
              <div className="alert alert--error" style={{ marginBottom: "var(--space-4)" }}>
                {saveError}
              </div>
            )}
            <div className="card" style={{ marginBottom: "var(--space-4)" }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-base)", color: "var(--ink-primary)", marginBottom: "var(--space-5)" }}>
                Edit Profile
              </h2>
              <FormField label="First Name"       name="first_name"       value={fields.first_name}       required error={errors.first_name}       onChange={handleChange} />
              <FormField label="Middle Name"      name="middle_name"      value={fields.middle_name}                error={errors.middle_name}      onChange={handleChange} />
              <FormField label="Last Name"        name="last_name"        value={fields.last_name}        required error={errors.last_name}        onChange={handleChange} />
              <FormField label="Email"            name="email"            value={fields.email}            required error={errors.email}            onChange={handleChange} type="email" />
              <FormField label="Primary Mobile"   name="mobile_primary"   value={fields.mobile_primary}   required error={errors.mobile_primary}   onChange={handleChange} type="tel" />
              <FormField label="Secondary Mobile" name="mobile_secondary" value={fields.mobile_secondary}          error={errors.mobile_secondary} onChange={handleChange} type="tel" />
            </div>
            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              <button
                className="btn btn--primary btn--lg"
                style={{ flex: 1, justifyContent: "center" }}
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {saving ? <><span className="btn__spinner" aria-hidden="true" /> Saving…</> : "Save Changes"}
              </button>
              <button
                className="btn btn--secondary btn--lg"
                style={{ flex: 1, justifyContent: "center" }}
                onClick={handleCancel}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* ── Read view ────────────────────────────────────────── */
          <>
            {saveSuccess && (
              <div className="alert alert--success" style={{ marginBottom: "var(--space-4)" }}>
                ✓ Profile updated successfully
              </div>
            )}

            <div className="card" style={{ padding: "0 var(--space-6)", marginBottom: "var(--space-6)" }}>
              <ProfileField label="First Name"       value={user.first_name} />
              <ProfileField label="Middle Name"      value={user.middle_name || null} />
              <ProfileField label="Last Name"        value={user.last_name} />
              <ProfileField label="Email"            value={user.email || null} />
              <ProfileField label="Primary Mobile"   value={user.mobile_primary || null} />
              <ProfileField label="Secondary Mobile" value={user.mobile_secondary || null} />
            </div>

            <div className="card" style={{ padding: "0 var(--space-6)" }}>
              <ProfileField label="Username"    value={user.username} />
              <ProfileField label="Public ID"   value={user.public_id} />
              <ProfileField label="Role"        value={user.role} />
              <ProfileField label="Institution" value={user.institution} />
              <ProfileField label="Section"     value={user.section} />
              <ProfileField label="District"    value={user.district} />
            </div>

            {/* ── Grades section — students only ─────────────────── */}
            {user.role === "STUDENT" && user.id && (
              <GradesSection studentId={user.id} />
            )}

            {/* ── Change Password ─────────────────────────────────── */}
            <ChangePasswordCard />
          </>
        )}

        <div style={{ marginTop: "var(--space-8)" }}>
          <LogoutButton />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
