import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Clock, MapPin, Sparkles } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { getListing, proposeSwap } from "@/lib/listings.functions";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/listings/$id")({
  head: () => ({
    meta: [
      { title: "Stub — SwapStub" },
      { name: "description", content: "View a SwapStub skill swap stub and propose a session." },
    ],
  }),
  component: ListingDetailPage,
});

const DAY_LABELS: Record<string, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
};
const SESSION_LENGTHS = [30, 45, 60, 90, 120];

const inputClass =
  "w-full px-4 py-3 rounded-xl bg-[#ebe2d5]/50 border border-[#d8cfc0] focus:border-[#2d2a26] focus:ring-0 text-sm outline-none transition-all placeholder:text-[#bdaf9c] text-[#2d2a26]";

function ListingDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const fetchListing = useServerFn(getListing);
  const { data: listing, isLoading } = useQuery({
    queryKey: ["listing", id],
    queryFn: () => fetchListing({ data: { id } }),
  });

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  const isAuthed = currentUserId !== null;
  const isOwn = listing && currentUserId && listing.userId === currentUserId;

  // Propose form state
  const defaultDateTime = useMemo(() => {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, []);
  const [scheduledAt, setScheduledAt] = useState(defaultDateTime);
  const [durationMin, setDurationMin] = useState<number>(60);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const propose = useServerFn(proposeSwap);

  useEffect(() => {
    if (listing?.availability?.sessionLengthMin) {
      setDurationMin(listing.availability.sessionLengthMin);
    }
  }, [listing?.availability?.sessionLengthMin]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthed) {
      navigate({ to: "/auth" });
      return;
    }
    if (!listing) return;
    if (message.trim().length < 1) {
      toast.error("Add a short message so they know what you'd like to swap.");
      return;
    }
    setSubmitting(true);
    try {
      const iso = new Date(scheduledAt).toISOString();
      const res = await propose({
        data: { listingId: listing.id, scheduledAt: iso, durationMin, message: message.trim() },
      });
      toast.success(`Swap proposed — booking ${res.ticketCode}`);
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send proposal");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div>
        {isLoading ? (
          <div className="text-center py-16 text-[#7a7164] text-sm">Loading stub…</div>
        ) : !listing ? (
          <div className="rounded-2xl bg-[#f9f6f0] border border-dashed border-[#d8cfc0] p-10 text-center">
            <p className="font-medium">This stub isn't available</p>
            <p className="text-sm text-[#7a7164] mt-1">It may have been paused or removed.</p>
            <Link
              to="/discover"
              className="inline-block mt-4 px-4 py-2 rounded-lg bg-[#2d2a26] text-[#f9f6f0] text-sm hover:bg-[#1f1d1a]"
            >
              Back to Discover
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6">
            {/* Stub card */}
            <article className="relative rounded-2xl bg-[#f9f6f0] border border-[#d8cfc0] shadow-sm overflow-hidden">
              <div
                className="absolute left-0 right-0 top-[42%] h-px"
                style={{
                  backgroundImage: "linear-gradient(90deg, #c9bfae 50%, transparent 50%)",
                  backgroundSize: "8px 1px",
                }}
              />
              <div className="p-5 sm:p-6">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-[#7a7164]">
                  <span>Stub · {listing.ticketCode}</span>
                  <span>{new Date(listing.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-start gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[#7a7164]">
                      Teaches
                    </div>
                    <div className="text-lg font-semibold leading-tight mt-1">
                      {listing.offeredSkill}
                    </div>
                    {listing.offeredCategory && (
                      <div className="text-xs text-[#7a7164] mt-0.5">
                        {listing.offeredCategory.name}
                      </div>
                    )}
                  </div>
                  <div className="text-[#bdaf9c] pt-4">→</div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[#7a7164]">
                      Wants
                    </div>
                    <div className="text-lg font-semibold leading-tight mt-1">
                      {listing.wantedSkill}
                    </div>
                    {listing.wantedCategory && (
                      <div className="text-xs text-[#7a7164] mt-0.5">
                        {listing.wantedCategory.name}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="px-5 sm:px-6 pt-6 pb-5">
                {listing.description && (
                  <p className="text-sm text-[#5a5448] mb-4 whitespace-pre-wrap">
                    {listing.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 text-xs text-[#7a7164]">
                  {listing.availability?.days?.length ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#ebe2d5]">
                      <Clock className="w-3 h-3" />
                      {listing.availability.days.map((d) => DAY_LABELS[d] ?? d).join(" · ")}
                    </span>
                  ) : null}
                  {listing.availability?.sessionLengthMin && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#ebe2d5]">
                      {listing.availability.sessionLengthMin} min sessions
                    </span>
                  )}
                  {listing.author?.timezone && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#ebe2d5]">
                      <MapPin className="w-3 h-3" />
                      {listing.author.timezone}
                    </span>
                  )}
                </div>

                {listing.author && (
                  <div className="mt-5 pt-5 border-t border-[#d8cfc0] flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#2d2a26] text-[#f9f6f0] flex items-center justify-center font-semibold">
                      {(listing.author.display_name || listing.author.username || "?")
                        .trim()
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#2d2a26]">
                        {listing.author.display_name || listing.author.username || "Someone"}
                        {listing.author.username && (
                          <span className="text-[#bdaf9c] font-normal">
                            {" "}· @{listing.author.username}
                          </span>
                        )}
                      </div>
                      {listing.author.bio && (
                        <p className="text-xs text-[#7a7164] mt-1 line-clamp-3">
                          {listing.author.bio}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </article>

            {/* Propose form */}
            <section className="rounded-2xl bg-[#f9f6f0] border border-[#d8cfc0] shadow-sm p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-[#7a7164]" />
                <h2 className="text-lg font-semibold tracking-tight">Propose a swap</h2>
              </div>
              <p className="text-sm text-[#7a7164] mb-5">
                Send a session proposal. They'll be notified and can accept, suggest a new time,
                or decline.
              </p>

              {isOwn ? (
                <div className="rounded-xl bg-[#ebe2d5]/60 border border-[#d8cfc0] p-4 text-sm text-[#5a5448]">
                  This is your own stub. Share it with someone or edit it from your dashboard.
                </div>
              ) : !isAuthed ? (
                <div className="rounded-xl bg-[#ebe2d5]/60 border border-[#d8cfc0] p-4 text-sm text-[#5a5448]">
                  <p className="mb-3">Sign in to propose a swap.</p>
                  <Link
                    to="/auth"
                    className="inline-block px-4 py-2 rounded-lg bg-[#2d2a26] text-[#f9f6f0] text-sm hover:bg-[#1f1d1a]"
                  >
                    Sign in
                  </Link>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[#7a7164] mb-1">
                      When
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[#7a7164] mb-2">
                      Length
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {SESSION_LENGTHS.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setDurationMin(m)}
                          className={
                            "px-3 py-1.5 rounded-lg text-sm border transition-colors " +
                            (durationMin === m
                              ? "bg-[#2d2a26] text-[#f9f6f0] border-[#2d2a26]"
                              : "bg-transparent text-[#5a5448] border-[#d8cfc0] hover:border-[#2d2a26]")
                          }
                        >
                          {m} min
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[#7a7164] mb-1">
                      Message
                    </label>
                    <textarea
                      required
                      rows={4}
                      maxLength={1000}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={`Hey! I'd love to learn ${listing.offeredSkill}. I can teach ${listing.wantedSkill}…`}
                      className={inputClass + " resize-none"}
                    />
                    <div className="text-[11px] text-[#bdaf9c] mt-1 text-right">
                      {message.length}/1000
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full px-4 py-3 rounded-xl bg-[#2d2a26] text-[#f9f6f0] text-sm font-medium hover:bg-[#1f1d1a] disabled:opacity-60"
                  >
                    {submitting ? "Sending proposal…" : "Send swap proposal"}
                  </button>
                </form>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}