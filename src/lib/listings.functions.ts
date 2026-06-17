import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

export const listCategories = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, icon, sort_order")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

const DAY_ENUM = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

export const getListing = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: l, error } = await supabase
      .from("listings")
      .select(
        "id, ticket_code, user_id, offered_skill, wanted_skill, offered_category_id, wanted_category_id, description, availability, created_at, is_active",
      )
      .eq("id", data.id)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!l) return null;

    const [authorRes, catsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, display_name, bio, avatar_url, timezone, teach_skills, learn_skills")
        .eq("id", l.user_id)
        .maybeSingle(),
      supabase
        .from("categories")
        .select("id, name, slug")
        .in(
          "id",
          [l.offered_category_id, l.wanted_category_id].filter((v): v is string => Boolean(v)),
        ),
    ]);
    if (authorRes.error) throw new Error(authorRes.error.message);
    if (catsRes.error) throw new Error(catsRes.error.message);
    const cm = new Map((catsRes.data ?? []).map((c) => [c.id, c]));

    return {
      id: l.id,
      ticketCode: l.ticket_code,
      userId: l.user_id,
      offeredSkill: l.offered_skill,
      wantedSkill: l.wanted_skill,
      description: l.description,
      availability:
        (l.availability as { days?: string[]; sessionLengthMin?: number | null } | null) ?? null,
      createdAt: l.created_at,
      offeredCategory: l.offered_category_id ? cm.get(l.offered_category_id) ?? null : null,
      wantedCategory: l.wanted_category_id ? cm.get(l.wanted_category_id) ?? null : null,
      author: authorRes.data ?? null,
    };
  });

const proposeSwapSchema = z.object({
  listingId: z.string().uuid(),
  scheduledAt: z.string().min(10), // ISO datetime
  durationMin: z.number().int().min(15).max(240),
  message: z.string().trim().min(1).max(1000),
});

export const proposeSwap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => proposeSwapSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: listing, error: lErr } = await supabase
      .from("listings")
      .select("id, user_id, is_active")
      .eq("id", data.listingId)
      .maybeSingle();
    if (lErr) throw new Error(lErr.message);
    if (!listing || !listing.is_active) throw new Error("Listing not available");
    if (listing.user_id === userId) throw new Error("You can't propose a swap on your own stub");

    const scheduled = new Date(data.scheduledAt);
    if (Number.isNaN(scheduled.getTime())) throw new Error("Invalid scheduled time");
    if (scheduled.getTime() < Date.now() - 60_000) throw new Error("Pick a future time");

    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .insert({
        listing_id: listing.id,
        requester_id: userId,
        host_id: listing.user_id,
        scheduled_at: scheduled.toISOString(),
        duration_min: data.durationMin,
        message: data.message,
      })
      .select("id, ticket_code")
      .single();
    if (bErr) throw new Error(bErr.message);

    // Find or create thread between users (canonical ordering by uuid string).
    const [ua, ub] = [userId, listing.user_id].sort();
    const { data: existing, error: tErr } = await supabase
      .from("message_threads")
      .select("id")
      .eq("user_a", ua)
      .eq("user_b", ub)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);

    let threadId = existing?.id;
    if (!threadId) {
      const { data: t, error: ctErr } = await supabase
        .from("message_threads")
        .insert({ user_a: ua, user_b: ub, booking_id: booking.id })
        .select("id")
        .single();
      if (ctErr) throw new Error(ctErr.message);
      threadId = t.id;
    }

    const { error: mErr } = await supabase
      .from("messages")
      .insert({ thread_id: threadId, sender_id: userId, body: data.message });
    if (mErr) throw new Error(mErr.message);

    await supabase
      .from("message_threads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", threadId);

    return { bookingId: booking.id, ticketCode: booking.ticket_code, threadId };
  });

const discoverFilterSchema = z.object({
  search: z.string().trim().max(80).optional().or(z.literal("")),
  offeredCategoryId: z.string().uuid().optional().or(z.literal("")),
  wantedCategoryId: z.string().uuid().optional().or(z.literal("")),
  day: DAY_ENUM.optional(),
  limit: z.number().int().min(1).max(60).optional(),
});

