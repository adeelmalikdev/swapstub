import { createFileRoute, ErrorComponent } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import {
  Music, Code, Languages, Palette, Dumbbell, GraduationCap,
  Scissors as ScissorsIcon, ChefHat, Briefcase, Sparkles,
  ArrowRight, MessageSquare, Calendar, Star,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  getLandingStats,
  getFeaturedCategories,
  type LandingStats,
  type FeaturedCategory,
} from "@/lib/landing.functions";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { TicketStub } from "@/components/ticket/TicketStub";
import { PerforatedDivider } from "@/components/ticket/PerforatedDivider";
import { TicketCode } from "@/components/ticket/TicketCode";

const statsQuery = queryOptions({
  queryKey: ["landing", "stats"],
  queryFn: () => getLandingStats(),
});

const categoriesQuery = queryOptions({
  queryKey: ["landing", "categories"],
  queryFn: () => getFeaturedCategories(),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SwapStub — Trade skills with other students" },
      {
        name: "description",
        content:
          "Teach what you know, learn what you want. SwapStub pairs students for skill swaps with a torn-ticket twist.",
      },
      { property: "og:title", content: "SwapStub — Trade skills with other students" },
      {
        property: "og:description",
        content:
          "Teach what you know, learn what you want. SwapStub pairs students for skill swaps with a torn-ticket twist.",
      },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(statsQuery);
    context.queryClient.ensureQueryData(categoriesQuery);
  },
  errorComponent: ErrorComponent,
  notFoundComponent: () => <div className="p-12">Not found.</div>,
  component: Landing,
});

const ICON_MAP: Record<string, LucideIcon> = {
  Music, Code, Languages, Palette, Dumbbell, GraduationCap,
  Scissors: ScissorsIcon, ChefHat, Briefcase, Sparkles,
};

function Landing() {
  const { data: stats } = useSuspenseQuery(statsQuery);
  const { data: categories } = useSuspenseQuery(categoriesQuery);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <Hero />
      <Stats stats={stats} />
      <HowItWorks />
      <Categories categories={categories} />
      <FinalCta />
      <SiteFooter />
    </div>
  );
}

