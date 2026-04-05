"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ChevronRight, ChevronDown, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProgrammeNode } from "@/components/programme/types";
import {
  DAY_WIDTH,
  ROW_H,
  NAME_COL_W,
  flattenGanttRows,
  getTimelineRange,
  dateToX,
  xToDate,
  parseProgrammeDate,
  formatProgrammeDate,
  buildMonthSegments,
  buildWeekTicks,
  daysBetween,
  computeRollupDates,
} from "./ganttUtils";

interface StagedDates {
  start: string;
  finish: string;
}

interface DragState {
  nodeId: string;
  type: "move" | "resize-start" | "resize-end";
  originX: number;
  originalStart: string;
  originalFinish: string;
}

const ROW_STYLES: Record<ProgrammeNode["type"], string> = {
  scope: "bg-muted font-semibold text-foreground",
  task: "bg-card font-medium text-foreground",
  subtask: "bg-background font-medium text-muted-foreground",
  activity: "bg-card text-foreground",
};

/** Type indicator dot colour class — shown in left column */
const TYPE_DOT: Partial<Record<ProgrammeNode["type"], string>> = {
  scope: "bg-gold",
  task: "bg-status-info",
  subtask: "bg-border",
};

const BAR_COLOURS: Record<ProgrammeNode["status"], string> = {
  "Not Started": "bg-muted-foreground/30 border-muted-foreground/40",
  "In Progress": "bg-status-info-bg border-status-info",
  Completed: "bg-status-healthy-bg border-status-healthy",
  "": "bg-muted-foreground/30 border-muted-foreground/40",
};

/** Summary bar colours for parent nodes (scope / task / subtask) */
const SUMMARY_BAR_COLOURS: Partial<Record<ProgrammeNode["type"], string>> = {
  scope: "bg-gold/30 border-gold/60",
  task: "bg-status-info-bg/60 border-status-info/60",
  subtask: "bg-muted border-border",
};

interface GanttViewProps {
  tree: ProgrammeNode[];
  collapsed: Set<string>;
  onToggleCollapse: (id: string) => void;
  onCommit: (next: ProgrammeNode[]) => void;
}

