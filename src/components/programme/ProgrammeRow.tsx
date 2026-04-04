import type { RefObject } from "react";
import { ChevronRight, ChevronDown, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { isRollupTotalHoursParent } from "@/lib/programme/totalHoursRollup";
import type { EngineerPoolEntry } from "@/types/engineer-pool";

import { cn } from "@/lib/utils";
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
  /** When set, ref is attached to this row's engineer chip (for anchored popups). */
  engPopupScopeId?: string | null;
  engineerAnchorRef?: RefObject<HTMLDivElement | null>;
  /** Full set of selected node IDs — each row checks its own membership. */
  selectedIds: Set<string>;
  onRowMouseDown: (id: string, e: React.MouseEvent) => void;
  onRowMouseEnter: (id: string) => void;
  /** ID of the node currently being dragged over (for drop indicator). */
  dragOverId?: string | null;
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
  engPopupScopeId,
  engineerAnchorRef,
  selectedIds,
  onRowMouseDown,
  onRowMouseEnter,
  dragOverId,
}: ProgrammeRowProps) {
  const isCollapsed = collapsed.has(node.id);
  const hasChildren = node.children.length > 0;
  const { bg, text } = ROW_STYLES[node.type];
  const isSelected = selectedIds.has(node.id);
  const isDropTarget = dragOverId === node.id;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
  });

  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
    position: isDragging ? ("relative" as const) : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  const isEditing = (field: EditableField) =>
    editingCell?.nodeId === node.id && editingCell?.field === field;

  const totalHoursFromChildren = isRollupTotalHoursParent(node);

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

  const activityIdInput = (
    <input
      autoFocus
      className={`w-[5.5rem] shrink-0 font-mono text-xs ${EDIT_INPUT_CLS}`}
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

  const childProps = {
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
    engPopupScopeId,
    engineerAnchorRef,
    selectedIds,
    onRowMouseDown,
    onRowMouseEnter,
    dragOverId,
    engineerPool,
  };

  return (
    <div ref={setNodeRef} style={dragStyle}>
      {/* Drop indicator above this row */}
      {isDropTarget && <div className="pointer-events-none h-0.5 bg-blue-400" />}

      <div
        className={cn(
          "border-border flex items-center border-b text-sm select-none",
          bg,
          isSelected && "bg-blue-50 ring-1 ring-blue-200 ring-inset"
        )}
        onContextMenu={(e) => onContextMenu(node, e)}
        onMouseDown={(e) => onRowMouseDown(node.id, e)}
        onMouseEnter={() => onRowMouseEnter(node.id)}
      >
        {/* Drag handle */}
        <div
          className="text-muted-foreground/40 hover:text-muted-foreground w-5 shrink-0 cursor-grab touch-none pl-1 active:cursor-grabbing"
          {...attributes}
          {...listeners}
          title="Drag to reorder"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <GripVertical size={12} />
        </div>

        {/* Name */}
        <div
          className={`flex min-w-0 flex-1 items-center gap-1 py-1.5 pr-3 ${text}`}
          style={{ paddingLeft: `${4 + depth * 20}px` }}
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
          {node.type === "activity" &&
            (isEditing("activityId") ? (
              <span className="mr-1 shrink-0">{activityIdInput}</span>
            ) : (
              <span
                className={`text-muted-foreground mr-1 shrink-0 font-mono text-xs ${HOVER_CLS}`}
                onClick={() => onStartEdit(node.id, "activityId", node.activityId ?? "")}
                title="Click to edit activity ID"
              >
                {node.activityId || "—"}
              </span>
            ))}
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
              ref={
                engPopupScopeId != null && node.id === engPopupScopeId
                  ? engineerAnchorRef
                  : undefined
              }
              engineers={node.engineers ?? []}
              engineerPool={engineerPool}
              scopeTotalHours={node.totalHours}
              onClick={(e) => onOpenEngPinned(node.id, e)}
            />
          )}
        </div>

        {/* Total Hours */}
        <div className="text-muted-foreground w-24 shrink-0 px-2 py-1.5 text-center tabular-nums">
          {totalHoursFromChildren ? (
            <span className="text-muted-foreground tabular-nums" title="Sum of child hours">
              {node.totalHours ?? "—"}
            </span>
          ) : isEditing("totalHours") ? (
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
          {node.type === "activity" && node.status ? (
            <select
              className={cn(
                "focus:ring-ring/30 w-full max-w-full cursor-pointer rounded px-1.5 py-0.5 text-center text-xs font-medium ring-1 ring-transparent outline-none select-auto",
                node.status === "Completed" && "bg-status-healthy-bg text-status-healthy",
                node.status === "In Progress" && "bg-status-info-bg text-status-info",
                node.status === "Not Started" && "bg-muted text-muted-foreground"
              )}
              value={node.status}
              onChange={(e) => onSaveField(node.id, "status", e.target.value)}
              title="Change status"
              aria-label="Activity status"
            >
              <option value="Not Started">Not Started</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
          ) : node.status ? (
            <span className="inline-flex justify-center">
              <StatusBadge status={node.status} />
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
                namePrefix={childNamePrefix}
                {...childProps}
              />
            );
          });
        })()}
    </div>
  );
}
