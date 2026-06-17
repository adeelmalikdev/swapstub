import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, randomInt, timingSafeEqual } from "crypto";

const emailSchema = z.string().trim().toLowerCase().email().max(255);
const codeSchema = z.string().regex(/^\d{6}$/);
const passwordSchema = z
  .string()
  .min(8)
  .max(72)
  .refine((p) => /[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p));
const nameSchema = z.string().trim().min(1).max(40);

const OTP_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const FROM_ADDRESS = "SwapStub <onboarding@resend.dev>";

function hashCode(email: string, code: string) {
  return createHash("sha256").update(`${email.toLowerCase()}::${code}`).digest("hex");
}

function generateCode() {
  // 6-digit zero-padded
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function safeEq(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function ticketEmailHtml(opts: {
  heading: string;
  intro: string;
  code: string;
  footnote: string;
}) {
  const { heading, intro, code, footnote } = opts;
  // Theme colors mirror the app's "ticket" aesthetic
  const kraft = "#E8D8B7";
  const kraftDeep = "#D9C492";
  const ink = "#1F1A14";
  const ochre = "#D69A2D";
  const teal = "#127A6B";
  return `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${heading}</title></head>
<body style="margin:0;padding:24px;background:#f4ecd8;font-family:Georgia,'Times New Roman',serif;color:${ink};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;">
    <tr><td>
      <div style="background:${kraft};border:2px solid ${ink};border-radius:8px;overflow:hidden;box-shadow:4px 4px 0 ${ink};">
        <div style="background:${ochre};border-bottom:2px solid ${ink};padding:10px 20px;display:flex;justify-content:space-between;">
          <span style="font-family:Georgia,serif;font-weight:700;font-size:18px;letter-spacing:1px;color:${ink};">✂ SwapStub</span>
          <span style="font-family:'Courier New',monospace;font-size:11px;color:${ink};letter-spacing:2px;">STUB-AUTH</span>
        </div>
        <div style="padding:28px 28px 8px;">
          <h1 style="margin:0 0 6px;font-size:24px;color:${ink};font-family:Georgia,serif;">${heading}</h1>
          <p style="margin:0;color:${ink};opacity:0.8;font-size:14px;line-height:1.5;">${intro}</p>
        </div>
        <div style="position:relative;height:18px;border-top:2px dashed ${ink};border-bottom:2px dashed ${ink};background:${kraftDeep};margin:18px 0;"></div>
        <div style="padding:0 28px 28px;text-align:center;">
          <div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:3px;color:${ink};opacity:0.7;margin-bottom:8px;">YOUR ONE-TIME CODE</div>
          <div style="display:inline-block;background:${ink};color:${kraft};padding:14px 22px;border-radius:6px;font-family:'Courier New',monospace;font-size:32px;letter-spacing:10px;font-weight:700;">${code}</div>
          <div style="margin-top:14px;font-size:12px;color:${ink};opacity:0.7;">Expires in ${OTP_TTL_MIN} minutes</div>
          <p style="margin:22px 0 0;font-size:13px;color:${ink};opacity:0.75;line-height:1.5;">${footnote}</p>
        </div>
        <div style="border-top:2px solid ${ink};background:${kraftDeep};padding:12px 20px;text-align:center;font-family:'Courier New',monospace;font-size:10px;letter-spacing:2px;color:${ink};opacity:0.75;">
          ADMIT ONE · SWAPSTUB · ${new Date().getFullYear()}
        </div>
      </div>
      <p style="text-align:center;font-size:11px;color:#6b5b3e;margin:14px 0 0;font-family:Georgia,serif;">If you didn't request this, you can safely ignore the email.</p>
    </td></tr>
  </table>
</body></html>`;
}

async function sendResend(opts: { to: string; subject: string; html: string }) {
  const apiKey = process.env.LOVABLE_API_KEY;
  const connKey = process.env.RESEND_API_KEY;
  if (!apiKey || !connKey) throw new Error("Email service is not configured");
  const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Connection-Api-Key": connKey,
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("[resend] send failed", res.status, body);
    throw new Error("Couldn't send email. Please try again.");
  }
}

async function issueOtp(email: string, purpose: "signup" | "recovery") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const code = generateCode();
  const code_hash = hashCode(email, code);
  const expires_at = new Date(Date.now() + OTP_TTL_MIN * 60_000).toISOString();

  // Invalidate previous codes for this email+purpose
  await supabaseAdmin
    .from("auth_otps")
    .update({ consumed_at: new Date().toISOString() })
    .eq("email", email)
    .eq("purpose", purpose)
    .is("consumed_at", null);

  const { error } = await supabaseAdmin.from("auth_otps").insert({
    email,
    purpose,
    code_hash,
    expires_at,
  });
  if (error) throw new Error("Couldn't create code. Please try again.");
  return code;
}

