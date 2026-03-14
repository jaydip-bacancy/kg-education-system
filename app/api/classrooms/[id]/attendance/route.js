import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/supabaseAdmin";
import { errorResponse, verifyCsrf } from "@/lib/auth/api";
import { TABLES } from "@/lib/supabase/tables";

const CheckInSchema = z.object({
  childId: z.string().uuid(),
  checkedInBy: z.string().uuid(),
  notes: z.string().optional(),
});

const CheckOutSchema = z.object({
  attendanceId: z.string().uuid(),
  checkedOutBy: z.string().uuid(),
  notes: z.string().optional(),
});

/** GET - Attendance for this classroom */
export async function GET(request, { params }) {
  const { id: classroomId } = await params;
  if (!classroomId) return errorResponse("INVALID_ID", "Classroom ID required", 400);

  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("date");
  const activeOnly = ["1", "true"].includes((searchParams.get("activeOnly") || "").toLowerCase());
  const date = dateStr ? new Date(dateStr) : new Date();
  const today = date.toISOString().slice(0, 10);
  const dayStart = `${today}T00:00:00.000Z`;
  const dayEnd = `${today}T23:59:59.999Z`;

  let query = supabaseAdmin
    .from(TABLES.attendance)
    .select("id, child_id, checked_in_at, checked_out_at, checked_in_by, checked_out_by, notes")
    .eq("classroom_id", classroomId)
    .order("checked_in_at", { ascending: false });

  if (activeOnly) {
    query = query.is("checked_out_at", null);
  } else {
    query = query.gte("checked_in_at", dayStart).lte("checked_in_at", dayEnd);
  }

  const { data: attendance, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: { code: "FETCH_FAILED", message: error.message } },
      { status: 500 }
    );
  }

  const childIds = [...new Set((attendance || []).map((record) => record.child_id).filter(Boolean))];
  const { data: children } = childIds.length
    ? await supabaseAdmin
        .from(TABLES.children)
        .select("id, first_name, last_name")
        .in("id", childIds)
    : { data: [] };

  const childrenById = (children || []).reduce((acc, child) => {
    acc[child.id] = child;
    return acc;
  }, {});

  const result = (attendance || []).map((record) => ({
    ...record,
    child: childrenById[record.child_id],
  }));

  return NextResponse.json(result);
}

/** POST - Check in child */
export async function POST(request, { params }) {
  const csrfError = verifyCsrf(request);
  if (csrfError) return csrfError;

  const { id: classroomId } = await params;
  if (!classroomId) return errorResponse("INVALID_ID", "Classroom ID required", 400);

  const body = await request.json().catch(() => null);
  const parse = CheckInSchema.safeParse(body);
  if (!parse.success) {
    return errorResponse("VALIDATION_ERROR", parse.error.message, 400);
  }

  const { childId, checkedInBy, notes } = parse.data;

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

  const { data: roster } = await supabaseAdmin
    .from(TABLES.classroomRosters)
    .select("id")
    .eq("classroom_id", classroomId)
    .eq("child_id", childId)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (!roster) {
    return errorResponse(
      "NOT_ENROLLED",
      "Child must be enrolled in this classroom to check in",
      400
    );
  }

  const { data: existingRecord } = await supabaseAdmin
    .from(TABLES.attendance)
    .select("id")
    .eq("child_id", childId)
    .eq("classroom_id", classroomId)
    .is("checked_out_at", null)
    .maybeSingle();

  if (existingRecord) {
    return errorResponse(
      "ALREADY_CHECKED_IN",
      "Child is already checked in to this classroom",
      400
    );
  }

  const { data: record, error } = await supabaseAdmin
    .from(TABLES.attendance)
    .insert({
      child_id: childId,
      center_id: classroom.center_id,
      classroom_id: classroomId,
      checked_in_at: new Date().toISOString(),
      checked_in_by: checkedInBy,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: { code: "CHECKIN_FAILED", message: error.message } },
      { status: 500 }
    );
  }
  return NextResponse.json(record, { status: 201 });
}

/** PATCH - Check out child */
export async function PATCH(request, { params }) {
  const csrfError = verifyCsrf(request);
  if (csrfError) return csrfError;

  const { id: classroomId } = await params;
  if (!classroomId) return errorResponse("INVALID_ID", "Classroom ID required", 400);

  const body = await request.json().catch(() => null);
  const parse = CheckOutSchema.safeParse(body);
  if (!parse.success) {
    return errorResponse("VALIDATION_ERROR", parse.error.message, 400);
  }

  const { attendanceId, checkedOutBy, notes } = parse.data;

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from(TABLES.attendance)
    .select("id, classroom_id, checked_out_at")
    .eq("id", attendanceId)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Attendance record not found" } },
      { status: 404 }
    );
  }

  if (existing.classroom_id !== classroomId) {
    return errorResponse(
      "CLASSROOM_MISMATCH",
      "Attendance record does not belong to this classroom",
      400
    );
  }

  if (existing.checked_out_at) {
    return errorResponse("ALREADY_CHECKED_OUT", "Child is already checked out", 400);
  }

  const updates = {
    checked_out_at: new Date().toISOString(),
    checked_out_by: checkedOutBy,
    updated_at: new Date().toISOString(),
  };
  if (notes != null) updates.notes = notes;

  const { data: record, error } = await supabaseAdmin
    .from(TABLES.attendance)
    .update(updates)
    .eq("id", attendanceId)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: { code: "CHECKOUT_FAILED", message: error.message } },
      { status: 500 }
    );
  }
  return NextResponse.json(record);
}
