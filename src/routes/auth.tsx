import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Scissors, Mail, Lock, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import { TicketStub } from "@/components/ticket/TicketStub";
import { PerforatedDivider } from "@/components/ticket/PerforatedDivider";

type Mode = "signin" | "signup" | "verify-signup" | "forgot" | "verify-reset" | "new-password";

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email").max(255);
const passwordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .max(72, "Max 72 characters");

const RESEND_COOLDOWN = 30;

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · SwapStub" },
      {
        name: "description",
        content:
          "Sign in or get a SwapStub ticket. Verify your email with a 6-digit code and start swapping skills.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<number | null>(null);

  // Redirect if already signed in
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted && data.session) navigate({ to: "/", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/", replace: true });
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    cooldownRef.current = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => {
      if (cooldownRef.current) window.clearTimeout(cooldownRef.current);
    };
  }, [cooldown]);

  const title = useMemo(() => {
    switch (mode) {
      case "signin":
        return "Welcome back";
      case "signup":
        return "Claim your ticket";
      case "verify-signup":
        return "Verify your email";
      case "forgot":
        return "Reset your password";
      case "verify-reset":
        return "Enter the reset code";
      case "new-password":
        return "Pick a new password";
    }
  }, [mode]);

  const subtitle = useMemo(() => {
    switch (mode) {
      case "signin":
        return "Sign in to manage your listings and swaps.";
      case "signup":
        return "We'll send a 6-digit code to confirm it's really you.";
      case "verify-signup":
        return `We sent a 6-digit code to ${email}. It expires in 10 minutes.`;
      case "forgot":
        return "We'll email you a 6-digit code to reset your password.";
      case "verify-reset":
        return `We sent a 6-digit code to ${email}. Enter it below.`;
      case "new-password":
        return "Choose a strong password you'll remember.";
    }
  }, [mode, email]);

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN);
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    const emailRes = emailSchema.safeParse(email);
    if (!emailRes.success) return toast.error(emailRes.error.issues[0].message);
    if (!password) return toast.error("Enter your password");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: emailRes.data,
      password,
    });
    setLoading(false);
    if (error) {
      if (error.message.toLowerCase().includes("email not confirmed")) {
        toast.message("Email not verified", {
          description: "We're sending a fresh 6-digit code.",
        });
        await sendSignupOtp(emailRes.data);
        setMode("verify-signup");
        return;
      }
      return toast.error(error.message);
    }
    toast.success("Signed in");
  }

  async function sendSignupOtp(addr: string) {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: addr,
    });
    if (error) toast.error(error.message);
    else {
      startCooldown();
      toast.success("Code sent");
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    const emailRes = emailSchema.safeParse(email);
    if (!emailRes.success) return toast.error(emailRes.error.issues[0].message);
    const passRes = passwordSchema.safeParse(password);
    if (!passRes.success) return toast.error(passRes.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: emailRes.data,
      password: passRes.data,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setEmail(emailRes.data);
    setOtp("");
    setMode("verify-signup");
    startCooldown();
    toast.success("Check your inbox for the 6-digit code");
  }

  async function handleVerifySignup(code: string) {
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    setLoading(false);
    if (error) {
      setOtp("");
      return toast.error(error.message);
    }
    toast.success("Email verified — you're in");
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    const emailRes = emailSchema.safeParse(email);
    if (!emailRes.success) return toast.error(emailRes.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(emailRes.data);
    setLoading(false);
    if (error) return toast.error(error.message);
    setEmail(emailRes.data);
    setOtp("");
    setMode("verify-reset");
    startCooldown();
    toast.success("Reset code sent");
  }

  async function handleVerifyReset(code: string) {
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "recovery",
    });
    setLoading(false);
    if (error) {
      setOtp("");
      return toast.error(error.message);
    }
    setMode("new-password");
    toast.success("Code accepted — set a new password");
  }

  async function handleNewPassword(e: React.FormEvent) {
    e.preventDefault();
    const passRes = passwordSchema.safeParse(newPassword);
    if (!passRes.success) return toast.error(passRes.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: passRes.data });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    navigate({ to: "/", replace: true });
  }

  async function handleResend() {
    if (cooldown > 0) return;
    if (mode === "verify-signup") await sendSignupOtp(email);
    else if (mode === "verify-reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) toast.error(error.message);
      else {
        startCooldown();
        toast.success("Code resent");
      }
    }
  }

  return (
    <div className="min-h-screen bg-[var(--kraft)] paper-grain">
      <header className="border-b-2 border-ink/90 bg-[var(--kraft)]/95">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 text-ink">
            <span className="grid h-9 w-9 place-items-center rounded-md border-2 border-ink bg-[var(--ochre)]">
              <Scissors className="h-4 w-4 -rotate-12" />
            </span>
            <span className="font-display text-xl tracking-wide">SwapStub</span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm font-medium text-ink/80 hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col items-center px-4 py-10 sm:px-6 sm:py-16">
        <div className="w-full max-w-md">
          <TicketStub orientation="vertical" leftLabel="Auth" rightLabel="Stub">
            <div className="space-y-1 p-6 sm:p-8">
              <h1 className="font-display text-2xl text-ink sm:text-3xl">{title}</h1>
              <p className="text-sm text-ink/70">{subtitle}</p>
            </div>

            <PerforatedDivider />

            <div className="p-6 sm:p-8">
              {mode === "signin" && (
                <form onSubmit={handleSignIn} className="space-y-4">
                  <EmailField value={email} onChange={setEmail} />
                  <PasswordField
                    value={password}
                    onChange={setPassword}
                    autoComplete="current-password"
                  />
                  <SubmitButton loading={loading} label="Sign in" />
                  <div className="flex items-center justify-between text-sm">
                    <button
                      type="button"
                      className="text-ink/70 underline-offset-2 hover:text-ink hover:underline"
                      onClick={() => setMode("forgot")}
                    >
                      Forgot password?
                    </button>
                    <button
                      type="button"
                      className="font-semibold text-[var(--teal)] hover:underline"
                      onClick={() => setMode("signup")}
                    >
                      Create account
                    </button>
                  </div>
                </form>
              )}

              {mode === "signup" && (
                <form onSubmit={handleSignUp} className="space-y-4">
                  <EmailField value={email} onChange={setEmail} />
                  <PasswordField
                    value={password}
                    onChange={setPassword}
                    autoComplete="new-password"
                    hint="8+ characters"
                  />
                  <SubmitButton loading={loading} label="Send 6-digit code" />
                  <p className="text-center text-sm text-ink/70">
                    Already have an account?{" "}
                    <button
                      type="button"
                      className="font-semibold text-[var(--teal)] hover:underline"
                      onClick={() => setMode("signin")}
                    >
                      Sign in
                    </button>
                  </p>
                </form>
              )}

              {(mode === "verify-signup" || mode === "verify-reset") && (
                <OtpForm
                  value={otp}
                  onChange={setOtp}
                  loading={loading}
                  cooldown={cooldown}
                  onResend={handleResend}
                  onSubmit={(code) =>
                    mode === "verify-signup"
                      ? handleVerifySignup(code)
                      : handleVerifyReset(code)
                  }
                  onBack={() =>
                    setMode(mode === "verify-signup" ? "signup" : "forgot")
                  }
                />
              )}

              {mode === "forgot" && (
                <form onSubmit={handleForgot} className="space-y-4">
                  <EmailField value={email} onChange={setEmail} />
                  <SubmitButton loading={loading} label="Send reset code" />
                  <p className="text-center text-sm text-ink/70">
                    Remembered it?{" "}
                    <button
                      type="button"
                      className="font-semibold text-[var(--teal)] hover:underline"
                      onClick={() => setMode("signin")}
                    >
                      Sign in
                    </button>
                  </p>
                </form>
              )}

              {mode === "new-password" && (
                <form onSubmit={handleNewPassword} className="space-y-4">
                  <PasswordField
                    value={newPassword}
                    onChange={setNewPassword}
                    autoComplete="new-password"
                    label="New password"
                    hint="8+ characters"
                  />
                  <SubmitButton loading={loading} label="Update password" />
                </form>
              )}
            </div>
          </TicketStub>

          <p className="mt-6 text-center text-xs text-ink/60">
            By continuing you agree to the SwapStub house rules.
          </p>
        </div>
      </main>
    </div>
  );
}

