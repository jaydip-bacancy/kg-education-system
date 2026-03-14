"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Baby,
  LogIn,
  LogOut,
  GraduationCap,
  Users,
  UserPlus,
} from "lucide-react";

const STORAGE_KEY = "brightsteps_auth";

function formatTimeForInput(value) {
  if (!value) return "";
  const s = String(value);
  return s.length >= 5 ? s.slice(0, 5) : s;
}

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

export default function ClassesPage() {
  const [classrooms, setClassrooms] = useState([]);
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [centerFilter, setCenterFilter] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [classroomDetail, setClassroomDetail] = useState(null);
  const [addForm, setAddForm] = useState({ name: "", centerId: "", capacity: 20, startTime: "", endTime: "" });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", capacity: 20, startTime: "", endTime: "" });
  const [addErrors, setAddErrors] = useState({});
  const [addLoading, setAddLoading] = useState(false);
  const [error, setError] = useState(null);
  const [assignChildrenClassroomId, setAssignChildrenClassroomId] = useState(null);
  const [checkinDetails, setCheckinDetails] = useState([]);

  const currentUser = getStoredUser();
  const userId = currentUser?.id;

  const fetchClassrooms = () => {
    const url = centerFilter
      ? `/api/classrooms?centerId=${encodeURIComponent(centerFilter)}`
      : "/api/classrooms";
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setClassrooms(data);
        else setClassrooms([]);
      })
      .catch(() => setClassrooms([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchClassrooms();
  }, [centerFilter]);

  useEffect(() => {
    fetch("/api/centers")
      .then((r) => r.json())
      .then((data) => setCenters(Array.isArray(data) ? data : []))
      .catch(() => setCenters([]));
  }, []);

  const fetchClassroomDetail = async (id) => {
    const [detailRes, rosterRes, staffRes] = await Promise.all([
      fetch(`/api/classrooms/${id}`),
      fetch(`/api/classrooms/${id}/roster`),
      fetch(`/api/classrooms/${id}/staff`),
    ]);
    const detail = await detailRes.json();
    const roster = await rosterRes.json();
    const staff = await staffRes.json();
    setClassroomDetail({
      ...detail,
      roster: Array.isArray(roster) ? roster : [],
      staff: Array.isArray(staff) ? staff : [],
    });
  };

  const fetchCheckinDetails = async () => {
    const results = await Promise.all(
      classrooms.map(async (c) => {
        const [rosterRes, attendanceRes] = await Promise.all([
          fetch(`/api/classrooms/${c.id}/roster`),
          fetch(`/api/classrooms/${c.id}/attendance`),
        ]);
        const rosterData = await rosterRes.json();
        const attendanceData = await attendanceRes.json();
        const roster = Array.isArray(rosterData) ? rosterData : [];
        const attendance = Array.isArray(attendanceData) ? attendanceData : [];
        return { ...c, roster, attendance };
      })
    );
    setCheckinDetails(results);
  };

  useEffect(() => {
    if (classrooms.length > 0) {
      fetchCheckinDetails();
    } else {
      setCheckinDetails([]);
    }
  }, [classrooms, centerFilter]);

  const toggleExpand = (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      setClassroomDetail(null);
      return;
    }
    setExpandedId(id);
    setError(null);
    fetchClassroomDetail(id);
  };

  const handleAddClassroom = async (e) => {
    e.preventDefault();
    setAddErrors({});
    if (!addForm.name?.trim()) {
      setAddErrors({ name: "Name is required" });
      return;
    }
    if (!addForm.centerId) {
      setAddErrors({ centerId: "Select a center" });
      return;
    }
    setAddLoading(true);
    try {
      const token = await getCsrfToken();
      const res = await fetch("/api/classrooms", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": token },
        body: JSON.stringify({
          centerId: addForm.centerId,
          name: addForm.name.trim(),
          capacity: addForm.capacity || 20,
          startTime: addForm.startTime || undefined,
          endTime: addForm.endTime || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAddErrors({ form: data?.error?.message || "Failed to create" });
        return;
      }
      setShowAddForm(false);
      setAddForm({ name: "", centerId: "", capacity: 20, startTime: "", endTime: "" });
      fetchClassrooms();
    } catch {
      setAddErrors({ form: "Something went wrong" });
    } finally {
      setAddLoading(false);
    }
  };

  const handleUpdateClassroom = async (id) => {
    if (!editForm.name?.trim()) return;
    try {
      const token = await getCsrfToken();
      const res = await fetch(`/api/classrooms/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-csrf-token": token },
        body: JSON.stringify({
        name: editForm.name,
        capacity: editForm.capacity,
        startTime: editForm.startTime || null,
        endTime: editForm.endTime || null,
      }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d?.error?.message || "Update failed");
        return;
      }
      setEditingId(null);
      if (expandedId === id) fetchClassroomDetail(id);
      fetchClassrooms();
    } catch {
      setError("Update failed");
    }
  };

  const handleDeleteClassroom = async (id) => {
    if (!confirm("Delete this classroom? This will remove roster and staff assignments.")) return;
    try {
      const token = await getCsrfToken();
      const res = await fetch(`/api/classrooms/${id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": token },
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d?.error?.message || "Delete failed");
        return;
      }
      if (expandedId === id) {
        setExpandedId(null);
        setClassroomDetail(null);
      }
      fetchClassrooms();
    } catch {
      setError("Delete failed");
    }
  };

  const handleAssignChild = async (classroomId, childId) => {
    try {
      const token = await getCsrfToken();
      const res = await fetch(`/api/classrooms/${classroomId}/roster`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": token },
        body: JSON.stringify({ childId }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d?.error?.message || "Assign failed");
        return;
      }
      setError(null);
      fetchClassroomDetail(classroomId);
      fetchClassrooms();
    } catch {
      setError("Assign failed");
    }
  };

  const handleUnassignChild = async (classroomId, childId) => {
    try {
      const token = await getCsrfToken();
      const res = await fetch(`/api/classrooms/${classroomId}/roster?childId=${childId}`, {
        method: "DELETE",
        headers: { "x-csrf-token": token },
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d?.error?.message || "Unassign failed");
        return;
      }
      setError(null);
      fetchClassroomDetail(classroomId);
      fetchClassrooms();
    } catch {
      setError("Unassign failed");
    }
  };

  const handleAssignStaff = async (classroomId, staffProfileId) => {
    try {
      const token = await getCsrfToken();
      const res = await fetch(`/api/classrooms/${classroomId}/staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": token },
        body: JSON.stringify({ staffProfileId }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d?.error?.message || "Assign failed");
        return;
      }
      setError(null);
      fetchClassroomDetail(classroomId);
    } catch {
      setError("Assign failed");
    }
  };

  const handleUnassignStaff = async (classroomId, staffProfileId) => {
    try {
      const token = await getCsrfToken();
      const res = await fetch(`/api/classrooms/${classroomId}/staff?staffProfileId=${staffProfileId}`, {
        method: "DELETE",
        headers: { "x-csrf-token": token },
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d?.error?.message || "Unassign failed");
        return;
      }
      setError(null);
      fetchClassroomDetail(classroomId);
    } catch {
      setError("Unassign failed");
    }
  };

  const handleCheckIn = async (classroomId, childId) => {
    if (!userId) {
      setError("You must be logged in to check in children");
      return;
    }
    try {
      const token = await getCsrfToken();
      const res = await fetch(`/api/classrooms/${classroomId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": token },
        body: JSON.stringify({ childId, checkedInBy: userId }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d?.error?.message || "Check-in failed");
        return;
      }
      setError(null);
      fetchCheckinDetails();
    } catch {
      setError("Check-in failed");
    }
  };

  const handleCheckOut = async (classroomId, attendanceId) => {
    if (!userId) {
      setError("You must be logged in to check out children");
      return;
    }
    try {
      const token = await getCsrfToken();
      const res = await fetch(`/api/classrooms/${classroomId}/attendance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-csrf-token": token },
        body: JSON.stringify({ attendanceId, checkedOutBy: userId }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d?.error?.message || "Check-out failed");
        return;
      }
      setError(null);
      fetchCheckinDetails();
    } catch {
      setError("Check-out failed");
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Classes</h1>
        <p className="mt-1 text-muted-foreground">
          Manage classrooms, assign children and staff, and handle check-in/check-out.
        </p>
      </div>

      <Tabs defaultValue="classes" className="w-full space-y-4">
        <TabsList className="p-1.5">
          <TabsTrigger value="classes" className="px-5 py-3 data-[state=active]:bg-black data-[state=active]:text-white">Classes</TabsTrigger>
          <TabsTrigger value="checkin" className="px-5 py-3 data-[state=active]:bg-black data-[state=active]:text-white">Check-in / Check-out</TabsTrigger>
        </TabsList>

        <TabsContent value="classes" className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-48 shrink-0">
              <Select
                value={centerFilter || "__all__"}
                onValueChange={(v) => setCenterFilter(v === "__all__" ? "" : v)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All centers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All centers</SelectItem>
                  {centers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => { setShowAddForm((v) => !v); setAddErrors({}); }}>
              <Plus className="mr-2 size-4" />
              {showAddForm ? "Cancel" : "Add class"}
            </Button>
          </div>

          {showAddForm && (
            <Card>
              <CardHeader><CardTitle>Add classroom</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleAddClassroom} className="flex flex-wrap items-start gap-4">
                  {addErrors.form && (
                    <Alert variant="destructive" className="w-full">
                      <AlertDescription>{addErrors.form}</AlertDescription>
                    </Alert>
                  )}
                  <div className="grid gap-2">
                    <Label>Name</Label>
                    <Input
                      value={addForm.name}
                      onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Toddler Room A"
                      className="h-10 w-48"
                      aria-invalid={Boolean(addErrors.name)}
                    />
                    {addErrors.name && <p className="text-xs text-destructive">{addErrors.name}</p>}
                  </div>
                  <div className="grid gap-2">
                    <Label>Center</Label>
                    <Select
                      value={addForm.centerId}
                      onValueChange={(v) => setAddForm((p) => ({ ...p, centerId: v }))}
                    >
                      <SelectTrigger className="h-10 w-48" aria-invalid={Boolean(addErrors.centerId)}>
                        <SelectValue placeholder="Select center" />
                      </SelectTrigger>
                      <SelectContent>
                        {centers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {addErrors.centerId && <p className="text-xs text-destructive">{addErrors.centerId}</p>}
                  </div>
                  <div className="grid gap-2">
                    <Label>Capacity</Label>
                    <Input
                      type="number"
                      min={1}
                      value={addForm.capacity}
                      onChange={(e) => setAddForm((p) => ({ ...p, capacity: parseInt(e.target.value, 10) || 20 }))}
                      className="h-10 w-24"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Start time</Label>
                    <Input
                      type="time"
                      value={addForm.startTime}
                      onChange={(e) => setAddForm((p) => ({ ...p, startTime: e.target.value }))}
                      className="h-10 w-32"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>End time</Label>
                    <Input
                      type="time"
                      value={addForm.endTime}
                      onChange={(e) => setAddForm((p) => ({ ...p, endTime: e.target.value }))}
                      className="h-10 w-32"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label className="invisible select-none">Create</Label>
                    <Button type="submit" disabled={addLoading} className="h-10">
                      {addLoading ? "Creating…" : "Create"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : classrooms.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <GraduationCap className="mb-3 size-10 text-muted-foreground" />
                <p className="text-muted-foreground">No classrooms yet. Add one to get started.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {classrooms.map((c) => (
                <Card key={c.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
                    onClick={() => toggleExpand(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleExpand(c.id);
                      }
                    }}
                  >
                    {expandedId === c.id ? (
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      {editingId === c.id ? (
                        <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Input
                            value={editForm.name}
                            onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                            className="h-8 w-48"
                          />
                          <Input
                            type="number"
                            min={1}
                            value={editForm.capacity}
                            onChange={(e) => setEditForm((p) => ({ ...p, capacity: parseInt(e.target.value, 10) || 20 }))}
                            className="h-8 w-20"
                          />
                          <Input
                            type="time"
                            value={editForm.startTime}
                            onChange={(e) => setEditForm((p) => ({ ...p, startTime: e.target.value }))}
                            className="h-8 w-24"
                          />
                          <Input
                            type="time"
                            value={editForm.endTime}
                            onChange={(e) => setEditForm((p) => ({ ...p, endTime: e.target.value }))}
                            className="h-8 w-24"
                          />
                          <Button size="sm" onClick={() => handleUpdateClassroom(c.id)}>Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <p className="font-medium">{c.name}</p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        Capacity: {c.capacity ?? 20} · Assigned: {c.rosterCount ?? 0}
                        {(c.start_time || c.end_time) && (
                          <> · {formatTimeForInput(c.start_time) || "—"} – {formatTimeForInput(c.end_time) || "—"}</>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
                      {editingId !== c.id && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => { setEditingId(c.id); setEditForm({ name: c.name, capacity: c.capacity ?? 20, startTime: formatTimeForInput(c.start_time), endTime: formatTimeForInput(c.end_time) }); }}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteClassroom(c.id)}>
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {expandedId === c.id && classroomDetail?.id === c.id && (
                    <CardContent className="border-t pt-4">
                      <ClassroomManagementDetail
                        classroom={classroomDetail}
                        onAssignChildrenClick={() => setAssignChildrenClassroomId(c.id)}
                        onUnassignChild={(childId) => handleUnassignChild(c.id, childId)}
                        onAssignStaff={(staffProfileId) => handleAssignStaff(c.id, staffProfileId)}
                        onUnassignStaff={(staffProfileId) => handleUnassignStaff(c.id, staffProfileId)}
                        onRefresh={() => fetchClassroomDetail(c.id)}
                      />
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="checkin" className="space-y-6">
          <div className="w-48">
             <Select
                value={centerFilter || "__all__"}
                onValueChange={(v) => setCenterFilter(v === "__all__" ? "" : v)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All centers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All centers</SelectItem>
                  {centers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
          </div>
          <CheckinView
            details={checkinDetails}
            onCheckIn={handleCheckIn}
            onCheckOut={handleCheckOut}
            userId={userId}
          />
        </TabsContent>
      </Tabs>

      <AssignChildrenDialog
        open={!!assignChildrenClassroomId}
        onOpenChange={(open) => !open && setAssignChildrenClassroomId(null)}
        classroomId={assignChildrenClassroomId}
        classroomName={classrooms.find((c) => c.id === assignChildrenClassroomId)?.name}
        onAssign={handleAssignChild}
        onClose={() => {
          const id = assignChildrenClassroomId;
          setAssignChildrenClassroomId(null);
          if (id && expandedId === id) fetchClassroomDetail(id);
          fetchClassrooms();
        }}
      />
    </div>
  );
}

function ClassroomManagementDetail({
  classroom,
  onAssignChildrenClick,
  onUnassignChild,
  onAssignStaff,
  onUnassignStaff,
  onRefresh,
}) {
  const [available, setAvailable] = useState({ staff: [] });
  const [assignStaffId, setAssignStaffId] = useState("");

  useEffect(() => {
    fetch(`/api/classrooms/${classroom.id}/available?type=staff`)
      .then((r) => r.json())
      .then((data) => setAvailable({ staff: data.staff || [] }))
      .catch(() => setAvailable({ staff: [] }));
  }, [classroom.id, classroom.staff?.length]);

  const doAssignStaff = () => {
    if (assignStaffId) {
      onAssignStaff(assignStaffId);
      setAssignStaffId("");
    }
  };

  const sectionCardClass = "flex min-h-[160px] flex-col rounded-lg border bg-muted/20 p-4";

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className={sectionCardClass}>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-medium flex items-center gap-2">
            <Baby className="size-4 shrink-0" /> Children ({classroom.roster?.length ?? 0})
          </h3>
          <Button size="sm" onClick={onAssignChildrenClick}>
            <UserPlus className="mr-1 size-4" /> Assign children
          </Button>
        </div>
        <ul className="flex-1 space-y-2 overflow-auto">
          {(classroom.roster || []).map((ch) => (
            <li key={ch.id} className="flex items-center justify-between rounded-md border border-border/60 bg-background px-3 py-2 text-sm">
              <span>{ch.first_name} {ch.last_name}</span>
              <Button size="sm" variant="ghost" className="h-7 text-destructive hover:text-destructive" onClick={() => onUnassignChild(ch.id)}>
                Remove
              </Button>
            </li>
          ))}
          {(classroom.roster || []).length === 0 && (
            <li className="flex min-h-[80px] items-center justify-center rounded-md border border-dashed border-border/60 py-6 text-sm text-muted-foreground">
              No children assigned
            </li>
          )}
        </ul>
      </div>
      <div className={sectionCardClass}>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-medium flex items-center gap-2">
            <Users className="size-4 shrink-0" /> Staff ({classroom.staff?.length ?? 0})
          </h3>
          <div className="flex shrink-0 gap-2">
            <Select value={assignStaffId || "__none__"} onValueChange={(v) => setAssignStaffId(v === "__none__" ? "" : v)}>
              <SelectTrigger className="h-8 min-w-[140px] sm:w-40">
                <SelectValue placeholder="Select staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select staff</SelectItem>
                {available.staff.map((s) => (
                  <SelectItem key={s.staffProfileId} value={s.staffProfileId}>
                    {s.first_name} {s.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" disabled={!assignStaffId} onClick={doAssignStaff} className="shrink-0">
              Add
            </Button>
          </div>
        </div>
        <ul className="flex-1 space-y-2 overflow-auto">
          {(classroom.staff || []).map((s) => (
            <li key={s.staffProfileId} className="flex items-center justify-between rounded-md border border-border/60 bg-background px-3 py-2 text-sm">
              <span>{s.first_name} {s.last_name}{s.roleTitle ? ` · ${s.roleTitle}` : ""}</span>
              <Button size="sm" variant="ghost" className="h-7 text-destructive hover:text-destructive" onClick={() => onUnassignStaff(s.staffProfileId)}>
                Remove
              </Button>
            </li>
          ))}
          {(classroom.staff || []).length === 0 && (
            <li className="flex min-h-[80px] items-center justify-center rounded-md border border-dashed border-border/60 py-6 text-sm text-muted-foreground">
              No staff assigned
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

function AssignChildrenDialog({
  open,
  onOpenChange,
  classroomId,
  classroomName,
  onAssign,
  onClose,
}) {
  const [available, setAvailable] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && classroomId) {
      fetch(`/api/classrooms/${classroomId}/available?type=children`)
        .then((r) => r.json())
        .then((data) => setAvailable(data.children || []))
        .catch(() => setAvailable([]));
      setSelectedId("");
    }
  }, [open, classroomId]);

  const handleAssign = async () => {
    if (!selectedId || !classroomId) return;
    setLoading(true);
    await onAssign(classroomId, selectedId);
    setSelectedId("");
    setLoading(false);
    setAvailable((prev) => prev.filter((ch) => ch.id !== selectedId));
  };

  const handleClose = () => {
    onClose?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign children to {classroomName || "class"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid gap-2">
            <Label>Available children</Label>
            <Select value={selectedId || "__none__"} onValueChange={(v) => setSelectedId(v === "__none__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a child to assign" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select a child</SelectItem>
                {available.map((ch) => (
                  <SelectItem key={ch.id} value={ch.id}>
                    {ch.first_name} {ch.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {available.length === 0 && (
              <p className="text-sm text-muted-foreground">No more children available to assign.</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Done
          </Button>
          <Button disabled={!selectedId || loading} onClick={handleAssign}>
            {loading ? "Assigning…" : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CheckinView({ details, onCheckIn, onCheckOut, userId }) {
  if (!details.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <LogIn className="mb-3 size-10 text-muted-foreground" />
          <p className="text-muted-foreground">No classrooms to show. Add classes and assign children first.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {details.map((c) => {
        const checkedInIds = new Set(
          (c.attendance || []).filter((a) => !a.checked_out_at).map((a) => a.child_id)
        );
        return (
          <Card key={c.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{c.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {c.roster?.length ?? 0} children assigned
              </p>
            </CardHeader>
            <CardContent>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                {(c.roster || []).map((ch) => {
                  const isCheckedIn = checkedInIds.has(ch.id);
                  const att = (c.attendance || []).find(
                    (a) => a.child_id === ch.id && !a.checked_out_at
                  );
                  return (
                    <li key={ch.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <span>{ch.first_name} {ch.last_name}</span>
                      {isCheckedIn ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7"
                          onClick={() => att && onCheckOut(c.id, att.id)}
                          disabled={!userId}
                        >
                          <LogOut className="mr-1 size-3" /> Check out
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="h-7"
                          onClick={() => onCheckIn(c.id, ch.id)}
                          disabled={!userId}
                        >
                          <LogIn className="mr-1 size-3" /> Check in
                        </Button>
                      )}
                    </li>
                  );
                })}
                {(c.roster || []).length === 0 && (
                  <li className="py-6 text-center text-sm text-muted-foreground">No children assigned</li>
                )}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
