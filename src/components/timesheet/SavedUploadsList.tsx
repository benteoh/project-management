"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { deleteTimesheetUploadAction } from "@/app/[office]/project/[id]/actions";
import type { TimesheetUpload } from "@/types/timesheet";

import { formatTimesheetUploadedAt } from "./timesheetFormat";

export function SavedUploadsList({
  uploads,
  onView,
  onDelete,
}: {
  uploads: TimesheetUpload[];
  onView: (upload: TimesheetUpload) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    const res = await deleteTimesheetUploadAction(id);
    if (res.ok) onDelete(id);
    setDeletingId(null);
  }

  async function handleView(upload: TimesheetUpload) {
    setLoadingId(upload.id);
    await onView(upload);
    setLoadingId(null);
  }

  if (uploads.length === 0) return null;

  return (
    <div className="mt-6 w-full max-w-lg">
      <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
        Saved timesheets
      </p>
      <ul className="border-border divide-border divide-y rounded-lg border">
        {uploads.map((u) => (
          <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-foreground truncate text-sm font-medium">{u.fileName}</p>
              <p className="text-muted-foreground text-xs">
                {u.rowCount} rows · {formatTimesheetUploadedAt(u.uploadedAt)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => handleView(u)}
                disabled={loadingId === u.id}
                className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline disabled:opacity-40"
              >
                {loadingId === u.id ? "Loading…" : "View"}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(u.id)}
                disabled={deletingId === u.id}
                className="text-muted-foreground hover:text-status-critical shrink-0 transition-colors disabled:opacity-40"
                aria-label="Delete upload"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
