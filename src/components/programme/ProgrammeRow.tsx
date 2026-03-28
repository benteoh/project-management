import { ChevronRight, ChevronDown } from "lucide-react";
import { ProgrammeNode, EditableField, EditingCell } from "./types";
import { StatusBadge } from "./StatusBadge";

interface ProgrammeRowProps {
  node: ProgrammeNode;
  depth: number;
  collapsed: Set<string>;
  editingCell: EditingCell | null;
  onToggleCollapse: (id: string) => void;
  onStartEdit: (nodeId: string, field: EditableField, current: string) => void;
  onCommitEdit: () => void;
  onEditingCellChange: (value: string) => void;
  onCancelEdit: () => void;
  onOpenCal: (nodeId: string, field: "start" | "finish", value: string, e: React.MouseEvent<HTMLElement>) => void;
  onSaveField: (nodeId: string, field: keyof ProgrammeNode, raw: string) => void;
  onContextMenu: (node: ProgrammeNode, e: React.MouseEvent) => void;
}

const ROW_STYLES: Record<ProgrammeNode["type"], { bg: string; text: string }> = {
  scope:    { bg: "bg-red-100",    text: "font-semibold text-red-900" },
  task:     { bg: "bg-muted",      text: "font-medium text-foreground" },
  subtask:  { bg: "bg-muted/50",   text: "font-medium text-foreground" },
  activity: { bg: "bg-card",       text: "text-foreground" },
};

const EDIT_INPUT_CLS = "rounded border border-ring bg-card px-1.5 py-0.5 text-sm outline-none ring-1 ring-ring/20";
const HOVER_CLS = "cursor-pointer rounded px-0.5 py-0.5 hover:bg-black/[.06]";

export function ProgrammeRow({
  node,
  depth,
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
}: ProgrammeRowProps) {
  const isCollapsed = collapsed.has(node.id);
  const hasChildren = node.children.length > 0;
  const { bg, text } = ROW_STYLES[node.type];

  const isEditing = (field: EditableField) =>
    editingCell?.nodeId === node.id && editingCell?.field === field;

  const editInput = (
    <input
      autoFocus
      className={`flex-1 min-w-0 ${EDIT_INPUT_CLS}`}
      value={editingCell?.value ?? ""}
      onChange={e => onEditingCellChange(e.target.value)}
      onBlur={onCommitEdit}
      onKeyDown={e => {
        if (e.key === "Enter") onCommitEdit();
        if (e.key === "Escape") onCancelEdit();
      }}
    />
  );

  const numericInput = (
    <input
      autoFocus
      type="number"
      className={`w-full text-right ${EDIT_INPUT_CLS}`}
      value={editingCell?.value ?? ""}
      onChange={e => onEditingCellChange(e.target.value)}
      onBlur={onCommitEdit}
      onKeyDown={e => {
        if (e.key === "Enter") onCommitEdit();
        if (e.key === "Escape") onCancelEdit();
      }}
    />
  );

  return (
    <div>
      <div
        className={`flex items-center border-b border-border text-sm ${bg} select-none`}
        onContextMenu={e => onContextMenu(node, e)}
      >
        {/* Name */}
        <div
          className={`flex flex-1 items-center gap-1 py-1.5 pr-3 min-w-0 ${text}`}
          style={{ paddingLeft: `${12 + depth * 20}px` }}
        >
          {hasChildren ? (
            <button
              onClick={() => onToggleCollapse(node.id)}
              className="shrink-0 mr-0.5 text-muted-foreground hover:text-foreground"
            >
              {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          {node.activityId && (
            <span className="shrink-0 font-mono text-xs text-muted-foreground mr-1">
              {node.activityId}
            </span>
          )}
          {isEditing("name") ? editInput : (
            <span
              className={`truncate ${HOVER_CLS}`}
              onClick={() => onStartEdit(node.id, "name", node.name)}
              title="Click to edit · Right-click for options"
            >
              {node.name}
            </span>
          )}
        </div>

        {/* Total Hours */}
        <div className="w-24 shrink-0 px-2 py-1.5 text-right text-muted-foreground tabular-nums">
          {isEditing("totalHours") ? numericInput : (
            <span
              className={HOVER_CLS}
              onClick={() => onStartEdit(node.id, "totalHours", String(node.totalHours ?? ""))}
            >
              {node.totalHours ?? "—"}
            </span>
          )}
        </div>

        {/* Start */}
        <div className="w-28 shrink-0 px-2 py-1.5">
          <span
            className={`inline-block font-mono text-xs text-muted-foreground ${HOVER_CLS}`}
            onClick={e => onOpenCal(node.id, "start", node.start, e)}
            title="Click to pick date"
          >
            {node.start || "—"}
          </span>
        </div>

        {/* Finish */}
        <div className="w-28 shrink-0 px-2 py-1.5">
          <span
            className={`inline-block font-mono text-xs text-muted-foreground ${HOVER_CLS}`}
            onClick={e => onOpenCal(node.id, "finish", node.finish, e)}
            title="Click to pick date"
          >
            {node.finish || "—"}
          </span>
        </div>

        {/* Forecast Hours */}
        <div className="w-28 shrink-0 px-2 py-1.5 text-right text-muted-foreground tabular-nums">
          {isEditing("forecastTotalHours") ? numericInput : (
            <span
              className={HOVER_CLS}
              onClick={() => onStartEdit(node.id, "forecastTotalHours", String(node.forecastTotalHours ?? ""))}
            >
              {node.forecastTotalHours ?? "—"}
            </span>
          )}
        </div>

        {/* Status */}
        <div className="w-28 shrink-0 px-2 py-1.5">
          {isEditing("status") ? (
            <select
              autoFocus
              className={`w-full px-1 py-0.5 text-xs ${EDIT_INPUT_CLS}`}
              value={editingCell?.value ?? ""}
              onChange={e => { onSaveField(node.id, "status", e.target.value); onCancelEdit(); }}
              onBlur={onCancelEdit}
            >
              <option>Not Started</option>
              <option>In Progress</option>
              <option>Completed</option>
            </select>
          ) : node.status ? (
            <span
              className={`inline-block rounded ${node.type === "activity" ? "cursor-pointer hover:opacity-80" : ""}`}
              onClick={() => node.type === "activity" && onStartEdit(node.id, "status", node.status)}
              title={node.type === "activity" ? "Click to change status" : undefined}
            >
              <StatusBadge status={node.status} />
            </span>
          ) : null}
        </div>
      </div>

      {/* Children */}
      {!isCollapsed && node.children.map(child => (
        <ProgrammeRow
          key={child.id}
          node={child}
          depth={depth + 1}
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
        />
      ))}
    </div>
  );
}
