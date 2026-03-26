import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getNavGroups, type Role } from '../utils/navigation';
import Logo from './Logo';
import './SidebarDrawer.css';

interface SidebarDrawerProps {
  isOpen:  boolean;
  onClose: () => void;
}

const SidebarDrawer: React.FC<SidebarDrawerProps> = ({ isOpen, onClose }: SidebarDrawerProps) => {
  const { user } = useAuth();
  const location = useLocation();

  const role = (user?.role?.toUpperCase() || 'STUDENT') as Role;
  const groups = getNavGroups(role);

  return (
    <>
      <div 
        className={`sidebar-overlay ${isOpen ? 'sidebar-overlay--visible' : ''}`}
        onClick={onClose}
      />
      
      <aside className={`sidebar-drawer sidebar-drawer--${role.toLowerCase()} ${isOpen ? 'sidebar-drawer--open' : ''}`}>
        {/* Role Accent */}
        <div className={`sidebar-accent-bar sidebar-accent-bar--${role}`} />

        <div className="sidebar-header">
          <Logo />
        </div>

        <nav className="sidebar-nav">
          {groups.map((group) => (
            <div key={group.group} className="nav-group">
              <div className="nav-group-header">{group.group}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }: { isActive: boolean }) => 
                    `nav-item ${isActive ? 'nav-item--active' : ''}`
                  }
                  onClick={onClose}
                >
                  <span className="nav-item__icon">{item.icon}</span>
                  <div className="nav-item__content">
                    <span className="nav-item__label">{item.label}</span>
                    {item.note && <span className="nav-item__note">{item.note}</span>}
                  </div>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <footer className="sidebar-footer">
          <div className="user-pill-mini">
            <div className={`user-avatar-mini role-bg--${role}`}>
              {user?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="user-info-mini">
              <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)' }}>
                {user?.full_name || 'Guest User'}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {role}
              </div>
            </div>
          </div>
        </footer>
      </aside>
    </>
  );
};

export default SidebarDrawer;
