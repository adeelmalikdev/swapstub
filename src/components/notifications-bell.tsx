import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, MessageCircle, Calendar, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/notifications.functions";

export function NotificationsBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const list = useServerFn(listMyNotifications);
  const markOne = useServerFn(markNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);

  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: () => list(),
    refetchOnWindowFocus: true,
  });
  const items = q.data?.items ?? [];
  const unread = q.data?.unread ?? 0;

  // Realtime: refresh on any insert/update for me.
  useEffect(() => {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["notifications"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function onClickItem(id: string) {
    try {
      await markOne({ data: { id } });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    } catch {
      // ignore
    }
  }

  async function onMarkAll() {
    try {
      await markAll();
      qc.invalidateQueries({ queryKey: ["notifications"] });
    } catch {
      // ignore
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-[#ebe2d5] transition"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4 text-[#2d2a26]" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#a23b2b] text-[#f9f6f0] text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[340px] max-w-[calc(100vw-2rem)] bg-white border border-[#e7dfd0] rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#e7dfd0]">
            <div className="text-sm font-bold tracking-tight">Notifications</div>
            {unread > 0 && (
              <button
                type="button"
                onClick={onMarkAll}
                className="text-[11px] uppercase tracking-wider text-[#7a7164] hover:text-foreground"
              >
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-[60vh] overflow-y-auto divide-y divide-[#f0e8d8]">
            {items.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm text-[#7a7164]">
                No notifications yet
              </li>
            ) : (
              items.map((n) => (
                <li key={n.id}>
                  <Link
                    to={n.link ?? "/dashboard"}
                    onClick={() => {
                      void onClickItem(n.id);
                      setOpen(false);
                    }}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-[#faf6ed] transition ${
                      n.read_at ? "" : "bg-[#fbf4e2]"
                    }`}
                  >
                    <span className="mt-0.5 shrink-0 w-7 h-7 rounded-full bg-[#ebe2d5] text-[#5a5346] flex items-center justify-center">
                      <KindIcon kind={n.kind} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium leading-tight text-[#2d2a26]">
                        {n.title}
                      </div>
                      {n.body && (
                        <div className="text-xs text-[#7a7164] line-clamp-2 mt-0.5">{n.body}</div>
                      )}
                      <div className="text-[10px] uppercase tracking-wider text-[#9a9080] mt-1">
                        {timeAgo(n.created_at)}
                      </div>
                    </div>
                    {!n.read_at && (
                      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#a23b2b] shrink-0" />
                    )}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function KindIcon({ kind }: { kind: string }) {
  if (kind === "message") return <MessageCircle className="w-3.5 h-3.5" />;
  if (kind === "review") return <Star className="w-3.5 h-3.5" />;
  return <Calendar className="w-3.5 h-3.5" />;
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