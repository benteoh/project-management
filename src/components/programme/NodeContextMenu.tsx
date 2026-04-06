import { Plus, Trash2, Copy, ClipboardPaste, CopyPlus } from "lucide-react";
import { useRef } from "react";
import { NodeType, ContextMenuState, AddFormState } from "./types";
import { getAddOptions } from "./treeUtils";
import { useAnchoredFixedPosition } from "@/components/ui/useAnchoredFixedPosition";

interface NodeContextMenuProps {
  ctxMenu: ContextMenuState;
  onClose: () => void;
  onAddChild: (form: AddFormState) => void;
  onDelete: (nodeId: string) => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  hasSelection: boolean;
  hasStash: boolean;
}

const ITEM_CLS =
  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-foreground hover:bg-muted disabled:cursor-default disabled:opacity-40";

export function NodeContextMenu({
  ctxMenu,
  onClose,
  onAddChild,
  onDelete,
  onCopy,
  onPaste,
  onDuplicate,
  hasSelection,
  hasStash,
}: NodeContextMenuProps) {
  const addOptions = getAddOptions(ctxMenu.nodeType);
  const menuRef = useRef<HTMLDivElement>(null);
  const { top, left } = useAnchoredFixedPosition({
    anchorRect: { top: ctxMenu.y, left: ctxMenu.x, width: 0, height: 0 },
    elementRef: menuRef,
    offset: 2,
    viewportPadding: 8,
  });

  const close = (fn: () => void) => () => {
    fn();
    onClose();
  };

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
            className={ITEM_CLS}
            onClick={close(() => onAddChild({ parentId: ctxMenu.nodeId, type: opt.type }))}
          >
            <Plus size={12} className="text-muted-foreground shrink-0" />
            {opt.label}
          </button>
        ))}
        {addOptions.length > 0 && <div className="border-border my-1 border-t" />}

        <button className={ITEM_CLS} disabled={!hasSelection} onClick={close(onCopy)}>
          <Copy size={12} className="text-muted-foreground shrink-0" />
          Copy
        </button>
        <button className={ITEM_CLS} disabled={!hasStash} onClick={close(onPaste)}>
          <ClipboardPaste size={12} className="text-muted-foreground shrink-0" />
          Paste after
        </button>
        <button className={ITEM_CLS} disabled={!hasSelection} onClick={close(onDuplicate)}>
          <CopyPlus size={12} className="text-muted-foreground shrink-0" />
          Duplicate
        </button>

        <div className="border-border my-1 border-t" />
        <button
          className="text-status-critical hover:bg-status-critical-bg flex w-full items-center gap-2 px-3 py-1.5 text-left"
          onClick={close(() => onDelete(ctxMenu.nodeId))}
        >
          <Trash2 size={12} className="shrink-0" />
          Delete {ctxMenu.nodeType}
        </button>
      </div>
    </>
  );
}
