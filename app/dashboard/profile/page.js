"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

async function getCsrfToken() {
  const res = await fetch("/api/auth/csrf");
  const { csrfToken } = await res.json();
  const cookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith("csrfToken="))
    ?.split("=")[1];

  return csrfToken || cookie || "";
}

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", roleTitle: "" });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const profileUser = profile?.user || user || null;
  const isStaff = profileUser?.role === "STAFF";
  const isParent = profileUser?.role === "PARENT";
  const displayEmail = profileUser?.email || "";
  const displayPhone = profileUser?.phone || "";

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    setLoading(true);
    setLoadError(null);

    fetch(`/api/auth/profile?userId=${encodeURIComponent(user.id)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.user) {
          throw new Error(data?.error?.message || "Unable to load your profile.");
        }
        return data;
      })
      .then((data) => {
        setProfile(data);
        setForm({
          firstName: data?.user?.firstName || "",
          lastName: data?.user?.lastName || "",
          roleTitle: data?.staffProfile?.role_title || "",
        });
      })
      .catch((error) => {
        if (error?.name === "AbortError") return;

        setProfile((prev) => prev || { user });
        setLoadError(error?.message || "Unable to load your profile.");
        setForm((prev) => ({
          ...prev,
          firstName: user?.firstName ?? prev.firstName,
          lastName: user?.lastName ?? prev.lastName,
        }));
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [user]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validate = () => {
    const next = {};

    if (!form.firstName.trim()) next.firstName = "First name is required.";
    if (!form.lastName.trim()) next.lastName = "Last name is required.";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage(null);

    if (!validate() || submitting || !user?.id) return;

    setSubmitting(true);

    try {
      const token = await getCsrfToken();
      const payload = {
        userId: user.id,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
      };

      if (isStaff && form.roleTitle.trim()) {
        payload.roleTitle = form.roleTitle.trim();
      }

      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": token,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({
          type: "error",
          text: data?.error?.message || "Update failed.",
        });
        return;
      }

      setMessage({ type: "success", text: "Profile saved." });

      const refreshed = await fetch(`/api/auth/profile?userId=${encodeURIComponent(user.id)}`);
      const refreshedData = await refreshed.json().catch(() => null);

      if (refreshed.ok && refreshedData?.user) {
        setProfile(refreshedData);
        setForm({
          firstName: refreshedData.user.firstName || "",
          lastName: refreshedData.user.lastName || "",
          roleTitle: refreshedData?.staffProfile?.role_title || "",
        });
      }
    } catch {
      setMessage({ type: "error", text: "Something went wrong." });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update your name and role details. Phone and email are managed through admin.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account details</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
          <CardContent className="grid gap-4">
            {loadError && (
              <Alert variant="destructive">
                <AlertDescription>{loadError}</AlertDescription>
              </Alert>
            )}
            {message?.type === "error" && (
              <Alert variant="destructive">
                <AlertDescription>{message.text}</AlertDescription>
              </Alert>
            )}
            {message?.type === "success" && (
              <Alert>
                <AlertDescription>{message.text}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input
                value={displayEmail}
                readOnly
                className="border-border/70 bg-muted/40 text-foreground opacity-100"
              />
            </div>
            <div className="grid gap-2">
              <Label>Phone</Label>
              <Input
                value={displayPhone || ""}
                readOnly
                placeholder="No phone on file"
                className="border-border/70 bg-muted/40 text-foreground opacity-100"
              />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>First name</Label>
                <Input
                  value={form.firstName}
                  onChange={(event) => updateField("firstName", event.target.value)}
                  aria-invalid={Boolean(errors.firstName)}
                />
                {errors.firstName && (
                  <p className="mt-1 text-xs text-destructive">{errors.firstName}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label>Last name</Label>
                <Input
                  value={form.lastName}
                  onChange={(event) => updateField("lastName", event.target.value)}
                  aria-invalid={Boolean(errors.lastName)}
                />
                {errors.lastName && (
                  <p className="mt-1 text-xs text-destructive">{errors.lastName}</p>
                )}
              </div>
            </div>
            {isStaff && (
              <div className="grid gap-2">
                <Label>Role / Title</Label>
                <Input
                  value={form.roleTitle}
                  onChange={(event) => updateField("roleTitle", event.target.value)}
                  placeholder="e.g. Lead Teacher"
                />
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save changes"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {isParent && profile?.parentProfile?.children?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Children (managed by staff)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {profile.parentProfile.children.map((child) => (
              <div
                key={child.id}
                className="rounded-[var(--radius)] border border-border/50 bg-background px-4 py-3"
              >
                <p className="text-sm font-medium leading-tight">
                  {child.firstName} {child.lastName}
                </p>
                <p className="text-xs text-muted-foreground">
                  DOB: {child.dateOfBirth || "-"} | Rel: {child.relationship || "-"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Allergies: {child.allergies || "None"} | Notes:{" "}
                  {child.medicalNotes || "None"}
                </p>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Children details can only be edited by staff or admins.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
