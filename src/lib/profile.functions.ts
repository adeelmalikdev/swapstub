import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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