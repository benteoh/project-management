import { ChevronRight, ChevronDown } from "lucide-react";
import type { EngineerPoolEntry } from "@/types/engineer-pool";

import { ProgrammeNode, EditableField, EditingCell } from "./types";
import { StatusBadge } from "./StatusBadge";
import { EngineerChip } from "./EngineerChip";
import { getScopeNumberFromName } from "./treeUtils";

interface ProgrammeRowProps {
  node: ProgrammeNode;
  depth: number;
  engineerPool: EngineerPoolEntry[];
  /** e.g. "11.2" for tasks/subtasks under numbered scopes */
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
  onContextMenu: (node: ProgrammeNode, e: React.MouseEvent) => void;
  onOpenEngPinned?: (scopeId: string, e: React.MouseEvent<HTMLDivElement>) => void;
}

const ROW_STYLES: Record<ProgrammeNode["type"], { bg: string; text: string }> = {
  scope: { bg: "bg-red-100", text: "font-semibold text-red-900" },
  task: { bg: "bg-muted", text: "font-medium text-foreground" },
  subtask: { bg: "bg-muted/50", text: "font-medium text-foreground" },
  activity: { bg: "bg-card", text: "text-foreground" },
};

const EDIT_INPUT_CLS =
  "rounded border border-ring bg-card px-1.5 py-0.5 text-sm outline-none ring-1 ring-ring/20";
const HOVER_CLS = "cursor-pointer rounded px-0.5 py-0.5 hover:bg-black/[.06]";

