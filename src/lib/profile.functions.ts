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
    const patch: {
      teach_skills: string[];
      learn_skills: string[];
      available_days: string[];
      session_length_min: number | null;
      onboarded: boolean;
      username?: string;
      display_name?: string;
      bio?: string | null;
      timezone?: string;
    } = {
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

export const getDashboardData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const nowIso = new Date().toISOString();

    const [profileRes, listingsRes, bookingsRes, threadsRes, suggestedRes] =
      await Promise.all([
        supabase
          .from("profiles")
          .select(
            "username, display_name, avatar_url, bio, teach_skills, learn_skills, available_days, session_length_min, timezone",
          )
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("listings")
          .select("id, offered_skill, wanted_skill, is_active, ticket_code, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("bookings")
          .select(
            "id, scheduled_at, duration_min, status, ticket_code, host_id, requester_id, listing_id",
          )
          .or(`host_id.eq.${userId},requester_id.eq.${userId}`)
          .gte("scheduled_at", nowIso)
          .in("status", ["pending", "confirmed"])
          .order("scheduled_at", { ascending: true })
          .limit(5),
        supabase
          .from("message_threads")
          .select("id, user_a, user_b, last_message_at")
          .or(`user_a.eq.${userId},user_b.eq.${userId}`)
          .order("last_message_at", { ascending: false })
          .limit(20),
        supabase
          .from("listings")
          .select("id, offered_skill, wanted_skill, ticket_code, user_id, created_at")
          .eq("is_active", true)
          .neq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(24),
      ]);

    const profile = profileRes.data ?? null;
    const myListings = listingsRes.data ?? [];
    const upcomingBookings = bookingsRes.data ?? [];
    const threads = threadsRes.data ?? [];

    // unread messages = messages in my threads, not from me, not read
    let unreadCount = 0;
    if (threads.length > 0) {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .in(
          "thread_id",
          threads.map((t) => t.id),
        )
        .neq("sender_id", userId)
        .is("read_at", null);
      unreadCount = count ?? 0;
    }

    // matches: listings whose offered ∈ my learn AND wanted ∈ my teach (lowercased)
    const norm = (s: string) => s.trim().toLowerCase();
    const myTeach = new Set((profile?.teach_skills ?? []).map(norm));
    const myLearn = new Set((profile?.learn_skills ?? []).map(norm));
    const all = suggestedRes.data ?? [];
    const matches = all
      .filter(
        (l) => myLearn.has(norm(l.offered_skill)) && myTeach.has(norm(l.wanted_skill)),
      )
      .slice(0, 6);
    const explore = all
      .filter((l) => !matches.find((m) => m.id === l.id))
      .slice(0, 6);

    const activeListingsCount = myListings.filter((l) => l.is_active).length;

    // profile completeness (0–100)
    const checks = [
      !!profile?.username,
      !!profile?.display_name,
      !!profile?.bio,
      (profile?.teach_skills?.length ?? 0) > 0,
      (profile?.learn_skills?.length ?? 0) > 0,
      (profile?.available_days?.length ?? 0) > 0,
      !!profile?.session_length_min,
      !!profile?.avatar_url,
    ];
    const completeness = Math.round(
      (checks.filter(Boolean).length / checks.length) * 100,
    );

    return {
      profile,
      stats: {
        activeListings: activeListingsCount,
        upcomingSessions: upcomingBookings.length,
        unreadMessages: unreadCount,
        completeness,
      },
      myListings: myListings.slice(0, 5),
      upcomingBookings,
      matches,
      explore,
      hasAnyListing: myListings.length > 0,
    };
  });