import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface TicketStubProps {
  offered: ReactNode;
  wanted: ReactNode;
  code?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * The signature SwapStub torn-ticket primitive.
 * - Left half: ochre — what someone offers.
 * - Right half: forest teal — what they want in return.
 * - Jagged perforated edge runs between halves (vertical on >=sm, horizontal on mobile).
 */
export function TicketStub({ offered, wanted, code, className, size = "md" }: TicketStubProps) {
  const pad =
    size === "sm" ? "p-4 sm:p-5" : size === "lg" ? "p-6 sm:p-8" : "p-5 sm:p-6";

  return (
    <div
      className={cn(
        "relative isolate flex flex-col overflow-hidden rounded-md border-2 border-ink ticket-shadow sm:flex-row",
        "bg-[var(--kraft-deep)]",
        className,
      )}
    >
      {/* OFFERED — ochre half */}
      <div
        className={cn(
          "paper-grain relative flex-1 text-ink",
          pad,
        )}
        style={{ backgroundColor: "var(--ochre)" }}
      >
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/70">
          I can teach
        </div>
        <div className="mt-1">{offered}</div>
      </div>

      {/* perforation — vertical on >=sm, horizontal on mobile */}
      <div
        aria-hidden
        className="hidden sm:block shrink-0 self-stretch ticket-perf-v"
        style={{
          backgroundImage:
            "radial-gradient(circle at center, var(--kraft) 5px, transparent 5.5px), radial-gradient(circle at center, transparent 6px, transparent 6px)",
          backgroundSize: "14px 14px",
          backgroundRepeat: "repeat-y",
          backgroundPosition: "center",
          width: "14px",
        }}
      />
      <div
        aria-hidden
        className="sm:hidden ticket-perf-h"
        style={{
          backgroundImage:
            "radial-gradient(circle at center, var(--kraft) 5px, transparent 5.5px)",
          backgroundSize: "14px 14px",
          backgroundRepeat: "repeat-x",
          backgroundPosition: "center",
          height: "14px",
        }}
      />

      {/* WANTED — teal half */}
      <div
        className={cn("paper-grain relative flex-1 text-kraft", pad)}
        style={{ backgroundColor: "var(--teal)" }}
      >
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-kraft/80">
          I want to learn
        </div>
        <div className="mt-1">{wanted}</div>
      </div>

      {code ? (
        <div className="pointer-events-none absolute right-2 top-2 z-10 rounded bg-ink/85 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-kraft">
          {code}
        </div>
      ) : null}
    </div>
  );
}