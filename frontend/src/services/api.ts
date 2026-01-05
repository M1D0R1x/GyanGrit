/**
 * Central API base URL.
 * All frontend API calls MUST go through this.
 *
 * Versioned on purpose:
 * - Allows backend to evolve (/v2, /v3)
 * - Frontend remains stable
 */
const API_BASE_URL = "http://127.0.0.1:8000/api/v1";

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`);

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}
export async function apiPatch<T>(
  path: string,
  body: unknown
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`API PATCH error: ${res.status}`);
  }

  return res.json();
}
