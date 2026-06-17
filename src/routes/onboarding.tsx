import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Welcome to SwapStub — Onboarding" },
      { name: "description", content: "Set up your SwapStub profile and start swapping skills." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data.session) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      setEmail(data.session.user.email ?? null);
    });
    return () => {
      mounted = false;
    };
  }, [navigate]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16 bg-background">
      <div className="max-w-xl w-full rounded-2xl border border-border bg-card p-10 shadow-sm text-center space-y-6">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Onboarding
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome to SwapStub{email ? `, ${email}` : ""}</h1>
        <p className="text-muted-foreground">
          Your ticket is verified. This is a placeholder onboarding screen — the
          full flow (profile, skills, interests) is coming soon.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button asChild>
            <Link to="/">Continue to home</Link>
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth", replace: true });
            }}
          >
            Sign out
          </Button>
        </div>
      </div>
    </main>
  );
}