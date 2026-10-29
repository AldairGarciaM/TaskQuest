import { NextResponse, type NextRequest } from "next/server";

// NextAuth's session cookie, with or without the __Secure- prefix and split in chunks (.0, .1…) when large.
const SESSION_COOKIE = /^(__Secure-)?next-auth\.session-token(\.\d+)?$/;

/**
 * Clears a session that was revoked (password changed on another device) and sends the person
 * to log in. Lives under /api so the proxy doesn't bounce a still-present cookie back to "/".
 */
export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/auth/login?expirada=1", request.url));
  for (const { name } of request.cookies.getAll()) {
    if (!SESSION_COOKIE.test(name)) continue;
    response.cookies.set(name, "", {
      maxAge: 0,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: name.startsWith("__Secure-"),
    });
  }
  return response;
}
