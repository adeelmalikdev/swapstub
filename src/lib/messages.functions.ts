import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listMyThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("message_threads")
      .select("id, user_a, user_b, booking_id, last_message_at, created_at")
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .order("last_message_at", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    const threads = rows ?? [];
    if (!threads.length) return [];

    const otherIds = Array.from(
      new Set(threads.map((t) => (t.user_a === userId ? t.user_b : t.user_a))),
    );
    const threadIds = threads.map((t) => t.id);
    const bookingIds = threads
      .map((t) => t.booking_id)
      .filter((v): v is string => Boolean(v));

    const [profilesRes, lastMsgsRes, bookingsRes, unreadRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", otherIds),
      supabase
        .from("messages")
        .select("thread_id, body, sender_id, created_at")
        .in("thread_id", threadIds)
        .order("created_at", { ascending: false }),
      bookingIds.length
        ? supabase
            .from("bookings")
            .select("id, ticket_code, status, scheduled_at")
            .in("id", bookingIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("messages")
        .select("thread_id")
        .in("thread_id", threadIds)
        .is("read_at", null)
        .neq("sender_id", userId),
    ]);
    if (profilesRes.error) throw new Error(profilesRes.error.message);
    if (lastMsgsRes.error) throw new Error(lastMsgsRes.error.message);
    if (bookingsRes.error) throw new Error(bookingsRes.error.message);
    if (unreadRes.error) throw new Error(unreadRes.error.message);

    const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
    const bookingMap = new Map((bookingsRes.data ?? []).map((b) => [b.id, b]));
    const lastByThread = new Map<string, { body: string; sender_id: string; created_at: string }>();
    for (const m of lastMsgsRes.data ?? []) {
      if (!lastByThread.has(m.thread_id))
        lastByThread.set(m.thread_id, {
          body: m.body,
          sender_id: m.sender_id,
          created_at: m.created_at,
        });
    }
    const unreadByThread = new Map<string, number>();
    for (const m of unreadRes.data ?? []) {
      unreadByThread.set(m.thread_id, (unreadByThread.get(m.thread_id) ?? 0) + 1);
    }

    return threads.map((t) => {
      const otherId = t.user_a === userId ? t.user_b : t.user_a;
      const last = lastByThread.get(t.id) ?? null;
      return {
        id: t.id,
        other: profileMap.get(otherId) ?? null,
        booking: t.booking_id ? bookingMap.get(t.booking_id) ?? null : null,
        lastMessage: last
          ? { body: last.body, fromMe: last.sender_id === userId, at: last.created_at }
          : null,
        lastMessageAt: t.last_message_at,
        unread: unreadByThread.get(t.id) ?? 0,
      };
    });
  });

export const getThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: t, error } = await supabase
      .from("message_threads")
      .select("id, user_a, user_b, booking_id, created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!t) return null;

    const otherId = t.user_a === userId ? t.user_b : t.user_a;
    const [otherRes, msgsRes, bookingRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio")
        .eq("id", otherId)
        .maybeSingle(),
      supabase
        .from("messages")
        .select("id, sender_id, body, created_at, read_at")
        .eq("thread_id", t.id)
        .order("created_at", { ascending: true }),
      t.booking_id
        ? supabase
            .from("bookings")
            .select("id, ticket_code, status, scheduled_at, duration_min")
            .eq("id", t.booking_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (otherRes.error) throw new Error(otherRes.error.message);
    if (msgsRes.error) throw new Error(msgsRes.error.message);
    if (bookingRes.error) throw new Error(bookingRes.error.message);

    // Mark incoming unread as read
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("thread_id", t.id)
      .is("read_at", null)
      .neq("sender_id", userId);

    return {
      id: t.id,
      other: otherRes.data ?? null,
      booking: bookingRes.data ?? null,
      messages: (msgsRes.data ?? []).map((m) => ({
        id: m.id,
        body: m.body,
        fromMe: m.sender_id === userId,
        createdAt: m.created_at,
      })),
    };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ threadId: z.string().uuid(), body: z.string().trim().min(1).max(2000) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: t, error: tErr } = await supabase
      .from("message_threads")
      .select("id, user_a, user_b")
      .eq("id", data.threadId)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!t) throw new Error("Thread not found");
    if (t.user_a !== userId && t.user_b !== userId) throw new Error("Not a participant");

    const { data: msg, error: mErr } = await supabase
      .from("messages")
      .insert({ thread_id: t.id, sender_id: userId, body: data.body })
      .select("id, body, created_at")
      .single();
    if (mErr) throw new Error(mErr.message);

    await supabase
      .from("message_threads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", t.id);

    // Fire-and-forget notification + email to the other participant.
    const otherId = t.user_a === userId ? t.user_b : t.user_a;
    try {
      const { data: me } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("id", userId)
        .maybeSingle();
      const { notifyNewMessage } = await import("./notify.server");
      await notifyNewMessage({
        recipientUserId: otherId,
        senderName: me?.display_name || me?.username || "Someone",
        preview: data.body,
        threadId: t.id,
      });
    } catch (e) {
      console.warn("[messages] notify failed", e);
    }

    return { id: msg.id, body: msg.body, fromMe: true, createdAt: msg.created_at };
  });