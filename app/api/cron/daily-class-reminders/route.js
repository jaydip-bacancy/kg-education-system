import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/supabaseAdmin";
import { TABLES } from "@/lib/supabase/tables";
import { sendEmail } from "@/lib/auth/email";

export const dynamic = "force-dynamic";

/** Verify cron secret (Vercel Cron or external scheduler) */
function verifyCronAuth(request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return authHeader === `Bearer ${cronSecret}`;
}

function formatTime(timeStr) {
  if (!timeStr) return "—";
  if (typeof timeStr === "string" && timeStr.includes(":")) {
    const [h, m] = timeStr.split(":").map(Number);
    const d = new Date();
    d.setHours(h ?? 0, m ?? 0, 0, 0);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  }
  return timeStr;
}

/** GET/POST - Send daily class reminders to parents of enrolled children.
 * Call daily (e.g. 6:00 AM) via Vercel Cron or external scheduler.
 * Requires Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request) {
  return runDailyClassReminders(request);
}

export async function POST(request) {
  return runDailyClassReminders(request);
}

async function runDailyClassReminders(request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing CRON_SECRET" } },
      { status: 401 }
    );
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // 1. Get all classrooms with center info and start/end times
  const { data: classrooms, error: clsErr } = await supabaseAdmin
    .from(TABLES.classrooms)
    .select("id, name, center_id, start_time, end_time");

  if (clsErr || !classrooms?.length) {
    return NextResponse.json({ sent: 0, message: "No classrooms found" });
  }

  const centerIds = [...new Set(classrooms.map((c) => c.center_id).filter(Boolean))];
  const { data: centers } = await supabaseAdmin
    .from(TABLES.centers)
    .select("id, name")
    .in("id", centerIds);
  const centersById = (centers || []).reduce((acc, c) => {
    acc[c.id] = c;
    return acc;
  }, {});

  const classroomsById = classrooms.reduce((acc, c) => {
    acc[c.id] = { ...c, centerName: centersById[c.center_id]?.name || "Center" };
    return acc;
  }, {});

  // 2. Get all active roster entries
  const { data: rosters, error: rosterErr } = await supabaseAdmin
    .from(TABLES.classroomRosters)
    .select("child_id, classroom_id")
    .eq("status", "ACTIVE");

  if (rosterErr || !rosters?.length) {
    return NextResponse.json({ sent: 0, message: "No enrolled children" });
  }

  // 3. Get children and their parent_profile_ids
  const childIds = [...new Set(rosters.map((r) => r.child_id))];
  const { data: children } = await supabaseAdmin
    .from(TABLES.children)
    .select("id, first_name, last_name, parent_profile_id")
    .in("id", childIds);
  const childrenById = (children || []).reduce((acc, c) => {
    acc[c.id] = c;
    return acc;
  }, {});

  // 4. Build: parentProfileId -> [ { child, classroom } ]
  const byParent = {};
  for (const r of rosters) {
    const child = childrenById[r.child_id];
    const classroom = classroomsById[r.classroom_id];
    if (!child || !classroom) continue;
    const ppId = child.parent_profile_id;
    if (!ppId) continue;
    if (!byParent[ppId]) byParent[ppId] = [];
    byParent[ppId].push({ child, classroom });
  }

  // 5. Get parent users (email, first_name)
  const parentProfileIds = Object.keys(byParent);
  const { data: parentProfiles } = await supabaseAdmin
    .from(TABLES.parentProfiles)
    .select("id, user_id")
    .in("id", parentProfileIds);
  const userIds = (parentProfiles || []).map((p) => p.user_id).filter(Boolean);
  const { data: users } = await supabaseAdmin
    .from(TABLES.users)
    .select("id, email, first_name")
    .in("id", userIds);
  const usersById = (users || []).reduce((acc, u) => {
    acc[u.id] = u;
    return acc;
  }, {});
  const ppToUser = (parentProfiles || []).reduce((acc, p) => {
    acc[p.id] = usersById[p.user_id];
    return acc;
  }, {});

  let sent = 0;
  for (const ppId of parentProfileIds) {
    const user = ppToUser[ppId];
    if (!user?.email) continue;

    const entries = byParent[ppId];
    const rows = entries.map(({ child, classroom }) => {
      const childName = `${child.first_name || ""} ${child.last_name || ""}`.trim() || "Child";
      const timeRange = classroom.start_time || classroom.end_time
        ? `${formatTime(classroom.start_time)} – ${formatTime(classroom.end_time)}`
        : "Daily";
      return { childName, className: classroom.name, centerName: classroom.centerName, timeRange };
    });

    const subject = `Today's classes for your children — ${today}`;
    const listItems = rows
      .map(
        (r) =>
          `<li><strong>${r.childName}</strong>: ${r.className} at ${r.centerName} (${r.timeRange})</li>`
      )
      .join("\n");
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Today's Classes</title></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.6; color: #1e1b19; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 1.5rem; color: #1e1b19;">Today's Classes</h1>
  <p>Hi ${user.first_name || "there"},</p>
  <p>Here are your children's classes for ${today}:</p>
  <ul style="padding-left: 1.5rem;">
    ${listItems}
  </ul>
  <p>Log in to your Brightsteps account for more details.</p>
  <p style="color: #6b6b6b; font-size: 0.9rem;">— Brightsteps</p>
</body>
</html>
    `.trim();
    const text = `Today's classes for your children (${today}):\n${rows.map((r) => `- ${r.childName}: ${r.className} at ${r.centerName} (${r.timeRange})`).join("\n")}\n\nLog in to Brightsteps for more details.`;

    try {
      const result = await sendEmail({ to: user.email, subject, html, text });
      if (!result.skipped) sent++;
    } catch (err) {
      console.warn("Failed to send class reminder to", user.email, err);
    }
  }

  return NextResponse.json({
    sent,
    total: parentProfileIds.length,
    message: `Sent ${sent} daily class reminder(s)`,
  });
}
