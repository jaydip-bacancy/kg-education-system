"use client";

import Link from "next/link";
import { useState } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STORAGE_KEY = "brightsteps_auth";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", remember: false });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const updateField = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const validate = () => {
    const nextErrors = {};
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
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    try {
      const csrfRes = await fetch("/api/auth/csrf");
      const { csrfToken } = await csrfRes.json();
      const csrfCookie = document.cookie
        .split("; ")
        .find((row) => row.startsWith("csrfToken="))
        ?.split("=")[1];

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken || csrfCookie || "",
        },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrors({
          form: data?.error?.message || "Invalid credentials. Please try again.",
        });
        setLoading(false);
        return;
      }

      const { user, tokens } = data;
      const payload = { user, tokens };
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
        <div className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-[#ffd9b8]/70 blur-3xl" />
        <div className="absolute -bottom-28 right-0 h-80 w-80 rounded-full bg-[#c6e7ff]/70 blur-3xl" />
        <div className="absolute top-24 right-1/3 h-40 w-40 rounded-full bg-[#ffe9f0]/70 blur-3xl" />

        <header className="relative z-10">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius)] bg-[#1e1b19] text-white">
                bw
              </div>
              <span className="text-lg font-semibold tracking-tight">
                brightsteps
              </span>
            </Link>
            <Button
              variant="outline"
              className="border-[#1e1b19]/20 text-[#1e1b19]"
              asChild
            >
              <Link href="/register">Create account</Link>
            </Button>
          </div>
        </header>

        <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-6 md:flex-row md:items-start">
          <section className="md:w-[55%]">
            <Card className="border-white/70 bg-white/80 shadow-xl">
              <CardHeader>
                <div className="inline-flex w-fit items-center rounded-[var(--radius)] bg-[#fff7f0] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#6b4e3d]">
                  Welcome back
                </div>
                <CardTitle className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                  Sign in to your center
                </CardTitle>
                <p className="text-base leading-7 text-muted-foreground">
                  Access daily reports, parent messages, billing, and staff tools
                  in one place.
                </p>
              </CardHeader>
              <form className="grid gap-4" onSubmit={onSubmit} noValidate>
                <CardContent className="grid gap-4">
                  {errors.form && (
                    <Alert variant="destructive">
                      <AlertDescription>{errors.form}</AlertDescription>
                    </Alert>
                  )}
                  <div className="grid gap-2">
                    <Label htmlFor="login-email">Email address</Label>
                    <Input
                      id="login-email"
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      placeholder="you@center.com"
                      className="h-11 bg-white"
                      aria-invalid={Boolean(errors.email)}
                      disabled={loading}
                      required
                    />
                    {errors.email && (
                      <p className="text-xs text-destructive">{errors.email}</p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      name="password"
                      value={form.password}
                      onChange={(e) =>
                        updateField("password", e.target.value)
                      }
                      placeholder="********"
                      className="h-11 bg-white"
                      aria-invalid={Boolean(errors.password)}
                      disabled={loading}
                      required
                    />
                    {errors.password && (
                      <p className="text-xs text-destructive">
                        {errors.password}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="remember-me"
                        checked={form.remember}
                        onCheckedChange={(checked) =>
                          updateField("remember", Boolean(checked))
                        }
                      />
                      <Label htmlFor="remember-me" className="text-xs font-medium">
                        Remember me
                      </Label>
                    </div>
                    <Button variant="link" asChild className="h-auto p-0 text-xs">
                      <Link href="/forgot-password">Forgot password?</Link>
                    </Button>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    type="submit"
                    className="h-11 w-full bg-[#1e1b19] text-white hover:bg-black"
                    disabled={loading}
                  >
                    {loading ? "Signing in…" : "Log in"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </section>

          <aside className="grid flex-1 gap-6">
            <Card className="bg-[#fff7f0]">
              <CardHeader>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6b4e3d]">
                  Trusted daily
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm text-muted-foreground">
                <p className="leading-6">
                  Directors and educators use brightsteps to keep families close,
                  manage attendance, and stay ahead of billing.
                </p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <Card className="bg-white">
                    <CardContent className="p-3">30% less admin time</CardContent>
                  </Card>
                  <Card className="bg-white">
                    <CardContent className="p-3">2 min avg reply</CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
            <Card className="border-[#1e1b19]/10 bg-white">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-[#1e1b19]">
                  New here?
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Create an account to onboard your center or join your team.
                </p>
              </CardHeader>
              <CardFooter>
                <Button
                  variant="outline"
                  className="h-10 w-full border-[#1e1b19]/20 text-[#1e1b19]"
                  asChild
                >
                  <Link href="/register">Create account</Link>
                </Button>
              </CardFooter>
            </Card>
          </aside>
        </main>
      </div>
    </div>
  );
}
