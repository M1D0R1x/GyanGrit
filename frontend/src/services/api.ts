/**
 * Central API base URL.
 * All frontend API calls MUST go through this.
 *
 * Versioned on purpose:
 * - Allows backend to evolve (/v2, /v3)
 * - Frontend remains stable
 */
const API_BASE_URL = "http://127.0.0.1:8000/api/v1";

// Extract csrftoken from cookies
function getCsrfToken(): string | undefined {
  const match = document.cookie.match(new RegExp("(^| )csrftoken=([^;]+)"));
  return match ? match[2] : undefined;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}

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
    throw new Error(`API POST error: ${res.status} - ${JSON.stringify(err)}`);
  }

  return res.json();
}

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