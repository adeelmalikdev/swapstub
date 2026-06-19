import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listMyBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("bookings")
      .select(
        "id, ticket_code, listing_id, requester_id, host_id, scheduled_at, duration_min, message, status, created_at, updated_at",
      )
      .or(`requester_id.eq.${userId},host_id.eq.${userId}`)
      .order("scheduled_at", { ascending: false });
    if (error) throw new Error(error.message);
    const bookings = rows ?? [];

    const listingIds = Array.from(new Set(bookings.map((b) => b.listing_id)));
    const userIds = Array.from(
      new Set(bookings.flatMap((b) => [b.requester_id, b.host_id])),
    );

    const [listingsRes, profilesRes] = await Promise.all([
      listingIds.length
        ? supabase
            .from("listings")
            .select("id, ticket_code, offered_skill, wanted_skill")
            .in("id", listingIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url, timezone")
            .in("id", userIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (listingsRes.error) throw new Error(listingsRes.error.message);
    if (profilesRes.error) throw new Error(profilesRes.error.message);
    const lm = new Map((listingsRes.data ?? []).map((l) => [l.id, l]));
    const pm = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));

    const completedIds = bookings
      .filter((b) => b.status === "completed")
      .map((b) => b.id);
    const reviewedByMe = new Set<string>();
    if (completedIds.length > 0) {
      const { data: rev } = await supabase
        .from("reviews")
        .select("booking_id")
        .eq("reviewer_id", userId)
        .in("booking_id", completedIds);
      (rev ?? []).forEach((r) => reviewedByMe.add(r.booking_id));
    }

    return bookings.map((b) => ({
      id: b.id,
      ticketCode: b.ticket_code,
      listing: lm.get(b.listing_id) ?? null,
      requester: pm.get(b.requester_id) ?? null,
      host: pm.get(b.host_id) ?? null,
      scheduledAt: b.scheduled_at,
      durationMin: b.duration_min,
      message: b.message,
      status: b.status as
        | "pending"
        | "accepted"
        | "declined"
        | "completed"
        | "cancelled",
      createdAt: b.created_at,
      updatedAt: b.updated_at,
      role: b.host_id === userId ? ("host" as const) : ("requester" as const),
      reviewedByMe: reviewedByMe.has(b.id),
    }));
  });

const ACTIONS = ["accept", "decline", "cancel", "complete"] as const;

export const updateBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ id: z.string().uuid(), action: z.enum(ACTIONS) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: b, error } = await supabase
      .from("bookings")
      .select("id, requester_id, host_id, status, scheduled_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!b) throw new Error("Booking not found");
    const isHost = b.host_id === userId;
    const isRequester = b.requester_id === userId;
    if (!isHost && !isRequester) throw new Error("Not a participant");

    let nextStatus: "pending" | "accepted" | "declined" | "completed" | "cancelled";
    switch (data.action) {
      case "accept":
        if (!isHost) throw new Error("Only the host can accept");
        if (b.status !== "pending") throw new Error("Booking is not pending");
        nextStatus = "accepted";
        break;
      case "decline":
        if (!isHost) throw new Error("Only the host can decline");
        if (b.status !== "pending") throw new Error("Booking is not pending");
        nextStatus = "declined";
        break;
      case "cancel":
        if (b.status !== "pending" && b.status !== "accepted")
          throw new Error("Booking can't be cancelled");
        nextStatus = "cancelled";
        break;
      case "complete":
        if (b.status !== "accepted") throw new Error("Only accepted swaps can be completed");
        nextStatus = "completed";
        break;
    }

    const { error: uErr } = await supabase
      .from("bookings")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (uErr) throw new Error(uErr.message);

    // Notify the other party.
    try {
      const otherId = isHost ? b.requester_id : b.host_id;
      const { data: me } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("id", userId)
        .maybeSingle();
      const actorName = me?.display_name || me?.username || "Someone";
      const { data: booking } = await supabase
        .from("bookings")
        .select("ticket_code")
        .eq("id", data.id)
        .maybeSingle();
      const titles = {
        accepted: `${actorName} accepted your swap`,
        declined: `${actorName} declined your swap`,
        cancelled: `${actorName} cancelled the swap`,
        completed: `${actorName} marked the swap as completed`,
      } as const;
      const kindMap = {
        accepted: "booking_accepted",
        declined: "booking_declined",
        cancelled: "booking_cancelled",
        completed: "booking_completed",
      } as const;
      const { notifyBookingEvent } = await import("./notify.server");
      await notifyBookingEvent({
        recipientUserId: otherId,
        kind: kindMap[nextStatus as keyof typeof kindMap],
        title: titles[nextStatus as keyof typeof titles],
        body: `Stub ${booking?.ticket_code ?? ""} · scheduled ${new Date(b.scheduled_at).toLocaleString()}`,
        ticketCode: booking?.ticket_code ?? "",
      });
    } catch (e) {
      console.warn("[bookings] notify failed", e);
    }

    return { ok: true, status: nextStatus };
  });