import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, X, Check, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { saveOnboarding, checkUsernameAvailable } from "@/lib/profile.functions";
import { AvatarUpload } from "@/components/avatar-upload";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Welcome to SwapStub — Onboarding" },
      { name: "description", content: "Set up your SwapStub profile and start swapping skills." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnboardingPage,
});

type StepId = "profile" | "teach" | "learn" | "availability";
const STEPS: { id: StepId; title: string; subtitle: string; cta: string }[] = [
  {
    id: "profile",
    title: "Profile basics",
    subtitle: "First, let's set up your ticket. This is how other students will see you on the stub board.",
    cta: "Continue to skills",
  },
  {
    id: "teach",
    title: "Skills you can teach",
    subtitle: "Add a few things you'd happily swap with someone else. Press Enter after each one.",
    cta: "Continue to interests",
  },
  {
    id: "learn",
    title: "Skills you want to learn",
    subtitle: "What are you curious about? We'll match you with people who teach it.",
    cta: "Continue to availability",
  },
  {
    id: "availability",
    title: "Availability",
    subtitle: "Pick the days you can usually meet, and how long a typical swap should run.",
    cta: "Finish & enter dashboard",
  },
];

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

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const FALLBACK_TIMEZONES = [
  "UTC","Pacific/Honolulu","America/Anchorage","America/Los_Angeles","America/Denver",
  "America/Phoenix","America/Chicago","America/Mexico_City","America/New_York",
  "America/Toronto","America/Halifax","America/Sao_Paulo","America/Argentina/Buenos_Aires",
  "Atlantic/Azores","Europe/London","Europe/Dublin","Europe/Lisbon","Europe/Paris",
  "Europe/Berlin","Europe/Madrid","Europe/Rome","Europe/Amsterdam","Europe/Stockholm",
  "Europe/Athens","Europe/Istanbul","Europe/Moscow","Africa/Lagos","Africa/Cairo",
  "Africa/Johannesburg","Asia/Dubai","Asia/Tehran","Asia/Karachi","Asia/Kolkata",
  "Asia/Kathmandu","Asia/Dhaka","Asia/Bangkok","Asia/Jakarta","Asia/Singapore",
  "Asia/Hong_Kong","Asia/Shanghai","Asia/Taipei","Asia/Tokyo","Asia/Seoul",
  "Australia/Perth","Australia/Adelaide","Australia/Sydney","Pacific/Auckland",
];

function getTimezoneList(): string[] {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    if (typeof fn === "function") return fn("timeZone");
  } catch {
    // ignore
  }
  return FALLBACK_TIMEZONES;
}

