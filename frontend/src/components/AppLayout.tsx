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

  // Pure toggle — called only by the hamburger button in TopBar
  const handleMenuClick = useCallback(() => {
    setDrawerOpen(prev => !prev);
  }, []);

  const role      = (auth.user?.role     ?? "STUDENT") as Role;
  const username  =  auth.user?.username ?? "";
  const isStudent = role === "STUDENT";

  return (
    <div className="app-shell">
      <OfflineStatusBar />
      <TopBar title={title} onMenuClick={handleMenuClick} />

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
