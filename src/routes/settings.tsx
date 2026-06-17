import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, X, Save, Lock, Bell as BellIcon } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { AvatarUpload } from "@/components/avatar-upload";
import { getMySettings, updateMyProfile } from "@/lib/profile.functions";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — SwapStub" },
      { name: "description", content: "Update your SwapStub profile, password, and notification preferences." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

const DAYS: { id: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"; label: string }[] = [
  { id: "mon", label: "Mon" }, { id: "tue", label: "Tue" }, { id: "wed", label: "Wed" },
  { id: "thu", label: "Thu" }, { id: "fri", label: "Fri" }, { id: "sat", label: "Sat" }, { id: "sun", label: "Sun" },
];
const SESSION_LENGTHS = [30, 45, 60, 90, 120];

const FALLBACK_TIMEZONES = ["UTC","America/Los_Angeles","America/Denver","America/Chicago","America/New_York","Europe/London","Europe/Paris","Europe/Berlin","Asia/Dubai","Asia/Kolkata","Asia/Singapore","Asia/Tokyo","Australia/Sydney","Pacific/Auckland"];
function getTimezoneList(): string[] {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    if (typeof fn === "function") return fn("timeZone");
  } catch { /* ignore */ }
  return FALLBACK_TIMEZONES;
}

const inputClass =
  "w-full px-4 py-2.5 rounded-xl bg-[#faf6ed] border border-[#e7dfd0] focus:border-[#2d2a26] focus:outline-none text-sm transition-all placeholder:text-[#bdaf9c] text-[#2d2a26]";

function SettingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      if (!data.user) navigate({ to: "/auth", replace: true });
      else setUserId(data.user.id);
    });
    return () => { mounted = false; };
  }, [navigate]);

  const fetchSettings = useServerFn(getMySettings);
  const saveFn = useServerFn(updateMyProfile);

  const q = useQuery({
    queryKey: ["my-settings"],
    queryFn: () => fetchSettings(),
    enabled: !!userId,
  });

  if (!userId || !q.data || !q.data.profile) {
    return (
      <AppShell>
        <div className="text-center py-16 text-[#7a7164] text-sm">Loading…</div>
      </AppShell>
    );
  }

  const profile = q.data.profile;
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-[#7a7164] mt-1">Update your profile, password and notifications.</p>
      </div>
      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6">
          <ProfileCard
            userId={userId}
            initial={profile}
            onSaved={() => qc.invalidateQueries({ queryKey: ["my-settings"] })}
            save={(patch) => saveFn({ data: patch })}
          />
          <NotificationsCard
            initial={profile}
            onSaved={() => qc.invalidateQueries({ queryKey: ["my-settings"] })}
            save={(patch) => saveFn({ data: patch })}
          />
        </div>
        <div className="space-y-6">
          <AccountCard email={q.data.email} />
        </div>
      </div>
    </AppShell>
  );
}

