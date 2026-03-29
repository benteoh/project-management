"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ChevronRight, ChevronDown, ChevronLeft, Plus, X, Trash2 } from "lucide-react";

type NodeType = "scope" | "task" | "subtask" | "activity";

interface EngineerAllocation {
  code: string;
  isLead: boolean;
  plannedHrs: number | null;
  forecastHrs: number | null;
}

interface ProgrammeNode {
  id: string;
  activityId?: string;
  name: string;
  type: NodeType;
  totalHours: number | null;
  start: string;
  finish: string;
  forecastTotalHours: number | null;
  status: string;
  children: ProgrammeNode[];
  engineers?: EngineerAllocation[];
}

const e = (code: string, isLead = false): EngineerAllocation => ({ code, isLead, plannedHrs: null, forecastHrs: null });

const initialData: ProgrammeNode[] = [];

// ── Hrs helpers ─────────────────────────────────────────────────────────────
function fmtHrs(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return parseFloat(v.toFixed(2)).toString();
}
function validateHrsInput(s: string): boolean {
  return s === "" || /^\d*\.?\d{0,2}$/.test(s);
}
function getScopeNum(scopeName: string): string {
  const m = scopeName.match(/^(\d+)\./);
  return m ? m[1] : "";
}

// ── Engineer pool ────────────────────────────────────────────────────────────
const DEFAULT_ENGINEER_POOL: string[] = []

// ── Date helpers ────────────────────────────────────────────────────────────
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_NAMES   = ["Mo","Tu","We","Th","Fr","Sa","Su"];

function parseProgrammeDate(str: string): Date | null {
  if (!str) return null;
  const parts = str.split("-");
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const mi  = MONTH_NAMES.findIndex(m => m.toLowerCase() === parts[1].toLowerCase());
  if (mi === -1 || isNaN(day)) return null;
  const yr  = parseInt(parts[2], 10);
  return new Date(yr < 100 ? 2000 + yr : yr, mi, day);
}

