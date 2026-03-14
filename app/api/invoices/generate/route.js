import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/supabaseAdmin";
import { errorResponse, verifyCsrf } from "@/lib/auth/api";
import { TABLES } from "@/lib/supabase/tables";
import { DEFAULT_RATES } from "@/lib/pricing";

const GenerateInvoiceSchema = z.object({
  parentProfileId: z.string().uuid(),
  childId: z.string().uuid(),
  centerId: z.string().uuid(),
  billingCycle: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL"]),
});

/** POST - Generate a new invoice for a child */
export async function POST(request) {
  const csrfError = verifyCsrf(request);
  if (csrfError) return csrfError;

  const body = await request.json().catch(() => null);
  const parseResult = GenerateInvoiceSchema.safeParse(body);
  if (!parseResult.success) {
    return errorResponse("VALIDATION_ERROR", parseResult.error.message, 400);
  }

  const { parentProfileId, childId, centerId, billingCycle } = parseResult.data;

  const { data: child, error: childErr } = await supabaseAdmin
    .from(TABLES.children)
    .select("id, first_name, last_name, billing_cycle")
    .eq("id", childId)
    .eq("parent_profile_id", parentProfileId)
    .eq("center_id", centerId)
    .single();

  if (childErr || !child) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Child not found" } },
      { status: 404 }
    );
  }

  const cycle = child.billing_cycle || billingCycle || "MONTHLY";
  const rateConfig = DEFAULT_RATES[cycle] || DEFAULT_RATES.MONTHLY;
  let amountCents = rateConfig.amountCents;

  const { data: centerRate } = await supabaseAdmin
    .from(TABLES.centerRates)
    .select("amount_cents")
    .eq("center_id", centerId)
    .eq("period", cycle)
    .maybeSingle();

  if (centerRate?.amount_cents) {
    amountCents = centerRate.amount_cents;
  }

  const today = new Date();
  let periodStart, periodEnd, dueDate;
  if (cycle === "MONTHLY") {
    periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
    periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    dueDate = new Date(today.getFullYear(), today.getMonth(), 15);
  } else if (cycle === "QUARTERLY") {
    const q = Math.floor(today.getMonth() / 3) + 1;
    periodStart = new Date(today.getFullYear(), (q - 1) * 3, 1);
    periodEnd = new Date(today.getFullYear(), q * 3, 0);
    dueDate = new Date(periodStart);
    dueDate.setDate(15);
  } else {
    periodStart = new Date(today.getFullYear(), 0, 1);
    periodEnd = new Date(today.getFullYear(), 11, 31);
    dueDate = new Date(today.getFullYear(), 0, 15);
  }
  if (dueDate < today) {
    dueDate.setMonth(
      dueDate.getMonth() + (cycle === "MONTHLY" ? 1 : cycle === "QUARTERLY" ? 3 : 12)
    );
  }

  const childName = [child.first_name, child.last_name].filter(Boolean).join(" ");
  const { data: invoice, error: invErr } = await supabaseAdmin
    .from(TABLES.invoices)
    .insert({
      center_id: centerId,
      parent_profile_id: parentProfileId,
      child_id: childId,
      amount_cents: amountCents,
      due_date: dueDate.toISOString().slice(0, 10),
      status: "PENDING",
      period_start: periodStart.toISOString().slice(0, 10),
      period_end: periodEnd.toISOString().slice(0, 10),
      billing_cycle: cycle,
      notes: `${cycle} tuition — ${childName}`,
    })
    .select("id, amount_cents, due_date, status, period_start, period_end, billing_cycle, notes")
    .single();

  if (invErr) {
    return NextResponse.json(
      { error: { code: "CREATE_FAILED", message: invErr.message } },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      id: invoice.id,
      amountCents: invoice.amount_cents,
      dueDate: invoice.due_date,
      status: invoice.status,
      periodStart: invoice.period_start,
      periodEnd: invoice.period_end,
      billingCycle: invoice.billing_cycle,
      notes: invoice.notes,
    },
    { status: 201 }
  );
}
