"use client";

import { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";

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
import { nextActivityIdFromTree } from "@/lib/programme/nextActivityId";
import { applyProgrammeRollups } from "@/lib/programme/applyProgrammeRollups";
import { isRollupTotalHoursParent } from "@/lib/programme/totalHoursRollup";
import {
  updateNodeInTree,
  addNodeToTree,
  addScopeToRoot,
  deleteNodeFromTree,
  findNodeInTree,
  flattenVisibleNodes,
  cloneNodesWithNewIds,
  insertNodesAfter,
} from "./treeUtils";
import { MiniCalendar } from "./MiniCalendar";
import { ProgrammeRow } from "./ProgrammeRow";
import { NodeContextMenu } from "./NodeContextMenu";
import { AddNodeModal } from "./AddNodeModal";
import { CsvImportModal } from "./CsvImportModal";
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
import type { EngineerPoolEntry } from "@/types/engineer-pool";
import { ProgrammeTableHeader } from "./ProgrammeTableHeader";
import { PROGRAMME_SORT_COLUMN_MAP, type ProgrammeSortColumn } from "./programmeTableSort";
import {
  collectProgrammeNodeIds,
  readCollapsedNodeIds,
  writeCollapsedNodeIds,
} from "@/lib/programme/programmeCollapsedStorage";
import { useRowSelection } from "./useRowSelection";
import { useProgrammeClipboard } from "./useProgrammeClipboard";
import type { ProgrammeTsvHelpers } from "./programmeColumns";
import type { ForecastHoursByScopeRecord } from "@/types/forecast-scope";

export type ProgrammeTabProps = {
  projectId: string;
  initialTree: ProgrammeNode[];
  initialEngineerPool: EngineerPoolEntry[];
  /** Sums from `forecast_entries` for programme scope rows (read-only). */
  forecastHoursByScope: ForecastHoursByScopeRecord;
  /** Remote load failed (Supabase error, missing env, etc.) */
  loadError: string | null;
  saveProgramme: (tree: ProgrammeNode[]) => Promise<{ ok: true } | { ok: false; error: string }>;
  onTreeChange?: (tree: ProgrammeNode[]) => void;
  activityFilterIds?: ReadonlySet<string> | null;
};

export function ProgrammeTab({
  projectId,
  initialTree,
  initialEngineerPool,
  forecastHoursByScope,
  loadError: initialLoadError,
  saveProgramme,
  onTreeChange,
  activityFilterIds,
}: ProgrammeTabProps) {
  const histRef = useRef<{ stack: ProgrammeNode[][]; idx: number }>({
    stack: [applyProgrammeRollups(initialTree)],
    idx: 0,
  });
  const [present, setPresent] = useState<ProgrammeNode[]>(() => applyProgrammeRollups(initialTree));
  const engineerPool = initialEngineerPool;
  const [saveError, setSaveError] = useState<string | null>(null);

  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [addForm, setAddForm] = useState<AddFormState | null>(null);
  const [formValues, setFormValues] = useState<FormValues>(defaultForm);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [calendar, setCalendar] = useState<CalendarState | null>(null);
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  const [engPopup, setEngPopup] = useState<{
    scopeId: string;
    rect: { top: number; left: number; width: number; height: number };
  } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [activityQuery, setActivityQuery] = useState<ActivityQueryState>(DEFAULT_ACTIVITY_QUERY);
  const [openFilter, setOpenFilter] = useState<{
    column: "status";
    rect: DOMRect;
  } | null>(null);
  const engAnchorRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLDivElement | null>(null);
  const programmeScrollRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollToNodeIdRef = useRef<string | null>(null);
  const didHydrateCollapsedFromSessionRef = useRef(false);

  const treeNodeIds = useMemo(() => collectProgrammeNodeIds(present), [present]);

  useLayoutEffect(() => {
    if (didHydrateCollapsedFromSessionRef.current) return;
    didHydrateCollapsedFromSessionRef.current = true;
    const fromStorage = readCollapsedNodeIds(projectId);
    const ids = collectProgrammeNodeIds(present);
    const next = new Set([...fromStorage].filter((id) => ids.has(id)));
    queueMicrotask(() => setCollapsed(next));
  }, [projectId, present]);

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
      const rolled = applyProgrammeRollups(next);
      const h = histRef.current;
      h.stack = h.stack.slice(0, h.idx + 1);
      h.stack.push(rolled);
      h.idx = h.stack.length - 1;
      setPresent(rolled);
      onTreeChange?.(rolled);
      void persist(rolled);
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

  // ─── Row selection ──────────────────────────────────────────────────────────
  const getFlatNodes = useCallback(
    () => flattenVisibleNodes(present, collapsed),
    [present, collapsed]
  );

  const selection = useRowSelection(getFlatNodes);

  const clipboardTsvHelpers = useMemo<ProgrammeTsvHelpers>(
    () => ({ forecastHoursByScope, engineerPool }),
    [forecastHoursByScope, engineerPool]
  );

  // ─── Clipboard ──────────────────────────────────────────────────────────────
  const clipboard = useProgrammeClipboard(
    present,
    selection.selectedIds,
    commit,
    clipboardTsvHelpers
  );

  // ─── Deselect on click outside ───────────────────────────────────────────────
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (tableRef.current && !tableRef.current.contains(e.target as Node)) {
        selection.clearSelection();
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [selection]);

  useLayoutEffect(() => {
    const id = pendingScrollToNodeIdRef.current;
    if (!id) return;
    pendingScrollToNodeIdRef.current = null;
    const el = programmeScrollRef.current?.querySelector(
      `[data-programme-node-id="${CSS.escape(id)}"]`
    );
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [present]);

  // ─── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === "z") {
        e.preventDefault();
        undo();
        return;
      }
      if (ctrl && e.key === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (ctrl && e.key === "c") {
        e.preventDefault();
        void clipboard.copy();
        return;
      }
      if (ctrl && e.key === "v") {
        e.preventDefault();
        clipboard.paste();
        return;
      }
      if (e.key === "Escape") {
        selection.clearSelection();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, clipboard, selection]);

  const saveField = (nodeId: string, field: keyof ProgrammeNode, raw: string) => {
    if (field === "status") {
      const node = findNodeInTree(present, nodeId);
      if (node && node.type !== "activity") return;
    }
    if (field === "totalHours") {
      const node = findNodeInTree(present, nodeId);
      if (node && isRollupTotalHoursParent(node)) return;
    }
    let value: number | string | null | undefined = raw;
    if (field === "activityId") {
      const trimmed = raw.trim();
      value = trimmed === "" ? undefined : trimmed;
      commit(updateNodeInTree(present, nodeId, "activityId", value as ProgrammeNode["activityId"]));
      return;
    }
    if (field === "totalHours") {
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

  const toggleCollapse = useCallback(
    (id: string) => {
      setCollapsed((prev) => {
        const s = new Set(prev);
        if (s.has(id)) s.delete(id);
        else s.add(id);
        const pruned = new Set([...s].filter((nid) => treeNodeIds.has(nid)));
        writeCollapsedNodeIds(projectId, pruned);
        return pruned;
      });
    },
    [projectId, treeNodeIds]
  );

  const handleAdd = () => {
    if (!addForm || !formValues.name.trim()) return;
    const newNode: ProgrammeNode = {
      id: crypto.randomUUID(),
      ...(addForm.type === "scope" ? {} : { activityId: formValues.activityId || undefined }),
      name: formValues.name.trim(),
      type: addForm.type,
      totalHours:
        addForm.type === "scope"
          ? null
          : formValues.totalHours
            ? Number(formValues.totalHours)
            : null,
      start: formValues.start,
      finish: formValues.finish,
      status: addForm.type === "scope" ? "" : formValues.status,
      children: [],
      ...(addForm.type === "scope"
        ? { engineers: [] as NonNullable<ProgrammeNode["engineers"]> }
        : {}),
    };
    if (addForm.type === "scope") {
      pendingScrollToNodeIdRef.current = newNode.id;
      commit(addScopeToRoot(present, newNode));
    } else if (addForm.parentId != null) {
      commit(addNodeToTree(present, addForm.parentId, newNode));
    }
    setAddForm(null);
    setFormValues(defaultForm);
  };

  function handleImportConfirm(importedTree: ProgrammeNode[]) {
    commit(importedTree);
    setShowImportModal(false);
  }

  const openAddScopeModal = () => {
    setCtxMenu(null);
    setEditingCell(null);
    setCalendar(null);
    setEngPopup(null);
    setAddForm({ parentId: null, type: "scope" });
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
    // If the right-clicked row isn't part of the current selection, select only it
    if (!selection.selectedIds.has(node.id)) {
      selection.clearSelection();
      selection.onRowMouseDown(node.id, e as React.MouseEvent);
    }
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
    selectedIds: selection.selectedIds,
    onRowMouseDown: (id: string, e: React.MouseEvent) => {
      if (editingCell) {
        commitEdit();
        return;
      }
      selection.onRowMouseDown(id, e);
    },
    onRowMouseEnter: selection.onRowMouseEnter,
    copiedIds: clipboard.copiedIds,
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

  const engPopupForecastByEngineer = useMemo(() => {
    if (!engPopup) return [];
    return forecastHoursByScope[engPopup.scopeId] ?? [];
  }, [engPopup, forecastHoursByScope]);

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
    <div
      ref={tableRef}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      onMouseUp={selection.onMouseUp}
    >
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

      <div ref={programmeScrollRef} className="relative min-h-0 flex-1 overflow-y-auto">
        <ProgrammeTableHeader
          sort={activityQuery.sort}
          statusFilterActive={Boolean(activityQuery.statuses)}
          onSort={toggleSort}
          onStatusFilterClick={(e) => openFilterFor("status", e)}
          onAddScope={openAddScopeModal}
          onImportCsv={() => setShowImportModal(true)}
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
              forecastHoursByScope={forecastHoursByScope}
              {...rowProps}
              collapsed={collapsed}
              engPopupScopeId={engPopup?.scopeId ?? null}
              engineerAnchorRef={engAnchorRef}
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
            setFormValues({
              ...defaultForm,
              activityId:
                form.type === "activity" ? nextActivityIdFromTree(present) : defaultForm.activityId,
            });
          }}
          onDelete={(nodeId) => {
            commit(deleteNodeFromTree(present, nodeId));
          }}
          onCopy={() => void clipboard.copy()}
          onPaste={() => clipboard.paste(ctxMenu.nodeId)}
          onDuplicate={() => {
            const nodes = [...selection.selectedIds]
              .map((id) => findNodeInTree(present, id))
              .filter((n): n is ProgrammeNode => n !== null);
            if (nodes.length === 0) return;
            const cloned = cloneNodesWithNewIds(nodes);
            commit(insertNodesAfter(present, ctxMenu.nodeId, cloned));
          }}
          hasSelection={selection.selectedIds.size > 0}
          hasStash={clipboard.hasStash}
        />
      )}

      {engPopup && engPopupScopeNode && (
        <EngineerPopup
          key={engPopup.scopeId}
          engineers={engPopupScopeNode.engineers ?? []}
          engineerPool={engineerPool}
          forecastByEngineer={engPopupForecastByEngineer}
          rect={engPopup.rect}
          anchorRef={engAnchorRef}
          onChangeEngineers={(engs) => updateScopeEngineers(engPopup.scopeId, engs)}
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
          onClose={() => {
            setAddForm(null);
            setFormValues(defaultForm);
          }}
        />
      )}

      {showImportModal && (
        <CsvImportModal
          tree={present}
          onConfirm={handleImportConfirm}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </div>
  );
}
