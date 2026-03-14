import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/supabaseAdmin";
import { errorResponse, verifyCsrf } from "@/lib/auth/api";
import { TABLES } from "@/lib/supabase/tables";

const AssignStaffSchema = z.object({
  staffProfileId: z.string().uuid(),
  roleTitle: z.string().optional(),
});

/** GET - List staff assigned to this classroom */
export async function GET(request, { params }) {
  const { id: classroomId } = await params;
  if (!classroomId) {
    return errorResponse("INVALID_ID", "Classroom ID required", 400);
  }

  const { data: assignments, error: assignError } = await supabaseAdmin
    .from(TABLES.staffClassrooms)
    .select("id, staff_profile_id, role_title")
    .eq("classroom_id", classroomId);

  if (assignError) {
    return NextResponse.json(
      { error: { code: "FETCH_FAILED", message: assignError.message } },
      { status: 500 }
    );
  }

  if (!assignments?.length) {
    return NextResponse.json([]);
  }

  const staffIds = assignments.map((a) => a.staff_profile_id);
  const { data: staffProfiles, error: staffError } = await supabaseAdmin
    .from(TABLES.staffProfiles)
    .select("id, user_id")
    .in("id", staffIds);

  if (staffError) {
    return NextResponse.json(
      { error: { code: "FETCH_FAILED", message: staffError.message } },
      { status: 500 }
    );
  }

  const userIds = (staffProfiles || []).map((s) => s.user_id).filter(Boolean);
  const { data: users } = await supabaseAdmin
    .from(TABLES.users)
    .select("id, email, first_name, last_name")
    .in("id", userIds);

  const usersById = (users || []).reduce((acc, u) => {
    acc[u.id] = u;
    return acc;
  }, {});

  const staffById = (staffProfiles || []).reduce((acc, s) => {
    acc[s.id] = s;
    return acc;
  }, {});

  const assignById = (assignments || []).reduce((acc, a) => {
    acc[a.staff_profile_id] = a;
    return acc;
  }, {});

  const result = (staffProfiles || []).map((sp) => {
    const u = usersById[sp.user_id] || {};
    const a = assignById[sp.id] || {};
    return {
      assignmentId: a.id,
      staffProfileId: sp.id,
      userId: sp.user_id,
      firstName: u.first_name,
      lastName: u.last_name,
      email: u.email,
      roleTitle: a.role_title,
    };
  });

  return NextResponse.json(result);
}

/** POST - Assign staff to classroom */
export async function POST(request, { params }) {
  const csrfError = verifyCsrf(request);
  if (csrfError) return csrfError;

  const { id: classroomId } = await params;
  if (!classroomId) return errorResponse("INVALID_ID", "Classroom ID required", 400);

  const body = await request.json().catch(() => null);
  const parse = AssignStaffSchema.safeParse(body);
  if (!parse.success) {
    return errorResponse("VALIDATION_ERROR", parse.error.message, 400);
  }

  const { staffProfileId, roleTitle } = parse.data;

  const { data: classroom } = await supabaseAdmin
    .from(TABLES.classrooms)
    .select("center_id")
    .eq("id", classroomId)
    .single();

  if (!classroom) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Classroom not found" } },
      { status: 404 }
    );
  }

  const { data: staffCenter } = await supabaseAdmin
    .from(TABLES.staffCenters)
    .select("id")
    .eq("staff_profile_id", staffProfileId)
    .eq("center_id", classroom.center_id)
    .maybeSingle();

  if (!staffCenter) {
    return errorResponse(
      "CENTER_MISMATCH",
      "Staff must be assigned to the same center as the classroom",
      400
    );
  }

  const { data: existing } = await supabaseAdmin
    .from(TABLES.staffClassrooms)
    .select("id")
    .eq("classroom_id", classroomId)
    .eq("staff_profile_id", staffProfileId)
    .maybeSingle();

  if (existing) {
    const updates = roleTitle != null ? { role_title: roleTitle } : {};
    if (Object.keys(updates).length > 0) {
      await supabaseAdmin
        .from(TABLES.staffClassrooms)
        .update(updates)
        .eq("id", existing.id);
    }
    const { data: updated } = await supabaseAdmin
      .from(TABLES.staffClassrooms)
      .select("*")
      .eq("id", existing.id)
      .single();
    return NextResponse.json(updated, { status: 200 });
  }

  const { data: assignment, error } = await supabaseAdmin
    .from(TABLES.staffClassrooms)
    .insert({
      classroom_id: classroomId,
      staff_profile_id: staffProfileId,
      role_title: roleTitle || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: { code: "ASSIGN_FAILED", message: error.message } },
      { status: 500 }
    );
  }
  return NextResponse.json(assignment, { status: 201 });
}

/** DELETE - Unassign staff (query: staffProfileId) */
export async function DELETE(request, { params }) {
  const csrfError = verifyCsrf(request);
  if (csrfError) return csrfError;

  const { id: classroomId } = await params;
  if (!classroomId) return errorResponse("INVALID_ID", "Classroom ID required", 400);

  const { searchParams } = new URL(request.url);
  const staffProfileId = searchParams.get("staffProfileId");
  if (!staffProfileId) return errorResponse("VALIDATION_ERROR", "staffProfileId query param required", 400);

  const { error } = await supabaseAdmin
    .from(TABLES.staffClassrooms)
    .delete()
    .eq("classroom_id", classroomId)
    .eq("staff_profile_id", staffProfileId);

  if (error) {
    return NextResponse.json(
      { error: { code: "UNASSIGN_FAILED", message: error.message } },
      { status: 500 }
    );
  }
  return new NextResponse(null, { status: 204 });
}