function formatProgrammeDate(d: Date): string {
  return `${String(d.getDate()).padStart(2,"0")}-${MONTH_NAMES[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
}

// ── Mini Calendar ────────────────────────────────────────────────────────────
interface CalendarState {
  nodeId: string;
  field: "start" | "finish";
  value: string;
  rect: { top: number; left: number; width: number; height: number };
}

function MiniCalendar({ value, anchorRect, onChange, onClose }: {
  value: string;
  anchorRect: { top: number; left: number; width: number; height: number };
  onChange: (v: string) => void;
  onClose: () => void;
}) {
  const parsed = parseProgrammeDate(value);
  const [view, setView] = useState<Date>(parsed ?? new Date(2026, 0, 1));
  const year  = view.getFullYear();
  const month = view.getMonth();

  const firstDow = (() => { const d = new Date(year, month, 1).getDay() - 1; return d < 0 ? 6 : d; })();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <>
      <div className="fixed inset-0 z-[99]" onClick={onClose} />
      <div
        className="fixed z-[100] w-56 rounded-lg border border-zinc-200 bg-white p-3 shadow-xl"
        style={{ top: anchorRect.top + anchorRect.height + 4, left: anchorRect.left }}
        onClick={e => e.stopPropagation()}
      >
        {/* Month nav */}
        <div className="mb-2.5 flex items-center justify-between">
          <button
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100"
            onClick={() => setView(new Date(year, month - 1, 1))}
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-semibold text-zinc-700">{MONTH_NAMES[month]} {year}</span>
          <button
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100"
            onClick={() => setView(new Date(year, month + 1, 1))}
          >
            <ChevronRight size={14} />
          </button>
        </div>
        {/* Day-of-week headers */}
        <div className="mb-1 grid grid-cols-7">
          {DAY_NAMES.map(d => (
            <div key={d} className="py-0.5 text-center text-[10px] font-medium text-zinc-400">{d}</div>
          ))}
        </div>
        {/* Day grid */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const isSelected = parsed &&
              parsed.getFullYear() === year &&
              parsed.getMonth()    === month &&
              parsed.getDate()     === day;
            return (
              <div key={i} className="flex justify-center">
                <button
                  className={`h-7 w-7 rounded-full text-xs transition-colors ${
                    isSelected
                      ? "bg-zinc-900 font-semibold text-white"
                      : "text-zinc-700 hover:bg-zinc-100"
                  }`}
                  onClick={() => { onChange(formatProgrammeDate(new Date(year, month, day))); onClose(); }}
                >
                  {day}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── Modal date picker ────────────────────────────────────────────────────────
function ModalDateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleClick = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    setOpen(true);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleClick}
        className="w-full rounded border border-zinc-200 px-2 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-zinc-400"
      >
        {value || <span className="text-zinc-400">Pick date</span>}
      </button>
      {open && rect && (
        <MiniCalendar
          value={value}
          anchorRect={rect}
          onChange={v => { onChange(v); setOpen(false); }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === "Completed")
    return <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700">Completed</span>;
  if (status === "In Progress")
    return <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">In Progress</span>;
  if (status === "Not Started")
    return <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-500">Not Started</span>;
  return null;
}

// ── Engineer chip (inline beside scope name) ──────────────────────────────────
function EngineerChip({ engineers, onClick }: {
  engineers: EngineerAllocation[];
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
}) {
  if (engineers.length === 0) {
    return (
      <div
        className="ml-2 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded border border-dashed border-zinc-400 text-zinc-400 hover:border-zinc-600 hover:text-zinc-600"
        onClick={onClick}
        title="Click to assign engineers"
      >
        <Plus size={10} strokeWidth={2.5} />
      </div>
    );
  }
  return (
    <div
      className="ml-2 flex shrink-0 cursor-pointer items-center gap-0.5 rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-xs hover:border-zinc-400"
      onClick={onClick}
      title="Click to edit engineer allocation"
    >
      {engineers.map((eng, i) => (
        <span key={i}>
          {i > 0 && <span className="mx-0.5 text-zinc-300">,</span>}
          <span className={eng.isLead ? "font-bold text-zinc-800" : "text-zinc-500"}>{eng.code}</span>
        </span>
      ))}
    </div>
  );
}

// ── Engineer popup ────────────────────────────────────────────────────────────
// pinned=true  → opened by clicking +, stays open, has Cancel/Add buttons
// pinned=false → opened by hovering filled chip, closes on mouse-leave
function EngineerPopup({ engineers, totalHours, forecastHours, engineerPool, rect, pinned, onChangeEngineers, onAddToPool, onClose }: {
  engineers: EngineerAllocation[];
  totalHours: number | null;
  forecastHours: number | null;
  engineerPool: string[];
  rect: { top: number; left: number; width: number; height: number };
  pinned: boolean;
  onChangeEngineers: (engs: EngineerAllocation[]) => void;
  onAddToPool: (code: string) => void;
  onClose: () => void;
}) {
  const [draft,        setDraft]        = useState<EngineerAllocation[]>(engineers);
  const [showAddInput, setShowAddInput] = useState(false);
  const [newCode,      setNewCode]      = useState("");
  const [shake,        setShake]        = useState(false);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  // keep draft in sync when hover popup updates live
  useEffect(() => { if (!pinned) setDraft(engineers); }, [engineers, pinned]);

  const count = draft.length || 1;
  const autoPlanned  = totalHours    != null ? parseFloat((totalHours    / count).toFixed(2)) : null;
  const autoForecast = forecastHours != null ? parseFloat((forecastHours / count).toFixed(2)) : null;

  const changeCode = (idx: number, code: string) =>
    setDraft(prev => prev.map((eng, i) => i === idx ? { ...eng, code } : eng));

  const remove = (idx: number) => setDraft(prev => prev.filter((_, i) => i !== idx));

  const addRow = () =>
    setDraft(prev => [...prev, { code: engineerPool[0] ?? "SSi", isLead: false, plannedHrs: null, forecastHrs: null }]);

  const commitNewCode = () => {
    const code = newCode.trim();
    if (!code) return;
    onAddToPool(code);
    setNewCode("");
    setShowAddInput(false);
  };

  const handleAdd = () => { onChangeEngineers(draft); onClose(); };

  const top  = rect.top + rect.height + 6;
  const left = Math.min(rect.left, window.innerWidth - 360);

  return (
    <>
      {pinned && <div className="fixed inset-0 z-[118]" onClick={triggerShake} />}
      <div
        className="fixed z-[119] w-80 rounded-lg border border-zinc-200 bg-white shadow-xl"
        style={{ top, left }}
      >
        <div className="p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Engineer Allocation</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-100 text-zinc-400">
                <th className="pb-1.5 text-left font-medium">Engineer</th>
                <th className="pb-1.5 pr-2 text-right font-medium">Planned Hrs</th>
                <th className="pb-1.5 pr-2 text-right font-medium">Forecast Hrs</th>
                <th className="pb-1.5 w-5" />
              </tr>
            </thead>
            <tbody>
              {draft.map((eng, idx) => (
                <tr key={idx} className="border-b border-zinc-50 last:border-0">
                  <td className="py-1.5 pr-2">
                    <select
                      className="w-full rounded border border-zinc-200 px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-400"
                      value={eng.code}
                      onChange={e => {
                        if (e.target.value === "__add__") { e.currentTarget.value = eng.code; setShowAddInput(true); }
                        else { changeCode(idx, e.target.value); if (!pinned) onChangeEngineers(draft.map((en, i) => i === idx ? { ...en, code: e.target.value } : en)); }
                      }}
                    >
                      {engineerPool.map(code => <option key={code} value={code}>{code}</option>)}
                      {!engineerPool.includes(eng.code) && <option value={eng.code}>{eng.code}</option>}
                      <option value="__add__">＋ Add new code...</option>
                    </select>
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-zinc-600">{autoPlanned ?? "—"}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-zinc-600">{autoForecast ?? "—"}</td>
                  <td className="py-1.5">
                    <button onClick={() => { remove(idx); if (!pinned) onChangeEngineers(draft.filter((_, i) => i !== idx)); }} className="text-zinc-300 hover:text-red-500 transition-colors"><X size={11} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button onClick={addRow} className="mt-2 flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700">
            <Plus size={11} /> Add engineer
          </button>

          {showAddInput && (
            <div className="mt-2 flex items-center gap-1.5 border-t border-zinc-100 pt-2">
              <input autoFocus
                className="flex-1 rounded border border-zinc-200 px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-400"
                placeholder="New code e.g. JDo"
                value={newCode}
                onChange={e => setNewCode(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") commitNewCode(); if (e.key === "Escape") { setShowAddInput(false); setNewCode(""); } }}
              />
              <button onClick={commitNewCode} className="rounded bg-zinc-900 px-2 py-0.5 text-xs text-white hover:bg-zinc-700">Add</button>
              <button onClick={() => { setShowAddInput(false); setNewCode(""); }} className="text-zinc-400 hover:text-zinc-600"><X size={11} /></button>
            </div>
          )}
        </div>

        {/* Footer buttons — only in pinned mode */}
        {pinned && (
          <div className={`flex justify-end gap-2 border-t border-zinc-100 px-3 py-2.5${shake ? " animate-shake" : ""}`}>
            <button onClick={onClose} className="rounded px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-700">Cancel</button>
            <button onClick={handleAdd} className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700">Update</button>
          </div>
        )}
      </div>
    </>
  );
}

// ── Tree helpers ─────────────────────────────────────────────────────────────
type AddOptions = { label: string; type: NodeType }[];

function getAddOptions(nodeType: NodeType): AddOptions {
  if (nodeType === "scope")   return [{ label: "Add Task", type: "task" }, { label: "Add Activity", type: "activity" }];
  if (nodeType === "task")    return [{ label: "Add Subtask", type: "subtask" }, { label: "Add Activity", type: "activity" }];
  if (nodeType === "subtask") return [{ label: "Add Activity", type: "activity" }];
  return [];
}

function updateNodeInTree(
  nodes: ProgrammeNode[],
  nodeId: string,
  field: keyof ProgrammeNode,
  value: ProgrammeNode[keyof ProgrammeNode],
): ProgrammeNode[] {
  return nodes.map(n => {
    if (n.id === nodeId) return { ...n, [field]: value };
    return { ...n, children: updateNodeInTree(n.children, nodeId, field, value) };
  });
}

function addNodeToTree(nodes: ProgrammeNode[], parentId: string, newNode: ProgrammeNode): ProgrammeNode[] {
  return nodes.map(n => {
    if (n.id === parentId) return { ...n, children: [...n.children, newNode] };
    return { ...n, children: addNodeToTree(n.children, parentId, newNode) };
  });
}

function deleteNodeFromTree(nodes: ProgrammeNode[], nodeId: string): ProgrammeNode[] {
  return nodes
    .filter(n => n.id !== nodeId)
    .map(n => ({ ...n, children: deleteNodeFromTree(n.children, nodeId) }));
}

// ── Add-form types ────────────────────────────────────────────────────────────
interface AddFormState { parentId: string; type: NodeType; }
interface FormValues {
  name: string; activityId: string; totalHours: string;
  start: string; finish: string; forecastTotalHours: string; status: string;
}
const defaultForm: FormValues = {
  name: "", activityId: "", totalHours: "", start: "", finish: "", forecastTotalHours: "", status: "Not Started",
};

// ── Editing types ─────────────────────────────────────────────────────────────
type EditableField = "name" | "totalHours" | "forecastTotalHours" | "status";
interface EditingCell { nodeId: string; field: EditableField; value: string; }
interface ContextMenuState { nodeId: string; nodeType: NodeType; x: number; y: number; }

// ── Main component ────────────────────────────────────────────────────────────
export function ProgrammeTab() {
  // Undo / redo via a ref-backed stack so keyboard handlers never go stale
  const histRef = useRef<{ stack: ProgrammeNode[][]; idx: number }>({
    stack: [initialData],
    idx: 0,
  });
  const [present, setPresent] = useState<ProgrammeNode[]>(initialData);

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

  const [collapsed,     setCollapsed]     = useState<Set<string>>(new Set());
  const [addForm,       setAddForm]       = useState<AddFormState | null>(null);
  const [formValues,    setFormValues]    = useState<FormValues>(defaultForm);
  const [editingCell,   setEditingCell]   = useState<EditingCell | null>(null);
  const [calendar,      setCalendar]      = useState<CalendarState | null>(null);
  const [ctxMenu,       setCtxMenu]       = useState<ContextMenuState | null>(null);
  const [engineerPool,  setEngineerPool]  = useState<string[]>(DEFAULT_ENGINEER_POOL);
  const [engPopup,      setEngPopup]      = useState<{ scopeId: string; rect: { top: number; left: number; width: number; height: number }; pinned: boolean } | null>(null);

  const saveField = (nodeId: string, field: keyof ProgrammeNode, raw: string) => {
    let value: number | string | null = raw;
    if (field === "totalHours" || field === "forecastTotalHours") {
      if (raw === "") value = null;
      else { const n = parseFloat(raw); value = isNaN(n) ? null : Math.round(n * 100) / 100; }
    }
    commit(updateNodeInTree(present, nodeId, field, value as ProgrammeNode[keyof ProgrammeNode]));
  };

  const commitEdit = () => {
    if (!editingCell) return;
    saveField(editingCell.nodeId, editingCell.field as keyof ProgrammeNode, editingCell.value);
    setEditingCell(null);
  };

  const toggleCollapse = (id: string) =>
    setCollapsed(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const handleAdd = () => {
    if (!addForm || !formValues.name.trim()) return;
    const newNode: ProgrammeNode = {
      id: `user-${Date.now()}`,
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

  const handleDelete = (nodeId: string) => {
    commit(deleteNodeFromTree(present, nodeId));
    setCtxMenu(null);
  };

  const isEditing = (nodeId: string, field: EditableField) =>
    editingCell?.nodeId === nodeId && editingCell?.field === field;

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

  const openEngPinned = (scopeId: string, e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setEngPopup({ scopeId, rect: { top: r.top, left: r.left, width: r.width, height: r.height }, pinned: true });
  };

  const updateScopeEngineers = (scopeId: string, engineers: EngineerAllocation[]) => {
    commit(updateNodeInTree(present, scopeId, "engineers", engineers as unknown as ProgrammeNode[keyof ProgrammeNode]));
  };

  const addToPool = (code: string) => {
    setEngineerPool(prev => [...prev, code].sort());
  };

  const renderNode = (node: ProgrammeNode, depth: number, prefix?: string): React.ReactNode => {
    const isCollapsed = collapsed.has(node.id);
    const hasChildren = node.children.length > 0;
    const rowBg   = node.type === "scope" ? "bg-red-100" : node.type === "task" ? "bg-zinc-100" : node.type === "subtask" ? "bg-zinc-50" : "bg-white";
    const textCls = node.type === "scope" ? "font-semibold text-red-900" : node.type === "task" || node.type === "subtask" ? "font-medium text-zinc-800" : "text-zinc-700";
    const hover   = "cursor-pointer rounded px-0.5 py-0.5 hover:bg-black/[.06]";

    // compute children prefixes
    let taskCount = 0, subtaskCount = 0;
    const scopeNum = node.type === "scope" ? getScopeNum(node.name) : "";

    return (
      <div key={node.id}>
        <div
          className={`flex items-center border-b border-zinc-100 text-sm ${rowBg} select-none`}
          onContextMenu={e => openCtxMenu(node, e)}
        >
          {/* Name */}
          <div className={`flex min-w-[260px] flex-1 items-center gap-1 py-1.5 pr-3 ${textCls}`} style={{ paddingLeft: `${12 + depth * 20}px` }}>
            {hasChildren
              ? <button onClick={() => toggleCollapse(node.id)} className="shrink-0 mr-0.5 text-zinc-400 hover:text-zinc-600">{isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}</button>
              : <span className="w-4 shrink-0" />}
            {node.activityId && <span className="shrink-0 font-mono text-xs text-zinc-400 mr-1">{node.activityId}</span>}
            {(node.type === "task" || node.type === "subtask") && prefix && (
              <span className="shrink-0 font-mono text-xs text-zinc-400 mr-1 select-none">{prefix}</span>
            )}
            {isEditing(node.id, "name") ? (
              <input autoFocus
                className="flex-1 min-w-0 rounded border border-blue-400 bg-white px-1.5 py-0.5 text-sm text-zinc-800 outline-none ring-1 ring-blue-200"
                value={editingCell!.value}
                onChange={e => setEditingCell(p => p ? { ...p, value: e.target.value } : p)}
                onBlur={commitEdit}
                onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingCell(null); }}
              />
            ) : (
              <span className={`truncate ${hover}`} onClick={() => startEdit(node.id, "name", node.name)} title="Click to edit · Right-click for options">
                {node.name}
              </span>
            )}
            {node.type === "scope" && (
              <EngineerChip
                engineers={node.engineers ?? []}
                onClick={e => openEngPinned(node.id, e)}
              />
            )}
          </div>

          {/* Planned Hrs */}
          <div className="w-24 shrink-0 px-2 py-1.5 text-right text-zinc-600 tabular-nums">
            {isEditing(node.id, "totalHours") ? (
              <input autoFocus inputMode="decimal"
                className="w-full rounded border border-blue-400 bg-white px-1.5 py-0.5 text-sm text-right outline-none ring-1 ring-blue-200"
                value={editingCell!.value}
                onChange={e => { if (validateHrsInput(e.target.value)) setEditingCell(p => p ? { ...p, value: e.target.value } : p); }}
                onBlur={commitEdit}
                onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingCell(null); }}
              />
            ) : (
              <span className={hover} onClick={() => startEdit(node.id, "totalHours", fmtHrs(node.totalHours) === "—" ? "" : fmtHrs(node.totalHours))}>
                {fmtHrs(node.totalHours)}
              </span>
            )}
          </div>

          {/* Start */}
          <div className="w-28 shrink-0 px-2 py-1.5">
            <span className={`inline-block font-mono text-xs text-zinc-500 ${hover}`} onClick={e => openCal(node.id, "start", node.start, e)} title="Click to pick date">
              {node.start || "—"}
            </span>
          </div>

          {/* Finish */}
          <div className="w-28 shrink-0 px-2 py-1.5">
            <span className={`inline-block font-mono text-xs text-zinc-500 ${hover}`} onClick={e => openCal(node.id, "finish", node.finish, e)} title="Click to pick date">
              {node.finish || "—"}
            </span>
          </div>

          {/* Forecast Hrs */}
          <div className="w-28 shrink-0 px-2 py-1.5 text-right text-zinc-600 tabular-nums">
            {isEditing(node.id, "forecastTotalHours") ? (
              <input autoFocus inputMode="decimal"
                className="w-full rounded border border-blue-400 bg-white px-1.5 py-0.5 text-sm text-right outline-none ring-1 ring-blue-200"
                value={editingCell!.value}
                onChange={e => { if (validateHrsInput(e.target.value)) setEditingCell(p => p ? { ...p, value: e.target.value } : p); }}
                onBlur={commitEdit}
                onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingCell(null); }}
              />
            ) : (
              <span className={hover} onClick={() => startEdit(node.id, "forecastTotalHours", fmtHrs(node.forecastTotalHours) === "—" ? "" : fmtHrs(node.forecastTotalHours))}>
                {fmtHrs(node.forecastTotalHours)}
              </span>
            )}
          </div>

          {/* Status */}
          <div className="w-28 shrink-0 px-2 py-1.5">
            {isEditing(node.id, "status") ? (
              <select autoFocus
                className="w-full rounded border border-blue-400 bg-white px-1 py-0.5 text-xs outline-none ring-1 ring-blue-200"
                value={editingCell!.value}
                onChange={e => { saveField(node.id, "status", e.target.value); setEditingCell(null); }}
                onBlur={() => setEditingCell(null)}
              >
                <option>Not Started</option>
                <option>In Progress</option>
                <option>Completed</option>
              </select>
            ) : node.status ? (
              <span
                className={`inline-block rounded ${node.type === "activity" ? "cursor-pointer hover:opacity-80" : ""}`}
                onClick={() => node.type === "activity" && startEdit(node.id, "status", node.status)}
                title={node.type === "activity" ? "Click to change status" : undefined}
              >
                <StatusBadge status={node.status} />
              </span>
            ) : null}
          </div>
        </div>
        {!isCollapsed && node.children.map(child => {
          let childPrefix: string | undefined;
          if (child.type === "task") {
            taskCount++;
            if (scopeNum) childPrefix = `${scopeNum}.${taskCount}`;
          } else if (child.type === "subtask") {
            subtaskCount++;
            if (prefix) childPrefix = `${prefix}.${subtaskCount}`;
          }
          return renderNode(child, depth + 1, childPrefix);
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Scrollable table area */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[900px]">
          {/* Sticky header */}
          <div className="sticky top-0 z-10 flex items-center border-b-2 border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-400">
            <div className="flex-1 min-w-[260px] px-3 py-2.5">Activity Name</div>
            <div className="w-24 shrink-0 px-3 py-2.5 text-right">Planned Hrs</div>
            <div className="w-28 shrink-0 px-3 py-2.5">Start</div>
            <div className="w-28 shrink-0 px-3 py-2.5">Finish</div>
            <div className="w-28 shrink-0 px-3 py-2.5 text-right">Forecast Hrs</div>
            <div className="w-28 shrink-0 px-3 py-2.5">Status</div>
          </div>
          {/* Rows */}
          {present.map(node => renderNode(node, 0))}
        </div>
      </div>

      {/* Right-click context menu */}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-[99]" onClick={() => setCtxMenu(null)} onContextMenu={e => { e.preventDefault(); setCtxMenu(null); }} />
          <div
            className="fixed z-[100] min-w-[160px] overflow-hidden rounded-md border border-zinc-200 bg-white py-1 shadow-xl text-sm"
            style={{ top: ctxMenu.y, left: ctxMenu.x }}
          >
            {getAddOptions(ctxMenu.nodeType).map(opt => (
              <button
                key={opt.type}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-zinc-700 hover:bg-zinc-50"
                onClick={() => { setCtxMenu(null); setAddForm({ parentId: ctxMenu.nodeId, type: opt.type }); setFormValues(defaultForm); }}
              >
                <Plus size={12} className="shrink-0 text-zinc-400" />
                {opt.label}
              </button>
            ))}
            {getAddOptions(ctxMenu.nodeType).length > 0 && <div className="my-1 border-t border-zinc-100" />}
            <button
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-red-600 hover:bg-red-50"
              onClick={() => handleDelete(ctxMenu.nodeId)}
            >
              <Trash2 size={12} className="shrink-0" />
              Delete {ctxMenu.nodeType}
            </button>
          </div>
        </>
      )}

      {/* Engineer allocation popup */}
      {engPopup && (() => {
        const scopeNode = (function find(nodes: ProgrammeNode[]): ProgrammeNode | null {
          for (const n of nodes) {
            if (n.id === engPopup.scopeId) return n;
            const found = find(n.children);
            if (found) return found;
          }
          return null;
        })(present);
        if (!scopeNode) return null;
        return (
          <EngineerPopup
            engineers={scopeNode.engineers ?? []}
            totalHours={scopeNode.totalHours}
            forecastHours={scopeNode.forecastTotalHours}
            engineerPool={engineerPool}
            rect={engPopup.rect}
            pinned={engPopup.pinned}
            onChangeEngineers={engs => updateScopeEngineers(engPopup.scopeId, engs)}
            onAddToPool={addToPool}
            onClose={() => setEngPopup(null)}
          />
        );
      })()}

      {/* Mini calendar */}
      {calendar && (
        <MiniCalendar
          value={calendar.value}
          anchorRect={calendar.rect}
          onChange={v => { saveField(calendar.nodeId, calendar.field, v); setCalendar(null); }}
          onClose={() => setCalendar(null)}
        />
      )}

      {/* Add modal */}
      {addForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25">
          <div className="w-96 rounded-lg border border-zinc-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-800 capitalize">Add {addForm.type}</h3>
              <button onClick={() => setAddForm(null)} className="text-zinc-400 hover:text-zinc-600"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              {addForm.type === "activity" && (
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Activity ID</label>
                  <input className="w-full rounded border border-zinc-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400" value={formValues.activityId} onChange={e => setFormValues(p => ({ ...p, activityId: e.target.value }))} placeholder="e.g. A5000" />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Name *</label>
                <input autoFocus className="w-full rounded border border-zinc-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400" value={formValues.name} onChange={e => setFormValues(p => ({ ...p, name: e.target.value }))} placeholder="Enter name" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Start</label>
                  <ModalDateField value={formValues.start} onChange={v => setFormValues(p => ({ ...p, start: v }))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Finish</label>
                  <ModalDateField value={formValues.finish} onChange={v => setFormValues(p => ({ ...p, finish: v }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Planned Hours</label>
                  <input inputMode="decimal" className="w-full rounded border border-zinc-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400" value={formValues.totalHours} onChange={e => { if (validateHrsInput(e.target.value)) setFormValues(p => ({ ...p, totalHours: e.target.value })); }} placeholder="—" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Forecast Hours</label>
                  <input inputMode="decimal" className="w-full rounded border border-zinc-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400" value={formValues.forecastTotalHours} onChange={e => { if (validateHrsInput(e.target.value)) setFormValues(p => ({ ...p, forecastTotalHours: e.target.value })); }} placeholder="—" />
                </div>
              </div>
              {addForm.type === "activity" && (
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Status</label>
                  <select className="w-full rounded border border-zinc-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400" value={formValues.status} onChange={e => setFormValues(p => ({ ...p, status: e.target.value }))}>
                    <option>Not Started</option>
                    <option>In Progress</option>
                    <option>Completed</option>
                  </select>
                </div>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setAddForm(null)} className="rounded px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-700">Cancel</button>
              <button onClick={handleAdd} className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 disabled:opacity-40" disabled={!formValues.name.trim()}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
