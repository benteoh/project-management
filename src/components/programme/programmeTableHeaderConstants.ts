/** Match `ProgrammeRow` column widths. */
export const PROGRAMME_HEADER_COL_TOTAL = "w-24 min-w-[6rem] shrink-0";
export const PROGRAMME_HEADER_COL_WIDE = "w-28 min-w-[7rem] shrink-0";

/** Horizontal padding — sort/filter icons are absolutely positioned and do not affect text layout. */
export const PROGRAMME_HEADER_CELL_PAD = "px-1";

/** Min height so header row / hover cards stay aligned when one label wraps to two lines. */
export const PROGRAMME_HEADER_ROW_MIN_H = "min-h-[2.75rem]";

/** Space between the header strip’s top/bottom borders and the cells (hover no longer flush to the edge). */
export const PROGRAMME_HEADER_ROW_VERTICAL_INSET = "py-1.5";

export const programmeTableHeaderRowClassName = `border-border bg-muted text-muted-foreground sticky top-0 z-10 flex shrink-0 items-stretch border-b-2 text-xs font-medium tracking-wide uppercase ${PROGRAMME_HEADER_ROW_VERTICAL_INSET}`;

/** Lucide icons in the programme table header (sort + filter). */
export const PROGRAMME_HEADER_ICON_SIZE = "size-3";
export const PROGRAMME_HEADER_ICON_STROKE = 2;

export const PROGRAMME_HEADER_ICON_OVERLAY_CLASS =
  "pointer-events-none absolute right-1 top-1/2 z-10 -translate-y-1/2";

/** Active = sorted / filter applied; idle = default affordance. */
export function programmeHeaderIconToneClass(active: boolean): string {
  return active ? "text-foreground" : "text-muted-foreground opacity-80";
}

/** Sort + status filter header buttons (shared layout; pair with `programmeHeaderInteractiveToneClass`). */
export const PROGRAMME_HEADER_INTERACTIVE_BUTTON_BASE = `relative flex flex-col items-center justify-center rounded-md text-center transition-colors ${PROGRAMME_HEADER_ROW_MIN_H} ${PROGRAMME_HEADER_CELL_PAD}`;

export function programmeHeaderInteractiveToneClass(active: boolean): string {
  return active
    ? "bg-background text-foreground"
    : "text-muted-foreground hover:bg-background hover:text-foreground";
}

export function programmeHeaderInteractiveButtonClass(widthClass: string, active: boolean): string {
  return `${PROGRAMME_HEADER_INTERACTIVE_BUTTON_BASE} ${widthClass} ${programmeHeaderInteractiveToneClass(active)}`;
}
