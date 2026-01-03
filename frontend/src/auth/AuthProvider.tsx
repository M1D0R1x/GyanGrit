import type {ReactNode} from "react";
import { AuthContext, type Role } from "./AuthContext";

/**
 * Temporary auth provider.
 * Later this will read from cookies / tokens / backend.
 */
export function AuthProvider({
  children,
  role = "student",
}: {
  children: ReactNode;
  role?: Role;
}) {
  return (
    <AuthContext.Provider value={{ role }}>
      {children}
    </AuthContext.Provider>
  );
}
