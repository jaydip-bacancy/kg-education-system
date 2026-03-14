"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  UsersRound,
  GraduationCap,
  Building2,
  AlertTriangle,
  CreditCard,
  Baby,
} from "lucide-react";

const STORAGE_KEY = "brightsteps_auth";

const ADMIN_STAT_ICONS = {
  parentsCount: UsersRound,
  classesCount: GraduationCap,
  centersCount: Building2,
  activeStaffCount: Users,
  incidentsCount: AlertTriangle,
};

const STAFF_STAT_ICONS = {
  classesAssignedCount: GraduationCap,
  studentsCount: UsersRound,
  incidentsCount: AlertTriangle,
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [lists, setLists] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        router.replace("/login");
        return;
      }
      const { user: u } = JSON.parse(raw);
      if (!u?.role) {
        router.replace("/login");
        return;
      }
      setUser(u);
    } catch {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    if (!user || user.role === "PARENT") {
      setLoading(false);
      return;
    }
    const params = new URLSearchParams({ role: user.role });
    if (user.role === "STAFF") params.set("userId", user.id || "");
    Promise.all([
      fetch(`/api/dashboard/stats?${params}`).then((r) => r.json()),
      user.role === "ADMIN"
        ? fetch(`/api/dashboard/lists?role=ADMIN`).then((r) => r.json())
        : Promise.resolve(null),
    ])
      .then(([statsData, listsData]) => {
        if (statsData.error?.code !== "DASHBOARD_INACCESSIBLE") setStats(statsData);
        if (listsData && !listsData.error) setLists(listsData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (user.role === "PARENT") {
    router.replace("/dashboard/activity");
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Redirecting…</p>
      </div>
    );
  }

  const roleLabel = { ADMIN: "Administrator", STAFF: "Staff" }[user.role] || user.role;

  const adminStatLabels = {
    parentsCount: "Parents",
    classesCount: "Classes",
    centersCount: "Centers Online",
    activeStaffCount: "Active Staff",
    incidentsCount: "Incidents Reported",
  };

  const staffStatLabels = {
    classesAssignedCount: "Classes Assigned (Today)",
    studentsCount: "Students in Assigned Classes",
    incidentsCount: "Incidents (Assigned Classes)",
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#6b4e3d]">
          Dashboard
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="mt-1 text-muted-foreground">
          {user.email} · {roleLabel}
        </p>
      </div>

      {user.role === "ADMIN" && stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Object.entries(adminStatLabels).map(([key, label]) => {
            const Icon = ADMIN_STAT_ICONS[key];
            return (
              <Card key={key} className="border-border bg-card shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {label}
                  </CardTitle>
                  {Icon && <Icon className="size-5 text-muted-foreground" />}
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{stats[key] ?? 0}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {user.role === "ADMIN" && lists && (
        <div className="space-y-6">
          <Card className="border-border bg-card shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-medium">Pending bills</CardTitle>
              <CreditCard className="size-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {lists.pendingBills?.length ? (
                <div className="overflow-x-auto max-h-64 overflow-y-auto rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-medium">Amount</th>
                        <th className="px-4 py-2.5 text-left font-medium">Parent</th>
                        <th className="px-4 py-2.5 text-left font-medium">Center</th>
                        <th className="px-4 py-2.5 text-left font-medium">Due date</th>
                        <th className="px-4 py-2.5 text-left font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lists.pendingBills.map((b) => (
                        <tr key={b.id} className="border-t border-border">
                          <td className="px-4 py-2.5">
                            <Link href="/dashboard/billing" className="font-medium text-primary hover:underline">
                              {b.amountFormatted}
                            </Link>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">{b.parentName}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{b.centerName}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {b.dueDate ? new Date(b.dueDate).toLocaleDateString("en-US") : "—"}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded ${
                                b.status === "OVERDUE" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {b.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4">No pending bills</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-medium">Available children</CardTitle>
              <Baby className="size-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {lists.availableChildren?.length ? (
                <div className="overflow-x-auto max-h-64 overflow-y-auto rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-medium">Name</th>
                        <th className="px-4 py-2.5 text-left font-medium">Center</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lists.availableChildren.map((c) => (
                        <tr key={c.id} className="border-t border-border">
                          <td className="px-4 py-2.5">
                            <Link href="/dashboard/parents" className="font-medium text-primary hover:underline">
                              {c.name}
                            </Link>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">{c.centerName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4">No available children</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-medium">Classes without staff and children</CardTitle>
              <GraduationCap className="size-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {lists.emptyClasses?.length ? (
                <div className="overflow-x-auto max-h-64 overflow-y-auto rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-medium">Class</th>
                        <th className="px-4 py-2.5 text-left font-medium">Center</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lists.emptyClasses.map((c) => (
                        <tr key={c.id} className="border-t border-border">
                          <td className="px-4 py-2.5">
                            <Link href="/dashboard/classes" className="font-medium text-primary hover:underline">
                              {c.name}
                            </Link>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">{c.centerName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4">None</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {user.role === "STAFF" && stats && (
        <div className="grid gap-4 sm:grid-cols-3">
          {Object.entries(staffStatLabels).map(([key, label]) => {
            const Icon = STAFF_STAT_ICONS[key];
            return (
              <Card key={key} className="border-border bg-card shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {label}
                  </CardTitle>
                  {Icon && <Icon className="size-5 text-muted-foreground" />}
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{stats[key] ?? 0}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {loading && !stats && (
        <p className="text-sm text-muted-foreground">Loading stats…</p>
      )}
    </div>
  );
}
