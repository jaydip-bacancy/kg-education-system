import { NextResponse } from "next/server"
import { z } from "zod"
import { supabaseAnon } from "@/supabaseAnon"
import { errorResponse, sessionToTokens, verifyCsrf } from "@/lib/auth/api"

const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
})

export async function POST(request) {
  const csrfError = verifyCsrf(request)
  if (csrfError) return csrfError

  const body = await request.json().catch(() => null)
  const parseResult = RefreshSchema.safeParse(body)
  if (!parseResult.success) {
    return errorResponse("VALIDATION_ERROR", parseResult.error.message, 400)
  }

  const { refreshToken } = parseResult.data
  const { data, error } = await supabaseAnon.auth.refreshSession({
    refresh_token: refreshToken,
  })

  if (error || !data?.session) {
    return errorResponse("INVALID_REFRESH", "Invalid refresh token.", 401)
  }

  return NextResponse.json({
    tokens: sessionToTokens(data.session),
  })
}
