import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost } from "../services/api";

interface ValidateJoinCodeResponse {
  valid: boolean;
  role: string;
  institution?: string | null;
  section?: string | null;
  district?: string | null;
}

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [detectedRole, setDetectedRole] = useState<string | null>(null);
  const [detectedInfo, setDetectedInfo] = useState<ValidateJoinCodeResponse | null>(null);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (joinCode.length < 8) {
      setDetectedRole(null);
      setDetectedInfo(null);
      return;
    }

    const timeout = setTimeout(async () => {
      setValidating(true);
      try {
        const res = await apiPost<ValidateJoinCodeResponse>(
          "/accounts/validate-join-code/",
          { join_code: joinCode }
        );
        setDetectedRole(res.role);
        setDetectedInfo(res);
      } catch (err) {
        setDetectedRole(null);
        setDetectedInfo(null);
      } finally {
        setValidating(false);
      }
    }, 600);

    return () => clearTimeout(timeout);
  }, [joinCode]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || !joinCode || !detectedRole) return;

    setLoading(true);
    setError(null);

    try {
      await apiPost("/accounts/register/", {
        username,
        password,
        join_code: joinCode,
      });
      navigate("/login");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Background Ambient Glow */}
      <div style={{ position: 'fixed', bottom: '10%', right: '20%', width: '500px', height: '500px', background: 'rgba(59, 214, 140, 0.05)', filter: 'blur(150px)', borderRadius: '50%', zIndex: 0 }} />
      
      <main className="page-enter" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '480px', padding: 'var(--space-6)' }}>
         <div className="glass-card" style={{ padding: 'var(--space-10)' }}>
            <header style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
               <h1 className="text-gradient" style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-2)' }}>
                 Initialize Enrollment
               </h1>
               <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                 Provision your identity via institutional vector.
               </p>
            </header>

            {error && (
              <div className="alert alert--error" style={{ marginBottom: 'var(--space-6)', fontSize: '12px' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleRegister}>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>SCHOLAR NAME</label>
                    <input 
                      className="form-input" 
                      type="text" 
                      placeholder="Username" 
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', fontSize: 'var(--text-sm)' }}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>SECURITY TOKEN</label>
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
               </div>

               <div className="form-group" style={{ marginBottom: 'var(--space-8)' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>INSTITUTIONAL JOIN CODE</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      className="form-input" 
                      type="text" 
                      placeholder="XXXX-XXXX" 
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      style={{ 
                        background: 'var(--bg-elevated)', 
                        border: `1px solid ${detectedRole ? 'var(--role-student)' : 'var(--glass-border)'}`, 
                        fontSize: 'var(--text-sm)',
                        fontFamily: 'monospace',
                        letterSpacing: '0.1em'
                      }}
                      required
                    />
                    {validating && (
                      <div className="btn__spinner" style={{ position: 'absolute', right: '12px', top: '12px', width: '16px', height: '16px' }} />
                    )}
                  </div>
               </div>

               {detectedRole && detectedInfo && (
                 <div className="glass-card page-enter" style={{ padding: 'var(--space-4)', background: 'var(--bg-elevated)', marginBottom: 'var(--space-8)', borderLeft: '3px solid var(--role-student)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 800, marginBottom: '4px' }}>VALIDATED VECTOR</div>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: '2px' }}>{detectedRole}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                      {detectedInfo.institution || detectedInfo.district || 'GyanGrit Global Framework'}
                    </div>
                 </div>
               )}

               <button 
                 type="submit" 
                 className="btn--primary" 
                 style={{ width: '100%', padding: 'var(--space-4)', fontSize: '14px', marginBottom: 'var(--space-6)' }}
                 disabled={loading || !detectedRole}
               >
                 {loading ? 'PROVISIONING...' : 'FINALIZE ENROLLMENT'}
               </button>
            </form>

            <footer style={{ textAlign: 'center' }}>
              <button 
                className="btn--ghost" 
                style={{ border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: '12px' }}
                onClick={() => navigate('/login')}
              >
                Already provisioned? <span style={{ color: 'var(--brand-primary)', fontWeight: 700 }}>Sign in</span>
              </button>
            </footer>
         </div>
      </main>
    </div>
  );
};

export default RegisterPage;
