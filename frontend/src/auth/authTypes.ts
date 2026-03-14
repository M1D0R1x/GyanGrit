// auth/authTypes.ts

export type Role = "STUDENT" | "TEACHER" | "PRINCIPAL" | "OFFICIAL" | "ADMIN";

/**
 * Shape of the /accounts/me/ API response.
 * Kept in sync with accounts/views.py me() return value.
 */
export type MeResponse = {
  authenticated: boolean;
  role: Role;
  id?: number;
  public_id?: string;
  username?: string;
  institution?: string | null;
  institution_id?: number | null;
  section?: string | null;
  section_id?: number | null;
  district?: string | null;
};

/**
 * Full authenticated user profile stored in AuthContext.
 * Populated from MeResponse when authenticated === true.
 */
export type UserProfile = {
  id: number;
  public_id: string;
  username: string;
  role: Role;
  institution: string | null;
  institution_id: number | null;
  section: string | null;
  section_id: number | null;
  district: string | null;
};

export type AuthState = {
  loading: boolean;
  authenticated: boolean;
  user: UserProfile | null;
  // Convenience shorthand — avoids user?.role ?? "STUDENT" everywhere
  role: Role;
  username: string | undefined;
  refresh: () => Promise<void>;
};