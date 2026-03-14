import { NextResponse } from "next/server"
import { z } from "zod"
import { supabaseAdmin } from "@/supabaseAdmin"
import { supabaseAnon } from "@/supabaseAnon"
import { errorResponse, sessionToTokens, verifyCsrf } from "@/lib/auth/api"
import { TABLES } from "@/lib/supabase/tables"

const ChildSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().optional(),
  relationship: z.string().optional(),
  allergies: z.string().optional(),
  medicalNotes: z.string().optional(),
  dietaryRestrictions: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
})

const RegisterParentSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  centerId: z.string().min(1),
  communicationPrefs: z.record(z.any()).optional(),
  children: z.array(ChildSchema).min(1),
})

export async function POST(request) {
  const csrfError = verifyCsrf(request)
  if (csrfError) return csrfError

  const body = await request.json().catch(() => null)
  const parseResult = RegisterParentSchema.safeParse(body)
  if (!parseResult.success) {
    return errorResponse("VALIDATION_ERROR", parseResult.error.message, 400)
  }

  const {
    firstName,
    lastName,
    email,
    password,
    phone,
    centerId,
    communicationPrefs,
    children,
  } = parseResult.data

  const { data: userResult, error: userError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        firstName,
        lastName,
        phone,
        role: "PARENT",
        centerId,
      },
    })

  if (userError || !userResult?.user) {
    return errorResponse("USER_CREATE_FAILED", userError?.message || "", 400)
  }

  const userId = userResult.user.id

  const { error: userRowError } = await supabaseAdmin.from(TABLES.users).insert({
    id: userId,
    email,
    role: "PARENT",
    first_name: firstName,
    last_name: lastName,
    phone,
  })

  if (userRowError) {
    await supabaseAdmin.auth.admin.deleteUser(userId)
    return errorResponse("USER_ROW_FAILED", userRowError.message || "", 500)
  }

  const { data: parentProfile, error: parentProfileError } = await supabaseAdmin
    .from(TABLES.parentProfiles)
    .insert({
      user_id: userId,
      communication_prefs: communicationPrefs || null,
    })
    .select("id")
    .single()

  if (parentProfileError || !parentProfile) {
    await supabaseAdmin.auth.admin.deleteUser(userId)
    return errorResponse(
      "PARENT_PROFILE_FAILED",
      parentProfileError?.message || "",
      500
    )
  }

  const childrenPayload = children.map((child) => ({
    parent_profile_id: parentProfile.id,
    center_id: centerId,
    first_name: child.firstName,
    last_name: child.lastName,
    date_of_birth: child.dateOfBirth || null,
    relationship: child.relationship || null,
    allergies: child.allergies || null,
    medical_notes: child.medicalNotes || null,
    dietary_restrictions: child.dietaryRestrictions || null,
  }))

  const { data: childRows, error: childrenError } = await supabaseAdmin
    .from(TABLES.children)
    .insert(childrenPayload)
    .select("*")

  if (childrenError) {
    await supabaseAdmin.auth.admin.deleteUser(userId)
    return errorResponse(
      "CHILD_CREATE_FAILED",
      childrenError.message || "",
      500
    )
  }

  // Create emergency contacts for children
  const emergencyContactsPayload = []
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    const childRow = childRows[i]
    if (childRow?.id && (child.emergencyContactName || child.emergencyContactPhone)) {
      emergencyContactsPayload.push({
        child_id: childRow.id,
        name: child.emergencyContactName || "Emergency Contact",
        phone: child.emergencyContactPhone || "",
        is_primary: true,
        is_authorized_pickup: true,
      })
    }
  }
  if (emergencyContactsPayload.length > 0) {
    await supabaseAdmin
      .from(TABLES.emergencyContacts)
      .insert(emergencyContactsPayload)
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
        role: "PARENT",
        centerId,
      },
      children: childRows || [],
      tokens: sessionToTokens(signInData.session),
    },
    { status: 201 }
  )
}
