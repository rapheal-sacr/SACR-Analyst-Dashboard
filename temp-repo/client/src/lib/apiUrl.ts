/**
 * Build a request URL for the Express API.
 * VITE_API_BASE_URL should be an origin only (e.g. http://localhost:4000) or empty
 * for same-origin / Vite proxy. Do not set it to "/api" — paths already start with /api.
 */
export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  let base = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
  base = base.replace(/\/+$/, "");
  if (base.endsWith("/api")) {
    base = base.slice(0, -4);
  }
  if (!base) {
    return normalizedPath;
  }
  return `${base}${normalizedPath}`;
}
