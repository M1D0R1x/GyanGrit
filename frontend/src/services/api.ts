/**
 * api.ts — base fetch helpers for GyanGrit frontend.
 *
 * Rules:
 * - All API calls go through apiGet / apiPost / apiPatch
 * - Session cookies are sent with every request (credentials: "include")
 * - CSRF token is read from gyangrit_csrftoken cookie and sent as X-CSRFToken
 * - Never hardcode base URLs anywhere in the app — always import API_BASE_URL
 *
 * CHANGE (2026-03-15):
 *   Exported API_BASE_URL so media.ts can use it without a hardcoded localhost string.
 */

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api/v1";

function getCsrfToken(): string | undefined {
  const match = document.cookie.match(
    new RegExp("(^| )gyangrit_csrftoken=([^;]+)")
  );
  return match ? match[2] : undefined;
}

export async function initCsrf(): Promise<void> {
  await fetch(`${API_BASE_URL}/accounts/csrf/`, {
    credentials: "include",
  });
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
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
    const text = await res.text();
    throw new Error(`${res.status} ${text}`);
  }

  return res.json() as Promise<T>;
}