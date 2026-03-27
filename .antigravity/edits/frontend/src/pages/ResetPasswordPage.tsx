import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiPost } from '../services/api';

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { uidb64, token } = useParams<{ uidb64: string; token: string }>();

  const [newPassword, setNewPassword]       = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew]               = useState(false);
  const [showConfirm, setShowConfirm]       = useState(false);
  const [loading, setLoading]               = useState(false);
  const [success, setSuccess]               = useState(false);
  const [error, setError]                   = useState<string | null>(null);

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
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await apiPost('/accounts/reset-password/', {
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

  const EyeToggle = ({ show, onToggle }: { show: boolean; onToggle: () => void }) => (
    <button
      type="button"
      onClick={onToggle}
      aria-label={show ? 'Hide password' : 'Show password'}
      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 0 }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {show
          ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
          : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
        }
      </svg>
    </button>
  );

  return (
    <div
      className="page-shell"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-primary)' }}
    >
      {/* Ambient Glow */}
      <div style={{ position: 'fixed', top: '20%', left: '30%', width: '400px', height: '400px', background: 'rgba(61, 214, 140, 0.05)', filter: 'blur(160px)', borderRadius: '50%', zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '15%', right: '20%', width: '300px', height: '300px', background: 'rgba(255, 255, 255, 0.03)', filter: 'blur(130px)', borderRadius: '50%', zIndex: 0, pointerEvents: 'none' }} />

      <main className="page-enter" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '420px', padding: 'var(--space-6)' }}>
        <div className="glass-card" style={{ padding: 'var(--space-10)', textAlign: 'center' }}>

          {success ? (
            <>
              <div style={{ fontSize: '48px', marginBottom: 'var(--space-6)' }}>✅</div>
              <h2 className="text-gradient" style={{ fontSize: '24px', marginBottom: 'var(--space-4)', letterSpacing: '-0.02em' }}>
                SECURITY TOKEN UPDATED
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.7, marginBottom: 'var(--space-6)' }}>
                All active sessions have been revoked for security. Redirecting to authentication gateway…
              </p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: 'var(--space-6)' }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--role-student)', animation: `pulse 1.4s ${i * 0.2}s ease-in-out infinite` }} />
                ))}
              </div>
              <button
                className="btn--primary"
                style={{ width: '100%', padding: 'var(--space-4)', fontSize: '13px', letterSpacing: '0.05em' }}
                onClick={() => navigate('/login', { replace: true })}
              >
                RETURN TO DOMAIN
              </button>
            </>
          ) : (
            <>
              {/* Header */}
              <header style={{ marginBottom: 'var(--space-10)' }}>
                <div style={{ fontSize: '32px', marginBottom: 'var(--space-4)' }}>🛡️</div>
                <h1 className="text-gradient" style={{ fontSize: '28px', marginBottom: 'var(--space-2)', letterSpacing: '-0.02em' }}>
                  REINITIALIZE TOKEN
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.6 }}>
                  Establish a new security token for your account. All active sessions will be invalidated upon completion.
                </p>
              </header>

              {error && (
                <div className="alert alert--error" style={{ marginBottom: 'var(--space-6)', fontSize: '12px', textAlign: 'left' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate style={{ textAlign: 'left' }}>
                {/* New Password */}
                <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
                  <label htmlFor="newPassword" style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    NEW SECURITY TOKEN
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="newPassword"
                      className="form-input"
                      type={showNew ? 'text' : 'password'}
                      placeholder="Minimum 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', fontSize: '14px', paddingRight: '40px' }}
                      required
                      autoFocus
                      autoComplete="new-password"
                      disabled={loading}
                    />
                    <EyeToggle show={showNew} onToggle={() => setShowNew((p) => !p)} />
                  </div>
                  {/* Strength hint */}
                  {newPassword.length > 0 && (
                    <p style={{
                      fontSize: "11px",
                      marginTop: "var(--space-2)",
                      marginBottom: "0",
                      color: newPassword.length >= 8 ? "var(--success, #16a34a)" : "var(--warning, #d97706)",
                    }}>
                      {newPassword.length < 8
                        ? `${8 - newPassword.length} more character${8 - newPassword.length !== 1 ? "s" : ""} required`
                        : "✓ Minimum length met"}
                    </p>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="form-group" style={{ marginBottom: 'var(--space-8)' }}>
                  <label htmlFor="confirmPassword" style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    CONFIRM TOKEN
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="confirmPassword"
                      className="form-input"
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', fontSize: '14px', paddingRight: '40px' }}
                      required
                      autoComplete="new-password"
                      disabled={loading}
                    />
                    <EyeToggle show={showConfirm} onToggle={() => setShowConfirm((p) => !p)} />
                  </div>
                  {/* Strength indicator */}
                  {newPassword.length > 0 && (
                    <div style={{ marginTop: '8px', display: 'flex', gap: '4px' }}>
                      {[4, 8, 12, 16].map((threshold) => (
                        <div key={threshold} style={{ flex: 1, height: '3px', borderRadius: '2px', background: newPassword.length >= threshold ? 'var(--role-student)' : 'var(--bg-elevated)', transition: 'background 0.2s ease' }} />
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn--primary"
                  style={{ width: '100%', padding: 'var(--space-4)', fontSize: '13px', letterSpacing: '0.05em', marginBottom: 'var(--space-6)' }}
                  disabled={loading || !newPassword || !confirmPassword}
                >
                  {loading ? 'REWRITING CREDENTIALS...' : 'COMMIT NEW TOKEN'}
                </button>
              </form>

              <button
                className="btn--ghost"
                style={{ border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em' }}
                onClick={() => navigate('/login')}
              >
                ← RETURN TO GATEKEEP
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default ResetPasswordPage;
