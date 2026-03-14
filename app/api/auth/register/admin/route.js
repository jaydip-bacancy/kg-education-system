import { NextResponse } from "next/server"
import { z } from "zod"
import { supabaseAdmin } from "@/supabaseAdmin"
import { supabaseAnon } from "@/supabaseAnon"
import { errorResponse, sessionToTokens, verifyCsrf } from "@/lib/auth/api"
import { TABLES } from "@/lib/supabase/tables"

const CenterSchema = z.object({
  name: z.string().min(1),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
})

const RegisterAdminSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  centers: z.array(CenterSchema).min(1),
})

export async function POST(request) {
  const csrfError = verifyCsrf(request)
  if (csrfError) return csrfError

  const body = await request.json().catch(() => null)
  const parseResult = RegisterAdminSchema.safeParse(body)
  if (!parseResult.success) {
    return errorResponse("VALIDATION_ERROR", parseResult.error.message, 400)
  }

  const { firstName, lastName, email, password, phone, centers } =
    parseResult.data

  const { data: userResult, error: userError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        firstName,
        lastName,
        phone,
        role: "ADMIN",
      },
    })

  if (userError || !userResult?.user) {
    return errorResponse("USER_CREATE_FAILED", userError?.message || "", 400)
  }

  const userId = userResult.user.id

  const centersPayload = centers.map((center) => ({
    name: center.name,
    address_line1: center.addressLine1,
    address_line2: center.addressLine2,
    city: center.city,
    state: center.state,
    postal_code: center.postalCode,
  }))

  const { data: centerRows, error: centersError } = await supabaseAdmin
    .from(TABLES.centers)
    .insert(centersPayload)
    .select("*")

  if (centersError) {
    await supabaseAdmin.auth.admin.deleteUser(userId)
    return errorResponse(
      "CENTER_CREATE_FAILED",
      centersError.message || "",
      500
    )
  }

  const { error: userRowError } = await supabaseAdmin.from(TABLES.users).insert({
    id: userId,
    email,
    role: "ADMIN",
    first_name: firstName,
    last_name: lastName,
    phone,
  })

  if (userRowError) {
    await supabaseAdmin.auth.admin.deleteUser(userId)
    return errorResponse("USER_ROW_FAILED", userRowError.message || "", 500)
  }

  const { data: adminProfile, error: adminProfileError } = await supabaseAdmin
    .from(TABLES.adminProfiles)
    .insert({ user_id: userId })
    .select("id")
    .single()

  if (adminProfileError || !adminProfile) {
    await supabaseAdmin.auth.admin.deleteUser(userId)
    return errorResponse(
      "ADMIN_PROFILE_FAILED",
      adminProfileError?.message || "",
      500
    )
  }

  for (const center of centerRows || []) {
    await supabaseAdmin.from(TABLES.adminCenters).insert({
      admin_profile_id: adminProfile.id,
      center_id: center.id,
    })
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
        role: "ADMIN",
      },
      centers: centerRows || [],
      tokens: sessionToTokens(signInData.session),
    },
    { status: 201 }
  )
}
