import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { apiGet, initCsrf } from "../services/api";
import type { AuthState, MeResponse, Role } from "./authTypes";

/* eslint-disable react-refresh/only-export-components */

const AuthContext = createContext<AuthState>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [role, setRole] = useState<Role>("STUDENT");
  const [username, setUsername] = useState<string | undefined>(undefined);

  const refresh = async () => {
    setLoading(true);
    try {
      const data: MeResponse = await apiGet("/accounts/me/");
      setAuthenticated(data.authenticated);
      if (data.authenticated) {
        setRole(data.role);
        setUsername(data.username);
      } else {
        setRole("STUDENT");
        setUsername(undefined);
      }
    } catch (err) {
      console.error(err);
      setAuthenticated(false);
      setRole("STUDENT");
      setUsername(undefined);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // ✅ Seed CSRF cookie first, then check auth state
    initCsrf().then(() => refresh());
  }, []);

  return (
    <AuthContext.Provider value={{ loading, authenticated, role, username, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}