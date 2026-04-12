"use client";

import { useEffect, useMemo, useState } from "react";

import { createProjectAction, loadProjectsForSettingsAction } from "@/app/settings/actions";
import { loadOfficesAction } from "@/app/settings/officeActions";
import type { Office } from "@/types/office";
import type { Project, ProjectStatus } from "@/types/project";

import { ProjectFormFields } from "./ProjectFormFields";
import type { ProjectCreatePayload } from "./types";

const EMPTY_PROJECT: Omit<ProjectCreatePayload, "officeId"> = {
  name: "",
  client: "",
  projectCode: null,
  status: "active" as ProjectStatus,
  fixedFee: 0,
  startDate: "",
  endDate: "",
};

function makeDraft(officeId: string): ProjectCreatePayload {
  return { ...EMPTY_PROJECT, officeId };
}

type OfficeProjectSection = {
  office: Office | null;
  heading: string;
  subheading: string | null;
  projects: Project[];
};

function sectionTabKey(section: OfficeProjectSection): string {
  if (section.office) return section.office.id;
  return `legacy-${section.projects[0]?.officeId ?? section.heading}`;
}

function buildSections(offices: Office[], projects: Project[]): OfficeProjectSection[] {
  if (offices.length === 0) {
    if (projects.length === 0) return [];
    const byOffice = new Map<string, Project[]>();
    for (const p of projects) {
      const list = byOffice.get(p.officeId) ?? [];
      list.push(p);
      byOffice.set(p.officeId, list);
    }
    return Array.from(byOffice.entries()).map(([, group]) => ({
      office: null,
      heading: group[0]?.officeName ?? "Projects",
      subheading: null,
      projects: group,
    }));
  }

  const officeIds = new Set(offices.map((o) => o.id));
  const sections: OfficeProjectSection[] = offices.map((office) => ({
    office,
    heading: office.name,
    subheading: office.location || null,
    projects: projects.filter((p) => p.officeId === office.id),
  }));

  const orphan = projects.filter((p) => !officeIds.has(p.officeId));
  if (orphan.length === 0) return sections;

  const orphanByOffice = new Map<string, Project[]>();
  for (const p of orphan) {
    const list = orphanByOffice.get(p.officeId) ?? [];
    list.push(p);
    orphanByOffice.set(p.officeId, list);
  }
  for (const group of orphanByOffice.values()) {
    sections.push({
      office: null,
      heading: group[0]?.officeName ?? "Other",
      subheading: "Office record missing or removed",
      projects: group,
    });
  }
  return sections;
}

export function ProjectSettingsList({
  onSelectProject,
}: {
  onSelectProject: (id: string) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addForOfficeId, setAddForOfficeId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState<ProjectCreatePayload | null>(null);

  const sections = useMemo(() => buildSections(offices, projects), [offices, projects]);

  /** User-picked tab; when null or stale, the first section tab is used. */
  const [pickedOfficeTabId, setPickedOfficeTabId] = useState<string | null>(null);

  const activeOfficeTabId = useMemo(() => {
    const keys = sections.map(sectionTabKey);
    if (keys.length === 0) return null;
    if (pickedOfficeTabId != null && keys.includes(pickedOfficeTabId)) return pickedOfficeTabId;
    return keys[0]!;
  }, [sections, pickedOfficeTabId]);

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

  const openAddForm = (officeId: string) => {
    setAddForOfficeId(officeId);
    setDraft(makeDraft(officeId));
    setError(null);
    setPickedOfficeTabId(officeId);
  };

  const closeAddForm = () => {
    setAddForOfficeId(null);
    setDraft(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    setIsSaving(true);
    const r = await createProjectAction(draft);
    setIsSaving(false);
    if (r.ok) {
      setProjects(r.projects);
      closeAddForm();
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
          Pick an office tab to see and add projects for that location.
        </p>
      </div>

      {error && (
        <div className="border-border bg-status-critical-bg text-status-critical rounded-lg border px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {loading && <p className="text-muted-foreground text-sm">Loading…</p>}

      {!loading && offices.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Add at least one office in the Offices tab before you can assign new projects.
        </p>
      )}

      {!loading && addForOfficeId && draft && (
        <form
          onSubmit={handleCreate}
          className="border-border bg-card/40 shadow-card rounded-lg border p-4"
        >
          <p className="text-foreground mb-3 text-sm font-medium">
            New project · {offices.find((o) => o.id === addForOfficeId)?.name ?? "Office"}
          </p>
          <ProjectFormFields value={draft} disabled={isSaving} onChange={setDraft} />
          <div className="border-border mt-4 flex justify-end gap-2 border-t pt-4">
            <button
              type="button"
              onClick={closeAddForm}
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

      {!loading && sections.length > 0 && activeOfficeTabId && (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {sections.length > 1 && (
            <div
              role="tablist"
              aria-label="Office"
              className="border-border flex shrink-0 flex-wrap gap-0.5 border-b"
            >
              {sections.map((section) => {
                const key = sectionTabKey(section);
                const isActive = key === activeOfficeTabId;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    id={`office-project-tab-${key}`}
                    onClick={() => setPickedOfficeTabId(key)}
                    className={`rounded-t-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none ${
                      isActive
                        ? "border-border bg-card text-foreground relative z-10 -mb-px border-t border-r border-l"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {section.heading}
                  </button>
                );
              })}
            </div>
          )}

          {(() => {
            const section =
              sections.find((s) => sectionTabKey(s) === activeOfficeTabId) ?? sections[0];
            if (!section) return null;
            const multiOffice = sections.length > 1;
            return (
              <section
                role={multiOffice ? "tabpanel" : "region"}
                aria-labelledby={
                  multiOffice ? `office-project-tab-${activeOfficeTabId}` : undefined
                }
                aria-label={multiOffice ? undefined : `Projects for ${section.heading}`}
                className="flex min-h-0 flex-1 flex-col gap-3"
              >
                {!multiOffice && (
                  <div>
                    <h4 className="text-foreground text-sm font-semibold">{section.heading}</h4>
                    {section.subheading ? (
                      <p className="text-muted-foreground mt-0.5 text-xs">{section.subheading}</p>
                    ) : null}
                  </div>
                )}
                {multiOffice && section.subheading ? (
                  <p className="text-muted-foreground text-xs">{section.subheading}</p>
                ) : null}

                {section.office && addForOfficeId !== section.office.id && (
                  <div className="flex shrink-0 justify-end">
                    <button
                      type="button"
                      onClick={() => openAddForm(section.office!.id)}
                      className="border-border bg-background text-foreground hover:bg-muted w-fit rounded-md border px-3 py-1.5 text-xs font-medium"
                    >
                      Add project
                    </button>
                  </div>
                )}

                {section.projects.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No projects in this office yet.</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {section.projects.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => onSelectProject(p.id)}
                          className="border-border bg-card text-foreground hover:bg-muted shadow-card w-full rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors"
                        >
                          <span className="block">
                            {p.projectCode ? `${p.projectCode} - ${p.name}` : p.name}
                          </span>
                          <span className="text-muted-foreground mt-0.5 block text-xs font-normal">
                            {p.client}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })()}
        </div>
      )}
    </div>
  );
}
