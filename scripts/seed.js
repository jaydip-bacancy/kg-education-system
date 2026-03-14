/**
 * Seed Supabase with dummy data.
 * Run: npm run seed
 * Or: node --env-file=.env.local scripts/seed.js
 * Requires migrations to be run first (centers-only schema, no organizations).
 */
const { createClient } = require("@supabase/supabase-js");

const SEED_PASSWORD = "Password123!";
const DOMAIN = "yopmail.com";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Use: npm run seed");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TABLES = {
  centers: "centers",
  adminProfiles: "admin_profiles",
  adminCenters: "admin_centers",
  users: "users",
  staffProfiles: "staff_profiles",
  staffCenters: "staff_centers",
  parentProfiles: "parent_profiles",
  children: "children",
  emergencyContacts: "emergency_contacts",
  classrooms: "classrooms",
  classroomRosters: "classroom_rosters",
  staffClassrooms: "staff_classrooms",
  attendance: "attendance",
  activityLogs: "activity_logs",
  invoices: "invoices",
  payments: "payments",
  centerRates: "center_rates",
  messageThreads: "message_threads",
  messages: "messages",
  messageThreadParticipants: "message_thread_participants",
  incidents: "incidents",
  complianceRecords: "compliance_records",
  documents: "documents",
};

async function createAuthUser(email, metadata = {}) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (error) throw new Error(`Auth create failed for ${email}: ${error.message}`);
  return data.user.id;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Deletes from tables in FK-safe order (child tables first) */
