import { NextResponse } from "next/server"
import { z } from "zod"
import { supabaseAnon } from "@/supabaseAnon"
import { errorResponse, verifyCsrf } from "@/lib/auth/api"

const ForgotSchema = z.object({
  email: z.string().email(),
})

export async function POST(request) {
  const csrfError = verifyCsrf(request)
  if (csrfError) return csrfError

  const body = await request.json().catch(() => null)
  const parseResult = ForgotSchema.safeParse(body)
  if (!parseResult.success) {
    return errorResponse("VALIDATION_ERROR", parseResult.error.message, 400)
  }

  const { email } = parseResult.data
  const baseUrl = process.env.APP_URL || "http://localhost:3000"
  const resetPath = process.env.RESET_PASSWORD_PATH || "/reset-password"
  const redirectTo = `${baseUrl}${resetPath}`

  const { error } = await supabaseAnon.auth.resetPasswordForEmail(email, {
    redirectTo,
  })

  if (error) {
    console.warn("Password reset email error:", error.message)
  }

  return NextResponse.json({ success: true })
}
