import { NextResponse } from "next/server"
import { z } from "zod"
import { supabaseAdmin } from "@/supabaseAdmin"
import { supabaseAnon } from "@/supabaseAnon"
import { errorResponse, sessionToTokens, verifyCsrf } from "@/lib/auth/api"
import { rateLimit } from "@/lib/auth/rate-limit"
import { getClientIp } from "@/lib/auth/request"
import { TABLES } from "@/lib/supabase/tables"

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export async function POST(request) {
  const csrfError = verifyCsrf(request)
  if (csrfError) return csrfError

  const body = await request.json().catch(() => null)
  const parseResult = LoginSchema.safeParse(body)
  if (!parseResult.success) {
    return errorResponse("VALIDATION_ERROR", parseResult.error.message, 400)
  }

  const { email, password } = parseResult.data
  const ip = getClientIp(request)
  const limitResult = rateLimit({
    key: `login:${ip}:${email}`,
    limit: 5,
    windowMs: 60 * 1000,
  })

  if (!limitResult.allowed) {
    return errorResponse("RATE_LIMITED", "Too many login attempts.", 429)
  }

  const { data: signInData, error: signInError } =
    await supabaseAnon.auth.signInWithPassword({
      email,
      password,
    })

  if (signInError || !signInData?.session || !signInData?.user) {
    return errorResponse("INVALID_CREDENTIALS", "Invalid credentials.", 401)
  }

  const userId = signInData.user.id
  const { data: userRow } = await supabaseAdmin
    .from(TABLES.users)
    .select("id, email, role")
    .eq("id", userId)
    .maybeSingle()

  const role =
    userRow?.role || signInData.user.user_metadata?.role || "UNKNOWN"

  if (role === "STAFF") {
    const { data: staffProfile } = await supabaseAdmin
      .from(TABLES.staffProfiles)
      .select("status")
      .eq("user_id", userId)
      .maybeSingle()

    if (staffProfile?.status && staffProfile.status !== "ACTIVE") {
      return errorResponse(
        "STAFF_NOT_ACTIVE",
        "Staff account is not active.",
        403
      )
    }
  }

  await supabaseAdmin
    .from(TABLES.users)
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", userId)

  return NextResponse.json({
    user: {
      id: userId,
      email: signInData.user.email,
      role,
    },
    tokens: sessionToTokens(signInData.session),
  })
}
