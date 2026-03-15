import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import LogoutButton from "./LogoutButton";
import Logo from "./Logo";

type Props = {
  title?: string;
};

const ROLE_BADGE_COLORS: Record<string, string> = {
  STUDENT:   "#3b82f6",
  TEACHER:   "#10b981",
  PRINCIPAL: "#f59e0b",
  OFFICIAL:  "#8b5cf6",
  ADMIN:     "#ef4444",
};

function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

function UserDropdown({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <div
      role="menu"
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        minWidth: 200,
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-md)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        zIndex: 9999,
        overflow: "hidden",
      }}
    >
      <UserInfoHeader />

      <div style={{ padding: "4px 0" }}>
        <DropdownBtn
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              strokeLinejoin="round" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          }
          label="Profile"
          onClick={() => go("/profile")}
        />
        <div style={{ height: 1, background: "var(--border-subtle)", margin: "4px 0" }} />
        <div style={{ padding: "4px 8px" }}>
          <LogoutButton onLogout={onClose} />
        </div>
      </div>
    </div>
  );
}

function UserInfoHeader() {
  const auth = useAuth();
  if (!auth.user) return null;
  return (
    <div style={{
      padding: "12px 16px",
      borderBottom: "1px solid var(--border-subtle)",
      background: "var(--bg-surface)",
    }}>
      <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
        {auth.user.username}
      </div>
      {auth.user.public_id && (
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>
          {auth.user.public_id}
        </div>
      )}
    </div>
  );
}

function DropdownBtn({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      role="menuitem"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "8px 16px",
        background: hovered ? "var(--bg-overlay)" : "none",
        border: "none",
        color: hovered ? "var(--text-primary)" : "var(--text-secondary)",
        fontFamily: "var(--font-body)",
        fontSize: "var(--text-sm)",
        fontWeight: 500,
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.1s",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

export default function TopBar({ title }: Props) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // Navigate to role-appropriate home on logo click
  const handleLogoClick = () => {
    if (!auth.authenticated || !auth.user) {
      navigate("/login");
      return;
    }
    const paths: Record<string, string> = {
      STUDENT:   "/dashboard",
      TEACHER:   "/teacher",
      PRINCIPAL: "/principal",
      OFFICIAL:  "/official",
      ADMIN:     "/admin-panel",
    };
    navigate(paths[auth.user.role] ?? "/");
  };

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        height: 56,
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border-subtle)",
        backdropFilter: "blur(8px)",
      }}
      role="banner"
    >
      {/* Left: clickable logo + optional page title */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={handleLogoClick}
          aria-label="Go to home"
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            borderRadius: "var(--radius-sm)",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.75"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
        >
          <Logo size="sm" variant="full" />
        </button>

        {title && (
          <>
            <span style={{ color: "var(--border-strong)", fontSize: 16, userSelect: "none" }}>/</span>
            <span style={{
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              color: "var(--text-secondary)",
            }}>
              {title}
            </span>
          </>
        )}
      </div>

      {/* Right: user pill with dropdown */}
      {auth.loading ? (
        <div style={{
          width: 160,
          height: 34,
          background: "var(--bg-elevated)",
          borderRadius: "var(--radius-full)",
          animation: "shimmer 1.5s infinite linear",
        }} />
      ) : auth.authenticated && auth.user ? (
        <div ref={containerRef} style={{ position: "relative" }}>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="Open user menu"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 12px 4px 6px",
              background: open ? "var(--bg-elevated)" : "var(--bg-overlay)",
              border: "1px solid",
              borderColor: open ? "var(--brand-primary)" : "var(--border-subtle)",
              borderRadius: "var(--radius-full)",
              cursor: "pointer",
              transition: "all 0.15s",
              fontFamily: "inherit",
            }}
          >
            <div style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: ROLE_BADGE_COLORS[auth.user.role] ?? "var(--brand-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 700,
              color: "#fff",
              flexShrink: 0,
            }}>
              {getInitials(auth.user.username)}
            </div>

            <span style={{
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              color: "var(--text-primary)",
              maxWidth: 100,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {auth.user.username}
            </span>

            <span style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "2px 6px",
              borderRadius: "var(--radius-full)",
              background: (ROLE_BADGE_COLORS[auth.user.role] ?? "#3b82f6") + "22",
              color: ROLE_BADGE_COLORS[auth.user.role] ?? "var(--brand-primary)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}>
              {auth.user.role}
            </span>

            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="var(--text-muted)" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              style={{
                transform: open ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.15s",
                flexShrink: 0,
              }}
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {open && <UserDropdown onClose={() => setOpen(false)} />}
        </div>
      ) : null}
    </header>
  );
}