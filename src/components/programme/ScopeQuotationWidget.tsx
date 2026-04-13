"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Receipt } from "lucide-react";

import { estimateScopeQuotationGbp } from "@/api/services/scopeQuotationEstimate";
import { cn, formatCurrency } from "@/lib/utils";
import type { EngineerPoolEntry } from "@/types/engineer-pool";

import type { ProgrammeNode } from "./types";

type Props = {
  scope: ProgrammeNode;
  engineerPool: EngineerPoolEntry[];
  onSave: (nodeId: string, quotedRaw: string, warningRaw: string) => void;
};

function parseMoneyRaw(raw: string): string {
  return raw.replace(/,/g, "").trim();
}

export function ScopeQuotationWidget({ scope, engineerPool, onSave }: Props) {
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editingRef = useRef(false);

  const [panelRect, setPanelRect] = useState<{
    top: number;
    left: number;
    maxWidth: number;
  } | null>(null);
  /** Panel visible (preview and/or edit). */
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [quotedDraft, setQuotedDraft] = useState("");
  const [warningDraft, setWarningDraft] = useState("");

  const { subtotalGbp, warnings } = estimateScopeQuotationGbp(scope, engineerPool);
  /** Missing rates etc. — estimate may be incomplete. */
  const estimateIncomplete = warnings.length > 0;
  const quoted = scope.quotedAmount;
  const ew = scope.quotationWarningAmount;
  const showingCommercial = quoted != null;

  const positionPanel = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pad = 8;
    const maxW = 320;
    let left = r.left;
    if (left + maxW > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - pad - maxW);
    }
    setPanelRect({
      top: r.bottom + 6,
      left,
      maxWidth: maxW,
    });
  }, []);

  const cancelTimers = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleShowPreview = useCallback(() => {
    cancelTimers();
    showTimerRef.current = setTimeout(() => {
      positionPanel();
      setOpen(true);
    }, 140);
  }, [cancelTimers, positionPanel]);

  const scheduleHide = useCallback(() => {
    cancelTimers();
    hideTimerRef.current = setTimeout(() => {
      if (!editingRef.current) {
        setOpen(false);
        setPanelRect(null);
      }
    }, 220);
  }, [cancelTimers]);

  const closePanel = useCallback(() => {
    editingRef.current = false;
    setEditing(false);
    setOpen(false);
    setPanelRect(null);
  }, []);

  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);

  useEffect(() => {
    if (!open || !editing) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closePanel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, editing, closePanel]);

  useEffect(() => {
    if (!open) return;
    function onScrollOrResize() {
      positionPanel();
    }
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, positionPanel]);

  function openEdit() {
    cancelTimers();
    editingRef.current = true;
    positionPanel();
    setQuotedDraft(scope.quotedAmount != null ? String(scope.quotedAmount) : "");
    setWarningDraft(
      scope.quotationWarningAmount != null ? String(scope.quotationWarningAmount) : ""
    );
    setEditing(true);
    setOpen(true);
  }

  function applyEdits() {
    onSave(scope.id, parseMoneyRaw(quotedDraft), parseMoneyRaw(warningDraft));
    closePanel();
  }

  const commercialTotalGbp = showingCommercial && quoted != null ? quoted + (ew ?? 0) : subtotalGbp;
  const compactLabel = formatCurrency(commercialTotalGbp);

  let chipTitle: string;
  if (!showingCommercial) {
    chipTitle = `Estimated ${formatCurrency(subtotalGbp)} — hover for details, click to edit`;
  } else if (quoted != null && ew != null && ew > 0) {
    chipTitle = `Quoted total ${formatCurrency(commercialTotalGbp)} (${formatCurrency(quoted)} + early warning ${formatCurrency(ew)}) — hover for details, click to edit`;
  } else if (quoted != null) {
    chipTitle = `Quoted ${formatCurrency(quoted)} — hover for details, click to edit`;
  } else {
    chipTitle = `Estimated ${formatCurrency(subtotalGbp)} — hover for details, click to edit`;
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "border-border bg-card text-muted-foreground hover:border-gold/60 hover:text-foreground shadow-card ml-1.5 inline-flex h-6 max-w-[min(13rem,100%)] shrink-0 items-center gap-0.5 rounded-md border px-1.5 text-xs font-medium tabular-nums transition-colors",
          estimateIncomplete && "border-status-warning/40 text-status-warning"
        )}
        title={chipTitle}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseEnter={() => {
          if (!editingRef.current) scheduleShowPreview();
        }}
        onMouseLeave={() => {
          if (!editingRef.current) scheduleHide();
        }}
        onClick={(e) => {
          e.stopPropagation();
          openEdit();
        }}
      >
        <Receipt className="size-3.5 shrink-0 opacity-70" strokeWidth={2} aria-hidden />
        <span className="min-w-0 flex-1 truncate">{compactLabel}</span>
        {estimateIncomplete ? (
          <AlertTriangle className="size-3 shrink-0" strokeWidth={2} aria-hidden />
        ) : null}
      </button>

      {open && panelRect != null && typeof document !== "undefined"
        ? createPortal(
            <div
              id={panelId}
              role={editing ? "dialog" : "tooltip"}
              aria-label="Scope quotation"
              className="border-border bg-card text-foreground shadow-elevated fixed z-50 rounded-lg border p-3 text-sm"
              style={{
                top: panelRect.top,
                left: panelRect.left,
                maxWidth: panelRect.maxWidth,
                width: panelRect.maxWidth,
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseEnter={cancelTimers}
              onMouseLeave={() => {
                if (!editingRef.current) scheduleHide();
              }}
            >
              {editing ? (
                <div className="space-y-3">
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Edit quotation
                  </p>
                  <dl className="space-y-1 text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground shrink-0">Estimated</dt>
                      <dd className="text-right font-medium tabular-nums">
                        {formatCurrency(subtotalGbp)}
                        {estimateIncomplete ? (
                          <span className="text-status-warning ml-1">(!)</span>
                        ) : null}
                      </dd>
                    </div>
                  </dl>
                  {estimateIncomplete ? (
                    <ul className="text-status-warning max-h-24 list-inside list-disc overflow-y-auto text-xs">
                      {warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  ) : null}
                  <label className="block">
                    <span className="text-muted-foreground text-xs">Quoted (£)</span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      className="border-border bg-background focus:ring-gold/40 mt-0.5 w-full rounded-md border px-2 py-1.5 text-sm tabular-nums ring-1 ring-transparent outline-none"
                      value={quotedDraft}
                      onChange={(e) => setQuotedDraft(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className="text-muted-foreground text-xs">Early warning (£)</span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      className="border-border bg-background focus:ring-gold/40 mt-0.5 w-full rounded-md border px-2 py-1.5 text-sm tabular-nums ring-1 ring-transparent outline-none"
                      value={warningDraft}
                      onChange={(e) => setWarningDraft(e.target.value)}
                    />
                  </label>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground text-xs font-medium"
                      onClick={closePanel}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="bg-gold text-foreground rounded-md px-3 py-1.5 text-xs font-medium"
                      onClick={applyEdits}
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Quotation
                  </p>
                  <dl className="space-y-1.5 text-xs">
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Estimated</dt>
                      <dd className="flex items-center gap-1 text-right font-medium tabular-nums">
                        {formatCurrency(subtotalGbp)}
                        {estimateIncomplete ? (
                          <AlertTriangle
                            className="text-status-warning size-3.5 shrink-0"
                            strokeWidth={2}
                            aria-hidden
                          />
                        ) : null}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Quoted</dt>
                      <dd className="text-right font-medium tabular-nums">
                        {scope.quotedAmount != null ? formatCurrency(scope.quotedAmount) : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Early warning</dt>
                      <dd className="text-right font-medium tabular-nums">
                        {scope.quotationWarningAmount != null
                          ? formatCurrency(scope.quotationWarningAmount)
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                  {estimateIncomplete ? (
                    <ul className="text-status-warning border-border max-h-28 list-inside list-disc overflow-y-auto border-t pt-2 text-xs">
                      {warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="text-muted-foreground border-border border-t pt-2 text-xs">
                    Click the button to edit quoted amounts.
                  </p>
                </div>
              )}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
