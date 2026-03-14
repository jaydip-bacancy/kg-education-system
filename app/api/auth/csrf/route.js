import { NextResponse } from "next/server"
import { generateCsrfToken } from "@/lib/auth/csrf"

export async function GET() {
  const token = generateCsrfToken()
  const response = NextResponse.json({ csrfToken: token })
  response.cookies.set("csrfToken", token, {
    httpOnly: false,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  })
  return response
}