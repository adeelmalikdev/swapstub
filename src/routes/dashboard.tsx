import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/app-shell";
import { getDashboardData } from "@/lib/profile.functions";
import {
  Ticket,
  CalendarClock,
  MessageSquare,
  Sparkles,
  Plus,
  X,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — SwapStub" },
      { name: "description", content: "Your SwapStub dashboard." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [today, setToday] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      if (!data.user) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      setAuthed(true);
    });
    if (typeof window !== "undefined") {
      setBannerDismissed(
        window.localStorage.getItem("swapstub:firstListingBannerDismissed") === "1",
      );
    }
    setToday(
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    );
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const fetchDashboard = useServerFn(getDashboardData);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetchDashboard(),
    enabled: authed === true,
  });

  const dismissBanner = () => {
    setBannerDismissed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("swapstub:firstListingBannerDismissed", "1");
    }
  };

  const firstName =
    data?.profile?.display_name?.split(" ")[0] ??
    data?.profile?.username ??
    "friend";

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Greeting */}
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {today || "\u00a0"}
            </p>
            <h1 className="font-[Fraunces] text-4xl sm:text-5xl tracking-tight mt-1">
              Hi, {firstName}.
            </h1>
            <p className="text-muted-foreground mt-1">
              Here are the swaps and conversations waiting for you.
            </p>
          </div>
          <Button size="lg" className="shrink-0" asChild>
            <Link to="/listings/new">
              <Plus className="h-4 w-4 mr-2" /> New listing
            </Link>
          </Button>
        </header>

        {/* First-listing banner */}
        {!isLoading && data && !data.hasAnyListing && !bannerDismissed && (
          <FirstListingBanner onDismiss={dismissBanner} />
        )}

        {/* Stats stubs */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatStub
            icon={<Ticket className="h-4 w-4" />}
            label="Active listings"
            value={data?.stats.activeListings ?? 0}
            tone="primary"
          />
          <StatStub
            icon={<CalendarClock className="h-4 w-4" />}
            label="Upcoming sessions"
            value={data?.stats.upcomingSessions ?? 0}
            tone="secondary"
          />
          <StatStub
            icon={<MessageSquare className="h-4 w-4" />}
            label="Unread messages"
            value={data?.stats.unreadMessages ?? 0}
            tone="accent"
          />
        </section>

        {/* Two-column: matches + activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 space-y-4">
            <SectionHeader
              eyebrow="Suggested for you"
              title="Two-way swap matches"
              subtitle="People who teach what you want to learn, and want to learn what you teach."
            />
            {isLoading ? (
              <SkeletonGrid />
            ) : data && data.matches.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {data.matches.map((m: { id: string; offered_skill: string; wanted_skill: string; ticket_code: string }) => (
                  <SwapCard
                    key={m.id}
                    offered={m.offered_skill}
                    wanted={m.wanted_skill}
                    code={m.ticket_code}
                    isMatch
                  />
                ))}
              </div>
            ) : (
              <EmptyMatches />
            )}

            {data && data.explore.length > 0 && (
              <>
                <SectionHeader
                  eyebrow="Keep exploring"
                  title="Fresh on the board"
                  subtitle="Recent listings from across SwapStub."
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {data.explore.map((m: { id: string; offered_skill: string; wanted_skill: string; ticket_code: string }) => (
                    <SwapCard
                      key={m.id}
                      offered={m.offered_skill}
                      wanted={m.wanted_skill}
                      code={m.ticket_code}
                    />
                  ))}
                </div>
              </>
            )}
          </section>

          <aside className="space-y-6">
            <ActivityCard title="Upcoming sessions">
              {data?.upcomingBookings.length ? (
                <ul className="space-y-3">
                  {data.upcomingBookings.map((b: { id: string; scheduled_at: string; duration_min: number; status: string; ticket_code: string }) => (
                    <li key={b.id} className="flex items-start gap-3 text-sm">
                      <CalendarClock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">
                          {new Date(b.scheduled_at).toLocaleString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">
                          {b.status} · {b.duration_min} min · #{b.ticket_code}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nothing on the calendar yet. Accept a swap to fill it in.
                </p>
              )}
            </ActivityCard>

            <ActivityCard title="Your listings">
              {data?.myListings.length ? (
                <ul className="space-y-3">
                  {data.myListings.map((l: { id: string; offered_skill: string; wanted_skill: string; ticket_code: string; is_active: boolean }) => (
                    <li key={l.id} className="text-sm">
                      <div className="font-medium">
                        {l.offered_skill}{" "}
                        <span className="text-muted-foreground">↔</span>{" "}
                        {l.wanted_skill}
                      </div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">
                        #{l.ticket_code} · {l.is_active ? "Live" : "Paused"}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No listings yet. Post a stub to start matching.
                </p>
              )}
            </ActivityCard>

            {data && data.stats.completeness < 100 && (
              <CompletenessCard percent={data.stats.completeness} />
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

function TopNav({ onSignOut }: { onSignOut: () => void }) {
  return (
    <nav className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-6">
        <Link to="/" className="font-[Fraunces] text-xl tracking-tight">
          SwapStub
        </Link>
        <ul className="hidden md:flex items-center gap-1 text-sm">
          {NAV.map((n, i) => (
            <li key={n.label}>
              <Link
                to={n.to}
                className={`px-3 py-1.5 rounded-full transition ${
                  i === 0
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
        <Button variant="ghost" size="sm" onClick={onSignOut}>
          <LogOut className="h-4 w-4 mr-1.5" /> Sign out
        </Button>
      </div>
    </nav>
  );
}

function FirstListingBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="relative rounded-2xl border border-dashed border-primary/40 bg-primary/5 px-5 py-4 flex items-center gap-4">
      <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary shrink-0">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className="font-medium">Post your first skill stub</p>
        <p className="text-sm text-muted-foreground">
          Turn one of the skills you teach into a listing — matches show up here within seconds.
        </p>
      </div>
      <Button size="sm" asChild>
        <Link to="/listings/new">Create listing</Link>
      </Button>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function StatStub({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "primary" | "secondary" | "accent";
}) {
  const toneClass =
    tone === "primary"
      ? "bg-primary/10 text-primary"
      : tone === "secondary"
        ? "bg-secondary text-secondary-foreground"
        : "bg-accent text-accent-foreground";
  return (
    <div className="relative rounded-2xl border border-border bg-card p-5 overflow-hidden">
      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-3 rounded-r-full bg-background border-r border-y border-border" />
      <span className="absolute right-0 top-1/2 -translate-y-1/2 h-6 w-3 rounded-l-full bg-background border-l border-y border-border" />
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${toneClass}`}>
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-3 font-[Fraunces] text-4xl">{value}</div>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {eyebrow}
      </p>
      <h2 className="font-[Fraunces] text-2xl tracking-tight mt-1">{title}</h2>
      {subtitle && (
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      )}
    </div>
  );
}

function SwapCard({
  offered,
  wanted,
  code,
  isMatch,
}: {
  offered: string;
  wanted: string;
  code: string;
  isMatch?: boolean;
}) {
  return (
    <article className="group relative rounded-2xl border border-border bg-card p-5 hover:border-foreground/40 transition cursor-pointer">
      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-3 rounded-r-full bg-background border-r border-y border-border" />
      <span className="absolute right-0 top-1/2 -translate-y-1/2 h-7 w-3 rounded-l-full bg-background border-l border-y border-border" />
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          #{code}
        </span>
        {isMatch && (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-primary">
            <Sparkles className="h-3 w-3" /> Match
          </span>
        )}
      </div>
      <div className="mt-3 space-y-1">
        <div className="text-xs text-muted-foreground">Teaches</div>
        <div className="font-[Fraunces] text-xl leading-tight">{offered}</div>
      </div>
      <div className="my-3 border-t border-dashed border-border" />
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">Wants to learn</div>
        <div className="font-medium">{wanted}</div>
      </div>
      <div className="mt-4 flex items-center justify-end text-sm text-muted-foreground group-hover:text-foreground">
        Propose swap <ArrowRight className="h-3.5 w-3.5 ml-1" />
      </div>
    </article>
  );
}

function ActivityCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function CompletenessCard({ percent }: { percent: number }) {
  return (
    <div className="rounded-2xl border border-border bg-gradient-to-br from-accent/40 to-card p-5">
      <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Profile completeness
      </h3>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-[Fraunces] text-3xl">{percent}%</span>
        <span className="text-xs text-muted-foreground">A complete profile gets 3× more matches.</span>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-foreground transition-all" style={{ width: `${percent}%` }} />
      </div>
      <Link
        to="/onboarding"
        className="mt-3 inline-flex items-center text-sm font-medium hover:underline"
      >
        Finish your profile <ArrowRight className="h-3.5 w-3.5 ml-1" />
      </Link>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-44 rounded-2xl border border-border bg-card animate-pulse" />
      ))}
    </div>
  );
}

function EmptyMatches() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
      <Sparkles className="h-6 w-6 mx-auto text-muted-foreground" />
      <p className="mt-3 font-medium">No two-way matches yet</p>
      <p className="text-sm text-muted-foreground mt-1">
        Add more skills to your profile or post a listing to attract proposals.
      </p>
    </div>
  );
}