async function cleanTables() {
  console.log("Cleaning existing data...");
  const deleteOrder = [
    TABLES.messages,
    TABLES.messageThreadParticipants,
    TABLES.messageThreads,
    TABLES.payments,
    TABLES.invoices,
    TABLES.classroomRosters,
    TABLES.staffClassrooms,
    TABLES.attendance,
    TABLES.activityLogs,
    TABLES.incidents,
    TABLES.complianceRecords,
    TABLES.documents,
    TABLES.emergencyContacts,
    TABLES.children,
    TABLES.staffCenters,
    TABLES.adminCenters,
    TABLES.classrooms,
    TABLES.staffProfiles,
    TABLES.adminProfiles,
    TABLES.parentProfiles,
    TABLES.users,
    TABLES.centerRates,
    TABLES.centers,
  ];
  for (const table of deleteOrder) {
    const { error } = await supabase.from(table).delete().gte("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw new Error(`Failed to clean ${table}: ${error.message}`);
  }
  console.log("Cleaned tables");
}

/** Deletes auth users for seed emails so they can be recreated */
async function cleanSeedAuthUsers(emails) {
  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  for (const u of users || []) {
    if (emails.includes(u.email)) {
      await supabase.auth.admin.deleteUser(u.id);
    }
  }
}

async function seed() {
  console.log("Seeding Supabase (centers only, no organizations)...");

  const seedEmails = [
    `sarah.mitchell@${DOMAIN}`,
    `emma.wilson@${DOMAIN}`,
    `james.chen@${DOMAIN}`,
    `olivia.martinez@${DOMAIN}`,
    `michael.brown@${DOMAIN}`,
    `jennifer.davis@${DOMAIN}`,
    `david.thompson@${DOMAIN}`,
    `amanda.rodriguez@${DOMAIN}`,
    `robert.kim@${DOMAIN}`,
    `lisa.anderson@${DOMAIN}`,
    `christopher.lee@${DOMAIN}`,
  ];
  await cleanSeedAuthUsers(seedEmails);
  await cleanTables();

  // 1. Centers (top-level)
  const { data: centers, error: centerErr } = await supabase
    .from(TABLES.centers)
    .insert([
      { name: "Downtown Campus", address_line1: "123 Main St", city: "Austin", state: "TX", postal_code: "78701" },
      { name: "Westside Campus", address_line1: "456 Oak Ave", city: "Austin", state: "TX", postal_code: "78745" },
      { name: "Sunshine Kids", address_line1: "789 Maple Dr", city: "Round Rock", state: "TX", postal_code: "78664" },
    ])
    .select("id, name")
    .order("name");

  if (centerErr) throw new Error(`Centers: ${centerErr.message}`);
  const [center1, center2, center3] = centers;
  console.log(`Created ${centers.length} centers`);

  // Center rates (per child: monthly $400, quarterly $1,140, annual $4,320)
  for (const c of centers) {
    await supabase.from(TABLES.centerRates).insert([
      { center_id: c.id, period: "MONTHLY", amount_cents: 40000 },
      { center_id: c.id, period: "QUARTERLY", amount_cents: 114000 },
      { center_id: c.id, period: "ANNUAL", amount_cents: 432000 },
    ]);
  }
  console.log("Created center rates");

  // 2. Admin
  const adminEmail = `sarah.mitchell@${DOMAIN}`;
  const adminId = await createAuthUser(adminEmail, { role: "ADMIN", firstName: "Sarah", lastName: "Mitchell" });
  await supabase.from(TABLES.users).insert({
    id: adminId,
    email: adminEmail,
    role: "ADMIN",
    first_name: "Sarah",
    last_name: "Mitchell",
    phone: "+1 512-555-0101",
  });
  const { data: adminProfile } = await supabase
    .from(TABLES.adminProfiles)
    .insert({ user_id: adminId })
    .select("id")
    .single();
  for (const c of [center1, center2]) {
    await supabase.from(TABLES.adminCenters).insert({ admin_profile_id: adminProfile.id, center_id: c.id });
  }
  console.log(`Created admin: ${adminEmail}`);

  // 3. Staff
  const staffData = [
    { email: `emma.wilson@${DOMAIN}`, firstName: "Emma", lastName: "Wilson", roleTitle: "Lead Teacher", centerIds: [center1.id] },
    { email: `james.chen@${DOMAIN}`, firstName: "James", lastName: "Chen", roleTitle: "Assistant Teacher", centerIds: [center1.id] },
    { email: `olivia.martinez@${DOMAIN}`, firstName: "Olivia", lastName: "Martinez", roleTitle: "Lead Teacher", centerIds: [center2.id] },
    { email: `michael.brown@${DOMAIN}`, firstName: "Michael", lastName: "Brown", roleTitle: "Director", centerIds: [center3.id] },
  ];

  const staffProfiles = [];
  for (const s of staffData) {
    const userId = await createAuthUser(s.email, { role: "STAFF" });
    await supabase.from(TABLES.users).insert({
      id: userId,
      email: s.email,
      role: "STAFF",
      first_name: s.firstName,
      last_name: s.lastName,
      phone: `+1 512-555-${String(Math.floor(1000 + Math.random() * 9000))}`,
    });
    const { data: sp } = await supabase
      .from(TABLES.staffProfiles)
      .insert({
        user_id: userId,
        role_title: s.roleTitle,
        status: "ACTIVE",
      })
      .select("id")
      .single();
    for (const cid of s.centerIds) {
      await supabase.from(TABLES.staffCenters).insert({ staff_profile_id: sp.id, center_id: cid });
    }
    staffProfiles.push({ ...sp, userId });
  }
  console.log(`Created ${staffData.length} staff`);

  // 4. Parents (each with 1 child)
  const parentData = [
    { email: `jennifer.davis@${DOMAIN}`, firstName: "Jennifer", lastName: "Davis", child: { firstName: "Sophie", lastName: "Davis", dob: "2020-03-15", allergies: "None" }, centerId: center1.id },
    { email: `david.thompson@${DOMAIN}`, firstName: "David", lastName: "Thompson", child: { firstName: "Liam", lastName: "Thompson", dob: "2019-07-22", allergies: "Peanuts" }, centerId: center1.id },
    { email: `amanda.rodriguez@${DOMAIN}`, firstName: "Amanda", lastName: "Rodriguez", child: { firstName: "Mia", lastName: "Rodriguez", dob: "2021-01-08", allergies: "Dairy" }, centerId: center1.id },
    { email: `robert.kim@${DOMAIN}`, firstName: "Robert", lastName: "Kim", child: { firstName: "Ethan", lastName: "Kim", dob: "2020-11-30", allergies: "None" }, centerId: center2.id },
    { email: `lisa.anderson@${DOMAIN}`, firstName: "Lisa", lastName: "Anderson", child: { firstName: "Ava", lastName: "Anderson", dob: "2021-05-12", allergies: "None" }, centerId: center2.id },
    { email: `christopher.lee@${DOMAIN}`, firstName: "Christopher", lastName: "Lee", child: { firstName: "Noah", lastName: "Lee", dob: "2019-09-05", allergies: "Eggs" }, centerId: center3.id },
  ];

  const parentProfiles = [];
  const allChildren = [];
  for (const p of parentData) {
    const userId = await createAuthUser(p.email, { role: "PARENT", centerId: p.centerId });
    await supabase.from(TABLES.users).insert({
      id: userId,
      email: p.email,
      role: "PARENT",
      first_name: p.firstName,
      last_name: p.lastName,
      phone: `+1 512-555-${String(Math.floor(1000 + Math.random() * 9000))}`,
    });
    const { data: pp } = await supabase
      .from(TABLES.parentProfiles)
      .insert({ user_id: userId, communication_prefs: { emailUpdates: true, smsAlerts: true } })
      .select("id")
      .single();
    const billingCycle = ["MONTHLY", "QUARTERLY", "ANNUAL"][parentData.indexOf(p) % 3];
    const { data: child } = await supabase
      .from(TABLES.children)
      .insert({
        parent_profile_id: pp.id,
        center_id: p.centerId,
        first_name: p.child.firstName,
        last_name: p.child.lastName,
        date_of_birth: p.child.dob,
        relationship: "Parent",
        allergies: p.child.allergies,
        medical_notes: p.child.allergies !== "None" ? `Allergy: ${p.child.allergies}` : null,
        billing_cycle: billingCycle,
      })
      .select("id, first_name")
      .single();
    await supabase.from(TABLES.emergencyContacts).insert({
      child_id: child.id,
      name: `${p.firstName} ${p.lastName}`,
      phone: "+1 512-555-9999",
      relationship: "Parent",
      is_primary: true,
      is_authorized_pickup: true,
    });
    parentProfiles.push({ ...pp, userId });
    allChildren.push({ ...child, centerId: p.centerId, parentUserId: userId });
  }
  console.log(`Created ${parentData.length} parents with 1 child each`);

  // 5. Classrooms
  const { data: classrooms } = await supabase
    .from(TABLES.classrooms)
    .insert([
      { center_id: center1.id, name: "Toddler Room A", capacity: 12, start_time: "08:00", end_time: "17:00" },
      { center_id: center1.id, name: "Preschool Room B", capacity: 16, start_time: "08:00", end_time: "17:00" },
      { center_id: center2.id, name: "Toddler Room", capacity: 14, start_time: "07:30", end_time: "17:30" },
      { center_id: center3.id, name: "Infant Room", capacity: 8, start_time: "07:00", end_time: "18:00" },
    ])
    .select("id, center_id");
  console.log(`Created ${classrooms.length} classrooms`);

  // 6. Classroom rosters
  for (let i = 0; i < allChildren.length; i++) {
    const child = allChildren[i];
    const room = classrooms.find((c) => c.center_id === child.centerId);
    if (room) {
      await supabase.from(TABLES.classroomRosters).insert({
        child_id: child.id,
        classroom_id: room.id,
        enrolled_at: "2024-01-15",
        status: "ACTIVE",
      });
    }
  }
  console.log("Created classroom rosters");

  // 6b. Staff classrooms (assign staff to classrooms)
  const center1Rooms = classrooms.filter((c) => c.center_id === center1.id);
  const center2Rooms = classrooms.filter((c) => c.center_id === center2.id);
  if (center1Rooms.length && staffProfiles[0]) {
    await supabase.from(TABLES.staffClassrooms).insert({
      staff_profile_id: staffProfiles[0].id,
      classroom_id: center1Rooms[0].id,
      role_title: "Lead Teacher",
    });
  }
  if (center1Rooms.length && staffProfiles[1]) {
    await supabase.from(TABLES.staffClassrooms).insert({
      staff_profile_id: staffProfiles[1].id,
      classroom_id: center1Rooms[0].id,
      role_title: "Assistant",
    });
  }
  if (center2Rooms.length && staffProfiles[2]) {
    await supabase.from(TABLES.staffClassrooms).insert({
      staff_profile_id: staffProfiles[2].id,
      classroom_id: center2Rooms[0].id,
      role_title: "Lead Teacher",
    });
  }
  console.log("Created staff classroom assignments");

  // 7. Attendance
  const today = new Date();
  for (let i = 0; i < 3; i++) {
    const date = addDays(today, -i);
    for (const child of allChildren.slice(0, 4)) {
      const checkIn = new Date(date);
      checkIn.setHours(8, 30, 0, 0);
      const checkOut = new Date(date);
      checkOut.setHours(17, 0, 0, 0);
      await supabase.from(TABLES.attendance).insert({
        child_id: child.id,
        center_id: child.centerId,
        checked_in_at: checkIn.toISOString(),
        checked_out_at: i === 0 ? null : checkOut.toISOString(),
        checked_in_by: staffProfiles[0].userId,
        checked_out_by: i === 0 ? null : staffProfiles[0].userId,
      });
    }
  }
  console.log("Created attendance records");

  // 8. Activity logs
  for (const child of allChildren.slice(0, 4)) {
    const types = ["MEAL", "NAP", "DIAPER", "ACTIVITY"];
    for (const t of types) {
      const logTime = new Date();
      logTime.setHours(10 + types.indexOf(t), 0, 0, 0);
      await supabase.from(TABLES.activityLogs).insert({
        child_id: child.id,
        staff_profile_id: staffProfiles[0].id,
        activity_type: t,
        details: t === "MEAL" ? { meal: "Lunch", notes: "Ate well" } : t === "NAP" ? { duration: 90 } : {},
        logged_at: logTime.toISOString(),
      });
    }
  }
  console.log("Created activity logs");

  // 9. Invoices & payments
  for (let i = 0; i < parentProfiles.length; i++) {
    const pp = parentProfiles[i];
    const p = parentData[i];
    const child = allChildren[i];
    const dueDate = addDays(today, 15);
    const status = i % 2 === 0 ? "PAID" : "PENDING";
    const { data: inv } = await supabase
      .from(TABLES.invoices)
      .insert({
        center_id: p.centerId,
        parent_profile_id: pp.id,
        child_id: child?.id,
        amount_cents: 120000,
        due_date: dueDate.toISOString().slice(0, 10),
        status,
        period_start: "2024-03-01",
        period_end: "2024-03-31",
        notes: "March 2024 tuition",
      })
      .select("id")
      .single();
    if (status === "PAID") {
      await supabase.from(TABLES.payments).insert({
        invoice_id: inv.id,
        amount_cents: 120000,
        paid_at: new Date().toISOString(),
        payment_method: "CARD",
        transaction_id: `txn_${Math.random().toString(36).slice(2, 12)}`,
      });
    }
  }
  console.log("Created invoices and payments");

  // 10. Messages
  for (let i = 0; i < Math.min(3, allChildren.length); i++) {
    const child = allChildren[i];
    const p = parentData[i];
    const parentUserId = parentProfiles[i].userId;
    const { data: thread } = await supabase
      .from(TABLES.messageThreads)
      .insert({
        child_id: child.id,
        center_id: p.centerId,
        subject: `Updates for ${child.first_name}`,
      })
      .select("id")
      .single();
    await supabase.from(TABLES.messageThreadParticipants).insert([
      { thread_id: thread.id, user_id: staffProfiles[0].userId },
      { thread_id: thread.id, user_id: parentUserId },
    ]);
    await supabase.from(TABLES.messages).insert({
      thread_id: thread.id,
      sender_id: staffProfiles[0].userId,
      content: `Hi! ${child.first_name} had a great day today. They enjoyed story time and outdoor play.`,
      read_at: new Date().toISOString(),
    });
  }
  console.log("Created message threads");

  // 11. Incidents
  await supabase.from(TABLES.incidents).insert({
    child_id: allChildren[1].id,
    center_id: center1.id,
    reported_by: staffProfiles[0].id,
    incident_type: "INJURY",
    description: "Minor scratch on knee during outdoor play. Cleaned and bandaged.",
    occurred_at: addDays(today, -2).toISOString(),
    witness_statement: "Saw child trip on uneven pavement.",
    parent_notified_at: addDays(today, -2).toISOString(),
  });
  console.log("Created incidents");

  // 12. Compliance records (center-scoped)
  await supabase.from(TABLES.complianceRecords).insert([
    { center_id: center1.id, record_type: "BACKGROUND_CHECK", entity_type: "STAFF", entity_id: staffProfiles[0].id, status: "APPROVED", expires_at: addDays(today, 365).toISOString().slice(0, 10) },
    { center_id: center1.id, record_type: "IMMUNIZATION", entity_type: "CHILD", entity_id: allChildren[0].id, status: "APPROVED", expires_at: addDays(today, 180).toISOString().slice(0, 10) },
  ]);
  console.log("Created compliance records");

  // 13. Documents (center-scoped)
  await supabase.from(TABLES.documents).insert({
    center_id: center1.id,
    entity_type: "child",
    entity_id: allChildren[0].id,
    document_type: "medical_form",
    file_url: "https://example.com/docs/medical-form.pdf",
    file_name: "medical_form.pdf",
  });
  console.log("Created documents");

  console.log("\n--- Seed complete ---");
  console.log(`Login with any user using password: ${SEED_PASSWORD}`);
  console.log("Example emails:");
  console.log(`  Admin: ${adminEmail}`);
  console.log(`  Staff: ${staffData[0].email}`);
  console.log(`  Parent: ${parentData[0].email}`);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
