import { NextResponse } from "next/server"
import { z } from "zod"
import { supabaseAnon } from "@/supabaseAnon"
import { supabaseAdmin } from "@/supabaseAdmin"
import { errorResponse, verifyCsrf } from "@/lib/auth/api"

const LogoutSchema = z.object({
  refreshToken: z.string().min(1),
})

export async function POST(request) {
  const csrfError = verifyCsrf(request)
  if (csrfError) return csrfError

  const body = await request.json().catch(() => null)
  const parseResult = LogoutSchema.safeParse(body)
  if (!parseResult.success) {
    return errorResponse("VALIDATION_ERROR", parseResult.error.message, 400)
  }

  const { refreshToken } = parseResult.data
  const { data: refreshData, error: refreshError } =
    await supabaseAnon.auth.refreshSession({
      refresh_token: refreshToken,
    })

  if (refreshError || !refreshData?.session) {
    return errorResponse("INVALID_REFRESH", "Invalid refresh token.", 401)
  }

  const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(
    refreshData.session.access_token,
    "global"
  )

  if (signOutError) {
    return errorResponse("LOGOUT_FAILED", "Unable to revoke session.", 500)
  }

  return NextResponse.json({ success: true })
}
