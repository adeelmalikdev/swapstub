import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Search, Ticket, MapPin, Clock, Sparkles, X } from "lucide-react";

import { discoverListings, listCategories } from "@/lib/listings.functions";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Discover swaps — SwapStub" },
      {
        name: "description",
        content: "Browse skill swap stubs from the SwapStub community.",
      },
    ],
  }),
  component: DiscoverPage,
});

const DAYS: { id: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"; label: string }[] = [
  { id: "mon", label: "Mon" },
  { id: "tue", label: "Tue" },
  { id: "wed", label: "Wed" },
  { id: "thu", label: "Thu" },
  { id: "fri", label: "Fri" },
  { id: "sat", label: "Sat" },
  { id: "sun", label: "Sun" },
];

const inputClass =
  "w-full px-4 py-3 rounded-xl bg-[#ebe2d5]/50 border border-[#d8cfc0] focus:border-[#2d2a26] focus:ring-0 text-sm outline-none transition-all placeholder:text-[#bdaf9c] text-[#2d2a26]";
const selectChevron =
  " appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%237a7164%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%226 9 12 15 18 9%22/></svg>')] bg-no-repeat bg-[right_1rem_center] pr-10";

function DiscoverPage() {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [offeredCategoryId, setOfferedCategoryId] = useState("");
  const [wantedCategoryId, setWantedCategoryId] = useState("");
  const [day, setDay] = useState<string>("");

  const fetchCategories = useServerFn(listCategories);
  const fetchDiscover = useServerFn(discoverListings);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => fetchCategories(),
    staleTime: 5 * 60_000,
  });

  const filters = useMemo(
    () => ({ search, offeredCategoryId, wantedCategoryId, day: day || undefined }),
    [search, offeredCategoryId, wantedCategoryId, day],
  );

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["discover", filters],
    queryFn: () =>
      fetchDiscover({
        data: {
          search: filters.search,
          offeredCategoryId: filters.offeredCategoryId,
          wantedCategoryId: filters.wantedCategoryId,
          day: filters.day as
            | "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun" | undefined,
        },
      }),
  });

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  const hasFilters = Boolean(search || offeredCategoryId || wantedCategoryId || day);
  const clearFilters = () => {
    setSearch("");
    setSearchInput("");
    setOfferedCategoryId("");
    setWantedCategoryId("");
    setDay("");
  };

  return (
    <div className="min-h-screen bg-[#f5efe3] text-[#2d2a26]">
      <header className="border-b border-[#d8cfc0] bg-[#f9f6f0]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-[#7a7164] hover:text-[#2d2a26]"
          >
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
          <div className="inline-flex items-center gap-2 font-medium tracking-tight">
            <Ticket className="w-4 h-4" /> SwapStub
          </div>
          <Link
            to="/listings/new"
            className="text-sm px-3 py-1.5 rounded-lg bg-[#2d2a26] text-[#f9f6f0] hover:bg-[#1f1d1a]"
          >
            New listing
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Discover swaps</h1>
          <p className="text-sm text-[#7a7164] mt-1">
            Find stubs from people teaching what you want — and looking for what you offer.
          </p>
        </div>

        <div className="rounded-2xl bg-[#f9f6f0] border border-[#d8cfc0] p-4 sm:p-5 mb-6 shadow-sm">
          <form onSubmit={onSearchSubmit} className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#bdaf9c]" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search skills, e.g. guitar, spanish, react…"
                className={inputClass + " pl-9"}
              />
            </div>
            <button
              type="submit"
              className="px-4 py-3 rounded-xl bg-[#2d2a26] text-[#f9f6f0] text-sm hover:bg-[#1f1d1a]"
            >
              Search
            </button>
          </form>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wider text-[#7a7164] mb-1">
                Teaches (category)
              </label>
              <select
                value={offeredCategoryId}
                onChange={(e) => setOfferedCategoryId(e.target.value)}
                className={inputClass + selectChevron}
              >
                <option value="">Any</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-[#7a7164] mb-1">
                Wants to learn (category)
              </label>
              <select
                value={wantedCategoryId}
                onChange={(e) => setWantedCategoryId(e.target.value)}
                className={inputClass + selectChevron}
              >
                <option value="">Any</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-[#7a7164] mb-1">
                Available day
              </label>
              <select
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className={inputClass + selectChevron}
              >
                <option value="">Any day</option>
                {DAYS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {hasFilters && (
            <div className="mt-3 flex items-center justify-between text-xs text-[#7a7164]">
              <span>
                {listings.length} {listings.length === 1 ? "stub" : "stubs"} match
              </span>
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 hover:text-[#2d2a26]"
              >
                <X className="w-3 h-3" /> Clear filters
              </button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-[#7a7164] text-sm">Loading stubs…</div>
        ) : listings.length === 0 ? (
          <div className="rounded-2xl bg-[#f9f6f0] border border-dashed border-[#d8cfc0] p-10 text-center">
            <Sparkles className="w-6 h-6 mx-auto text-[#bdaf9c] mb-2" />
            <p className="text-[#2d2a26] font-medium">No stubs match your filters yet</p>
            <p className="text-sm text-[#7a7164] mt-1">
              Try broadening your search or post your own stub.
            </p>
            <Link
              to="/listings/new"
              className="inline-block mt-4 px-4 py-2 rounded-lg bg-[#2d2a26] text-[#f9f6f0] text-sm hover:bg-[#1f1d1a]"
            >
              Post a stub
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map((l) => (
              <StubCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

type Listing = Awaited<ReturnType<typeof discoverListings>>[number];

function StubCard({ listing }: { listing: Listing }) {
  const days = listing.availability?.days ?? [];
  const session = listing.availability?.sessionLengthMin ?? null;
  const author = listing.author;
  const initial =
    (author?.display_name || author?.username || "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <article className="relative rounded-2xl bg-[#f9f6f0] border border-[#d8cfc0] shadow-sm overflow-hidden flex flex-col">
      {/* perforation */}
      <div
        className="absolute left-0 right-0 top-[58%] h-px"
        style={{
          backgroundImage:
            "linear-gradient(90deg, #c9bfae 50%, transparent 50%)",
          backgroundSize: "8px 1px",
        }}
      />
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-[#7a7164]">
          <span>Stub · {listing.ticketCode}</span>
          <span>{new Date(listing.createdAt).toLocaleDateString()}</span>
        </div>
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#7a7164]">Teaches</div>
            <div className="text-sm font-semibold leading-tight mt-0.5 line-clamp-2">
              {listing.offeredSkill}
            </div>
            {listing.offeredCategory && (
              <div className="text-[11px] text-[#7a7164] mt-0.5">{listing.offeredCategory.name}</div>
            )}
          </div>
          <div className="text-[#bdaf9c]">→</div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#7a7164]">Wants</div>
            <div className="text-sm font-semibold leading-tight mt-0.5 line-clamp-2">
              {listing.wantedSkill}
            </div>
            {listing.wantedCategory && (
              <div className="text-[11px] text-[#7a7164] mt-0.5">{listing.wantedCategory.name}</div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 pb-4 mt-auto">
        {listing.description && (
          <p className="text-xs text-[#5a5448] line-clamp-2 mb-3">{listing.description}</p>
        )}
        <div className="flex flex-wrap gap-2 text-[11px] text-[#7a7164] mb-3">
          {days.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ebe2d5]">
              <Clock className="w-3 h-3" />
              {days.map((d) => d[0].toUpperCase() + d.slice(1, 3)).join(" · ")}
            </span>
          )}
          {session && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ebe2d5]">
              {session} min
            </span>
          )}
          {author?.timezone && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ebe2d5]">
              <MapPin className="w-3 h-3" />
              {author.timezone}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-[#2d2a26] text-[#f9f6f0] flex items-center justify-center text-xs font-semibold shrink-0">
              {initial}
            </div>
            <div className="text-xs text-[#2d2a26] truncate">
              {author?.display_name || author?.username || "Someone"}
              {author?.username && (
                <span className="text-[#bdaf9c]"> · @{author.username}</span>
              )}
            </div>
          </div>
          <Link
            to="/listings/$id"
            params={{ id: listing.id }}
            className="text-xs px-3 py-1.5 rounded-lg bg-[#2d2a26] text-[#f9f6f0] hover:bg-[#1f1d1a]"
          >
            View
          </Link>
        </div>
      </div>
    </article>
  );
}