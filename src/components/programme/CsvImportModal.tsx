// src/components/programme/CsvImportModal.tsx
"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";

import type { ProgrammeNode } from "./types";
import { parseCsv } from "./csvParser";
import { mergeParsedRows, type ImportDiff } from "./csvMerge";

interface CsvImportModalProps {
  tree: ProgrammeNode[];
  onConfirm: (updatedTree: ProgrammeNode[]) => void;
  onClose: () => void;
}

type Step = "upload" | "preview";

export function CsvImportModal({ tree, onConfirm, onClose }: CsvImportModalProps) {
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [diff, setDiff] = useState<ImportDiff | null>(null);
  const [pendingTree, setPendingTree] = useState<ProgrammeNode[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const hasChanges = diff
    ? diff.updatedActivities.length > 0 ||
      diff.addedActivities.length > 0 ||
      diff.updatedStructural.length > 0 ||
      diff.addedStructural.length > 0
    : false;

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const rows = parseCsv(ev.target?.result as string);
        const result = mergeParsedRows(rows, tree);
        setDiff(result.diff);
        setPendingTree(result.updatedTree);
        setError(null);
        setStep("preview");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse CSV");
      }
    };
    reader.readAsText(file);
  }

  function handleBack() {
    setStep("upload");
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card shadow-overlay w-full max-w-lg rounded-lg p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-foreground text-sm font-semibold">Import CSV</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Upload a Primavera P6 tab-separated CSV export. Activities are merged by Activity ID.
              Engineer allocations and hours are preserved.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFile}
              className="text-muted-foreground block w-full text-sm"
            />
            {error && <p className="text-status-critical text-sm">{error}</p>}
          </div>
        )}

        {step === "preview" && diff && (
          <div className="space-y-4">
            <div className="max-h-72 space-y-3 overflow-y-auto text-sm">
              {!hasChanges && <p className="text-muted-foreground">No changes detected.</p>}
              <DiffSection
                count={diff.addedStructural.length}
                label="scope/task(s) created"
                items={diff.addedStructural.map((s) => s.name)}
              />
              <DiffSection
                count={diff.updatedStructural.length}
                label="scope/task(s) updated"
                items={diff.updatedStructural.map((s) => s.name)}
              />
              <DiffSection
                count={diff.addedActivities.length}
                label={diff.addedActivities.length === 1 ? "activity added" : "activities added"}
                items={diff.addedActivities.map((a) => `${a.activityId} – ${a.name}`)}
              />
              <DiffSection
                count={diff.updatedActivities.length}
                label={
                  diff.updatedActivities.length === 1 ? "activity updated" : "activities updated"
                }
                items={diff.updatedActivities.map((a) => `${a.activityId} – ${a.name}`)}
              />
              {diff.warnings.length > 0 && (
                <div>
                  <p className="text-status-warning font-medium">
                    {diff.warnings.length} warning(s)
                  </p>
                  <ul className="text-muted-foreground mt-1 space-y-0.5 pl-3">
                    {diff.warnings.map((w, i) => (
                      <li key={i}>{w.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleBack}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ← Back
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="border-border text-foreground hover:bg-background rounded-md border px-3 py-1.5 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => pendingTree && onConfirm(pendingTree)}
                  disabled={!hasChanges}
                  className="bg-foreground text-background rounded-md px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DiffSection({ count, label, items }: { count: number; label: string; items: string[] }) {
  if (count === 0) return null;
  return (
    <div>
      <p className="text-foreground font-medium">
        {count} {label}
      </p>
      <ul className="text-muted-foreground mt-1 space-y-0.5 pl-3">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