export function ProgrammeRow({
  node,
  depth,
  engineerPool,
  namePrefix,
  collapsed,
  editingCell,
  onToggleCollapse,
  onStartEdit,
  onCommitEdit,
  onEditingCellChange,
  onCancelEdit,
  onOpenCal,
  onSaveField,
  onContextMenu,
  onOpenEngPinned,
}: ProgrammeRowProps) {
  const isCollapsed = collapsed.has(node.id);
  const hasChildren = node.children.length > 0;
  const { bg, text } = ROW_STYLES[node.type];

  const isEditing = (field: EditableField) =>
    editingCell?.nodeId === node.id && editingCell?.field === field;

  const editInput = (
    <input
      autoFocus
      className={`min-w-0 flex-1 ${EDIT_INPUT_CLS}`}
      value={editingCell?.value ?? ""}
      onChange={(e) => onEditingCellChange(e.target.value)}
      onBlur={onCommitEdit}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommitEdit();
        if (e.key === "Escape") onCancelEdit();
      }}
    />
  );

  const numericInput = (
    <input
      autoFocus
      type="number"
      className={`w-full text-center ${EDIT_INPUT_CLS}`}
      value={editingCell?.value ?? ""}
      onChange={(e) => onEditingCellChange(e.target.value)}
      onBlur={onCommitEdit}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommitEdit();
        if (e.key === "Escape") onCancelEdit();
      }}
    />
  );

  return (
    <div>
      <div
        className={`border-border flex items-center border-b text-sm ${bg} select-none`}
        onContextMenu={(e) => onContextMenu(node, e)}
      >
        {/* Name */}
        <div
          className={`flex min-w-0 flex-1 items-center gap-1 py-1.5 pr-3 ${text}`}
          style={{ paddingLeft: `${12 + depth * 20}px` }}
        >
          {hasChildren ? (
            <button
              onClick={() => onToggleCollapse(node.id)}
              className="text-muted-foreground hover:text-foreground mr-0.5 shrink-0"
            >
              {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          {node.activityId && (
            <span className="text-muted-foreground mr-1 shrink-0 font-mono text-xs">
              {node.activityId}
            </span>
          )}
          {(node.type === "task" || node.type === "subtask") && namePrefix && (
            <span className="text-muted-foreground mr-1 shrink-0 font-mono text-xs select-none">
              {namePrefix}
            </span>
          )}
          {isEditing("name") ? (
            editInput
          ) : (
            <span
              className={`truncate ${HOVER_CLS}`}
              onClick={() => onStartEdit(node.id, "name", node.name)}
              title="Click to edit · Right-click for options"
            >
              {node.name}
            </span>
          )}
          {node.type === "scope" && onOpenEngPinned && (
            <EngineerChip
              engineers={node.engineers ?? []}
              engineerPool={engineerPool}
              onClick={(e) => onOpenEngPinned(node.id, e)}
            />
          )}
        </div>

        {/* Total Hours */}
        <div className="text-muted-foreground w-24 shrink-0 px-2 py-1.5 text-center tabular-nums">
          {isEditing("totalHours") ? (
            numericInput
          ) : (
            <span
              className={`inline-block ${HOVER_CLS}`}
              onClick={() => onStartEdit(node.id, "totalHours", String(node.totalHours ?? ""))}
            >
              {node.totalHours ?? "—"}
            </span>
          )}
        </div>

        {/* Start */}
        <div className="w-28 shrink-0 px-2 py-1.5 text-center">
          <span
            className={`text-muted-foreground inline-block font-mono text-xs ${HOVER_CLS}`}
            onClick={(e) => onOpenCal(node.id, "start", node.start, e)}
            title="Click to pick date"
          >
            {node.start || "—"}
          </span>
        </div>

        {/* Finish */}
        <div className="w-28 shrink-0 px-2 py-1.5 text-center">
          <span
            className={`text-muted-foreground inline-block font-mono text-xs ${HOVER_CLS}`}
            onClick={(e) => onOpenCal(node.id, "finish", node.finish, e)}
            title="Click to pick date"
          >
            {node.finish || "—"}
          </span>
        </div>

        {/* Forecast Hours */}
        <div className="text-muted-foreground w-28 shrink-0 px-2 py-1.5 text-center tabular-nums">
          {isEditing("forecastTotalHours") ? (
            numericInput
          ) : (
            <span
              className={`inline-block ${HOVER_CLS}`}
              onClick={() =>
                onStartEdit(node.id, "forecastTotalHours", String(node.forecastTotalHours ?? ""))
              }
            >
              {node.forecastTotalHours ?? "—"}
            </span>
          )}
        </div>

        {/* Status */}
        <div className="w-28 shrink-0 px-2 py-1.5 text-center">
          {isEditing("status") ? (
            <select
              autoFocus
              className={`w-full px-1 py-0.5 text-center text-xs ${EDIT_INPUT_CLS}`}
              value={editingCell?.value ?? ""}
              onChange={(e) => {
                onSaveField(node.id, "status", e.target.value);
                onCancelEdit();
              }}
              onBlur={onCancelEdit}
            >
              <option>Not Started</option>
              <option>In Progress</option>
              <option>Completed</option>
            </select>
          ) : node.status ? (
            <span className="inline-flex justify-center">
              <span
                className={`inline-block rounded ${node.type === "activity" ? "cursor-pointer hover:opacity-80" : ""}`}
                onClick={() =>
                  node.type === "activity" && onStartEdit(node.id, "status", node.status)
                }
                title={node.type === "activity" ? "Click to change status" : undefined}
              >
                <StatusBadge status={node.status} />
              </span>
            </span>
          ) : null}
        </div>
      </div>

      {/* Children */}
      {!isCollapsed &&
        (() => {
          let taskCount = 0;
          let subtaskCount = 0;
          const scopeNum = node.type === "scope" ? getScopeNumberFromName(node.name) : "";
          return node.children.map((child) => {
            let childNamePrefix: string | undefined;
            if (child.type === "task") {
              taskCount++;
              childNamePrefix = scopeNum ? `${scopeNum}.${taskCount}` : undefined;
            } else if (child.type === "subtask") {
              subtaskCount++;
              childNamePrefix = namePrefix ? `${namePrefix}.${subtaskCount}` : undefined;
            }
            return (
              <ProgrammeRow
                key={child.id}
                node={child}
                depth={depth + 1}
                engineerPool={engineerPool}
                namePrefix={childNamePrefix}
                collapsed={collapsed}
                editingCell={editingCell}
                onToggleCollapse={onToggleCollapse}
                onStartEdit={onStartEdit}
                onCommitEdit={onCommitEdit}
                onEditingCellChange={onEditingCellChange}
                onCancelEdit={onCancelEdit}
                onOpenCal={onOpenCal}
                onSaveField={onSaveField}
                onContextMenu={onContextMenu}
                onOpenEngPinned={onOpenEngPinned}
              />
            );
          });
        })()}
    </div>
  );
}
