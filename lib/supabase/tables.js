/** Supabase table names - aligned with MVP schema */
export const TABLES = {
  // Core (centers are top-level, no organizations)
  users: "users",
  centers: "centers",
  adminProfiles: "admin_profiles",
  adminCenters: "admin_centers",
  staffProfiles: "staff_profiles",
  parentProfiles: "parent_profiles",
  staffCenters: "staff_centers",
  children: "children",
  // MVP: Check-in, activity, billing, communication, incidents, compliance
  emergencyContacts: "emergency_contacts",
  classrooms: "classrooms",
  classroomRosters: "classroom_rosters",
  staffClassrooms: "staff_classrooms",
  attendance: "attendance",
  activityLogs: "activity_logs",
  invoices: "invoices",
  payments: "payments",
  messageThreads: "message_threads",
  messages: "messages",
  messageThreadParticipants: "message_thread_participants",
  incidents: "incidents",
  complianceRecords: "compliance_records",
  documents: "documents",
};
