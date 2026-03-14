import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/supabaseAdmin";
import { errorResponse } from "@/lib/auth/api";
import { TABLES } from "@/lib/supabase/tables";

/** GET - Children and staff available to assign to this classroom
 *  Query: type=children | type=staff | (omit for both)
 */
export async function GET(request, { params }) {
  const { id: classroomId } = await params;
  if (!classroomId) return errorResponse("INVALID_ID", "Classroom ID required", 400);

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  const { data: classroom, error: classError } = await supabaseAdmin
    .from(TABLES.classrooms)
    .select("center_id")
    .eq("id", classroomId)
    .single();

  if (classError || !classroom) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Classroom not found" } },
      { status: 404 }
    );
  }

  const centerId = classroom.center_id;

  let result = {};

  if (!type || type === "children") {
    const { data: children } = await supabaseAdmin
      .from(TABLES.children)
      .select("id, first_name, last_name, date_of_birth, center_id");

    result.children = children || [];
  }

  if (!type || type === "staff") {
    const { data: assigned } = await supabaseAdmin
      .from(TABLES.staffClassrooms)
      .select("staff_profile_id")
      .eq("classroom_id", classroomId);

    const assignedIds = new Set((assigned || []).map((a) => a.staff_profile_id));

    const { data: staffCenters } = await supabaseAdmin
      .from(TABLES.staffCenters)
      .select("staff_profile_id")
      .eq("center_id", centerId);

    const staffProfileIds = [...new Set((staffCenters || []).map((s) => s.staff_profile_id))].filter(
      (id) => !assignedIds.has(id)
    );

    if (staffProfileIds.length === 0) {
      result.staff = [];
    } else {
      const { data: profiles } = await supabaseAdmin
        .from(TABLES.staffProfiles)
        .select("id, user_id")
        .in("id", staffProfileIds)
        .eq("status", "ACTIVE");

      const userIds = (profiles || []).map((p) => p.user_id).filter(Boolean);
      const { data: users } = await supabaseAdmin
        .from(TABLES.users)
        .select("id, first_name, last_name, email")
        .in("id", userIds);

      const usersById = (users || []).reduce((acc, u) => {
        acc[u.id] = u;
        return acc;
      }, {});

      result.staff = (profiles || []).map((p) => ({
        staffProfileId: p.id,
        userId: p.user_id,
        ...usersById[p.user_id],
      }));
    }
  }

  return NextResponse.json(result);
}
