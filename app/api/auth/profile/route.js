import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/supabaseAdmin";
import { errorResponse, verifyCsrf } from "@/lib/auth/api";
import { TABLES } from "@/lib/supabase/tables";

const ProfileQuerySchema = z.object({
  userId: z.string().uuid(),
});

const UpdateProfileSchema = z.object({
  userId: z.string().uuid(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  roleTitle: z.string().min(1).optional(),
});

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const parseResult = ProfileQuerySchema.safeParse({
    userId: searchParams.get("userId"),
  });
  if (!parseResult.success) {
    return errorResponse("VALIDATION_ERROR", parseResult.error.message, 400);
  }

  const { userId } = parseResult.data;
  let userRow = null;
  const { data: dbUser, error: userError } = await supabaseAdmin
    .from(TABLES.users)
    .select("id, email, first_name, last_name, phone, role")
    .eq("id", userId)
    .maybeSingle();

  if (!userError && dbUser) {
    userRow = dbUser;
  } else {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (authUser?.user) {
      const meta = authUser.user.user_metadata || {};
      userRow = {
        id: authUser.user.id,
        email: authUser.user.email,
        first_name: meta.firstName ?? meta.first_name ?? null,
        last_name: meta.lastName ?? meta.last_name ?? null,
        phone: meta.phone ?? null,
        role: meta.role ?? "ADMIN",
      };
      await supabaseAdmin.from(TABLES.users).upsert(
        {
          id: userId,
          email: userRow.email,
          first_name: userRow.first_name,
          last_name: userRow.last_name,
          phone: userRow.phone,
          role: userRow.role,
        },
        { onConflict: "id" }
      );
    }
  }

  if (!userRow) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      { status: 404 }
    );
  }

  const payload = {
    user: {
      id: userRow.id,
      email: userRow.email,
      firstName: userRow.first_name,
      lastName: userRow.last_name,
      phone: userRow.phone,
      role: userRow.role,
    },
  };

  if (userRow.role === "STAFF") {
    const { data: staffProfile } = await supabaseAdmin
      .from(TABLES.staffProfiles)
      .select("id, role_title, status")
      .eq("user_id", userRow.id)
      .maybeSingle();
    payload.staffProfile = staffProfile || null;
  } else if (userRow.role === "PARENT") {
    const { data: parentProfile } = await supabaseAdmin
      .from(TABLES.parentProfiles)
      .select("id, communication_prefs")
      .eq("user_id", userRow.id)
      .maybeSingle();

    const children = [];
    if (parentProfile?.id) {
      const { data: childRows } = await supabaseAdmin
        .from(TABLES.children)
        .select(
          "id, first_name, last_name, date_of_birth, relationship, allergies, medical_notes, dietary_restrictions"
        )
        .eq("parent_profile_id", parentProfile.id)
        .order("created_at", { ascending: false });

      if (childRows?.length) {
        children.push(
          ...childRows.map((child) => ({
            id: child.id,
            firstName: child.first_name,
            lastName: child.last_name,
            dateOfBirth: child.date_of_birth,
            relationship: child.relationship,
            allergies: child.allergies,
            medicalNotes: child.medical_notes,
            dietaryRestrictions: child.dietary_restrictions,
          }))
        );
      }
    }

    payload.parentProfile = {
      ...parentProfile,
      children,
    };
  }

  return NextResponse.json(payload);
}

export async function PATCH(request) {
  const csrfError = verifyCsrf(request);
  if (csrfError) return csrfError;

  const body = await request.json().catch(() => null);
  const parseResult = UpdateProfileSchema.safeParse(body);
  if (!parseResult.success) {
    return errorResponse("VALIDATION_ERROR", parseResult.error.message, 400);
  }

  const { userId, firstName, lastName, roleTitle } = parseResult.data;
  const { data: userRow, error: userError } = await supabaseAdmin
    .from(TABLES.users)
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();

  if (userError || !userRow) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      { status: 404 }
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from(TABLES.users)
    .update({
      first_name: firstName,
      last_name: lastName,
    })
    .eq("id", userId);

  if (updateError) {
    return NextResponse.json(
      { error: { code: "UPDATE_FAILED", message: updateError.message } },
      { status: 500 }
    );
  }

  if (userRow.role === "STAFF" && roleTitle) {
    await supabaseAdmin
      .from(TABLES.staffProfiles)
      .update({ role_title: roleTitle })
      .eq("user_id", userId);
  }

  return NextResponse.json({ ok: true });
}
