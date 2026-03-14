"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("checking"); // checking | ready | loading | success | error | expired
  const [message, setMessage] = useState("");

  const checkRecoverySession = useCallback(async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
      setStatus("ready");
      return;
    }

    const hashParams = new URLSearchParams(
      typeof window !== "undefined" ? window.location.hash?.slice(1) || "" : ""
    );
    const type = hashParams.get("type");
    const accessToken = hashParams.get("access_token");

    if (type === "recovery" && accessToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: hashParams.get("refresh_token") || "",
      });
      if (error) {
        setStatus("expired");
        setMessage("This reset link is invalid or has expired.");
        return;
      }
      setStatus("ready");
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", window.location.pathname);
      }
      return;
    }

    setStatus("expired");
    setMessage("Use the reset link from your email to set a new password.");
  }, []);

  useEffect(() => {
    checkRecoverySession();
  }, [checkRecoverySession]);

  const validate = () => {
    const nextErrors = {};
    if (!password) {
      nextErrors.password = "Password is required.";
    } else if (password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters.";
    }
    if (!confirmPassword) {
      nextErrors.confirmPassword = "Please confirm your password.";
    } else if (confirmPassword !== password) {
      nextErrors.confirmPassword = "Passwords do not match.";
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
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setStatus("ready");
        setErrors({ form: error.message });
        return;
      }

      setStatus("success");
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setStatus("ready");
      setErrors({ form: "Unable to reset password. Please try again." });
    }
  };

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f3ef]">
        <p className="text-sm text-muted-foreground">Verifying reset link…</p>
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="min-h-screen bg-[#f6f3ef] text-[#1e1b19]">
        <header className="border-b border-[#1e1b19]/10 bg-white">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius)] bg-[#1e1b19] text-white">
                bw
              </div>
              <span className="text-lg font-semibold tracking-tight">
                brightsteps
              </span>
            </Link>
            <Button variant="outline" asChild>
              <Link href="/login">Back to login</Link>
            </Button>
          </div>
        </header>
        <main className="mx-auto max-w-md px-6 py-16">
          <Card>
            <CardHeader>
              <CardTitle>Reset link expired</CardTitle>
              <p className="text-sm text-muted-foreground">{message}</p>
            </CardHeader>
            <CardContent className="pt-2">
              <Button asChild className="w-full h-11">
                <Link href="/forgot-password">Request a new reset link</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

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
                Set new password
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Enter your new password below.
              </p>
            </CardHeader>
            <form onSubmit={onSubmit} noValidate>
              <CardContent className="grid gap-4 pt-2">
                {status === "success" && (
                  <Alert>
                    <AlertDescription>
                      Your password has been reset. Redirecting to login…
                    </AlertDescription>
                  </Alert>
                )}
                {errors.form && (
                  <Alert variant="destructive">
                    <AlertDescription>{errors.form}</AlertDescription>
                  </Alert>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="reset-password">New password</Label>
                  <Input
                    id="reset-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-10"
                    aria-invalid={Boolean(errors.password)}
                    disabled={status === "loading" || status === "success"}
                    required
                  />
                  {errors.password && (
                    <p className="text-xs text-destructive">{errors.password}</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reset-confirm">Confirm password</Label>
                  <Input
                    id="reset-confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-10"
                    aria-invalid={Boolean(errors.confirmPassword)}
                    disabled={status === "loading" || status === "success"}
                    required
                  />
                  {errors.confirmPassword && (
                    <p className="text-xs text-destructive">
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="mt-1 h-11 w-full bg-[#1e1b19] text-white hover:bg-black"
                  disabled={status === "loading" || status === "success"}
                >
                  {status === "loading" ? "Resetting…" : "Reset password"}
                </Button>
              </CardContent>
            </form>
          </Card>
        </main>
      </div>
    </div>
  );
}
