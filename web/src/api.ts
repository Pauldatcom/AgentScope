/** Base URL for the FastAPI backend (no trailing slash).

In Vite dev, `/api` is proxied to `http://localhost:8000` with the prefix
stripped, so `apiUrl("/dashboard")` hits the FastAPI `/dashboard` route.
Override with `VITE_API_URL` when the API is not served through that proxy.
*/
export const API_BASE = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/$/, "");

export function apiUrl(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${suffix}`;
}

export async function readApiError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const parsed: unknown = JSON.parse(text);
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      "detail" in parsed &&
      typeof (parsed as { detail: unknown }).detail === "string"
    ) {
      return (parsed as { detail: string }).detail;
    }
  } catch {
    /* not JSON */
  }
  return text || response.statusText;
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), init);
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return response.json() as Promise<T>;
}
