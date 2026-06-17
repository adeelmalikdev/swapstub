import type { Database } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail, renderMessageEmail, renderBookingEmail } from "./email.server";

type Kind = "message" | "booking_proposed" | "booking_accepted" | "booking_declined" | "booking_cancelled" | "booking_completed" | "review";

export async function createNotification(args: {
  userId: string;
  kind: Kind;
  title: string;
  body?: string | null;
  link?: string | null;
}): Promise<void> {
  try {
    await supabaseAdmin.from("notifications").insert({
      user_id: args.userId,
      kind: args.kind,
      title: args.title,
      body: args.body ?? null,
      link: args.link ?? null,
    });
  } catch (e) {
    console.warn("[notify] insert failed", e);
  }
}

async function getRecipient(userId: string): Promise<{
  email: string | null;
  display_name: string | null;
  email_notify_messages: boolean;
  email_notify_bookings: boolean;
} | null> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("display_name, email_notify_messages, email_notify_bookings")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return null;
  const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
  return {
    email: u?.user?.email ?? null,
    display_name: profile.display_name,
    email_notify_messages: profile.email_notify_messages,
    email_notify_bookings: profile.email_notify_bookings,
  };
}

export async function notifyNewMessage(args: {
  recipientUserId: string;
  senderName: string;
  preview: string;
  threadId: string;
}): Promise<void> {
  await createNotification({
    userId: args.recipientUserId,
    kind: "message",
    title: `${args.senderName} sent you a message`,
    body: args.preview.slice(0, 200),
    link: `/messages?t=${args.threadId}`,
  });
  const r = await getRecipient(args.recipientUserId);
  if (!r?.email || !r.email_notify_messages) return;
  const { subject, html } = renderMessageEmail({
    fromName: args.senderName,
    preview: args.preview,
    threadId: args.threadId,
  });
  await sendEmail({ to: r.email, subject, html });
}

export async function notifyBookingEvent(args: {
  recipientUserId: string;
  kind: Extract<Kind, `booking_${string}`>;
  title: string;
  body: string;
  ticketCode: string;
}): Promise<void> {
  await createNotification({
    userId: args.recipientUserId,
    kind: args.kind,
    title: args.title,
    body: args.body,
    link: `/bookings`,
  });
  const r = await getRecipient(args.recipientUserId);
  if (!r?.email || !r.email_notify_bookings) return;
  const { subject, html } = renderBookingEmail({
    toName: r.display_name ?? "there",
    title: args.title,
    body: args.body,
    ticketCode: args.ticketCode,
  });
  await sendEmail({ to: r.email, subject, html });
}

export async function notifyReview(args: {
  recipientUserId: string;
  reviewerName: string;
  rating: number;
}): Promise<void> {
  await createNotification({
    userId: args.recipientUserId,
    kind: "review",
    title: `${args.reviewerName} left you a ${args.rating}★ review`,
    body: "View it on your profile",
    link: `/dashboard`,
  });
}

export type { Database };