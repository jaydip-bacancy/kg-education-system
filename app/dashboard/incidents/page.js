"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DateTimePicker } from "@/components/ui/date-time-picker";

const STORAGE_KEY = "brightsteps_auth";
const INCIDENT_TYPES = [
  { value: "INJURY", label: "Injury" },
  { value: "ILLNESS", label: "Illness" },
  { value: "BEHAVIOR", label: "Behavior" },
  { value: "PROPERTY", label: "Property damage" },
  { value: "OTHER", label: "Other" },
];
const INCIDENT_LABELS = INCIDENT_TYPES.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

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
    .find((row) => row.startsWith("csrfToken="))
    ?.split("=")[1];
  return csrfToken || cookie || "";
}

export default function IncidentsPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassroom, setSelectedClassroom] = useState("");
  const [checkedIn, setCheckedIn] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    childId: "",
    incidentType: "",
    occurredAt: "",
    description: "",
  });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reporterId = currentUser?.id || "";
  const isStaffUser = currentUser?.role === "STAFF";
  const selectedClassroomMeta = classrooms.find((classroom) => classroom.id === selectedClassroom);
  const selectedStudent = checkedIn.find((student) => student.child_id === form.childId);

  const fetchClassrooms = () => {
    setLoading(true);
    fetch("/api/classrooms")
      .then((r) => r.json())
      .then((data) => setClassrooms(Array.isArray(data) ? data : []))
      .catch(() => setClassrooms([]))
      .finally(() => setLoading(false));
  };

  const fetchIncidents = (classroomId = "") => {
    const url = classroomId
      ? `/api/incidents?classroomId=${encodeURIComponent(classroomId)}`
      : "/api/incidents";

    fetch(url)
      .then((r) => r.json())
      .then((data) => setIncidents(Array.isArray(data) ? data : []))
      .catch(() => setIncidents([]));
  };

  const fetchCheckedIn = (classroomId) => {
    if (!classroomId) {
      setCheckedIn([]);
      return;
    }

    fetch(`/api/classrooms/${classroomId}/attendance?activeOnly=1`)
      .then((r) => r.json())
      .then((data) => {
        const rows = Array.isArray(data) ? data : [];
        const active = rows.filter((attendance) => attendance.child);
        setCheckedIn(active);
      })
      .catch(() => setCheckedIn([]));
  };

  useEffect(() => {
    setCurrentUser(getStoredUser());
    setAuthReady(true);
    fetchClassrooms();
    fetchIncidents();
  }, []);

  useEffect(() => {
    fetchCheckedIn(selectedClassroom);
    fetchIncidents(selectedClassroom);
    setForm((prev) => ({ ...prev, childId: "" }));
    setErrors((prev) => ({ ...prev, childId: undefined, classroomId: undefined }));
  }, [selectedClassroom]);

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validate = () => {
    const next = {};
    if (!selectedClassroom) next.classroomId = "Select a classroom.";
    if (!form.childId) next.childId = "Select a checked-in student.";
    if (!form.incidentType?.trim()) next.incidentType = "Type is required.";
    if (!form.description?.trim()) next.description = "Description is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const resetForm = () => {
    setForm({
      childId: "",
      incidentType: "",
      occurredAt: "",
      description: "",
    });
    setErrors({});
    setSubmitError("");
    setSubmitSuccess(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError("");
    setSubmitSuccess(false);

    if (!isStaffUser) {
      setSubmitError("Only staff accounts can file incidents.");
      return;
    }

    if (!validate() || submitting) return;

    setSubmitting(true);
    try {
      const token = await getCsrfToken();
      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": token,
        },
        body: JSON.stringify({
          classroomId: selectedClassroom,
          childId: form.childId,
          incidentType: form.incidentType.trim(),
          occurredAt: form.occurredAt || undefined,
          description: form.description.trim(),
          reportedByUserId: reporterId || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(data?.error?.message || "Failed to file incident.");
        return;
      }
      setSubmitSuccess(true);
      resetForm();
      fetchCheckedIn(selectedClassroom);
      fetchIncidents(selectedClassroom);
    } catch {
      setSubmitError("Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Incident Reporting</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          File incidents for active classroom check-ins and review follow-ups.
        </p>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>File an incident</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit} noValidate>
          <CardContent className="grid gap-4 pt-0">
            <div className="grid gap-3 rounded-[var(--radius)] border border-border/60 bg-muted/30 px-4 py-3 text-sm md:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6b4e3d]">
                  Classroom
                </p>
                <p className="mt-1 font-medium text-foreground">
                  {selectedClassroomMeta?.name || "Choose a class"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6b4e3d]">
                  Active students
                </p>
                <p className="mt-1 font-medium text-foreground">
                  {selectedClassroom ? checkedIn.length : 0}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6b4e3d]">
                  Reporter
                </p>
                <p className="mt-1 font-medium text-foreground">
                  {currentUser?.email || "Loading account..."}
                </p>
              </div>
            </div>

            {submitError && (
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}
            {submitSuccess && (
              <Alert>
                <AlertDescription>Incident filed successfully.</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="grid gap-2 xl:col-span-1">
                <Label>Classroom</Label>
                <Select
                  value={selectedClassroom || "__none__"}
                  onValueChange={(value) =>
                    setSelectedClassroom(value === "__none__" ? "" : value)
                  }
                >
                  <SelectTrigger
                    className="w-full"
                    aria-invalid={Boolean(errors.classroomId)}
                  >
                    <SelectValue placeholder="Select a class" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="__none__">Select a class</SelectItem>
                    {classrooms.map((classroom) => (
                      <SelectItem key={classroom.id} value={classroom.id}>
                        {classroom.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.classroomId && (
                  <p className="text-xs text-destructive">{errors.classroomId}</p>
                )}
              </div>

              <div className="grid gap-2 xl:col-span-1">
                <Label>Checked-in student</Label>
                <Select
                  value={form.childId || "__none__"}
                  onValueChange={(value) =>
                    updateForm("childId", value === "__none__" ? "" : value)
                  }
                  disabled={!selectedClassroom || checkedIn.length === 0}
                >
                  <SelectTrigger
                    className="w-full"
                    aria-invalid={Boolean(errors.childId)}
                  >
                    <SelectValue
                      placeholder={
                        selectedClassroom
                          ? checkedIn.length
                            ? "Select a student"
                            : "No active check-ins"
                          : "Select a class first"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="__none__">Select a student</SelectItem>
                    {checkedIn.map((attendance) => (
                      <SelectItem key={attendance.child_id} value={attendance.child_id}>
                        {attendance.child?.first_name} {attendance.child?.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.childId && (
                  <p className="text-xs text-destructive">{errors.childId}</p>
                )}
              </div>

              <div className="grid gap-2 xl:col-span-1">
                <Label>Incident type</Label>
                <Select
                  value={form.incidentType || "__none__"}
                  onValueChange={(value) =>
                    updateForm("incidentType", value === "__none__" ? "" : value)
                  }
                >
                  <SelectTrigger
                    className="w-full"
                    aria-invalid={Boolean(errors.incidentType)}
                  >
                    <SelectValue placeholder="Select a type" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="__none__">Select a type</SelectItem>
                    {INCIDENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.incidentType && (
                  <p className="text-xs text-destructive">{errors.incidentType}</p>
                )}
              </div>

              <div className="grid gap-2 xl:col-span-1">
                <Label>Occurred at</Label>
                <DateTimePicker
                  value={form.occurredAt}
                  onChange={(value) => updateForm("occurredAt", value)}
                  dateButtonClassName="h-10 w-full justify-between"
                  timeButtonClassName="h-10 w-full justify-between"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Description</Label>
                {selectedStudent?.child && (
                  <span className="text-xs text-muted-foreground">
                    Filing for {selectedStudent.child.first_name} {selectedStudent.child.last_name}
                  </span>
                )}
              </div>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(event) => updateForm("description", event.target.value)}
                aria-invalid={Boolean(errors.description)}
                className="min-h-24"
              />
              {errors.description && (
                <p className="text-xs text-destructive">{errors.description}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" disabled={submitting || (authReady && !isStaffUser)}>
                {submitting ? "Submitting..." : "Submit incident"}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm}>
                Clear
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Recent incidents</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : incidents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No incidents recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {incidents.map((incident) => (
                <div
                  key={incident.id}
                  className="rounded-[var(--radius)] border border-border/60 bg-background px-3 py-3 text-sm"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
                        {(INCIDENT_LABELS[incident.incident_type] || incident.incident_type) ??
                          "Incident"}{" "}
                        | {incident.child?.first_name} {incident.child?.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {incident.classroom?.name || "Unknown class"} | {incident.occurred_at
                          ? new Date(incident.occurred_at).toLocaleString()
                          : "Unknown time"}
                      </p>
                      {incident.reportedBy?.name && (
                        <p className="text-xs text-muted-foreground">
                          Reported by {incident.reportedBy.name}
                        </p>
                      )}
                    </div>
                    {incident.description && (
                      <p className="max-w-xl text-xs leading-5 text-muted-foreground md:max-w-[340px] md:text-right">
                        {incident.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}



