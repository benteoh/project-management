import type { RefObject } from "react";
import type { EngineerPoolEntry } from "@/types/engineer-pool";
import type { ForecastHoursByScopeRecord } from "@/types/forecast-scope";

import { cn } from "@/lib/utils";
import { ProgrammeNode, EditableField, EditingCell } from "./types";
import { getScopeNumberFromName } from "./treeUtils";
import { PROGRAMME_COLUMNS, type CellContext } from "./programmeColumns";

interface ProgrammeRowProps {
  node: ProgrammeNode;
  depth: number;
  engineerPool: EngineerPoolEntry[];
  forecastHoursByScope: ForecastHoursByScopeRecord;
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
  engPopupScopeId?: string | null;
  engineerAnchorRef?: RefObject<HTMLDivElement | null>;
  selectedIds: Set<string>;
  copiedIds: Set<string>;
  onRowMouseDown: (id: string, e: React.MouseEvent) => void;
  onRowMouseEnter: (id: string) => void;
}

const ROW_BG: Record<ProgrammeNode["type"], string> = {
  scope: "bg-red-100",
  task: "bg-muted",
  subtask: "bg-muted/50",
  activity: "bg-card",
};

export function ProgrammeRow({
  node,
  depth,
  engineerPool,
  forecastHoursByScope,
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
  copiedIds,
  onRowMouseDown,
  onRowMouseEnter,
}: ProgrammeRowProps) {
  const isSelected = selectedIds.has(node.id);
  const isCopied = copiedIds.has(node.id);
  const isCollapsed = collapsed.has(node.id);

  const ctx: CellContext = {
    depth,
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
    onOpenEngPinned,
    engPopupScopeId,
    engineerAnchorRef,
    engineerPool,
    forecastHoursByScope,
  };

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
    copiedIds,
    onRowMouseDown,
    onRowMouseEnter,
    engineerPool,
    forecastHoursByScope,
  };

  return (
    <div>
      <div
        data-programme-row
        data-programme-node-id={node.id}
        className={cn(
          "border-border flex items-center border-b text-sm select-none",
          ROW_BG[node.type],
          isSelected && "bg-blue-50 ring-1 ring-blue-200 ring-inset",
          isCopied && "bg-blue-100 ring-1 ring-blue-300 ring-inset"
        )}
        onContextMenu={(e) => onContextMenu(node, e)}
        onMouseDown={(e) => onRowMouseDown(node.id, e)}
        onMouseEnter={() => onRowMouseEnter(node.id)}
      >
        {PROGRAMME_COLUMNS.map((col) => (
          <div key={col.key} className="contents">
            {col.cell(node, ctx)}
          </div>
        ))}
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
