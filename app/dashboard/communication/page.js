"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Plus, Send, Users } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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

function formatRelativeTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatMessageTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getInitials(name) {
  const parts = String(name || "")
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) return "?";
  return parts.map((part) => part[0]).join("").toUpperCase();
}

function getOtherParticipant(thread, userId) {
  return (thread?.participants || []).find((participant) => participant.userId !== userId) || null;
}

export default function CommunicationPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [threads, setThreads] = useState([]);
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const [activeThread, setActiveThread] = useState(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [startChatContactId, setStartChatContactId] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [creatingThread, setCreatingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [bootError, setBootError] = useState("");
  const [actionError, setActionError] = useState("");
  const messagesEndRef = useRef(null);

  const activeContact = useMemo(
    () => getOtherParticipant(activeThread, currentUser?.id),
    [activeThread, currentUser?.id]
  );

  const contactLabel = currentUser?.role === "PARENT" ? "Staff member" : "Parent";
  const startChatHint =
    currentUser?.role === "PARENT"
      ? "Choose a teacher or admin to open a chat instantly."
      : "Choose a parent to open a chat instantly.";

  useEffect(() => {
    setCurrentUser(getStoredUser());
  }, []);

  const loadThreads = useCallback(async ({ preserveSelection = true, preferredThreadId = "" } = {}) => {
    if (!currentUser?.id) return;

    const response = await fetch(
      `/api/communication/threads?userId=${encodeURIComponent(currentUser.id)}`
    );
    const data = await response.json().catch(() => []);
    const nextThreads = Array.isArray(data) ? data : [];

    setThreads(nextThreads);

    const preferredStillExists = preferredThreadId
      ? nextThreads.some((thread) => thread.id === preferredThreadId)
      : false;
    const stillSelected = nextThreads.some((thread) => thread.id === selectedThreadId);
    const nextSelectedId = preferredStillExists
      ? preferredThreadId
      : preserveSelection && stillSelected
        ? selectedThreadId
        : nextThreads[0]?.id || "";

    if (nextSelectedId !== selectedThreadId) {
      setSelectedThreadId(nextSelectedId);
    }

    if (!nextSelectedId) {
      setActiveThread(null);
    }
  }, [currentUser?.id, selectedThreadId]);

  const loadThreadDetail = useCallback(async (threadId) => {
    if (!currentUser?.id || !threadId) {
      setActiveThread(null);
      return;
    }

    setThreadLoading(true);
    try {
      const response = await fetch(
        `/api/communication/threads/${threadId}?userId=${encodeURIComponent(currentUser.id)}`
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.id) {
        setActiveThread(null);
        return;
      }

      setActiveThread(data);
      setThreads((prev) =>
        prev.map((thread) =>
          thread.id === threadId ? { ...thread, unreadCount: 0 } : thread
        )
      );
    } finally {
      setThreadLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setBootError("");

      try {
        const [contactsResponse, threadsResponse] = await Promise.all([
          fetch(`/api/communication/contacts?userId=${encodeURIComponent(currentUser.id)}`),
          fetch(`/api/communication/threads?userId=${encodeURIComponent(currentUser.id)}`),
        ]);

        const contactsData = await contactsResponse.json().catch(() => null);
        const threadsData = await threadsResponse.json().catch(() => []);

        if (!contactsResponse.ok || !contactsData?.currentUser) {
          throw new Error(contactsData?.error?.message || "Unable to load your chats.");
        }

        if (cancelled) return;

        setCurrentUser((prev) => ({ ...prev, ...contactsData.currentUser }));
        setContacts(Array.isArray(contactsData.contacts) ? contactsData.contacts : []);

        const nextThreads = Array.isArray(threadsData) ? threadsData : [];
        setThreads(nextThreads);
        setSelectedThreadId(nextThreads[0]?.id || "");
      } catch (error) {
        if (cancelled) return;
        setBootError(error?.message || "Unable to load your chats.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!selectedThreadId) {
      setActiveThread(null);
      return;
    }

    loadThreadDetail(selectedThreadId);
  }, [selectedThreadId, loadThreadDetail]);

  useEffect(() => {
    if (!currentUser?.id) return;

    const intervalId = setInterval(() => {
      loadThreads({ preserveSelection: true });
      if (selectedThreadId) {
        loadThreadDetail(selectedThreadId);
      }
    }, 15000);

    return () => clearInterval(intervalId);
  }, [currentUser?.id, selectedThreadId, loadThreadDetail, loadThreads]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeThread?.messages?.length, selectedThreadId]);

  const openNewChat = () => {
    setNewChatOpen(true);
    setActionError("");
    setStartChatContactId("");
  };

  const cancelNewChat = () => {
    setNewChatOpen(false);
    setActionError("");
    setStartChatContactId("");
  };

  const handleCreateConversation = async (contactUserId) => {
    if (!currentUser?.id || !contactUserId || contactUserId === "__none__") return;

    setCreatingThread(true);
    setActionError("");
    setStartChatContactId(contactUserId);

    try {
      const token = await getCsrfToken();
      const response = await fetch("/api/communication/threads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": token,
        },
        body: JSON.stringify({
          userId: currentUser.id,
          contactUserId,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.id) {
        setActionError(data?.error?.message || "Unable to open this chat.");
        return;
      }

      setActiveThread(data);
      setSelectedThreadId(data.id);
      setReplyBody("");
      setNewChatOpen(false);
      setStartChatContactId("");
      await loadThreads({ preserveSelection: true, preferredThreadId: data.id });
    } catch {
      setActionError("Unable to open this chat.");
    } finally {
      setCreatingThread(false);
    }
  };

  const handleSendReply = async (event) => {
    event.preventDefault();
    setActionError("");

    if (!currentUser?.id || !selectedThreadId) {
      setActionError("Choose a chat first.");
      return;
    }
    if (!replyBody.trim()) {
      setActionError("Add a message before sending.");
      return;
    }

    setSending(true);
    try {
      const token = await getCsrfToken();
      const response = await fetch(`/api/communication/threads/${selectedThreadId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": token,
        },
        body: JSON.stringify({
          userId: currentUser.id,
          content: replyBody.trim(),
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.id) {
        setActionError(data?.error?.message || "Unable to send your message.");
        return;
      }

      setActiveThread(data);
      setReplyBody("");
      await loadThreads({ preserveSelection: true, preferredThreadId: selectedThreadId });
    } catch {
      setActionError("Unable to send your message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Chat</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Direct chat between parents, teachers, and admins.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-border/60 bg-white/80 px-3 py-2 text-sm text-muted-foreground shadow-sm">
          <Users className="size-4 text-[#6b4e3d]" />
          <span>{threads.length} chat{threads.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      {bootError && (
        <Alert variant="destructive">
          <AlertDescription>{bootError}</AlertDescription>
        </Alert>
      )}
      {actionError && (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="overflow-hidden border border-border/60 bg-white/90 shadow-sm pt-0">
          <CardHeader className="border-b border-border/50 bg-[#fffaf5] pt-6 pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl">Inbox</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Keep every conversation in one place.
                </p>
              </div>
              <Button type="button" size="sm" onClick={openNewChat}>
                <Plus className="size-4" />
                New chat
              </Button>
            </div>
          </CardHeader>
          <CardContent className="max-h-[70vh] space-y-2 overflow-y-auto p-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading chats...</p>
            ) : threads.length === 0 ? (
              <div className="rounded-[var(--radius)] border border-dashed border-border/70 bg-background/60 px-4 py-8 text-center text-sm text-muted-foreground">
                No chats yet. Start one with the button above.
              </div>
            ) : (
              threads.map((thread) => {
                const isActive = thread.id === selectedThreadId && !newChatOpen;
                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => {
                      setNewChatOpen(false);
                      setActionError("");
                      setSelectedThreadId(thread.id);
                    }}
                    className={cn(
                      "w-full rounded-[var(--radius)] border px-3 py-3 text-left transition",
                      isActive
                        ? "border-[#1e1b19]/20 bg-[#fff7f0] shadow-sm"
                        : "border-border/60 bg-background hover:border-border hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">
                          {thread.contact?.displayName || "Conversation"}
                        </div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">
                          {thread.contact?.roleLabel || "Participant"}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[11px] text-muted-foreground">
                          {formatRelativeTime(thread.lastMessage?.createdAt || thread.updatedAt)}
                        </div>
                        {thread.unreadCount > 0 && (
                          <div className="mt-1 inline-flex min-w-5 justify-center rounded-full bg-[#1e1b19] px-1.5 py-0.5 text-[11px] font-semibold text-white">
                            {thread.unreadCount}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 truncate text-sm text-muted-foreground">
                      {thread.lastMessage?.content || "No messages yet."}
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        {newChatOpen ? (
          <Card className="border border-border/60 bg-white/90 shadow-sm">
            <CardHeader className="border-b border-border/50 bg-[#f8fbff] pb-3">
              <CardTitle className="text-xl">Start a chat</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              <div className="rounded-[var(--radius)] border border-dashed border-border/70 bg-background/60 px-4 py-4 text-sm text-muted-foreground">
                {startChatHint}
              </div>
              <div className="grid gap-2">
                <Label>{contactLabel}</Label>
                <Select
                  value={startChatContactId || "__none__"}
                  onValueChange={(value) => {
                    if (value === "__none__") {
                      setStartChatContactId("");
                      return;
                    }
                    void handleCreateConversation(value);
                  }}
                  disabled={!contacts.length || creatingThread}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        contacts.length ? `Choose a ${contactLabel.toLowerCase()}` : "No contacts available"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="__none__">Choose a {contactLabel.toLowerCase()}</SelectItem>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.userId} value={contact.userId}>
                        {contact.displayName} | {contact.roleLabel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {creatingThread ? "Opening chat..." : "The chat opens as soon as you pick someone."}
                </p>
                <Button type="button" variant="outline" onClick={cancelNewChat}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : activeThread ? (
          <Card className="flex min-h-[70vh] flex-col border border-border/60 bg-white/95 shadow-sm">
            <CardHeader className="border-b border-border/50 bg-[#f8fbff] pb-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-full bg-[#1e1b19] text-sm font-semibold text-white">
                    {getInitials(activeContact?.displayName || "Chat")}
                  </div>
                  <div>
                    <CardTitle className="text-xl">
                      {activeContact?.displayName || "Conversation"}
                    </CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {activeContact?.roleLabel || "Participant"}
                    </p>
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>Direct chat</div>
                  <div className="mt-1">Updated {formatRelativeTime(activeThread.updatedAt)}</div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col gap-4 p-4">
              <div className="flex-1 space-y-3 overflow-y-auto rounded-[var(--radius)] border border-border/50 bg-[#fcfcfb] p-3">
                {threadLoading ? (
                  <p className="text-sm text-muted-foreground">Loading conversation...</p>
                ) : activeThread.messages?.length ? (
                  activeThread.messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn("flex", message.isOwn ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                          message.isOwn
                            ? "rounded-br-md bg-[#1e1b19] text-white"
                            : "rounded-bl-md border border-border/60 bg-white text-foreground"
                        )}
                      >
                        <div
                          className={cn(
                            "mb-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
                            message.isOwn ? "text-white/70" : "text-[#6b4e3d]"
                          )}
                        >
                          {message.senderName}
                          {message.senderRoleLabel ? ` | ${message.senderRoleLabel}` : ""}
                        </div>
                        <p className="whitespace-pre-wrap leading-6">{message.content}</p>
                        <div
                          className={cn(
                            "mt-2 text-[11px]",
                            message.isOwn ? "text-white/70" : "text-muted-foreground"
                          )}
                        >
                          {formatMessageTime(message.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[var(--radius)] border border-dashed border-border/70 bg-background/50 px-4 py-8 text-center text-sm text-muted-foreground">
                    Chat created. Send the first message when you&apos;re ready.
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <form className="space-y-3" onSubmit={handleSendReply}>
                <div className="grid gap-2">
                  <Label>Reply</Label>
                  <Textarea
                    rows={4}
                    value={replyBody}
                    onChange={(event) => setReplyBody(event.target.value)}
                    placeholder="Type your message..."
                    className="min-h-28"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={sending || !replyBody.trim()}>
                    <Send className="size-4" />
                    {sending ? "Sending..." : "Send message"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setReplyBody("")}>
                    Clear
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="border border-dashed border-border/70 bg-white/80 shadow-sm">
            <CardContent className="flex min-h-[70vh] flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-[#fff7f0] text-[#6b4e3d]">
                <MessageCircle className="size-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">No chat selected</h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Pick an existing chat from the inbox or start a new one.
                </p>
              </div>
              <Button type="button" onClick={openNewChat} disabled={!contacts.length && !loading}>
                <Plus className="size-4" />
                New chat
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
