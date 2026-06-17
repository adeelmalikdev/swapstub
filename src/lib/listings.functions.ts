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