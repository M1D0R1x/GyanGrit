// components/AppLayout.tsx — V4 Final
// Hamburger: click to open, click again to close, click outside to close,
// nav item click closes. All via controlled open state + toggle.
import { useState, useEffect, useCallback } from "react";
import { Drawer } from "vaul";
import { toast } from "sonner";
import TopBar from "./TopBar";
import SidebarContent from "./Sidebar";
import BottomNav from "./BottomNav";
import OfflineStatusBar from "./OfflineStatusBar";
import { useAuth } from "../auth/AuthContext";
import type { Role } from "../auth/authTypes";
import { usePageTracking } from "../utils/telemetry";
import { useStorageCleaned } from "../hooks/useOffline";

interface AppLayoutProps {
  children:  React.ReactNode;
  title?:    string;
}

export default function AppLayout({ children, title }: AppLayoutProps) {
  usePageTracking();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [offlineBannerDismissed, setOfflineBannerDismissed] = useState(false);
  const auth = useAuth();

  // Notify user when auto-cleanup removes stale downloads
  useStorageCleaned((removed) => {
    toast.warning(
      `Storage was getting full — ${removed} old download${removed !== 1 ? "s" : ""} removed automatically.`,
      { duration: 5000 }
    );
  });

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  // Reset banner dismiss state when offlineMode changes (e.g. back online)
  useEffect(() => {
    if (!auth.offlineMode) setOfflineBannerDismissed(false);
  }, [auth.offlineMode]);

  // Pure toggle — called only by the hamburger button in TopBar
  const handleMenuClick = useCallback(() => {
    setDrawerOpen(prev => !prev);
  }, []);

  const role      = (auth.user?.role     ?? "STUDENT") as Role;
  const username  =  auth.user?.username ?? "";
  const isStudent = role === "STUDENT";

  const showOfflineBanner = auth.offlineMode && !offlineBannerDismissed;

  return (
    <div className="app-shell">
      <OfflineStatusBar />
      <TopBar title={title} onMenuClick={handleMenuClick} />

      {/* Persistent offline-mode banner — shows when authenticated via cached profile */}
      {showOfflineBanner && (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--space-3)",
            padding: "var(--space-3) var(--space-5)",
            background: "linear-gradient(-20.95deg, rgba(255,255,255,0.04) 40.13%, rgba(255,255,255,0.08) 97.02%)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            fontSize: "var(--text-xs)",
            fontWeight: 500,
            color: "var(--ink-secondary)",
            fontFamily: "var(--font-body)",
            lineHeight: 1.5,
            textAlign: "center",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="var(--warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0 }}>
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
          <span>Offline mode — your progress will sync when connected</span>
          <button
            onClick={() => setOfflineBannerDismissed(true)}
            aria-label="Dismiss offline banner"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "var(--space-1)",
              color: "var(--ink-muted)",
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      <main className="app-content" id="main-content" tabIndex={-1}>
        <div className="page-content page-enter">
          {children}
        </div>
      </main>

      {/*
        Vaul controlled drawer.
        - `open` + `onOpenChange` = Vaul owns close-via-drag and ESC key.
        - Our manual overlay div = click-outside closes.
        - handleMenuClick = hamburger toggles (open→close, closed→open).
        - SidebarContent.onNavigate = nav item click closes.
        
        Key: we do NOT render Vaul.Overlay (it intercepts all clicks including
        the hamburger). Instead we render our own div overlay.
      */}
      <Drawer.Root
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        direction="left"
        noBodyStyles
        dismissible
      >
        <Drawer.Portal>
          {/* Our overlay — click-outside closes */}
          {drawerOpen && (
            <div
              aria-hidden="true"
              onClick={() => setDrawerOpen(false)}
              style={{
                position: "fixed", inset: 0,
                background: "rgba(0, 0, 0, 0.15)",
                zIndex: 59,
                animation: "fadeIn 0.18s ease both",
              }}
            />
          )}

          <Drawer.Content
            className="vaul-drawer-left"
            aria-label="Navigation menu"
          >
            <div className="vaul-drag-handle" />
            <SidebarContent
              role={role}
              username={username}
              onNavigate={() => setDrawerOpen(false)}
            />
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      {isStudent && <BottomNav />}
    </div>
  );
}
