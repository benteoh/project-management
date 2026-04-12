"use client";

import { useEffect, useState } from "react";

import { loadProjectsForSettingsAction } from "@/app/settings/actions";
import type { Project } from "@/types/project";

export function ProjectSettingsList({
  onSelectProject,
}: {
  onSelectProject: (id: string) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await loadProjectsForSettingsAction();
      if (cancelled) return;
      if (!r.ok) {
        setError(r.error);
        setProjects([]);
      } else {
        setProjects(r.projects);
        setError(null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
      <div>
        <h3 className="text-foreground text-sm font-semibold">Projects</h3>
        <p className="text-muted-foreground mt-1 text-xs">
          Choose a project to open its settings (rates and more).
        </p>
      </div>

      {error && (
        <div className="border-border bg-status-critical-bg text-status-critical rounded-lg border px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {loading && <p className="text-muted-foreground text-sm">Loading projects…</p>}

      {!loading && !error && projects.length === 0 && (
        <p className="text-muted-foreground text-sm">No projects yet.</p>
      )}

      {!loading && projects.length > 0 && (
        <ul className="flex flex-col gap-1">
          {projects.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelectProject(p.id)}
                className="border-border bg-card text-foreground hover:bg-muted shadow-card w-full rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors"
              >
                <span className="block">{p.name}</span>
                <span className="text-muted-foreground mt-0.5 block text-xs font-normal">
                  {p.client} · {p.officeName}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
