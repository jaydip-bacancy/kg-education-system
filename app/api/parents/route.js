import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/supabaseAdmin";
import { errorResponse, verifyCsrf } from "@/lib/auth/api";
import { TABLES } from "@/lib/supabase/tables";

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
});

const CreateParentSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  centerId: z.string().min(1),
  communicationPrefs: z.record(z.any()).optional(),
  children: z.array(ChildSchema).min(1),
});

/** GET - List parents with their children */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const centerId = searchParams.get("centerId");

  let childrenQuery = supabaseAdmin
    .from(TABLES.children)
    .select(
      `
      id,
      parent_profile_id,
      first_name,
      last_name,
      date_of_birth,
      relationship,
      allergies,
      medical_notes,
      dietary_restrictions,
      center_id
    `
    );

  if (centerId) {
    childrenQuery = childrenQuery.eq("center_id", centerId);
  }

  const { data: children, error: childrenError } = await childrenQuery;

  if (childrenError) {
    return NextResponse.json(
      { error: { code: "FETCH_FAILED", message: childrenError.message } },
      { status: 500 }
    );
  }

  const parentProfileIds = [...new Set((children || []).map((c) => c.parent_profile_id).filter(Boolean))];
  if (parentProfileIds.length === 0) {
    return NextResponse.json([]);
  }

  const { data: parentProfiles, error: profilesError } = await supabaseAdmin
    .from(TABLES.parentProfiles)
    .select("id, user_id, communication_prefs")
    .in("id", parentProfileIds);

  if (profilesError) {
    return NextResponse.json(
      { error: { code: "FETCH_FAILED", message: profilesError.message } },
      { status: 500 }
    );
  }

  const userIds = [...new Set((parentProfiles || []).map((p) => p.user_id).filter(Boolean))];
  const { data: userRows, error: usersError } = await supabaseAdmin
    .from(TABLES.users)
    .select("id, email, first_name, last_name, phone")
    .in("id", userIds);

  if (usersError) {
    return NextResponse.json(
      { error: { code: "FETCH_FAILED", message: usersError.message } },
      { status: 500 }
    );
  }

  const usersById = (userRows || []).reduce((acc, u) => {
    acc[u.id] = u;
    return acc;
  }, {});

  const childrenByParent = (children || []).reduce((acc, child) => {
    const pid = child.parent_profile_id;
    if (!acc[pid]) acc[pid] = [];
    acc[pid].push({
      id: child.id,
      firstName: child.first_name,
      lastName: child.last_name,
      dateOfBirth: child.date_of_birth,
      relationship: child.relationship,
      allergies: child.allergies,
      medicalNotes: child.medical_notes,
      dietaryRestrictions: child.dietary_restrictions,
      centerId: child.center_id,
    });
    return acc;
  }, {});

  const result = (parentProfiles || []).map((pp) => {
    const u = usersById[pp.user_id] || {};
    return {
      id: pp.id,
      userId: pp.user_id,
      email: u?.email,
      firstName: u?.first_name,
      lastName: u?.last_name,
      phone: u?.phone,
      communicationPrefs: pp.communication_prefs,
      children: childrenByParent[pp.id] || [],
    };
  });

  return NextResponse.json(result);
}

/** POST - Admin creates a parent and their children */
export async function POST(request) {
  const csrfError = verifyCsrf(request);
  if (csrfError) return csrfError;

  const body = await request.json().catch(() => null);
  const parseResult = CreateParentSchema.safeParse(body);
  if (!parseResult.success) {
    return errorResponse("VALIDATION_ERROR", parseResult.error.message, 400);
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
  } = parseResult.data;

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
    });

  if (userError || !userResult?.user) {
    return errorResponse("USER_CREATE_FAILED", userError?.message || "", 400);
  }

  const userId = userResult.user.id;

  const { error: userRowError } = await supabaseAdmin.from(TABLES.users).insert({
    id: userId,
    email,
    role: "PARENT",
    first_name: firstName,
    last_name: lastName,
    phone,
  });

  if (userRowError) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return errorResponse("USER_ROW_FAILED", userRowError.message || "", 500);
  }

  const { data: parentProfile, error: parentProfileError } = await supabaseAdmin
    .from(TABLES.parentProfiles)
    .insert({
      user_id: userId,
      communication_prefs: communicationPrefs || null,
    })
    .select("id")
    .single();

  if (parentProfileError || !parentProfile) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return errorResponse(
      "PARENT_PROFILE_FAILED",
      parentProfileError?.message || "",
      500
    );
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
  }));

  const { data: childRows, error: childrenError } = await supabaseAdmin
    .from(TABLES.children)
    .insert(childrenPayload)
    .select("*");

  if (childrenError) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return errorResponse(
      "CHILD_CREATE_FAILED",
      childrenError.message || "",
      500
    );
  }

  const emergencyContactsPayload = [];
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const childRow = childRows[i];
    if (
      childRow?.id &&
      (child.emergencyContactName || child.emergencyContactPhone)
    ) {
      emergencyContactsPayload.push({
        child_id: childRow.id,
        name: child.emergencyContactName || "Emergency Contact",
        phone: child.emergencyContactPhone || "",
        is_primary: true,
        is_authorized_pickup: true,
      });
    }
  }
  if (emergencyContactsPayload.length > 0) {
    await supabaseAdmin
      .from(TABLES.emergencyContacts)
      .insert(emergencyContactsPayload);
  }

  return NextResponse.json(
    {
      id: parentProfile.id,
      userId,
      email,
      firstName,
      lastName,
      phone,
      children: childRows || [],
    },
    { status: 201 }
  );
}
