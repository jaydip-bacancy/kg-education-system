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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ChevronDown, ChevronRight, UserPlus, Users, Pencil, Trash2 } from "lucide-react";

const STORAGE_KEY = "brightsteps_auth";

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

export default function StaffManagementPage() {
  const [staff, setStaff] = useState([]);
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [centerFilter, setCenterFilter] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    roleTitle: "",
    centerIds: [],
    status: "ACTIVE",
  });
  const [addErrors, setAddErrors] = useState({});
  const [addLoading, setAddLoading] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);
  const [editStaff, setEditStaff] = useState(null);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    roleTitle: "",
    centerIds: [],
    status: "ACTIVE",
  });
  const [editErrors, setEditErrors] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [user, setUser] = useState(null);

  const canManage = user && user.role === "ADMIN";

  const fetchStaff = () => {
    const url = centerFilter
      ? `/api/staff?centerId=${encodeURIComponent(centerFilter)}`
      : "/api/staff";
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setStaff(data);
        else setStaff([]);
      })
      .catch(() => setStaff([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchStaff();
  }, [centerFilter]);

  useEffect(() => {
    fetch("/api/centers")
      .then((r) => r.json())
      .then((data) => setCenters(Array.isArray(data) ? data : []))
      .catch(() => setCenters([]));
  }, []);

  const updateAddField = (field, value) =>
    setAddForm((prev) => ({ ...prev, [field]: value }));

  const toggleAddCenter = (centerId) => {
    setAddForm((prev) => {
      const ids = prev.centerIds.includes(centerId)
        ? prev.centerIds.filter((id) => id !== centerId)
        : [...prev.centerIds, centerId];
      return { ...prev, centerIds: ids };
    });
  };

  const updateEditField = (field, value) =>
    setEditForm((prev) => ({ ...prev, [field]: value }));

  const toggleEditCenter = (centerId) => {
    setEditForm((prev) => {
      const ids = prev.centerIds.includes(centerId)
        ? prev.centerIds.filter((id) => id !== centerId)
        : [...prev.centerIds, centerId];
      return { ...prev, centerIds: ids };
    });
  };

  const validateAdd = () => {
    const next = {};
    if (!addForm.firstName?.trim()) next.firstName = "First name is required.";
    if (!addForm.lastName?.trim()) next.lastName = "Last name is required.";
    if (!addForm.email?.trim()) next.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addForm.email.trim()))
      next.email = "Enter a valid email.";
    if (!addForm.password || addForm.password.length < 8)
      next.password = "Password must be at least 8 characters.";
    if (!addForm.roleTitle?.trim()) next.roleTitle = "Role/title is required.";
    if (!addForm.centerIds?.length) next.centerIds = "Select at least one center.";
    setAddErrors(next);
    return Object.keys(next).length === 0;
  };

  const validateEdit = () => {
    const next = {};
    if (!editForm.firstName?.trim()) next.firstName = "First name is required.";
    if (!editForm.lastName?.trim()) next.lastName = "Last name is required.";
    if (!editForm.roleTitle?.trim()) next.roleTitle = "Role/title is required.";
    if (!editForm.centerIds?.length) next.centerIds = "Select at least one center.";
    setEditErrors(next);
    return Object.keys(next).length === 0;
  };

  const resetAddForm = () => {
    setAddForm({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      phone: "",
      roleTitle: "",
      centerIds: [],
      status: "ACTIVE",
    });
    setAddErrors({});
    setAddSuccess(false);
  };

  const openEditDialog = (s) => {
    setEditStaff(s);
    setEditForm({
      firstName: s.firstName || "",
      lastName: s.lastName || "",
      phone: s.phone || "",
      roleTitle: s.roleTitle || "",
      centerIds: (s.centers || []).map((c) => c.id),
      status: s.status || "ACTIVE",
    });
    setEditErrors({});
  };

  const closeEditDialog = () => {
    setEditStaff(null);
    setEditForm({
      firstName: "",
      lastName: "",
      phone: "",
      roleTitle: "",
      centerIds: [],
      status: "ACTIVE",
    });
    setEditErrors({});
  };

  const getCsrfToken = async () => {
    const res = await fetch("/api/auth/csrf");
    const { csrfToken } = await res.json();
    const cookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith("csrfToken="))
      ?.split("=")[1];
    return csrfToken || cookie || "";
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!validateAdd() || addLoading) return;
    setAddLoading(true);
    setAddErrors({});
    try {
      const token = await getCsrfToken();
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": token,
        },
        body: JSON.stringify({
          firstName: addForm.firstName.trim(),
          lastName: addForm.lastName.trim(),
          email: addForm.email.trim(),
          password: addForm.password,
          phone: addForm.phone?.trim() || undefined,
          roleTitle: addForm.roleTitle.trim(),
          centerIds: addForm.centerIds,
          status: addForm.status,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAddErrors({ form: data?.error?.message || "Failed to add staff." });
        return;
      }
      setAddSuccess(true);
      resetAddForm();
      fetchStaff();
      setTimeout(() => setShowAddForm(false), 1500);
    } catch {
      setAddErrors({ form: "Something went wrong." });
    } finally {
      setAddLoading(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editStaff || !validateEdit() || editLoading) return;
    setEditLoading(true);
    setEditErrors({});
    try {
      const token = await getCsrfToken();
      const res = await fetch(`/api/staff/${editStaff.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": token,
        },
        body: JSON.stringify({
          firstName: editForm.firstName.trim(),
          lastName: editForm.lastName.trim(),
          phone: editForm.phone?.trim() || undefined,
          roleTitle: editForm.roleTitle.trim(),
          centerIds: editForm.centerIds,
          status: editForm.status,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEditErrors({ form: data?.error?.message || "Failed to update staff." });
        return;
      }
      closeEditDialog();
      fetchStaff();
    } catch {
      setEditErrors({ form: "Something went wrong." });
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId || deleteLoading) return;
    setDeleteLoading(true);
    try {
      const token = await getCsrfToken();
      const res = await fetch(`/api/staff/${deleteConfirmId}`, {
        method: "DELETE",
        headers: { "x-csrf-token": token },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error?.message || "Failed to delete staff.");
        return;
      }
      setDeleteConfirmId(null);
      fetchStaff();
    } catch {
      alert("Something went wrong.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const statusBadge = (status) => {
    const variants = {
      ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
      INACTIVE: "bg-muted text-muted-foreground",
    };
    return (
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[status] || variants.INACTIVE}`}
      >
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Staff Management
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage staff members, assign centers, and control access.
          </p>
        </div>
        {canManage && (
          <Button
            type="button"
            onClick={() => {
              setShowAddForm((v) => !v);
              if (showAddForm) resetAddForm();
            }}
            className="shrink-0"
          >
            <UserPlus className="mr-2 size-4" />
            {showAddForm ? "Cancel" : "Add staff"}
          </Button>
        )}
      </div>

      {showAddForm && canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Add new staff member</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              {addErrors.form && (
                <Alert variant="destructive">
                  <AlertDescription>{addErrors.form}</AlertDescription>
                </Alert>
              )}
              {addSuccess && (
                <Alert>
                  <AlertDescription>Staff added successfully.</AlertDescription>
                </Alert>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>First name</Label>
                  <Input
                    value={addForm.firstName}
                    onChange={(e) => updateAddField("firstName", e.target.value)}
                    aria-invalid={Boolean(addErrors.firstName)}
                  />
                  {addErrors.firstName && (
                    <p className="text-xs text-destructive">{addErrors.firstName}</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label>Last name</Label>
                  <Input
                    value={addForm.lastName}
                    onChange={(e) => updateAddField("lastName", e.target.value)}
                    aria-invalid={Boolean(addErrors.lastName)}
                  />
                  {addErrors.lastName && (
                    <p className="text-xs text-destructive">{addErrors.lastName}</p>
                  )}
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => updateAddField("email", e.target.value)}
                  aria-invalid={Boolean(addErrors.email)}
                />
                {addErrors.email && (
                  <p className="text-xs text-destructive">{addErrors.email}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label>Initial password (min 8 characters)</Label>
                <Input
                  type="password"
                  value={addForm.password}
                  onChange={(e) => updateAddField("password", e.target.value)}
                  aria-invalid={Boolean(addErrors.password)}
                />
                {addErrors.password && (
                  <p className="text-xs text-destructive">{addErrors.password}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label>Phone (optional)</Label>
                <Input
                  type="tel"
                  value={addForm.phone}
                  onChange={(e) => updateAddField("phone", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Role / Title</Label>
                <Input
                  value={addForm.roleTitle}
                  onChange={(e) => updateAddField("roleTitle", e.target.value)}
                  placeholder="e.g. Lead Teacher, Director"
                  aria-invalid={Boolean(addErrors.roleTitle)}
                />
                {addErrors.roleTitle && (
                  <p className="text-xs text-destructive">{addErrors.roleTitle}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={addForm.status}
                  onValueChange={(v) => updateAddField("status", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Centers</Label>
                {addErrors.centerIds && (
                  <p className="text-xs text-destructive">{addErrors.centerIds}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {centers.map((c) => (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={addForm.centerIds.includes(c.id)}
                        onChange={() => toggleAddCenter(c.id)}
                        className="rounded"
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={addLoading}>
                  {addLoading ? "Adding…" : "Add staff"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    resetAddForm();
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-4">
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
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : staff.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="mb-3 size-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              No staff yet. Add staff members to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {staff.map((s) => (
            <Card key={s.id}>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {s.firstName} {s.lastName}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {s.email}
                    {s.phone && ` • ${s.phone}`}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                      {s.roleTitle}
                    </span>
                    {statusBadge(s.status)}
                    {(s.centers || []).map((c) => (
                      <span
                        key={c.id}
                        className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                      >
                        {c.name}
                      </span>
                    ))}
                  </div>
                </div>
                {canManage && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => openEditDialog(s)}
                      aria-label="Edit staff"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteConfirmId(s.id)}
                      aria-label="Delete staff"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editStaff} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit staff member</DialogTitle>
          </DialogHeader>
          {editStaff && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              {editErrors.form && (
                <Alert variant="destructive">
                  <AlertDescription>{editErrors.form}</AlertDescription>
                </Alert>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>First name</Label>
                  <Input
                    value={editForm.firstName}
                    onChange={(e) =>
                      updateEditField("firstName", e.target.value)
                    }
                    aria-invalid={Boolean(editErrors.firstName)}
                  />
                  {editErrors.firstName && (
                    <p className="text-xs text-destructive">
                      {editErrors.firstName}
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label>Last name</Label>
                  <Input
                    value={editForm.lastName}
                    onChange={(e) =>
                      updateEditField("lastName", e.target.value)
                    }
                    aria-invalid={Boolean(editErrors.lastName)}
                  />
                  {editErrors.lastName && (
                    <p className="text-xs text-destructive">
                      {editErrors.lastName}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Email (read-only)</Label>
                <Input
                  value={editStaff.email}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="grid gap-2">
                <Label>Phone (optional)</Label>
                <Input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) =>
                    updateEditField("phone", e.target.value)
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Role / Title</Label>
                <Input
                  value={editForm.roleTitle}
                  onChange={(e) =>
                    updateEditField("roleTitle", e.target.value)
                  }
                  aria-invalid={Boolean(editErrors.roleTitle)}
                />
                {editErrors.roleTitle && (
                  <p className="text-xs text-destructive">
                    {editErrors.roleTitle}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(v) => updateEditField("status", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Centers</Label>
                {editErrors.centerIds && (
                  <p className="text-xs text-destructive">
                    {editErrors.centerIds}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {centers.map((c) => (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={editForm.centerIds.includes(c.id)}
                        onChange={() => toggleEditCenter(c.id)}
                        className="rounded"
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={editLoading}>
                  {editLoading ? "Saving…" : "Save changes"}
                </Button>
                <Button type="button" variant="outline" onClick={closeEditDialog}>
                  Cancel
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete staff member</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this staff member? This will remove
            their account and all center assignments. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? "Deleting…" : "Delete staff"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
