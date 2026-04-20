// components/TeacherBottomNav.tsx — Mobile PWA v1
// Teacher/Principal bottom tab bar (mobile only)
// Tabs: Home | Classes | Chat | Profile
// Per GYANGRIT_MOBILE_PWA_SKILL §2.1 Teacher tabs pattern.
import { useLocation, useNavigate } from "react-router-dom";
import type { Role } from "../auth/authTypes";

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg className="bottom-nav__icon" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={active ? 2.5 : 1.8}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function ClassesIcon({ active }: { active: boolean }) {
  return (
    <svg className="bottom-nav__icon" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={active ? 2.5 : 1.8}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ChatIcon({ active }: { active: boolean }) {
  return (
    <svg className="bottom-nav__icon" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={active ? 2.5 : 1.8}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg className="bottom-nav__icon" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={active ? 2.5 : 1.8}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

interface Props {
  role: Role;
}

export default function TeacherBottomNav({ role }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const path     = location.pathname;

  const isActive = (prefixes: string[]) =>
    prefixes.some((p) => path === p || path.startsWith(p + "/") || path.startsWith(p + "?"));

  // Resolve base path by role
  const base = role === "PRINCIPAL" ? "/principal" : "/teacher";

  const tabs = [
    {
      label:  "Home",
      to:     base,
      active: isActive([base]),
      icon:   (a: boolean) => <HomeIcon    active={a} />,
    },
    {
      label:  "Classes",
      to:     `${base}/classes`,
      active: isActive([`${base}/classes`, `${base}/users`]),
      icon:   (a: boolean) => <ClassesIcon active={a} />,
    },
    {
      label:  "Chat",
      to:     `${base}/chat`,
      active: isActive([`${base}/chat`]),
      icon:   (a: boolean) => <ChatIcon    active={a} />,
    },
    {
      label:  "Profile",
      to:     "/profile",
      active: isActive(["/profile"]),
      icon:   (a: boolean) => <ProfileIcon active={a} />,
    },
  ];

  return (
    <nav className="bottom-nav" aria-label="Teacher navigation">
      {tabs.map((tab) => (
        <button
          key={tab.to}
          className={`bottom-nav__item${tab.active ? " bottom-nav__item--active" : ""}`}
          onClick={() => navigate(tab.to)}
          aria-label={tab.label}
          aria-current={tab.active ? "page" : undefined}
        >
          <span className="bottom-nav__icon-wrap">
            {tab.icon(tab.active)}
          </span>
          <span className="bottom-nav__label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