function OnboardingPage() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [timezone, setTimezone] = useState<string>(() => detectTimezone());
  const [teachSkills, setTeachSkills] = useState<string[]>([]);
  const [learnSkills, setLearnSkills] = useState<string[]>([]);
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [sessionLengthMin, setSessionLengthMin] = useState<number | null>(60);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      if (!data.user) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      setUserId(data.user.id);
      // Pre-fill display name from email if empty.
      const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
      const first = typeof meta.first_name === "string" ? meta.first_name : "";
      const last = typeof meta.last_name === "string" ? meta.last_name : "";
      const composed = `${first} ${last}`.trim();
      if (composed) setDisplayName(composed);
      setAuthChecked(true);
    });
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const step = STEPS[stepIndex];
  const totalSteps = STEPS.length;
  const canGoBack = stepIndex > 0;

  const isLastStep = stepIndex === totalSteps - 1;

  function next() {
    if (!isLastStep) {
      setDirection(1);
      setStepIndex((i) => i + 1);
    } else {
      void submit(false);
    }
  }
  function back() {
    if (!canGoBack) return;
    setDirection(-1);
    setStepIndex((i) => i - 1);
  }

  async function submit(skipped: boolean) {
    setSubmitting(true);
    try {
      await saveOnboarding({
        data: {
          username: username.trim(),
          displayName: displayName.trim(),
          bio: bio.trim(),
          timezone: timezone.trim(),
          teachSkills,
          learnSkills,
          availableDays,
          sessionLengthMin,
          avatarUrl,
        },
      });
      toast.success(skipped ? "You're in — finish your profile anytime" : "Profile saved");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save profile");
    } finally {
      setSubmitting(false);
    }
  }

  if (!authChecked) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#e5ddd3]" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <div className="text-[#7a7164] text-sm tracking-widest uppercase">Loading…</div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen w-full flex items-center justify-center bg-[#e5ddd3] p-6"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      <div className="w-full max-w-[460px]">
        {/* Stacked back-cards for depth */}
        <div className="relative">
          <div className="absolute inset-x-3 -top-2 h-6 bg-[#f0e9da] rounded-[2rem] border border-[#d8cfc0]/70 -z-10" aria-hidden />
          <div className="absolute inset-x-6 -top-4 h-6 bg-[#ebe2d5] rounded-[2rem] border border-[#d8cfc0]/50 -z-20" aria-hidden />

          <div
            key={step.id}
            className="bg-[#f9f6f0] rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.10)] overflow-hidden border border-[#d8cfc0] flex flex-col animate-onboarding-card"
            style={
              {
                ["--card-from-y" as string]: direction === 1 ? "16px" : "-12px",
              } as React.CSSProperties
            }
          >
            {/* Header */}
            <div className="p-7 pb-5">
              <div className="flex justify-between items-center mb-5">
                <span className="text-[10px] font-bold tracking-[0.2em] text-[#5c544a] bg-[#ebe2d5] px-3 py-1 rounded-full inline-flex items-center">
                  <span className="w-1.5 h-1.5 bg-[#2d2a26] rounded-full mr-2" />
                  ONBOARDING
                </span>
                <ProgressDots count={totalSteps} index={stepIndex} />
              </div>

              <h1
                className="text-[2.25rem] leading-[1.05] text-[#2d2a26] mb-2"
                style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700 }}
              >
                {step.title}
              </h1>
              <p className="text-[#7a7164] text-sm leading-relaxed">{step.subtitle}</p>
            </div>

            {/* Perforation */}
            <Perforation />

            {/* Body */}
            <div className="p-7 pt-6">
              {step.id === "profile" && (
                <ProfileStep
                  username={username}
                  setUsername={setUsername}
                  displayName={displayName}
                  setDisplayName={setDisplayName}
                  bio={bio}
                  setBio={setBio}
                  timezone={timezone}
                  setTimezone={setTimezone}
                  userId={userId}
                  avatarUrl={avatarUrl}
                  setAvatarUrl={setAvatarUrl}
                />
              )}
              {step.id === "teach" && (
                <SkillsStep
                  skills={teachSkills}
                  setSkills={setTeachSkills}
                  placeholder="e.g. Calculus tutoring"
                  suggestions={["Calculus", "Spanish", "Python", "Cooking", "Guitar"]}
                />
              )}
              {step.id === "learn" && (
                <SkillsStep
                  skills={learnSkills}
                  setSkills={setLearnSkills}
                  placeholder="e.g. Watercolor basics"
                  suggestions={["French", "Chess", "Public speaking", "React", "Yoga"]}
                />
              )}
              {step.id === "availability" && (
                <AvailabilityStep
                  availableDays={availableDays}
                  setAvailableDays={setAvailableDays}
                  sessionLengthMin={sessionLengthMin}
                  setSessionLengthMin={setSessionLengthMin}
                />
              )}
            </div>

            {/* Footer */}
            <div className="px-7 pb-7 pt-1 space-y-3">
              <button
                type="button"
                onClick={next}
                disabled={submitting}
                className="w-full bg-[#2d2a26] text-[#f9f6f0] py-4 rounded-2xl font-bold text-sm hover:scale-[1.01] active:scale-[0.99] transition-all shadow-[0_10px_24px_-12px_rgba(45,42,38,0.6)] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting && isLastStep ? "Saving…" : step.cta}
              </button>
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-[#7a7164]">
                <button
                  type="button"
                  onClick={back}
                  disabled={!canGoBack || submitting}
                  className="inline-flex items-center gap-1.5 hover:text-[#2d2a26] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => submit(true)}
                  disabled={submitting}
                  className="hover:text-[#2d2a26] transition-colors disabled:opacity-40"
                >
                  Skip for now
                </button>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-[10px] font-mono uppercase tracking-[0.3em] text-[#7a7164]/70">
          STUB · {String(stepIndex + 1).padStart(2, "0")} / {String(totalSteps).padStart(2, "0")} · SwapStub
        </p>
      </div>

      <style>{`
        @keyframes onboardingCardIn {
          0% { opacity: 0; transform: translateY(var(--card-from-y, 16px)) rotate(-0.4deg); }
          60% { opacity: 1; }
          100% { opacity: 1; transform: translateY(0) rotate(0); }
        }
        .animate-onboarding-card { animation: onboardingCardIn 360ms cubic-bezier(0.22, 1, 0.36, 1); }
        @media (prefers-reduced-motion: reduce) {
          .animate-onboarding-card { animation: none; }
        }
      `}</style>
    </main>
  );
}

