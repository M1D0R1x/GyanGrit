// pages.ProfilePage
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getMySummary, type MySummary } from "../services/gamification";
import { getStudentGrades, type GradeEntry } from "../services/gradebook";
import { apiPost, apiPatch } from "../services/api";
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
    <div style={{ padding: '16px 0', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>{label.toUpperCase()}</span>
      <span style={{ fontSize: '11px', color: value ? 'var(--text-primary)' : 'var(--text-muted)', fontStyle: value ? 'normal' : 'italic' }}>{value ?? "—"}</span>
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
    <div style={{ marginBottom: '16px' }}>
      <label
        htmlFor={`profile-${name}`}
        style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}
      >
        {label}{required && <span style={{ color: "var(--error)", marginLeft: 4 }}>*</span>}
      </label>
      <input
        id={`profile-${name}`}
        type={type}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        className="form-input"
        style={{ background: 'var(--bg-elevated)', border: error ? '1px solid var(--error)' : '1px solid var(--glass-border)', fontSize: '14px' }}
        autoComplete="off"
      />
      {error && (
        <span style={{ fontSize: "10px", color: "var(--error)", marginTop: '4px', display: 'block', fontWeight: 700 }}>{error}</span>
      )}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="glass-card" style={{ padding: '0 var(--space-8)' }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "16px 0", borderBottom: "1px solid var(--glass-border)" }}>
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
        <h3 style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📊</span> MY GRADES
        </h3>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 'var(--space-4)' }}>
        <div>
          <h3 style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📊</span> MY GRADES
          </h3>
          <p style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
            {entries.length} mark{entries.length !== 1 ? "s" : ""} across {subjectKeys.length} subject{subjectKeys.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{
          fontFamily: "var(--font-display)", fontWeight: 800,
          fontSize: "var(--text-2xl)", color: pctColor(avgPct),
        }}>
          {avgPct}%
          <div style={{ fontSize: "var(--text-xs)", fontWeight: 500, color: "var(--text-muted)", textAlign: "right" }}>avg</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {shownKeys.map((subject) => {
          const subEntries = bySubject[subject];
          const subAvg     = Math.round(subEntries.reduce((s, e) => s + e.percentage, 0) / subEntries.length);
          return (
            <div key={subject} className="glass-card" style={{ padding: "var(--space-4) var(--space-5)" }}>
              {/* Subject header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
                <span style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
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
              <div style={{ height: '4px', background: 'var(--bg-elevated)', borderRadius: '2px', overflow: 'hidden', marginBottom: 'var(--space-3)' }}>
                <div style={{ height: '100%', width: `${subAvg}%`, background: pctColor(subAvg) }} />
              </div>
              {/* Entry rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {subEntries.map((e) => (
                  <div key={e.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    fontSize: "var(--text-xs)", color: "var(--text-muted)",
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
          className="btn--secondary"
          style={{ marginTop: "var(--space-4)", width: "100%", justifyContent: "center", padding: '12px' }}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "SHOW LESS" : `SHOW ALL ${subjectKeys.length} SUBJECTS`}
        </button>
      )}
    </div>
  );
}

// ── Change Password Card ───────────────────────────────────────────────────

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

  const reset = () => { setOldPw(""); setNewPw(""); setConfirmPw(""); setError(null); setShowOld(false); setShowNew(false); setShowConfirm(false); };
  const handleToggle = () => { if (open) reset(); setOpen((v) => !v); setSuccess(false); };

  const EyeBtn = ({ show, toggle, label }: { show: boolean; toggle: () => void; label: string }) => (
    <button type="button" onClick={toggle} aria-label={label}
      style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center", padding: 0 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {show
          ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
          : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
        }
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
      setSuccess(true); setOpen(false); reset();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    { id: "cp-old",     label: "CURRENT PASSWORD", val: oldPw,     setVal: setOldPw,     show: showOld,     setShow: setShowOld,     ac: "current-password" },
    { id: "cp-new",     label: "NEW PASSWORD",      val: newPw,     setVal: setNewPw,     show: showNew,     setShow: setShowNew,     ac: "new-password" },
    { id: "cp-confirm", label: "CONFIRM PASSWORD",  val: confirmPw, setVal: setConfirmPw, show: showConfirm, setShow: setShowConfirm, ac: "new-password" },
  ] as const;

  return (
    <section className="glass-card" style={{ padding: 'var(--space-6)', marginTop: 'var(--space-8)' }}>
      <button type="button" onClick={handleToggle}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          🔑 CHANGE PASSWORD
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {success && !open && (
        <div style={{ marginTop: '16px', padding: '12px', borderRadius: 'var(--radius-md)', background: 'rgba(61,214,140,0.08)', border: '1px solid rgba(61,214,140,0.2)', fontSize: '12px', color: 'var(--role-student)' }}>
          ✓ Password changed successfully
        </div>
      )}

      {open && (
        <form onSubmit={(e) => void handleSubmit(e)} noValidate style={{ marginTop: 'var(--space-6)' }}>
          {error && (
            <div className="alert alert--error" style={{ marginBottom: '16px', fontSize: '12px' }}>
              {error}
            </div>
          )}

          {fields.map(({ id, label, val, setVal, show, setShow, ac }) => (
            <div key={id} style={{ marginBottom: '16px' }}>
              <label htmlFor={id} style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {label}
              </label>
              <div style={{ position: 'relative' }}>
                <input id={id} className="form-input"
                  type={show ? "text" : "password"}
                  value={val}
                  onChange={(e) => setVal(e.target.value)}
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', fontSize: '14px', paddingRight: '40px' }}
                  disabled={saving}
                  autoComplete={ac}
                />
                <EyeBtn show={show} toggle={() => setShow((p) => !p)} label={show ? "Hide" : "Show"} />
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="submit" className="btn--primary"
              style={{ flex: 1, padding: 'var(--space-3)', fontSize: '12px', letterSpacing: '0.05em' }}
              disabled={saving || !oldPw || !newPw || !confirmPw}>
              {saving ? 'SAVING...' : 'UPDATE PASSWORD'}
            </button>
            <button type="button" className="btn--ghost"
              style={{ flex: 1, padding: 'var(--space-3)', fontSize: '12px', letterSpacing: '0.05em' }}
              onClick={handleToggle} disabled={saving}>
              CANCEL
            </button>
          </div>
        </form>
      )}
    </section>
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

  const handleSave = async (e?: React.FormEvent) => {
    if(e) e.preventDefault();
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

        <button className="btn--ghost" onClick={() => navigate(-1)} style={{ marginBottom: 'var(--space-6)', padding: '8px', fontSize: '10px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true" style={{ marginRight: '4px' }}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
          BACK
        </button>

        {/* Avatar header */}
        <section className="glass-card" style={{ padding: 'var(--space-8)', marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: "var(--brand-primary-glow)",
            border: "2px solid var(--brand-primary)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)",
            fontWeight: 800, color: "var(--brand-primary)", flexShrink: 0,
          }}>
            {user
              ? `${(user.first_name ?? "").charAt(0)}${(user.last_name ?? "").charAt(0)}`.toUpperCase() || user.username.slice(0, 2).toUpperCase()
              : "??"}
          </div>
          <div style={{ flex: 1 }}>
            <div className={`role-tag role-tag--${user?.role.toLowerCase()}`} style={{ marginBottom: '8px' }}>{user?.role}</div>
            <h1 className="text-gradient" style={{
              fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)",
              fontWeight: 800,
              letterSpacing: "-0.03em", marginBottom: "var(--space-1)",
            }}>
              {user?.display_name ?? user?.username ?? "—"}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{user?.email || 'No email'}</p>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {!editing && user && (
              <button
                className="btn--primary"
                style={{ padding: '8px 16px', fontSize: '10px' }}
                onClick={() => { setEditing(true); setSaveSuccess(false); }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                  style={{ marginRight: "var(--space-1)" }}>
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                EDIT PROFILE
              </button>
            )}
            {!editing && user && (
               <LogoutButton />
            )}
          </div>
        </section>

        {/* ── Gamification summary (students only) ────────────────── */}
        {user?.role === "STUDENT" && gamification && !editing && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
              {[
                { icon: "⭐", value: gamification.total_points,   label: "Points" },
                { icon: "🔥", value: gamification.current_streak, label: "Day Streak" },
                { icon: "🏅", value: gamification.badge_count,    label: "Badges" },
              ].map(({ icon, value, label }) => (
                <div key={label} className="glass-card" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 800, textTransform: 'uppercase' }}>{label}</div>
                  <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, color: 'var(--brand-primary)', marginTop: '4px' }}>{value}</div>
                </div>
              ))}
            </div>

            {gamification.badges.length > 0 && (
              <div style={{ marginBottom: "var(--space-6)" }}>
                <h3 style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                   <span>🏅</span> BADGES EARNED
                </h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
                  {gamification.badges.map((badge) => (
                    <div key={badge.code} style={{
                      display: "flex", flexDirection: "column", alignItems: "center",
                      gap: "var(--space-1)", padding: "var(--space-3) var(--space-4)",
                      background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)",
                      borderRadius: "var(--radius-lg)", minWidth: 80, textAlign: "center",
                    }}>
                      <div style={{ fontSize: 28 }}>{badge.emoji}</div>
                      <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>
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
            <form onSubmit={handleSave} className="glass-card" style={{ padding: 'var(--space-8)', marginBottom: "var(--space-4)" }}>
              <h2 className="text-gradient" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-lg)", marginBottom: "var(--space-5)" }}>
                Edit Profile
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0 var(--space-6)' }}>
                  <FormField label="First Name"       name="first_name"       value={fields.first_name}       required error={errors.first_name}       onChange={handleChange} />
                  <FormField label="Middle Name"      name="middle_name"      value={fields.middle_name}                error={errors.middle_name}      onChange={handleChange} />
                  <FormField label="Last Name"        name="last_name"        value={fields.last_name}        required error={errors.last_name}        onChange={handleChange} />
                  <FormField label="Email"            name="email"            value={fields.email}            required error={errors.email}            onChange={handleChange} type="email" />
                  <FormField label="Primary Mobile"   name="mobile_primary"   value={fields.mobile_primary}   required error={errors.mobile_primary}   onChange={handleChange} type="tel" />
                  <FormField label="Secondary Mobile" name="mobile_secondary" value={fields.mobile_secondary}          error={errors.mobile_secondary} onChange={handleChange} type="tel" />
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: 'var(--space-4)' }}>
                <button
                  type="submit"
                  className="btn--primary"
                  style={{ flex: 1, justifyContent: "center", padding: '12px' }}
                  disabled={saving}
                >
                  {saving ? 'SAVING...' : "SAVE CHANGES"}
                </button>
                <button
                  type="button"
                  className="btn--ghost"
                  style={{ flex: 1, justifyContent: "center", padding: '12px' }}
                  onClick={handleCancel}
                  disabled={saving}
                >
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* ── Read view ────────────────────────────────────────── */
          <>
            {saveSuccess && (
              <div style={{ marginBottom: 'var(--space-6)', padding: '12px', borderRadius: 'var(--radius-md)', background: 'rgba(61,214,140,0.08)', border: '1px solid rgba(61,214,140,0.2)', fontSize: '12px', color: 'var(--role-student)' }}>
                 ✓ Profile updated successfully
              </div>
            )}

            <div className="glass-card" style={{ padding: "0 var(--space-8)", marginBottom: "var(--space-6)" }}>
              <ProfileField label="First Name"       value={user.first_name} />
              <ProfileField label="Middle Name"      value={user.middle_name || null} />
              <ProfileField label="Last Name"        value={user.last_name} />
              <ProfileField label="Email"            value={user.email || null} />
              <ProfileField label="Primary Mobile"   value={user.mobile_primary || null} />
              <ProfileField label="Secondary Mobile" value={user.mobile_secondary || null} />
            </div>

            <div className="glass-card" style={{ padding: "0 var(--space-8)" }}>
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
      </main>
      <BottomNav />
    </div>
  );
}
