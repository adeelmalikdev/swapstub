import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Plus,
  Ticket,
  Pencil,
  Trash2,
  Eye,
  Pause,
  Play,
  Clock,
  Inbox,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import {
  listMyListings,
  updateListing,
  deleteListing,
} from "@/lib/listings.functions";

export const Route = createFileRoute("/listings/")({
  head: () => ({
    meta: [
      { title: "My listings — SwapStub" },
      { name: "description", content: "Manage the skill swap stubs you've posted." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyListingsPage,
});

const DAY_LABELS: Record<string, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
};

function MyListingsPage() {
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
  const fetchMine = useServerFn(listMyListings);
  const toggle = useServerFn(updateListing);
  const removeFn = useServerFn(deleteListing);

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["my-listings"],
    queryFn: () => fetchMine(),
    enabled: authed === true,
  });

  const [busyId, setBusyId] = useState<string | null>(null);

  const handleToggle = async (id: string, isActive: boolean) => {
    setBusyId(id);
    try {
      await toggle({ data: { id, isActive: !isActive } });
      toast.success(isActive ? "Stub paused" : "Stub published");
      qc.invalidateQueries({ queryKey: ["my-listings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Delete stub ${code}? This cannot be undone.`)) return;
    setBusyId(id);
    try {
      await removeFn({ data: { id } });
      toast.success("Stub deleted");
      qc.invalidateQueries({ queryKey: ["my-listings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  };

  const active = listings.filter((l) => l.isActive);
  const paused = listings.filter((l) => !l.isActive);

  return (
    <AppShell>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">My stubs</h1>
          <p className="text-sm text-[#7a7164] mt-1">
            {listings.length} total · {active.length} live · {paused.length} paused
          </p>
        </div>
        <Link
          to="/listings/new"
          className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-[#2d2a26] text-[#f9f6f0] hover:bg-[#1f1d1a] shrink-0"
        >
          <Plus className="w-4 h-4" /> New stub
        </Link>
      </div>

        {isLoading || authed === null ? (
          <div className="text-center py-16 text-[#7a7164] text-sm">Loading your stubs…</div>
        ) : listings.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-8">
            {active.length > 0 && (
              <Section title="Live">
                {active.map((l) => (
                  <ListingRow
                    key={l.id}
                    listing={l}
                    busy={busyId === l.id}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                  />
                ))}
              </Section>
            )}
            {paused.length > 0 && (
              <Section title="Paused">
                {paused.map((l) => (
                  <ListingRow
                    key={l.id}
                    listing={l}
                    busy={busyId === l.id}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                  />
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
      <Ticket className="w-7 h-7 mx-auto text-[#bdaf9c] mb-2" />
      <p className="font-medium">No stubs yet</p>
      <p className="text-sm text-[#7a7164] mt-1">
        Post your first stub to start swapping skills.
      </p>
      <Link
        to="/listings/new"
        className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg bg-[#2d2a26] text-[#f9f6f0] text-sm hover:bg-[#1f1d1a]"
      >
        <Plus className="w-4 h-4" /> Post a stub
      </Link>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[11px] uppercase tracking-[0.2em] text-[#7a7164] mb-2">{title}</h2>
      <div className="grid sm:grid-cols-2 gap-4">{children}</div>
    </section>
  );
}

type Listing = Awaited<ReturnType<typeof listMyListings>>[number];

function ListingRow({
  listing,
  busy,
  onToggle,
  onDelete,
}: {
  listing: Listing;
  busy: boolean;
  onToggle: (id: string, isActive: boolean) => void;
  onDelete: (id: string, code: string) => void;
}) {
  const days = listing.availability?.days ?? [];
  const session = listing.availability?.sessionLengthMin ?? null;

  return (
    <article
      className={
        "relative rounded-2xl bg-[#f9f6f0] border shadow-sm overflow-hidden flex flex-col " +
        (listing.isActive ? "border-[#d8cfc0]" : "border-[#d8cfc0] opacity-80")
      }
    >
      <div className="p-4">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-[#7a7164]">
          <span>Stub · {listing.ticketCode}</span>
          <span
            className={
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] " +
              (listing.isActive
                ? "bg-[#2d2a26] text-[#f9f6f0]"
                : "bg-[#ebe2d5] text-[#7a7164]")
            }
          >
            {listing.isActive ? "Live" : "Paused"}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-start gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#7a7164]">Teaches</div>
            <div className="text-sm font-semibold leading-tight mt-0.5 line-clamp-2">
              {listing.offeredSkill}
            </div>
            {listing.offeredCategory && (
              <div className="text-[11px] text-[#7a7164] mt-0.5">
                {listing.offeredCategory.name}
              </div>
            )}
          </div>
          <div className="text-[#bdaf9c] pt-3">→</div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#7a7164]">Wants</div>
            <div className="text-sm font-semibold leading-tight mt-0.5 line-clamp-2">
              {listing.wantedSkill}
            </div>
            {listing.wantedCategory && (
              <div className="text-[11px] text-[#7a7164] mt-0.5">
                {listing.wantedCategory.name}
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[#7a7164]">
          {days.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ebe2d5]">
              <Clock className="w-3 h-3" />
              {days.map((d) => DAY_LABELS[d] ?? d).join(" · ")}
            </span>
          )}
          {session && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ebe2d5]">
              {session} min
            </span>
          )}
          {listing.pendingRequests > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#2d2a26] text-[#f9f6f0]">
              <Inbox className="w-3 h-3" />
              {listing.pendingRequests} pending
            </span>
          )}
        </div>
      </div>

      <div className="mt-auto border-t border-[#d8cfc0] px-2 py-2 flex items-center justify-between text-xs">
        <Link
          to="/listings/$id"
          params={{ id: listing.id }}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[#5a5448] hover:bg-[#ebe2d5]"
        >
          <Eye className="w-3.5 h-3.5" /> View
        </Link>
        <button
          type="button"
          disabled={busy}
          onClick={() => onToggle(listing.id, listing.isActive)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[#5a5448] hover:bg-[#ebe2d5] disabled:opacity-50"
        >
          {listing.isActive ? (
            <>
              <Pause className="w-3.5 h-3.5" /> Pause
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" /> Publish
            </>
          )}
        </button>
        <button
          type="button"
          disabled
          title="Editing coming soon"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[#bdaf9c] cursor-not-allowed"
        >
          <Pencil className="w-3.5 h-3.5" /> Edit
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onDelete(listing.id, listing.ticketCode)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[#a23b2b] hover:bg-[#f1d9d2] disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </button>
      </div>
    </article>
  );
}