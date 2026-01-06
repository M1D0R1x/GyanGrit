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
};

export const AuthContext = createContext<AuthState>({
  loading: true,
  authenticated: false,
  role: "STUDENT",
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    loading: true,
    authenticated: false,
    role: "STUDENT",
  });

  useEffect(() => {
    apiGet<MeResponse>("/accounts/me/")
      .then((me) => {
        setState({
          loading: false,
          authenticated: me.authenticated,
          role: me.role,
        });
      })
      .catch(() => {
        setState({
          loading: false,
          authenticated: false,
          role: "STUDENT",
        });
      });
  }, []);

  return (
    <AuthContext.Provider value={state}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
