"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { addEustonDemoProjectAction } from "./actions";

export function AddDemoProjectButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setError(null);
    const res = await addEustonDemoProjectAction();
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    // Refresh while still on the office list so the new row can load; defer push one tick so
    // the RSC refetch can start before this route unmounts. Server action also revalidates paths.
    router.refresh();
    window.setTimeout(() => {
      router.push(`/${encodeURIComponent(res.officeUrlSegment)}/project/${res.projectId}`);
    }, 0);
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      {error ? (
        <p className="text-status-critical max-w-[min(100%,20rem)] text-right text-xs">{error}</p>
      ) : null}
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
      >
        {busy ? "Creating…" : "Add demo project"}
      </button>
    </div>
  );
}
