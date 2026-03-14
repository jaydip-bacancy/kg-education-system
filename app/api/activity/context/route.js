import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/supabaseAdmin";
import { TABLES } from "@/lib/supabase/tables";

/** GET - For parents: children with their classrooms. ?userId= required. */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return NextResponse.json(
      { error: { code: "MISSING_PARAMS", message: "userId required" } },
      { status: 400 }
    );
  }

  const { data: parentProfile } = await supabaseAdmin
    .from(TABLES.parentProfiles)
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!parentProfile) {
    return NextResponse.json({ children: [], classrooms: [] });
  }

  const { data: children } = await supabaseAdmin
    .from(TABLES.children)
    .select("id, first_name, last_name, center_id")
    .eq("parent_profile_id", parentProfile.id);

  if (!children?.length) {
    return NextResponse.json({ children: [], classrooms: [] });
  }

  const childIds = children.map((c) => c.id);
  const { data: rosters } = await supabaseAdmin
    .from(TABLES.classroomRosters)
    .select("child_id, classroom_id")
    .in("child_id", childIds)
    .eq("status", "ACTIVE");

  const classroomIds = [...new Set((rosters || []).map((r) => r.classroom_id).filter(Boolean))];
  const rosterByChild = (rosters || []).reduce((acc, r) => {
    acc[r.child_id] = r.classroom_id;
    return acc;
  }, {});

  let classrooms = [];
  if (classroomIds.length) {
    const { data: cls } = await supabaseAdmin
      .from(TABLES.classrooms)
      .select("id, name")
      .in("id", classroomIds);
    classrooms = cls || [];
  }

  const classroomsById = classrooms.reduce((acc, c) => {
    acc[c.id] = c;
    return acc;
  }, {});

  const result = {
    children: children.map((c) => ({
      id: c.id,
      firstName: c.first_name,
      lastName: c.last_name,
      classroomId: rosterByChild[c.id] || null,
      classroomName: rosterByChild[c.id] ? classroomsById[rosterByChild[c.id]]?.name : null,
    })),
    classrooms: classrooms.map((c) => ({ id: c.id, name: c.name })),
  };

  return NextResponse.json(result);
}
