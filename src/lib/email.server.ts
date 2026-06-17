import type { Database } from "@/integrations/supabase/types";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM = "SwapStub <onboarding@resend.dev>";

function appOrigin() {
  return process.env.APP_ORIGIN || "https://swapstub.app";
}

export type EmailKind = "message" | "booking";

export async function sendEmail(args: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!lovableKey || !resendKey) {
    console.warn("[email] missing LOVABLE_API_KEY or RESEND_API_KEY");
    return;
  }
  try {
    const res = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": resendKey,
      },
      body: JSON.stringify({ from: FROM, to: [args.to], subject: args.subject, html: args.html }),
    });
    if (!res.ok) {
      console.warn("[email] send failed", res.status, await res.text().catch(() => ""));
    }
  } catch (e) {
    console.warn("[email] send error", e);
  }
}

function shell(title: string, body: string, ctaLabel: string, ctaPath: string) {
  const url = `${appOrigin()}${ctaPath}`;
  return `<!doctype html><html><body style="margin:0;padding:0;background:#e5ddd3;font-family:Helvetica,Arial,sans-serif;color:#2d2a26">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;background:#e5ddd3">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#f9f6f0;border:1px solid #d8cfc0;border-radius:24px;overflow:hidden">
        <tr><td style="padding:28px 28px 8px">
          <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#7a7164">SwapStub · stub notice</div>
          <h1 style="font-family:'Georgia',serif;font-size:24px;line-height:1.2;margin:12px 0 6px;color:#2d2a26">${title}</h1>
          <div style="font-size:14px;line-height:1.55;color:#4a443c">${body}</div>
        </td></tr>
        <tr><td style="padding:16px 28px 28px">
          <a href="${url}" style="display:inline-block;background:#2d2a26;color:#f9f6f0;font-weight:700;font-size:13px;padding:12px 18px;border-radius:14px;text-decoration:none">${ctaLabel}</a>
        </td></tr>
        <tr><td style="padding:14px 28px 22px;font-size:11px;color:#9a9080;border-top:1px dashed #d8cfc0">
          You're getting this because you have ${ctaLabel.toLowerCase().includes("message") ? "message" : "booking"} alerts enabled. <a href="${appOrigin()}/settings" style="color:#7a7164">Manage preferences</a>.
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

export function renderMessageEmail(args: {
  fromName: string;
  preview: string;
  threadId: string;
}): { subject: string; html: string } {
  const subject = `New message from ${args.fromName} on SwapStub`;
  const safe = args.preview.replace(/[<>]/g, "");
  const html = shell(
    `${args.fromName} sent you a message`,
    `<p style="margin:0 0 8px">${safe.slice(0, 240) || "Open SwapStub to read it."}</p>`,
    "Open message",
    `/messages?t=${args.threadId}`,
  );
  return { subject, html };
}

export function renderBookingEmail(args: {
  toName: string;
  title: string;
  body: string;
  ticketCode: string;
}): { subject: string; html: string } {
  const subject = `${args.title} · stub ${args.ticketCode}`;
  const html = shell(args.title, `<p style="margin:0">${args.body}</p>`, "View booking", `/bookings`);
  return { subject, html };
}

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];