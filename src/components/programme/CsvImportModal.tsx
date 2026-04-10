// src/components/programme/CsvImportModal.tsx
"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ListChecks,
  Plus,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";

import type { ProgrammeNode } from "./types";
import { parseCsv } from "./csvParser";
import { mergeParsedRows, type ImportDiff } from "./csvMerge";

interface CsvImportModalProps {
  tree: ProgrammeNode[];
  onConfirm: (updatedTree: ProgrammeNode[]) => void;
  onClose: () => void;
}

type Step = "upload" | "preview";

const REQUIRED_COLUMNS = [
  "Activity ID",
  "Activity Name",
  "Start",
  "Finish",
  "Activity Status",
] as const;

export function CsvImportModal({ tree, onConfirm, onClose }: CsvImportModalProps) {
  const titleId = useId();
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [diff, setDiff] = useState<ImportDiff | null>(null);
  const [pendingTree, setPendingTree] = useState<ProgrammeNode[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const hasChanges = diff
    ? diff.updatedActivities.length > 0 ||
      diff.addedActivities.length > 0 ||
      diff.updatedStructural.length > 0 ||
      diff.addedStructural.length > 0
    : false;

  const changeCount = diff
    ? diff.addedStructural.length +
      diff.updatedStructural.length +
      diff.addedActivities.length +
      diff.updatedActivities.length
    : 0;

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result;
        if (typeof text !== "string") {
          setError("Could not read file");
          return;
        }
        const rows = parseCsv(text);
        const result = mergeParsedRows(rows, tree);
        setDiff(result.diff);
        setPendingTree(result.updatedTree);
        setError(null);
        setStep("preview");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse CSV");
      }
    };
    reader.onerror = () => {
      setError("Could not read file");
    };
    reader.readAsText(file);
  }

  function handleBack() {
    setStep("upload");
    setError(null);
    setFileName(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleBackdropMouseDown(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        className="border-border bg-card shadow-overlay relative flex w-full max-w-xl flex-col rounded-lg border"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="border-border flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h2 id={titleId} className="text-foreground text-base font-semibold">
                Import from Primavera
              </h2>
              <StepBadge step={step} />
            </div>
            <p className="text-muted-foreground text-xs">
              {step === "upload"
                ? "P6 CSV export — comma or tab separated"
                : hasChanges
                  ? `${changeCount} change${changeCount === 1 ? "" : "s"} ready to apply`
                  : "No differences vs your current programme"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:bg-background hover:text-foreground shrink-0 rounded-md p-1.5 transition-colors"
            aria-label="Close"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </header>

        {step === "upload" && (
          <div className="space-y-4 px-5 py-5">
            <div className="border-border bg-background/80 rounded-lg border border-dashed p-6 text-center">
              <div className="bg-card text-gold shadow-card mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg">
                <Upload className="h-5 w-5" aria-hidden />
              </div>
              <p className="text-foreground mb-1 text-sm font-medium">Drop a file or browse</p>
              <p className="text-muted-foreground mb-4 text-xs leading-relaxed">
                Activities by Activity ID — they take the parent implied by CSV row order (can move
                to another scope or task). Structure matches WBS prefix (1., 1.1, …), not full
                titles. Siblings sort by WBS. New scopes have no engineers; existing allocations and
                planned hours stay put.
              </p>
              <input
                ref={fileRef}
                id="csv-import-input"
                type="file"
                accept=".csv,.txt"
                onChange={handleFile}
                className="sr-only"
              />
              <label
                htmlFor="csv-import-input"
                className="bg-foreground text-background inline-flex cursor-pointer items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
              >
                Choose file
              </label>
              {fileName && (
                <p className="text-muted-foreground mt-3 truncate text-xs" title={fileName}>
                  Last selected: {fileName}
                </p>
              )}
            </div>

            <div className="border-border bg-card rounded-md border p-3">
              <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                Required columns
              </p>
              <p className="text-foreground text-xs leading-relaxed">
                {REQUIRED_COLUMNS.join(" · ")}
              </p>
            </div>

            {error && (
              <div
                className="border-status-critical/30 bg-status-critical-bg text-status-critical rounded-md border px-3 py-2.5 text-sm"
                role="alert"
              >
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground rounded-md px-3 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {step === "preview" && diff && (
          <div className="flex max-h-[min(70vh,520px)] flex-col">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {!hasChanges && (
                <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-8 text-center text-sm">
                  <ListChecks className="h-10 w-10 opacity-40" strokeWidth={1.25} aria-hidden />
                  <p>No changes detected — your programme already matches this export.</p>
                </div>
              )}

              <DiffSection
                icon={<Plus className="h-4 w-4" />}
                tone="info"
                count={diff.addedStructural.length}
                label="scope / task created"
                items={diff.addedStructural.map((s) => s.name)}
              />
              <DiffSection
                icon={<RefreshCw className="h-4 w-4" />}
                tone="info"
                count={diff.updatedStructural.length}
                label="scope / task updated"
                items={diff.updatedStructural.map((s) => s.name)}
              />
              <DiffSection
                icon={<Plus className="h-4 w-4" />}
                tone="healthy"
                count={diff.addedActivities.length}
                label={diff.addedActivities.length === 1 ? "activity added" : "activities added"}
                items={diff.addedActivities.map((a) => `${a.activityId} — ${a.name}`)}
              />
              <DiffSection
                icon={<RefreshCw className="h-4 w-4" />}
                tone="healthy"
                count={diff.updatedActivities.length}
                label={
                  diff.updatedActivities.length === 1 ? "activity updated" : "activities updated"
                }
                items={diff.updatedActivities.map((a) =>
                  a.changedFields.includes("parent") && a.newParentName
                    ? `${a.activityId} — ${a.name} (moved under ${a.newParentName})`
                    : `${a.activityId} — ${a.name}`
                )}
              />

              {diff.warnings.length > 0 && (
                <div className="border-status-warning/40 bg-status-warning-bg rounded-lg border p-3">
                  <p className="text-status-warning mb-2 flex items-center gap-1.5 text-sm font-medium">
                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                    {diff.warnings.length} warning{diff.warnings.length === 1 ? "" : "s"}
                  </p>
                  <ul className="text-muted-foreground space-y-1.5 pl-1 text-xs leading-snug">
                    {diff.warnings.map((w, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-status-warning shrink-0">•</span>
                        <span>{w.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <footer className="border-border flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
              <button
                type="button"
                onClick={handleBack}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="border-border text-foreground hover:bg-background rounded-md border px-4 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => pendingTree && onConfirm(pendingTree)}
                  disabled={!hasChanges}
                  className="bg-foreground text-background inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  Apply changes
                </button>
              </div>
            </footer>
          </div>
        )}
      </div>
    </div>
  );
}

function StepBadge({ step }: { step: Step }) {
  return (
    <span className="border-border text-muted-foreground inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase">
      <span
        className={step === "upload" ? "text-foreground" : "text-muted-foreground"}
        aria-current={step === "upload" ? "step" : undefined}
      >
        1 · File
      </span>
      <span className="text-border">/</span>
      <span
        className={step === "preview" ? "text-foreground" : "text-muted-foreground"}
        aria-current={step === "preview" ? "step" : undefined}
      >
        2 · Review
      </span>
    </span>
  );
}

function DiffSection({
  icon,
  tone,
  count,
  label,
  items,
}: {
  icon: React.ReactNode;
  tone: "info" | "healthy";
  count: number;
  label: string;
  items: string[];
}) {
  if (count === 0) return null;
  const badge =
    tone === "healthy"
      ? "bg-status-healthy-bg text-status-healthy"
      : "bg-status-info-bg text-status-info";

  return (
    <div className="border-border bg-card shadow-card rounded-lg border p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${badge}`}>
          {icon}
        </span>
        <p className="text-foreground text-sm font-medium">
          <span className="tabular-nums">{count}</span> {label}
        </p>
      </div>
      <ul className="text-muted-foreground border-border max-h-36 space-y-1.5 overflow-y-auto border-l-2 pl-3 text-xs leading-relaxed">
        {items.map((item, i) => (
          <li key={i} className="min-w-0 break-words">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
