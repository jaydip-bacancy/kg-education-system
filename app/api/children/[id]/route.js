import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/supabaseAdmin";
import { TABLES } from "@/lib/supabase/tables";

/** GET - Child details with classrooms and emergency contacts */
export async function GET(request, { params }) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { error: { code: "INVALID_ID", message: "Child ID required" } },
      { status: 400 }
    );
  }

  const { data: child, error: childError } = await supabaseAdmin
    .from(TABLES.children)
    .select("id, first_name, last_name, date_of_birth, relationship, allergies, medical_notes, dietary_restrictions, center_id")
    .eq("id", id)
    .single();

  if (childError || !child) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Child not found" } },
      { status: 404 }
    );
  }

  const [rostersRes, contactsRes] = await Promise.all([
    supabaseAdmin
      .from(TABLES.classroomRosters)
      .select("classroom_id, enrolled_at, status")
      .eq("child_id", id)
      .eq("status", "ACTIVE"),
    supabaseAdmin
      .from(TABLES.emergencyContacts)
      .select("id, name, phone, relationship, is_primary, is_authorized_pickup")
      .eq("child_id", id),
  ]);

  const rosters = rostersRes.data || [];
  const contacts = contactsRes.data || [];

  let classrooms = [];
  if (rosters.length > 0) {
    const classroomIds = rosters.map((r) => r.classroom_id);
    const { data: classroomRows } = await supabaseAdmin
      .from(TABLES.classrooms)
      .select("id, name, capacity, start_time, end_time")
      .in("id", classroomIds);
    const byId = (classroomRows || []).reduce((acc, c) => {
      acc[c.id] = c;
      return acc;
    }, {});
    classrooms = rosters.map((r) => ({
      id: r.classroom_id,
      name: byId[r.classroom_id]?.name ?? "—",
      capacity: byId[r.classroom_id]?.capacity,
      startTime: byId[r.classroom_id]?.start_time,
      endTime: byId[r.classroom_id]?.end_time,
      enrolledAt: r.enrolled_at,
    }));
  }

  const primaryContact = contacts.find((c) => c.is_primary) || contacts[0];

  return NextResponse.json({
    id: child.id,
    firstName: child.first_name,
    lastName: child.last_name,
    dateOfBirth: child.date_of_birth,
    relationship: child.relationship,
    allergies: child.allergies,
    medicalNotes: child.medical_notes,
    dietaryRestrictions: child.dietary_restrictions,
    centerId: child.center_id,
    classrooms,
    emergencyContacts: contacts.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      relationship: c.relationship,
      isPrimary: c.is_primary,
      isAuthorizedPickup: c.is_authorized_pickup,
    })),
    emergencyContactName: primaryContact?.name,
    emergencyContactPhone: primaryContact?.phone,
  });
}
