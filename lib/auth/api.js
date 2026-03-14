import { NextResponse } from "next/server"
import { verifyCsrfToken } from "@/lib/auth/csrf"

export function errorResponse(code, message, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status })
}

export function verifyCsrf(request) {
  const csrfHeader = request.headers.get("x-csrf-token")
  const csrfCookie = request.cookies.get("csrfToken")?.value
  if (!verifyCsrfToken(csrfHeader, csrfCookie)) {
    return errorResponse("CSRF_INVALID", "Invalid CSRF token.", 403)
  }
  return null
}

export function sessionToTokens(session) {
  if (!session) return null
  const expiresAt = session.expires_at
    ? new Date(session.expires_at * 1000).toISOString()
    : null
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    tokenType: session.token_type,
    expiresIn: session.expires_in,
    expiresAt,
  }
}
