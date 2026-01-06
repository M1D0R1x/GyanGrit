import type {ReactNode} from "react";
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

  if (auth.loading) {
    return <p>Loading…</p>;
  }

  if (!auth.authenticated) {
    return <p>Access denied</p>;
  }

  // ✅ Hierarchical access check
  if (roleRank[auth.role] < roleRank[role]) {
    return <p>Access denied</p>;
  }

  return <>{children}</>;
}
