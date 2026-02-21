import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { apiGet } from "../services/api";
import type { AuthState, MeResponse } from "./authTypes";

// ─────────────────────────────────────────────────────────────
// Internal context value type (not exported directly)
// ─────────────────────────────────────────────────────────────
type AuthContextValue = AuthState;

// ─────────────────────────────────────────────────────────────
// Context itself (only used inside provider)
// ─────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─────────────────────────────────────────────────────────────
// Provider component (this is the only thing we export as component)
// ─────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<AuthContextValue, "refresh">>({
    loading: true,
    authenticated: false,
    role: "STUDENT" as const,
    username: undefined,
  });

  const refresh = useCallback(async () => {
    try {
      const me = await apiGet<MeResponse>("/accounts/me/");
      setState({
        loading: false,
        authenticated: me.authenticated,
        role: me.role,
        username: me.username,
      });
    } catch (err) {
      console.error("Auth refresh failed:", err);
      setState({
        loading: false,
        authenticated: false,
        role: "STUDENT" as const,
        username: undefined,
      });
    }
  }, []); // ← stable, no deps → no re-creation

  useEffect(() => {
    refresh();
  }, [refresh]); // ← depends on stable refresh

  // Value object is recreated only when state changes
  const value: AuthContextValue = {
    ...state,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─────────────────────────────────────────────────────────────
// Hook (exported for consumption)
// ─────────────────────────────────────────────────────────────
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}