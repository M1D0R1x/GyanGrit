// hooks/useMobile.ts — GyanGrit Mobile PWA helpers
// Per GYANGRIT_MOBILE_PWA_SKILL §8: Detecting Mobile vs Desktop in Code

import { useState, useEffect } from "react";

/**
 * Returns true when the app is installed as a PWA (home screen / standalone mode).
 * Works on Android (display-mode: standalone) and iOS (navigator.standalone).
 * Stable — no re-renders after mount (standalone mode can't change during session).
 */
export function useIsPWA(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.navigator as any).standalone === true
  );
}

/**
 * Reactive hook — returns true when viewport width < 768px.
 * Re-renders on resize to support orientation changes.
 *
 * Use this to switch between mobile/desktop layout branches:
 *   const isMobile = useIsMobile();
 *   return isMobile ? <BottomNav /> : <Sidebar />;
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isMobile;
}
