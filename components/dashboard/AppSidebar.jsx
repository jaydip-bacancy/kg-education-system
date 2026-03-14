"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ROLE_MODULES } from "@/lib/auth/constants";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  MessageCircle,
  CreditCard,
  AlertTriangle,
  ShieldCheck,
  Users,
  UsersRound,
  GraduationCap,
  LogIn,
  ClipboardList,
} from "lucide-react";

const STORAGE_KEY = "brightsteps_auth";

function LogoutButton() {
  const router = useRouter();
  const handleLogout = async () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : null;
      const refreshToken = data?.tokens?.refreshToken;
      if (refreshToken) {
        const csrfRes = await fetch("/api/auth/csrf");
        const { csrfToken } = await csrfRes.json();
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken || "",
          },
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch {
      /* ignore */
    }
    localStorage.removeItem(STORAGE_KEY);
    router.replace("/login");
    router.refresh();
  };
  return (
    <Button
      type="button"
      variant="ghost"
      className="mt-2 w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
      onClick={handleLogout}
    >
      <LogOut className="size-4" />
      Sign out
    </Button>
  );
}

const ICONS = {
  Users,
  UsersRound,
  GraduationCap,
  CreditCard,
  AlertTriangle,
  ShieldCheck,
  LogIn,
  MessageCircle,
  ClipboardList,
};

export function AppSidebar({ userRole, userEmail }) {
  const pathname = usePathname();
  const modules = ROLE_MODULES[userRole] || [];

  return (
    <aside className="relative z-10 flex h-full w-56 flex-col border-r border-border bg-card shadow-sm">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-semibold">
          bw
        </div>
        <span className="font-semibold">brightsteps</span>
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto p-3">
        {modules.map((mod) => {
          const Icon = ICONS[mod.icon] || MessageCircle;
          const isActive = pathname === mod.href;
          return (
            <Link key={mod.id} href={mod.href}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                size="lg"
                className={cn(
                  "h-11 w-full justify-start gap-3 text-base",
                  isActive && "bg-muted font-medium"
                )}
              >
                <Icon className="size-5 shrink-0" />
                {mod.label}
              </Button>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-2">
        <p className="truncate px-2 text-xs text-muted-foreground" title={userEmail}>
          {userEmail}
        </p>
        <LogoutButton />
      </div>
    </aside>
  );
}
