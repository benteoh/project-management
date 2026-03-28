"use client";

import { useState, useCallback, useEffect, useRef } from "react";

import { initialProgrammeData } from "@/mocks/programme";
import {
  ProgrammeNode,
  EditableField,
  EditingCell,
  CalendarState,
  AddFormState,
  FormValues,
  defaultForm,
  ContextMenuState,
} from "./types";
import { updateNodeInTree, addNodeToTree, deleteNodeFromTree } from "./treeUtils";
import { MiniCalendar } from "./MiniCalendar";
import { ProgrammeRow } from "./ProgrammeRow";
import { NodeContextMenu } from "./NodeContextMenu";
import { AddNodeModal } from "./AddNodeModal";

export function ProgrammeTab() {
  // Undo/redo: ref-backed stack so keyboard handlers never capture stale state
  const histRef = useRef<{ stack: ProgrammeNode[][]; idx: number }>({
    stack: [initialProgrammeData],
    idx: 0,
  });
  const [present, setPresent] = useState<ProgrammeNode[]>(initialProgrammeData);

  const commit = useCallback((next: ProgrammeNode[]) => {
    const h = histRef.current;
    h.stack = h.stack.slice(0, h.idx + 1);
    h.stack.push(next);
    h.idx = h.stack.length - 1;
    setPresent(next);
  }, []);

  const undo = useCallback(() => {
    const h = histRef.current;
    if (h.idx <= 0) return;
    h.idx--;
    setPresent(h.stack[h.idx]);
  }, []);

  const redo = useCallback(() => {
    const h = histRef.current;
    if (h.idx >= h.stack.length - 1) return;
    h.idx++;
    setPresent(h.stack[h.idx]);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;
      if (e.key === "z") { e.preventDefault(); undo(); }
      if (e.key === "y") { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const [collapsed,   setCollapsed]   = useState<Set<string>>(new Set());
  const [addForm,     setAddForm]     = useState<AddFormState | null>(null);
  const [formValues,  setFormValues]  = useState<FormValues>(defaultForm);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [calendar,    setCalendar]    = useState<CalendarState | null>(null);
  const [ctxMenu,     setCtxMenu]     = useState<ContextMenuState | null>(null);

  const saveField = (nodeId: string, field: keyof ProgrammeNode, raw: string) => {
    const value =
      field === "totalHours" || field === "forecastTotalHours"
        ? raw === "" ? null : Number(raw)
        : raw;
    commit(updateNodeInTree(present, nodeId, field, value as ProgrammeNode[keyof ProgrammeNode]));
  };

  const commitEdit = () => {
    if (!editingCell) return;
    saveField(editingCell.nodeId, editingCell.field as keyof ProgrammeNode, editingCell.value);
    setEditingCell(null);
  };

  const toggleCollapse = (id: string) =>
    setCollapsed(prev => { const s = new Set(prev); if (s.has(id)) { s.delete(id); } else { s.add(id); } return s; });

  const handleAdd = () => {
    if (!addForm || !formValues.name.trim()) return;
    const newNode: ProgrammeNode = {
      id: crypto.randomUUID(),
      activityId: formValues.activityId || undefined,
      name: formValues.name.trim(),
      type: addForm.type,
      totalHours: formValues.totalHours ? Number(formValues.totalHours) : null,
      start: formValues.start,
      finish: formValues.finish,
      forecastTotalHours: formValues.forecastTotalHours ? Number(formValues.forecastTotalHours) : null,
      status: formValues.status,
      children: [],
    };
    commit(addNodeToTree(present, addForm.parentId, newNode));
    setAddForm(null);
    setFormValues(defaultForm);
  };

  const startEdit = (nodeId: string, field: EditableField, current: string) => {
    setCalendar(null);
    setCtxMenu(null);
    setEditingCell({ nodeId, field, value: current });
  };

  const openCal = (nodeId: string, field: "start" | "finish", value: string, e: React.MouseEvent<HTMLElement>) => {
    setEditingCell(null);
    setCtxMenu(null);
    const r = e.currentTarget.getBoundingClientRect();
    setCalendar({ nodeId, field, value, rect: { top: r.top, left: r.left, width: r.width, height: r.height } });
  };

  const openCtxMenu = (node: ProgrammeNode, e: React.MouseEvent) => {
    e.preventDefault();
    setEditingCell(null);
    setCalendar(null);
    setCtxMenu({ nodeId: node.id, nodeType: node.type, x: e.clientX, y: e.clientY });
  };

  const rowProps = {
    collapsed,
    editingCell,
    onToggleCollapse: toggleCollapse,
    onStartEdit: startEdit,
    onCommitEdit: commitEdit,
    onEditingCellChange: (value: string) => setEditingCell(p => p ? { ...p, value } : p),
    onCancelEdit: () => setEditingCell(null),
    onOpenCal: openCal,
    onSaveField: saveField,
    onContextMenu: openCtxMenu,
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Table header */}
      <div className="flex shrink-0 items-center border-b-2 border-border bg-muted text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <div className="flex-1 px-3 py-2.5">Activity Name</div>
        <div className="w-24 shrink-0 px-3 py-2.5 text-right">Total Hours</div>
        <div className="w-28 shrink-0 px-3 py-2.5">Start</div>
        <div className="w-28 shrink-0 px-3 py-2.5">Finish</div>
        <div className="w-28 shrink-0 px-3 py-2.5 text-right">Forecast Hrs</div>
        <div className="w-28 shrink-0 px-3 py-2.5">Status</div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {present.map(node => (
          <ProgrammeRow key={node.id} node={node} depth={0} {...rowProps} />
        ))}
      </div>

      {ctxMenu && (
        <NodeContextMenu
          ctxMenu={ctxMenu}
          onClose={() => setCtxMenu(null)}
          onAddChild={form => { setAddForm(form); setFormValues(defaultForm); }}
          onDelete={nodeId => { commit(deleteNodeFromTree(present, nodeId)); }}
        />
      )}

      {calendar && (
        <MiniCalendar
          value={calendar.value}
          anchorRect={calendar.rect}
          onChange={v => { saveField(calendar.nodeId, calendar.field, v); setCalendar(null); }}
          onClose={() => setCalendar(null)}
        />
      )}

      {addForm && (
        <AddNodeModal
          addForm={addForm}
          formValues={formValues}
          onChange={setFormValues}
          onConfirm={handleAdd}
          onClose={() => setAddForm(null)}
        />
      )}
    </div>
  );
}
