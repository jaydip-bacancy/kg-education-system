"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ClipboardList,
  Utensils,
  Moon,
  Baby,
  Sparkles,
  Smile,
  MoreHorizontal,
  RefreshCw,
} from "lucide-react";
import { TimePicker } from "@/components/ui/time-picker";

const STORAGE_KEY = "brightsteps_auth";

const ACTIVITY_TYPES = [
  { value: "MEAL", label: "Meal", icon: Utensils },
  { value: "NAP", label: "Nap", icon: Moon },
  { value: "DIAPER", label: "Diaper", icon: Baby },
  { value: "ACTIVITY", label: "Activity", icon: Sparkles },
  { value: "BEHAVIOR", label: "Behavior", icon: Smile },
  { value: "OTHER", label: "Other", icon: MoreHorizontal },
];

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { user } = JSON.parse(raw);
    return user;
  } catch {
    return null;
  }
}

async function getCsrfToken() {
  const res = await fetch("/api/auth/csrf");
  const { csrfToken } = await res.json();
  const cookie = document.cookie
    .split("; ")
    .find((r) => r.startsWith("csrfToken="))
    ?.split("=")[1];
  return csrfToken || cookie || "";
}

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function ActivityLoggingPage() {
  const [user, setUser] = useState(null);
  const [centers, setCenters] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [roster, setRoster] = useState([]);
  const [activities, setActivities] = useState([]);
  const [parentContext, setParentContext] = useState({ children: [], classrooms: [] });
  const [loading, setLoading] = useState(true);
  const [centerFilter, setCenterFilter] = useState("");
  const [classroomFilter, setClassroomFilter] = useState("");
  const [parentChildFilter, setParentChildFilter] = useState("");
  const [parentClassroomFilter, setParentClassroomFilter] = useState("");
  const [form, setForm] = useState({
    childId: "",
    activityType: "MEAL",
    activityTime: "",
    details: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const isParent = user?.role === "PARENT";
  const canLog = user && ["ADMIN", "STAFF"].includes(user.role);

  const fetchActivities = useCallback(() => {
    let url = "/api/activity?";
    if (isParent) {
      url += `userId=${encodeURIComponent(user?.id || "")}`;
      if (parentClassroomFilter) url += `&classroomId=${encodeURIComponent(parentClassroomFilter)}`;
    } else {
      if (classroomFilter) url += `classroomId=${encodeURIComponent(classroomFilter)}`;
    }
    fetch(url)
      .then((r) => r.json())
      .then((data) => setActivities(Array.isArray(data) ? data : []))
      .catch(() => setActivities([]));
  }, [isParent, user?.id, classroomFilter, parentClassroomFilter]);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    if (isParent) {
      fetch(`/api/activity/context?userId=${encodeURIComponent(user.id)}`)
        .then((r) => r.json())
        .then((data) => {
          setParentContext({
            children: data.children || [],
            classrooms: data.classrooms || [],
          });
        })
        .catch(() => setParentContext({ children: [], classrooms: [] }))
        .finally(() => setLoading(false));
    } else {
      fetch("/api/centers")
        .then((r) => r.json())
        .then((data) => {
          setCenters(Array.isArray(data) ? data : []);
          if (data?.length && !centerFilter) setCenterFilter(data[0]?.id || "");
        })
        .catch(() => setCenters([]))
        .finally(() => setLoading(false));
    }
  }, [user, isParent]);

  useEffect(() => {
    if (!centerFilter) {
      setClassrooms([]);
      setClassroomFilter("");
      return;
    }
    fetch(`/api/classrooms?centerId=${encodeURIComponent(centerFilter)}`)
      .then((r) => r.json())
      .then((data) => {
        setClassrooms(Array.isArray(data) ? data : []);
        setClassroomFilter("");
      })
      .catch(() => setClassrooms([]));
  }, [centerFilter]);

  useEffect(() => {
    if (!classroomFilter) {
      setRoster([]);
      setForm((p) => ({ ...p, childId: "" }));
      return;
    }
    fetch(`/api/classrooms/${classroomFilter}/roster`)
      .then((r) => r.json())
      .then((data) => setRoster(Array.isArray(data) ? data : []))
      .catch(() => setRoster([]));
  }, [classroomFilter]);

  useEffect(() => {
    if (user && (classroomFilter || (isParent && parentContext.children?.length))) {
      fetchActivities();
    }
  }, [user, classroomFilter, isParent, parentContext.children, fetchActivities]);

  const pollInterval = 15000;
  useEffect(() => {
    if (!user || (!classroomFilter && !isParent)) return;
    const id = setInterval(fetchActivities, pollInterval);
    return () => clearInterval(id);
  }, [user, classroomFilter, isParent, fetchActivities]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canLog || !form.childId || !form.activityType || submitting) return;
    setSubmitting(true);
    setSubmitError("");
    setSubmitSuccess(false);
    try {
      const csrf = await getCsrfToken();
      const res = await fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({
          childId: form.childId,
          activityType: form.activityType,
          details: form.details?.trim() ? { notes: form.details.trim() } : {},
          loggedByUserId: user.id,
          loggedAt: form.activityTime
            ? (() => {
                const [h, m] = form.activityTime.split(":").map(Number);
                const d = new Date();
                d.setHours(h, m, 0, 0);
                return d.toISOString();
              })()
            : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(data?.error?.message || "Failed to log activity.");
        return;
      }
      setSubmitSuccess(true);
      setForm((p) => ({ ...p, details: "" }));
      fetchActivities();
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch {
      setSubmitError("Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredActivities = activities.filter((a) => {
    if (!isParent || !parentChildFilter) return true;
    return a.childId === parentChildFilter;
  });

  if (!user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#6b4e3d]">
          Daily Activity Logging
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {isParent ? "Your children's activities" : "Activity logs"}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {isParent
            ? "View real-time updates on your children's activities in class."
            : "Log meals, naps, diaper changes, and activities for children."}
        </p>
      </div>

      {canLog && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="size-5" />
              Log activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {submitError && (
                <Alert variant="destructive">
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              )}
              {submitSuccess && (
                <Alert>
                  <AlertDescription>Activity logged successfully.</AlertDescription>
                </Alert>
              )}
              <div className="grid gap-4 grid-cols-5">
                <div className="grid gap-2 min-w-0">
                  <Label>Center</Label>
                  <Select value={centerFilter} onValueChange={setCenterFilter}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select center" />
                    </SelectTrigger>
                    <SelectContent>
                      {centers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2 min-w-0">
                  <Label>Classroom</Label>
                  <Select value={classroomFilter} onValueChange={setClassroomFilter}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select classroom" />
                    </SelectTrigger>
                    <SelectContent>
                      {classrooms.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2 min-w-0">
                  <Label>Child</Label>
                  <Select
                    value={form.childId}
                    onValueChange={(v) => setForm((p) => ({ ...p, childId: v }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select child" />
                    </SelectTrigger>
                    <SelectContent>
                      {roster.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.first_name} {c.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2 min-w-0">
                  <Label>Activity type</Label>
                  <Select
                    value={form.activityType}
                    onValueChange={(v) => setForm((p) => ({ ...p, activityType: v }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIVITY_TYPES.map((t) => {
                        const Icon = t.icon;
                        return (
                          <SelectItem key={t.value} value={t.value}>
                            <span className="flex items-center gap-2">
                              <Icon className="size-4" />
                              {t.label}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2 min-w-0">
                  <Label>Activity time</Label>
                  <TimePicker
                    value={form.activityTime}
                    onChange={(v) => setForm((p) => ({ ...p, activityTime: v || "" }))}
                    placeholder="Pick a time"
                    buttonClassName="w-full"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Details (optional)</Label>
                <Textarea
                  value={form.details}
                  onChange={(e) => setForm((p) => ({ ...p, details: e.target.value }))}
                  placeholder="e.g. Ate 80% of lunch, fell asleep at 1pm..."
                  rows={2}
                />
              </div>
              <Button type="submit" disabled={submitting || !form.childId}>
                {submitting ? "Logging…" : "Log activity"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Activity feed</CardTitle>
          {isParent && (
            <div className="flex items-center gap-2">
              {parentContext.children?.length > 1 && (
                <Select
                  value={parentChildFilter}
                  onValueChange={setParentChildFilter}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All children" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All children</SelectItem>
                    {parentContext.children.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.firstName} {c.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {parentContext.classrooms?.length > 1 && (
                <Select
                  value={parentClassroomFilter}
                  onValueChange={setParentClassroomFilter}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All classes</SelectItem>
                    {parentContext.classrooms.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={fetchActivities}>
            <RefreshCw className="mr-1.5 size-4" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : filteredActivities.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No activities yet.
              {isParent
                ? " Activities will appear here when staff log them."
                : " Select a classroom and log an activity."}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredActivities.map((log) => {
                const typeConfig = ACTIVITY_TYPES.find((t) => t.value === log.activityType);
                const Icon = typeConfig?.icon || MoreHorizontal;
                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 px-4 py-3"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        <span className="text-foreground">{log.childName}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          — {typeConfig?.label || log.activityType}
                        </span>
                      </p>
                      {log.details?.notes && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {log.details.notes}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatTime(log.loggedAt)} • {formatDate(log.loggedAt)} • by{" "}
                        {log.loggedByName}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
