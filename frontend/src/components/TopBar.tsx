import { useAuth } from "../auth/AuthContext";
import LogoutButton from "./LogoutButton";
import type { Role } from "../auth/authTypes";

type Props = {
  title: string;
};

function roleBadgeClass(role: Role): string {
  return `topbar__role-badge topbar__role-badge--${role.toLowerCase()}`;
}

function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

function TopBarSkeleton() {
  return (
    <header className="topbar" aria-busy="true" aria-label="Loading navigation">
      <div className="topbar__brand">
        Gyan<span>Grit</span>
      </div>
      <div className="topbar__right">
        <div className="skeleton topbar__skeleton-user" />
      </div>
    </header>
  );
}

export default function TopBar({ title }: Props) {
  const auth = useAuth();

  if (auth.loading) {
    return <TopBarSkeleton />;
  }

  return (
    <header className="topbar" role="banner">
      <div className="topbar__brand">
        Gyan<span>Grit</span>
        {title && (
          <>
            <span style={{ color: "var(--border-strong)", margin: "0 10px" }}>
              /
            </span>
            <span className="topbar__title">{title}</span>
          </>
        )}
      </div>

      <div className="topbar__right">
        {auth.authenticated && auth.user ? (
          <>
            <div className="topbar__user" aria-label={`Logged in as ${auth.user.username}`}>
              <div className="topbar__avatar" aria-hidden="true">
                {getInitials(auth.user.username)}
              </div>
              <span className="topbar__username">{auth.user.username}</span>
              <span className={roleBadgeClass(auth.user.role)}>
                {auth.user.role}
              </span>
            </div>
            <LogoutButton />
          </>
        ) : (
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
            Not signed in
          </span>
        )}
      </div>
    </header>
  );
}