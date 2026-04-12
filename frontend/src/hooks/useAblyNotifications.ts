// hooks/useAblyNotifications.ts
/**
 * Lazy Ably connection for real-time notifications.
 *
 * MOVED OUT of AuthContext to prevent Ably from connecting on every page.
 * Only mounts in components that need real-time updates (dashboard, chat, live).
 * Ably JS chunk (~120KB) is dynamically imported — never in critical path.
 */
import { useEffect, useRef } from "react";
import { useAuth } from "../auth/AuthContext";
import { getAblyToken } from "../services/competitions";
import type { TokenParams, ErrorInfo, TokenDetails, TokenRequest } from "ably";

export function useAblyNotifications() {
  const { authenticated, user, offlineMode } = useAuth();
  const cleanupRef = useRef<(() => void) | null>(null);

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

        cleanupRef.current = () => {
          channel.unsubscribe();
          client.close();
        };
      } catch {
        // Ably unavailable — silent fail, notifications still work via polling
      }
    };

    connect();

    return () => {
      mounted = false;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [authenticated, user?.id, offlineMode]);
}
