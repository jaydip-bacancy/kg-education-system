import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/supabaseAdmin";
import { TABLES } from "@/lib/supabase/tables";

/** GET - List entities (children, staff, centers) for compliance record assignment */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const centerId = searchParams.get("centerId");

  let childrenQuery = supabaseAdmin
    .from(TABLES.children)
    .select("id, first_name, last_name, center_id");
  if (centerId) childrenQuery = childrenQuery.eq("center_id", centerId);

  let staffCentersQuery = supabaseAdmin
    .from(TABLES.staffCenters)
    .select("staff_profile_id, center_id");
  if (centerId) staffCentersQuery = staffCentersQuery.eq("center_id", centerId);

  const [childrenRes, staffRes, centersRes] = await Promise.all([
    childrenQuery,
    staffCentersQuery,
    supabaseAdmin.from(TABLES.centers).select("id, name"),
  ]);

  const children = (childrenRes.data || []).map((c) => ({
    id: c.id,
    name: `${c.first_name} ${c.last_name}`,
  }));

  const staffCenterRows = staffRes.data || [];
  const filteredStaffIds = staffCenterRows.map((s) => s.staff_profile_id);

  let staff = [];
  if (filteredStaffIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from(TABLES.staffProfiles)
      .select("id, user_id")
      .in("id", filteredStaffIds);
    const userIds = (profiles || []).map((p) => p.user_id).filter(Boolean);
    const { data: users } = await supabaseAdmin
      .from(TABLES.users)
      .select("id, first_name, last_name")
      .in("id", userIds);
    const usersById = (users || []).reduce((acc, u) => {
      acc[u.id] = `${u.first_name || ""} ${u.last_name || ""}`.trim() || "Staff";
      return acc;
    }, {});
    staff = (profiles || []).map((p) => ({
      id: p.id,
      name: usersById[p.user_id] || "Staff",
    }));
  }

  const centers = (centersRes.data || []).map((c) => ({ id: c.id, name: c.name }));

  return NextResponse.json({ children, staff, centers });
}
