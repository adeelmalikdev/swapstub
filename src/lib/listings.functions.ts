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