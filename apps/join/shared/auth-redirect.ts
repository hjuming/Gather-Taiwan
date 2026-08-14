const REDIRECT_ORIGIN = "https://gather.internal";

/**
 * Keep auth redirects on the app's own origin. Auth flows receive redirect
 * values from query strings and form bodies, so never pass an absolute URL,
 * protocol-relative URL, backslash URL, control character, or hash through.
 */
export function normalizeInternalRedirect(raw: string | null | undefined): string {
  const value = raw?.trim() || "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) {
    return "/";
  }

  try {
    const parsed = new URL(value, REDIRECT_ORIGIN);
    if (parsed.origin !== REDIRECT_ORIGIN || parsed.pathname.startsWith("//")) return "/";
    return `${parsed.pathname || "/"}${parsed.search}`;
  } catch {
    return "/";
  }
}
