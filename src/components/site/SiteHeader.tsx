import { Link } from "@tanstack/react-router";
import { Scissors } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b-2 border-ink/90 bg-[var(--kraft)]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 text-ink">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border-2 border-ink bg-[var(--ochre)] text-ink">
            <Scissors className="h-4 w-4 -rotate-12" />
          </span>
          <span className="font-display text-xl leading-none tracking-wide">
            SwapStub
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-ink/80 sm:flex">
          <Link to="/browse" className="hover:text-ink">Browse</Link>
          <a href="/#how" className="hover:text-ink">How it works</a>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/auth"
            className="rounded-md border-2 border-ink bg-[var(--kraft)] px-3 py-1.5 text-sm font-semibold text-ink transition hover:bg-[var(--kraft-deep)]"
          >
            Sign in
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signup" } as never}
            className="hidden rounded-md border-2 border-ink bg-ink px-3 py-1.5 text-sm font-semibold text-kraft transition hover:bg-ink/85 sm:inline-flex"
          >
            Get a ticket
          </Link>
        </div>
      </div>
    </header>
  );
}