export type Role =
  | "STUDENT"
  | "TEACHER"
  | "PRINCIPAL"
  | "OFFICIAL"
  | "ADMIN";

export const ROLE_RANK: Record<Role, number> = {
  STUDENT:   1,
  TEACHER:   2,
  PRINCIPAL: 3,
  OFFICIAL:  4,
  ADMIN:     5,
};

export const ROLE_PATHS: Record<Role, string> = {
  STUDENT:   "/dashboard",
  TEACHER:   "/teacher",
  PRINCIPAL: "/principal",
  OFFICIAL:  "/official",
  ADMIN:     "/admin-panel",
};

export type UserProfile = {
  id:               number;
  public_id:        string;
  username:         string;
  role:             Role;
  first_name:       string;
  middle_name:      string;
  last_name:        string;
  display_name:     string;
  email:            string;
  mobile_primary:   string;
  mobile_secondary: string;
  profile_complete: boolean;
  institution:      string | null;
  institution_id:   number | null;
  section:          string | null;
  section_id:       number | null;
  district:         string | null;
};

/**
 * Shape returned by GET /api/v1/accounts/me/
 * When not authenticated, only { authenticated: false } is present.
 * When authenticated, all UserProfile fields are included.
 */
export type MeResponse =
  | { authenticated: false }
  | ({
      authenticated: true;
    } & {
      id:               number;
      public_id:        string;
      username:         string;
      role:             Role;
      first_name:       string;
      middle_name:      string;
      last_name:        string;
      display_name:     string;
      email:            string;
      mobile_primary:   string;
      mobile_secondary: string;
      profile_complete: boolean;
      institution:      string | null;
      institution_id:   number | null;
      section:          string | null;
      section_id:       number | null;
      district:         string | null;
    });

export type AuthState = {
  loading:       boolean;
  authenticated: boolean;
  user:          UserProfile | null;
  refresh:       () => Promise<void>;
};