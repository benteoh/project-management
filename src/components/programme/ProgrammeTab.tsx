"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";

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
import { EngineerPopup } from "./EngineerPopup";
import {
  applyActivityQuery,
  collectActivityQueryItems,
  DEFAULT_ACTIVITY_QUERY,
  isActivityQueryActive,
  type ActivityStatusValue,
  type ActivityQueryState,
} from "./activityQuery";
import { ColumnFilter } from "@/components/forecast/ColumnFilter";
import type { Engineer, EngineerPoolEntry } from "@/types/engineer-pool";
import { ProgrammeTableHeader } from "./ProgrammeTableHeader";
import { PROGRAMME_SORT_COLUMN_MAP, type ProgrammeSortColumn } from "./programmeTableSort";

export type ProgrammeTabProps = {
  initialTree: ProgrammeNode[];
  initialEngineerPool: EngineerPoolEntry[];
  /** Remote load failed (Supabase error, missing env, etc.) */
  loadError: string | null;
  saveProgramme: (tree: ProgrammeNode[]) => Promise<{ ok: true } | { ok: false; error: string }>;
  addEngineerToPool: (
    code: string
  ) => Promise<{ ok: true; engineer: Engineer } | { ok: false; error: string }>;
  onTreeChange?: (tree: ProgrammeNode[]) => void;
  onEngineerPoolChange?: (engineers: EngineerPoolEntry[]) => void;
  activityFilterIds?: ReadonlySet<string> | null;
};

