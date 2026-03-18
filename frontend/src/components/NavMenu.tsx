// components.NavMenu
/**
 * ⚠️  TEMPORARY SUPERVISOR DEMO NAV — NEEDS UPGRADE LATER  ⚠️
 *
 * This component is a quick navigation menu added so the supervisor can see
 * and click every accessible section/endpoint for the currently logged-in role.
 *
 * TODO (before production / post-capstone):
 *   - Replace with a proper sidebar drawer for staff roles (TEACHER, PRINCIPAL, OFFICIAL, ADMIN)
 *   - Students already have BottomNav — this is redundant for them on mobile
 *   - Remove the raw route listing once the UI is polished and intuitive
 *   - Consider persistent role-specific sidebars instead of a dropdown
 *   - The "⚠️ Demo nav" banner inside the panel can be removed once upgraded
 *
 * Current behaviour:
 *   - Renders a "☰ Nav" button in TopBar (between logo and notification bell)
 *   - Opens a dropdown panel with all routes grouped by section for the current role
 *   - Closes on outside click, Escape key, or after navigation
 */

import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { Role } from "../auth/authTypes";

// ── Types ──────────────────────────────────────────────────────────────────

type NavItem = {
  label: string;
  path:  string;
  icon:  string;
};

type NavGroup = {
  group: string;
  items: NavItem[];
};

// ── Role-aware route map ───────────────────────────────────────────────────
// Each role sees only the routes it can access.
// Keep this in sync with router.tsx when adding new routes.

function getNavGroups(role: Role): NavGroup[] {
  switch (role) {

    case "STUDENT":
      return [
        {
          group: "🏠 Home",
          items: [
            { label: "Dashboard",          path: "/dashboard",           icon: "🏠" },
            { label: "Profile & Badges",   path: "/profile",             icon: "👤" },
            { label: "Leaderboard",        path: "/leaderboard",         icon: "🏆" },
          ],
        },
        {
          group: "📚 Courses",
          items: [
            { label: "All Courses",      path: "/courses",   icon: "📚" },
            { label: "Learning Paths",   path: "/learning",  icon: "🗺️" },
          ],
        },
        {
          group: "📋 Assessments",
          items: [
            { label: "All Assessments",    path: "/assessments",         icon: "📋" },
            { label: "Attempt History",    path: "/assessments/history", icon: "🕑" },
          ],
        },
        {
          group: "🔔 Notifications",
          items: [
            { label: "Inbox & History",  path: "/notifications", icon: "🔔" },
          ],
        },
      ];

    case "TEACHER":
      return [
        {
          group: "📊 Overview",
          items: [
            { label: "Teacher Dashboard", path: "/teacher",       icon: "📊" },
            { label: "Notifications",     path: "/notifications", icon: "🔔" },
            { label: "Profile",           path: "/profile",       icon: "👤" },
          ],
        },
        {
          group: "👥 Students",
          items: [
            { label: "Join Codes & Students", path: "/teacher/users", icon: "🔑" },
          ],
        },
        {
          group: "📝 Notes",
          items: [
            { label: "Class Detail (→ via dashboard)", path: "/teacher",               icon: "🏫" },
            { label: "Gradebook (→ via class)",        path: "/teacher",               icon: "📊" },
            { label: "Lesson Editor (→ via class)",    path: "/teacher",               icon: "✏️" },
            { label: "Assessment Builder (→ via class)", path: "/teacher",             icon: "🧪" },
          ],
        },
      ];

    case "PRINCIPAL":
      return [
        {
          group: "🏫 Overview",
          items: [
            { label: "Principal Dashboard", path: "/principal",       icon: "🏫" },
            { label: "Notifications",       path: "/notifications",   icon: "🔔" },
            { label: "Profile",             path: "/profile",         icon: "👤" },
          ],
        },
        {
          group: "🔑 Management",
          items: [
            { label: "Join Codes & Staff", path: "/principal/users", icon: "🔑" },
          ],
        },
        {
          group: "📝 Content",
          items: [
            { label: "Class Detail (→ via dashboard)", path: "/principal", icon: "🏠" },
            { label: "Gradebook (→ via class)",        path: "/principal", icon: "📊" },
            { label: "Lesson Editor (→ via class)",    path: "/principal", icon: "✏️" },
            { label: "Assessment Builder (→ via class)", path: "/principal", icon: "🧪" },
          ],
        },
      ];

    case "OFFICIAL":
      return [
        {
          group: "🗺️ Overview",
          items: [
            { label: "Official Dashboard",     path: "/official",       icon: "🗺️" },
            { label: "Notifications",          path: "/notifications",  icon: "🔔" },
            { label: "Profile",                path: "/profile",        icon: "👤" },
          ],
        },
        {
          group: "🔑 Management",
          items: [
            { label: "Manage Principal Codes", path: "/official/users", icon: "🔑" },
          ],
        },
      ];

    case "ADMIN":
      return [
        {
          group: "⚙️ Admin",
          items: [
            { label: "Admin Dashboard",  path: "/admin-panel",     icon: "⚙️" },
            { label: "Notifications",    path: "/notifications",   icon: "🔔" },
            { label: "Profile",          path: "/profile",         icon: "👤" },
          ],
        },
        {
          group: "📚 Content",
          items: [
            { label: "Manage Courses & Lessons", path: "/admin/content",    icon: "📚" },
          ],
        },
        {
          group: "👥 Users",
          items: [
            { label: "Join Codes",      path: "/admin/join-codes", icon: "🔑" },
            { label: "All Users",       path: "/admin/users",      icon: "👥" },
          ],
        },
      ];

    default:
      return [];
  }
}

