import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

type Role = "STUDENT" | "TEACHER" | "OFFICIAL" | "ADMIN";

type Props = {
  role: Role;
  children: ReactNode;
};

// Explicit hierarchy
const roleRank: Record<Role, number> = {
  STUDENT: 1,
  TEACHER: 2,
  OFFICIAL: 3,
  ADMIN: 4,
};

export function RequireRole({ role, children }: Props) {
  const auth = useAuth();
  const location = useLocation();

  // Still loading auth state
  if (auth.loading) {
    return <p>Loading…</p>;
  }

  // 🚨 NOT AUTHENTICATED → REDIRECT TO LOGIN
  if (!auth.authenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  // AUTHENTICATED BUT INSUFFICIENT ROLE
  if (roleRank[auth.role] < roleRank[role]) {
    return <p>Access denied</p>;
  }

  return <>{children}</>;
}
