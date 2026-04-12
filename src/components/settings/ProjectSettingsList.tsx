"use client";

import { useEffect, useState } from "react";

import { createProjectAction, loadProjectsForSettingsAction } from "@/app/settings/actions";
import { loadOfficesAction } from "@/app/settings/officeActions";
import type { Office } from "@/types/office";
import type { Project, ProjectStatus } from "@/types/project";

import { ProjectFormFields } from "./ProjectFormFields";
import type { ProjectCreatePayload } from "./types";

const EMPTY_PROJECT: ProjectCreatePayload = {
  name: "",
  client: "",
  officeId: "",
  projectCode: null,
  status: "active" as ProjectStatus,
  fixedFee: 0,
  startDate: "",
  endDate: "",
};

export function ProjectSettingsList({
  onSelectProject,
}: {
  onSelectProject: (id: string) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState<ProjectCreatePayload>(EMPTY_PROJECT);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [projectsRes, officesRes] = await Promise.all([
        loadProjectsForSettingsAction(),
        loadOfficesAction(),
      ]);
      if (cancelled) return;
      if (!projectsRes.ok) setError(projectsRes.error);
      else setProjects(projectsRes.projects);
      if (officesRes.ok) setOffices(officesRes.offices);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const r = await createProjectAction(draft);
    setIsSaving(false);
    if (r.ok) {
      setProjects(r.projects);
      setDraft(EMPTY_PROJECT);
      setShowAddForm(false);
      setError(null);
    } else {
      setError(r.error);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
      <div>
        <h3 className="text-foreground text-sm font-semibold">Projects</h3>
        <p className="text-muted-foreground mt-1 text-xs">
          Choose a project to manage its settings, or add a new one.
        </p>
      </div>

      {error && (
        <div className="border-border bg-status-critical-bg text-status-critical rounded-lg border px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {loading && <p className="text-muted-foreground text-sm">Loading…</p>}

      {!loading && !showAddForm && (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="border-border bg-background text-foreground hover:bg-muted w-fit rounded-md border px-4 py-2 text-sm font-medium"
        >
          Add project
        </button>
      )}

      {showAddForm && (
        <form
          onSubmit={handleCreate}
          className="border-border bg-card/40 shadow-card rounded-lg border p-4"
        >
          <ProjectFormFields
            value={draft}
            offices={offices}
            disabled={isSaving}
            onChange={setDraft}
          />
          <div className="border-border mt-4 flex justify-end gap-2 border-t pt-4">
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setDraft(EMPTY_PROJECT);
              }}
              className="border-border bg-background text-foreground hover:bg-muted rounded-md border px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              Save project
            </button>
          </div>
        </form>
      )}

      {!loading && projects.length === 0 && !showAddForm && (
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
