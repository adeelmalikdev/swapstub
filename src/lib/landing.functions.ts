import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicSupabase() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export type LandingStats = {
  activeListings: number;
  swapsCompleted: number;
  members: number;
};

export const getLandingStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<LandingStats> => {
    const sb = publicSupabase();
    const [listings, completed, members] = await Promise.all([
      sb.from("listings").select("*", { count: "exact", head: true }).eq("is_active", true),
      sb.from("bookings").select("*", { count: "exact", head: true }).eq("status", "completed"),
      sb.from("profiles").select("*", { count: "exact", head: true }),
    ]);
    return {
      activeListings: listings.count ?? 0,
      swapsCompleted: completed.count ?? 0,
      members: members.count ?? 0,
    };
  },
);

export type FeaturedCategory = {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  listingCount: number;
};

export const getFeaturedCategories = createServerFn({ method: "GET" }).handler(
  async (): Promise<FeaturedCategory[]> => {
    const sb = publicSupabase();
    const { data: cats, error } = await sb
      .from("categories")
      .select("id, slug, name, icon, sort_order")
      .order("sort_order", { ascending: true });
    if (error) throw error;

    const counts = await Promise.all(
      (cats ?? []).map((c) =>
        sb
          .from("listings")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true)
          .eq("offered_category_id", c.id)
          .then((r) => ({ id: c.id, count: r.count ?? 0 })),
      ),
    );
    const countMap = new Map(counts.map((x) => [x.id, x.count]));

    return (cats ?? []).map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      icon: c.icon,
      listingCount: countMap.get(c.id) ?? 0,
    }));
  },
);