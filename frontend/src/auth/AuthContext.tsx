/* eslint-disable react-refresh/only-export-components */
/**
 * AuthContext — session management with offline-first bootstrap.
 *
 * Strategy:
 *  1. On every app boot, we check navigator.onLine FIRST.
 *  2. If OFFLINE and localStorage has a cached user profile → restore it
 *     immediately (no network calls, no spinner delay). offlineMode = true.
 *  3. If ONLINE → CSRF init + /me as before.
 *  4. After a successful /me response, we always persist the profile to
 *     localStorage so the next offline boot can use it.
 *  5. On logout, we clear the localStorage cache.
 *
 * This eliminates the "GyanGrit name + infinite spinner" on mobile PWA
 * when the device has no internet connection.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { ReactNode } from "react";
import { apiGet, initCsrf, API_BASE_URL } from "../services/api";
import { getAblyToken } from "../services/competitions";
import type { AuthState, MeResponse, UserProfile } from "./authTypes";
import type { TokenParams, ErrorInfo, TokenDetails, TokenRequest } from "ably";

// ─────────────────────────────────────────────────────────────────────────────
// Local storage key for cached user profile
// ─────────────────────────────────────────────────────────────────────────────
const USER_CACHE_KEY = "gyangrit_user_v1";

function saveCachedUser(user: UserProfile): void {
  try {
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  } catch { /* localStorage full or unavailable */ }
}

function loadCachedUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

function clearCachedUser(): void {
  try {
    localStorage.removeItem(USER_CACHE_KEY);
  } catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// Keep-alive ping — prevents Render cold starts
// ─────────────────────────────────────────────────────────────────────────────

const KEEP_ALIVE_INTERVAL_MS = 10 * 60 * 1000;

function startKeepAlive() {
  if (!import.meta.env.PROD) return;
  const ping = () => {
    fetch(`${API_BASE_URL}/health/`, { method: "GET" }).catch(() => {});
  };
  ping();
  return setInterval(ping, KEEP_ALIVE_INTERVAL_MS);
}

// ─────────────────────────────────────────────────────────────────────────────
// Retry helper for cold-start resilience (online-only)
// ─────────────────────────────────────────────────────────────────────────────

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  baseDelayMs: number = 2000
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt);
      console.warn(`[AuthContext] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("retryWithBackoff: unreachable");
}

// ─────────────────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthState>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading]             = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser]                   = useState<UserProfile | null>(null);
  const [kickedMessage, setKickedMessage] = useState<string | null>(null);
  const [offlineMode, setOfflineMode]     = useState(false);

  const clearKicked = useCallback(() => setKickedMessage(null), []);

  // ── Persist user on every change ────────────────────────────────────────
  const applyUser = useCallback((u: UserProfile) => {
    setAuthenticated(true);
    setUser(u);
    saveCachedUser(u);
  }, []);

  const clearUser = useCallback(() => {
    setAuthenticated(false);
    setUser(null);
    setOfflineMode(false);
    clearCachedUser();
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data: MeResponse = await apiGet("/accounts/me/");

      if (data.authenticated) {
        const profile: UserProfile = {
          id:               data.id,
          public_id:        data.public_id ?? "",
          username:         data.username,
          role:             data.role,
          first_name:       data.first_name ?? "",
          middle_name:      data.middle_name ?? "",
          last_name:        data.last_name ?? "",
          display_name:     data.display_name ?? "",
          email:            data.email ?? "",
          mobile_primary:   data.mobile_primary ?? "",
          mobile_secondary: data.mobile_secondary ?? "",
          profile_complete: data.profile_complete ?? false,
          institution:      data.institution ?? null,
          institution_id:   data.institution_id ?? null,
          section:          data.section ?? null,
          section_id:       data.section_id ?? null,
          district:         data.district ?? null,
        };
        applyUser(profile);
        setOfflineMode(false);
      } else {
        clearUser();
      }
    } catch (err) {
      console.error("[AuthContext] Failed to fetch /me:", err);
      // Don't clear localStorage cache — user may still be valid
      // but we couldn't verify it (network issue after login)
      setAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [applyUser, clearUser]);

  // ── Boot: offline-first, then online verification ─────────────────────
  useEffect(() => {
    const isOnline = navigator.onLine;
    const cached   = loadCachedUser();

    if (!isOnline && cached) {
      // Instant offline bootstrap — no network calls needed
      console.log("[AuthContext] Offline boot — restoring cached user:", cached.username);
      setAuthenticated(true);
      setUser(cached);
      setOfflineMode(true);
      setLoading(false);

      // When connectivity returns, reinitialise CSRF + verify session.
      // This exits offlineMode and allows API calls to work again without
      // requiring a full page reload.
      const handleOnline = () => {
        console.log("[AuthContext] Back online — reinitialising session");
        setOfflineMode(false);
        setLoading(true);
        retryWithBackoff(() => initCsrf(), 2, 1000)
          .then(() => refresh())
          .catch(() => setLoading(false));
        window.removeEventListener("online", handleOnline);
      };
      window.addEventListener("online", handleOnline);
      return () => window.removeEventListener("online", handleOnline);
    }

    // Online — CSRF init + /me verification
    retryWithBackoff(() => initCsrf(), 3, 2000)
      .then(() => refresh())
      .catch((err) => {
        console.error("[AuthContext] CSRF init failed after retries:", err);
        // If we have a cached user, restore it rather than showing login
        if (cached) {
          console.warn("[AuthContext] Using cached user after CSRF failure");
          setAuthenticated(true);
          setUser(cached);
          setOfflineMode(true);
        }
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Keep-alive ping ─────────────────────────────────────────────────────
  useEffect(() => {
    const intervalId = startKeepAlive();
    return () => { if (intervalId) clearInterval(intervalId); };
  }, []);

  // ── Session kicked listener ─────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setKickedMessage(detail?.message ?? "You were logged out from another device.");
      clearUser();
    };
    window.addEventListener("session:kicked", handler);
    return () => window.removeEventListener("session:kicked", handler);
  }, [clearUser]);

  // ── Ably notification listener ──────────────────────────────────────────
  useEffect(() => {
    if (!authenticated || !user || offlineMode) return;
    let mounted = true;

    const connect = async () => {
      try {
        const { default: Ably } = await import("ably");
        const client = new Ably.Realtime({
          authCallback: async (
            _data: TokenParams,
            callback: (
              error: ErrorInfo | string | null,
              token: TokenDetails | TokenRequest | string | null,
            ) => void,
          ) => {
            try {
              const tokenData = await getAblyToken(undefined, "chat");
              callback(null, tokenData.token);
            } catch (err) {
              callback(err instanceof Error ? err.message : "Token fetch failed", null);
            }
          },
        });
        if (!mounted) { client.close(); return; }

        const channel = client.channels.get(`notifications:${user.id}`);
        channel.subscribe((msg) => {
          if (!mounted) return;
          window.dispatchEvent(new CustomEvent("notif:new", { detail: msg.data }));
        });

        return () => {
          channel.unsubscribe();
          client.close();
        };
      } catch {
        return undefined;
      }
    };

    let cleanup: (() => void) | undefined;
    connect().then((fn) => { cleanup = fn; });

    return () => {
      mounted = false;
      cleanup?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, user?.id, offlineMode]);

  // Push notifications are OPT-IN — user explicitly enables from Profile/Settings.
  // Removed auto-subscribe here to prevent Chrome from showing
  // the 'GyanGrit — tap to copy the URL' notification on every login.
  // Call subscribeToPush() only when user presses the "Enable Notifications" button.

  const value: AuthState = {
    loading,
    authenticated,
    user,
    kickedMessage,
    offlineMode,
    clearKicked,
    refresh,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
