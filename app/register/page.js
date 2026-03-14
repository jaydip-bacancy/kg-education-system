"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STORAGE_KEY = "brightsteps_auth";

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

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState("staff");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
  });
  const [staffForm, setStaffForm] = useState({
    centerIds: [],
    roleTitle: "",
  });
  const [parentForm, setParentForm] = useState({
    centerId: "",
  });
  const [children, setChildren] = useState([{ ...EMPTY_CHILD }]);
  const [preferences, setPreferences] = useState({
    emailUpdates: false,
    smsAlerts: false,
    acceptTerms: false,
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [centers, setCenters] = useState([]);

  const updateField = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const addChild = () => setChildren((prev) => [...prev, { ...EMPTY_CHILD }]);
  const removeChild = (index) =>
    setChildren((prev) => prev.filter((_, i) => i !== index));

  const updateChild = (index, field, value) =>
    setChildren((prev) =>
      prev.map((child, i) =>
        i === index ? { ...child, [field]: value } : child
      )
    );

  const childErrors = useMemo(() => {
    if (role !== "parent") return [];
    return children.map((child) => ({
      firstName: child.firstName.trim() ? "" : "First name is required.",
      lastName: child.lastName.trim() ? "" : "Last name is required.",
    }));
  }, [children, role]);

  useEffect(() => {
    if (role === "staff" || role === "parent") {
      fetch("/api/centers")
        .then((r) => r.json())
        .then((data) => setCenters(Array.isArray(data) ? data : []))
        .catch(() => setCenters([]));
    }
  }, [role]);

  const validate = () => {
    const nextErrors = {};

    if (!form.firstName.trim()) nextErrors.firstName = "First name is required.";
    if (!form.lastName.trim()) nextErrors.lastName = "Last name is required.";
    if (!form.email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!emailRegex.test(form.email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!form.password) {
      nextErrors.password = "Password is required.";
    } else if (form.password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters.";
    }

    if (role === "staff") {
      if (!staffForm.centerIds?.length) nextErrors.centerIds = "Select at least one center.";
      if (!staffForm.roleTitle?.trim()) nextErrors.roleTitle = "Job title is required.";
    }

    if (role === "parent") {
      if (!parentForm.centerId) nextErrors.centerId = "Select a center.";
      if (!children.length) nextErrors.children = "Add at least one child.";
      const missingNames = childErrors.some((c) => c.firstName || c.lastName);
      if (missingNames) nextErrors.children = "Fill in required child details.";
    }

    if (!preferences.acceptTerms) nextErrors.acceptTerms = "You must accept the terms to continue.";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!validate() || loading) return;

    setLoading(true);
    setErrors({});

    try {
      const csrfRes = await fetch("/api/auth/csrf");
      const { csrfToken } = await csrfRes.json();
      const csrfCookie = document.cookie
        .split("; ")
        .find((row) => row.startsWith("csrfToken="))
        ?.split("=")[1];
      const token = csrfToken || csrfCookie || "";

      let url, body;

      if (role === "staff") {
        url = "/api/auth/register/staff";
        body = JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          password: form.password,
          phone: form.phone.trim() || undefined,
          centerIds: Array.isArray(staffForm.centerIds) ? staffForm.centerIds : [staffForm.centerIds],
          roleTitle: staffForm.roleTitle.trim(),
          communicationPrefs: preferences.emailUpdates || preferences.smsAlerts ? { emailUpdates: preferences.emailUpdates, smsAlerts: preferences.smsAlerts } : undefined,
        });
      } else {
        url = "/api/auth/register/parent";
        body = JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          password: form.password,
          phone: form.phone.trim() || undefined,
          centerId: parentForm.centerId,
          communicationPrefs: preferences.emailUpdates || preferences.smsAlerts ? { emailUpdates: preferences.emailUpdates, smsAlerts: preferences.smsAlerts } : undefined,
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
        });
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": token },
        body,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrors({ form: data?.error?.message || "Registration failed. Please try again." });
        setLoading(false);
        return;
      }

      const payload = { user: data.user, tokens: data.tokens };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      router.push("/dashboard");
      router.refresh();
    } catch {
      setErrors({ form: "Something went wrong. Please try again." });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f3ef] text-[#1e1b19]">
      <div className="relative overflow-hidden">
        <div className="absolute -top-20 -left-24 h-72 w-72 rounded-full bg-[#ffd9b8]/70 blur-3xl" />
        <div className="absolute -bottom-28 right-0 h-80 w-80 rounded-full bg-[#c6e7ff]/70 blur-3xl" />
        <div className="absolute top-24 right-1/3 h-40 w-40 rounded-full bg-[#ffe9f0]/70 blur-3xl" />

        <header className="relative z-10">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius)] bg-[#1e1b19] text-white">bw</div>
              <span className="text-lg font-semibold tracking-tight">brightsteps</span>
            </Link>
            {/* <Button variant="outline" className="border-[#1e1b19]/20 text-[#1e1b19]" asChild>
              <Link href="/login">Log in</Link>
            </Button> */}
          </div>
        </header>

        <main className="relative z-10 mx-auto w-full max-w-3xl px-6 pb-20 pt-6">
          <form className="grid gap-6" onSubmit={onSubmit} noValidate>
            <Card className="bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl text-[#1e1b19]">Create account</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                {errors.form && (
                  <Alert variant="destructive">
                    <AlertDescription>{errors.form}</AlertDescription>
                  </Alert>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="role">I am a</Label>
                  <Select value={role} onValueChange={(v) => { setRole(v); setErrors({}); }}>
                    <SelectTrigger id="role" className="h-10 w-full border-[#1e1b19]/15 bg-white">
                      <SelectValue placeholder="Choose a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">Staff member</SelectItem>
                      <SelectItem value="parent">Parent / Guardian</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="firstName">First name</Label>
                    <Input id="firstName" value={form.firstName} onChange={(e) => updateField("firstName", e.target.value)} className="h-10" aria-invalid={Boolean(errors.firstName)} required />
                    {errors.firstName && <p className="text-xs text-destructive">{errors.firstName}</p>}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input id="lastName" value={form.lastName} onChange={(e) => updateField("lastName", e.target.value)} className="h-10" aria-invalid={Boolean(errors.lastName)} required />
                    {errors.lastName && <p className="text-xs text-destructive">{errors.lastName}</p>}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} className="h-10" aria-invalid={Boolean(errors.email)} required />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={form.password} onChange={(e) => updateField("password", e.target.value)} className="h-10" aria-invalid={Boolean(errors.password)} required />
                  {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone (optional)</Label>
                  <Input id="phone" type="tel" value={form.phone} onChange={(e) => updateField("phone", e.target.value)} className="h-10" />
                </div>

                {/* Staff: centers, role title */}
                {role === "staff" && (
                  <>
                    <div className="grid gap-2">
                      <Label>Center (select where you work)</Label>
                      <Select
                        value={staffForm.centerIds?.[0] || ""}
                        onValueChange={(v) => setStaffForm((p) => ({ ...p, centerIds: v ? [v] : [] }))}
                      >
                        <SelectTrigger className="h-10" aria-invalid={Boolean(errors.centerIds)}>
                          <SelectValue placeholder="Select center" />
                        </SelectTrigger>
                        <SelectContent>
                          {centers.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {centers.length === 0 && (
                        <p className="text-xs text-muted-foreground">No centers yet. Ask an admin to create one first.</p>
                      )}
                      {errors.centerIds && <p className="text-xs text-destructive">{errors.centerIds}</p>}
                    </div>
                    <div className="grid gap-2">
                      <Label>Job title</Label>
                      <Input placeholder="e.g. Lead Teacher" value={staffForm.roleTitle} onChange={(e) => setStaffForm((p) => ({ ...p, roleTitle: e.target.value }))} className="h-10" aria-invalid={Boolean(errors.roleTitle)} />
                      {errors.roleTitle && <p className="text-xs text-destructive">{errors.roleTitle}</p>}
                    </div>
                  </>
                )}

                {/* Parent: center */}
                {role === "parent" && (
                  <div className="grid gap-2">
                    <Label>Center</Label>
                    <Select value={parentForm.centerId} onValueChange={(v) => setParentForm((p) => ({ ...p, centerId: v }))}>
                      <SelectTrigger className="h-10" aria-invalid={Boolean(errors.centerId)}>
                        <SelectValue placeholder="Select center" />
                      </SelectTrigger>
                      <SelectContent>
                        {centers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {centers.length === 0 && (
                      <p className="text-xs text-muted-foreground">No centers yet. Ask your center to get set up.</p>
                    )}
                    {errors.centerId && <p className="text-xs text-destructive">{errors.centerId}</p>}
                  </div>
                )}
              </CardContent>
            </Card>

            {role === "parent" && (
              <Card className="border-[#1e1b19]/10 bg-white">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-2xl text-[#1e1b19]">Children</CardTitle>
                  <Button type="button" variant="outline" size="sm" className="border-[#1e1b19]/20 text-[#1e1b19]" onClick={addChild}>Add child</Button>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {errors.children && <Alert variant="destructive"><AlertDescription>{errors.children}</AlertDescription></Alert>}
                  {children.map((child, index) => (
                    <Card key={`child-${index}`} className="border-[#1e1b19]/10 bg-white">
                      <CardHeader className="flex flex-row items-center justify-between">
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6b4e3d]">Child {index + 1}</div>
                        {children.length > 1 && <Button type="button" variant="ghost" size="sm" className="text-xs font-semibold text-[#9b2c5b]" onClick={() => removeChild(index)}>Remove</Button>}
                      </CardHeader>
                      <CardContent className="grid gap-3 md:grid-cols-2">
                        <div className="grid gap-2"><Label>First name</Label><Input value={child.firstName} onChange={(e) => updateChild(index, "firstName", e.target.value)} className="h-10" aria-invalid={Boolean(childErrors[index]?.firstName)} required />{childErrors[index]?.firstName && <p className="text-xs text-destructive">{childErrors[index].firstName}</p>}</div>
                        <div className="grid gap-2"><Label>Last name</Label><Input value={child.lastName} onChange={(e) => updateChild(index, "lastName", e.target.value)} className="h-10" aria-invalid={Boolean(childErrors[index]?.lastName)} required />{childErrors[index]?.lastName && <p className="text-xs text-destructive">{childErrors[index].lastName}</p>}</div>
                        <div className="grid gap-2"><Label>Date of birth</Label><Input type="date" value={child.dateOfBirth} onChange={(e) => updateChild(index, "dateOfBirth", e.target.value)} className="h-10" /></div>
                        <div className="grid gap-2"><Label>Relationship</Label><Input value={child.relationship} onChange={(e) => updateChild(index, "relationship", e.target.value)} className="h-10" /></div>
                        <div className="grid gap-2 md:col-span-2"><Label>Allergies</Label><Input value={child.allergies} onChange={(e) => updateChild(index, "allergies", e.target.value)} className="h-10" /></div>
                        <div className="grid gap-2 md:col-span-2"><Label>Medical notes</Label><Textarea value={child.medicalNotes} onChange={(e) => updateChild(index, "medicalNotes", e.target.value)} rows={3} className="border-[#1e1b19]/15" /></div>
                        <div className="grid gap-2 md:col-span-2"><Label>Dietary restrictions</Label><Input value={child.dietaryRestrictions} onChange={(e) => updateChild(index, "dietaryRestrictions", e.target.value)} className="h-10" /></div>
                        <div className="grid gap-2"><Label>Emergency contact name</Label><Input value={child.emergencyContactName} onChange={(e) => updateChild(index, "emergencyContactName", e.target.value)} className="h-10" /></div>
                        <div className="grid gap-2"><Label>Emergency contact phone</Label><Input type="tel" value={child.emergencyContactPhone} onChange={(e) => updateChild(index, "emergencyContactPhone", e.target.value)} className="h-10" /></div>
                      </CardContent>
                    </Card>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card className="border-[#1e1b19]/10 bg-white">
              <CardHeader><CardTitle className="text-2xl text-[#1e1b19]">Preferences</CardTitle></CardHeader>
              <CardContent className="grid gap-4 text-sm text-[#3b3531]">
                <div className="flex items-center gap-2">
                  <Checkbox id="email-updates" checked={preferences.emailUpdates} onCheckedChange={(c) => setPreferences((p) => ({ ...p, emailUpdates: Boolean(c) }))} />
                  <Label htmlFor="email-updates" className="text-sm font-medium">Email updates and newsletters</Label>
                </div>
                {/* <div className="flex items-center gap-2">
                  <Checkbox id="sms-alerts" checked={preferences.smsAlerts} onCheckedChange={(c) => setPreferences((p) => ({ ...p, smsAlerts: Boolean(c) }))} />
                  <Label htmlFor="sms-alerts" className="text-sm font-medium">SMS alerts for check-ins</Label>
                </div> */}
                <div className="flex items-center gap-2">
                  <Checkbox id="terms" checked={preferences.acceptTerms} onCheckedChange={(c) => setPreferences((p) => ({ ...p, acceptTerms: Boolean(c) }))} />
                  <Label htmlFor="terms" className="text-sm font-medium">I agree to the terms and privacy policy</Label>
                </div>
                {errors.acceptTerms && <p className="text-xs text-destructive">{errors.acceptTerms}</p>}
              </CardContent>
              <CardFooter>
                <Button type="submit" className="h-11 w-full bg-[#1e1b19] text-white hover:bg-black" disabled={loading}>
                  {loading ? "Creating account…" : "Create account"}
                </Button>
              </CardFooter>
            </Card>
          </form>
        </main>
      </div>
    </div>
  );
}
