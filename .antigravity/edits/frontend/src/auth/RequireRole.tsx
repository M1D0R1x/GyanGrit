import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { ROLE_RANK, type Role } from "./authTypes";

type Props = {
  role: Role;
  children: React.ReactNode;
};

export function RequireRole({ role, children }: Props) {
  const auth     = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (auth.loading) return;

    if (!auth.authenticated || !auth.user) {
      navigate("/login", { replace: true });
      return;
    }

    // Profile must be complete before accessing any protected page
    // ADMIN is exempt — they are created via createsuperuser and may not have a profile
    if (!auth.user.profile_complete && auth.user.role !== "ADMIN") {
      navigate("/complete-profile", { replace: true });
      return;
    }

    if (ROLE_RANK[auth.user.role] < ROLE_RANK[role]) {
      navigate("/403", { replace: true });
    }
  }, [auth.loading, auth.authenticated, auth.user, role, navigate]);

  if (auth.loading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading__logo">
          Gyan<span>Grit</span>
        </div>
        <div className="auth-loading__spinner" />
      </div>
    );
  }

  if (!auth.authenticated || !auth.user) return null;
  if (!auth.user.profile_complete && auth.user.role !== "ADMIN") return null;
  if (ROLE_RANK[auth.user.role] < ROLE_RANK[role]) return null;

  return <>{children}</>;
}