// ── Role accent colours (matches TopBar) ───────────────────────────────────

const ROLE_COLORS: Record<Role, string> = {
  STUDENT:   "#3b82f6",
  TEACHER:   "#10b981",
  PRINCIPAL: "#f59e0b",
  OFFICIAL:  "#8b5cf6",
  ADMIN:     "#ef4444",
};

// ── Component ──────────────────────────────────────────────────────────────

type Props = {
  role:     Role;
  username: string;
};

export default function NavMenu({ role, username }: Props) {
  const [open, setOpen] = useState(false);
  const menuRef         = useRef<HTMLDivElement>(null);
  const navigate        = useNavigate();
  const groups          = getNavGroups(role);
  const roleColor       = ROLE_COLORS[role] ?? "var(--brand-primary)";

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  if (groups.length === 0) return null;

  return (
    <div ref={menuRef} style={{ position: "relative" }}>

      {/* ── Trigger button ──────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Open navigation menu"
        aria-expanded={open}
        aria-haspopup="true"
        title="All sections for your role"
        style={{
          display:      "flex",
          alignItems:   "center",
          gap:          6,
          padding:      "5px 11px",
          background:   open ? roleColor + "18" : "var(--bg-overlay)",
          border:       "1px solid",
          borderColor:  open ? roleColor : "var(--border-subtle)",
          borderRadius: "var(--radius-md)",
          cursor:       "pointer",
          color:        open ? roleColor : "var(--text-secondary)",
          fontSize:     "var(--text-sm)",
          fontWeight:   600,
          fontFamily:   "var(--font-body)",
          transition:   "all 0.15s",
          flexShrink:   0,
          height:       34,
        }}
        onMouseEnter={(e) => {
          if (!open) {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.background   = "var(--bg-elevated)";
            b.style.color        = "var(--text-primary)";
            b.style.borderColor  = "var(--border-default)";
          }
        }}
        onMouseLeave={(e) => {
          if (!open) {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.background   = "var(--bg-overlay)";
            b.style.color        = "var(--text-secondary)";
            b.style.borderColor  = "var(--border-subtle)";
          }
        }}
      >
        {/* Hamburger */}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="3" y1="6"  x2="21" y2="6"  />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>

        {/* Label — hidden on very small screens via inline max-width trick */}
        <span style={{ whiteSpace: "nowrap" }}>Nav</span>

        {/* Chevron */}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
          aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* ── Dropdown panel ──────────────────────────────────────────────── */}
      {open && (
        <div
          role="menu"
          aria-label="Site navigation"
          style={{
            position:     "absolute",
            top:          "calc(100% + 8px)",
            left:         0,
            minWidth:     260,
            maxWidth:     300,
            maxHeight:    "calc(100vh - 80px)",
            overflowY:    "auto",
            background:   "var(--bg-elevated)",
            border:       "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)",
            boxShadow:    "0 20px 60px rgba(0,0,0,0.5)",
            zIndex:       9999,
            animation:    "fadeInUp 0.15s ease both",
          }}
        >
          {/* Panel header */}
          <div style={{
            padding:       "10px 14px 8px",
            borderBottom:  "1px solid var(--border-subtle)",
            background:    "var(--bg-surface)",
            borderRadius:  "var(--radius-lg) var(--radius-lg) 0 0",
            position:      "sticky",
            top:           0,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize:   "var(--text-sm)",
                color:      "var(--text-primary)",
              }}>
                Navigation
              </span>
              <span style={{
                fontSize:      10,
                fontWeight:    700,
                padding:       "2px 8px",
                borderRadius:  "var(--radius-full)",
                background:    roleColor + "20",
                color:         roleColor,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                flexShrink:    0,
              }}>
                {role}
              </span>
            </div>
            {/* Demo warning — remove post-capstone */}
            <div style={{
              marginTop:  "var(--space-2)",
              fontSize:   10,
              color:      "var(--text-muted)",
              fontStyle:  "italic",
              lineHeight: 1.4,
            }}>
              ⚠️ Temporary demo nav · will be redesigned post-capstone
            </div>
          </div>

          {/* Nav groups */}
          <div style={{ padding: "var(--space-1) 0 var(--space-2)" }}>
            {groups.map((group, gi) => (
              <div key={group.group}>
                {/* Group heading */}
                <div style={{
                  padding:       `${gi === 0 ? "var(--space-3)" : "var(--space-4)"} 14px var(--space-1)`,
                  fontSize:      10,
                  fontWeight:    700,
                  color:         "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}>
                  {group.group}
                </div>

                {/* Items */}
                {group.items.map((item) => (
                  <button
                    key={item.label + item.path}
                    role="menuitem"
                    onClick={() => go(item.path)}
                    style={{
                      display:    "flex",
                      alignItems: "center",
                      gap:        10,
                      width:      "100%",
                      padding:    "7px 14px",
                      background: "none",
                      border:     "none",
                      cursor:     "pointer",
                      textAlign:  "left",
                      color:      "var(--text-secondary)",
                      fontSize:   "var(--text-sm)",
                      fontWeight: 500,
                      fontFamily: "var(--font-body)",
                      transition: "all 0.1s",
                    }}
                    onMouseEnter={(e) => {
                      const b = e.currentTarget as HTMLButtonElement;
                      b.style.background = "var(--bg-overlay)";
                      b.style.color      = "var(--text-primary)";
                    }}
                    onMouseLeave={(e) => {
                      const b = e.currentTarget as HTMLButtonElement;
                      b.style.background = "none";
                      b.style.color      = "var(--text-secondary)";
                    }}
                  >
                    <span style={{ fontSize: 15, flexShrink: 0, lineHeight: 1 }} aria-hidden="true">
                      {item.icon}
                    </span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                      stroke="var(--text-muted)" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                ))}

                {/* Group divider */}
                {gi < groups.length - 1 && (
                  <div style={{
                    height:     1,
                    background: "var(--border-subtle)",
                    margin:     "var(--space-2) 14px 0",
                  }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
