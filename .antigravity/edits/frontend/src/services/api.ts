/**
 * api.ts — base fetch helpers for GyanGrit frontend.
 *
 * Rules:
 * - All API calls go through apiGet / apiPost / apiPatch / apiDelete
 * - Session cookies are sent with every request (credentials: "include")
 * - CSRF token is read from gyangrit_csrftoken cookie and sent as X-CSRFToken
 * - Never hardcode base URLs anywhere in the app — always import API_BASE_URL
 *
 * CHANGE (2026-03-25):
 *   - initCsrf() throws on non-ok for retry logic
 *   - Added session_kicked detection: when the middleware returns 401 with
 *     error="session_kicked", fires a custom event so AuthContext can show
 *     the "logged out from another device" message.
 */

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api/v1";

function getCsrfToken(): string | undefined {
  const match = document.cookie.match(
    new RegExp("(^| )gyangrit_csrftoken=([^;]+)")
  );
  return match ? match[2] : undefined;
}

/**
 * Check if a response is a "session_kicked" 401 from SingleActiveSessionMiddleware.
 * If so, dispatch a window event that AuthContext listens to.
 */
async function handleKicked(res: Response): Promise<void> {
  if (res.status === 401) {
    try {
      const cloned = res.clone();
      const body = await cloned.json();
      if (body?.error === "session_kicked") {
        window.dispatchEvent(
          new CustomEvent("session:kicked", {
            detail: { message: body.message },
          })
        );
      }
    } catch {
      // Not JSON or no body — just a normal 401 (unauthenticated)
    }
  }
}

export async function initCsrf(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/accounts/csrf/`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`CSRF init failed: ${res.status}`);
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    await handleKicked(res);
    const text = await res.text();
    throw new Error(`${res.status} ${text}`);
  }

  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const csrfToken = getCsrfToken();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    await handleKicked(res);
    const text = await res.text();
    throw new Error(`${res.status} ${text}`);
  }

  return res.json() as Promise<T>;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const csrfToken = getCsrfToken();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    await handleKicked(res);
    const text = await res.text();
    throw new Error(`${res.status} ${text}`);
  }

  return res.json() as Promise<T>;
}

export async function apiDelete<T = Record<string, unknown>>(
  path: string
): Promise<T> {
  const csrfToken = getCsrfToken();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
    },
  });

  if (!res.ok) {
    await handleKicked(res);
    const text = await res.text();
    throw new Error(`${res.status} ${text}`);
  }

  // DELETE endpoints may return 204 No Content — handle gracefully
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}
