import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import Logo from './Logo';
import SidebarDrawer from './SidebarDrawer';

interface TopBarProps {
  title?: string;
}

const TopBar: React.FC<TopBarProps> = ({ title }) => {
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const role = (user?.role?.toLowerCase() || 'student');

  return (
    <>
      <header className="topbar glass animate-fade-up">
        <div className="topbar__left" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <button 
            className="btn--ghost" 
            style={{ fontSize: '24px', padding: 'var(--space-2)' }}
            onClick={() => setIsSidebarOpen(true)}
          >
            ☰
          </button>
          <Logo />
        </div>

        {title && (
          <div className="topbar__title" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
            {title}
          </div>
        )}

        <div className="topbar__right">
          <div className="topbar__user" style={{ padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-full)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
             <div className="topbar__avatar" style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--brand-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>
              {user?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="topbar__username" style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
              {user?.username || 'Guest'}
            </div>
          </div>
        </div>
      </header>

      <SidebarDrawer 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />
    </>
  );
};

export default TopBar;
