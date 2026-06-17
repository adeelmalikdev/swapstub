import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getPostAuthDestination = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("onboarded")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) {
      // Be safe: if we can't read the profile, send them to onboarding.
      return { path: "/onboarding" as const };
    }
    if (!data || data.onboarded !== true) {
      return { path: "/onboarding" as const };
    }
    return { path: "/dashboard" as const };
  });

export const markProfileOnboarded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ onboarded: true })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const onboardingSchema = z.object({
  username: z.string().trim().min(2).max(32).regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, and underscores only").optional().or(z.literal("")),
  displayName: z.string().trim().min(1).max(60).optional().or(z.literal("")),
  bio: z.string().trim().max(280).optional().or(z.literal("")),
  timezone: z.string().trim().max(64).optional().or(z.literal("")),
  teachSkills: z.array(z.string().trim().min(1).max(40)).max(12),
  learnSkills: z.array(z.string().trim().min(1).max(40)).max(12),
  availableDays: z.array(z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"])).max(7),
  sessionLengthMin: z.number().int().min(15).max(240).nullable().optional(),
});

export const saveOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => onboardingSchema.parse(data))
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {
      teach_skills: data.teachSkills,
      learn_skills: data.learnSkills,
      available_days: data.availableDays,
      session_length_min: data.sessionLengthMin ?? null,
      onboarded: true,
    };
    if (data.username) patch.username = data.username.toLowerCase();
    if (data.displayName) patch.display_name = data.displayName;
    if (data.bio !== undefined) patch.bio = data.bio || null;
    if (data.timezone) patch.timezone = data.timezone;

    const { error } = await context.supabase
      .from("profiles")
      .update(patch)
      .eq("id", context.userId);
    if (error) {
      if (error.code === "23505") {
        throw new Error("That username is already taken");
      }
      throw new Error(error.message);
    }
    return { ok: true };
  });