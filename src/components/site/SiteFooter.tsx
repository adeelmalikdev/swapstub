import { PerforatedDivider } from "@/components/ticket/PerforatedDivider";

export function SiteFooter() {
  return (
    <footer className="mt-24 text-ink/80">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <PerforatedDivider className="mb-8" />
        <div className="grid gap-8 pb-12 sm:grid-cols-3">
          <div>
            <div className="font-display text-2xl text-ink">SwapStub</div>
            <p className="mt-2 max-w-xs text-sm text-ink/70">
              A torn-ticket marketplace where students trade what they can teach
              for what they want to learn.
            </p>
          </div>
          <div className="text-sm">
            <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60">
              Explore
            </div>
            <ul className="space-y-1.5">
              <li><a className="hover:text-ink" href="/browse">Browse swaps</a></li>
              <li><a className="hover:text-ink" href="/#how">How it works</a></li>
              <li><a className="hover:text-ink" href="/auth?mode=signup">Create an account</a></li>
            </ul>
          </div>
          <div className="text-sm">
            <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60">
              Project
            </div>
            <ul className="space-y-1.5">
              <li><a className="hover:text-ink" href="/auth">Sign in</a></li>
              <li className="text-ink/60">A student web-dev exam project</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-ink/15 py-4 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-ink/50">
          stub no. {new Date().getFullYear()} — claim your half of the ticket
        </div>
      </div>
    </footer>
  );
}