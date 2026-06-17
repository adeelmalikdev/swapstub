import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — SwapStub" },
      { name: "description", content: "Your SwapStub dashboard." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      if (!data.user) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      setEmail(data.user.email ?? null);
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
          Dashboard
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back{email ? `, ${email}` : ""}
        </h1>
        <p className="text-muted-foreground">
          This is a placeholder dashboard. Your listings, bookings, and messages
          will live here once the screens are built.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button asChild>
            <Link to="/">Back to home</Link>
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