async function consumeOtp(email: string, purpose: "signup" | "recovery", code: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("auth_otps")
    .select("id, code_hash, expires_at, attempts, consumed_at")
    .eq("email", email)
    .eq("purpose", purpose)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) throw new Error("No active code. Request a new one.");
  if (new Date(data.expires_at).getTime() < Date.now()) {
    throw new Error("Code expired. Request a new one.");
  }
  if (data.attempts >= MAX_ATTEMPTS) {
    await supabaseAdmin
      .from("auth_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", data.id);
    throw new Error("Too many attempts. Request a new code.");
  }
  const expected = hashCode(email, code);
  if (!safeEq(data.code_hash, expected)) {
    await supabaseAdmin
      .from("auth_otps")
      .update({ attempts: data.attempts + 1 })
      .eq("id", data.id);
    throw new Error("Incorrect code. Please try again.");
  }
  await supabaseAdmin
    .from("auth_otps")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", data.id);
}

async function userExists(email: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Page through up to 200 — pragmatic for app size; for scale, swap to a profiles lookup
  const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (!data?.users) return false;
  const e = email.toLowerCase();
  return data.users.some((u) => (u.email ?? "").toLowerCase() === e);
}

// ===================== Server functions =====================

export const requestSignupOtp = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; firstName: string; lastName: string }) =>
    z
      .object({ email: emailSchema, firstName: nameSchema, lastName: nameSchema })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (await userExists(data.email)) {
      throw new Error("An account with that email already exists. Try signing in.");
    }
    const code = await issueOtp(data.email, "signup");
    await sendResend({
      to: data.email,
      subject: `Your SwapStub signup code: ${code}`,
      html: ticketEmailHtml({
        heading: `Welcome, ${data.firstName}!`,
        intro: "Use the code below to verify your email and claim your SwapStub ticket.",
        code,
        footnote: "Enter this code on the verification screen to finish signing up.",
      }),
    });
    return { ok: true as const };
  });

export const verifySignupOtp = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      email: string;
      code: string;
      password: string;
      firstName: string;
      lastName: string;
    }) =>
      z
        .object({
          email: emailSchema,
          code: codeSchema,
          password: passwordSchema,
          firstName: nameSchema,
          lastName: nameSchema,
        })
        .parse(input),
  )
  .handler(async ({ data }) => {
    await consumeOtp(data.email, "signup", data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (await userExists(data.email)) {
      throw new Error("An account with that email already exists. Try signing in.");
    }
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        first_name: data.firstName,
        last_name: data.lastName,
        display_name: `${data.firstName} ${data.lastName}`,
      },
    });
    if (error) {
      console.error("[signup] createUser failed", error);
      throw new Error("Couldn't create your account. Please try again.");
    }
    return { ok: true as const };
  });

export const requestRecoveryOtp = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string }) =>
    z.object({ email: emailSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    // Always claim success to avoid email enumeration, but only send if user exists
    if (await userExists(data.email)) {
      const code = await issueOtp(data.email, "recovery");
      await sendResend({
        to: data.email,
        subject: `Your SwapStub password reset code: ${code}`,
        html: ticketEmailHtml({
          heading: "Reset your password",
          intro: "Use the code below to reset the password on your SwapStub account.",
          code,
          footnote: "If you didn't request a reset, ignore this email — your password stays the same.",
        }),
      });
    }
    return { ok: true as const };
  });

export const resetPasswordWithOtp = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { email: string; code: string; password: string }) =>
      z
        .object({ email: emailSchema, code: codeSchema, password: passwordSchema })
        .parse(input),
  )
  .handler(async ({ data }) => {
    await consumeOtp(data.email, "recovery", data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const user = list?.users.find((u) => (u.email ?? "").toLowerCase() === data.email);
    if (!user) throw new Error("Account not found.");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: data.password,
    });
    if (error) {
      console.error("[reset] updateUserById failed", error);
      throw new Error("Couldn't update password. Please try again.");
    }
    return { ok: true as const };
  });

export const verifyRecoveryOtpOnly = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { email: string; code: string }) =>
      z.object({ email: emailSchema, code: codeSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    // Peek without consuming — actual consumption happens at password update.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("auth_otps")
      .select("id, code_hash, expires_at, attempts, consumed_at")
      .eq("email", data.email)
      .eq("purpose", "recovery")
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !row) throw new Error("No active code. Request a new one.");
    if (new Date(row.expires_at).getTime() < Date.now())
      throw new Error("Code expired. Request a new one.");
    if (row.attempts >= MAX_ATTEMPTS) throw new Error("Too many attempts. Request a new code.");
    const expected = hashCode(data.email, data.code);
    if (!safeEq(row.code_hash, expected)) {
      await supabaseAdmin
        .from("auth_otps")
        .update({ attempts: row.attempts + 1 })
        .eq("id", row.id);
      throw new Error("Incorrect code. Please try again.");
    }
    return { ok: true as const };
  });