"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/dashboard/AppSidebar";

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

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = getStoredUser();
    if (!u || !u.role) {
      router.replace("/login");
      return;
    }
    const validRoles = ["ADMIN", "STAFF", "PARENT"];
    if (!validRoles.includes(u.role)) {
      router.replace("/login");
      return;
    }
    setUser(u);
    setLoading(false);
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen gap-8 overflow-hidden bg-background">
      {/* Decorative blur orbs matching app theme */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-28 h-80 w-80 rounded-full bg-[#ffd9b8]/40 blur-3xl" />
        <div className="absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-[#c6e7ff]/40 blur-3xl" />
        <div className="absolute top-20 right-1/4 h-40 w-40 rounded-full bg-[#ffe9f0]/40 blur-3xl" />
      </div>
      <AppSidebar userRole={user.role} userEmail={user.email} />
      <main className="relative z-10 flex-1 overflow-y-auto">
        <div className="container py-6">{children}</div>
      </main>
    </div>
  );
}
