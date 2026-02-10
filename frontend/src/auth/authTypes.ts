export type Role =
  | "STUDENT"
  | "TEACHER"
  | "OFFICIAL"
  | "ADMIN";

export type MeResponse = {
  authenticated: boolean;
  role: Role;
  id?: number;
  username?: string;
};

export type AuthState = {
  loading: boolean;
  authenticated: boolean;
  role: Role;
  username?: string;
  refresh: () => Promise<void>;
};
