"use client";

import type { RefObject } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { isRollupTotalHoursParent } from "@/lib/programme/totalHoursRollup";
import type { EngineerPoolEntry } from "@/types/engineer-pool";
import type { ForecastHoursByScopeRecord } from "@/types/forecast-scope";
import {
  forecastScopeProgrammeCell,
  forecastScopeProgrammeTsv,
} from "@/lib/forecast/forecastScopeProgrammeDisplay";
import { cn } from "@/lib/utils";
import type { ProgrammeNode, EditableField, EditingCell } from "./types";
import { StatusBadge } from "./StatusBadge";
import { EngineerChip } from "./EngineerChip";
import type { ProgrammeSortColumn } from "./programmeTableSort";

// ─── Shared input styles ───────────────────────────────────────────────────────

const EDIT_INPUT_CLS =
  "rounded border border-ring bg-card px-1.5 py-0.5 text-sm outline-none ring-1 ring-ring/20";

export const HOVER_CLS = "cursor-pointer rounded px-0.5 py-0.5 hover:bg-black/[.06]";

function EditInput({
  value,
  onChange,
  onCommit,
  onCancel,
  className,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  className?: string;
  type?: "text" | "number";
}) {
  return (
    <input
      autoFocus
      type={type}
      className={cn(EDIT_INPUT_CLS, type === "number" && "no-input-spinner", className)}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit();
        if (e.key === "Escape") onCancel();
      }}
    />
  );
}

// ─── Cell context ──────────────────────────────────────────────────────────────

/**
 * All row-level callbacks and state passed to each column's cell renderer.
 * ProgrammeRow builds this once and passes it to every column.
 */
/** Passed to TSV export for columns that need data outside the node (e.g. forecast totals). */
export type ProgrammeTsvHelpers = {
  forecastHoursByScope: ForecastHoursByScopeRecord;
  engineerPool: EngineerPoolEntry[];
};

export interface CellContext {
  depth: number;
  namePrefix?: string;
  collapsed: Set<string>;
  editingCell: EditingCell | null;
  onToggleCollapse: (id: string) => void;
  onStartEdit: (nodeId: string, field: EditableField, current: string) => void;
  onCommitEdit: () => void;
  onEditingCellChange: (value: string) => void;
  onCancelEdit: () => void;
  onOpenCal: (
    nodeId: string,
    field: "start" | "finish",
    value: string,
    e: React.MouseEvent<HTMLElement>
  ) => void;
  onSaveField: (nodeId: string, field: keyof ProgrammeNode, raw: string) => void;
  onOpenEngPinned?: (scopeId: string, e: React.MouseEvent<HTMLDivElement>) => void;
  engPopupScopeId?: string | null;
  engineerAnchorRef?: RefObject<HTMLDivElement | null>;
  engineerPool: EngineerPoolEntry[];
  /** Per-scope totals from `forecast_entries` (Demand Forecast grid). */
  forecastHoursByScope: ForecastHoursByScopeRecord;
}

function isEditingField(
  editingCell: EditingCell | null,
  nodeId: string,
  field: EditableField
): boolean {
  return editingCell?.nodeId === nodeId && editingCell?.field === field;
}

// ─── Column definition ─────────────────────────────────────────────────────────

export type ColumnHeaderDef =
  | { type: "name" }
  | { type: "static"; label: string }
  | { type: "sortable"; label: string; sortColumn: ProgrammeSortColumn }
  | { type: "status-filter" };

export interface ColumnDef {
  key: string;
  /** Tailwind width class — shared between header and cell, single source of truth. */
  widthClass: string;
  header: ColumnHeaderDef;
  cell: (node: ProgrammeNode, ctx: CellContext) => React.ReactNode;
  /** Value exported to TSV (omit to exclude from clipboard export). */
  tsvValue?: (node: ProgrammeNode, helpers: ProgrammeTsvHelpers) => string;
}

// ─── Row text styles by node type ─────────────────────────────────────────────

const NODE_TEXT_CLS: Record<ProgrammeNode["type"], string> = {
  scope: "font-semibold text-red-900",
  task: "font-medium text-foreground",
  subtask: "font-medium text-foreground",
  activity: "text-foreground",
};

