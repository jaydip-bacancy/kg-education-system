import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/supabaseAdmin";
import { errorResponse, verifyCsrf } from "@/lib/auth/api";
import { TABLES } from "@/lib/supabase/tables";

const AssignChildSchema = z.object({
  childId: z.string().uuid(),
});

/** GET - List children enrolled in this classroom */
export async function GET(request, { params }) {
  const { id: classroomId } = await params;
  if (!classroomId) {
    return errorResponse("INVALID_ID", "Classroom ID required", 400);
  }

  const { data: roster, error: rosterError } = await supabaseAdmin
    .from(TABLES.classroomRosters)
    .select("id, child_id, enrolled_at, status")
    .eq("classroom_id", classroomId)
    .eq("status", "ACTIVE");

  if (rosterError) {
    return NextResponse.json(
      { error: { code: "FETCH_FAILED", message: rosterError.message } },
      { status: 500 }
    );
  }

  if (!roster?.length) {
    return NextResponse.json([]);
  }

  const childIds = roster.map((r) => r.child_id);
  const { data: children, error: childrenError } = await supabaseAdmin
    .from(TABLES.children)
    .select("id, first_name, last_name, date_of_birth, allergies, center_id")
    .in("id", childIds);

  if (childrenError) {
    return NextResponse.json(
      { error: { code: "FETCH_FAILED", message: childrenError.message } },
      { status: 500 }
    );
  }

  const rosterById = (roster || []).reduce((acc, r) => {
    acc[r.child_id] = r;
    return acc;
  }, {});

  const result = (children || []).map((c) => ({
    ...c,
    rosterId: rosterById[c.id]?.id,
    enrolledAt: rosterById[c.id]?.enrolled_at,
  }));

  return NextResponse.json(result);
}

/** POST - Assign child to classroom */
export async function POST(request, { params }) {
  const csrfError = verifyCsrf(request);
  if (csrfError) return csrfError;

  const { id: classroomId } = await params;
  if (!classroomId) return errorResponse("INVALID_ID", "Classroom ID required", 400);

  const body = await request.json().catch(() => null);
  const parse = AssignChildSchema.safeParse(body);
  if (!parse.success) {
    return errorResponse("VALIDATION_ERROR", parse.error.message, 400);
  }

  const { childId } = parse.data;

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

  const { data: child, error: childError } = await supabaseAdmin
    .from(TABLES.children)
    .select("id, center_id")
    .eq("id", childId)
    .single();

  if (childError || !child) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Child not found" } },
      { status: 404 }
    );
  }

  if (child.center_id !== classroom.center_id) {
    return errorResponse(
      "CENTER_MISMATCH",
      "Child must belong to the same center as the classroom",
      400
    );
  }

  const { data: existing } = await supabaseAdmin
    .from(TABLES.classroomRosters)
    .select("id")
    .eq("classroom_id", classroomId)
    .eq("child_id", childId)
    .maybeSingle();

  if (existing) {
    await supabaseAdmin
      .from(TABLES.classroomRosters)
      .update({ status: "ACTIVE" })
      .eq("id", existing.id);
    const { data: updated } = await supabaseAdmin
      .from(TABLES.classroomRosters)
      .select("*")
      .eq("id", existing.id)
      .single();
    return NextResponse.json(updated, { status: 200 });
  }

  const { data: roster, error } = await supabaseAdmin
    .from(TABLES.classroomRosters)
    .insert({
      classroom_id: classroomId,
      child_id: childId,
      status: "ACTIVE",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: { code: "ASSIGN_FAILED", message: error.message } },
      { status: 500 }
    );
  }
  return NextResponse.json(roster, { status: 201 });
}

/** DELETE - Unassign child from classroom (body: { childId }) */
export async function DELETE(request, { params }) {
  const csrfError = verifyCsrf(request);
  if (csrfError) return csrfError;

  const { id: classroomId } = await params;
  if (!classroomId) return errorResponse("INVALID_ID", "Classroom ID required", 400);

  const { searchParams } = new URL(request.url);
  const childId = searchParams.get("childId");
  if (!childId) return errorResponse("VALIDATION_ERROR", "childId query param required", 400);

  const { error } = await supabaseAdmin
    .from(TABLES.classroomRosters)
    .delete()
    .eq("classroom_id", classroomId)
    .eq("child_id", childId);

  if (error) {
    return NextResponse.json(
      { error: { code: "UNASSIGN_FAILED", message: error.message } },
      { status: 500 }
    );
  }
  return new NextResponse(null, { status: 204 });
}
