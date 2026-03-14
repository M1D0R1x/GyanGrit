import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import type { Role } from "./authTypes";

// Role hierarchy — higher number = more access
const roleRank: Record<Role, number> = {
  STUDENT:   1,
  TEACHER:   2,
  PRINCIPAL: 3,
  OFFICIAL:  4,
  ADMIN:     5,
};

type Props = {
  role: Role;
  children: ReactNode;
};

function AuthLoadingScreen() {
  return (
    <div className="auth-loading">
      <div className="auth-loading__logo">
        Gyan<span>Grit</span>
      </div>
      <div className="auth-loading__spinner" />
      <p className="auth-loading__text">Verifying session</p>
    </div>
  );
}

function AccessDeniedScreen() {
  return (
    <div className="access-denied">
      <div className="access-denied__code">403</div>
      <h2 className="access-denied__title">Access Denied</h2>
      <p className="access-denied__message">
        You do not have permission to view this page.
        Please contact your administrator if you believe this is an error.
      </p>
      <a href="/" className="access-denied__btn">
        Go to Dashboard
      </a>
    </div>
  );
}

export function RequireRole({ role, children }: Props) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.loading) {
    return <AuthLoadingScreen />;
  }

  if (!auth.authenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (roleRank[auth.role] < roleRank[role]) {
    return <AccessDeniedScreen />;
  }

  return <>{children}</>;
}