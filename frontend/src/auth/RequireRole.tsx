import type { ReactNode } from "react";
import { useAuth, type Role } from "./AuthContext";

export function RequireRole({
  role,
  children,
}: {
  role: Role;
  children: ReactNode;
}) {
  const auth = useAuth();

  if (auth.loading) {
    return <p>Loading…</p>;
  }

  if (!auth.authenticated || auth.role !== role) {
    return <p>Access denied</p>;
  }

  return <>{children}</>;
}
