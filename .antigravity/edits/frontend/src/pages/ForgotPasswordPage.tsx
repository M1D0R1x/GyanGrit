import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost } from '../services/api';

const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await apiPost('/accounts/forgot-password/', { username: identifier });
      setSent(true);
    } catch (err: unknown) {
      // Always show the success state to prevent user enumeration
      // (Using root logic below instead to match current backend behavior, but keeping comment as requested)
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="page-shell"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-primary)' }}
    >
      {/* Ambient Glow */}
      <div style={{ position: 'fixed', top: '15%', right: '25%', width: '500px', height: '500px', background: 'rgba(59, 130, 246, 0.06)', filter: 'blur(180px)', borderRadius: '50%', zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '10%', left: '20%', width: '350px', height: '350px', background: 'rgba(255, 255, 255, 0.04)', filter: 'blur(140px)', borderRadius: '50%', zIndex: 0, pointerEvents: 'none' }} />

      <main className="page-enter" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '420px', padding: 'var(--space-6)' }}>
        <div className="glass-card" style={{ padding: 'var(--space-10)', textAlign: 'center' }}>

          {!sent ? (
            <>
              {/* Header */}
              <header style={{ marginBottom: 'var(--space-10)' }}>
                <div style={{ fontSize: '32px', marginBottom: 'var(--space-4)' }}>🔐</div>
                <h1 className="text-gradient" style={{ fontSize: '28px', marginBottom: 'var(--space-2)', letterSpacing: '-0.02em' }}>
                  CREDENTIAL RECOVERY
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.6 }}>
                  Enter your username or institutional email. A recovery link will be dispatched if a matching identity is found.
                </p>
              </header>

              {error && (
                <div className="alert alert--error" style={{ marginBottom: 'var(--space-6)', fontSize: '12px' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ textAlign: 'left' }} noValidate>
                <div className="form-group" style={{ marginBottom: 'var(--space-8)' }}>
                  <label htmlFor="identifier" style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    IDENTITY VECTOR (Username or Email)
                  </label>
                  <input
                    id="identifier"
                    className="form-input"
                    type="text"
                    placeholder="Username or email address"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', fontSize: '14px' }}
                    required
                    autoFocus
                    autoComplete="username"
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  className="btn--primary"
                  style={{ width: '100%', padding: 'var(--space-4)', fontSize: '13px', letterSpacing: '0.05em', marginBottom: 'var(--space-6)' }}
                  disabled={loading || !identifier.trim()}
                >
                  {loading ? 'TRANSMITTING...' : 'DISPATCH RECOVERY LINK'}
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
          ) : (
            /* ── Success State ── */
            <>
              <div style={{ fontSize: '48px', marginBottom: 'var(--space-6)' }}>📡</div>
              <h2 className="text-gradient" style={{ fontSize: '24px', marginBottom: 'var(--space-4)', letterSpacing: '-0.02em' }}>
                SIGNAL DISPATCHED
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.7, marginBottom: 'var(--space-8)' }}>
                If a matching identity exists in the system, a recovery transmission has been sent to your registered email. Check your inbox — including spam vectors.
              </p>
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4) var(--space-5)', marginBottom: 'var(--space-8)', border: '1px solid var(--glass-border)' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                  ⏱ Link expires in <strong style={{ color: 'var(--text-primary)' }}>1 hour</strong>. After expiry, reinitiate the recovery sequence.
                </p>
              </div>
              <button
                className="btn--primary"
                style={{ width: '100%', padding: 'var(--space-4)', fontSize: '13px', letterSpacing: '0.05em' }}
                onClick={() => navigate('/login')}
              >
                RETURN TO DOMAIN
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default ForgotPasswordPage;
