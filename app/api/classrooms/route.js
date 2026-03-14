import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/supabaseAdmin";
import { errorResponse, verifyCsrf } from "@/lib/auth/api";
import { TABLES } from "@/lib/supabase/tables";

const CreateClassroomSchema = z.object({
  centerId: z.string().uuid(),
  name: z.string().min(1),
  capacity: z.number().int().positive().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});

/** GET - List classrooms, optionally filtered by center. Includes roster count. */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const centerId = searchParams.get("centerId");

  let query = supabaseAdmin
    .from(TABLES.classrooms)
    .select("id, center_id, name, capacity, start_time, end_time, created_at");

  if (centerId) {
    query = query.eq("center_id", centerId);
  }

  const { data: classrooms, error } = await query.order("name");

  if (error) {
    return NextResponse.json(
      { error: { code: "FETCH_FAILED", message: error.message } },
      { status: 500 }
    );
  }

  if (!classrooms?.length) {
    return NextResponse.json([]);
  }

  const classroomIds = classrooms.map((c) => c.id);
  const { data: rosters } = await supabaseAdmin
    .from(TABLES.classroomRosters)
    .select("classroom_id")
    .eq("status", "ACTIVE")
    .in("classroom_id", classroomIds);

  const countByClassroom = (rosters || []).reduce((acc, r) => {
    acc[r.classroom_id] = (acc[r.classroom_id] || 0) + 1;
    return acc;
  }, {});

  const result = classrooms.map((c) => ({
    ...c,
    rosterCount: countByClassroom[c.id] ?? 0,
  }));

  return NextResponse.json(result);
}

/** POST - Create classroom */
export async function POST(request) {
  const csrfError = verifyCsrf(request);
  if (csrfError) return csrfError;

  const body = await request.json().catch(() => null);
  const parse = CreateClassroomSchema.safeParse(body);
  if (!parse.success) {
    return errorResponse("VALIDATION_ERROR", parse.error.message, 400);
  }

  const { centerId, name, capacity, startTime, endTime } = parse.data;

  const insertPayload = {
    center_id: centerId,
    name,
    capacity: capacity ?? 20,
  };
  if (startTime) insertPayload.start_time = startTime;
  if (endTime) insertPayload.end_time = endTime;

  const { data, error } = await supabaseAdmin
    .from(TABLES.classrooms)
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: { code: "CREATE_FAILED", message: error.message } },
      { status: 500 }
    );
  }
  return NextResponse.json(data, { status: 201 });
}
