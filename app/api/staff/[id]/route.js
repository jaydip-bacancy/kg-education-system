import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/supabaseAdmin";
import { errorResponse, verifyCsrf } from "@/lib/auth/api";
import { TABLES } from "@/lib/supabase/tables";

const UpdateStaffSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  roleTitle: z.string().min(1),
  centerIds: z.array(z.string().uuid()).min(1),
  status: z.enum(["PENDING", "ACTIVE", "INACTIVE"]),
});

/** PATCH - Update staff member */
export async function PATCH(request, { params }) {
  const csrfError = verifyCsrf(request);
  if (csrfError) return csrfError;

  const { id: staffProfileId } = await params;
  if (!staffProfileId) {
    return errorResponse("INVALID_ID", "Staff profile ID required", 400);
  }

  const body = await request.json().catch(() => null);
  const parseResult = UpdateStaffSchema.safeParse(body);
  if (!parseResult.success) {
    return errorResponse("VALIDATION_ERROR", parseResult.error.message, 400);
  }

  const { firstName, lastName, phone, roleTitle, centerIds, status } =
    parseResult.data;

  const { data: staffProfile, error: profileError } = await supabaseAdmin
    .from(TABLES.staffProfiles)
    .select("id, user_id")
    .eq("id", staffProfileId)
    .single();

  if (profileError || !staffProfile) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Staff not found" } },
      { status: 404 }
    );
  }

  const userId = staffProfile.user_id;

  const { error: userError } = await supabaseAdmin
    .from(TABLES.users)
    .update({
      first_name: firstName,
      last_name: lastName,
      phone: phone ?? null,
    })
    .eq("id", userId);

  if (userError) {
    return NextResponse.json(
      { error: { code: "UPDATE_FAILED", message: userError.message } },
      { status: 500 }
    );
  }

  const { error: profileUpdateError } = await supabaseAdmin
    .from(TABLES.staffProfiles)
    .update({ role_title: roleTitle, status })
    .eq("id", staffProfileId);

  if (profileUpdateError) {
    return NextResponse.json(
      { error: { code: "UPDATE_FAILED", message: profileUpdateError.message } },
      { status: 500 }
    );
  }

  const { error: deleteCentersError } = await supabaseAdmin
    .from(TABLES.staffCenters)
    .delete()
    .eq("staff_profile_id", staffProfileId);

  if (deleteCentersError) {
    return NextResponse.json(
      { error: { code: "UPDATE_FAILED", message: deleteCentersError.message } },
      { status: 500 }
    );
  }

  const staffCenterPayload = centerIds.map((centerId) => ({
    staff_profile_id: staffProfileId,
    center_id: centerId,
  }));

  const { error: insertCentersError } = await supabaseAdmin
    .from(TABLES.staffCenters)
    .insert(staffCenterPayload);

  if (insertCentersError) {
    return NextResponse.json(
      { error: { code: "UPDATE_FAILED", message: insertCentersError.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

/** DELETE - Delete staff member */
export async function DELETE(request, { params }) {
  const csrfError = verifyCsrf(request);
  if (csrfError) return csrfError;

  const { id: staffProfileId } = await params;
  if (!staffProfileId) {
    return errorResponse("INVALID_ID", "Staff profile ID required", 400);
  }

  const { data: staffProfile, error: profileError } = await supabaseAdmin
    .from(TABLES.staffProfiles)
    .select("id, user_id")
    .eq("id", staffProfileId)
    .single();

  if (profileError || !staffProfile) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Staff not found" } },
      { status: 404 }
    );
  }

  const userId = staffProfile.user_id;

  const { error: deleteProfileError } = await supabaseAdmin
    .from(TABLES.staffProfiles)
    .delete()
    .eq("id", staffProfileId);

  if (deleteProfileError) {
    return NextResponse.json(
      { error: { code: "DELETE_FAILED", message: deleteProfileError.message } },
      { status: 500 }
    );
  }

  await supabaseAdmin.auth.admin.deleteUser(userId);

  return NextResponse.json({ ok: true });
}
