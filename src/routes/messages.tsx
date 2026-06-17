import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { Inbox, Send, Ticket, Calendar, ArrowLeft } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { listMyThreads, getThread, sendMessage } from "@/lib/messages.functions";

const searchSchema = z.object({ t: z.string().uuid().optional() });

export const Route = createFileRoute("/messages")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Messages — SwapStub" },
      { name: "description", content: "Chat with your swap partners." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MessagesPage,
});

function MessagesPage() {
  const navigate = useNavigate();
  const { t: activeId } = Route.useSearch();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      if (!data.user) navigate({ to: "/auth", replace: true });
      else setAuthed(true);
    });
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const qc = useQueryClient();
  const fetchThreads = useServerFn(listMyThreads);
  const fetchThread = useServerFn(getThread);
  const sendFn = useServerFn(sendMessage);

  const threadsQ = useQuery({
    queryKey: ["threads"],
    queryFn: () => fetchThreads(),
    enabled: authed === true,
    refetchInterval: 30_000,
  });

  const threadQ = useQuery({
    queryKey: ["thread", activeId],
    queryFn: () => fetchThread({ data: { id: activeId! } }),
    enabled: authed === true && !!activeId,
  });

  // Realtime: new/updated messages refresh the open thread + threads list.
  useEffect(() => {
    if (authed !== true) return;
    const channel = supabase
      .channel("messages-stream")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          const row = (payload.new ?? payload.old) as { thread_id?: string } | null;
          qc.invalidateQueries({ queryKey: ["threads"] });
          if (row?.thread_id) {
            qc.invalidateQueries({ queryKey: ["thread", row.thread_id] });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [authed, qc]);

  const threads = threadsQ.data ?? [];
  const thread = threadQ.data;

  // Auto-select first thread on desktop if none selected.
  useEffect(() => {
    if (!activeId && threads.length > 0 && window.innerWidth >= 768) {
      navigate({
        to: "/messages",
        search: { t: threads[0].id },
        replace: true,
      });
    }
  }, [activeId, threads, navigate]);

  const select = (id: string) => navigate({ to: "/messages", search: { t: id } });
  const back = () => navigate({ to: "/messages", search: {} });

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Messages</h1>
        <p className="text-sm text-[#7a7164] mt-1">Chat with your swap partners.</p>
      </div>

      {authed === null ? (
        <div className="text-center py-16 text-[#7a7164] text-sm">Loading…</div>
      ) : threads.length === 0 && !threadsQ.isLoading ? (
        <EmptyState />
      ) : (
        <div className="grid md:grid-cols-[320px_1fr] gap-4 border border-[#e7dfd0] rounded-2xl overflow-hidden bg-white min-h-[60vh]">
          {/* Thread list */}
          <aside
            className={`md:border-r border-[#e7dfd0] ${activeId ? "hidden md:block" : "block"}`}
          >
            <ul className="divide-y divide-[#f0e8d8]">
              {threads.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => select(t.id)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-[#faf6ed] transition ${
                      activeId === t.id ? "bg-[#f5efe0]" : ""
                    }`}
                  >
                    <Avatar name={t.other?.display_name || t.other?.username} url={t.other?.avatar_url} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate text-sm">
                          {t.other?.display_name || t.other?.username || "Unknown"}
                        </span>
                        <span className="text-[10px] text-[#9a9080] shrink-0">
                          {t.lastMessageAt ? timeAgo(t.lastMessageAt) : ""}
                        </span>
                      </div>
                      <p className="text-xs text-[#7a7164] truncate mt-0.5">
                        {t.lastMessage
                          ? `${t.lastMessage.fromMe ? "You: " : ""}${t.lastMessage.body}`
                          : "No messages yet"}
                      </p>
                    </div>
                    {t.unread > 0 && (
                      <span className="bg-[#2d2a26] text-[#f9f6f0] text-[10px] rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                        {t.unread}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {/* Conversation */}
          <section className={`flex flex-col ${activeId ? "block" : "hidden md:flex"}`}>
            {!activeId ? (
              <div className="flex-1 flex items-center justify-center text-sm text-[#7a7164] p-10">
                Select a conversation
              </div>
            ) : !thread ? (
              <div className="flex-1 flex items-center justify-center text-sm text-[#7a7164] p-10">
                Loading…
              </div>
            ) : (
              <Conversation
                thread={thread}
                onBack={back}
                onSend={async (body) => {
                  try {
                    await sendFn({ data: { threadId: thread.id, body } });
                    qc.invalidateQueries({ queryKey: ["thread", thread.id] });
                    qc.invalidateQueries({ queryKey: ["threads"] });
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Send failed");
                    throw e;
                  }
                }}
              />
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}

function Avatar({ name, url }: { name?: string | null; url?: string | null }) {
  const initials = (name || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="h-9 w-9 rounded-full bg-[#efe7d6] text-[#5a5346] flex items-center justify-center text-xs font-medium shrink-0 overflow-hidden">
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : initials}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl bg-[#f9f6f0] border border-dashed border-[#d8cfc0] p-10 text-center">
      <Inbox className="w-7 h-7 mx-auto text-[#bdaf9c] mb-2" />
      <p className="font-medium">No messages yet</p>
      <p className="text-sm text-[#7a7164] mt-1">
        Propose a swap on a stub to start a conversation.
      </p>
      <Link
        to="/discover"
        className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg bg-[#2d2a26] text-[#f9f6f0] text-sm hover:bg-[#1f1d1a]"
      >
        Discover stubs
      </Link>
    </div>
  );
}

type Thread = NonNullable<Awaited<ReturnType<typeof getThread>>>;

function Conversation({
  thread,
  onBack,
  onSend,
}: {
  thread: Thread;
  onBack: () => void;
  onSend: (body: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [thread.messages.length, thread.id]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [thread.id]);

  const grouped = useMemo(() => groupByDay(thread.messages), [thread.messages]);

  const submit = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await onSend(body);
      setDraft("");
    } catch {
      // toast already shown
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <>
      <header className="border-b border-[#e7dfd0] px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="md:hidden text-[#7a7164] hover:text-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Avatar
          name={thread.other?.display_name || thread.other?.username}
          url={thread.other?.avatar_url}
        />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">
            {thread.other?.display_name || thread.other?.username || "Unknown"}
          </div>
          {thread.booking && (
            <div className="text-[11px] text-[#7a7164] flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <span className="inline-flex items-center gap-1">
                <Ticket className="w-3 h-3" /> {thread.booking.ticket_code}
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" />{" "}
                {new Date(thread.booking.scheduled_at).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              <span className="uppercase tracking-wide">· {thread.booking.status}</span>
            </div>
          )}
        </div>
        <Link
          to="/bookings"
          className="text-xs text-[#7a7164] hover:text-foreground hidden sm:inline"
        >
          View booking
        </Link>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-[#fbf8f1]">
        {thread.messages.length === 0 ? (
          <div className="text-center text-xs text-[#9a9080] py-10">
            No messages yet. Say hi!
          </div>
        ) : (
          grouped.map((g) => (
            <div key={g.day} className="space-y-2">
              <div className="text-center text-[10px] uppercase tracking-[0.2em] text-[#9a9080]">
                {g.day}
              </div>
              {g.items.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words ${
                      m.fromMe
                        ? "bg-[#2d2a26] text-[#f9f6f0] rounded-br-md"
                        : "bg-white border border-[#e7dfd0] text-[#2d2a26] rounded-bl-md"
                    }`}
                  >
                    {m.body}
                    <div
                      className={`text-[10px] mt-1 ${
                        m.fromMe ? "text-[#cfc8b9]" : "text-[#9a9080]"
                      }`}
                    >
                      {new Date(m.createdAt).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="border-t border-[#e7dfd0] p-3 flex items-end gap-2 bg-white"
      >
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder="Write a message…"
          className="flex-1 resize-none rounded-xl border border-[#e7dfd0] bg-[#faf6ed] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d2a26] max-h-32"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-[#2d2a26] text-[#f9f6f0] hover:bg-[#1f1d1a] disabled:opacity-40"
          aria-label="Send"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </>
  );
}

function groupByDay(msgs: Thread["messages"]) {
  const groups: { day: string; items: Thread["messages"] }[] = [];
  for (const m of msgs) {
    const day = new Date(m.createdAt).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(m);
    else groups.push({ day, items: [m] });
  }
  return groups;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}