// ───────────────────────── HERO ─────────────────────────
function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 pb-12 pt-12 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-20">
        <div className="flex flex-col justify-center">
          <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border-2 border-ink bg-[var(--kraft-deep)] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-ink">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--ochre-deep)]" />
            Tear here · trade skills
          </div>
          <h1 className="font-display text-[44px] leading-[0.95] text-ink sm:text-6xl lg:text-7xl">
            Teach a thing.<br />
            Learn a thing.<br />
            <span className="text-[var(--brick)]">No money changes hands.</span>
          </h1>
          <p className="mt-6 max-w-md text-base text-ink/75 sm:text-lg">
            SwapStub is a student marketplace for skill swaps. Post the ticket
            of what you can teach next to the ticket of what you want to learn —
            then book a session with whoever's a perfect tear-along match.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="/auth?mode=signup"
              className="inline-flex items-center gap-2 rounded-md border-2 border-ink bg-ink px-5 py-3 text-sm font-bold uppercase tracking-wider text-kraft transition hover:bg-ink/85"
            >
              Claim your stub
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="/browse"
              className="inline-flex items-center gap-2 rounded-md border-2 border-ink bg-transparent px-5 py-3 text-sm font-bold uppercase tracking-wider text-ink transition hover:bg-[var(--kraft-deep)]"
            >
              Browse swaps
            </a>
          </div>

          <div className="mt-6 flex items-center gap-2 text-xs text-ink/60">
            <TicketCode code="STUB-DEMO" />
            <span>Every swap gets its own claim-stub code.</span>
          </div>
        </div>

        {/* Hero ticket stack */}
        <div className="relative">
          <div className="absolute -inset-x-6 -inset-y-6 -z-10 rounded-3xl bg-[radial-gradient(circle_at_30%_30%,oklch(0.66_0.135_65/0.22),transparent_60%),radial-gradient(circle_at_70%_70%,oklch(0.48_0.055_175/0.20),transparent_55%)]" />

          <div className="space-y-5">
            <TicketStub
              size="lg"
              code="STUB-A14K-2P"
              offered={
                <div>
                  <div className="font-display text-2xl sm:text-3xl">Guitar</div>
                  <div className="mt-1 text-sm text-ink/75">
                    Chords, strumming, your first 5 songs.
                  </div>
                </div>
              }
              wanted={
                <div>
                  <div className="font-display text-2xl sm:text-3xl">Python</div>
                  <div className="mt-1 text-sm text-kraft/85">
                    Just enough to script my homework.
                  </div>
                </div>
              }
            />
            <div className="ml-auto w-[88%] -rotate-[1.2deg]">
              <TicketStub
                size="md"
                code="STUB-7F3Q-9X"
                offered={
                  <div>
                    <div className="font-display text-xl sm:text-2xl">Photoshop</div>
                    <div className="mt-1 text-xs text-ink/75">Posters, photo edits, mockups.</div>
                  </div>
                }
                wanted={
                  <div>
                    <div className="font-display text-xl sm:text-2xl">Spanish A1</div>
                    <div className="mt-1 text-xs text-kraft/85">Conversation, not grammar drills.</div>
                  </div>
                }
              />
            </div>
            <div className="mr-auto w-[80%] rotate-[0.8deg]">
              <TicketStub
                size="sm"
                code="STUB-J22B-4M"
                offered={
                  <div>
                    <div className="font-display text-lg sm:text-xl">Calculus</div>
                  </div>
                }
                wanted={
                  <div>
                    <div className="font-display text-lg sm:text-xl">Bouldering</div>
                  </div>
                }
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ───────────────────────── STATS ─────────────────────────
function Stats({ stats }: { stats: LandingStats }) {
  const items = [
    { label: "Active swap tickets", value: stats.activeListings },
    { label: "Swaps completed", value: stats.swapsCompleted },
    { label: "Members on the board", value: stats.members },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <PerforatedDivider className="mb-8" />
      <div className="grid gap-4 sm:grid-cols-3">
        {items.map((it) => (
          <div
            key={it.label}
            className="rounded-md border-2 border-ink bg-[var(--kraft-deep)] p-5"
          >
            <div className="font-display text-4xl text-ink sm:text-5xl">
              {it.value.toLocaleString()}
            </div>
            <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/65">
              {it.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ───────────────────────── HOW IT WORKS ─────────────────────────
function HowItWorks() {
  const steps = [
    {
      icon: ScissorsIcon,
      title: "Tear off a ticket",
      body: "Post what you can teach on the ochre half and what you want to learn on the teal half.",
    },
    {
      icon: MessageSquare,
      title: "Find your other half",
      body: "Browse, search, or let SwapStub suggest perfect two-way matches and message them directly.",
    },
    {
      icon: Calendar,
      title: "Book and swap",
      body: "Pick a time, meet up, then mark the stub completed and leave a review.",
    },
  ];

  return (
    <section id="how" className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/60">
            How it works
          </div>
          <h2 className="mt-2 max-w-xl font-display text-4xl text-ink sm:text-5xl">
            Three perforations between you and your first swap.
          </h2>
        </div>
        <TicketCode code="STUB-HOW-001" />
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {steps.map((s, i) => (
          <article
            key={s.title}
            className="relative overflow-hidden rounded-md border-2 border-ink bg-[var(--kraft-deep)] p-6"
          >
            <div className="flex items-center justify-between">
              <span className="grid h-11 w-11 place-items-center rounded-md border-2 border-ink bg-[var(--ochre)] text-ink">
                <s.icon className="h-5 w-5" />
              </span>
              <span className="font-mono text-xs text-ink/55">
                step 0{i + 1}
              </span>
            </div>
            <h3 className="mt-5 font-display text-2xl text-ink">{s.title}</h3>
            <p className="mt-2 text-sm text-ink/75">{s.body}</p>
            <PerforatedDivider className="mt-6" />
          </article>
        ))}
      </div>
    </section>
  );
}

// ───────────────────────── CATEGORIES ─────────────────────────
function Categories({ categories }: { categories: FeaturedCategory[] }) {
  if (categories.length === 0) return null;
  return (
    <section className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/60">
            Categories
          </div>
          <h2 className="mt-2 font-display text-4xl text-ink sm:text-5xl">
            What's on the board.
          </h2>
        </div>
        <a
          href="/browse"
          className="hidden items-center gap-1 text-sm font-semibold text-ink underline-offset-4 hover:underline sm:inline-flex"
        >
          See every ticket <ArrowRight className="h-4 w-4" />
        </a>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {categories.map((c) => {
          const Icon = (c.icon && ICON_MAP[c.icon]) || Sparkles;
          return (
            <a
              key={c.id}
              href={`/browse?offered=${c.slug}`}
              className="group flex flex-col items-start justify-between gap-4 rounded-md border-2 border-ink bg-[var(--kraft-deep)] p-4 transition hover:-translate-y-0.5 hover:bg-[var(--kraft)]"
            >
              <span className="grid h-10 w-10 place-items-center rounded-md border-2 border-ink bg-[var(--teal)] text-kraft">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <div className="font-display text-lg text-ink">{c.name}</div>
                <div className="font-mono text-[11px] text-ink/55">
                  {c.listingCount} {c.listingCount === 1 ? "ticket" : "tickets"}
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

// ───────────────────────── FINAL CTA ─────────────────────────
function FinalCta() {
  return (
    <section className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
      <div className="relative overflow-hidden rounded-md border-2 border-ink bg-ink p-8 text-kraft sm:p-12">
        <div className="absolute inset-y-0 left-1/2 hidden w-px -translate-x-1/2 sm:block">
          <div
            aria-hidden
            className="h-full w-3 -translate-x-1/2"
            style={{
              backgroundImage:
                "radial-gradient(circle at center, var(--kraft) 4px, transparent 4.5px)",
              backgroundSize: "12px 12px",
              backgroundRepeat: "repeat-y",
              backgroundPosition: "center",
            }}
          />
        </div>

        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-kraft/60">
              Join the swap
            </div>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl">
              Got something to teach?
            </h2>
            <p className="mt-3 text-sm text-kraft/75">
              Tear off a ticket in under two minutes. We'll match you with
              someone who teaches exactly what you wrote on the other half.
            </p>
            <a
              href="/auth?mode=signup"
              className="mt-6 inline-flex items-center gap-2 rounded-md border-2 border-kraft bg-[var(--ochre)] px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-ink transition hover:bg-[var(--ochre-deep)] hover:text-kraft"
            >
              Post a ticket
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
          <div className="sm:pl-10">
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-kraft/60">
              <Star className="h-3 w-3 fill-current" />
              Reviewed after every swap
            </div>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl">
              Just want to learn?
            </h2>
            <p className="mt-3 text-sm text-kraft/75">
              Browse the board, find a ticket whose other half matches what you
              can offer, and book a session.
            </p>
            <a
              href="/browse"
              className="mt-6 inline-flex items-center gap-2 rounded-md border-2 border-kraft bg-transparent px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-kraft transition hover:bg-[var(--teal)]"
            >
              Browse swaps
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
