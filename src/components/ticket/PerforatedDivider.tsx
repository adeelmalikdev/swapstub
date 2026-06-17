import { cn } from "@/lib/utils";

export function PerforatedDivider({ className }: { className?: string }) {
  return <div aria-hidden className={cn("perf-divider w-full", className)} />;
}