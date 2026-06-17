import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Scissors, Mail, Lock, ArrowLeft, Loader2, Eye, EyeOff, User, Check, X } from "lucide-react";
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
import { PerforatedDivider } from "@/components/ticket/PerforatedDivider";

type Mode = "signin" | "signup" | "verify-signup" | "forgot" | "verify-reset" | "new-password";

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email").max(255);
const nameSchema = z
  .string()
  .trim()
  .min(1, "Required")
  .max(40, "Max 40 characters")
  .regex(/^[\p{L}'’\- ]+$/u, "Letters, spaces, hyphens only");

const passwordRules = [
  { id: "len", label: "8+ characters", test: (p: string) => p.length >= 8 },
  { id: "upper", label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { id: "lower", label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { id: "num", label: "One number", test: (p: string) => /\d/.test(p) },
  { id: "sym", label: "One symbol (!@#…)", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

const passwordSchema = z
  .string()
  .max(72, "Max 72 characters")
  .refine((p) => passwordRules.every((r) => r.test(p)), {
    message: "Password doesn't meet all the rules",
  });

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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
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
    const firstRes = nameSchema.safeParse(firstName);
    if (!firstRes.success) return toast.error(`First name: ${firstRes.error.issues[0].message}`);
    const lastRes = nameSchema.safeParse(lastName);
    if (!lastRes.success) return toast.error(`Last name: ${lastRes.error.issues[0].message}`);
    const emailRes = emailSchema.safeParse(email);
    if (!emailRes.success) return toast.error(emailRes.error.issues[0].message);
    const passRes = passwordSchema.safeParse(password);
    if (!passRes.success) return toast.error(passRes.error.issues[0].message);
    if (password !== confirmPassword) return toast.error("Passwords don't match");
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: emailRes.data,
      password: passRes.data,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          first_name: firstRes.data,
          last_name: lastRes.data,
          display_name: `${firstRes.data} ${lastRes.data}`,
        },
      },
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
    if (newPassword !== confirmNewPassword) return toast.error("Passwords don't match");
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
          <div className="relative overflow-hidden rounded-md border-2 border-ink bg-[var(--kraft)] ticket-shadow paper-grain">
            <div className="absolute inset-x-0 top-0 h-2 bg-[var(--ochre)] border-b-2 border-ink" aria-hidden />
            <div className="absolute right-3 top-4 z-10 rounded bg-ink/85 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-kraft">
              STUB-AUTH
            </div>
            <div className="space-y-1 px-6 pt-10 pb-6 sm:px-8">
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
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <NameField
                      id="first-name"
                      label="First name"
                      value={firstName}
                      onChange={setFirstName}
                      autoComplete="given-name"
                    />
                    <NameField
                      id="last-name"
                      label="Last name"
                      value={lastName}
                      onChange={setLastName}
                      autoComplete="family-name"
                    />
                  </div>
                  <EmailField value={email} onChange={setEmail} />
                  <PasswordField
                    value={password}
                    onChange={setPassword}
                    autoComplete="new-password"
                    showRules
                    confirmValue={confirmPassword}
                    onConfirmChange={setConfirmPassword}
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
                    id="new-password"
                    showRules
                    confirmValue={confirmNewPassword}
                    onConfirmChange={setConfirmNewPassword}
                    confirmLabel="Confirm new password"
                  />
                  <SubmitButton loading={loading} label="Update password" />
                </form>
              )}
            </div>
          </div>

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
  id = "password",
  showRules = false,
  confirmValue,
  onConfirmChange,
  confirmLabel = "Confirm password",
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  label?: string;
  hint?: string;
  id?: string;
  showRules?: boolean;
  confirmValue?: string;
  onConfirmChange?: (v: string) => void;
  confirmLabel?: string;
}) {
  const [show, setShow] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const passed = passwordRules.filter((r) => r.test(value)).length;
  const strength = value.length === 0 ? 0 : passed;
  const strengthLabel =
    strength <= 1 ? "Weak" : strength <= 3 ? "Fair" : strength === 4 ? "Strong" : "Excellent";
  const strengthColor =
    strength <= 1
      ? "var(--brick)"
      : strength <= 3
        ? "var(--ochre)"
        : "var(--teal)";
  const mismatch =
    showRules && confirmValue !== undefined && confirmValue.length > 0 && confirmValue !== value;
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={id} className="text-ink">{label}</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/50" />
          <Input
            id={id}
            type={show ? "text" : "password"}
            autoComplete={autoComplete}
            required
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="••••••••"
            className="border-2 border-ink/80 bg-[var(--kraft)] pl-9 pr-10 text-ink placeholder:text-ink/40 focus-visible:ring-[var(--teal)]"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink/60 hover:text-ink"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {hint && !showRules && <p className="text-xs text-ink/60">{hint}</p>}
      </div>

      {showRules && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full border border-ink/30 bg-[var(--kraft-deep)]">
              <div
                className="h-full transition-all"
                style={{ width: `${(strength / 5) * 100}%`, backgroundColor: strengthColor }}
              />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink/70">
              {value.length === 0 ? "—" : strengthLabel}
            </span>
          </div>
          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {passwordRules.map((r) => {
              const ok = r.test(value);
              return (
                <li
                  key={r.id}
                  className={`flex items-center gap-1.5 text-xs ${ok ? "text-[var(--teal)]" : "text-ink/60"}`}
                >
                  {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                  <span>{r.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {onConfirmChange && (
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-confirm`} className="text-ink">{confirmLabel}</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/50" />
            <Input
              id={`${id}-confirm`}
              type={showConfirm ? "text" : "password"}
              autoComplete={autoComplete}
              required
              value={confirmValue ?? ""}
              onChange={(e) => onConfirmChange(e.target.value)}
              placeholder="••••••••"
              className={`border-2 bg-[var(--kraft)] pl-9 pr-10 text-ink placeholder:text-ink/40 focus-visible:ring-[var(--teal)] ${
                mismatch ? "border-[var(--brick)]" : "border-ink/80"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((s) => !s)}
              aria-label={showConfirm ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink/60 hover:text-ink"
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {mismatch && <p className="text-xs text-[var(--brick)]">Passwords don't match</p>}
        </div>
      )}
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

function NameField({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-ink">{label}</Label>
      <div className="relative">
        <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/50" />
        <Input
          id={id}
          type="text"
          autoComplete={autoComplete}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={label}
          className="border-2 border-ink/80 bg-[var(--kraft)] pl-9 text-ink placeholder:text-ink/40 focus-visible:ring-[var(--teal)]"
        />
      </div>
    </div>
  );
}

function _SubmitButtonRemovedDup({ loading, label }: { loading: boolean; label: string }) {
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