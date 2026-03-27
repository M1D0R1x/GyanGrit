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
 *
 * CHANGE (2026-03-28):
 *   - Added fetchWithTimeout() wrapper using AbortController to prevent
 *     infinite loading spinners when the server is cold-starting or SMTP
 *     blocks a Gunicorn worker. Default timeout: 15 seconds.
 */

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

// ── Timeout wrapper ─────────────────────────────────────────────────────────
// Prevents fetch from hanging forever when the backend is cold-starting,
// under load, or when an SMTP thread blocks the Gunicorn worker.

const DEFAULT_TIMEOUT_MS = 15_000; // 15 seconds

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    return res;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Request timed out — please check your connection and try again.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

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

async function buildErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    return json?.detail || json?.error?.message || json?.error || json?.message || text;
  } catch {
    const trimmed = text.trim().toLowerCase();
    if (trimmed.startsWith("<!doctype html>") || trimmed.startsWith("<html")) {
      if (res.status === 404) return "Not Found: The requested resource does not exist.";
      if (res.status >= 500) return "Internal Server Error: The server encountered an unexpected condition.";
      return "Unexpected HTML response received from server.";
    }
    return text;
  }
}

export async function initCsrf(): Promise<void> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/accounts/csrf/`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`CSRF init failed: ${res.status}`);
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
    method: "GET",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    await handleKicked(res);
    const msg = await buildErrorMessage(res);
    throw new Error(`${res.status} ${msg}`);
  }

  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const csrfToken = getCsrfToken();

  const res = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
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
    const msg = await buildErrorMessage(res);
    throw new Error(`${res.status} ${msg}`);
  }

  return res.json() as Promise<T>;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const csrfToken = getCsrfToken();

  const res = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
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
    const msg = await buildErrorMessage(res);
    throw new Error(`${res.status} ${msg}`);
  }

  return res.json() as Promise<T>;
}

export async function apiDelete<T = Record<string, unknown>>(
  path: string
): Promise<T> {
  const csrfToken = getCsrfToken();

  const res = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
    },
  });

  if (!res.ok) {
    await handleKicked(res);
    const msg = await buildErrorMessage(res);
    throw new Error(`${res.status} ${msg}`);
  }

  // DELETE endpoints may return 204 No Content — handle gracefully
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}
