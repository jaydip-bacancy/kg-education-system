import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/supabaseAdmin";
import { errorResponse, verifyCsrf } from "@/lib/auth/api";
import { TABLES } from "@/lib/supabase/tables";

const CreateStaffSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  roleTitle: z.string().min(1),
  centerIds: z.array(z.string().uuid()).min(1),
  status: z.enum(["PENDING", "ACTIVE"]).optional(),
});

/** GET - List staff with their centers */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const centerId = searchParams.get("centerId");

  const { data: staffProfiles, error: profilesError } = await supabaseAdmin
    .from(TABLES.staffProfiles)
    .select("id, user_id, role_title, status")
    .order("created_at", { ascending: false });

  if (profilesError) {
    return NextResponse.json(
      { error: { code: "FETCH_FAILED", message: profilesError.message } },
      { status: 500 }
    );
  }

  if (!staffProfiles?.length) {
    return NextResponse.json([]);
  }

  const userIds = staffProfiles.map((p) => p.user_id).filter(Boolean);
  const { data: users } = await supabaseAdmin
    .from(TABLES.users)
    .select("id, email, first_name, last_name, phone")
    .in("id", userIds);

  const { data: staffCenters } = await supabaseAdmin
    .from(TABLES.staffCenters)
    .select("staff_profile_id, center_id")
    .in("staff_profile_id", staffProfiles.map((p) => p.id));

  const centerIds = [...new Set((staffCenters || []).map((s) => s.center_id))];
  const { data: centers } = await supabaseAdmin
    .from(TABLES.centers)
    .select("id, name")
    .in("id", centerIds);

  const usersById = (users || []).reduce((acc, u) => {
    acc[u.id] = u;
    return acc;
  }, {});

  const centersById = (centers || []).reduce((acc, c) => {
    acc[c.id] = c;
    return acc;
  }, {});

  const centersByStaff = (staffCenters || []).reduce((acc, sc) => {
    if (!acc[sc.staff_profile_id]) acc[sc.staff_profile_id] = [];
    const c = centersById[sc.center_id];
    if (c) acc[sc.staff_profile_id].push({ id: c.id, name: c.name });
    return acc;
  }, {});

  let result = staffProfiles.map((sp) => {
    const u = usersById[sp.user_id] || {};
    const staffCentersList = centersByStaff[sp.id] || [];
    return {
      id: sp.id,
      userId: sp.user_id,
      email: u.email,
      firstName: u.first_name,
      lastName: u.last_name,
      phone: u.phone,
      roleTitle: sp.role_title,
      status: sp.status,
      centers: staffCentersList,
    };
  });

  if (centerId) {
    result = result.filter((s) =>
      (centersByStaff[s.id] || []).some((c) => c.id === centerId)
    );
  }

  return NextResponse.json(result);
}

/** POST - Create staff member */
export async function POST(request) {
  const csrfError = verifyCsrf(request);
  if (csrfError) return csrfError;

  const body = await request.json().catch(() => null);
  const parseResult = CreateStaffSchema.safeParse(body);
  if (!parseResult.success) {
    return errorResponse("VALIDATION_ERROR", parseResult.error.message, 400);
  }

  const {
    firstName,
    lastName,
    email,
    password,
    phone,
    roleTitle,
    centerIds,
    status = "ACTIVE",
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
        role: "STAFF",
        staffStatus: status,
      },
    });

  if (userError || !userResult?.user) {
    return errorResponse(
      "USER_CREATE_FAILED",
      userError?.message || "Email may already be in use",
      400
    );
  }

  const userId = userResult.user.id;

  const { error: userRowError } = await supabaseAdmin.from(TABLES.users).insert({
    id: userId,
    email,
    role: "STAFF",
    first_name: firstName,
    last_name: lastName,
    phone: phone ?? null,
  });

  if (userRowError) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return errorResponse("USER_ROW_FAILED", userRowError.message, 500);
  }

  const { data: staffProfile, error: staffProfileError } = await supabaseAdmin
    .from(TABLES.staffProfiles)
    .insert({
      user_id: userId,
      role_title: roleTitle,
      status,
    })
    .select("id")
    .single();

  if (staffProfileError || !staffProfile) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return errorResponse(
      "STAFF_PROFILE_FAILED",
      staffProfileError?.message || "",
      500
    );
  }

  const staffCenterPayload = centerIds.map((centerId) => ({
    staff_profile_id: staffProfile.id,
    center_id: centerId,
  }));

  const { error: staffCentersError } = await supabaseAdmin
    .from(TABLES.staffCenters)
    .insert(staffCenterPayload);

  if (staffCentersError) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return errorResponse(
      "STAFF_CENTERS_FAILED",
      staffCentersError.message,
      500
    );
  }

  return NextResponse.json(
    {
      id: staffProfile.id,
      userId,
      email,
      firstName,
      lastName,
      phone,
      roleTitle,
      status,
      centers: centerIds,
    },
    { status: 201 }
  );
}