function EmailField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="email" className="text-ink">
        Email
      </Label>
      <div className="relative">
        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/50" />
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="you@university.edu"
          className="border-2 border-ink/80 bg-[var(--kraft)] pl-9 text-ink placeholder:text-ink/40 focus-visible:ring-[var(--teal)]"
        />
      </div>
    </div>
  );
}

function PasswordField({
  value,
  onChange,
  autoComplete,
  label = "Password",
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  label?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="password" className="text-ink">
        {label}
      </Label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/50" />
        <Input
          id="password"
          type="password"
          autoComplete={autoComplete}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          className="border-2 border-ink/80 bg-[var(--kraft)] pl-9 text-ink placeholder:text-ink/40 focus-visible:ring-[var(--teal)]"
        />
      </div>
      {hint && <p className="text-xs text-ink/60">{hint}</p>}
    </div>
  );
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <Button
      type="submit"
      disabled={loading}
      className="w-full border-2 border-ink bg-ink text-kraft hover:bg-ink/85"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : label}
    </Button>
  );
}

function OtpForm({
  value,
  onChange,
  loading,
  cooldown,
  onResend,
  onSubmit,
  onBack,
}: {
  value: string;
  onChange: (v: string) => void;
  loading: boolean;
  cooldown: number;
  onResend: () => void;
  onSubmit: (code: string) => void;
  onBack: () => void;
}) {
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (value.length !== 6) return toast.error("Enter all 6 digits");
    onSubmit(value);
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex justify-center">
        <InputOTP
          maxLength={6}
          value={value}
          onChange={(v) => {
            onChange(v);
            if (v.length === 6) onSubmit(v);
          }}
          autoFocus
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} className="h-12 w-10 border-2 border-ink/80 font-mono text-lg text-ink sm:h-14 sm:w-12" />
            <InputOTPSlot index={1} className="h-12 w-10 border-2 border-ink/80 font-mono text-lg text-ink sm:h-14 sm:w-12" />
            <InputOTPSlot index={2} className="h-12 w-10 border-2 border-ink/80 font-mono text-lg text-ink sm:h-14 sm:w-12" />
          </InputOTPGroup>
          <InputOTPSeparator className="text-ink/40" />
          <InputOTPGroup>
            <InputOTPSlot index={3} className="h-12 w-10 border-2 border-ink/80 font-mono text-lg text-ink sm:h-14 sm:w-12" />
            <InputOTPSlot index={4} className="h-12 w-10 border-2 border-ink/80 font-mono text-lg text-ink sm:h-14 sm:w-12" />
            <InputOTPSlot index={5} className="h-12 w-10 border-2 border-ink/80 font-mono text-lg text-ink sm:h-14 sm:w-12" />
          </InputOTPGroup>
        </InputOTP>
      </div>

      <SubmitButton loading={loading} label="Verify code" />

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onBack}
          className="text-ink/70 hover:text-ink"
        >
          ← Change email
        </button>
        <button
          type="button"
          onClick={onResend}
          disabled={cooldown > 0}
          className="font-semibold text-[var(--teal)] disabled:text-ink/40"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </button>
      </div>
    </form>
  );
}