import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/supabaseAdmin";
import { errorResponse, verifyCsrf } from "@/lib/auth/api";
import { TABLES } from "@/lib/supabase/tables";

const ChildSchema = z.object({
  id: z.string().uuid().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().optional(),
  relationship: z.string().optional(),
  allergies: z.string().optional(),
  medicalNotes: z.string().optional(),
  dietaryRestrictions: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
});

const UpdateParentSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  communicationPrefs: z.record(z.string(), z.unknown()).optional(),
  children: z.array(ChildSchema).min(1),
});

/** PATCH - Update family (parent + children). Admin/Staff only. */
export async function PATCH(request, { params }) {
  const csrfError = verifyCsrf(request);
  if (csrfError) return csrfError;

  const { id: parentProfileId } = await params;
  if (!parentProfileId) {
    return errorResponse("INVALID_ID", "Parent profile ID required", 400);
  }

  const body = await request.json().catch(() => null);
  const parseResult = UpdateParentSchema.safeParse(body);
  if (!parseResult.success) {
    return errorResponse("VALIDATION_ERROR", parseResult.error.message, 400);
  }

  const { firstName, lastName, phone, communicationPrefs, children } = parseResult.data;

  const { data: parentProfile, error: profileError } = await supabaseAdmin
    .from(TABLES.parentProfiles)
    .select("id, user_id")
    .eq("id", parentProfileId)
    .single();

  if (profileError || !parentProfile) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Family not found" } },
      { status: 404 }
    );
  }

  const userId = parentProfile.user_id;

  const { error: userError } = await supabaseAdmin
    .from(TABLES.users)
    .update({
      first_name: firstName,
      last_name: lastName,
      phone: phone ?? null,
    })
    .eq("id", userId);

  if (userError) {
    return NextResponse.json(
      { error: { code: "UPDATE_FAILED", message: userError.message } },
      { status: 500 }
    );
  }

  const { error: prefsError } = await supabaseAdmin
    .from(TABLES.parentProfiles)
    .update({
      communication_prefs: communicationPrefs ?? {},
    })
    .eq("id", parentProfileId);

  if (prefsError) {
    return NextResponse.json(
      { error: { code: "UPDATE_FAILED", message: prefsError.message } },
      { status: 500 }
    );
  }

  const { data: existingChildren } = await supabaseAdmin
    .from(TABLES.children)
    .select("id, center_id")
    .eq("parent_profile_id", parentProfileId);

  const existingIds = new Set((existingChildren || []).map((c) => c.id));
  const updatedIds = new Set(children.filter((c) => c.id).map((c) => c.id));
  const centerId = existingChildren?.[0]?.center_id;

  if (!centerId) {
    return NextResponse.json(
      { error: { code: "INVALID_STATE", message: "Family has no center" } },
      { status: 400 }
    );
  }

  for (const child of children) {
    const payload = {
      first_name: child.firstName,
      last_name: child.lastName,
      date_of_birth: child.dateOfBirth || null,
      relationship: child.relationship || null,
      allergies: child.allergies || null,
      medical_notes: child.medicalNotes || null,
      dietary_restrictions: child.dietaryRestrictions || null,
    };

    if (child.id && existingIds.has(child.id)) {
      const { error: updErr } = await supabaseAdmin
        .from(TABLES.children)
        .update(payload)
        .eq("id", child.id);
      if (updErr) {
        return NextResponse.json(
          { error: { code: "CHILD_UPDATE_FAILED", message: updErr.message } },
          { status: 500 }
        );
      }

      if (child.emergencyContactName || child.emergencyContactPhone) {
        const { data: existingContacts } = await supabaseAdmin
          .from(TABLES.emergencyContacts)
          .select("id")
          .eq("child_id", child.id)
          .eq("is_primary", true);
        const contactId = existingContacts?.[0]?.id;
        const contactPayload = {
          name: child.emergencyContactName || "Emergency Contact",
          phone: child.emergencyContactPhone || "",
          relationship: "Parent",
        };
        if (contactId) {
          await supabaseAdmin
            .from(TABLES.emergencyContacts)
            .update(contactPayload)
            .eq("id", contactId);
        } else {
          await supabaseAdmin.from(TABLES.emergencyContacts).insert({
            child_id: child.id,
            ...contactPayload,
            is_primary: true,
            is_authorized_pickup: true,
          });
        }
      }
    } else if (!child.id) {
      const { data: newChild, error: insErr } = await supabaseAdmin
        .from(TABLES.children)
        .insert({
          parent_profile_id: parentProfileId,
          center_id: centerId,
          ...payload,
        })
        .select("id")
        .single();
      if (insErr) {
        return NextResponse.json(
          { error: { code: "CHILD_CREATE_FAILED", message: insErr.message } },
          { status: 500 }
        );
      }
      if (child.emergencyContactName || child.emergencyContactPhone) {
        await supabaseAdmin.from(TABLES.emergencyContacts).insert({
          child_id: newChild.id,
          name: child.emergencyContactName || "Emergency Contact",
          phone: child.emergencyContactPhone || "",
          relationship: "Parent",
          is_primary: true,
          is_authorized_pickup: true,
        });
      }
    }
  }

  for (const id of existingIds) {
    if (!updatedIds.has(id)) {
      const { error: delErr } = await supabaseAdmin
        .from(TABLES.children)
        .delete()
        .eq("id", id);
      if (delErr) {
        return NextResponse.json(
          { error: { code: "CHILD_DELETE_FAILED", message: delErr.message } },
          { status: 500 }
        );
      }
    }
  }

  return NextResponse.json({ ok: true });
}

/** DELETE - Delete family (parent profile, children, auth user). Admin/Staff only. */
export async function DELETE(request, { params }) {
  const csrfError = verifyCsrf(request);
  if (csrfError) return csrfError;

  const { id: parentProfileId } = await params;
  if (!parentProfileId) {
    return errorResponse("INVALID_ID", "Parent profile ID required", 400);
  }

  const { data: parentProfile, error: profileError } = await supabaseAdmin
    .from(TABLES.parentProfiles)
    .select("id, user_id")
    .eq("id", parentProfileId)
    .single();

  if (profileError || !parentProfile) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Family not found" } },
      { status: 404 }
    );
  }

  const userId = parentProfile.user_id;

  const { error: deleteProfileError } = await supabaseAdmin
    .from(TABLES.parentProfiles)
    .delete()
    .eq("id", parentProfileId);

  if (deleteProfileError) {
    return NextResponse.json(
      { error: { code: "DELETE_FAILED", message: deleteProfileError.message } },
      { status: 500 }
    );
  }

  await supabaseAdmin.auth.admin.deleteUser(userId);

  return NextResponse.json({ ok: true });
}
