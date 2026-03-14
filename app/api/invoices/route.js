import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/supabaseAdmin";
import { TABLES } from "@/lib/supabase/tables";

/** GET - List invoices. For admin: ?centerId=... | For parent: ?userId=... */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const centerId = searchParams.get("centerId");
  const userId = searchParams.get("userId");

  if (centerId) {
    const { data, error } = await supabaseAdmin
      .from(TABLES.invoices)
      .select(
        `
        id,
        center_id,
        parent_profile_id,
        child_id,
        amount_cents,
        due_date,
        status,
        period_start,
        period_end,
        billing_cycle,
        notes,
        created_at
      `
      )
      .eq("center_id", centerId)
      .order("due_date", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: { code: "FETCH_FAILED", message: error.message } },
        { status: 500 }
      );
    }

    const invoices = data || [];
    const parentIds = [...new Set(invoices.map((i) => i.parent_profile_id).filter(Boolean))];
    const childIds = [...new Set(invoices.map((i) => i.child_id).filter(Boolean))];

    let parentsById = {};
    let childrenById = {};
    let usersById = {};

    if (parentIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from(TABLES.parentProfiles)
        .select("id, user_id")
        .in("id", parentIds);
      const uids = (profiles || []).map((p) => p.user_id).filter(Boolean);
      (profiles || []).forEach((p) => {
        parentsById[p.id] = p;
      });
      if (uids.length > 0) {
        const { data: users } = await supabaseAdmin
          .from(TABLES.users)
          .select("id, email, first_name, last_name")
          .in("id", uids);
        (users || []).forEach((u) => {
          usersById[u.id] = u;
        });
      }
    }
    if (childIds.length > 0) {
      const { data: children } = await supabaseAdmin
        .from(TABLES.children)
        .select("id, first_name, last_name")
        .in("id", childIds);
      (children || []).forEach((c) => {
        childrenById[c.id] = c;
      });
    }

    const result = invoices.map((inv) => {
      const pp = parentsById[inv.parent_profile_id];
      const u = pp ? usersById[pp.user_id] : null;
      const child = inv.child_id ? childrenById[inv.child_id] : null;
      return {
        id: inv.id,
        centerId: inv.center_id,
        parentProfileId: inv.parent_profile_id,
        childId: inv.child_id,
        amountCents: inv.amount_cents,
        dueDate: inv.due_date,
        status: inv.status,
        periodStart: inv.period_start,
        periodEnd: inv.period_end,
        billingCycle: inv.billing_cycle,
        notes: inv.notes,
        createdAt: inv.created_at,
        parentEmail: u?.email,
        parentName: u ? [u.first_name, u.last_name].filter(Boolean).join(" ") : null,
        childName: child ? [child.first_name, child.last_name].filter(Boolean).join(" ") : null,
      };
    });

    return NextResponse.json(result);
  }

  if (userId) {
    const { data: parentProfile } = await supabaseAdmin
      .from(TABLES.parentProfiles)
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!parentProfile) {
      return NextResponse.json([]);
    }

    const { data, error } = await supabaseAdmin
      .from(TABLES.invoices)
      .select(
        `
        id,
        center_id,
        parent_profile_id,
        child_id,
        amount_cents,
        due_date,
        status,
        period_start,
        period_end,
        billing_cycle,
        notes,
        created_at
      `
      )
      .eq("parent_profile_id", parentProfile.id)
      .order("due_date", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: { code: "FETCH_FAILED", message: error.message } },
        { status: 500 }
      );
    }

    const invoices = data || [];
    const childIds = invoices.map((i) => i.child_id).filter(Boolean);
    let childrenById = {};
    if (childIds.length > 0) {
      const { data: children } = await supabaseAdmin
        .from(TABLES.children)
        .select("id, first_name, last_name")
        .in("id", childIds);
      (children || []).forEach((c) => {
        childrenById[c.id] = c;
      });
    }

    const result = invoices.map((inv) => {
      const child = inv.child_id ? childrenById[inv.child_id] : null;
      return {
        id: inv.id,
        centerId: inv.center_id,
        parentProfileId: inv.parent_profile_id,
        childId: inv.child_id,
        amountCents: inv.amount_cents,
        dueDate: inv.due_date,
        status: inv.status,
        periodStart: inv.period_start,
        periodEnd: inv.period_end,
        billingCycle: inv.billing_cycle,
        notes: inv.notes,
        createdAt: inv.created_at,
        childName: child ? [child.first_name, child.last_name].filter(Boolean).join(" ") : null,
      };
    });

    return NextResponse.json(result);
  }

  return NextResponse.json(
    { error: { code: "MISSING_PARAMS", message: "Provide centerId or userId" } },
    { status: 400 }
  );
}
