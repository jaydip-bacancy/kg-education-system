import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/supabaseAdmin";
import { TABLES } from "@/lib/supabase/tables";
import { formatPrice } from "@/lib/pricing";

/** GET - Dashboard lists for admin: pending bills, available children, empty classes.
 * Query: role=ADMIN (admin only)
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");

  if (role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Admin only" } },
      { status: 403 }
    );
  }

  // 1. Pending bills (PENDING or OVERDUE)
  const { data: pendingInvoices } = await supabaseAdmin
    .from(TABLES.invoices)
    .select("id, center_id, parent_profile_id, child_id, amount_cents, due_date, status")
    .in("status", ["PENDING", "OVERDUE"])
    .order("due_date", { ascending: true });

  let pendingBills = [];
  if (pendingInvoices?.length) {
    const centerIds = [...new Set(pendingInvoices.map((i) => i.center_id))];
    const parentIds = [...new Set(pendingInvoices.map((i) => i.parent_profile_id))];
    const childIds = [...new Set(pendingInvoices.map((i) => i.child_id).filter(Boolean))];

    const [centersRes, profilesRes, childrenRes] = await Promise.all([
      supabaseAdmin.from(TABLES.centers).select("id, name").in("id", centerIds),
      supabaseAdmin.from(TABLES.parentProfiles).select("id, user_id").in("id", parentIds),
      childIds.length
        ? supabaseAdmin.from(TABLES.children).select("id, first_name, last_name").in("id", childIds)
        : { data: [] },
    ]);

    const userIds = (profilesRes.data || []).map((p) => p.user_id).filter(Boolean);
    const { data: users } = userIds.length
      ? await supabaseAdmin.from(TABLES.users).select("id, email, first_name, last_name").in("id", userIds)
      : { data: [] };

    const centersById = (centersRes.data || []).reduce((acc, c) => {
      acc[c.id] = c;
      return acc;
    }, {});
    const profilesById = (profilesRes.data || []).reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {});
    const usersById = (users || []).reduce((acc, u) => {
      acc[u.id] = u;
      return acc;
    }, {});
    const childrenById = (childrenRes.data || []).reduce((acc, c) => {
      acc[c.id] = c;
      return acc;
    }, {});

    pendingBills = pendingInvoices.map((inv) => {
      const pp = profilesById[inv.parent_profile_id];
      const u = pp ? usersById[pp.user_id] : null;
      const child = inv.child_id ? childrenById[inv.child_id] : null;
      return {
        id: inv.id,
        amountFormatted: formatPrice(inv.amount_cents),
        amountCents: inv.amount_cents,
        dueDate: inv.due_date,
        status: inv.status,
        centerName: centersById[inv.center_id]?.name ?? "—",
        parentName: u ? [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email : "—",
        childName: child ? [child.first_name, child.last_name].filter(Boolean).join(" ") : null,
      };
    });
  }

  // 2. Available children (no active classroom roster)
  const { data: allChildren } = await supabaseAdmin
    .from(TABLES.children)
    .select("id, first_name, last_name, center_id");
  const { data: activeRosters } = await supabaseAdmin
    .from(TABLES.classroomRosters)
    .select("child_id")
    .eq("status", "ACTIVE");
  const enrolledChildIds = new Set((activeRosters || []).map((r) => r.child_id));
  const availableChildrenRaw = (allChildren || []).filter((c) => !enrolledChildIds.has(c.id));

  let availableChildren = [];
  if (availableChildrenRaw.length) {
    const centerIds = [...new Set(availableChildrenRaw.map((c) => c.center_id))];
    const { data: centers } = await supabaseAdmin
      .from(TABLES.centers)
      .select("id, name")
      .in("id", centerIds);
    const centersById = (centers || []).reduce((acc, c) => {
      acc[c.id] = c;
      return acc;
    }, {});
    availableChildren = availableChildrenRaw.map((c) => ({
      id: c.id,
      firstName: c.first_name,
      lastName: c.last_name,
      name: [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || "—",
      centerName: centersById[c.center_id]?.name ?? "—",
    }));
  }

  // 3. Classes without staff AND without children
  const { data: allClassrooms } = await supabaseAdmin
    .from(TABLES.classrooms)
    .select("id, name, center_id");
  const { data: staffAssignments } = await supabaseAdmin
    .from(TABLES.staffClassrooms)
    .select("classroom_id");
  const { data: rosterAssignments } = await supabaseAdmin
    .from(TABLES.classroomRosters)
    .select("classroom_id")
    .eq("status", "ACTIVE");

  const classroomsWithStaff = new Set((staffAssignments || []).map((s) => s.classroom_id));
  const classroomsWithChildren = new Set((rosterAssignments || []).map((r) => r.classroom_id));

  const emptyClassroomIds = (allClassrooms || [])
    .filter(
      (c) => !classroomsWithStaff.has(c.id) && !classroomsWithChildren.has(c.id)
    )
    .map((c) => c.id);

  let emptyClasses = [];
  if (emptyClassroomIds.length) {
    const centerIds = [...new Set(
      (allClassrooms || []).filter((c) => emptyClassroomIds.includes(c.id)).map((c) => c.center_id)
    )];
    const { data: centers } = await supabaseAdmin
      .from(TABLES.centers)
      .select("id, name")
      .in("id", centerIds);
    const centersById = (centers || []).reduce((acc, c) => {
      acc[c.id] = c;
      return acc;
    }, {});
    emptyClasses = (allClassrooms || [])
      .filter((c) => emptyClassroomIds.includes(c.id))
      .map((c) => ({
        id: c.id,
        name: c.name,
        centerName: centersById[c.center_id]?.name ?? "—",
      }));
  }

  return NextResponse.json({
    pendingBills,
    availableChildren,
    emptyClasses,
  });
}
