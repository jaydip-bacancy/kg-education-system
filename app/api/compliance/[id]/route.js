import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/supabaseAdmin";
import { errorResponse, verifyCsrf } from "@/lib/auth/api";
import { TABLES } from "@/lib/supabase/tables";

const STATUSES = ["PENDING", "APPROVED", "EXPIRED", "REJECTED"];

const UpdateComplianceSchema = z.object({
  documentUrl: z.union([z.string().url(), z.literal("")]).optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  status: z.enum(STATUSES),
  notes: z.string().optional().nullable(),
});

/** PATCH - Update compliance record */
export async function PATCH(request, { params }) {
  const csrfError = verifyCsrf(request);
  if (csrfError) return csrfError;

  const { id } = await params;
  if (!id) return errorResponse("INVALID_ID", "Record ID required", 400);

  const body = await request.json().catch(() => null);
  const parseResult = UpdateComplianceSchema.safeParse(body);
  if (!parseResult.success) {
    return errorResponse("VALIDATION_ERROR", parseResult.error.message, 400);
  }

  const { documentUrl, expiresAt, status, notes } = parseResult.data;

  const { data: record, error } = await supabaseAdmin
    .from(TABLES.complianceRecords)
    .update({
      document_url: documentUrl === "" ? null : documentUrl ?? undefined,
      expires_at: expiresAt === "" ? null : expiresAt ?? undefined,
      status,
      notes: notes ?? null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: { code: "UPDATE_FAILED", message: error.message } },
      { status: 500 }
    );
  }

  if (!record) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Record not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json(record);
}

/** DELETE - Delete compliance record */
export async function DELETE(request, { params }) {
  const csrfError = verifyCsrf(request);
  if (csrfError) return csrfError;

  const { id } = await params;
  if (!id) return errorResponse("INVALID_ID", "Record ID required", 400);

  const { error } = await supabaseAdmin
    .from(TABLES.complianceRecords)
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: { code: "DELETE_FAILED", message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
