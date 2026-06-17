import { cn } from "@/lib/utils";

export function TicketCode({ code, className }: { code: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border border-ink/30 bg-ink/5 px-1.5 py-0.5 font-mono text-[11px] tracking-wider text-ink",
        className,
      )}
    >
      {code}
    </span>
  );
}