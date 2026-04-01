"use client";

import { forwardRef, type ReactNode } from "react";
import { Clock, Plus } from "lucide-react";

import { allocationMismatchExplanation } from "@/lib/programme/plannedAllocationVsScope";
import { cn } from "@/lib/utils";
import type { EngineerPoolEntry } from "@/types/engineer-pool";

import type { EngineerAllocation } from "./types";

function poolEntryForEngineer(
  pool: EngineerPoolEntry[],
  engineerId: string
): EngineerPoolEntry | undefined {
  return pool.find((p) => p.id === engineerId);
}

function codeForEngineer(pool: EngineerPoolEntry[], engineerId: string): string {
  return poolEntryForEngineer(pool, engineerId)?.code ?? engineerId;
}

const MAX_ENGINEERS_VISIBLE = 3;

function ChipRow({ children }: { children: ReactNode }) {
  return <div className="ml-2 flex shrink-0 items-center gap-0.5">{children}</div>;
}

function AllocationMismatchClock({ explanation }: { explanation: string | undefined }) {
  if (!explanation) return null;
  return (
    <span
      className="text-status-warning inline-flex shrink-0"
      title={explanation}
      aria-label={explanation}
    >
      <Clock className="ml-1 size-3.5" strokeWidth={2} aria-hidden />
    </span>
  );
}

export const EngineerChip = forwardRef<
  HTMLDivElement,
  {
    engineers: EngineerAllocation[];
    engineerPool: EngineerPoolEntry[];
    /** Scope row total hours — used to flag when planned allocation sum does not match. */
    scopeTotalHours: number | null;
    onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  }
>(function EngineerChip({ engineers, engineerPool, scopeTotalHours, onClick }, ref) {
  const mismatchExplanation = allocationMismatchExplanation(scopeTotalHours, engineers);

  if (engineers.length === 0) {
    return (
      <ChipRow>
        <div
          ref={ref}
          className="border-muted-foreground/50 text-muted-foreground hover:border-foreground/40 hover:text-foreground flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded border border-dashed"
          onClick={onClick}
          title={mismatchExplanation ?? "Click to assign engineers"}
        >
          <Plus size={10} strokeWidth={2.5} />
        </div>
        <AllocationMismatchClock explanation={mismatchExplanation} />
      </ChipRow>
    );
  }

  const visible = engineers.slice(0, MAX_ENGINEERS_VISIBLE);
  const moreCount = engineers.length - visible.length;
  const allCodes = engineers.map((e) => codeForEngineer(engineerPool, e.engineerId)).join(", ");

  const baseTitle =
    moreCount > 0
      ? `${allCodes} — click to edit (${engineers.length} engineers)`
      : "Click to edit engineer allocation";
  const chipTitle = mismatchExplanation ? `${baseTitle}. ${mismatchExplanation}` : baseTitle;

  return (
    <ChipRow>
      <div
        ref={ref}
        className="border-border bg-card hover:border-muted-foreground flex shrink-0 cursor-pointer items-center gap-0.5 rounded border px-1.5 py-0.5 text-xs"
        onClick={onClick}
        title={chipTitle}
      >
        {visible.map((eng, i) => (
          <span key={eng.engineerId} className="shrink-0">
            {i > 0 && <span className="text-border mx-0.5">,</span>}
            <span
              className={cn(eng.isLead ? "text-foreground font-bold" : "text-muted-foreground")}
            >
              {codeForEngineer(engineerPool, eng.engineerId)}
            </span>
          </span>
        ))}
        {moreCount > 0 && (
          <span className="text-muted-foreground shrink-0">
            <span className="text-border mx-0.5">,</span>+{moreCount}
          </span>
        )}
      </div>
      <AllocationMismatchClock explanation={mismatchExplanation} />
    </ChipRow>
  );
});
