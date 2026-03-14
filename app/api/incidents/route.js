import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/supabaseAdmin";
import { errorResponse, verifyCsrf } from "@/lib/auth/api";
import { TABLES } from "@/lib/supabase/tables";

const INCIDENT_TYPES = ["INJURY", "ILLNESS", "BEHAVIOR", "PROPERTY", "OTHER"];

const CreateIncidentSchema = z.object({
  classroomId: z.string().uuid(),
  childId: z.string().uuid(),
  incidentType: z.enum(INCIDENT_TYPES),
  description: z.string().min(1),
  occurredAt: z.string().optional().nullable(),
  witnessStatement: z.string().optional().nullable(),
  reportedBy: z.string().uuid().optional(),
  reportedByUserId: z.string().uuid().optional(),
});

const resolveStaffProfile = async ({ reportedBy, reportedByUserId }) => {
  if (reportedBy) {
    const { data: byId } = await supabaseAdmin
      .from(TABLES.staffProfiles)
      .select("id, status, user_id")
      .eq("id", reportedBy)
      .maybeSingle();
    if (byId) return byId;

    const { data: byUser } = await supabaseAdmin
      .from(TABLES.staffProfiles)
      .select("id, status, user_id")
      .eq("user_id", reportedBy)
      .maybeSingle();
    if (byUser) return byUser;
  }

  if (reportedByUserId) {
    const { data: byUser } = await supabaseAdmin
      .from(TABLES.staffProfiles)
      .select("id, status, user_id")
      .eq("user_id", reportedByUserId)
      .maybeSingle();
    if (byUser) return byUser;
  }

  return null;
};

const toIsoOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

/** GET - List incidents with child, classroom, and reporter details */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const classroomIdFilter = searchParams.get("classroomId");

  const { data: incidents, error } = await supabaseAdmin
    .from(TABLES.incidents)
    .select(
      "id, child_id, center_id, reported_by, incident_type, description, occurred_at, witness_statement, parent_notified_at, created_at"
    )
    .order("occurred_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: { code: "FETCH_FAILED", message: error.message } },
      { status: 500 }
    );
  }

  if (!incidents?.length) {
    return NextResponse.json([]);
  }

  const childIds = [...new Set(incidents.map((incident) => incident.child_id).filter(Boolean))];
  const reporterIds = [
    ...new Set(incidents.map((incident) => incident.reported_by).filter(Boolean)),
  ];

  const [childrenRes, staffRes] = await Promise.all([
    childIds.length
      ? supabaseAdmin
          .from(TABLES.children)
          .select("id, first_name, last_name")
          .in("id", childIds)
      : { data: [] },
    reporterIds.length
      ? supabaseAdmin
          .from(TABLES.staffProfiles)
          .select("id, user_id")
          .in("id", reporterIds)
      : { data: [] },
  ]);

  const usersRes =
    staffRes.data && staffRes.data.length
      ? await supabaseAdmin
          .from(TABLES.users)
          .select("id, first_name, last_name")
          .in(
            "id",
            [...new Set(staffRes.data.map((staff) => staff.user_id).filter(Boolean))]
          )
      : { data: [] };

  const childrenById = (childrenRes.data || []).reduce((acc, child) => {
    acc[child.id] = child;
    return acc;
  }, {});

  const usersById = (usersRes.data || []).reduce((acc, user) => {
    acc[user.id] = `${user.first_name || ""} ${user.last_name || ""}`.trim();
    return acc;
  }, {});

  const staffById = (staffRes.data || []).reduce((acc, staff) => {
    acc[staff.id] = {
      id: staff.id,
      userId: staff.user_id,
      name: usersById[staff.user_id] || "Staff",
    };
    return acc;
  }, {});

  const occurredTimes = incidents
    .map((incident) => incident.occurred_at || incident.created_at)
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()));

  let attendanceByChild = {};
  let classroomsById = {};

  if (childIds.length && occurredTimes.length) {
    const minDate = new Date(Math.min(...occurredTimes.map((date) => date.getTime())));
    const maxDate = new Date(Math.max(...occurredTimes.map((date) => date.getTime())));

    const { data: attendance } = await supabaseAdmin
      .from(TABLES.attendance)
      .select("child_id, classroom_id, checked_in_at, checked_out_at")
      .in("child_id", childIds)
      .lte("checked_in_at", maxDate.toISOString())
      .or(`checked_out_at.is.null,checked_out_at.gte.${minDate.toISOString()}`);

    attendanceByChild = (attendance || []).reduce((acc, row) => {
      if (!acc[row.child_id]) acc[row.child_id] = [];
      acc[row.child_id].push(row);
      return acc;
    }, {});

    const classroomIds = [
      ...new Set((attendance || []).map((attendanceRow) => attendanceRow.classroom_id).filter(Boolean)),
    ];

    if (classroomIds.length) {
      const { data: classrooms } = await supabaseAdmin
        .from(TABLES.classrooms)
        .select("id, name")
        .in("id", classroomIds);
      classroomsById = (classrooms || []).reduce((acc, classroom) => {
        acc[classroom.id] = classroom;
        return acc;
      }, {});
    }
  }

  const findClassroom = (incident) => {
    const occurredAt = incident.occurred_at || incident.created_at;
    if (!occurredAt) return null;
    const occurredDate = new Date(occurredAt);
    if (Number.isNaN(occurredDate.getTime())) return null;

    const attendance = attendanceByChild[incident.child_id] || [];
    let match = null;
    for (const record of attendance) {
      const start = new Date(record.checked_in_at);
      const end = record.checked_out_at ? new Date(record.checked_out_at) : null;
      if (start <= occurredDate && (!end || end >= occurredDate)) {
        if (!match || new Date(record.checked_in_at) > new Date(match.checked_in_at)) {
          match = record;
        }
      }
    }

    if (!match?.classroom_id) return null;
    return classroomsById[match.classroom_id] || { id: match.classroom_id };
  };

  let result = incidents.map((incident) => {
    const classroom = findClassroom(incident);
    return {
      ...incident,
      child: childrenById[incident.child_id],
      classroom,
      reportedBy: staffById[incident.reported_by],
    };
  });

  if (classroomIdFilter) {
    result = result.filter((incident) => incident.classroom?.id === classroomIdFilter);
  }

  return NextResponse.json(result);
}

