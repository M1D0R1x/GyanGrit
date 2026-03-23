// components.NavMenu
/**
 * ⚠️  TEMPORARY SUPERVISOR DEMO NAV — NEEDS UPGRADE LATER  ⚠️
 *
 * Added for supervisor/capstone demo so every accessible section can be
 * demonstrated by clicking through this menu.
 *
 * TODO (post-capstone):
 *   - Replace with a sidebar drawer for staff roles
 *   - Students already have BottomNav — remove NavMenu from student mobile view
 *   - Remove the ⚠️ warning banner after redesign
 *   - Routes needing dynamic IDs currently link to the parent dashboard —
 *     fix properly once sidebar redesign is done
 *
 * Route access is rank-based (RequireRole checks ROLE_RANK >=):
 *   STUDENT(1) < TEACHER(2) < PRINCIPAL(3) < OFFICIAL(4) < ADMIN(5)
 */

import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { Role } from "../auth/authTypes";

// ── Types ──────────────────────────────────────────────────────────────────

type NavItem = {
  label: string;
  path:  string;
  icon:  string;
  note?: string;  // shown greyed as a sub-label; item still navigates to path
};

type NavGroup = {
  group: string;
  items: NavItem[];
};

// ── Role-aware route map ───────────────────────────────────────────────────

function getNavGroups(role: Role): NavGroup[] {
  switch (role) {

    case "STUDENT":
      return [
        {
          group: "Home",
          items: [
            { label: "Dashboard",        path: "/dashboard",   icon: "🏠" },
            { label: "Profile & Badges", path: "/profile",     icon: "👤" },
            { label: "Leaderboard",      path: "/leaderboard", icon: "🏆" },
            { label: "Notifications",    path: "/notifications", icon: "🔔" },
          ],
        },
        {
          group: "Learning",
          items: [
            { label: "All Courses",    path: "/courses",  icon: "📚" },
            { label: "Learning Paths", path: "/learning", icon: "🗺️" },
          ],
        },
        {
          group: "Assessments",
          items: [
            { label: "All Assessments", path: "/assessments",         icon: "📋" },
            { label: "Attempt History", path: "/assessments/history", icon: "🕑" },
          ],
        },
        {
          group: "Communication",
          items: [
            { label: "Class Chat",     path: "/chat",          icon: "💬" },
            { label: "Competitions",   path: "/competitions",  icon: "🏆" },
          ],
        },
      ];

    case "TEACHER":
      return [
        {
          group: "Overview",
          items: [
            { label: "Teacher Dashboard", path: "/teacher",       icon: "📊" },
            { label: "Notifications",     path: "/notifications", icon: "🔔" },
            { label: "Profile",           path: "/profile",       icon: "👤" },
          ],
        },
        {
          group: "Classes & Content",
          items: [
            { label: "Class Detail",       path: "/teacher", icon: "🏫", note: "select from dashboard → class card" },
            { label: "Gradebook",          path: "/teacher", icon: "📝", note: "dashboard → class → Gradebook button" },
            { label: "Student Detail",     path: "/teacher", icon: "👤", note: "dashboard → class → student row" },
            { label: "Lesson Editor",      path: "/teacher", icon: "✏️", note: "dashboard → course card → Edit Lessons" },
            { label: "Assessment Builder", path: "/teacher", icon: "🧪", note: "dashboard → course card → Edit Assessments" },
          ],
        },
        {
          group: "Students & Codes",
          items: [
            { label: "Join Codes & Students", path: "/teacher/users", icon: "🔑" },
          ],
        },
        {
          group: "Communication",
          items: [
            { label: "Class Chat",   path: "/teacher/chat",         icon: "💬" },
            { label: "Competitions", path: "/teacher/competitions",  icon: "🏆" },
          ],
        },
      ];

    case "PRINCIPAL":
      return [
        {
          group: "Overview",
          items: [
            { label: "Principal Dashboard", path: "/principal",       icon: "🏫" },
            { label: "Notifications",       path: "/notifications",   icon: "🔔" },
            { label: "Profile",             path: "/profile",         icon: "👤" },
          ],
        },
        {
          group: "Classes & Content",
          items: [
            { label: "Class Detail",       path: "/principal", icon: "🏠", note: "select from dashboard → class card" },
            { label: "Gradebook",          path: "/principal", icon: "📝", note: "dashboard → class → Gradebook button" },
            { label: "Lesson Editor",      path: "/principal", icon: "✏️", note: "dashboard → course card → Edit Lessons" },
            { label: "Assessment Builder", path: "/principal", icon: "🧪", note: "dashboard → course card → Edit Assessments" },
          ],
        },
        {
          group: "Staff & Codes",
          items: [
            { label: "Join Codes & Staff", path: "/principal/users", icon: "🔑" },
          ],
        },
        {
          group: "Communication",
          items: [
            { label: "Class Chat",   path: "/principal/chat",         icon: "💬" },
            { label: "Competitions", path: "/principal/competitions",  icon: "🏆" },
          ],
        },
      ];

    case "OFFICIAL":
      return [
        {
          group: "Overview",
          items: [
            { label: "Official Dashboard",     path: "/official",       icon: "🗺️" },
            { label: "Notifications",          path: "/notifications",  icon: "🔔" },
            { label: "Profile",                path: "/profile",        icon: "👤" },
          ],
        },
        {
          group: "Management",
          items: [
            { label: "Manage Principal Codes", path: "/official/users", icon: "🔑" },
          ],
        },
      ];

    case "ADMIN":
      return [
        {
          group: "Admin",
          items: [
            { label: "Admin Dashboard", path: "/admin-panel",   icon: "⚙️" },
            { label: "Notifications",   path: "/notifications", icon: "🔔" },
            { label: "Profile",         path: "/profile",       icon: "👤" },
          ],
        },
        {
          group: "Content",
          items: [
            { label: "Manage Courses",     path: "/admin/content",    icon: "📚" },
            { label: "Lesson Editor",      path: "/admin/content",    icon: "✏️", note: "Courses → course → Edit Lessons" },
            { label: "Assessment Builder", path: "/admin/content",    icon: "🧪", note: "Courses → course → Edit Assessments" },
          ],
        },
        {
          group: "Users",
          items: [
            { label: "Join Codes", path: "/admin/join-codes", icon: "🔑" },
            { label: "All Users",  path: "/admin/users",      icon: "👥" },
          ],
        },
        {
          group: "Communication",
          items: [
            { label: "Class Chat",      path: "/admin/chat",            icon: "💬" },
            { label: "Chat Management", path: "/admin/chat-management",  icon: "🗂️" },
            { label: "Competitions",    path: "/admin/competitions",     icon: "🏆" },
          ],
        },
      ];

    default:
      return [];
  }
}