// ─── Column definitions ────────────────────────────────────────────────────────

export const PROGRAMME_COLUMNS: ColumnDef[] = [
  // ── Name ────────────────────────────────────────────────────────────────────
  {
    key: "name",
    widthClass: "min-w-0 flex-1",
    header: { type: "name" },
    cell: (node, ctx) => {
      const textCls = NODE_TEXT_CLS[node.type];
      const isCollapsed = ctx.collapsed.has(node.id);
      const hasChildren = node.children.length > 0;
      const editValue = ctx.editingCell?.value ?? "";

      return (
        <div
          className={`flex min-w-0 flex-1 items-center gap-1 py-1.5 pr-3 ${textCls}`}
          style={{ paddingLeft: `${4 + ctx.depth * 20}px` }}
        >
          {hasChildren ? (
            <button
              onClick={() => ctx.onToggleCollapse(node.id)}
              className="text-muted-foreground hover:text-foreground mr-0.5 shrink-0"
            >
              {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}

          {node.type === "activity" &&
            (isEditingField(ctx.editingCell, node.id, "activityId") ? (
              <span className="mr-1 shrink-0">
                <EditInput
                  value={editValue}
                  onChange={ctx.onEditingCellChange}
                  onCommit={ctx.onCommitEdit}
                  onCancel={ctx.onCancelEdit}
                  className="w-[5.5rem] font-mono text-xs"
                />
              </span>
            ) : (
              <span
                className={`text-muted-foreground mr-1 shrink-0 font-mono text-xs ${HOVER_CLS}`}
                onClick={() => ctx.onStartEdit(node.id, "activityId", node.activityId ?? "")}
                title="Click to edit activity ID"
              >
                {node.activityId || "—"}
              </span>
            ))}

          {(node.type === "task" || node.type === "subtask") && ctx.namePrefix && (
            <span className="text-muted-foreground mr-1 shrink-0 font-mono text-xs select-none">
              {ctx.namePrefix}
            </span>
          )}

          {isEditingField(ctx.editingCell, node.id, "name") ? (
            <EditInput
              value={editValue}
              onChange={ctx.onEditingCellChange}
              onCommit={ctx.onCommitEdit}
              onCancel={ctx.onCancelEdit}
              className="min-w-0 flex-1"
            />
          ) : (
            <span
              className={`truncate ${HOVER_CLS}`}
              onClick={() => ctx.onStartEdit(node.id, "name", node.name)}
              title="Click to edit · Right-click for options"
            >
              {node.name}
            </span>
          )}

          {node.type === "scope" && ctx.onOpenEngPinned && (
            <EngineerChip
              ref={
                ctx.engPopupScopeId != null && node.id === ctx.engPopupScopeId
                  ? ctx.engineerAnchorRef
                  : undefined
              }
              engineers={node.engineers ?? []}
              engineerPool={ctx.engineerPool}
              scopeTotalHours={node.totalHours}
              onClick={(e) => ctx.onOpenEngPinned!(node.id, e)}
            />
          )}
        </div>
      );
    },
    tsvValue: (node, helpers) => {
      void helpers;
      return node.name;
    },
  },

  // ── Forecast hours (Demand Forecast grid) ────────────────────────────────
  {
    key: "forecastFromGrid",
    widthClass: "w-24 shrink-0",
    header: { type: "static", label: "FORECAST HOURS" },
    cell: (node, ctx) => {
      if (node.type !== "scope") {
        return <div className="w-24 shrink-0 px-2 py-1.5 text-center tabular-nums" aria-hidden />;
      }
      const { line, title } = forecastScopeProgrammeCell(
        node.id,
        ctx.forecastHoursByScope,
        ctx.engineerPool
      );
      return (
        <div
          className="text-muted-foreground w-24 shrink-0 px-2 py-1.5 text-center text-sm tabular-nums"
          title={title}
        >
          {line}
        </div>
      );
    },
    tsvValue: (node, helpers) =>
      node.type === "scope" ? forecastScopeProgrammeTsv(node.id, helpers.forecastHoursByScope) : "",
  },

  // ── Planned Hours ─────────────────────────────────────────────────────────────
  {
    key: "totalHours",
    widthClass: "w-24 shrink-0",
    header: { type: "sortable", label: "PLANNED HOURS", sortColumn: "total" },
    cell: (node, ctx) => {
      const fromChildren = isRollupTotalHoursParent(node);
      const editValue = ctx.editingCell?.value ?? "";

      return (
        <div className="text-muted-foreground w-24 shrink-0 px-2 py-1.5 text-center tabular-nums">
          {fromChildren ? (
            <span className="tabular-nums" title="Sum of child hours">
              {node.totalHours ?? "—"}
            </span>
          ) : isEditingField(ctx.editingCell, node.id, "totalHours") ? (
            <EditInput
              type="number"
              value={editValue}
              onChange={ctx.onEditingCellChange}
              onCommit={ctx.onCommitEdit}
              onCancel={ctx.onCancelEdit}
              className="w-full text-center"
            />
          ) : (
            <span
              className={`inline-block ${HOVER_CLS}`}
              onClick={() => ctx.onStartEdit(node.id, "totalHours", String(node.totalHours ?? ""))}
            >
              {node.totalHours ?? "—"}
            </span>
          )}
        </div>
      );
    },
    tsvValue: (node, helpers) => {
      void helpers;
      return String(node.totalHours ?? "");
    },
  },

  // ── Start ────────────────────────────────────────────────────────────────────
  {
    key: "start",
    widthClass: "w-28 shrink-0",
    header: { type: "sortable", label: "START", sortColumn: "start" },
    cell: (node, ctx) => (
      <div className="w-28 shrink-0 px-2 py-1.5 text-center">
        <span
          className={`text-muted-foreground inline-block font-mono text-xs ${HOVER_CLS}`}
          onClick={(e) => ctx.onOpenCal(node.id, "start", node.start, e)}
          title="Click to pick date"
        >
          {node.start || "—"}
        </span>
      </div>
    ),
    tsvValue: (node, helpers) => {
      void helpers;
      return node.start;
    },
  },

  // ── Finish ───────────────────────────────────────────────────────────────────
  {
    key: "finish",
    widthClass: "w-28 shrink-0",
    header: { type: "sortable", label: "FINISH", sortColumn: "finish" },
    cell: (node, ctx) => (
      <div className="w-28 shrink-0 px-2 py-1.5 text-center">
        <span
          className={`text-muted-foreground inline-block font-mono text-xs ${HOVER_CLS}`}
          onClick={(e) => ctx.onOpenCal(node.id, "finish", node.finish, e)}
          title="Click to pick date"
        >
          {node.finish || "—"}
        </span>
      </div>
    ),
    tsvValue: (node, helpers) => {
      void helpers;
      return node.finish;
    },
  },

  // ── Status ───────────────────────────────────────────────────────────────────
  {
    key: "status",
    widthClass: "w-28 shrink-0",
    header: { type: "status-filter" },
    cell: (node, ctx) => (
      <div className="w-28 shrink-0 px-2 py-1.5 text-center">
        {node.type === "activity" ? (
          <select
            className={cn(
              "focus:ring-ring/30 h-7 w-full max-w-full cursor-pointer rounded px-1.5 py-0 text-center text-xs font-medium ring-1 ring-transparent outline-none select-auto",
              node.status === "Completed" && "bg-status-healthy-bg text-status-healthy",
              node.status === "In Progress" && "bg-status-info-bg text-status-info",
              (node.status === "Not Started" || node.status === "") &&
                "bg-muted text-muted-foreground"
            )}
            value={node.status || "Not Started"}
            onChange={(e) => ctx.onSaveField(node.id, "status", e.target.value)}
            title="Change status"
            aria-label="Activity status"
          >
            <option value="Not Started">Not Started</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>
        ) : node.status ? (
          <StatusBadge status={node.status} matchControlWidth />
        ) : null}
      </div>
    ),
    tsvValue: (node, helpers) => {
      void helpers;
      return node.status ?? "";
    },
  },
];
