import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/supabaseAdmin";
import { TABLES } from "@/lib/supabase/tables";

/** GET - Dashboard stats by role.
 * Query: userId, role (ADMIN | STAFF | PARENT)
 * - ADMIN: parentsCount, classesCount, centersCount, activeStaffCount, incidentsCount
 * - STAFF: classesAssignedCount, studentsCount, incidentsCount (for assigned classes)
 * - PARENT: 403 inaccessible
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const role = searchParams.get("role");

  if (!role || !["ADMIN", "STAFF", "PARENT"].includes(role)) {
    return NextResponse.json(
      { error: { code: "INVALID_ROLE", message: "Valid role required" } },
      { status: 400 }
    );
  }

  if (role === "PARENT") {
    return NextResponse.json(
      { error: { code: "DASHBOARD_INACCESSIBLE", message: "Dashboard is not available for parents" } },
      { status: 403 }
    );
  }

  if (role === "ADMIN") {
    const [parentsRes, classesRes, centersRes, staffRes, incidentsRes] = await Promise.all([
      supabaseAdmin.from(TABLES.parentProfiles).select("id", { count: "exact", head: true }),
      supabaseAdmin.from(TABLES.classrooms).select("id", { count: "exact", head: true }),
      supabaseAdmin.from(TABLES.centers).select("id", { count: "exact", head: true }),
      supabaseAdmin.from(TABLES.staffProfiles).select("id", { count: "exact", head: true }).eq("status", "ACTIVE"),
      supabaseAdmin.from(TABLES.incidents).select("id", { count: "exact", head: true }),
    ]);

    return NextResponse.json({
      parentsCount: parentsRes.count ?? 0,
      classesCount: classesRes.count ?? 0,
      centersCount: centersRes.count ?? 0,
      activeStaffCount: staffRes.count ?? 0,
      incidentsCount: incidentsRes.count ?? 0,
    });
  }

  if (role === "STAFF") {
    if (!userId) {
      return NextResponse.json(
        { error: { code: "USER_ID_REQUIRED", message: "userId required for staff" } },
        { status: 400 }
      );
    }

    const { data: staffProfile } = await supabaseAdmin
      .from(TABLES.staffProfiles)
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!staffProfile) {
      return NextResponse.json({
        classesAssignedCount: 0,
        studentsCount: 0,
        incidentsCount: 0,
      });
    }

    const { data: staffClassrooms } = await supabaseAdmin
      .from(TABLES.staffClassrooms)
      .select("classroom_id")
      .eq("staff_profile_id", staffProfile.id);

    const classroomIds = (staffClassrooms || []).map((s) => s.classroom_id).filter(Boolean);
    if (classroomIds.length === 0) {
      return NextResponse.json({
        classesAssignedCount: 0,
        studentsCount: 0,
        incidentsCount: 0,
      });
    }

    const { data: roster } = await supabaseAdmin
      .from(TABLES.classroomRosters)
      .select("child_id")
      .in("classroom_id", classroomIds)
      .eq("status", "ACTIVE");
    const childIds = [...new Set((roster || []).map((r) => r.child_id).filter(Boolean))];

    let incidentsCount = 0;
    if (childIds.length > 0) {
      const { count } = await supabaseAdmin
        .from(TABLES.incidents)
        .select("id", { count: "exact", head: true })
        .in("child_id", childIds);
      incidentsCount = count ?? 0;
    }

    return NextResponse.json({
      classesAssignedCount: classroomIds.length,
      studentsCount: childIds.length,
      incidentsCount,
    });
  }

  return NextResponse.json({}, { status: 200 });
}
