import Link from "next/link";

import { normalizeOfficeUrlParam, officeNameMatchesUrlParam } from "@/lib/offices/officeUrl";
import { listProjectsFromDb } from "@/lib/projects/projectDb";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Project, ProjectStatus } from "@/types/project";

type Props = { params: Promise<{ office: string }> };

const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Active",
  complete: "Complete",
  bid: "Bid",
  on_hold: "On Hold",
};

const STATUS_CLASSES: Record<ProjectStatus, string> = {
  active: "text-status-healthy bg-status-healthy-bg",
  complete: "text-muted-foreground bg-muted",
  bid: "text-status-info bg-status-info-bg",
  on_hold: "text-status-warning bg-status-warning-bg",
};

export default async function OfficePage({ params }: Props) {
  const { office } = await params;
  const officePathKey = normalizeOfficeUrlParam(office);

  let projects: Project[] = [];
  let error: string | null = null;

  try {
    const client = await createServerSupabaseClient();
    const result = await listProjectsFromDb(client);
    if ("projects" in result) {
      projects = result.projects.filter((p) => officeNameMatchesUrlParam(p.officeName, office));
    } else {
      error = result.error;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load projects";
  }

  const displayOfficeName = projects[0]?.officeName ?? decodeURIComponent(office);
  const officePathSegment = encodeURIComponent(officePathKey);

  return (
    <div className="flex flex-1 flex-col">
      {/* Page header */}
      <div className="border-border bg-card border-b px-6 py-4">
        <div className="mb-1 flex items-center gap-1.5">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground text-xs transition-colors"
          >
            Offices
          </Link>
          <span className="text-muted-foreground text-xs">/</span>
          <span className="text-foreground text-xs font-medium">{displayOfficeName}</span>
        </div>
        <h1 className="text-foreground text-2xl font-semibold">{displayOfficeName}</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {projects.length} project{projects.length !== 1 ? "s" : ""}
        </p>
      </div>

      {error && (
        <div className="p-6">
          <p className="text-status-critical text-sm">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {/* Header row — matches programme tab style */}
        <div className="border-border bg-muted text-muted-foreground sticky top-0 z-10 flex shrink-0 items-stretch border-b-2 py-1.5 text-xs font-medium tracking-wide uppercase">
          <div className="flex w-28 min-w-[7rem] shrink-0 items-center px-4 py-2">Code</div>
          <div className="flex min-w-[12rem] flex-1 items-center px-4 py-2">Project Name</div>
          <div className="flex w-40 min-w-[10rem] shrink-0 items-center px-4 py-2">Client</div>
          <div className="flex w-24 min-w-[6rem] shrink-0 items-center justify-center px-2 py-2">
            Status
          </div>
          <div className="flex w-28 min-w-[7rem] shrink-0 items-center justify-end px-4 py-2">
            Fee
          </div>
          <div className="flex w-24 min-w-[6rem] shrink-0 items-center px-4 py-2">Start</div>
          <div className="flex w-24 min-w-[6rem] shrink-0 items-center px-4 py-2">End</div>
        </div>

        {/* Data rows */}
        {projects.map((project) => (
          <Link
            key={project.id}
            href={`/${officePathSegment}/project/${project.id}`}
            className="group border-border hover:bg-muted/50 flex items-stretch border-b transition-colors"
          >
            <div className="text-muted-foreground flex w-28 min-w-[7rem] shrink-0 items-center px-4 py-3 font-mono text-xs">
              {project.projectCode ?? "—"}
            </div>
            <div className="text-foreground flex min-w-[12rem] flex-1 items-center px-4 py-3 text-sm font-medium">
              {project.name}
            </div>
            <div className="text-muted-foreground flex w-40 min-w-[10rem] shrink-0 items-center px-4 py-3 text-sm">
              <span className="truncate">{project.client}</span>
            </div>
            <div className="flex w-24 min-w-[6rem] shrink-0 items-center justify-center px-2 py-3">
              <span
                className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[project.status]}`}
              >
                {STATUS_LABELS[project.status]}
              </span>
            </div>
            <div className="text-muted-foreground flex w-28 min-w-[7rem] shrink-0 items-center justify-end px-4 py-3 font-mono text-sm">
              {formatCurrency(project.fixedFee)}
            </div>
            <div className="text-muted-foreground flex w-24 min-w-[6rem] shrink-0 items-center px-4 py-3 text-xs">
              {formatDate(project.startDate)}
            </div>
            <div className="text-muted-foreground flex w-24 min-w-[6rem] shrink-0 items-center px-4 py-3 text-xs">
              {formatDate(project.endDate)}
            </div>
          </Link>
        ))}

        {projects.length === 0 && !error && (
          <div className="flex items-center justify-center py-16">
            <p className="text-muted-foreground text-sm">No projects found for this office.</p>
          </div>
        )}
      </div>
    </div>
  );
}
