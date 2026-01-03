import { createContext, useContext } from "react";
import type { ReactNode } from "react";

export type Role = "student" | "teacher" | "admin";

export const AuthContext = createContext<{ role: Role }>({
  role: "student",
});

export const useAuth = () => useContext(AuthContext);

export function RequireRole({
  role,
  children,
}: {
  role: Role;
  children: ReactNode;
}) {
  const auth = useAuth();

  if (auth.role !== role) {
    return <p>Access denied</p>;
  }

  return <>{children}</>;
}
