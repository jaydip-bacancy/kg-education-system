"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle"); // idle | loading | success | error

  const validate = () => {
    const nextErrors = {};
    if (!email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!emailRegex.test(email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setStatus("loading");
    setErrors({});

    try {
      const csrfRes = await fetch("/api/auth/csrf");
      const { csrfToken } = await csrfRes.json();
      const csrfCookie = document.cookie
        .split("; ")
        .find((row) => row.startsWith("csrfToken="))
        ?.split("=")[1];

      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken || csrfCookie || "",
        },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus("error");
        setErrors({ form: data?.error?.message || "Something went wrong." });
        return;
      }

      setStatus("success");
    } catch {
      setStatus("error");
      setErrors({ form: "Unable to send reset email. Please try again." });
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f3ef] text-[#1e1b19]">
      <div className="relative overflow-hidden">
        <div className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-[#ffd9b8]/70 blur-3xl" />
        <div className="absolute -bottom-28 right-0 h-80 w-80 rounded-full bg-[#c6e7ff]/70 blur-3xl" />

        <header className="relative z-10">
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-6">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius)] bg-[#1e1b19] text-white">
                bw
              </div>
              <span className="text-lg font-semibold tracking-tight">
                brightsteps
              </span>
            </Link>
            <Button variant="outline" className="border-[#1e1b19]/20 text-[#1e1b19]" asChild>
              <Link href="/login">Back to login</Link>
            </Button>
          </div>
        </header>

        <main className="relative z-10 mx-auto w-full max-w-md px-6 pb-20 pt-6">
          <Card className="bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl text-[#1e1b19]">
                Forgot password
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Enter your email and we will send reset instructions.
              </p>
            </CardHeader>
            <form onSubmit={onSubmit} noValidate>
              <CardContent className="grid gap-4 pt-2">
                {status === "success" && (
                  <Alert>
                    <AlertDescription>
                      If an account exists for that email, a reset link has been
                      sent. Check your inbox and spam folder.
                    </AlertDescription>
                  </Alert>
                )}
                {status === "error" && errors.form && (
                  <Alert variant="destructive">
                    <AlertDescription>{errors.form}</AlertDescription>
                  </Alert>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="forgot-email">Email</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="h-10"
                    aria-invalid={Boolean(errors.email)}
                    disabled={status === "loading"}
                    required
                  />
                  {errors.email && (
                    <p className="text-xs text-destructive">{errors.email}</p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="mt-1 h-11 w-full bg-[#1e1b19] text-white hover:bg-black"
                  disabled={status === "loading"}
                >
                  {status === "loading" ? "Sending…" : "Send reset link"}
                </Button>
              </CardContent>
            </form>
          </Card>
        </main>
      </div>
    </div>
  );
}
