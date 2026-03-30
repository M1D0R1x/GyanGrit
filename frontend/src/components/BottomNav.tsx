// components.BottomNav — Chalk & Sunlight v3
import { useLocation, useNavigate } from "react-router-dom";

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

function CoursesIcon({ active }: { active: boolean }) {
  return (
    <svg className="bottom-nav__icon" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={active ? 2.5 : 1.8}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function TestsIcon({ active }: { active: boolean }) {
  return (
    <svg className="bottom-nav__icon" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={active ? 2.5 : 1.8}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
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

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const path     = location.pathname;

  const isActive = (prefixes: string[]) =>
    prefixes.some((p) => path === p || path.startsWith(p + "/") || path.startsWith(p + "?"));

  const tabs = [
    { label: "Home",    to: "/dashboard",   active: isActive(["/dashboard"]),                              icon: (a: boolean) => <HomeIcon    active={a} /> },
    { label: "Courses", to: "/courses",     active: isActive(["/courses", "/lessons", "/learning"]),       icon: (a: boolean) => <CoursesIcon active={a} /> },
    { label: "Tests",   to: "/assessments", active: isActive(["/assessments", "/assessment-result"]),      icon: (a: boolean) => <TestsIcon   active={a} /> },
    { label: "Chat",    to: "/chat",        active: isActive(["/chat"]),                                   icon: (a: boolean) => <ChatIcon    active={a} /> },
    { label: "Profile", to: "/profile",     active: isActive(["/profile"]),                                icon: (a: boolean) => <ProfileIcon active={a} /> },
  ];

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {tabs.map((tab) => (
        <button
          key={tab.to}
          className={`bottom-nav__item${tab.active ? " bottom-nav__item--active" : ""}`}
          onClick={() => navigate(tab.to)}
          aria-label={tab.label}
          aria-current={tab.active ? "page" : undefined}
        >
          {tab.icon(tab.active)}
          <span className="bottom-nav__label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