export function ProgrammeTab({
  initialTree,
  initialEngineerPool,
  loadError: initialLoadError,
  saveProgramme,
  addEngineerToPool,
  onTreeChange,
  onEngineerPoolChange,
  activityFilterIds,
}: ProgrammeTabProps) {
  const histRef = useRef<{ stack: ProgrammeNode[][]; idx: number }>({
    stack: [initialTree],
    idx: 0,
  });
  const [present, setPresent] = useState<ProgrammeNode[]>(initialTree);
  const [engineerPool, setEngineerPool] = useState<EngineerPoolEntry[]>(initialEngineerPool);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [addForm, setAddForm] = useState<AddFormState | null>(null);
  const [formValues, setFormValues] = useState<FormValues>(defaultForm);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [calendar, setCalendar] = useState<CalendarState | null>(null);
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  const [engPopup, setEngPopup] = useState<{
    scopeId: string;
    rect: { top: number; left: number; width: number; height: number };
  } | null>(null);
  const [activityQuery, setActivityQuery] = useState<ActivityQueryState>(DEFAULT_ACTIVITY_QUERY);
  const [openFilter, setOpenFilter] = useState<{
    column: "status";
    rect: DOMRect;
  } | null>(null);

  const persist = useCallback(
    async (tree: ProgrammeNode[]) => {
      const r = await saveProgramme(tree);
      if (!r.ok) setSaveError(r.error);
      else setSaveError(null);
    },
    [saveProgramme]
  );

  const commit = useCallback(
    (next: ProgrammeNode[]) => {
      const h = histRef.current;
      h.stack = h.stack.slice(0, h.idx + 1);
      h.stack.push(next);
      h.idx = h.stack.length - 1;
      setPresent(next);
      onTreeChange?.(next);
      void persist(next);
    },
    [onTreeChange, persist]
  );

  const undo = useCallback(() => {
    const h = histRef.current;
    if (h.idx <= 0) return;
    h.idx--;
    const next = h.stack[h.idx];
    setPresent(next);
    onTreeChange?.(next);
    void persist(next);
  }, [onTreeChange, persist]);

  const redo = useCallback(() => {
    const h = histRef.current;
    if (h.idx >= h.stack.length - 1) return;
    h.idx++;
    const next = h.stack[h.idx];
    setPresent(next);
    onTreeChange?.(next);
    void persist(next);
  }, [onTreeChange, persist]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;
      if (e.key === "z") {
        e.preventDefault();
        undo();
      }
      if (e.key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const saveField = (nodeId: string, field: keyof ProgrammeNode, raw: string) => {
    let value: number | string | null = raw;
    if (field === "totalHours" || field === "forecastTotalHours") {
      if (raw === "") value = null;
      else {
        const n = parseFloat(raw);
        value = Number.isNaN(n) ? null : Math.round(n * 100) / 100;
      }
    }
    commit(updateNodeInTree(present, nodeId, field, value as ProgrammeNode[keyof ProgrammeNode]));
  };

  const commitEdit = () => {
    if (!editingCell) return;
    saveField(editingCell.nodeId, editingCell.field as keyof ProgrammeNode, editingCell.value);
    setEditingCell(null);
  };

  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

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
      forecastTotalHours: formValues.forecastTotalHours
        ? Number(formValues.forecastTotalHours)
        : null,
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

  const openCal = (
    nodeId: string,
    field: "start" | "finish",
    value: string,
    e: React.MouseEvent<HTMLElement>
  ) => {
    setEditingCell(null);
    setCtxMenu(null);
    const r = e.currentTarget.getBoundingClientRect();
    setCalendar({
      nodeId,
      field,
      value,
      rect: { top: r.top, left: r.left, width: r.width, height: r.height },
    });
  };

  const openCtxMenu = (node: ProgrammeNode, e: React.MouseEvent) => {
    e.preventDefault();
    setEditingCell(null);
    setCalendar(null);
    setCtxMenu({ nodeId: node.id, nodeType: node.type, x: e.clientX, y: e.clientY });
  };

  const openEngPinned = (scopeId: string, e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setEngPopup({ scopeId, rect: { top: r.top, left: r.left, width: r.width, height: r.height } });
  };

  const updateScopeEngineers = (scopeId: string, engineers: ProgrammeNode["engineers"]) => {
    commit(
      updateNodeInTree(
        present,
        scopeId,
        "engineers",
        engineers as ProgrammeNode[keyof ProgrammeNode]
      )
    );
  };

  const addToPool = (code: string) => {
    void addEngineerToPool(code).then((r) => {
      if (!r.ok) {
        setSaveError(r.error);
        return;
      }
      setEngineerPool((prev) => {
        const next = prev.filter((p) => p.id !== r.engineer.id);
        const updated = [
          ...next,
          {
            id: r.engineer.id,
            code: r.engineer.code,
            firstName: r.engineer.firstName,
            lastName: r.engineer.lastName,
            capacityPerWeek: r.engineer.capacityPerWeek,
          },
        ].sort((a, b) => a.code.localeCompare(b.code));
        onEngineerPoolChange?.(updated);
        return updated;
      });
    });
  };

  const rowProps = {
    editingCell,
    onToggleCollapse: toggleCollapse,
    onStartEdit: startEdit,
    onCommitEdit: commitEdit,
    onEditingCellChange: (value: string) => setEditingCell((p) => (p ? { ...p, value } : p)),
    onCancelEdit: () => setEditingCell(null),
    onOpenCal: openCal,
    onSaveField: saveField,
    onContextMenu: openCtxMenu,
    onOpenEngPinned: openEngPinned,
  };

  const statusFilterOptions: ActivityStatusValue[] = ["Not Started", "In Progress", "Completed"];

  const toggleSort = (column: ProgrammeSortColumn) => {
    setActivityQuery((prev) => {
      const sorts = PROGRAMME_SORT_COLUMN_MAP[column];
      const nextSort =
        prev.sort === sorts.asc ? sorts.desc : prev.sort === sorts.desc ? "none" : sorts.asc;
      return { ...prev, sort: nextSort };
    });
  };

  const openFilterFor = (column: "status", e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setOpenFilter({ column, rect });
  };

  const queriedActivityIds = useMemo(() => {
    const items = collectActivityQueryItems(present);
    return applyActivityQuery(items, activityQuery, activityFilterIds ?? null);
  }, [present, activityQuery, activityFilterIds]);

  const engPopupScopeNode = useMemo(() => {
    if (!engPopup) return null;
    const findScope = (nodes: ProgrammeNode[]): ProgrammeNode | null => {
      for (const n of nodes) {
        if (n.id === engPopup.scopeId) return n;
        const found = findScope(n.children);
        if (found) return found;
      }
      return null;
    };
    return findScope(present);
  }, [engPopup, present]);

  const hasExternalCardFilter = activityFilterIds != null;
  const hasAnyActivityFilter = hasExternalCardFilter || isActivityQueryActive(activityQuery);

  const visibleTree = useMemo(() => {
    if (!hasAnyActivityFilter) return present;

    const activityIds = new Set(queriedActivityIds);

    const filterTree = (nodes: ProgrammeNode[]): ProgrammeNode[] =>
      nodes.flatMap((node) => {
        const filteredChildren = filterTree(node.children);
        const includeSelf = node.type === "activity" && activityIds.has(node.id);
        if (!includeSelf && filteredChildren.length === 0) return [];
        return [{ ...node, children: filteredChildren }];
      });

    const rankById = new Map(queriedActivityIds.map((id, idx) => [id, idx]));

    const sortTree = (nodes: ProgrammeNode[]): { node: ProgrammeNode; rank: number }[] => {
      return nodes
        .map((node) => {
          const childEntries = sortTree(node.children);
          const selfRank =
            node.type === "activity"
              ? (rankById.get(node.id) ?? Number.POSITIVE_INFINITY)
              : Number.POSITIVE_INFINITY;
          const minChildRank = childEntries.reduce(
            (min, child) => Math.min(min, child.rank),
            Number.POSITIVE_INFINITY
          );
          return {
            node: {
              ...node,
              children: childEntries.map((entry) => entry.node),
            },
            rank: Math.min(selfRank, minChildRank),
          };
        })
        .sort((a, b) => a.rank - b.rank);
    };

    return sortTree(filterTree(present)).map((entry) => entry.node);
  }, [present, queriedActivityIds, hasAnyActivityFilter]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {initialLoadError && (
        <div className="border-border bg-status-critical-bg text-status-critical shrink-0 border-b px-4 py-2 text-sm">
          {initialLoadError}
        </div>
      )}
      {saveError && (
        <div className="border-border bg-status-warning-bg text-status-warning shrink-0 border-b px-4 py-2 text-sm">
          Could not save: {saveError}
        </div>
      )}

      <div className="relative flex-1 overflow-y-auto">
        <ProgrammeTableHeader
          sort={activityQuery.sort}
          statusFilterActive={Boolean(activityQuery.statuses)}
          onSort={toggleSort}
          onStatusFilterClick={(e) => openFilterFor("status", e)}
        />

        {visibleTree.length === 0 && hasAnyActivityFilter ? (
          <div className="text-muted-foreground px-4 py-3 text-sm">
            No activities match the selected filter.
          </div>
        ) : (
          visibleTree.map((node) => (
            <ProgrammeRow
              key={node.id}
              node={node}
              depth={0}
              engineerPool={engineerPool}
              {...rowProps}
              collapsed={collapsed}
            />
          ))
        )}
      </div>

      {openFilter && (
        <ColumnFilter
          options={statusFilterOptions}
          selected={activityQuery.statuses}
          anchorRect={openFilter.rect}
          onChange={(next) =>
            setActivityQuery((prev) => ({
              ...prev,
              statuses: next as Set<ActivityStatusValue> | null,
            }))
          }
          onClose={() => setOpenFilter(null)}
        />
      )}

      {ctxMenu && (
        <NodeContextMenu
          ctxMenu={ctxMenu}
          onClose={() => setCtxMenu(null)}
          onAddChild={(form) => {
            setAddForm(form);
            setFormValues(defaultForm);
          }}
          onDelete={(nodeId) => {
            commit(deleteNodeFromTree(present, nodeId));
          }}
        />
      )}

      {engPopup && engPopupScopeNode && (
        <EngineerPopup
          key={engPopup.scopeId}
          engineers={engPopupScopeNode.engineers ?? []}
          totalHours={engPopupScopeNode.totalHours}
          forecastHours={engPopupScopeNode.forecastTotalHours}
          engineerPool={engineerPool}
          rect={engPopup.rect}
          onChangeEngineers={(engs) => updateScopeEngineers(engPopup.scopeId, engs)}
          onAddToPool={addToPool}
          onClose={() => setEngPopup(null)}
        />
      )}

      {calendar && (
        <MiniCalendar
          value={calendar.value}
          anchorRect={calendar.rect}
          onChange={(v) => {
            saveField(calendar.nodeId, calendar.field, v);
            setCalendar(null);
          }}
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
