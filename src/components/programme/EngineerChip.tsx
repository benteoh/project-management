"use client";

import { Plus } from "lucide-react";

import type { EngineerAllocation } from "./types";

export function EngineerChip({
  engineers,
  onClick,
}: {
  engineers: EngineerAllocation[];
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
}) {
  if (engineers.length === 0) {
    return (
      <div
        className="border-muted-foreground/50 text-muted-foreground hover:border-foreground/40 hover:text-foreground ml-2 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded border border-dashed"
        onClick={onClick}
        title="Click to assign engineers"
      >
        <Plus size={10} strokeWidth={2.5} />
      </div>
    );
  }
  return (
    <div
      className="border-border bg-card hover:border-muted-foreground ml-2 flex shrink-0 cursor-pointer items-center gap-0.5 rounded border px-1.5 py-0.5 text-xs"
      onClick={onClick}
      title="Click to edit engineer allocation"
    >
      {engineers.map((eng, i) => (
        <span key={i}>
          {i > 0 && <span className="text-border mx-0.5">,</span>}
          <span className={eng.isLead ? "text-foreground font-bold" : "text-muted-foreground"}>
            {eng.code}
          </span>
        </span>
      ))}
    </div>
  );
}
