import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { apiGet } from "../services/api";

export type Role = "STUDENT" | "TEACHER" | "OFFICIAL" | "ADMIN";

type MeResponse = {
  authenticated: boolean;
  role: Role;
  id?: number;
  username?: string;
};

type AuthState = {
  loading: boolean;
  authenticated: boolean;
  role: Role;
  username?: string;
  refresh: () => Promise<void>;
};

export const AuthContext = createContext<AuthState>({
  loading: true,
  authenticated: false,
  role: "STUDENT",
  username: undefined,
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<AuthState, "refresh">>({
    loading: true,
    authenticated: false,
    role: "STUDENT",
    username: undefined,
  });

  async function refresh() {
    try {
      const me = await apiGet<MeResponse>("/accounts/me/");
      setState({
        loading: false,
        authenticated: me.authenticated,
        role: me.role,
        username: me.username,
      });
    } catch {
      setState({
        loading: false,
        authenticated: false,
        role: "STUDENT",
        username: undefined,
      });
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
