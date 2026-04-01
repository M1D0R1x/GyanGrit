// components/Sidebar.tsx — V4 Nefee+Emil
// Pure nav content component. Zero positioning logic — AppLayout owns that.
import { useNavigate, useLocation } from "react-router-dom";
import type { Role } from "../auth/authTypes";
import Logo from "./Logo";
import LogoutButton from "./LogoutButton";

// ── Types ─────────────────────────────────────────────────────────

type NavItem = {
  label:  string;
  path:   string;
  icon:   React.ReactNode;
  exact?: boolean;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

// ── Icon set ──────────────────────────────────────────────────────

const Ico = ({ d, d2 }: { d: string; d2?: string }) => (
  <svg className="sidebar__icon" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
    {d2 && <path d={d2} />}
  </svg>
);
const IcoP = ({ children }: { children: React.ReactNode }) => (
  <svg className="sidebar__icon" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const HomeIcon    = () => <IcoP><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></IcoP>;
const BookIcon    = () => <IcoP><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></IcoP>;
const MapIcon     = () => <IcoP><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></IcoP>;
const CheckIcon   = () => <IcoP><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></IcoP>;
const CardIcon    = () => <IcoP><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></IcoP>;
const VideoIcon   = () => <IcoP><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></IcoP>;
const BotIcon     = () => <IcoP><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></IcoP>;
const TrophyIcon  = () => <Ico d="M7 4H17l-1 7a5 5 0 0 1-8 0L7 4z" d2="M7 4H4v3a3 3 0 0 0 3 3M17 4h3v3a3 3 0 0 1-3 3"/>;
const ChatIcon    = () => <Ico d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />;
const ChartIcon   = () => <IcoP><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></IcoP>;
const UserIcon    = () => <IcoP><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></IcoP>;
const BellIcon    = () => <IcoP><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></IcoP>;
const GridIcon    = () => <IcoP><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></IcoP>;
const UsersIcon   = () => <IcoP><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></IcoP>;
const KeyIcon     = () => <IcoP><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></IcoP>;
const EditIcon    = () => <IcoP><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></IcoP>;
const SchoolIcon  = () => <IcoP><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></IcoP>;
const HistoryIcon = () => <IcoP><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></IcoP>;

// ── Role nav config ────────────────────────────────────────────────

function getNavSections(role: Role): NavSection[] {
  switch (role) {
    case "STUDENT": return [
      { title: "Home", items: [
        { label: "Dashboard",     path: "/dashboard",           icon: <HomeIcon />,    exact: true },
        { label: "Notifications", path: "/notifications",       icon: <BellIcon /> },
        { label: "Profile",       path: "/profile",             icon: <UserIcon /> },
        { label: "Leaderboard",   path: "/leaderboard",         icon: <ChartIcon /> },
      ]},
      { title: "Learning", items: [
        { label: "Courses",        path: "/courses",             icon: <BookIcon /> },
        { label: "Learning Paths", path: "/learning",            icon: <MapIcon /> },
        { label: "Flashcards",     path: "/flashcards",          icon: <CardIcon /> },
        { label: "Live Classes",   path: "/live",                icon: <VideoIcon /> },
        { label: "AI Tutor",       path: "/ai-tutor",            icon: <BotIcon /> },
      ]},
      { title: "Assessments", items: [
        { label: "All Tests",  path: "/assessments",         icon: <CheckIcon /> },
        { label: "History",    path: "/assessments/history", icon: <HistoryIcon /> },
      ]},
      { title: "Community", items: [
        { label: "Class Chat",   path: "/chat",          icon: <ChatIcon /> },
        { label: "Competitions", path: "/competitions",  icon: <TrophyIcon /> },
      ]},
    ];

    case "TEACHER": return [
      { title: "Overview", items: [
        { label: "Dashboard",     path: "/teacher",        icon: <GridIcon />, exact: true },
        { label: "Notifications", path: "/notifications",  icon: <BellIcon /> },
        { label: "Profile",       path: "/profile",        icon: <UserIcon /> },
      ]},
      { title: "Teaching", items: [
        { label: "My Classes",      path: "/teacher",                icon: <SchoolIcon /> },
        { label: "Live Classes",    path: "/teacher/live",           icon: <VideoIcon /> },
        { label: "Flashcard Decks", path: "/teacher/flashcards",     icon: <CardIcon /> },
      ]},
      { title: "Students & Codes", items: [
        { label: "Join Codes", path: "/teacher/users", icon: <KeyIcon /> },
      ]},
      { title: "Communication", items: [
        { label: "Class Chat",   path: "/teacher/chat",         icon: <ChatIcon /> },
        { label: "Competitions", path: "/teacher/competitions", icon: <TrophyIcon /> },
      ]},
    ];

    case "PRINCIPAL": return [
      { title: "Overview", items: [
        { label: "Dashboard",     path: "/principal",       icon: <GridIcon />, exact: true },
        { label: "Notifications", path: "/notifications",   icon: <BellIcon /> },
        { label: "Profile",       path: "/profile",         icon: <UserIcon /> },
      ]},
      { title: "School", items: [
        { label: "All Classes", path: "/principal",       icon: <SchoolIcon /> },
        { label: "Live Classes", path: "/principal/live", icon: <VideoIcon /> },
      ]},
      { title: "Staff & Codes", items: [
        { label: "Join Codes", path: "/principal/users", icon: <KeyIcon /> },
      ]},
      { title: "Communication", items: [
        { label: "Class Chat",   path: "/principal/chat",         icon: <ChatIcon /> },
        { label: "Competitions", path: "/principal/competitions", icon: <TrophyIcon /> },
      ]},
    ];

    case "OFFICIAL": return [
      { title: "Overview", items: [
        { label: "Dashboard",     path: "/official",      icon: <GridIcon />, exact: true },
        { label: "Notifications", path: "/notifications", icon: <BellIcon /> },
        { label: "Profile",       path: "/profile",       icon: <UserIcon /> },
      ]},
      { title: "Management", items: [
        { label: "Principal Codes", path: "/official/users", icon: <KeyIcon /> },
      ]},
    ];

    case "ADMIN": return [
      { title: "Admin", items: [
        { label: "Dashboard",     path: "/admin-panel",   icon: <GridIcon />, exact: true },
        { label: "Notifications", path: "/notifications", icon: <BellIcon /> },
        { label: "Profile",       path: "/profile",       icon: <UserIcon /> },
      ]},
      { title: "Content", items: [
        { label: "Manage Courses", path: "/admin/content", icon: <BookIcon /> },
      ]},
      { title: "Users", items: [
        { label: "All Users",  path: "/admin/users",      icon: <UsersIcon /> },
        { label: "Join Codes", path: "/admin/join-codes", icon: <KeyIcon /> },
      ]},
      { title: "Communication", items: [
        { label: "Chat Rooms",      path: "/admin/chat",            icon: <ChatIcon /> },
        { label: "Chat Management", path: "/admin/chat-management", icon: <EditIcon /> },
        { label: "Competitions",    path: "/admin/competitions",    icon: <TrophyIcon /> },
        { label: "Live Classes",    path: "/admin/live",            icon: <VideoIcon /> },
        { label: "Flashcards",      path: "/admin/flashcards",      icon: <CardIcon /> },
        { label: "AI Tutor",        path: "/admin/ai-tutor",        icon: <BotIcon /> },
      ]},
    ];

    default: return [];
  }
}

const ROLE_COLORS: Record<string, string> = {
  STUDENT:   "var(--role-student)",
  TEACHER:   "var(--role-teacher)",
  PRINCIPAL: "var(--role-principal)",
  OFFICIAL:  "var(--role-official)",
  ADMIN:     "var(--role-admin)",
};

const ROLE_GLOW: Record<string, string> = {
  STUDENT:   "rgba(14,165,233,0.12)",
  TEACHER:   "rgba(16,185,129,0.12)",
  PRINCIPAL: "rgba(245,158,11,0.12)",
  OFFICIAL:  "rgba(139,92,246,0.12)",
  ADMIN:     "rgba(244,63,94,0.12)",
};

// ── Component ──────────────────────────────────────────────────────

type Props = {
  role:      Role;
  username:  string;
  /** Called when a nav item is clicked — lets drawer close itself */
  onNavigate?: () => void;
};

export default function SidebarContent({ role, username, onNavigate }: Props) {
  const navigate  = useNavigate();
  const location  = useLocation();

  const sections  = getNavSections(role);
  const roleColor = ROLE_COLORS[role] ?? "var(--saffron)";
  const roleGlow  = ROLE_GLOW[role]   ?? "rgba(245,158,11,0.12)";

  const isActive = (item: NavItem) =>
    item.exact
      ? location.pathname === item.path
      : location.pathname === item.path || location.pathname.startsWith(item.path + "/");

  const go = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  return (
    <div className="sidebar-content">
      {/* Logo header */}
      <div className="sidebar-content__header">
        <Logo size="sm" variant="full" />
      </div>

      {/* Nav sections */}
      <nav className="sidebar-content__nav" aria-label="Main navigation">
        {sections.map((section) => (
          <div key={section.title} className="sidebar-content__section">
            <div className="sidebar-content__section-label">{section.title}</div>
            {section.items.map((item) => {
              const active = isActive(item);
              return (
                <button
                  key={item.label}
                  className={`sidebar-content__item${active ? " sidebar-content__item--active" : ""}`}
                  style={active ? {
                    background: roleGlow,
                    color:      roleColor,
                  } : undefined}
                  onClick={() => go(item.path)}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="sidebar-content__icon"
                    style={active ? { color: roleColor } : undefined}>
                    {item.icon}
                  </span>
                  <span className="sidebar-content__label">{item.label}</span>
                  {active && (
                    <span className="sidebar-content__active-dot"
                      style={{ background: roleColor }} />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="sidebar-content__footer">
        {/* User chip */}
        <div className="sidebar-content__user">
          <div className="sidebar-content__avatar"
            style={{ background: roleGlow, border: `1.5px solid ${roleColor}40` }}>
            <span style={{ color: roleColor, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 12 }}>
              {username.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="sidebar-content__user-info">
            <div className="sidebar-content__user-name">{username}</div>
            <div className="sidebar-content__user-role" style={{ color: roleColor }}>{role}</div>
          </div>
        </div>
        <LogoutButton onLogout={onNavigate} />
      </div>
    </div>
  );
}
