import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/supabaseAdmin";
import { errorResponse, verifyCsrf } from "@/lib/auth/api";
import { TABLES } from "@/lib/supabase/tables";
import { sendEmail } from "@/lib/auth/email";

const ACTIVITY_TYPES = ["MEAL", "NAP", "DIAPER", "ACTIVITY", "BEHAVIOR", "OTHER"];

const CreateActivitySchema = z.object({
  childId: z.string().uuid(),
  activityType: z.enum(ACTIVITY_TYPES),
  details: z.record(z.string(), z.unknown()).optional(),
  classroomId: z.string().uuid().optional(),
  loggedByUserId: z.string().uuid(),
  loggedAt: z.string().optional(),
});

/** GET - List activity logs.
 * - classroomId: filter by classroom (admin/staff)
 * - childIds: comma-separated child IDs (parent - only their children allowed)
 * - parentProfileId: for parents - we resolve their children and filter
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const classroomId = searchParams.get("classroomId");
  const childIdsParam = searchParams.get("childIds");
  const parentProfileId = searchParams.get("parentProfileId");
  const userId = searchParams.get("userId");

  let childIds = [];
  const parentChildIds = [];

  if (parentProfileId || userId) {
    let ppId = parentProfileId;
    if (userId && !ppId) {
      const { data: pp } = await supabaseAdmin
        .from(TABLES.parentProfiles)
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      ppId = pp?.id;
    }
    if (ppId) {
      const { data: children } = await supabaseAdmin
        .from(TABLES.children)
        .select("id")
        .eq("parent_profile_id", ppId);
      parentChildIds.push(...((children || []).map((c) => c.id)));
    }
  }

  if (classroomId) {
    const { data: roster } = await supabaseAdmin
      .from(TABLES.classroomRosters)
      .select("child_id")
      .eq("classroom_id", classroomId)
      .eq("status", "ACTIVE");
    const rosterChildIds = (roster || []).map((r) => r.child_id);
    if (parentChildIds.length) {
      childIds = rosterChildIds.filter((id) => parentChildIds.includes(id));
    } else {
      childIds = rosterChildIds;
    }
  } else if (parentChildIds.length) {
    childIds = parentChildIds;
  } else if (childIdsParam) {
    childIds = childIdsParam.split(",").map((s) => s.trim()).filter(Boolean);
  }

  let query = supabaseAdmin
    .from(TABLES.activityLogs)
    .select(
      "id, child_id, staff_profile_id, logged_by_user_id, activity_type, details, logged_at, created_at"
    )
    .order("logged_at", { ascending: false })
    .limit(100);

  if (childIds.length) {
    query = query.in("child_id", childIds);
  } else if (!classroomId && !parentProfileId && !userId) {
    return NextResponse.json([]);
  }

  const { data: logs, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: { code: "FETCH_FAILED", message: error.message } },
      { status: 500 }
    );
  }

  if (!logs?.length) {
    return NextResponse.json([]);
  }

  const childIdsFromLogs = [...new Set(logs.map((l) => l.child_id).filter(Boolean))];
  const staffIds = [...new Set(logs.map((l) => l.staff_profile_id).filter(Boolean))];
  const userIdsFromLogs = [...new Set(logs.map((l) => l.logged_by_user_id).filter(Boolean))];

  const [childrenRes, staffRes] = await Promise.all([
    childIdsFromLogs.length
      ? supabaseAdmin
          .from(TABLES.children)
          .select("id, first_name, last_name")
          .in("id", childIdsFromLogs)
      : { data: [] },
    staffIds.length
      ? supabaseAdmin
          .from(TABLES.staffProfiles)
          .select("id, user_id")
          .in("id", staffIds)
      : { data: [] },
  ]);

  const allUserIds = [
    ...new Set([
      ...userIdsFromLogs,
      ...(staffRes.data || []).map((s) => s.user_id).filter(Boolean),
    ]),
  ];
  const usersRes =
    allUserIds.length > 0
      ? await supabaseAdmin
          .from(TABLES.users)
          .select("id, first_name, last_name, email")
          .in("id", allUserIds)
      : { data: [] };

  const childrenById = (childrenRes.data || []).reduce((acc, c) => {
    acc[c.id] = c;
    return acc;
  }, {});
  const staffById = (staffRes.data || []).reduce((acc, s) => {
    acc[s.id] = s;
    return acc;
  }, {});
  const usersById = (usersRes.data || []).reduce((acc, u) => {
    acc[u.id] =
      `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email || "Staff";
    return acc;
  }, {});

  const result = logs.map((log) => {
    const child = childrenById[log.child_id];
    let loggedByName = "Staff";
    if (log.logged_by_user_id) {
      loggedByName = usersById[log.logged_by_user_id] || "Staff";
    } else if (log.staff_profile_id) {
      const staff = staffById[log.staff_profile_id];
      loggedByName = staff ? usersById[staff.user_id] || "Staff" : "Staff";
    }
    return {
      id: log.id,
      childId: log.child_id,
      childName: child
        ? `${child.first_name || ""} ${child.last_name || ""}`.trim()
        : null,
      activityType: log.activity_type,
      details: log.details || {},
      loggedAt: log.logged_at,
      createdAt: log.created_at,
      loggedByName: loggedByName || "Staff",
    };
  });

  return NextResponse.json(result);
}

/** POST - Create activity log (staff or admin) */
export async function POST(request) {
  const csrfError = verifyCsrf(request);
  if (csrfError) return csrfError;

  const body = await request.json().catch(() => null);
  const parseResult = CreateActivitySchema.safeParse(body);
  if (!parseResult.success) {
    return errorResponse("VALIDATION_ERROR", parseResult.error.message, 400);
  }

  const { childId, activityType, details, loggedByUserId, loggedAt } = parseResult.data;

  const { data: child, error: childErr } = await supabaseAdmin
    .from(TABLES.children)
    .select("id, center_id, parent_profile_id, first_name, last_name")
    .eq("id", childId)
    .single();

  if (childErr || !child) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Child not found" } },
      { status: 404 }
    );
  }

  const { data: userRow } = await supabaseAdmin
    .from(TABLES.users)
    .select("id, role")
    .eq("id", loggedByUserId)
    .maybeSingle();

  if (!userRow) {
    return errorResponse("UNAUTHORIZED", "User not found.", 403);
  }

  const isStaff = userRow.role === "STAFF";
  const isAdmin = userRow.role === "ADMIN";
  if (!isStaff && !isAdmin) {
    return errorResponse(
      "FORBIDDEN",
      "Only staff and admins can log activities.",
      403
    );
  }

  let staffProfileId = null;
  if (isStaff) {
    const { data: staffProfile } = await supabaseAdmin
      .from(TABLES.staffProfiles)
      .select("id, status")
      .eq("user_id", loggedByUserId)
      .maybeSingle();
    if (staffProfile?.status !== "ACTIVE") {
      return errorResponse("STAFF_NOT_ACTIVE", "Staff account is not active.", 403);
    }
    staffProfileId = staffProfile?.id;
  }

  let loggedAtIso = new Date().toISOString();
  if (loggedAt) {
    const parsed = new Date(loggedAt);
    if (!Number.isNaN(parsed.getTime())) loggedAtIso = parsed.toISOString();
  }

  const { data: log, error: insertErr } = await supabaseAdmin
    .from(TABLES.activityLogs)
    .insert({
      child_id: childId,
      staff_profile_id: staffProfileId,
      logged_by_user_id: loggedByUserId,
      activity_type: activityType,
      details: details || {},
      logged_at: loggedAtIso,
    })
    .select("id, child_id, activity_type, details, logged_at, created_at")
    .single();

  if (insertErr) {
    return NextResponse.json(
      { error: { code: "CREATE_FAILED", message: insertErr.message } },
      { status: 500 }
    );
  }

  // Email parent about the new activity log
  if (child.parent_profile_id) {
    try {
      const { data: parentProfile } = await supabaseAdmin
        .from(TABLES.parentProfiles)
        .select("user_id")
        .eq("id", child.parent_profile_id)
        .single();
      if (parentProfile?.user_id) {
        const { data: user } = await supabaseAdmin
          .from(TABLES.users)
          .select("email, first_name")
          .eq("id", parentProfile.user_id)
          .single();
        if (user?.email) {
          const childName = `${child.first_name || ""} ${child.last_name || ""}`.trim() || "your child";
          const activityLabel = { MEAL: "Meal", NAP: "Nap", DIAPER: "Diaper", ACTIVITY: "Activity", BEHAVIOR: "Behavior", OTHER: "Other" }[activityType] || activityType;
          const loggedAtFormatted = new Date(log.logged_at).toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          });
          const detailsStr = details && Object.keys(details).length
            ? `<p><strong>Details:</strong> ${JSON.stringify(details)}</p>`
            : "";
          const subject = `Activity update: ${activityLabel} for ${childName}`;
          const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Activity Update</title></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.6; color: #1e1b19; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 1.5rem; color: #1e1b19;">Activity Update</h1>
  <p>Hi ${user.first_name || "there"},</p>
  <p>Here's an update on ${childName}:</p>
  <div style="background: #f6f3ef; border-radius: 8px; padding: 20px; margin: 24px 0;">
    <p><strong>Activity type:</strong> ${activityLabel}</p>
    <p><strong>Logged at:</strong> ${loggedAtFormatted}</p>
    ${detailsStr}
  </div>
  <p>Log in to your Brightsteps account to view more details.</p>
  <p style="color: #6b6b6b; font-size: 0.9rem;">— Brightsteps</p>
</body>
</html>
          `.trim();
          const text = `Activity update for ${childName}: ${activityLabel} at ${loggedAtFormatted}. Log in to Brightsteps to view details.`;
          await sendEmail({ to: user.email, subject, html, text });
        }
      }
    } catch (emailErr) {
      console.warn("Failed to email parent about activity log:", emailErr);
    }
  }

  return NextResponse.json(
    {
      id: log.id,
      childId: log.child_id,
      activityType: log.activity_type,
      details: log.details,
      loggedAt: log.logged_at,
      createdAt: log.created_at,
    },
    { status: 201 }
  );
}
