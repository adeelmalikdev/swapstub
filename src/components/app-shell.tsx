import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LogOut, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "Discover", to: "/discover" },
  { label: "Listings", to: "/listings" },
  { label: "Bookings", to: "/bookings" },
  { label: "Messages", to: "/dashboard" },
  { label: "Profile", to: "/dashboard" },
] as const;

function isActive(pathname: string, to: string, label: string) {
  if (to === "/dashboard" && label !== "Dashboard") return false;
  if (to === "/dashboard") return pathname === "/dashboard";
  if (to === "/listings")
    return pathname === "/listings" || pathname.startsWith("/listings/");
  return pathname === to || pathname.startsWith(to + "/");
}

export function AppShell({
  children,
  maxWidth = "max-w-6xl",
}: {
  children: React.ReactNode;
  maxWidth?: string;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const onSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <nav className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-20">
        <div
          className={`${maxWidth} mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-6`}
        >
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 font-[Fraunces] text-xl tracking-tight"
          >
            <Ticket className="h-5 w-5" />
            SwapStub
          </Link>
          <ul className="hidden md:flex items-center gap-1 text-sm">
            {NAV.map((n) => {
              const active = isActive(pathname, n.to, n.label);
              return (
                <li key={n.label}>
                  <Link
                    to={n.to}
                    className={`px-3 py-1.5 rounded-full transition ${
                      active
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <Button variant="ghost" size="sm" onClick={onSignOut}>
            <LogOut className="h-4 w-4 mr-1.5" /> Sign out
          </Button>
        </div>
        {/* Mobile nav */}
        <div className="md:hidden border-t border-border bg-card/60 overflow-x-auto">
          <ul className="flex items-center gap-1 px-4 py-2 text-sm whitespace-nowrap">
            {NAV.map((n) => {
              const active = isActive(pathname, n.to, n.label);
              return (
                <li key={n.label}>
                  <Link
                    to={n.to}
                    className={`px-3 py-1.5 rounded-full transition inline-block ${
                      active
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
      <main className={`flex-1 ${maxWidth} w-full mx-auto px-4 sm:px-6 py-8`}>
        {children}
      </main>
      <footer className="border-t border-border bg-card/40 mt-8">
        <div
          className={`${maxWidth} mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground`}
        >
          <span className="inline-flex items-center gap-1.5">
            <Ticket className="h-3.5 w-3.5" /> SwapStub · trade skills, not money
          </span>
          <div className="flex items-center gap-4">
            <Link to="/discover" className="hover:text-foreground">
              Discover
            </Link>
            <Link to="/listings/new" className="hover:text-foreground">
              Post a stub
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}