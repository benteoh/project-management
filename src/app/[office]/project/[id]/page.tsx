import type { ProgrammeNode } from "@/components/programme/types";
import type { EngineerPoolEntry } from "@/types/engineer-pool";
import type { Project } from "@/types/project";
import type { TimesheetUpload } from "@/types/timesheet";
import { getBankHolidays } from "@/lib/bank-holidays/bankHolidays";
import { loadForecastHoursByScopeForProject } from "@/lib/forecast/forecastDb";
import { loadProjectById } from "@/lib/projects/projectDb";
import { createSupabaseProgrammeRepository } from "@/lib/programme/supabaseProgrammeRepository";
import { listProjectEngineersForProjectFromDb } from "@/lib/projectEngineers/projectEngineersDb";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listTimesheetUploads } from "@/lib/timesheet/timesheetDb";

import type { ForecastHoursByScopeRecord } from "@/types/forecast-scope";
import type { ProjectEngineerRates } from "@/types/project-engineer";

import ProjectPageClient from "./project-page-client";

type Props = { params: Promise<{ office: string; id: string }> };

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  let programmeLoadError: string | null = null;
  let projectLoadError: string | null = null;
  let project: Project | null = null;
  let initialProgrammeTree: ProgrammeNode[] = [];
  let initialEngineerPool: EngineerPoolEntry[] = [];

  let bankHolidays: string[] = [];
  let initialTimesheetUploads: TimesheetUpload[] = [];
  let forecastHoursByScope: ForecastHoursByScopeRecord = {};

  try {
    const client = await createServerSupabaseClient();
    const [
      projectRes,
      programmeResult,
      holidays,
      projectEngineersRes,
      uploadsRes,
      forecastScopeRes,
    ] = await Promise.all([
      loadProjectById(client, id),
      createSupabaseProgrammeRepository(client, id).load(),
      getBankHolidays(),
      listProjectEngineersForProjectFromDb(client, id),
      listTimesheetUploads(client, id),
      loadForecastHoursByScopeForProject(client, id),
    ]);
    bankHolidays = holidays;
    if ("uploads" in uploadsRes) initialTimesheetUploads = uploadsRes.uploads;
    if (forecastScopeRes.ok) forecastHoursByScope = forecastScopeRes.byScope;

    if ("project" in projectRes) {
      project = projectRes.project;
    } else {
      projectLoadError = projectRes.error;
    }

    if (programmeResult.ok) {
      initialProgrammeTree = programmeResult.tree;
      const ratesByEngineerId = new Map<string, ProjectEngineerRates>();
      if ("rows" in projectEngineersRes) {
        for (const pe of projectEngineersRes.rows) {
          ratesByEngineerId.set(pe.engineerId, pe.rates);
        }
      }
      initialEngineerPool = programmeResult.engineerPool.map((e) => ({
        ...e,
        rates: ratesByEngineerId.get(e.id),
      }));
    } else {
      programmeLoadError = programmeResult.error;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load";
    projectLoadError = projectLoadError ?? msg;
    programmeLoadError = programmeLoadError ?? msg;
  }

  return (
    <ProjectPageClient
      projectId={id}
      project={project}
      projectLoadError={projectLoadError}
      initialProgrammeTree={initialProgrammeTree}
      initialEngineerPool={initialEngineerPool}
      programmeLoadError={programmeLoadError}
      bankHolidays={bankHolidays}
      initialTimesheetUploads={initialTimesheetUploads}
      forecastHoursByScope={forecastHoursByScope}
    />
  );
}
