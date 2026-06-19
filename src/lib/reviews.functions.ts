import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

const submitSchema = z.object({
  bookingId: z.string().uuid(),
  revieweeId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().max(500).optional().or(z.literal("")),
});

export const submitReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => submitSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.revieweeId === userId) {
      throw new Error("You can't review yourself");
    }
    const { error } = await supabase.from("reviews").insert({
      booking_id: data.bookingId,
      reviewer_id: userId,
      reviewee_id: data.revieweeId,
      rating: data.rating,
      body: data.body ? data.body : null,
    });
    if (error) {
      if (error.code === "23505") throw new Error("You already reviewed this swap");
      throw new Error(error.message);
    }
    try {
      const { data: me } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("id", userId)
        .maybeSingle();
      const { notifyReview } = await import("./notify.server");
      await notifyReview({
        recipientUserId: data.revieweeId,
        reviewerName: me?.display_name || me?.username || "Someone",
        rating: data.rating,
      });
    } catch (e) {
      console.warn("[reviews] notify failed", e);
    }
    return { ok: true };
  });

export const listReviewsForUser = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ userId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: rows, error } = await supabase
      .from("reviews")
      .select("id, rating, body, reviewer_id, created_at")
      .eq("reviewee_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const reviews = rows ?? [];
    const reviewerIds = Array.from(new Set(reviews.map((r) => r.reviewer_id)));
    const { data: profs } = reviewerIds.length
      ? await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", reviewerIds)
      : { data: [] as { id: string; username: string | null; display_name: string | null; avatar_url: string | null }[] };
    const pm = new Map((profs ?? []).map((p) => [p.id, p]));
    const avg =
      reviews.length === 0
        ? null
        : reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    return {
      count: reviews.length,
      average: avg,
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        body: r.body,
        createdAt: r.created_at,
        reviewer: pm.get(r.reviewer_id) ?? null,
      })),
    };
  });