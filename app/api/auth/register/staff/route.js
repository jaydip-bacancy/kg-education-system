import { NextResponse } from "next/server"
import { z } from "zod"
import { supabaseAdmin } from "@/supabaseAdmin"
import { supabaseAnon } from "@/supabaseAnon"
import { errorResponse, sessionToTokens, verifyCsrf } from "@/lib/auth/api"
import { TABLES } from "@/lib/supabase/tables"

const RegisterStaffSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  centerIds: z.array(z.string().min(1)).min(1),
  roleTitle: z.string().min(1),
  invitationCode: z.string().optional(),
})

export async function POST(request) {
  const csrfError = verifyCsrf(request)
  if (csrfError) return csrfError

  const body = await request.json().catch(() => null)
  const parseResult = RegisterStaffSchema.safeParse(body)
  if (!parseResult.success) {
    return errorResponse("VALIDATION_ERROR", parseResult.error.message, 400)
  }

  const {
    firstName,
    lastName,
    email,
    password,
    phone,
    centerIds,
    roleTitle,
    invitationCode,
  } = parseResult.data

  const status = invitationCode ? "ACTIVE" : "PENDING"

  const { data: userResult, error: userError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        firstName,
        lastName,
        phone,
        role: "STAFF",
        staffStatus: status,
      },
    })

  if (userError || !userResult?.user) {
    return errorResponse("USER_CREATE_FAILED", userError?.message || "", 400)
  }

  const userId = userResult.user.id

  const { error: userRowError } = await supabaseAdmin.from(TABLES.users).insert({
    id: userId,
    email,
    role: "STAFF",
    first_name: firstName,
    last_name: lastName,
    phone,
  })

  if (userRowError) {
    await supabaseAdmin.auth.admin.deleteUser(userId)
    return errorResponse("USER_ROW_FAILED", userRowError.message || "", 500)
  }

  const { data: staffProfile, error: staffProfileError } = await supabaseAdmin
    .from(TABLES.staffProfiles)
    .insert({
      user_id: userId,
      role_title: roleTitle,
      status,
    })
    .select("id, status")
    .single()

  if (staffProfileError || !staffProfile) {
    await supabaseAdmin.auth.admin.deleteUser(userId)
    return errorResponse(
      "STAFF_PROFILE_FAILED",
      staffProfileError?.message || "",
      500
    )
  }

  const staffCenterPayload = centerIds.map((centerId) => ({
    staff_profile_id: staffProfile.id,
    center_id: centerId,
  }))

  const { error: staffCentersError } = await supabaseAdmin
    .from(TABLES.staffCenters)
    .insert(staffCenterPayload)

  if (staffCentersError) {
    await supabaseAdmin.auth.admin.deleteUser(userId)
    return errorResponse(
      "STAFF_CENTERS_FAILED",
      staffCentersError.message || "",
      500
    )
  }

  const { data: signInData, error: signInError } =
    await supabaseAnon.auth.signInWithPassword({
      email,
      password,
    })

  if (signInError || !signInData?.session) {
    return errorResponse("LOGIN_FAILED", "Unable to sign in.", 500)
  }

  return NextResponse.json(
    {
      user: {
        id: userId,
        email,
        role: "STAFF",
        staffStatus: status,
      },
      tokens: sessionToTokens(signInData.session),
    },
    { status: 201 }
  )
}
