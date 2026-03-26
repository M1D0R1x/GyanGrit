import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Library, 
  CheckCircle2, 
  MessageSquare, 
  User 
} from 'lucide-react';
import './BottomNav.css';

const BottomNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  const isActive = (prefixes: string[]) =>
    prefixes.some((p) => path === p || path.startsWith(p + "/") || path.startsWith(p + "?"));

  const tabs = [
    {
      label: "Home",
      to: "/dashboard",
      active: isActive(["/dashboard"]),
      icon: <LayoutDashboard size={20} />,
    },
    {
      label: "Courses",
      to: "/courses",
      active: isActive(["/courses", "/lessons", "/learning"]),
      icon: <Library size={20} />,
    },
    {
      label: "Tests",
      to: "/assessments",
      active: isActive(["/assessments", "/assessment-result"]),
      icon: <CheckCircle2 size={20} />,
    },
    {
      label: "Chat",
      to: "/chat",
      active: isActive(["/chat"]),
      icon: <MessageSquare size={20} />,
    },
    {
      label: "Profile",
      to: "/profile",
      active: isActive(["/profile"]),
      icon: <User size={20} />,
    },
  ];

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => (
        <button
          key={tab.to}
          className={`bottom-nav-item ${tab.active ? 'bottom-nav-item--active' : ''}`}
          onClick={() => navigate(tab.to)}
          aria-label={tab.label}
        >
          <div className="bottom-nav-item__glow" />
          <span className="bottom-nav-item__icon">{tab.icon}</span>
          <span className="bottom-nav-item__label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
};

export default BottomNav;
