import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Ticket } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { createListing, listCategories } from "@/lib/listings.functions";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/listings/new")({
  head: () => ({
    meta: [
      { title: "New listing — SwapStub" },
      { name: "description", content: "Post a skill swap stub on SwapStub." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NewListingPage,
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
const SESSION_LENGTHS = [30, 45, 60, 90, 120];

const inputClass =
  "w-full px-4 py-3 rounded-xl bg-[#ebe2d5]/50 border border-[#d8cfc0] focus:border-[#2d2a26] focus:ring-0 text-sm outline-none transition-all placeholder:text-[#bdaf9c] text-[#2d2a26]";
const selectChevron =
  " appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%237a7164%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%226 9 12 15 18 9%22/></svg>')] bg-no-repeat bg-[right_1rem_center] pr-10";

function NewListingPage() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [offeredSkill, setOfferedSkill] = useState("");
  const [wantedSkill, setWantedSkill] = useState("");
  const [offeredCategoryId, setOfferedCategoryId] = useState<string>("");
  const [wantedCategoryId, setWantedCategoryId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [sessionLengthMin, setSessionLengthMin] = useState<number | null>(60);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      if (!data.user) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      setAuthChecked(true);
    });
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const fetchCategories = useServerFn(listCategories);
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => fetchCategories(),
  });

  const fetchCreate = useServerFn(createListing);

  const canSubmit =
    offeredSkill.trim().length >= 2 && wantedSkill.trim().length >= 2 && !submitting;

  function toggleDay(d: string) {
    setAvailableDays((cur) =>
      cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d],
    );
  }

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetchCreate({
        data: {
          offeredSkill: offeredSkill.trim(),
          wantedSkill: wantedSkill.trim(),
          offeredCategoryId: offeredCategoryId || null,
          wantedCategoryId: wantedCategoryId || null,
          description: description.trim(),
          availableDays: availableDays as ("mon"|"tue"|"wed"|"thu"|"fri"|"sat"|"sun")[],
          sessionLengthMin,
          isActive,
        },
      });
      toast.success(`Listing posted · #${res.ticketCode}`);
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create listing");
    } finally {
      setSubmitting(false);
    }
  }

  if (!authChecked) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-16">
          <div className="text-[#7a7164] text-sm tracking-widest uppercase">Loading…</div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div
        className="w-full max-w-[520px] mx-auto"
        style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
      >

        <div className="relative">
          <div className="absolute inset-x-3 -top-2 h-6 bg-[#f0e9da] rounded-[2rem] border border-[#d8cfc0]/70 -z-10" aria-hidden />
          <div className="absolute inset-x-6 -top-4 h-6 bg-[#ebe2d5] rounded-[2rem] border border-[#d8cfc0]/50 -z-20" aria-hidden />

          <div className="bg-[#f9f6f0] rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.10)] overflow-hidden border border-[#d8cfc0]">
            <div className="p-7 pb-5">
              <div className="flex justify-between items-center mb-5">
                <span className="text-[10px] font-bold tracking-[0.2em] text-[#5c544a] bg-[#ebe2d5] px-3 py-1 rounded-full inline-flex items-center">
                  <Ticket className="w-3 h-3 mr-1.5" /> NEW STUB
                </span>
                <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#7a7164]">
                  Draft
                </span>
              </div>
              <h1 className="text-[2rem] leading-[1.05] text-[#2d2a26] mb-2" style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700 }}>
                Post a swap
              </h1>
              <p className="text-[#7a7164] text-sm leading-relaxed">
                Tell SwapStub what you'll teach and what you want in return. We'll surface you to matching learners right away.
              </p>
            </div>

            <Perforation />

            <div className="p-7 pt-6 space-y-5">
              <SwapField
                title="You teach"
                skill={offeredSkill}
                setSkill={setOfferedSkill}
                placeholder="e.g. Watercolor basics"
                categoryId={offeredCategoryId}
                setCategoryId={setOfferedCategoryId}
                categories={categories}
              />

              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-dashed border-[#d8cfc0]" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#bdaf9c]">In exchange for</span>
                <div className="flex-1 border-t border-dashed border-[#d8cfc0]" />
              </div>

              <SwapField
                title="You want to learn"
                skill={wantedSkill}
                setSkill={setWantedSkill}
                placeholder="e.g. Beginner Python"
                categoryId={wantedCategoryId}
                setCategoryId={setWantedCategoryId}
                categories={categories}
              />

              <div className="space-y-1.5">
                <FieldLabel>Description (optional)</FieldLabel>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="What does a typical session look like? Any prerequisites?"
                  className={inputClass + " resize-none"}
                  maxLength={500}
                />
                <p className="text-[10px] text-[#bdaf9c] text-right">{description.length}/500</p>
              </div>

              <div className="space-y-2">
                <FieldLabel>Availability</FieldLabel>
                <div className="grid grid-cols-7 gap-1.5">
                  {DAYS.map((d) => {
                    const active = availableDays.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleDay(d.id)}
                        className={
                          "py-2 rounded-lg text-xs font-bold border transition-all " +
                          (active
                            ? "bg-[#2d2a26] text-[#f9f6f0] border-[#2d2a26]"
                            : "bg-[#ebe2d5]/50 text-[#5c544a] border-[#d8cfc0] hover:border-[#2d2a26]")
                        }
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <FieldLabel>Session length</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {SESSION_LENGTHS.map((mins) => {
                    const active = sessionLengthMin === mins;
                    return (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setSessionLengthMin(mins)}
                        className={
                          "px-4 py-2 rounded-full text-xs font-bold border transition-all " +
                          (active
                            ? "bg-[#2d2a26] text-[#f9f6f0] border-[#2d2a26]"
                            : "bg-[#ebe2d5]/50 text-[#5c544a] border-[#d8cfc0] hover:border-[#2d2a26]")
                        }
                      >
                        {mins} min
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 accent-[#2d2a26]"
                />
                <span className="text-sm text-[#2d2a26]">
                  Publish immediately
                  <span className="block text-xs text-[#7a7164]">Uncheck to save as a draft only you can see.</span>
                </span>
              </label>
            </div>

            <div className="px-7 pb-7 pt-1 space-y-3">
              <button
                type="button"
                onClick={onSubmit}
                disabled={!canSubmit}
                className="w-full bg-[#2d2a26] text-[#f9f6f0] py-4 rounded-2xl font-bold text-sm hover:scale-[1.01] active:scale-[0.99] transition-all shadow-[0_10px_24px_-12px_rgba(45,42,38,0.6)] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? "Posting…" : isActive ? "Post listing" : "Save draft"}
              </button>
              <button
                type="button"
                onClick={() => navigate({ to: "/dashboard" })}
                className="w-full text-[11px] font-bold uppercase tracking-widest text-[#7a7164] hover:text-[#2d2a26]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function SwapField({
  title,
  skill,
  setSkill,
  placeholder,
  categoryId,
  setCategoryId,
  categories,
}: {
  title: string;
  skill: string;
  setSkill: (v: string) => void;
  placeholder: string;
  categoryId: string;
  setCategoryId: (v: string) => void;
  categories: { id: string; name: string; icon: string | null }[];
}) {
  return (
    <div className="space-y-2">
      <FieldLabel>{title}</FieldLabel>
      <div className="grid grid-cols-[1fr_160px] gap-2">
        <input
          value={skill}
          onChange={(e) => setSkill(e.target.value)}
          placeholder={placeholder}
          className={inputClass}
          maxLength={60}
        />
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className={inputClass + selectChevron}
        >
          <option value="">Category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[11px] font-bold text-[#5c544a] uppercase tracking-wider">
      {children}
    </label>
  );
}

function Perforation() {
  return (
    <div className="relative h-px" aria-hidden>
      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 bg-[#e5ddd3] rounded-full border-r border-[#d8cfc0]" />
      <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-6 h-6 bg-[#e5ddd3] rounded-full border-l border-[#d8cfc0]" />
      <div className="border-t border-dashed border-[#d8cfc0] mx-4" />
    </div>
  );
}