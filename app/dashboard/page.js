"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ROLE_MODULES } from "@/lib/auth/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "brightsteps_auth";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        router.replace("/login");
        return;
      }
      const { user: u } = JSON.parse(raw);
      if (!u?.role) {
        router.replace("/login");
        return;
      }
      setUser(u);
    } catch {
      router.replace("/login");
    }
  }, [router]);

  if (!user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const modules = ROLE_MODULES[user.role] || [];
  const roleLabel = { ADMIN: "Administrator", STAFF: "Staff", PARENT: "Parent" }[user.role] || user.role;

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#6b4e3d]">
          Dashboard
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="mt-1 text-muted-foreground">
          {user.email} · {roleLabel}
        </p>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-medium text-foreground">Quick access</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod) => (
            <Link key={mod.id} href={mod.href}>
              <Card className="border-border bg-card shadow-sm transition-colors hover:bg-accent/50 hover:shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-foreground">{mod.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button variant="secondary" size="sm" className="border-border bg-secondary text-secondary-foreground hover:bg-muted">
                    Open
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
