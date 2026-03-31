// components/AppLayout.tsx — V4
// The single layout shell for all authenticated pages.
// Desktop: TopBar + (Sidebar panel 260px | main content)
// Mobile:  TopBar + Vaul drawer sidebar + main content + BottomNav
import { useState } from "react";
import { Drawer } from "vaul";
import TopBar from "./TopBar";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import { useAuth } from "../auth/AuthContext";
import type { Role } from "../auth/authTypes";

interface AppLayoutProps {
  children:       React.ReactNode;
  title?:         string;
  showBottomNav?: boolean;
  /** Extra bottom padding for pages that need it */
  padBottom?:     boolean;
}

export default function AppLayout({
  children,
  title,
  showBottomNav = true,
  padBottom     = false,
}: AppLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const auth = useAuth();

  const role     = (auth.user?.role     ?? "STUDENT") as Role;
  const username =  auth.user?.username ?? "";

  return (
    <div className="page-shell">
      <TopBar title={title} onMenuClick={() => setDrawerOpen(true)} />

      <div className="app-layout">
        {/* ── Desktop sidebar — pure CSS, never shown on mobile ── */}
        <aside className="app-layout__sidebar" aria-label="Navigation">
          <Sidebar
            role={role}
            username={username}
            open={false}
            onClose={() => {}}
          />
        </aside>

        {/* ── Main content ── */}
        <main className="app-layout__main">
          <div
            className="page-content page-enter"
            style={padBottom ? { paddingBottom: "calc(var(--bottom-nav-height) + var(--space-6))" } : undefined}
          >
            {children}
          </div>
        </main>
      </div>

      {/* ── Mobile drawer — Vaul, left direction ── */}
      <Drawer.Root
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        direction="left"
        snapPoints={undefined}
      >
        <Drawer.Portal>
          <Drawer.Overlay
            style={{
              position:   "fixed",
              inset:      0,
              background: "var(--bg-overlay)",
              zIndex:     59,
            }}
          />
          <Drawer.Content
            aria-label="Navigation menu"
            style={{
              position:      "fixed",
              top:           0,
              left:          0,
              bottom:        0,
              width:         "min(var(--sidebar-width), 85vw)",
              background:    "var(--bg-surface)",
              zIndex:        60,
              display:       "flex",
              flexDirection: "column",
              boxShadow:     "var(--shadow-xl)",
              outline:       "none",
            }}
          >
            {/* Vaul drag handle — right edge */}
            <div
              style={{
                position:     "absolute",
                right:        -16,
                top:          "50%",
                transform:    "translateY(-50%)",
                width:        4,
                height:       48,
                background:   "var(--border-medium)",
                borderRadius: "0 var(--radius-full) var(--radius-full) 0",
              }}
            />
            <Sidebar
              role={role}
              username={username}
              open={true}
              onClose={() => setDrawerOpen(false)}
            />
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      {/* ── Bottom nav — CSS hides on ≥768px ── */}
      {showBottomNav && role === "STUDENT" && <BottomNav />}
    </div>
  );
}
