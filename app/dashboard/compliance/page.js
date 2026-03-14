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
import {
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";

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

const RECORD_TYPES = [
  { value: "IMMUNIZATION", label: "Immunization" },
  { value: "BACKGROUND_CHECK", label: "Background check" },
  { value: "LICENSE", label: "License" },
  { value: "OTHER", label: "Other" },
];

const ENTITY_TYPES = [
  { value: "CHILD", label: "Child" },
  { value: "STAFF", label: "Staff" },
  { value: "CENTER", label: "Center" },
];

const STATUSES = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "EXPIRED", label: "Expired" },
  { value: "REJECTED", label: "Rejected" },
];

const statusBadge = (status, isExpired) => {
  const variants = {
    APPROVED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    EXPIRED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    REJECTED: "bg-muted text-muted-foreground",
  };
  const displayStatus = isExpired && status !== "EXPIRED" ? "EXPIRED" : status;
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[displayStatus] || variants.PENDING}`}
    >
      {displayStatus}
    </span>
  );
};

export default function CompliancePage() {
  const [records, setRecords] = useState([]);
  const [centers, setCenters] = useState([]);
  const [entities, setEntities] = useState({ children: [], staff: [], centers: [] });
  const [loading, setLoading] = useState(true);
  const [centerFilter, setCenterFilter] = useState("");
  const [recordTypeFilter, setRecordTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    centerId: "",
    recordType: "IMMUNIZATION",
    entityType: "CHILD",
    entityId: "",
    documentUrl: "",
    expiresAt: "",
    status: "PENDING",
    notes: "",
  });
  const [addErrors, setAddErrors] = useState({});
  const [addLoading, setAddLoading] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [editForm, setEditForm] = useState({
    documentUrl: "",
    expiresAt: "",
    status: "PENDING",
    notes: "",
  });
  const [editErrors, setEditErrors] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [user, setUser] = useState(null);

  const canManage = user && ["ADMIN", "STAFF"].includes(user.role);

  const fetchRecords = () => {
    const params = new URLSearchParams();
    if (centerFilter) params.set("centerId", centerFilter);
    if (recordTypeFilter) params.set("recordType", recordTypeFilter);
    if (statusFilter) params.set("status", statusFilter);
    const url = `/api/compliance${params.toString() ? `?${params}` : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => setRecords(Array.isArray(data) ? data : []))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchRecords();
  }, [centerFilter, recordTypeFilter, statusFilter]);

  useEffect(() => {
    fetch("/api/centers")
      .then((r) => r.json())
      .then((data) => setCenters(Array.isArray(data) ? data : []))
      .catch(() => setCenters([]));
  }, []);

  useEffect(() => {
    if (showAddForm || !!editRecord) {
      const center = showAddForm ? addForm.centerId || centerFilter : centerFilter;
      const url = center
        ? `/api/compliance/entities?centerId=${encodeURIComponent(center)}`
        : "/api/compliance/entities";
      fetch(url)
        .then((r) => r.json())
        .then((data) =>
          setEntities({
            children: data.children || [],
            staff: data.staff || [],
            centers: data.centers || [],
          })
        )
        .catch(() => setEntities({ children: [], staff: [], centers: [] }));
    }
  }, [showAddForm, editRecord, centerFilter, addForm.centerId]);

  const entityOptions = () => {
    if (addForm.entityType === "CHILD") return entities.children;
    if (addForm.entityType === "STAFF") return entities.staff;
    return entities.centers;
  };

  const updateAddField = (field, value) => {
    setAddForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "entityType" || field === "centerId") next.entityId = "";
      return next;
    });
  };

  const updateEditField = (field, value) =>
    setEditForm((prev) => ({ ...prev, [field]: value }));

  const validateAdd = () => {
    const next = {};
    if (!addForm.centerId) next.centerId = "Select a center.";
    if (!addForm.entityId) next.entityId = "Select an entity.";
    if (addForm.documentUrl && !/^https?:\/\//.test(addForm.documentUrl.trim()))
      next.documentUrl = "Enter a valid URL.";
    setAddErrors(next);
    return Object.keys(next).length === 0;
  };

  const validateEdit = () => {
    const next = {};
    if (editForm.documentUrl && !/^https?:\/\//.test(editForm.documentUrl.trim()))
      next.documentUrl = "Enter a valid URL.";
    setEditErrors(next);
    return Object.keys(next).length === 0;
  };

  const resetAddForm = () => {
    setAddForm({
      centerId: centerFilter || "",
      recordType: "IMMUNIZATION",
      entityType: "CHILD",
      entityId: "",
      documentUrl: "",
      expiresAt: "",
      status: "PENDING",
      notes: "",
    });
    setAddErrors({});
  };

  const openEditDialog = (r) => {
    setEditRecord(r);
    setEditForm({
      documentUrl: r.document_url || "",
      expiresAt: r.expires_at ? r.expires_at.slice(0, 10) : "",
      status: r.status,
      notes: r.notes || "",
    });
    setEditErrors({});
  };

  const closeEditDialog = () => {
    setEditRecord(null);
    setEditForm({ documentUrl: "", expiresAt: "", status: "PENDING", notes: "" });
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
      const res = await fetch("/api/compliance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": token,
        },
        body: JSON.stringify({
          centerId: addForm.centerId,
          recordType: addForm.recordType,
          entityType: addForm.entityType,
          entityId: addForm.entityId,
          documentUrl: addForm.documentUrl?.trim() || null,
          expiresAt: addForm.expiresAt || null,
          status: addForm.status,
          notes: addForm.notes?.trim() || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAddErrors({ form: data?.error?.message || "Failed to add record." });
        return;
      }
      resetAddForm();
      fetchRecords();
      setShowAddForm(false);
    } catch {
      setAddErrors({ form: "Something went wrong." });
    } finally {
      setAddLoading(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editRecord || !validateEdit() || editLoading) return;
    setEditLoading(true);
    setEditErrors({});
    try {
      const token = await getCsrfToken();
      const res = await fetch(`/api/compliance/${editRecord.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": token,
        },
        body: JSON.stringify({
          documentUrl: editForm.documentUrl?.trim() || null,
          expiresAt: editForm.expiresAt || null,
          status: editForm.status,
          notes: editForm.notes?.trim() || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEditErrors({ form: data?.error?.message || "Failed to update record." });
        return;
      }
      closeEditDialog();
      fetchRecords();
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
      const res = await fetch(`/api/compliance/${deleteConfirmId}`, {
        method: "DELETE",
        headers: { "x-csrf-token": token },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error?.message || "Failed to delete record.");
        return;
      }
      setDeleteConfirmId(null);
      fetchRecords();
    } catch {
      alert("Something went wrong.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const expiringSoon = records.filter((r) => {
    if (!r.expires_at || r.status === "EXPIRED") return false;
    const exp = new Date(r.expires_at);
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);
    return exp <= in30Days && exp >= new Date();
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Compliance & Documentation
          </h1>
          <p className="mt-1 text-muted-foreground">
            Automated tracking of immunizations, background checks, and licensing
            requirements.
          </p>
        </div>
        {canManage && (
          <Button
            type="button"
            onClick={() => {
              setShowAddForm((v) => !v);
              if (!showAddForm) resetAddForm();
            }}
            className="shrink-0"
          >
            <Plus className="mr-2 size-4" />
            {showAddForm ? "Cancel" : "Add record"}
          </Button>
        )}
      </div>

      {expiringSoon.length > 0 && (
        <Alert variant="default" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            {expiringSoon.length} compliance record(s) expiring in the next 30 days.
          </AlertDescription>
        </Alert>
      )}

      {showAddForm && canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Add compliance record</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              {addErrors.form && (
                <Alert variant="destructive">
                  <AlertDescription>{addErrors.form}</AlertDescription>
                </Alert>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Center</Label>
                  <Select
                    value={addForm.centerId}
                    onValueChange={(v) => updateAddField("centerId", v)}
                  >
                    <SelectTrigger aria-invalid={Boolean(addErrors.centerId)}>
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
                  {addErrors.centerId && (
                    <p className="text-xs text-destructive">{addErrors.centerId}</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label>Record type</Label>
                  <Select
                    value={addForm.recordType}
                    onValueChange={(v) => updateAddField("recordType", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RECORD_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Entity type</Label>
                  <Select
                    value={addForm.entityType}
                    onValueChange={(v) => updateAddField("entityType", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ENTITY_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Entity</Label>
                  <Select
                    value={addForm.entityId}
                    onValueChange={(v) => updateAddField("entityId", v)}
                  >
                    <SelectTrigger aria-invalid={Boolean(addErrors.entityId)}>
                      <SelectValue placeholder={`Select ${addForm.entityType.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {entityOptions().map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {addErrors.entityId && (
                    <p className="text-xs text-destructive">{addErrors.entityId}</p>
                  )}
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Document URL (optional)</Label>
                <Input
                  type="url"
                  value={addForm.documentUrl}
                  onChange={(e) => updateAddField("documentUrl", e.target.value)}
                  placeholder="https://..."
                  aria-invalid={Boolean(addErrors.documentUrl)}
                />
                {addErrors.documentUrl && (
                  <p className="text-xs text-destructive">{addErrors.documentUrl}</p>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Expires at (optional)</Label>
                  <Input
                    type="date"
                    value={addForm.expiresAt}
                    onChange={(e) => updateAddField("expiresAt", e.target.value)}
                  />
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
                      {STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Notes (optional)</Label>
                <Input
                  value={addForm.notes}
                  onChange={(e) => updateAddField("notes", e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={addLoading}>
                  {addLoading ? "Adding…" : "Add record"}
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

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={centerFilter || "__all__"}
          onValueChange={(v) => setCenterFilter(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="w-40">
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
        <Select
          value={recordTypeFilter || "__all__"}
          onValueChange={(v) => setRecordTypeFilter(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All types</SelectItem>
            {RECORD_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter || "__all__"}
          onValueChange={(v) => setStatusFilter(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : records.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ShieldCheck className="mb-3 size-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              No compliance records yet. Add records to track immunizations,
              background checks, and licenses.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {records.map((r) => (
            <Card key={r.id} className={r.isExpired ? "border-amber-500/50" : ""}>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {RECORD_TYPES.find((t) => t.value === r.record_type)?.label ||
                        r.record_type}
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span>{r.entityName}</span>
                    <span className="text-muted-foreground">({r.entity_type})</span>
                    {r.centerName && (
                      <>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-sm text-muted-foreground">
                          {r.centerName}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {statusBadge(r.status, r.isExpired)}
                    {r.expires_at && (
                      <span className="text-sm text-muted-foreground">
                        Expires {new Date(r.expires_at).toLocaleDateString()}
                      </span>
                    )}
                    {r.notes && (
                      <span className="text-sm text-muted-foreground truncate max-w-xs">
                        {r.notes}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {r.document_url && (
                    <a
                      href={r.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Open document"
                    >
                      <ExternalLink className="size-4" />
                    </a>
                  )}
                  {canManage && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => openEditDialog(r)}
                        aria-label="Edit"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirmId(r.id)}
                        aria-label="Delete"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editRecord} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit compliance record</DialogTitle>
          </DialogHeader>
          {editRecord && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              {editErrors.form && (
                <Alert variant="destructive">
                  <AlertDescription>{editErrors.form}</AlertDescription>
                </Alert>
              )}
              <p className="text-sm text-muted-foreground">
                {RECORD_TYPES.find((t) => t.value === editRecord.record_type)?.label} for{" "}
                {editRecord.entityName}
              </p>
              <div className="grid gap-2">
                <Label>Document URL (optional)</Label>
                <Input
                  type="url"
                  value={editForm.documentUrl}
                  onChange={(e) =>
                    updateEditField("documentUrl", e.target.value)
                  }
                  placeholder="https://..."
                  aria-invalid={Boolean(editErrors.documentUrl)}
                />
                {editErrors.documentUrl && (
                  <p className="text-xs text-destructive">
                    {editErrors.documentUrl}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label>Expires at (optional)</Label>
                <Input
                  type="date"
                  value={editForm.expiresAt}
                  onChange={(e) =>
                    updateEditField("expiresAt", e.target.value)
                  }
                />
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
                    {STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Notes (optional)</Label>
                <Input
                  value={editForm.notes}
                  onChange={(e) =>
                    updateEditField("notes", e.target.value)
                  }
                />
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
            <DialogTitle>Delete compliance record</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this compliance record? This cannot
            be undone.
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
              {deleteLoading ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
