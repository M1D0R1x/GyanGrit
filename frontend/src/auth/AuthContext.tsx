/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { ReactNode } from "react";
import { apiGet, initCsrf } from "../services/api";
import type { AuthState, MeResponse, UserProfile } from "./authTypes";

const AuthContext = createContext<AuthState>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading]           = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser]                 = useState<UserProfile | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data: MeResponse = await apiGet("/accounts/me/");

      if (data.authenticated && data.id && data.username && data.role) {
        setAuthenticated(true);
        setUser({
          id:             data.id,
          public_id:      data.public_id ?? "",
          username:       data.username,
          role:           data.role,
          institution:    data.institution ?? null,
          institution_id: data.institution_id ?? null,
          section:        data.section ?? null,
          section_id:     data.section_id ?? null,
          district:       data.district ?? null,
        });
      } else {
        setAuthenticated(false);
        setUser(null);
      }
    } catch (err) {
      console.error("[AuthContext] Failed to fetch /me:", err);
      setAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Seed CSRF cookie first, then verify auth state.
    // This runs once on app mount.
    initCsrf().then(() => refresh());
  }, [refresh]);

  const value: AuthState = {
    loading,
    authenticated,
    user,
    // Convenience shorthands for backwards compatibility
    role:     user?.role ?? "STUDENT",
    username: user?.username,
    refresh,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}