import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost } from '../services/api';
import { useAuth } from '../auth/AuthContext';
import type { Role } from '../auth/authTypes';
import TopBar from '../components/TopBar';

type LoginApiResponse =
  | { otp_required: true; username: string; role: Role }
  | { otp_required: false; id: number; username: string; role: Role };

const ROLE_PATHS: Record<Role, string> = {
  STUDENT: "/dashboard",
  TEACHER: "/teacher",
  PRINCIPAL: "/principal",
  OFFICIAL: "/official",
  ADMIN: "/admin-panel",
};

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const auth = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    auth.clearKicked();

    try {
      const response = await apiPost<LoginApiResponse>("/accounts/login/", {
        username,
        password,
      });

      if (response.otp_required) {
        navigate("/verify-otp", {
          state: { username },
          replace: true,
        });
        return;
      }

      await auth.refresh();
      navigate(ROLE_PATHS[response.role] ?? "/", { replace: true });

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Background Ambient Glow */}
      <div style={{ position: 'fixed', top: '20%', left: '30%', width: '400px', height: '400px', background: 'var(--brand-primary-glow)', filter: 'blur(150px)', borderRadius: '50%', zIndex: 0 }} />
      
      <main className="page-enter" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '420px', padding: 'var(--space-6)' }}>
         <div className="glass-card" style={{ padding: 'var(--space-10)', textAlign: 'center' }}>
            {/* Branding */}
            <header style={{ marginBottom: 'var(--space-10)' }}>
               <h1 className="text-gradient" style={{ fontSize: 'var(--text-4xl)', marginBottom: 'var(--space-2)', letterSpacing: '-0.02em' }}>
                 GyanGrit
               </h1>
               <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                 Institutional Intelligence Layer.
               </p>
            </header>

            {error && (
              <div className="alert alert--error" style={{ marginBottom: 'var(--space-6)', fontSize: '12px' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
               <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>IDENTIFIER</label>
                  <input 
                    className="form-input" 
                    type="text" 
                    placeholder="Username or Email" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', fontSize: 'var(--text-sm)' }}
                    required
                  />
               </div>

               <div className="form-group" style={{ marginBottom: 'var(--space-8)' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>SECURITY TOKEN</label>
                  <input 
                    className="form-input" 
                    type="password" 
                    placeholder="••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', fontSize: 'var(--text-sm)' }}
                    required
                  />
               </div>

               <button 
                 type="submit" 
                 className="btn--primary" 
                 style={{ width: '100%', padding: 'var(--space-4)', fontSize: '14px', marginBottom: 'var(--space-6)' }}
                 disabled={loading}
               >
                 {loading ? 'AUTHENTICATING...' : 'ACCESS DOMAIN'}
               </button>
            </form>

            <footer style={{ marginTop: 'var(--space-4)' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Unauthorized access is strictly prohibited.
              </p>
              <button 
                className="btn--ghost" 
                style={{ border: 'none', background: 'none', color: 'var(--brand-primary)', fontSize: '12px', marginTop: 'var(--space-4)', fontWeight: 700 }}
                onClick={() => navigate('/register')}
              >
                INITIALIZE ENROLLMENT
              </button>
            </footer>
         </div>
      </main>
    </div>
  );
};

export default LoginPage;