export function GanttView({ tree, collapsed, onToggleCollapse, onCommit }: GanttViewProps) {
  const [staged, setStaged] = useState<Record<string, StagedDates>>({});
  const [drag, setDrag] = useState<DragState | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => flattenGanttRows(tree, collapsed), [tree, collapsed]);
  const { start: tlStart, end: tlEnd } = useMemo(() => getTimelineRange(tree), [tree]);
  const totalDays = daysBetween(tlStart, tlEnd);
  const timelineW = totalDays * DAY_WIDTH;
  const months = useMemo(() => buildMonthSegments(tlStart, tlEnd), [tlStart, tlEnd]);
  const weeks = useMemo(() => buildWeekTicks(tlStart, tlEnd), [tlStart, tlEnd]);

  const hasChanges = Object.keys(staged).length > 0;

  const getEffective = useCallback(
    (node: ProgrammeNode): StagedDates => ({
      start: staged[node.id]?.start ?? node.start,
      finish: staged[node.id]?.finish ?? node.finish,
    }),
    [staged]
  );

  // ─── Drag handling ───────────────────────────────────────────────────────────
  const startDrag = (e: React.MouseEvent, node: ProgrammeNode, type: DragState["type"]) => {
    e.preventDefault();
    e.stopPropagation();
    const effective = getEffective(node);
    setDrag({
      nodeId: node.id,
      type,
      originX: e.clientX,
      originalStart: effective.start,
      originalFinish: effective.finish,
    });
  };

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!drag) return;
      const dx = e.clientX - drag.originX;
      const deltaDays = Math.round(dx / DAY_WIDTH);

      const origStart = parseProgrammeDate(drag.originalStart);
      const origFinish = parseProgrammeDate(drag.originalFinish);
      if (!origStart || !origFinish) return;

      let newStart = origStart;
      let newFinish = origFinish;

      if (drag.type === "move") {
        newStart = new Date(origStart.getTime() + deltaDays * 86_400_000);
        newFinish = new Date(origFinish.getTime() + deltaDays * 86_400_000);
      } else if (drag.type === "resize-start") {
        newStart = new Date(origStart.getTime() + deltaDays * 86_400_000);
        // Don't let start pass finish
        if (newStart >= origFinish) newStart = new Date(origFinish.getTime() - 86_400_000);
      } else {
        newFinish = new Date(origFinish.getTime() + deltaDays * 86_400_000);
        if (newFinish <= origStart) newFinish = new Date(origStart.getTime() + 86_400_000);
      }

      setStaged((prev) => ({
        ...prev,
        [drag.nodeId]: {
          start: formatProgrammeDate(newStart),
          finish: formatProgrammeDate(newFinish),
        },
      }));
    },
    [drag]
  );

  const onMouseUp = useCallback(() => setDrag(null), []);

  // ─── Save ────────────────────────────────────────────────────────────────────
  const handleSave = () => {
    const applyStaged = (nodes: ProgrammeNode[]): ProgrammeNode[] =>
      nodes.map((n) => {
        const s = staged[n.id];
        return {
          ...n,
          ...(s ? { start: s.start, finish: s.finish } : {}),
          children: applyStaged(n.children),
        };
      });
    onCommit(applyStaged(tree));
    setStaged({});
  };

  const handleDiscard = () => setStaged({});

  // ─── Today marker ────────────────────────────────────────────────────────────
  const today = new Date();
  const todayX = dateToX(today, tlStart);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* Save bar */}
      {hasChanges && (
        <div className="border-border bg-status-info-bg text-status-info flex shrink-0 items-center gap-3 border-b px-4 py-2 text-sm">
          <span className="font-medium">Unsaved date changes</span>
          <button
            onClick={handleSave}
            className="bg-status-info text-card hover:bg-status-info/90 flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium"
          >
            <Save size={12} />
            Save
          </button>
          <button
            onClick={handleDiscard}
            className="text-status-info hover:bg-status-info-bg rounded-md px-2 py-1 text-xs underline"
          >
            Discard
          </button>
        </div>
      )}

      {/* Main scrollable area */}
      <div
        className="relative min-h-0 flex-1 overflow-auto"
        style={{ cursor: drag ? "ew-resize" : undefined }}
      >
        <div className="flex" style={{ minWidth: NAME_COL_W + timelineW }}>
          {/* ── Left: name column ── */}
          <div
            className="border-border bg-card z-10 shrink-0 border-r"
            style={{ width: NAME_COL_W, position: "sticky", left: 0 }}
          >
            {/* Name header */}
            <div
              className="border-border bg-card sticky top-0 z-10 flex items-center border-b px-3"
              style={{ height: ROW_H * 2 }}
            >
              <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Activity
              </span>
            </div>

            {/* Name rows */}
            {rows.map(({ node, depth }) => (
              <div
                key={node.id}
                className={cn(
                  "border-border flex items-center border-b text-sm",
                  ROW_STYLES[node.type]
                )}
                style={{ height: ROW_H, paddingLeft: 12 + depth * 20 }}
              >
                {node.children.length > 0 ? (
                  <button
                    onClick={() => onToggleCollapse(node.id)}
                    className="text-muted-foreground hover:text-foreground mr-1 shrink-0"
                  >
                    {collapsed.has(node.id) ? (
                      <ChevronRight size={13} />
                    ) : (
                      <ChevronDown size={13} />
                    )}
                  </button>
                ) : (
                  <span className="mr-1 w-4 shrink-0" />
                )}
                {TYPE_DOT[node.type] && (
                  <span
                    className={cn("mr-1.5 h-1.5 w-1.5 shrink-0 rounded-full", TYPE_DOT[node.type])}
                  />
                )}
                <span className="truncate text-sm">{node.name}</span>
              </div>
            ))}
          </div>

          {/* ── Right: Gantt timeline ── */}
          <div className="relative flex-1" ref={timelineRef} style={{ width: timelineW }}>
            {/* Timeline header (sticky top) */}
            <div
              className="border-border bg-card sticky top-0 z-10 border-b"
              style={{ height: ROW_H * 2 }}
            >
              {/* Month row */}
              <div
                className="relative"
                style={{ height: ROW_H, borderBottom: "1px solid var(--border)" }}
              >
                {months.map((m) => (
                  <div
                    key={m.label}
                    className="border-border absolute top-0 flex items-center overflow-hidden border-r px-2"
                    style={{ left: m.x, width: m.width, height: ROW_H }}
                  >
                    <span className="text-muted-foreground truncate text-xs font-semibold">
                      {m.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Week row */}
              <div className="relative" style={{ height: ROW_H }}>
                {weeks.map((w) => (
                  <div
                    key={w.x}
                    className="border-border absolute top-0 flex items-center overflow-hidden border-r px-1"
                    style={{ left: w.x, height: ROW_H, minWidth: DAY_WIDTH * 7 }}
                  >
                    <span className="text-muted-foreground text-[10px]">{w.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Row backgrounds + bars */}
            {rows.map(({ node }) => {
              const isActivity = node.type === "activity";
              const isParent = !isActivity;

              // Activity bars use staged/node dates directly; parent bars roll up from descendants
              const { start: barStartDate, end: barEndDate } = computeRollupDates(node, staged);
              const hasBar = Boolean(barStartDate && barEndDate);
              const barX = barStartDate ? dateToX(barStartDate, tlStart) : 0;
              const barW =
                barStartDate && barEndDate ? daysBetween(barStartDate, barEndDate) * DAY_WIDTH : 0;

              const effective = getEffective(node);
              const isStaged = Boolean(staged[node.id]);

              return (
                <div
                  key={node.id}
                  className={cn("border-border relative border-b", ROW_STYLES[node.type])}
                  style={{ height: ROW_H, width: timelineW }}
                >
                  {/* Week grid lines */}
                  {weeks.map((w) => (
                    <div
                      key={w.x}
                      className="border-border/50 pointer-events-none absolute top-0 h-full border-r"
                      style={{ left: w.x }}
                    />
                  ))}

                  {/* Today line */}
                  {todayX >= 0 && todayX <= timelineW && (
                    <div
                      className="bg-status-critical/60 pointer-events-none absolute top-0 h-full w-px"
                      style={{ left: todayX }}
                    />
                  )}

                  {/* Summary bar for parent nodes (scope / task / subtask) — read-only, thin */}
                  {isParent && hasBar && barW > 0 && (
                    <div
                      className={cn(
                        "pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-sm border",
                        SUMMARY_BAR_COLOURS[node.type]
                      )}
                      style={{ left: barX + 2, width: Math.max(barW - 4, 4), height: ROW_H - 18 }}
                      title={`${barStartDate?.toISOString().slice(0, 10)} → ${barEndDate?.toISOString().slice(0, 10)}`}
                    />
                  )}

                  {/* Activity bar — draggable */}
                  {isActivity && hasBar && barW > 0 && (
                    <div
                      className={cn(
                        "absolute top-1/2 -translate-y-1/2 cursor-grab rounded border select-none active:cursor-grabbing",
                        BAR_COLOURS[node.status],
                        isStaged && "ring-status-info ring-2 ring-offset-0",
                        drag?.nodeId === node.id && "opacity-80"
                      )}
                      style={{ left: barX + 2, width: Math.max(barW - 4, 4), height: ROW_H - 10 }}
                      onMouseDown={(e) => startDrag(e, node, "move")}
                      title={`${effective.start} → ${effective.finish}\n(drag to move)`}
                    >
                      {/* Left resize handle */}
                      <div
                        className="absolute top-0 left-0 h-full w-2 cursor-ew-resize"
                        onMouseDown={(e) => startDrag(e, node, "resize-start")}
                        title="Drag to change start date"
                      />
                      {/* Bar label — only if wide enough */}
                      {barW > 60 && (
                        <span className="text-foreground pointer-events-none absolute inset-0 flex items-center justify-center truncate px-3 text-[10px] font-medium">
                          {effective.start} → {effective.finish}
                        </span>
                      )}
                      {/* Right resize handle */}
                      <div
                        className="absolute top-0 right-0 h-full w-2 cursor-ew-resize"
                        onMouseDown={(e) => startDrag(e, node, "resize-end")}
                        title="Drag to change finish date"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
