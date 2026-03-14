import crypto from "crypto"

export function generateCsrfToken() {
  return crypto.randomBytes(32).toString("base64url")
}

export function verifyCsrfToken(headerToken, cookieToken) {
  return Boolean(headerToken && cookieToken && headerToken === cookieToken)
}