export const discoverListings = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => discoverFilterSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    let q = supabase
      .from("listings")
      .select(
        "id, ticket_code, offered_skill, wanted_skill, offered_category_id, wanted_category_id, description, availability, created_at, user_id",
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 40);

    if (data.search) {
      const s = data.search.replace(/[%,]/g, " ");
      q = q.or(`offered_skill.ilike.%${s}%,wanted_skill.ilike.%${s}%,description.ilike.%${s}%`);
    }
    if (data.offeredCategoryId) q = q.eq("offered_category_id", data.offeredCategoryId);
    if (data.wantedCategoryId) q = q.eq("wanted_category_id", data.wantedCategoryId);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    let listings = rows ?? [];

    if (data.day) {
      listings = listings.filter((l) => {
        const a = l.availability as { days?: string[] } | null;
        return Array.isArray(a?.days) && a!.days!.includes(data.day!);
      });
    }

    const userIds = Array.from(new Set(listings.map((l) => l.user_id)));
    const categoryIds = Array.from(
      new Set(
        listings
          .flatMap((l) => [l.offered_category_id, l.wanted_category_id])
          .filter((v): v is string => Boolean(v)),
      ),
    );

    const [profilesRes, categoriesRes] = await Promise.all([
      userIds.length
        ? supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url, timezone")
            .in("id", userIds)
        : Promise.resolve({ data: [], error: null }),
      categoryIds.length
        ? supabase.from("categories").select("id, name, slug").in("id", categoryIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (profilesRes.error) throw new Error(profilesRes.error.message);
    if (categoriesRes.error) throw new Error(categoriesRes.error.message);

    const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
    const categoryMap = new Map((categoriesRes.data ?? []).map((c) => [c.id, c]));

    return listings.map((l) => ({
      id: l.id,
      ticketCode: l.ticket_code,
      offeredSkill: l.offered_skill,
      wantedSkill: l.wanted_skill,
      description: l.description,
      availability: (l.availability as { days?: string[]; sessionLengthMin?: number | null } | null) ?? null,
      createdAt: l.created_at,
      offeredCategory: l.offered_category_id ? categoryMap.get(l.offered_category_id) ?? null : null,
      wantedCategory: l.wanted_category_id ? categoryMap.get(l.wanted_category_id) ?? null : null,
      author: profileMap.get(l.user_id) ?? null,
    }));
  });

const createListingSchema = z.object({
  offeredSkill: z.string().trim().min(2).max(60),
  wantedSkill: z.string().trim().min(2).max(60),
  offeredCategoryId: z.string().uuid().nullable().optional(),
  wantedCategoryId: z.string().uuid().nullable().optional(),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  availableDays: z.array(DAY_ENUM).max(7),
  sessionLengthMin: z.number().int().min(15).max(240).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const createListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createListingSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const availability =
      data.availableDays.length || data.sessionLengthMin
        ? { days: data.availableDays, sessionLengthMin: data.sessionLengthMin ?? null }
        : null;
    const { data: row, error } = await supabase
      .from("listings")
      .insert({
        user_id: userId,
        offered_skill: data.offeredSkill,
        wanted_skill: data.wantedSkill,
        offered_category_id: data.offeredCategoryId ?? null,
        wanted_category_id: data.wantedCategoryId ?? null,
        description: data.description ? data.description : null,
        availability,
        is_active: data.isActive ?? true,
      })
      .select("id, ticket_code")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, ticketCode: row.ticket_code };
  });

export const listMyListings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("listings")
      .select(
        "id, ticket_code, offered_skill, wanted_skill, offered_category_id, wanted_category_id, description, availability, is_active, created_at, updated_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const listings = rows ?? [];
    const categoryIds = Array.from(
      new Set(
        listings
          .flatMap((l) => [l.offered_category_id, l.wanted_category_id])
          .filter((v): v is string => Boolean(v)),
      ),
    );
    const { data: cats } = categoryIds.length
      ? await supabase.from("categories").select("id, name, slug").in("id", categoryIds)
      : { data: [] as { id: string; name: string; slug: string }[] };
    const cm = new Map((cats ?? []).map((c) => [c.id, c]));

    // Count pending booking requests per listing
    const listingIds = listings.map((l) => l.id);
    let pendingMap = new Map<string, number>();
    if (listingIds.length) {
      const { data: bks } = await supabase
        .from("bookings")
        .select("listing_id, status")
        .in("listing_id", listingIds);
      for (const b of bks ?? []) {
        if (b.status === "pending") {
          pendingMap.set(b.listing_id, (pendingMap.get(b.listing_id) ?? 0) + 1);
        }
      }
    }

    return listings.map((l) => ({
      id: l.id,
      ticketCode: l.ticket_code,
      offeredSkill: l.offered_skill,
      wantedSkill: l.wanted_skill,
      description: l.description,
      availability:
        (l.availability as { days?: string[]; sessionLengthMin?: number | null } | null) ?? null,
      isActive: l.is_active,
      createdAt: l.created_at,
      updatedAt: l.updated_at,
      offeredCategory: l.offered_category_id ? cm.get(l.offered_category_id) ?? null : null,
      wantedCategory: l.wanted_category_id ? cm.get(l.wanted_category_id) ?? null : null,
      pendingRequests: pendingMap.get(l.id) ?? 0,
    }));
  });

const updateListingSchema = z.object({
  id: z.string().uuid(),
  offeredSkill: z.string().trim().min(2).max(60).optional(),
  wantedSkill: z.string().trim().min(2).max(60).optional(),
  offeredCategoryId: z.string().uuid().nullable().optional(),
  wantedCategoryId: z.string().uuid().nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  availableDays: z.array(DAY_ENUM).max(7).optional(),
  sessionLengthMin: z.number().int().min(15).max(240).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const updateListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateListingSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: Database["public"]["Tables"]["listings"]["Update"] = {
      updated_at: new Date().toISOString(),
    };
    if (data.offeredSkill !== undefined) patch.offered_skill = data.offeredSkill;
    if (data.wantedSkill !== undefined) patch.wanted_skill = data.wantedSkill;
    if (data.offeredCategoryId !== undefined) patch.offered_category_id = data.offeredCategoryId;
    if (data.wantedCategoryId !== undefined) patch.wanted_category_id = data.wantedCategoryId;
    if (data.description !== undefined) patch.description = data.description || null;
    if (data.isActive !== undefined) patch.is_active = data.isActive;
    if (data.availableDays !== undefined || data.sessionLengthMin !== undefined) {
      patch.availability = {
        days: data.availableDays ?? [],
        sessionLengthMin: data.sessionLengthMin ?? null,
      };
    }
    const { error } = await supabase
      .from("listings")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("listings")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });