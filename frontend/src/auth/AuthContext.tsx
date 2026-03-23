/* eslint-disable react-refresh/only-export-components */

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

// ─────────────────────────────────────────────────────────────────────────────
// Keep-alive ping
// Render (and Railway) free/hobby tiers sleep after 15 min of inactivity.
// We ping /api/v1/health/ every 10 minutes to prevent cold starts.
// Uses plain fetch (no credentials, no CSRF) — health endpoint is public.
// Only runs in production (import.meta.env.PROD) to avoid noise in dev.
// ─────────────────────────────────────────────────────────────────────────────

const KEEP_ALIVE_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

function startKeepAlive() {
  if (!import.meta.env.PROD) return; // dev: skip
  const ping = () => {
    fetch(`${API_BASE_URL}/health/`, { method: "GET" }).catch(() => {
      // Silently ignore — if the server is down the user will see auth errors
    });
  };
  ping(); // ping immediately on app load
  return setInterval(ping, KEEP_ALIVE_INTERVAL_MS);
}

// ─────────────────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthState>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading]             = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser]                   = useState<UserProfile | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data: MeResponse = await apiGet("/accounts/me/");

      if (data.authenticated) {
        setAuthenticated(true);
        setUser({
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
        });
      } else {
        setAuthenticated(false);
        setUser(null);
      }
    } catch (err) {
      console.error("[AuthContext] Failed to fetch /me:", err);
      setAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Seed CSRF cookie first, then verify auth state.
    initCsrf().then(() => refresh());
  }, [refresh]);

  // Keep the Render/Railway backend warm — ping every 10 minutes
  useEffect(() => {
    const intervalId = startKeepAlive();
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  // ── Ably notification listener ─────────────────────────────────────────
  // Subscribes to notifications:{user_id} once authenticated.
  // On any chat_message event, dispatches window event "notif:new"
  // which TopBar catches to immediately refresh the unread badge.
  useEffect(() => {
    if (!authenticated || !user) return;
    let mounted = true;

    const connect = async () => {
      try {
        const { default: Ably } = await import("ably");
        const tokenData = await getAblyToken(undefined, "chat");
        if (!mounted) return;

        const client = new Ably.Realtime({
          token:    tokenData.token,
          clientId: tokenData.client_id,
        });

        const channel = client.channels.get(`notifications:${user.id}`);
        channel.subscribe((msg) => {
          if (!mounted) return;
          // Dispatch custom event — TopBar listens to this for instant bell refresh
          window.dispatchEvent(new CustomEvent("notif:new", { detail: msg.data }));
        });

        return () => {
          channel.unsubscribe();
          client.close();
        };
      } catch {
        // Ably not available — TopBar polls every 30s as fallback
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
  }, [authenticated, user?.id]);

  const value: AuthState = {
    loading,
    authenticated,
    user,
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
