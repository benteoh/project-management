import { Plus, Trash2 } from "lucide-react";
import { useRef } from "react";
import { NodeType, ContextMenuState, AddFormState } from "./types";
import { getAddOptions } from "./treeUtils";
import { useAnchoredFixedPosition } from "@/components/ui/useAnchoredFixedPosition";

interface NodeContextMenuProps {
  ctxMenu: ContextMenuState;
  onClose: () => void;
  onAddChild: (form: AddFormState) => void;
  onDelete: (nodeId: string) => void;
}

export function NodeContextMenu({ ctxMenu, onClose, onAddChild, onDelete }: NodeContextMenuProps) {
  const addOptions = getAddOptions(ctxMenu.nodeType);
  const menuRef = useRef<HTMLDivElement>(null);
  const { top, left } = useAnchoredFixedPosition({
    anchorRect: { top: ctxMenu.y, left: ctxMenu.x, width: 0, height: 0 },
    elementRef: menuRef,
    offset: 2,
    viewportPadding: 8,
  });

  return (
    <>
      <div
        className="fixed inset-0 z-99"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        ref={menuRef}
        className="border-border bg-card shadow-elevated fixed z-100 min-w-[160px] overflow-hidden rounded-md border py-1 text-sm"
        style={{ top, left }}
      >
        {addOptions.map((opt: { label: string; type: NodeType }) => (
          <button
            key={opt.type}
            className="text-foreground hover:bg-muted flex w-full items-center gap-2 px-3 py-1.5 text-left"
            onClick={() => {
              onAddChild({ parentId: ctxMenu.nodeId, type: opt.type });
              onClose();
            }}
          >
            <Plus size={12} className="text-muted-foreground shrink-0" />
            {opt.label}
          </button>
        ))}
        {addOptions.length > 0 && <div className="border-border my-1 border-t" />}
        <button
          className="text-status-critical hover:bg-status-critical-bg flex w-full items-center gap-2 px-3 py-1.5 text-left"
          onClick={() => {
            onDelete(ctxMenu.nodeId);
            onClose();
          }}
        >
          <Trash2 size={12} className="shrink-0" />
          Delete {ctxMenu.nodeType}
        </button>
      </div>
    </>
  );
}
