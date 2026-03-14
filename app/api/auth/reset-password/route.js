import { NextResponse } from "next/server"
import { z } from "zod"
import { supabaseAnon } from "@/supabaseAnon"
import { supabaseAdmin } from "@/supabaseAdmin"
import { errorResponse, verifyCsrf } from "@/lib/auth/api"

const ResetSchema = z.object({
  email: z.string().email(),
  token: z.string().min(1),
  password: z.string().min(8),
})

export async function POST(request) {
  const csrfError = verifyCsrf(request)
  if (csrfError) return csrfError

  const body = await request.json().catch(() => null)
  const parseResult = ResetSchema.safeParse(body)
  if (!parseResult.success) {
    return errorResponse("VALIDATION_ERROR", parseResult.error.message, 400)
  }

  const { email, token, password } = parseResult.data
  const { data, error } = await supabaseAnon.auth.verifyOtp({
    email,
    token,
    type: "recovery",
  })

  if (error || !data?.user) {
    return errorResponse("INVALID_TOKEN", "Invalid or expired reset token.", 400)
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    data.user.id,
    { password }
  )

  if (updateError) {
    return errorResponse("RESET_FAILED", "Unable to reset password.", 500)
  }

  return NextResponse.json({ success: true })
}
