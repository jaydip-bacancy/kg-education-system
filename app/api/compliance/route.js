import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/supabaseAdmin";
import { errorResponse, verifyCsrf } from "@/lib/auth/api";
import { TABLES } from "@/lib/supabase/tables";

const RECORD_TYPES = ["IMMUNIZATION", "BACKGROUND_CHECK", "LICENSE", "OTHER"];
const ENTITY_TYPES = ["CHILD", "STAFF", "CENTER"];
const STATUSES = ["PENDING", "APPROVED", "EXPIRED", "REJECTED"];

const CreateComplianceSchema = z.object({
  centerId: z.string().uuid(),
  recordType: z.enum(RECORD_TYPES),
  entityType: z.enum(ENTITY_TYPES),
  entityId: z.string().uuid(),
  documentUrl: z.union([z.string().url(), z.literal("")]).optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  status: z.enum(STATUSES).default("PENDING"),
  notes: z.string().optional().nullable(),
});

/** GET - List compliance records with entity names */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const centerId = searchParams.get("centerId");
  const recordType = searchParams.get("recordType");
  const entityType = searchParams.get("entityType");
  const status = searchParams.get("status");

  let query = supabaseAdmin
    .from(TABLES.complianceRecords)
    .select("id, center_id, record_type, entity_type, entity_id, document_url, expires_at, status, notes, created_at")
    .order("expires_at", { ascending: true, nullsFirst: false });

  if (centerId) query = query.eq("center_id", centerId);
  if (recordType) query = query.eq("record_type", recordType);
  if (entityType) query = query.eq("entity_type", entityType);
  if (status) query = query.eq("status", status);

  const { data: records, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: { code: "FETCH_FAILED", message: error.message } },
      { status: 500 }
    );
  }

  if (!records?.length) {
    return NextResponse.json([]);
  }

  const childIds = records.filter((r) => r.entity_type === "CHILD").map((r) => r.entity_id);
  const staffIds = records.filter((r) => r.entity_type === "STAFF").map((r) => r.entity_id);
  const centerIds = records.filter((r) => r.entity_type === "CENTER").map((r) => r.entity_id);

  const [childrenRes, staffRes, centersRes] = await Promise.all([
    childIds.length ? supabaseAdmin.from(TABLES.children).select("id, first_name, last_name").in("id", [...new Set(childIds)]) : { data: [] },
    staffIds.length ? supabaseAdmin.from(TABLES.staffProfiles).select("id, user_id").in("id", [...new Set(staffIds)]) : { data: [] },
    centerIds.length ? supabaseAdmin.from(TABLES.centers).select("id, name").in("id", [...new Set(centerIds)]) : { data: [] },
  ]);

  const userIds = (staffRes.data || []).map((s) => s.user_id).filter(Boolean);
  const { data: users } = userIds.length
    ? await supabaseAdmin.from(TABLES.users).select("id, first_name, last_name").in("id", userIds)
    : { data: [] };

  const childrenById = (childrenRes.data || []).reduce((acc, c) => {
    acc[c.id] = `${c.first_name} ${c.last_name}`;
    return acc;
  }, {});

  const usersById = (users || []).reduce((acc, u) => {
    acc[u.id] = `${u.first_name || ""} ${u.last_name || ""}`.trim();
    return acc;
  }, {});

  const staffById = (staffRes.data || []).reduce((acc, s) => {
    acc[s.id] = usersById[s.user_id] || "Staff";
    return acc;
  }, {});

  const centersById = (centersRes.data || []).reduce((acc, c) => {
    acc[c.id] = c.name;
    return acc;
  }, {});

  const entityName = (r) => {
    if (r.entity_type === "CHILD") return childrenById[r.entity_id] || "Unknown child";
    if (r.entity_type === "STAFF") return staffById[r.entity_id] || "Unknown staff";
    if (r.entity_type === "CENTER") return centersById[r.entity_id] || "Unknown center";
    return "Unknown";
  };

  const { data: centerList } = await supabaseAdmin
    .from(TABLES.centers)
    .select("id, name")
    .in("id", [...new Set(records.map((r) => r.center_id))]);

  const centerNames = (centerList || []).reduce((acc, c) => {
    acc[c.id] = c.name;
    return acc;
  }, {});

  const result = records.map((r) => ({
    ...r,
    entityName: entityName(r),
    centerName: centerNames[r.center_id],
    isExpired: r.expires_at && new Date(r.expires_at) < new Date() && r.status !== "EXPIRED",
  }));

  return NextResponse.json(result);
}

/** POST - Create compliance record */
export async function POST(request) {
  const csrfError = verifyCsrf(request);
  if (csrfError) return csrfError;

  const body = await request.json().catch(() => null);
  const parseResult = CreateComplianceSchema.safeParse(body);
  if (!parseResult.success) {
    return errorResponse("VALIDATION_ERROR", parseResult.error.message, 400);
  }

  const { centerId, recordType, entityType, entityId, documentUrl, expiresAt, status, notes } =
    parseResult.data;

  const { data: record, error } = await supabaseAdmin
    .from(TABLES.complianceRecords)
    .insert({
      center_id: centerId,
      record_type: recordType,
      entity_type: entityType,
      entity_id: entityId,
      document_url: documentUrl || null,
      expires_at: expiresAt || null,
      status,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: { code: "CREATE_FAILED", message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json(record, { status: 201 });
}
