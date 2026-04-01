"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { FilterFunnelIcon } from "@/components/ui/FilterFunnelIcon";
import { cn } from "@/lib/utils";
import {
  PROGRAMME_HEADER_ICON_OVERLAY_CLASS,
  PROGRAMME_HEADER_ICON_SIZE,
  PROGRAMME_HEADER_ICON_STROKE,
  programmeHeaderIconToneClass,
} from "./programmeTableHeaderConstants";

export function ProgrammeHeaderIconOverlay({ children }: { children: ReactNode }) {
  return (
    <span className={PROGRAMME_HEADER_ICON_OVERLAY_CLASS} aria-hidden>
      {children}
    </span>
  );
}

const lucideIconProps = { strokeWidth: PROGRAMME_HEADER_ICON_STROKE } as const;

type SortDirection = "asc" | "desc" | null;

const SORT_ICON_BY_DIRECTION: Record<Exclude<SortDirection, null>, LucideIcon> = {
  asc: ArrowUp,
  desc: ArrowDown,
};

export function ProgrammeHeaderSortIcon({ direction }: { direction: SortDirection }) {
  if (direction === "asc" || direction === "desc") {
    const Icon = SORT_ICON_BY_DIRECTION[direction];
    return (
      <ProgrammeHeaderIconOverlay>
        <Icon
          {...lucideIconProps}
          className={cn(PROGRAMME_HEADER_ICON_SIZE, programmeHeaderIconToneClass(true))}
        />
      </ProgrammeHeaderIconOverlay>
    );
  }
  return (
    <ProgrammeHeaderIconOverlay>
      <ArrowUpDown
        {...lucideIconProps}
        className={cn(PROGRAMME_HEADER_ICON_SIZE, programmeHeaderIconToneClass(false))}
      />
    </ProgrammeHeaderIconOverlay>
  );
}

export function ProgrammeHeaderFilterIcon({ active }: { active: boolean }) {
  return (
    <ProgrammeHeaderIconOverlay>
      <FilterFunnelIcon
        className={cn(PROGRAMME_HEADER_ICON_SIZE, programmeHeaderIconToneClass(active))}
      />
    </ProgrammeHeaderIconOverlay>
  );
}
