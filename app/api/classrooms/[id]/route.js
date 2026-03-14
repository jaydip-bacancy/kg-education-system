import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/supabaseAdmin";
import { errorResponse, verifyCsrf } from "@/lib/auth/api";
import { TABLES } from "@/lib/supabase/tables";

const UpdateClassroomSchema = z.object({
  name: z.string().min(1).optional(),
  capacity: z.number().int().positive().optional(),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
});

/** GET - Get classroom with center, roster count, staff count, and today's attendance */
export async function GET(request, { params }) {
  const { id } = await params;
  if (!id) {
    return errorResponse("INVALID_ID", "Classroom ID required", 400);
  }

  const { data: classroom, error: classError } = await supabaseAdmin
    .from(TABLES.classrooms)
    .select("id, center_id, name, capacity, start_time, end_time, created_at")
    .eq("id", id)
    .single();

  if (classError || !classroom) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Classroom not found" } },
      { status: 404 }
    );
  }

  const { data: center } = await supabaseAdmin
    .from(TABLES.centers)
    .select("id, name")
    .eq("id", classroom.center_id)
    .single();

  const { count: rosterCount } = await supabaseAdmin
    .from(TABLES.classroomRosters)
    .select("*", { count: "exact", head: true })
    .eq("classroom_id", id)
    .eq("status", "ACTIVE");

  const { count: staffCount } = await supabaseAdmin
    .from(TABLES.staffClassrooms)
    .select("*", { count: "exact", head: true })
    .eq("classroom_id", id);

  const today = new Date().toISOString().slice(0, 10);
  const dayStart = `${today}T00:00:00.000Z`;
  const dayEnd = `${today}T23:59:59.999Z`;

  const { data: attendance } = await supabaseAdmin
    .from(TABLES.attendance)
    .select("id, child_id, checked_in_at, checked_out_at, checked_in_by, checked_out_by")
    .eq("classroom_id", id)
    .gte("checked_in_at", dayStart)
    .lte("checked_in_at", dayEnd);

  return NextResponse.json({
    ...classroom,
    center: center || null,
    rosterCount: rosterCount ?? 0,
    staffCount: staffCount ?? 0,
    todayAttendance: attendance || [],
  });
}

/** PATCH - Update classroom */
export async function PATCH(request, { params }) {
  const csrfError = verifyCsrf(request);
  if (csrfError) return csrfError;

  const { id } = await params;
  if (!id) return errorResponse("INVALID_ID", "Classroom ID required", 400);

  const body = await request.json().catch(() => null);
  const parse = UpdateClassroomSchema.safeParse(body);
  if (!parse.success) {
    return errorResponse("VALIDATION_ERROR", parse.error.message, 400);
  }

  const updates = {};
  if (parse.data.name != null) updates.name = parse.data.name;
  if (parse.data.capacity != null) updates.capacity = parse.data.capacity;
  if (parse.data.startTime !== undefined) updates.start_time = parse.data.startTime || null;
  if (parse.data.endTime !== undefined) updates.end_time = parse.data.endTime || null;

  if (Object.keys(updates).length === 0) {
    return errorResponse("NO_UPDATES", "No fields to update", 400);
  }

  const { data, error } = await supabaseAdmin
    .from(TABLES.classrooms)
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: { code: "UPDATE_FAILED", message: error.message } },
      { status: 500 }
    );
  }
  return NextResponse.json(data);
}

/** DELETE - Delete classroom */
export async function DELETE(request, { params }) {
  const csrfError = verifyCsrf(request);
  if (csrfError) return csrfError;

  const { id } = await params;
  if (!id) return errorResponse("INVALID_ID", "Classroom ID required", 400);

  const { error } = await supabaseAdmin
    .from(TABLES.classrooms)
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: { code: "DELETE_FAILED", message: error.message } },
      { status: 500 }
    );
  }
  return new NextResponse(null, { status: 204 });
}