/** POST - Create incident */
export async function POST(request) {
  const csrfError = verifyCsrf(request);
  if (csrfError) return csrfError;

  const body = await request.json().catch(() => null);
  const parseResult = CreateIncidentSchema.safeParse(body);
  if (!parseResult.success) {
    return errorResponse("VALIDATION_ERROR", parseResult.error.message, 400);
  }

  const {
    classroomId,
    childId,
    incidentType,
    description,
    occurredAt,
    witnessStatement,
    reportedBy,
    reportedByUserId,
  } = parseResult.data;

  const reporterProfile = await resolveStaffProfile({ reportedBy, reportedByUserId });
  if (!reporterProfile?.id) {
    return errorResponse(
      "REPORTER_REQUIRED",
      "Incident must be reported by an active staff member.",
      400
    );
  }

  if (reporterProfile.status && reporterProfile.status !== "ACTIVE") {
    return errorResponse("STAFF_NOT_ACTIVE", "Staff account is not active.", 403);
  }

  const { data: classroom, error: classroomError } = await supabaseAdmin
    .from(TABLES.classrooms)
    .select("id, center_id, name")
    .eq("id", classroomId)
    .single();

  if (classroomError || !classroom) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Classroom not found" } },
      { status: 404 }
    );
  }

  const { data: activeAttendance, error: attendanceError } = await supabaseAdmin
    .from(TABLES.attendance)
    .select("id")
    .eq("child_id", childId)
    .eq("classroom_id", classroomId)
    .is("checked_out_at", null)
    .maybeSingle();

  if (attendanceError) {
    return NextResponse.json(
      { error: { code: "ATTENDANCE_LOOKUP_FAILED", message: attendanceError.message } },
      { status: 500 }
    );
  }

  if (!activeAttendance) {
    return errorResponse(
      "NOT_CHECKED_IN",
      "Child must be actively checked in to this classroom to file an incident.",
      400
    );
  }

  const occurredAtIso = toIsoOrNull(occurredAt) || new Date().toISOString();
  if (occurredAt && !toIsoOrNull(occurredAt)) {
    return errorResponse("VALIDATION_ERROR", "Invalid occurredAt value.", 400);
  }

  const { data: incident, error } = await supabaseAdmin
    .from(TABLES.incidents)
    .insert({
      child_id: childId,
      center_id: classroom.center_id,
      reported_by: reporterProfile.id,
      incident_type: incidentType,
      description: description.trim(),
      occurred_at: occurredAtIso,
      witness_statement: witnessStatement?.trim() || null,
    })
    .select(
      "id, child_id, center_id, reported_by, incident_type, description, occurred_at, witness_statement, parent_notified_at, created_at"
    )
    .single();

  if (error) {
    return NextResponse.json(
      { error: { code: "CREATE_FAILED", message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      ...incident,
      classroom: { id: classroom.id, name: classroom.name },
    },
    { status: 201 }
  );
}
