// components.Sidebar — Chalk & Sunlight v3
// Role-aware sidebar drawer. Replaces NavMenu.
// Desktop: persistent 260px left panel.
// Mobile: slide-over drawer triggered by TopBar hamburger.
import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import type { Role } from "../auth/authTypes";
import Logo from "./Logo";
import LogoutButton from "./LogoutButton";

// ── Types ─────────────────────────────────────────────────────────

type NavItem = {
  label: string;
  path:  string;
  icon:  React.ReactNode;
  exact?: boolean;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

// ── Icon helpers ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _I = ({ d, ...p }: { d: string; [k: string]: unknown }) => (
  <svg className="sidebar__icon" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    {...p}>
    <path d={d} />
  </svg>
);

function HomeIcon()         { return <svg className="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>; }
function BookIcon()         { return <svg className="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>; }
function MapIcon()          { return <svg className="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>; }
function ClipboardIcon()    { return <svg className="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>; }
function CardsIcon()        { return <svg className="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>; }
function VideoIcon()        { return <svg className="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>; }
function BotIcon()          { return <svg className="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>; }
function TrophyIcon()       { return <svg className="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="8 21 12 21 16 21"/><line x1="12" y1="17" x2="12" y2="21"/><path d="M7 4H17l-1 7a5 5 0 0 1-8 0L7 4z"/><path d="M7 4H4v3a3 3 0 0 0 3 3"/><path d="M17 4h3v3a3 3 0 0 1-3 3"/></svg>; }
function ChatIcon()         { return <svg className="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>; }
function LeaderIcon()       { return <svg className="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>; }
function UserIcon()         { return <svg className="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }
function BellIcon()         { return <svg className="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>; }
function GridIcon()         { return <svg className="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>; }
function UsersIcon()        { return <svg className="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function KeyIcon()          { return <svg className="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>; }
function EditIcon()         { return <svg className="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>; }
function SchoolIcon()       { return <svg className="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>; }
function ChartIcon()        { return <svg className="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>; }

// ── Role-based nav config ──────────────────────────────────────────

function getNavSections(role: Role): NavSection[] {
  switch (role) {
    case "STUDENT":
      return [
        { title: "Home", items: [
          { label: "Dashboard",      path: "/dashboard",         icon: <HomeIcon />, exact: true },
          { label: "Notifications",  path: "/notifications",     icon: <BellIcon /> },
          { label: "Profile",        path: "/profile",           icon: <UserIcon /> },
          { label: "Leaderboard",    path: "/leaderboard",       icon: <LeaderIcon /> },
        ]},
        { title: "Learning", items: [
          { label: "Courses",        path: "/courses",           icon: <BookIcon /> },
          { label: "Learning Paths", path: "/learning",          icon: <MapIcon /> },
          { label: "Flashcards",     path: "/flashcards",        icon: <CardsIcon /> },
          { label: "Live Classes",   path: "/live",              icon: <VideoIcon /> },
          { label: "AI Tutor",       path: "/ai-tutor",          icon: <BotIcon /> },
        ]},
        { title: "Assessments", items: [
          { label: "All Tests",      path: "/assessments",       icon: <ClipboardIcon /> },
          { label: "History",        path: "/assessments/history", icon: <ChartIcon /> },
        ]},
        { title: "Community", items: [
          { label: "Class Chat",     path: "/chat",              icon: <ChatIcon /> },
          { label: "Competitions",   path: "/competitions",      icon: <TrophyIcon /> },
        ]},
      ];

    case "TEACHER":
      return [
        { title: "Overview", items: [
          { label: "Dashboard",        path: "/teacher",              icon: <GridIcon />, exact: true },
          { label: "Notifications",    path: "/notifications",        icon: <BellIcon /> },
          { label: "Profile",          path: "/profile",              icon: <UserIcon /> },
        ]},
        { title: "Teaching", items: [
          { label: "My Classes",       path: "/teacher",              icon: <SchoolIcon /> },
          { label: "Live Classes",     path: "/teacher/live",         icon: <VideoIcon /> },
          { label: "Flashcard Decks",  path: "/teacher/flashcards",   icon: <CardsIcon /> },
        ]},
        { title: "Students & Codes", items: [
          { label: "Join Codes",       path: "/teacher/users",        icon: <KeyIcon /> },
        ]},
        { title: "Communication", items: [
          { label: "Class Chat",       path: "/teacher/chat",         icon: <ChatIcon /> },
          { label: "Competitions",     path: "/teacher/competitions", icon: <TrophyIcon /> },
        ]},
      ];

    case "PRINCIPAL":
      return [
        { title: "Overview", items: [
          { label: "Dashboard",        path: "/principal",             icon: <GridIcon />, exact: true },
          { label: "Notifications",    path: "/notifications",         icon: <BellIcon /> },
          { label: "Profile",          path: "/profile",               icon: <UserIcon /> },
        ]},
        { title: "School", items: [
          { label: "All Classes",      path: "/principal",             icon: <SchoolIcon /> },
          { label: "Live Classes",     path: "/principal/live",        icon: <VideoIcon /> },
        ]},
        { title: "Staff & Codes", items: [
          { label: "Join Codes",       path: "/principal/users",       icon: <KeyIcon /> },
        ]},
        { title: "Communication", items: [
          { label: "Class Chat",       path: "/principal/chat",        icon: <ChatIcon /> },
          { label: "Competitions",     path: "/principal/competitions",icon: <TrophyIcon /> },
        ]},
      ];

    case "OFFICIAL":
      return [
        { title: "Overview", items: [
          { label: "Dashboard",          path: "/official",             icon: <GridIcon />, exact: true },
          { label: "Notifications",      path: "/notifications",        icon: <BellIcon /> },
          { label: "Profile",            path: "/profile",              icon: <UserIcon /> },
        ]},
        { title: "Management", items: [
          { label: "Principal Codes",    path: "/official/users",       icon: <KeyIcon /> },
        ]},
      ];

    case "ADMIN":
      return [
        { title: "Admin", items: [
          { label: "Dashboard",          path: "/admin-panel",          icon: <GridIcon />, exact: true },
          { label: "Notifications",      path: "/notifications",        icon: <BellIcon /> },
          { label: "Profile",            path: "/profile",              icon: <UserIcon /> },
        ]},
        { title: "Content", items: [
          { label: "Manage Courses",     path: "/admin/content",        icon: <BookIcon /> },
        ]},
        { title: "Users", items: [
          { label: "All Users",          path: "/admin/users",          icon: <UsersIcon /> },
          { label: "Join Codes",         path: "/admin/join-codes",     icon: <KeyIcon /> },
        ]},
        { title: "Communication", items: [
          { label: "Chat Rooms",         path: "/admin/chat",           icon: <ChatIcon /> },
          { label: "Chat Management",    path: "/admin/chat-management",icon: <EditIcon /> },
          { label: "Competitions",       path: "/admin/competitions",   icon: <TrophyIcon /> },
          { label: "Live Classes",       path: "/admin/live",           icon: <VideoIcon /> },
          { label: "Flashcards",         path: "/admin/flashcards",     icon: <CardsIcon /> },
          { label: "AI Tutor",           path: "/admin/ai-tutor",       icon: <BotIcon /> },
        ]},
      ];

    default:
      return [];
  }
}

const ROLE_COLORS: Record<string, string> = {
  STUDENT:   "#0EA5E9",
  TEACHER:   "#10B981",
  PRINCIPAL: "#F59E0B",
  OFFICIAL:  "#8B5CF6",
  ADMIN:     "#F43F5E",
};

// ── Component ──────────────────────────────────────────────────────

type Props = {
  role:      Role;
  username:  string;
  open:      boolean;
  onClose:   () => void;
};

export default function Sidebar({ role, username, open, onClose }: Props) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const sidebarRef = useRef<HTMLElement>(null);

  const sections   = getNavSections(role);
  const roleColor  = ROLE_COLORS[role] ?? "#F59E0B";

  // Close on outside click (mobile)
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Lock body scroll on mobile when open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else       document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const isActive = (item: NavItem) => {
    if (item.exact) return location.pathname === item.path;
    return location.pathname === item.path ||
      location.pathname.startsWith(item.path + "/");
  };

  const go = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="sidebar-overlay sidebar-overlay--visible"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        ref={sidebarRef}
        className={`sidebar${open ? " sidebar--open" : ""}`}
        aria-label="Site navigation"
        role="navigation"
      >
        {/* Header */}
        <div className="sidebar__header">
          <Logo size="sm" variant="full" />
          <button
            className="sidebar__close-btn"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Nav sections */}
        <nav className="sidebar__nav">
          {sections.map((section) => (
            <div key={section.title}>
              <div className="sidebar__section-label">{section.title}</div>
              {section.items.map((item) => {
                const active = isActive(item);
                return (
                  <button
                    key={item.label}
                    className={`sidebar__item${active ? " sidebar__item--active" : ""}`}
                    onClick={() => go(item.path)}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.icon}
                    <span className="sidebar__item-text">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar__footer">
          <div className="sidebar__user-info">
            <div style={{
              width:           36, height: 36,
              borderRadius:    "50%",
              background:      roleColor,
              display:         "flex",
              alignItems:      "center",
              justifyContent:  "center",
              fontSize:        11,
              fontWeight:      800,
              color:           "#fff",
              flexShrink:      0,
              fontFamily:      "var(--font-display)",
            }}>
              {username.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sidebar__user-name">{username}</div>
              <div className="sidebar__user-role" style={{ color: roleColor }}>
                {role}
              </div>
            </div>
          </div>

          <LogoutButton onLogout={onClose} />
        </div>
      </aside>
    </>
  );
}
