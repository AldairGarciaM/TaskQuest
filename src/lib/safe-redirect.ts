/**
 * Only allow same-origin relative paths as post-login destinations,
 * so `?callbackUrl=` cannot be used as an open redirect.
 */
export function safeCallbackUrl(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  if (value.startsWith("/auth")) return fallback;
  return value;
}