type ProfileRow = NonNullable<Awaited<ReturnType<typeof getMySettings>>["profile"]>;
type SavePatch = Parameters<typeof updateMyProfile>[0]["data"];

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-[#e7dfd0] rounded-2xl p-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-[#7a7164] mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function ProfileCard({
  userId,
  initial,
  onSaved,
  save,
}: {
  userId: string;
  initial: ProfileRow;
  onSaved: () => void;
  save: (patch: SavePatch) => Promise<{ ok: boolean }>;
}) {
  const [displayName, setDisplayName] = useState(initial.display_name ?? "");
  const [bio, setBio] = useState(initial.bio ?? "");
  const [timezone, setTimezone] = useState(initial.timezone ?? "UTC");
  const [teach, setTeach] = useState<string[]>(initial.teach_skills ?? []);
  const [learn, setLearn] = useState<string[]>(initial.learn_skills ?? []);
  const [days, setDays] = useState<string[]>(initial.available_days ?? []);
  const [session, setSession] = useState<number | null>(initial.session_length_min ?? 60);
  const [avatar, setAvatar] = useState<string | null>(initial.avatar_url ?? null);
  const [saving, setSaving] = useState(false);
  const timezones = useMemo(() => getTimezoneList(), []);

  async function onSave() {
    setSaving(true);
    try {
      await save({
        displayName: displayName.trim(),
        bio: bio.trim() || null,
        timezone: timezone.trim() || "UTC",
        teachSkills: teach,
        learnSkills: learn,
        availableDays: days as ("mon"|"tue"|"wed"|"thu"|"fri"|"sat"|"sun")[],
        sessionLengthMin: session,
        avatarUrl: avatar,
      });
      toast.success("Profile saved");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Profile" subtitle={`@${initial.username ?? "you"} · how others see you`}>
      <div className="space-y-5">
        <AvatarUpload
          userId={userId}
          value={avatar}
          onChange={setAvatar}
          displayName={displayName || initial.username}
        />
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#5c544a]">Display name</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} className={inputClass + " mt-1.5"} />
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#5c544a]">Bio</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={280} className={inputClass + " mt-1.5 resize-none"} placeholder="What's your specialty?" />
          <p className="text-[10px] text-[#bdaf9c] text-right mt-1">{bio.length}/280</p>
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#5c544a]">Timezone</label>
          <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={inputClass + " mt-1.5"}>
            {!timezones.includes(timezone) && <option value={timezone}>{timezone}</option>}
            {timezones.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>
        <SkillEditor label="Skills you teach" value={teach} setValue={setTeach} placeholder="e.g. Calculus" />
        <SkillEditor label="Skills you want to learn" value={learn} setValue={setLearn} placeholder="e.g. French" />
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#5c544a]">Available days</label>
          <div className="grid grid-cols-7 gap-1.5 mt-1.5">
            {DAYS.map((d) => {
              const active = days.includes(d.id);
              return (
                <button key={d.id} type="button" onClick={() => setDays((cur) => cur.includes(d.id) ? cur.filter((x) => x !== d.id) : [...cur, d.id])}
                  className={"py-2 rounded-lg text-xs font-bold border transition-all " + (active ? "bg-[#2d2a26] text-[#f9f6f0] border-[#2d2a26]" : "bg-[#faf6ed] text-[#5c544a] border-[#e7dfd0] hover:border-[#2d2a26]")}>
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#5c544a]">Default session length</label>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {SESSION_LENGTHS.map((mins) => {
              const active = session === mins;
              return (
                <button key={mins} type="button" onClick={() => setSession(mins)}
                  className={"px-4 py-2 rounded-full text-xs font-bold border transition-all " + (active ? "bg-[#2d2a26] text-[#f9f6f0] border-[#2d2a26]" : "bg-[#faf6ed] text-[#5c544a] border-[#e7dfd0] hover:border-[#2d2a26]")}>
                  {mins} min
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={onSave} disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2d2a26] text-[#f9f6f0] text-sm font-bold hover:bg-[#1f1d1a] disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save profile"}
          </button>
        </div>
      </div>
    </Card>
  );
}

function SkillEditor({ label, value, setValue, placeholder }: { label: string; value: string[]; setValue: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  function add() {
    const t = draft.trim();
    if (!t || value.includes(t) || value.length >= 12) return;
    setValue([...value, t]);
    setDraft("");
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
  }
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wider text-[#5c544a]">{label}</label>
      <div className="flex gap-2 mt-1.5">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} placeholder={placeholder} maxLength={40} className={inputClass} />
        <button type="button" onClick={add} disabled={!draft.trim() || value.length >= 12}
          className="inline-flex items-center gap-1 px-3 rounded-xl bg-[#ebe2d5] text-[#2d2a26] text-sm font-bold hover:bg-[#ddd0bb] disabled:opacity-50">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {value.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 pl-3 pr-1.5 py-1 rounded-full bg-[#ebe2d5] text-xs text-[#2d2a26]">
              {s}
              <button type="button" onClick={() => setValue(value.filter((x) => x !== s))} aria-label={`Remove ${s}`} className="w-5 h-5 rounded-full hover:bg-[#d8cfc0] flex items-center justify-center">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationsCard({
  initial,
  onSaved,
  save,
}: {
  initial: ProfileRow;
  onSaved: () => void;
  save: (patch: SavePatch) => Promise<{ ok: boolean }>;
}) {
  const [msg, setMsg] = useState(initial.email_notify_messages);
  const [bk, setBk] = useState(initial.email_notify_bookings);
  const [saving, setSaving] = useState(false);

  async function toggle(next: { msg?: boolean; bk?: boolean }) {
    const newMsg = next.msg ?? msg;
    const newBk = next.bk ?? bk;
    setMsg(newMsg); setBk(newBk);
    setSaving(true);
    try {
      await save({ emailNotifyMessages: newMsg, emailNotifyBookings: newBk });
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Email notifications" subtitle="In-app notifications are always on.">
      <div className="space-y-3">
        <Toggle icon={<BellIcon className="w-4 h-4" />} label="New messages" description="Email me when someone messages me." checked={msg} disabled={saving} onChange={(v) => toggle({ msg: v })} />
        <Toggle icon={<BellIcon className="w-4 h-4" />} label="Booking updates" description="Proposals, accepts, cancels and completions." checked={bk} disabled={saving} onChange={(v) => toggle({ bk: v })} />
      </div>
    </Card>
  );
}

function Toggle({ icon, label, description, checked, onChange, disabled }: { icon?: React.ReactNode; label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-start gap-3 p-3 rounded-xl border border-[#e7dfd0] hover:bg-[#faf6ed] cursor-pointer">
      {icon && <span className="mt-0.5 text-[#7a7164]">{icon}</span>}
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-[#2d2a26]">{label}</span>
        {description && <span className="block text-xs text-[#7a7164] mt-0.5">{description}</span>}
      </span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-1 w-4 h-4 accent-[#2d2a26]" />
    </label>
  );
}

function AccountCard({ email }: { email: string | null }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function onChange() {
    if (next.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (next !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    if (!email) {
      toast.error("No email on file");
      return;
    }
    setBusy(true);
    try {
      // Verify current password by re-authenticating.
      const { error: sErr } = await supabase.auth.signInWithPassword({ email, password: current });
      if (sErr) throw new Error("Current password is incorrect");
      const { error: uErr } = await supabase.auth.updateUser({ password: next });
      if (uErr) throw uErr;
      toast.success("Password updated");
      setCurrent(""); setNext(""); setConfirm("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Account" subtitle="Email and password">
      <div className="space-y-4">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#5c544a]">Email</label>
          <div className={inputClass + " mt-1.5 bg-[#f0e8d8] cursor-not-allowed"}>{email ?? "—"}</div>
        </div>
        <div className="border-t border-[#e7dfd0] pt-4">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#5c544a] mb-3">
            <Lock className="w-3.5 h-3.5" /> Change password
          </div>
          <div className="space-y-2.5">
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Current password" autoComplete="current-password" className={inputClass} />
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="New password" autoComplete="new-password" className={inputClass} />
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm new password" autoComplete="new-password" className={inputClass} />
            <button type="button" onClick={onChange} disabled={busy || !current || !next || !confirm}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#2d2a26] text-[#f9f6f0] text-sm font-bold hover:bg-[#1f1d1a] disabled:opacity-50">
              {busy ? "Updating…" : "Update password"}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}