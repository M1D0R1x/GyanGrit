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
// Retry helper for cold-start resilience
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
  const [loading, setLoading]               = useState(true);
  const [authenticated, setAuthenticated]   = useState(false);
  const [user, setUser]                     = useState<UserProfile | null>(null);
  const [kickedMessage, setKickedMessage]   = useState<string | null>(null);

  const clearKicked = useCallback(() => setKickedMessage(null), []);

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

  // ── CSRF init on mount ─────────────────────────────────────────────────
  useEffect(() => {
    retryWithBackoff(() => initCsrf(), 3, 2000)
      .then(() => refresh())
      .catch((err) => {
        console.error("[AuthContext] CSRF init failed after retries:", err);
        setLoading(false);
      });
  }, [refresh]);

  // ── Keep-alive ping ────────────────────────────────────────────────────
  useEffect(() => {
    const intervalId = startKeepAlive();
    return () => { if (intervalId) clearInterval(intervalId); };
  }, []);

  // ── Session kicked listener ────────────────────────────────────────────
  // When SingleActiveSessionMiddleware forces logout on another device,
  // api.ts dispatches "session:kicked" with the message. We pick it up
  // here and set kickedMessage so LoginPage can show the banner.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setKickedMessage(detail?.message ?? "You were logged out from another device.");
      setAuthenticated(false);
      setUser(null);
    };
    window.addEventListener("session:kicked", handler);
    return () => window.removeEventListener("session:kicked", handler);
  }, []);

  // ── Ably notification listener ─────────────────────────────────────────
  useEffect(() => {
    if (!authenticated || !user) return;
    let mounted = true;

    const connect = async () => {
      try {
        const { default: Ably } = await import("ably");
        // Use authCallback so Ably can auto-refresh tokens when they expire.
        // This eliminates the "no way to renew" warning.
        const client = new Ably.Realtime({
          authCallback: async (_data, callback) => {
            try {
              const tokenData = await getAblyToken(undefined, "chat");
              callback(null, { token: tokenData.token, expires: tokenData.expires, clientId: tokenData.client_id } as unknown as Ably.TokenDetails);
            } catch (err) {
              callback(err as Error, null);
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
  }, [authenticated, user?.id]);

  // ── Push notification auto-subscribe ─────────────────────────────────
  // After login, subscribe to browser push if permission is not denied.
  // Lazy-imports push.ts to keep the main bundle small.
  useEffect(() => {
    if (!authenticated) return;
    import("../services/push")
      .then(({ isPushSupported, getPushPermission, subscribeToPush }) => {
        if (!isPushSupported()) return;
        if (getPushPermission() === "denied") return;
        subscribeToPush().catch(() => {});
      })
      .catch(() => {});
  }, [authenticated]);

  const value: AuthState = {
    loading,
    authenticated,
    user,
    kickedMessage,
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