function ProgressDots({ count, index }: { count: number; index: number }) {
  return (
    <div className="flex items-center gap-1.5 bg-[#ebe2d5] px-2.5 py-1 rounded-full">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className={
            "h-1.5 rounded-full transition-all duration-300 " +
            (i < index
              ? "w-3 bg-[#2d2a26]/70"
              : i === index
              ? "w-5 bg-[#2d2a26]"
              : "w-1.5 bg-[#bdaf9c]")
          }
        />
      ))}
    </div>
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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[11px] font-bold text-[#5c544a] uppercase tracking-wider">
      {children}
    </label>
  );
}

const inputClass =
  "w-full px-4 py-3 rounded-xl bg-[#ebe2d5]/50 border border-[#d8cfc0] focus:border-[#2d2a26] focus:ring-0 text-sm outline-none transition-all placeholder:text-[#bdaf9c] text-[#2d2a26]";

function ProfileStep({
  username,
  setUsername,
  displayName,
  setDisplayName,
  bio,
  setBio,
  timezone,
  setTimezone,
  userId,
  avatarUrl,
  setAvatarUrl,
}: {
  username: string;
  setUsername: (v: string) => void;
  displayName: string;
  setDisplayName: (v: string) => void;
  bio: string;
  setBio: (v: string) => void;
  timezone: string;
  setTimezone: (v: string) => void;
  userId: string | null;
  avatarUrl: string | null;
  setAvatarUrl: (v: string | null) => void;
}) {
  const timezones = useMemo(() => getTimezoneList(), []);
  const [unameStatus, setUnameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid" | "error"
  >("idle");

  useEffect(() => {
    const trimmed = username.trim();
    if (!trimmed) {
      setUnameStatus("idle");
      return;
    }
    if (!/^[a-zA-Z0-9_]{2,32}$/.test(trimmed)) {
      setUnameStatus("invalid");
      return;
    }
    setUnameStatus("checking");
    const handle = setTimeout(async () => {
      try {
        const res = await checkUsernameAvailable({ data: { username: trimmed } });
        setUnameStatus(res.available ? "available" : "taken");
      } catch {
        setUnameStatus("error");
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [username]);

  const unameMessage =
    unameStatus === "invalid"
      ? "2–32 chars · letters, numbers, underscore"
      : unameStatus === "taken"
        ? "That username is taken"
        : unameStatus === "available"
          ? "Available"
          : unameStatus === "error"
            ? "Couldn't check right now"
            : "";
  const unameColor =
    unameStatus === "available"
      ? "text-emerald-700"
      : unameStatus === "taken" || unameStatus === "invalid"
        ? "text-red-600"
        : "text-[#7a7164]";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-[#ebe2d5] border-2 border-dashed border-[#bdaf9c] flex items-center justify-center cursor-pointer hover:bg-[#e2d8ca] transition-colors">
          <Camera className="w-5 h-5 text-[#7a7164]" />
        </div>
        <div>
          <p className="text-sm font-bold text-[#2d2a26]">Avatar stub</p>
          <p className="text-xs text-[#7a7164]">Upload coming soon</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <FieldLabel>Username</FieldLabel>
          <div className="relative">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              type="text"
              placeholder="student_pro"
              className={inputClass + " pr-9"}
              maxLength={32}
              autoComplete="off"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {unameStatus === "checking" && (
                <Loader2 className="w-4 h-4 text-[#7a7164] animate-spin" />
              )}
              {unameStatus === "available" && (
                <Check className="w-4 h-4 text-emerald-600" />
              )}
              {(unameStatus === "taken" || unameStatus === "invalid") && (
                <X className="w-4 h-4 text-red-600" />
              )}
            </span>
          </div>
          {unameMessage && (
            <p className={`text-[10px] ${unameColor}`}>{unameMessage}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Display name</FieldLabel>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            type="text"
            placeholder="Alex Rivera"
            className={inputClass}
            maxLength={60}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <FieldLabel>Short bio</FieldLabel>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          placeholder="What's your specialty?"
          className={inputClass + " resize-none"}
          maxLength={280}
        />
        <p className="text-[10px] text-[#bdaf9c] text-right">{bio.length}/280</p>
      </div>

      <div className="space-y-1.5">
        <FieldLabel>Timezone</FieldLabel>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className={inputClass + " appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%237a7164%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%226 9 12 15 18 9%22/></svg>')] bg-no-repeat bg-[right_1rem_center] pr-10"}
        >
          {!timezones.includes(timezone) && timezone && (
            <option value={timezone}>{timezone}</option>
          )}
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function SkillsStep({
  skills,
  setSkills,
  placeholder,
  suggestions,
}: {
  skills: string[];
  setSkills: (v: string[]) => void;
  placeholder: string;
  suggestions: string[];
}) {
  const [draft, setDraft] = useState("");
  const unused = useMemo(
    () => suggestions.filter((s) => !skills.some((sk) => sk.toLowerCase() === s.toLowerCase())),
    [suggestions, skills],
  );

  function addSkill(raw: string) {
    const value = raw.trim();
    if (!value) return;
    if (value.length > 40) {
      toast.error("Keep skills under 40 characters");
      return;
    }
    if (skills.length >= 12) {
      toast.error("Max 12 skills");
      return;
    }
    if (skills.some((s) => s.toLowerCase() === value.toLowerCase())) {
      setDraft("");
      return;
    }
    setSkills([...skills, value]);
    setDraft("");
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSkill(draft);
    } else if (e.key === "Backspace" && !draft && skills.length) {
      setSkills(skills.slice(0, -1));
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <FieldLabel>Add a skill</FieldLabel>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            placeholder={placeholder}
            className={inputClass + " flex-1"}
            maxLength={40}
          />
          <button
            type="button"
            onClick={() => addSkill(draft)}
            className="px-4 rounded-xl bg-[#2d2a26] text-[#f9f6f0] text-sm font-bold inline-flex items-center gap-1 hover:scale-[1.02] active:scale-[0.98] transition-all"
            aria-label="Add skill"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {skills.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {skills.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1.5 bg-[#2d2a26] text-[#f9f6f0] text-xs font-semibold px-3 py-1.5 rounded-full"
            >
              {s}
              <button
                type="button"
                onClick={() => setSkills(skills.filter((x) => x !== s))}
                className="opacity-70 hover:opacity-100 transition-opacity"
                aria-label={`Remove ${s}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[#7a7164]">No skills yet. Add one above or tap a suggestion.</p>
      )}

      {unused.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#bdaf9c]">Suggestions</p>
          <div className="flex flex-wrap gap-2">
            {unused.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addSkill(s)}
                className="text-xs font-medium text-[#5c544a] bg-[#ebe2d5]/70 border border-dashed border-[#bdaf9c] px-3 py-1.5 rounded-full hover:bg-[#ebe2d5] hover:text-[#2d2a26] transition-colors"
              >
                + {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AvailabilityStep({
  availableDays,
  setAvailableDays,
  sessionLengthMin,
  setSessionLengthMin,
}: {
  availableDays: string[];
  setAvailableDays: (v: string[]) => void;
  sessionLengthMin: number | null;
  setSessionLengthMin: (v: number | null) => void;
}) {
  function toggleDay(id: string) {
    setAvailableDays(
      availableDays.includes(id) ? availableDays.filter((d) => d !== id) : [...availableDays, id],
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <FieldLabel>Days you can meet</FieldLabel>
        <div className="grid grid-cols-7 gap-1.5">
          {DAYS.map((d) => {
            const active = availableDays.includes(d.id);
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => toggleDay(d.id)}
                className={
                  "py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all " +
                  (active
                    ? "bg-[#2d2a26] text-[#f9f6f0] shadow-inner"
                    : "bg-[#ebe2d5]/60 text-[#5c544a] hover:bg-[#ebe2d5]")
                }
                aria-pressed={active}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <FieldLabel>Typical session length</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {SESSION_LENGTHS.map((m) => {
            const active = sessionLengthMin === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setSessionLengthMin(m)}
                className={
                  "px-4 py-2 rounded-xl text-sm font-semibold transition-all " +
                  (active
                    ? "bg-[#2d2a26] text-[#f9f6f0]"
                    : "bg-[#ebe2d5]/60 text-[#5c544a] hover:bg-[#ebe2d5]")
                }
                aria-pressed={active}
              >
                {m} min
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-[#d8cfc0] bg-[#ebe2d5]/30 p-4 text-xs text-[#7a7164] leading-relaxed">
        <span className="font-bold text-[#5c544a]">Heads up:</span> you can change all of this from
        your profile later. Hit <span className="font-bold">Finish</span> when you're ready.
      </div>
    </div>
  );
}