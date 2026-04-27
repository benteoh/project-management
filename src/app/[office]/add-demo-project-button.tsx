"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { addEustonDemoProjectAction, addIverEghamDemoProjectAction } from "./actions";

type DemoKey = "euston" | "ia";

export function AddDemoProjectButton() {
  const router = useRouter();
  const [busy, setBusy] = useState<DemoKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(key: DemoKey) {
    setBusy(key);
    setError(null);
    const action = key === "euston" ? addEustonDemoProjectAction : addIverEghamDemoProjectAction;
    const res = await action();
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
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
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleClick("euston")}
          disabled={busy !== null}
          className="border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
        >
          {busy === "euston" ? "Creating…" : "Add Euston demo"}
        </button>
        <button
          type="button"
          onClick={() => handleClick("ia")}
          disabled={busy !== null}
          className="border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
        >
          {busy === "ia" ? "Creating…" : "Add I&E demo"}
        </button>
      </div>
    </div>
  );
}
