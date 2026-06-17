import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import {
  Ticket,
  MapPin,
  Clock,
  Sparkles,
  GraduationCap,
  Calendar,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { getPublicProfile } from "@/lib/profile.functions";

const DAY_LABELS: Record<string, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

const profileQuery = (username: string) =>
  queryOptions({
    queryKey: ["public-profile", username],
    queryFn: async () => {
      const data = await getPublicProfile({ data: { username } });
      if (!data) throw notFound();
      return data;
    },
  });

export const Route = createFileRoute("/u/$username")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(profileQuery(params.username)),
  head: ({ params }) => ({
    meta: [
      { title: `@${params.username} — SwapStub` },
      {
        name: "description",
        content: `See what @${params.username} can teach and wants to learn on SwapStub.`,
      },
      { property: "og:title", content: `@${params.username} on SwapStub` },
      {
        property: "og:description",
        content: `Browse @${params.username}'s skill swap stubs.`,
      },
    ],
  }),
  errorComponent: ({ error }) => (
    <AppShell>
      <div className="text-center py-16 text-sm text-[#7a7164]">
        {error instanceof Error ? error.message : "Failed to load profile."}
      </div>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <div className="text-center py-20">
        <h1 className="text-2xl font-semibold">Profile not found</h1>
        <p className="text-sm text-[#7a7164] mt-2">
          That username doesn't exist on SwapStub.
        </p>
        <Link
          to="/discover"
          className="inline-flex items-center gap-1.5 mt-5 px-4 py-2 rounded-lg bg-[#2d2a26] text-[#f9f6f0] text-sm hover:bg-[#1f1d1a]"
        >
          Discover stubs
        </Link>
      </div>
    </AppShell>
  ),
  component: PublicProfilePage,
});

function PublicProfilePage() {
  const { username } = Route.useParams();
  const fetchProfile = useServerFn(getPublicProfile);
  void fetchProfile;
  const { data } = useSuspenseQuery(profileQuery(username));
  const { profile, listings } = data;

  const initials = (profile.displayName || profile.username || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const joined = new Date(profile.joinedAt).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <AppShell>
      {/* Header card */}
      <section className="rounded-2xl border border-[#e7dfd0] bg-white p-5 sm:p-7 flex flex-col sm:flex-row sm:items-start gap-5">
        <div className="h-20 w-20 rounded-2xl bg-[#efe7d6] text-[#5a5346] flex items-center justify-center text-2xl font-medium shrink-0 overflow-hidden">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              {profile.displayName || profile.username}
            </h1>
            <span className="text-sm text-[#7a7164]">@{profile.username}</span>
          </div>
          {profile.bio && (
            <p className="mt-2 text-sm text-[#3a352e] max-w-2xl whitespace-pre-wrap">
              {profile.bio}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#7a7164]">
            {profile.timezone && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> {profile.timezone}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Joined {joined}
            </span>
            {profile.sessionLengthMin && (
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> ~{profile.sessionLengthMin} min sessions
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Skills */}
      <section className="mt-6 grid sm:grid-cols-2 gap-4">
        <SkillsCard
          title="Can teach"
          icon={<Sparkles className="w-4 h-4" />}
          tone="teach"
          items={profile.teachSkills}
        />
        <SkillsCard
          title="Wants to learn"
          icon={<GraduationCap className="w-4 h-4" />}
          tone="learn"
          items={profile.learnSkills}
        />
      </section>

      {/* Availability */}
      {profile.availableDays.length > 0 && (
        <section className="mt-6">
          <h2 className="text-[11px] uppercase tracking-[0.2em] text-[#7a7164] mb-2">
            Usually free
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {(["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const).map((d) => {
              const active = profile.availableDays.includes(d);
              return (
                <span
                  key={d}
                  className={`text-xs px-3 py-1.5 rounded-full border ${
                    active
                      ? "bg-[#2d2a26] text-[#f9f6f0] border-[#2d2a26]"
                      : "border-[#e7dfd0] text-[#bdb29c]"
                  }`}
                >
                  {DAY_LABELS[d]}
                </span>
              );
            })}
          </div>
        </section>
      )}

      {/* Listings */}
      <section className="mt-8">
        <div className="flex items-end justify-between mb-3">
          <h2 className="text-lg font-semibold">Active stubs</h2>
          <span className="text-xs text-[#7a7164]">{listings.length} live</span>
        </div>
        {listings.length === 0 ? (
          <div className="rounded-2xl bg-[#f9f6f0] border border-dashed border-[#d8cfc0] p-8 text-center text-sm text-[#7a7164]">
            No active stubs right now.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {listings.map((l) => (
              <Link
                key={l.id}
                to="/listings/$id"
                params={{ id: l.id }}
                className="rounded-2xl border border-[#e7dfd0] bg-white p-4 hover:border-[#bdaf9c] transition group"
              >
                <div className="flex items-center justify-between text-[11px] text-[#9a9080]">
                  <span className="inline-flex items-center gap-1">
                    <Ticket className="w-3 h-3" /> {l.ticketCode}
                  </span>
                  <span>
                    {new Date(l.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div className="mt-2 text-sm">
                  <div className="font-medium text-[#2d2a26] group-hover:underline">
                    {l.offeredSkill}
                  </div>
                  <div className="text-[11px] text-[#9a9080] uppercase tracking-wide mt-1">
                    in exchange for
                  </div>
                  <div className="font-medium text-[#2d2a26]">{l.wantedSkill}</div>
                </div>
                {l.description && (
                  <p className="mt-3 text-xs text-[#5a5346] line-clamp-2">{l.description}</p>
                )}
                {(l.offeredCategory || l.wantedCategory) && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {l.offeredCategory && (
                      <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#f0e8d8] text-[#5a5346]">
                        {l.offeredCategory.name}
                      </span>
                    )}
                    {l.wantedCategory && (
                      <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#f0e8d8] text-[#5a5346]">
                        {l.wantedCategory.name}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function SkillsCard({
  title,
  icon,
  tone,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  tone: "teach" | "learn";
  items: string[];
}) {
  const palette =
    tone === "teach"
      ? "bg-[#fff3d6] text-[#7a5a14] border-[#f0d99a]"
      : "bg-[#e6e6f5] text-[#3b357a] border-[#c3bee4]";
  return (
    <div className="rounded-2xl border border-[#e7dfd0] bg-white p-4">
      <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#7a7164] inline-flex items-center gap-1.5">
        {icon} {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-[#9a9080] mt-2">Nothing listed yet.</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.map((s) => (
            <span
              key={s}
              className={`text-xs px-2.5 py-1 rounded-full border ${palette}`}
            >
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}