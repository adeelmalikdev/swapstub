import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Ticket } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { listCategories, listMyListings, updateListing } from "@/lib/listings.functions";

export const Route = createFileRoute("/listings/$id/edit")({
  head: () => ({
    meta: [
      { title: "Edit listing — SwapStub" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EditListingPage,
});

const DAYS: { id: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"; label: string }[] = [
  { id: "mon", label: "Mon" }, { id: "tue", label: "Tue" }, { id: "wed", label: "Wed" },
  { id: "thu", label: "Thu" }, { id: "fri", label: "Fri" }, { id: "sat", label: "Sat" }, { id: "sun", label: "Sun" },
];
const SESSION_LENGTHS = [30, 45, 60, 90, 120];
const inputClass =
  "w-full px-4 py-3 rounded-xl bg-[#ebe2d5]/50 border border-[#d8cfc0] focus:border-[#2d2a26] focus:ring-0 text-sm outline-none transition-all placeholder:text-[#bdaf9c] text-[#2d2a26]";

function EditListingPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      if (!data.user) navigate({ to: "/auth", replace: true });
      else setAuthed(true);
    });
    return () => { mounted = false; };
  }, [navigate]);

  const fetchMine = useServerFn(listMyListings);
  const fetchCats = useServerFn(listCategories);
  const saveFn = useServerFn(updateListing);

  const mineQ = useQuery({ queryKey: ["my-listings"], queryFn: () => fetchMine(), enabled: authed });
  const catsQ = useQuery({ queryKey: ["categories"], queryFn: () => fetchCats() });

  const listing = mineQ.data?.find((l) => l.id === id) ?? null;

  const [offeredSkill, setOfferedSkill] = useState("");
  const [wantedSkill, setWantedSkill] = useState("");
  const [offeredCategoryId, setOfferedCategoryId] = useState("");
  const [wantedCategoryId, setWantedCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [sessionLengthMin, setSessionLengthMin] = useState<number | null>(60);
  const [isActive, setIsActive] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (listing && !hydrated) {
      setOfferedSkill(listing.offeredSkill);
      setWantedSkill(listing.wantedSkill);
      setOfferedCategoryId(listing.offeredCategory?.id ?? "");
      setWantedCategoryId(listing.wantedCategory?.id ?? "");
      setDescription(listing.description ?? "");
      setAvailableDays(listing.availability?.days ?? []);
      setSessionLengthMin(listing.availability?.sessionLengthMin ?? 60);
      setIsActive(listing.isActive);
      setHydrated(true);
    }
  }, [listing, hydrated]);

  if (!authed || mineQ.isLoading) {
    return <AppShell><div className="text-center py-16 text-[#7a7164] text-sm">Loading…</div></AppShell>;
  }
  if (!listing) {
    return (
      <AppShell>
        <div className="text-center py-16 text-[#7a7164] text-sm">
          That stub doesn't exist or isn't yours.
        </div>
      </AppShell>
    );
  }

  function toggleDay(d: string) {
    setAvailableDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  }

  async function onSave() {
    if (!listing) return;
    if (offeredSkill.trim().length < 2 || wantedSkill.trim().length < 2) {
      toast.error("Both skills are required");
      return;
    }
    setSaving(true);
    try {
      await saveFn({
        data: {
          id: listing.id,
          offeredSkill: offeredSkill.trim(),
          wantedSkill: wantedSkill.trim(),
          offeredCategoryId: offeredCategoryId || null,
          wantedCategoryId: wantedCategoryId || null,
          description: description.trim() || null,
          availableDays: availableDays as ("mon"|"tue"|"wed"|"thu"|"fri"|"sat"|"sun")[],
          sessionLengthMin,
          isActive,
        },
      });
      toast.success("Stub updated");
      navigate({ to: "/listings" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const categories = catsQ.data ?? [];

  return (
    <AppShell>
      <div className="w-full max-w-[520px] mx-auto" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <div className="bg-[#f9f6f0] rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.10)] overflow-hidden border border-[#d8cfc0]">
          <div className="p-7 pb-5">
            <div className="flex justify-between items-center mb-5">
              <span className="text-[10px] font-bold tracking-[0.2em] text-[#5c544a] bg-[#ebe2d5] px-3 py-1 rounded-full inline-flex items-center">
                <Ticket className="w-3 h-3 mr-1.5" /> EDIT STUB · {listing.ticketCode}
              </span>
            </div>
            <h1 className="text-[2rem] leading-[1.05] text-[#2d2a26] mb-2" style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700 }}>
              Edit your swap
            </h1>
          </div>
          <div className="p-7 pt-2 space-y-5">
            <SwapField title="You teach" skill={offeredSkill} setSkill={setOfferedSkill} categoryId={offeredCategoryId} setCategoryId={setOfferedCategoryId} categories={categories} placeholder="e.g. Watercolor basics" />
            <div className="flex items-center gap-3">
              <div className="flex-1 border-t border-dashed border-[#d8cfc0]" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#bdaf9c]">In exchange for</span>
              <div className="flex-1 border-t border-dashed border-[#d8cfc0]" />
            </div>
            <SwapField title="You want to learn" skill={wantedSkill} setSkill={setWantedSkill} categoryId={wantedCategoryId} setCategoryId={setWantedCategoryId} categories={categories} placeholder="e.g. Beginner Python" />
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#5c544a] uppercase tracking-wider">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500}
                className={inputClass + " resize-none"} placeholder="Optional details about the session." />
              <p className="text-[10px] text-[#bdaf9c] text-right">{description.length}/500</p>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-[#5c544a] uppercase tracking-wider">Availability</label>
              <div className="grid grid-cols-7 gap-1.5">
                {DAYS.map((d) => {
                  const active = availableDays.includes(d.id);
                  return (
                    <button key={d.id} type="button" onClick={() => toggleDay(d.id)}
                      className={"py-2 rounded-lg text-xs font-bold border transition-all " + (active ? "bg-[#2d2a26] text-[#f9f6f0] border-[#2d2a26]" : "bg-[#ebe2d5]/50 text-[#5c544a] border-[#d8cfc0] hover:border-[#2d2a26]")}>
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-[#5c544a] uppercase tracking-wider">Session length</label>
              <div className="flex flex-wrap gap-2">
                {SESSION_LENGTHS.map((mins) => {
                  const active = sessionLengthMin === mins;
                  return (
                    <button key={mins} type="button" onClick={() => setSessionLengthMin(mins)}
                      className={"px-4 py-2 rounded-full text-xs font-bold border transition-all " + (active ? "bg-[#2d2a26] text-[#f9f6f0] border-[#2d2a26]" : "bg-[#ebe2d5]/50 text-[#5c544a] border-[#d8cfc0] hover:border-[#2d2a26]")}>
                      {mins} min
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 accent-[#2d2a26]" />
              <span className="text-sm text-[#2d2a26]">Live (visible to others)</span>
            </label>
          </div>
          <div className="px-7 pb-7 pt-1 space-y-3">
            <button type="button" onClick={onSave} disabled={saving}
              className="w-full bg-[#2d2a26] text-[#f9f6f0] py-4 rounded-2xl font-bold text-sm hover:scale-[1.01] active:scale-[0.99] transition-all shadow-[0_10px_24px_-12px_rgba(45,42,38,0.6)] disabled:opacity-60 disabled:cursor-not-allowed">
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button type="button" onClick={() => navigate({ to: "/listings" })}
              className="w-full text-[11px] font-bold uppercase tracking-widest text-[#7a7164] hover:text-[#2d2a26]">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function SwapField({
  title, skill, setSkill, placeholder, categoryId, setCategoryId, categories,
}: {
  title: string;
  skill: string;
  setSkill: (v: string) => void;
  placeholder: string;
  categoryId: string;
  setCategoryId: (v: string) => void;
  categories: { id: string; name: string }[];
}) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-bold text-[#5c544a] uppercase tracking-wider">{title}</label>
      <div className="grid grid-cols-[1fr_160px] gap-2">
        <input value={skill} onChange={(e) => setSkill(e.target.value)} placeholder={placeholder} className={inputClass} maxLength={60} />
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
          <option value="">Category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}