// ── Role colours ──────────────────────────────────────────────────────────

const ROLE_COLORS: Record<Role, string> = {
  STUDENT:   "#3b82f6",
  TEACHER:   "#10b981",
  PRINCIPAL: "#f59e0b",
  OFFICIAL:  "#8b5cf6",
  ADMIN:     "#ef4444",
};

// ── Component ──────────────────────────────────────────────────────────────

export default function NavMenu({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const menuRef         = useRef<HTMLDivElement>(null);
  const navigate        = useNavigate();
  const groups          = getNavGroups(role);
  const roleColor       = ROLE_COLORS[role] ?? "var(--brand-primary)";

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const go = (path: string) => { setOpen(false); navigate(path); };

  if (groups.length === 0) return null;

  return (
    <div ref={menuRef} style={{ position: "relative" }}>

      {/* ── Trigger ─────────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Open navigation menu"
        aria-expanded={open}
        aria-haspopup="true"
        style={{
          display:      "flex",
          alignItems:   "center",
          gap:          6,
          padding:      "5px 11px",
          height:       34,
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
        }}
        onMouseEnter={(e) => {
          if (!open) {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.background  = "var(--bg-elevated)";
            b.style.color       = "var(--text-primary)";
            b.style.borderColor = "var(--border-default)";
          }
        }}
        onMouseLeave={(e) => {
          if (!open) {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.background  = "var(--bg-overlay)";
            b.style.color       = "var(--text-secondary)";
            b.style.borderColor = "var(--border-subtle)";
          }
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="3" y1="6"  x2="21" y2="6"  />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
        <span style={{ whiteSpace: "nowrap" }}>Nav</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.15s" }}
          aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* ── Panel ───────────────────────────────────────────────────────── */}
      {open && (
        <div
          role="menu"
          aria-label="Site navigation"
          style={{
            position:     "absolute",
            top:          "calc(100% + 8px)",
            left:         0,
            minWidth:     268,
            maxWidth:     320,
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
          {/* Header */}
          <div style={{
            padding:      "10px 14px 8px",
            borderBottom: "1px solid var(--border-subtle)",
            background:   "var(--bg-surface)",
            borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
            position:     "sticky",
            top:          0,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{
                fontFamily: "var(--font-display)", fontWeight: 700,
                fontSize: "var(--text-sm)", color: "var(--text-primary)",
              }}>
                Navigation
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700,
                padding: "2px 8px", borderRadius: "var(--radius-full)",
                background: roleColor + "20", color: roleColor,
                letterSpacing: "0.05em", textTransform: "uppercase", flexShrink: 0,
              }}>
                {role}
              </span>
            </div>
            <div style={{ marginTop: "var(--space-2)", fontSize: 10, color: "var(--text-muted)", fontStyle: "italic" }}>
              ⚠️ Temporary demo nav · will be redesigned post-capstone
            </div>
          </div>

          {/* Groups */}
          <div style={{ padding: "var(--space-1) 0 var(--space-2)" }}>
            {groups.map((group, gi) => (
              <div key={group.group}>
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

                {group.items.map((item) => (
                  <button
                    key={item.label}
                    role="menuitem"
                    onClick={() => go(item.path)}
                    style={{
                      display:    "flex",
                      alignItems: item.note ? "flex-start" : "center",
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
                      b.style.color = "var(--text-primary)";
                    }}
                    onMouseLeave={(e) => {
                      const b = e.currentTarget as HTMLButtonElement;
                      b.style.background = "none";
                      b.style.color = "var(--text-secondary)";
                    }}
                  >
                    <span style={{ fontSize: 14, flexShrink: 0, lineHeight: item.note ? "20px" : 1 }} aria-hidden="true">
                      {item.icon}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block" }}>{item.label}</span>
                      {item.note && (
                        <span style={{
                          display:   "block",
                          fontSize:  10,
                          color:     "var(--text-muted)",
                          fontStyle: "italic",
                          marginTop: 1,
                        }}>
                          {item.note}
                        </span>
                      )}
                    </span>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                      stroke="var(--text-muted)" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round"
                      style={{ flexShrink: 0, marginTop: item.note ? 4 : 0 }}
                      aria-hidden="true">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                ))}

                {gi < groups.length - 1 && (
                  <div style={{
                    height: 1, background: "var(--border-subtle)",
                    margin: "var(--space-2) 14px 0",
                  }} />
                )}
              </div>
            ))}
          </div>

          {/* Footer hint */}
          <div style={{
            padding:   "var(--space-2) 14px var(--space-3)",
            borderTop: "1px solid var(--border-subtle)",
            fontSize:  10, color: "var(--text-muted)", lineHeight: 1.5,
          }}>
            Items with an italic note require selecting a specific record first.
          </div>
        </div>
      )}
    </div>
  );
}
