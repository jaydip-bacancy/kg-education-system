"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatPrice } from "@/lib/pricing";
import { CreditCard, FileText, Send, Plus } from "lucide-react";

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
    .find((r) => r.startsWith("csrfToken="))
    ?.split("=")[1];
  return csrfToken || cookie || "";
}

const STATUS_COLORS = {
  PENDING: "bg-amber-100 text-amber-800",
  PAID: "bg-emerald-100 text-emerald-800",
  OVERDUE: "bg-red-100 text-red-800",
  DRAFT: "bg-slate-100 text-slate-600",
  CANCELLED: "bg-slate-100 text-slate-500",
};

export default function BillingPage() {
  const [user, setUser] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [centers, setCenters] = useState([]);
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [centerFilter, setCenterFilter] = useState("");
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    parentProfileId: "",
    childId: "",
    centerId: "",
    billingCycle: "MONTHLY",
  });
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [sendLoadingId, setSendLoadingId] = useState(null);
  const [sendMessage, setSendMessage] = useState(null);

  const isAdminOrStaff = user && ["ADMIN", "STAFF"].includes(user.role);
  const isParent = user?.role === "PARENT";

  const fetchInvoices = () => {
    if (isParent && user?.id) {
      fetch(`/api/invoices?userId=${encodeURIComponent(user.id)}`)
        .then((r) => r.json())
        .then((data) => setInvoices(Array.isArray(data) ? data : []))
        .catch(() => setInvoices([]));
    } else if (centerFilter) {
      fetch(`/api/invoices?centerId=${encodeURIComponent(centerFilter)}`)
        .then((r) => r.json())
        .then((data) => setInvoices(Array.isArray(data) ? data : []))
        .catch(() => setInvoices([]));
    } else {
      setInvoices([]);
    }
  };

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    if (isAdminOrStaff) {
      fetch("/api/centers")
        .then((r) => r.json())
        .then((data) => {
          setCenters(Array.isArray(data) ? data : []);
          if (data?.length && !centerFilter) setCenterFilter(data[0]?.id || "");
        })
        .catch(() => setCenters([]))
        .finally(() => setLoading(false));
    } else if (isParent) {
      fetchInvoices();
      setLoading(false);
    }
  }, [user, isAdminOrStaff, isParent]);

  useEffect(() => {
    if (user && ((isAdminOrStaff && centerFilter) || isParent)) {
      fetchInvoices();
    }
  }, [centerFilter, user, isAdminOrStaff, isParent]);

  useEffect(() => {
    if (centerFilter && showGenerateDialog) {
      fetch(`/api/parents?centerId=${encodeURIComponent(centerFilter)}`)
        .then((r) => r.json())
        .then((data) => setParents(Array.isArray(data) ? data : []))
        .catch(() => setParents([]));
    } else if (!showGenerateDialog) {
      setParents([]);
    }
  }, [centerFilter, showGenerateDialog]);

  const selectedParent = parents.find((p) => p.id === generateForm.parentProfileId);
  const children = selectedParent?.children || [];

  const handleGenerate = async () => {
    if (!generateForm.parentProfileId || !generateForm.childId || !generateForm.centerId) {
      setGenerateError("Select a parent and child.");
      return;
    }
    setGenerateLoading(true);
    setGenerateError("");
    try {
      const csrf = await getCsrfToken();
      const res = await fetch("/api/invoices/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({
          parentProfileId: generateForm.parentProfileId,
          childId: generateForm.childId,
          centerId: generateForm.centerId,
          billingCycle: generateForm.billingCycle,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setGenerateError(data?.error?.message || "Failed to generate invoice.");
        return;
      }
      setShowGenerateDialog(false);
      setGenerateForm({ parentProfileId: "", childId: "", centerId: centerFilter || "", billingCycle: "MONTHLY" });
      fetchInvoices();
    } catch {
      setGenerateError("Something went wrong.");
    } finally {
      setGenerateLoading(false);
    }
  };

  const handleSend = async (invoiceId) => {
    setSendLoadingId(invoiceId);
    setSendMessage(null);
    try {
      const csrf = await getCsrfToken();
      const res = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.sent) {
        setSendMessage({ type: "success", text: `Invoice sent to ${data.to}` });
      } else if (res.ok && data.sent === false) {
        setSendMessage({ type: "warning", text: data.message || "Email not sent." });
      } else {
        setSendMessage({ type: "error", text: data?.error?.message || "Failed to send." });
      }
      setTimeout(() => setSendMessage(null), 5000);
    } catch {
      setSendMessage({ type: "error", text: "Something went wrong." });
    } finally {
      setSendLoadingId(null);
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#6b4e3d]">
          Billing
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {isParent ? "My invoices" : "Invoices & billing"}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {isParent
            ? "View and manage your childcare invoices."
            : "Generate bills and send invoices to parents."}
        </p>
      </div>

      {sendMessage && (
        <Alert variant={sendMessage.type === "error" ? "destructive" : "default"}>
          <AlertDescription>{sendMessage.text}</AlertDescription>
        </Alert>
      )}

      {isAdminOrStaff && (
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Center</span>
            <Select value={centerFilter} onValueChange={setCenterFilter}>
              <SelectTrigger className="w-48">
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
          </div>
          <Button
            onClick={() => {
              setGenerateForm({
                parentProfileId: "",
                childId: "",
                centerId: centerFilter || "",
                billingCycle: "MONTHLY",
              });
              setShowGenerateDialog(true);
            }}
            disabled={!centerFilter}
          >
            <Plus className="mr-2 size-4" />
            Generate bill
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-5" />
            Invoices
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : invoices.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No invoices yet.
              {isAdminOrStaff && " Generate a bill or wait for parents to register."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {isAdminOrStaff && (
                      <>
                        <th className="pb-3 pr-4 text-left font-medium">Parent</th>
                        <th className="pb-3 pr-4 text-left font-medium">Child</th>
                      </>
                    )}
                    <th className="pb-3 pr-4 text-left font-medium">Amount</th>
                    <th className="pb-3 pr-4 text-left font-medium">Due date</th>
                    <th className="pb-3 pr-4 text-left font-medium">Period</th>
                    <th className="pb-3 pr-4 text-left font-medium">Status</th>
                    {isAdminOrStaff && (
                      <th className="pb-3 pr-4 text-right font-medium">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-border/60">
                      {isAdminOrStaff && (
                        <>
                          <td className="py-3 pr-4">
                            <div>{inv.parentName || "—"}</div>
                            <div className="text-xs text-muted-foreground">{inv.parentEmail}</div>
                          </td>
                          <td className="py-3 pr-4">{inv.childName || "—"}</td>
                        </>
                      )}
                      <td className="py-3 pr-4 font-medium">
                        {formatPrice(inv.amountCents)}
                      </td>
                      <td className="py-3 pr-4">
                        {inv.dueDate
                          ? new Date(inv.dueDate).toLocaleDateString("en-US")
                          : "—"}
                      </td>
                      <td className="py-3 pr-4">
                        {inv.periodStart && inv.periodEnd
                          ? `${new Date(inv.periodStart).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })} – ${new Date(inv.periodEnd).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}`
                          : "—"}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            STATUS_COLORS[inv.status] || "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      {isAdminOrStaff && (
                        <td className="py-3 pr-4 text-right">
                          {inv.status === "PENDING" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSend(inv.id)}
                              disabled={sendLoadingId === inv.id}
                            >
                              {sendLoadingId === inv.id ? (
                                "Sending…"
                              ) : (
                                <>
                                  <Send className="mr-1.5 size-3.5" />
                                  Send to parent
                                </>
                              )}
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate invoice</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {generateError && (
              <Alert variant="destructive">
                <AlertDescription>{generateError}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-2">
              <label className="text-sm font-medium">Parent</label>
              <Select
                value={generateForm.parentProfileId}
                onValueChange={(v) =>
                  setGenerateForm((p) => ({
                    ...p,
                    parentProfileId: v,
                    childId: "",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select parent" />
                </SelectTrigger>
                <SelectContent>
                  {parents.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {[p.firstName, p.lastName].filter(Boolean).join(" ")} ({p.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Child</label>
              <Select
                value={generateForm.childId}
                onValueChange={(v) =>
                  setGenerateForm((p) => ({ ...p, childId: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select child" />
                </SelectTrigger>
                <SelectContent>
                  {children.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {[c.firstName, c.lastName].filter(Boolean).join(" ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={generateLoading}>
              {generateLoading ? "Generating…" : "Generate invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
