import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Calendar, Clock, Ticket, Check, X, CircleCheck, Ban, Star } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { listMyBookings, updateBookingStatus } from "@/lib/bookings.functions";
import { submitReview } from "@/lib/reviews.functions";

export const Route = createFileRoute("/bookings")({
  head: () => ({
    meta: [
      { title: "Bookings — SwapStub" },
      { name: "description", content: "Your upcoming and past skill swap sessions." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BookingsPage,
});

type Booking = Awaited<ReturnType<typeof listMyBookings>>[number];

const STATUS_STYLES: Record<Booking["status"], string> = {
  pending: "bg-[#fff3d6] text-[#7a5a14] border-[#f0d99a]",
  accepted: "bg-[#dcefe2] text-[#205a36] border-[#b7ddc4]",
  declined: "bg-[#f1e0e0] text-[#7a3535] border-[#e1bcbc]",
  completed: "bg-[#e6e6f5] text-[#3b357a] border-[#c3bee4]",
  cancelled: "bg-[#ece9e3] text-[#5a544b] border-[#cfc7b8]",
};

function BookingsPage() {
  const navigate = useNavigate();
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
  const fetchMine = useServerFn(listMyBookings);
  const updateFn = useServerFn(updateBookingStatus);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["my-bookings"],
    queryFn: () => fetchMine(),
    enabled: authed === true,
  });

  const [busyId, setBusyId] = useState<string | null>(null);

  const act = async (id: string, action: "accept" | "decline" | "cancel" | "complete") => {
    setBusyId(id);
    try {
      await updateFn({ data: { id, action } });
      toast.success(
        action === "accept"
          ? "Swap accepted"
          : action === "decline"
            ? "Swap declined"
            : action === "cancel"
              ? "Swap cancelled"
              : "Marked as completed",
      );
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const { incoming, outgoing, past } = useMemo(() => {
    const now = Date.now();
    const incoming: Booking[] = [];
    const outgoing: Booking[] = [];
    const past: Booking[] = [];
    for (const b of bookings) {
      const isPast =
        b.status === "completed" ||
        b.status === "declined" ||
        b.status === "cancelled" ||
        new Date(b.scheduledAt).getTime() < now - 24 * 60 * 60 * 1000;
      if (isPast) past.push(b);
      else if (b.role === "host") incoming.push(b);
      else outgoing.push(b);
    }
    return { incoming, outgoing, past };
  }, [bookings]);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Bookings</h1>
        <p className="text-sm text-[#7a7164] mt-1">
          {bookings.length} total · {incoming.length} need your response ·{" "}
          {outgoing.length} awaiting reply
        </p>
      </div>

      {isLoading || authed === null ? (
        <div className="text-center py-16 text-[#7a7164] text-sm">Loading bookings…</div>
      ) : bookings.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-10">
          {incoming.length > 0 && (
            <Section
              title="Incoming requests"
              hint="People want to swap on your stubs."
            >
              {incoming.map((b) => (
                <BookingCard key={b.id} b={b} busy={busyId === b.id} onAction={act} />
              ))}
            </Section>
          )}
          {outgoing.length > 0 && (
            <Section title="Your requests" hint="Swaps you've proposed.">
              {outgoing.map((b) => (
                <BookingCard key={b.id} b={b} busy={busyId === b.id} onAction={act} />
              ))}
            </Section>
          )}
          {past.length > 0 && (
            <Section title="History" hint="Completed, declined, and cancelled swaps.">
              {past.map((b) => (
                <BookingCard key={b.id} b={b} busy={busyId === b.id} onAction={act} />
              ))}
            </Section>
          )}
        </div>
      )}
    </AppShell>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl bg-[#f9f6f0] border border-dashed border-[#d8cfc0] p-10 text-center">
      <Calendar className="w-7 h-7 mx-auto text-[#bdaf9c] mb-2" />
      <p className="font-medium">No bookings yet</p>
      <p className="text-sm text-[#7a7164] mt-1">
        Browse stubs and propose a swap to get one on the books.
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

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-[#7a7164]">{title}</h2>
        {hint && <p className="text-xs text-[#9a9080] mt-0.5">{hint}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function BookingCard({
  b,
  busy,
  onAction,
}: {
  b: Booking;
  busy: boolean;
  onAction: (id: string, action: "accept" | "decline" | "cancel" | "complete") => void;
}) {
  const other = b.role === "host" ? b.requester : b.host;
  const initials = (other?.display_name || other?.username || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const canAcceptDecline = b.role === "host" && b.status === "pending";
  const canCancel =
    (b.status === "pending" || b.status === "accepted") &&
    // requesters can cancel anytime, hosts only their accepted ones
    (b.role === "requester" || b.status === "accepted");
  const canComplete = b.status === "accepted";

  return (
    <article className="rounded-2xl border border-[#e7dfd0] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-3 sm:gap-4">
        <div className="h-10 w-10 rounded-full bg-[#efe7d6] text-[#5a5346] flex items-center justify-center text-sm font-medium shrink-0">
          {other?.avatar_url ? (
            <img
              src={other.avatar_url}
              alt=""
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            initials
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">
              {other?.display_name || other?.username || "Unknown"}
            </span>
            <span
              className={`text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${STATUS_STYLES[b.status]}`}
            >
              {b.status}
            </span>
            <span className="text-[11px] text-[#9a9080]">
              {b.role === "host" ? "incoming" : "outgoing"}
            </span>
          </div>

          <div className="mt-1 text-sm text-[#3a352e]">
            <span className="font-medium">{b.listing?.offered_skill ?? "—"}</span>
            <span className="text-[#9a9080]"> for </span>
            <span className="font-medium">{b.listing?.wanted_skill ?? "—"}</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#7a7164]">
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> {formatWhen(b.scheduledAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> {b.durationMin} min
            </span>
            {b.listing?.ticket_code && (
              <Link
                to="/listings/$id"
                params={{ id: b.listing.id }}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <Ticket className="w-3.5 h-3.5" /> {b.listing.ticket_code}
              </Link>
            )}
          </div>

          {b.message && (
            <p className="mt-3 text-sm text-[#3a352e] bg-[#f9f6f0] rounded-lg px-3 py-2 border border-[#ece4d2]">
              "{b.message}"
            </p>
          )}
        </div>
      </div>

      {(canAcceptDecline || canCancel || canComplete) && (
        <div className="mt-4 flex flex-wrap gap-2 justify-end">
          {canAcceptDecline && (
            <>
              <button
                disabled={busy}
                onClick={() => onAction(b.id, "decline")}
                className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[#e1bcbc] text-[#7a3535] hover:bg-[#fbf0f0] disabled:opacity-50"
              >
                <X className="w-4 h-4" /> Decline
              </button>
              <button
                disabled={busy}
                onClick={() => onAction(b.id, "accept")}
                className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-[#2d2a26] text-[#f9f6f0] hover:bg-[#1f1d1a] disabled:opacity-50"
              >
                <Check className="w-4 h-4" /> Accept
              </button>
            </>
          )}
          {canComplete && (
            <button
              disabled={busy}
              onClick={() => onAction(b.id, "complete")}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[#b7ddc4] text-[#205a36] hover:bg-[#f0f9f3] disabled:opacity-50"
            >
              <CircleCheck className="w-4 h-4" /> Mark completed
            </button>
          )}
          {canCancel && (
            <button
              disabled={busy}
              onClick={() => onAction(b.id, "cancel")}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[#cfc7b8] text-[#5a544b] hover:bg-[#f5f2eb] disabled:opacity-50"
            >
              <Ban className="w-4 h-4" /> Cancel
            </button>
          )}
        </div>
      )}
    </article>
  );
}