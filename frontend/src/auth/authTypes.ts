export type Role = "STUDENT" | "TEACHER" | "PRINCIPAL" | "OFFICIAL" | "ADMIN";

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
  role: Role;
  username: string | undefined;
  refresh: () => Promise<void>;
};

/**
 * Shared role → path mapping.
 * Used by LoginPage, VerifyOtpPage, RoleBasedRedirect.
 * Single source of truth — change here and all pages update.
 */
export const ROLE_PATHS: Record<Role, string> = {
  STUDENT:   "/dashboard",
  TEACHER:   "/teacher",
  PRINCIPAL: "/principal",
  OFFICIAL:  "/official",
  ADMIN:     "/admin-panel",
};