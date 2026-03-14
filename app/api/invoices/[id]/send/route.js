import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/supabaseAdmin";
import { verifyCsrf } from "@/lib/auth/api";
import { TABLES } from "@/lib/supabase/tables";
import { sendEmail } from "@/lib/auth/email";
import { formatPrice } from "@/lib/pricing";

/** POST - Send invoice copy to parent's email */
export async function POST(request, { params }) {
  const csrfError = verifyCsrf(request);
  if (csrfError) return csrfError;

  const { id: invoiceId } = await params;
  if (!invoiceId) {
    return NextResponse.json(
      { error: { code: "INVALID_ID", message: "Invoice ID required" } },
      { status: 400 }
    );
  }

  const { data: invoice, error: invErr } = await supabaseAdmin
    .from(TABLES.invoices)
    .select("id, parent_profile_id, amount_cents, due_date, period_start, period_end, billing_cycle, notes, status")
    .eq("id", invoiceId)
    .single();

  if (invErr || !invoice) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Invoice not found" } },
      { status: 404 }
    );
  }

  const { data: parentProfile } = await supabaseAdmin
    .from(TABLES.parentProfiles)
    .select("user_id")
    .eq("id", invoice.parent_profile_id)
    .single();

  if (!parentProfile) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Parent not found" } },
      { status: 404 }
    );
  }

  const { data: user } = await supabaseAdmin
    .from(TABLES.users)
    .select("email, first_name")
    .eq("id", parentProfile.user_id)
    .single();

  if (!user?.email) {
    return NextResponse.json(
      { error: { code: "NO_EMAIL", message: "Parent has no email address" } },
      { status: 400 }
    );
  }

  const amountFormatted = formatPrice(invoice.amount_cents);
  const dueDateFormatted = new Date(invoice.due_date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const periodLabel = invoice.period_start && invoice.period_end
    ? `${new Date(invoice.period_start).toLocaleDateString("en-US")} – ${new Date(invoice.period_end).toLocaleDateString("en-US")}`
    : "—";

  const subject = `Your invoice from Brightsteps — ${amountFormatted} due ${dueDateFormatted}`;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Invoice</title></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.6; color: #1e1b19; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 1.5rem; color: #1e1b19;">Invoice</h1>
  <p>Hi ${user.first_name || "there"},</p>
  <p>Here is a copy of your childcare invoice.</p>
  <div style="background: #f6f3ef; border-radius: 8px; padding: 20px; margin: 24px 0;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 8px 0;"><strong>Amount due</strong></td><td style="text-align: right;">${amountFormatted}</td></tr>
      <tr><td style="padding: 8px 0;"><strong>Due date</strong></td><td style="text-align: right;">${dueDateFormatted}</td></tr>
      <tr><td style="padding: 8px 0;"><strong>Billing period</strong></td><td style="text-align: right;">${periodLabel}</td></tr>
      <tr><td style="padding: 8px 0;"><strong>Cycle</strong></td><td style="text-align: right;">${invoice.billing_cycle || "—"}</td></tr>
      ${invoice.notes ? `<tr><td style="padding: 8px 0;"><strong>Notes</strong></td><td style="text-align: right;">${invoice.notes}</td></tr>` : ""}
    </table>
  </div>
  <p>Log in to your Brightsteps account to view and pay your invoice.</p>
  <p style="color: #6b6b6b; font-size: 0.9rem;">— Brightsteps</p>
</body>
</html>
  `.trim();
  const text = `Invoice: ${amountFormatted} due ${dueDateFormatted}. Billing period: ${periodLabel}. Log in to Brightsteps to view and pay.`;

  try {
    const result = await sendEmail({
      to: user.email,
      subject,
      html,
      text,
    });
    if (result.skipped) {
      return NextResponse.json({
        sent: false,
        message: "Email not configured. Set EMAIL_FROM and GMAIL_APP_PASSWORD.",
      });
    }
  } catch (err) {
    return NextResponse.json(
      { error: { code: "SEND_FAILED", message: err.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ sent: true, to: user.email });
}

