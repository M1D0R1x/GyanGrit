/**
 * Central API base URL.
 * All frontend API calls MUST go through this file.
 *
 * Design:
 * - Versioned (/api/v1)
 * - Session-based auth
 * - CSRF-safe
 * - No hardcoded fetch elsewhere
 */
const API_BASE_URL = "http://127.0.0.1:8000/api/v1";

/**
 * Extract csrftoken from cookies.
 * Required for POST/PATCH with Django CSRF protection.
 */
function getCsrfToken(): string | undefined {
  const match = document.cookie.match(
    new RegExp("(^| )csrftoken=([^;]+)")
  );
  return match ? match[2] : undefined;
}

/**
 * GET helper.
 * Used for all read-only endpoints.
 */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include", // IMPORTANT: send session cookie
  });

  if (!res.ok) {
    throw new Error(`API GET error: ${res.status}`);
  }

  return res.json();
}

/**
 * POST helper.
 * Used for login, register, enroll, etc.
 */
export async function apiPost<T>(
  path: string,
  body: unknown
): Promise<T> {
  const csrfToken = getCsrfToken();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken && { "X-CSRFToken": csrfToken }),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `API POST error: ${res.status} - ${JSON.stringify(err)}`
    );
  }

  return res.json();
}

/**
 * PATCH helper.
 * Used for progress updates, enrollment updates, etc.
 */
export async function apiPatch<T>(
  path: string,
  body: unknown
): Promise<T> {
  const csrfToken = getCsrfToken();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken && { "X-CSRFToken": csrfToken }),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`API PATCH error: ${res.status}`);
  }

  return res.json();
}

/**
 * Logout helper.
 * Clears the Django session.
 *
 * Backend endpoint:
 * POST /api/v1/accounts/logout/
 */
export async function apiLogout(): Promise<void> {
  await apiPost("/accounts/logout/", {});
}
