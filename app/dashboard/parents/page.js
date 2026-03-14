"use client";

import { useState, useEffect, useMemo } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronDown, ChevronRight, UserPlus, Baby, GraduationCap } from "lucide-react";

const EMPTY_CHILD = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  relationship: "",
  allergies: "",
  medicalNotes: "",
  dietaryRestrictions: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
};

export default function ParentsManagementPage() {
  const [parents, setParents] = useState([]);
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [centerFilter, setCenterFilter] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [addForm, setAddForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    centerId: "",
    communicationPrefs: {},
  });
  const [children, setChildren] = useState([{ ...EMPTY_CHILD }]);
  const [addErrors, setAddErrors] = useState({});
  const [addLoading, setAddLoading] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [childDetails, setChildDetails] = useState(null);
  const [childDetailsLoading, setChildDetailsLoading] = useState(false);

  const updateAddField = (field, value) =>
    setAddForm((prev) => ({ ...prev, [field]: value }));

  const addChild = () => setChildren((prev) => [...prev, { ...EMPTY_CHILD }]);
  const removeChild = (index) =>
    setChildren((prev) => prev.filter((_, i) => i !== index));

  const updateChild = (index, field, value) =>
    setChildren((prev) =>
      prev.map((child, i) =>
        i === index ? { ...child, [field]: value } : child
      )
    );

  const childErrors = useMemo(
    () =>
      children.map((child) => ({
        firstName: child.firstName.trim() ? "" : "First name is required.",
        lastName: child.lastName.trim() ? "" : "Last name is required.",
      })),
    [children]
  );

  const fetchParents = () => {
    const url = centerFilter
      ? `/api/parents?centerId=${encodeURIComponent(centerFilter)}`
      : "/api/parents";
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setParents(data);
        else setParents([]);
      })
      .catch(() => setParents([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    fetchParents();
  }, [centerFilter]);

  useEffect(() => {
    fetch("/api/centers")
      .then((r) => r.json())
      .then((data) => setCenters(Array.isArray(data) ? data : []))
      .catch(() => setCenters([]));
  }, []);

  useEffect(() => {
    if (!selectedChildId) {
      setChildDetails(null);
      return;
    }
    setChildDetailsLoading(true);
    setChildDetails(null);
    fetch(`/api/children/${selectedChildId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error.message);
        setChildDetails(data);
      })
      .catch(() => setChildDetails(null))
      .finally(() => setChildDetailsLoading(false));
  }, [selectedChildId]);

  const validateAdd = () => {
    const next = {};
    if (!addForm.firstName?.trim()) next.firstName = "First name is required.";
    if (!addForm.lastName?.trim()) next.lastName = "Last name is required.";
    if (!addForm.email?.trim()) next.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addForm.email.trim()))
      next.email = "Enter a valid email.";
    if (!addForm.password || addForm.password.length < 8)
      next.password = "Password must be at least 8 characters.";
    if (!addForm.centerId) next.centerId = "Select a center.";
    if (!children.length) next.children = "Add at least one child.";
    if (childErrors.some((e) => e.firstName || e.lastName))
      next.children = "Fill in required child details.";
    setAddErrors(next);
    return Object.keys(next).length === 0;
  };

  const resetAddForm = () => {
    setAddForm({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      phone: "",
      centerId: "",
      communicationPrefs: {},
    });
    setChildren([{ ...EMPTY_CHILD }]);
    setAddErrors({});
    setAddSuccess(false);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!validateAdd() || addLoading) return;
    setAddLoading(true);
    setAddErrors({});
    try {
      const csrfRes = await fetch("/api/auth/csrf");
      const { csrfToken } = await csrfRes.json();
      const csrfCookie = document.cookie
        .split("; ")
        .find((row) => row.startsWith("csrfToken="))
        ?.split("=")[1];
      const token = csrfToken || csrfCookie || "";

      const res = await fetch("/api/parents", {
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
          centerId: addForm.centerId,
          communicationPrefs: Object.keys(addForm.communicationPrefs || {}).length
            ? addForm.communicationPrefs
            : undefined,
          children: children.map((c) => ({
            firstName: c.firstName.trim(),
            lastName: c.lastName.trim(),
            dateOfBirth: c.dateOfBirth || undefined,
            relationship: c.relationship?.trim() || undefined,
            allergies: c.allergies?.trim() || undefined,
            medicalNotes: c.medicalNotes?.trim() || undefined,
            dietaryRestrictions: c.dietaryRestrictions?.trim() || undefined,
            emergencyContactName: c.emergencyContactName?.trim() || undefined,
            emergencyContactPhone: c.emergencyContactPhone?.trim() || undefined,
          })),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAddErrors({
          form: data?.error?.message || "Failed to add family.",
        });
        return;
      }
      setAddSuccess(true);
      resetAddForm();
      fetchParents();
      setTimeout(() => setShowAddForm(false), 1500);
    } catch {
      setAddErrors({ form: "Something went wrong." });
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Parents & Families
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage parent accounts and their enrolled children.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setShowAddForm((v) => !v);
            if (showAddForm) resetAddForm();
          }}
          className="shrink-0"
        >
          <UserPlus className="mr-2 size-4" />
          {showAddForm ? "Cancel" : "Add family"}
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add new family</CardTitle>
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
                  <AlertDescription>Family added successfully.</AlertDescription>
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

              <div className="border-t pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <Label className="text-base">Children</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addChild}
                  >
                    Add child
                  </Button>
                </div>
                {addErrors.children && (
                  <p className="mb-2 text-xs text-destructive">
                    {addErrors.children}
                  </p>
                )}
                <div className="space-y-3">
                  {children.map((child, index) => (
                    <Card key={index} className="bg-muted/30">
                      <CardHeader className="flex flex-row items-center justify-between py-3">
                        <span className="text-sm font-medium">Child {index + 1}</span>
                        {children.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => removeChild(index)}
                          >
                            Remove
                          </Button>
                        )}
                      </CardHeader>
                      <CardContent className="grid gap-3 py-0 md:grid-cols-2">
                        <div className="grid gap-2">
                          <Label>First name</Label>
                          <Input
                            value={child.firstName}
                            onChange={(e) =>
                              updateChild(index, "firstName", e.target.value)
                            }
                            aria-invalid={Boolean(childErrors[index]?.firstName)}
                          />
                          {childErrors[index]?.firstName && (
                            <p className="text-xs text-destructive">
                              {childErrors[index].firstName}
                            </p>
                          )}
                        </div>
                        <div className="grid gap-2">
                          <Label>Last name</Label>
                          <Input
                            value={child.lastName}
                            onChange={(e) =>
                              updateChild(index, "lastName", e.target.value)
                            }
                            aria-invalid={Boolean(childErrors[index]?.lastName)}
                          />
                          {childErrors[index]?.lastName && (
                            <p className="text-xs text-destructive">
                              {childErrors[index].lastName}
                            </p>
                          )}
                        </div>
                        <div className="grid gap-2">
                          <Label>Date of birth</Label>
                          <Input
                            type="date"
                            value={child.dateOfBirth}
                            onChange={(e) =>
                              updateChild(index, "dateOfBirth", e.target.value)
                            }
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Relationship</Label>
                          <Input
                            value={child.relationship}
                            onChange={(e) =>
                              updateChild(index, "relationship", e.target.value)
                            }
                          />
                        </div>
                        <div className="grid gap-2 md:col-span-2">
                          <Label>Allergies</Label>
                          <Input
                            value={child.allergies}
                            onChange={(e) =>
                              updateChild(index, "allergies", e.target.value)
                            }
                          />
                        </div>
                        <div className="grid gap-2 md:col-span-2">
                          <Label>Medical notes</Label>
                          <Textarea
                            value={child.medicalNotes}
                            onChange={(e) =>
                              updateChild(index, "medicalNotes", e.target.value)
                            }
                            rows={2}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Emergency contact name</Label>
                          <Input
                            value={child.emergencyContactName}
                            onChange={(e) =>
                              updateChild(
                                index,
                                "emergencyContactName",
                                e.target.value
                              )
                            }
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Emergency contact phone</Label>
                          <Input
                            type="tel"
                            value={child.emergencyContactPhone}
                            onChange={(e) =>
                              updateChild(
                                index,
                                "emergencyContactPhone",
                                e.target.value
                              )
                            }
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={addLoading}>
                  {addLoading ? "Adding…" : "Add family"}
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
      ) : parents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Baby className="mb-3 size-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              No families yet. Add a family to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {parents.map((parent) => {
            const isExpanded = expandedId === parent.id;
            const childCount = parent.children?.length ?? 0;
            return (
              <Card key={parent.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
                  onClick={() =>
                    setExpandedId((id) => (id === parent.id ? null : parent.id))
                  }
                >
                  {isExpanded ? (
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {parent.firstName} {parent.lastName}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {parent.email}
                      {parent.phone && ` • ${parent.phone}`}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                    {childCount} {childCount === 1 ? "child" : "children"}
                  </span>
                </button>
                {isExpanded && (
                  <CardContent className="border-t pt-4">
                    <div className="space-y-3">
                      {parent.children?.map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => {
                            setSelectedChildId(child.id);
                            setChildDetailsLoading(true);
                          }}
                          className="flex w-full items-start gap-3 rounded-lg border bg-muted/20 p-3 text-left transition-colors hover:bg-muted/40"
                        >
                          <Baby className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">
                              {child.firstName} {child.lastName}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                              {child.dateOfBirth && (
                                <span>DOB: {child.dateOfBirth}</span>
                              )}
                              {child.allergies && (
                                <span>Allergies: {child.allergies}</span>
                              )}
                              {child.medicalNotes && (
                                <span>{child.medicalNotes}</span>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={!!selectedChildId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedChildId(null);
            setChildDetails(null);
            setChildDetailsLoading(false);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {childDetails
                ? `${childDetails.firstName} ${childDetails.lastName}`
                : "Child details"}
            </DialogTitle>
          </DialogHeader>
          {childDetailsLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : childDetails ? (
            <div className="space-y-4">
              <div className="grid gap-2 text-sm">
                {childDetails.dateOfBirth && (
                  <p><span className="font-medium text-muted-foreground">Date of birth:</span> {childDetails.dateOfBirth}</p>
                )}
                {childDetails.relationship && (
                  <p><span className="font-medium text-muted-foreground">Relationship:</span> {childDetails.relationship}</p>
                )}
                {childDetails.allergies && (
                  <p><span className="font-medium text-muted-foreground">Allergies:</span> {childDetails.allergies}</p>
                )}
                {childDetails.medicalNotes && (
                  <p><span className="font-medium text-muted-foreground">Medical notes:</span> {childDetails.medicalNotes}</p>
                )}
                {childDetails.dietaryRestrictions && (
                  <p><span className="font-medium text-muted-foreground">Dietary restrictions:</span> {childDetails.dietaryRestrictions}</p>
                )}
                {(childDetails.emergencyContactName || childDetails.emergencyContactPhone) && (
                  <p>
                    <span className="font-medium text-muted-foreground">Emergency contact:</span>{" "}
                    {[childDetails.emergencyContactName, childDetails.emergencyContactPhone].filter(Boolean).join(" • ")}
                  </p>
                )}
              </div>

              <div>
                <h4 className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <GraduationCap className="size-4" />
                  Classes
                </h4>
                {childDetails.classrooms?.length ? (
                  <ul className="space-y-2">
                    {childDetails.classrooms.map((c) => (
                      <li key={c.id} className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                        <p className="font-medium">{c.name}</p>
                        {(c.startTime || c.endTime) && (
                          <div className="mt-1 flex gap-4 text-muted-foreground">
                            {c.startTime && (
                              <span><span className="font-medium text-foreground/70">Start:</span> {String(c.startTime).slice(0, 5)}</span>
                            )}
                            {c.endTime && (
                              <span><span className="font-medium text-foreground/70">End:</span> {String(c.endTime).slice(0, 5)}</span>
                            )}
                          </div>
                        )}
                        {c.enrolledAt && (
                          <p className="mt-1 text-muted-foreground">Enrolled {c.enrolledAt}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                    Not enrolled in any classes yet
                  </p>
                )}
              </div>
            </div>
          ) : selectedChildId ? (
            <p className="py-6 text-center text-sm text-destructive">Failed to load details.</p>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
