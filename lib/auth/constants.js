/** MVP modules per role (from brightwheel_blueprint MVP scope) */
export const ROLE_MODULES = {
  ADMIN: [
    { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
    { id: "staff", label: "Staff Management", href: "/dashboard/staff", icon: "Users" },
    {
      id: "parents",
      label: "Parents & Families",
      href: "/dashboard/parents",
      icon: "UsersRound",
    },
    {
      id: "classes",
      label: "Classes",
      href: "/dashboard/classes",
      icon: "GraduationCap",
    },
    { id: "billing", label: "Billing", href: "/dashboard/billing", icon: "CreditCard" },
    {
      id: "incidents",
      label: "Incident Reporting",
      href: "/dashboard/incidents",
      icon: "AlertTriangle",
    },
    {
      id: "activity",
      label: "Daily Activity Logging",
      href: "/dashboard/activity",
      icon: "ClipboardList",
    },
    {
      id: "communication",
      label: "Chat",
      href: "/dashboard/communication",
      icon: "MessageCircle",
    },
    {
      id: "compliance",
      label: "Compliance",
      href: "/dashboard/compliance",
      icon: "ShieldCheck",
    },
  ],
  STAFF: [
    { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
    {
      id: "parents",
      label: "Parents & Families",
      href: "/dashboard/parents",
      icon: "UsersRound",
    },
    {
      id: "classes",
      label: "Classes",
      href: "/dashboard/classes",
      icon: "GraduationCap",
    },
    {
      id: "check-in",
      label: "Child Check-In/Out",
      href: "/dashboard/check-in",
      icon: "LogIn",
    },
    {
      id: "communication",
      label: "Chat",
      href: "/dashboard/communication",
      icon: "MessageCircle",
    },
    {
      id: "activity",
      label: "Daily Activity Logging",
      href: "/dashboard/activity",
      icon: "ClipboardList",
    },
    {
      id: "incidents",
      label: "Incident Reporting",
      href: "/dashboard/incidents",
      icon: "AlertTriangle",
    },
    {
      id: "compliance",
      label: "Compliance",
      href: "/dashboard/compliance",
      icon: "ShieldCheck",
    },
  ],
  PARENT: [
    {
      id: "activity",
      label: "Daily Activity",
      href: "/dashboard/activity",
      icon: "ClipboardList",
    },
    {
      id: "communication",
      label: "Chat",
      href: "/dashboard/communication",
      icon: "MessageCircle",
    },
    { id: "billing", label: "Billing", href: "/dashboard/billing", icon: "CreditCard" },
  ],
};


