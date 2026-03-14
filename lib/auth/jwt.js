import { SignJWT, jwtVerify } from "jose"

const encoder = new TextEncoder()
const jwtSecret = encoder.encode(process.env.JWT_SECRET || "")
const jwtIssuer = process.env.JWT_ISSUER || "childcare"
const jwtAudience = process.env.JWT_AUDIENCE || "childcare-web"
const accessTtl = process.env.ACCESS_TOKEN_TTL || "15m"

if (!process.env.JWT_SECRET) {
  console.warn("JWT_SECRET is not set. Auth tokens are not secure.")
}

export async function signAccessToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(jwtIssuer)
    .setAudience(jwtAudience)
    .setExpirationTime(accessTtl)
    .sign(jwtSecret)
}

export async function verifyAccessToken(token) {
  return jwtVerify(token, jwtSecret, {
    issuer: jwtIssuer,
    audience: jwtAudience,
  })
}