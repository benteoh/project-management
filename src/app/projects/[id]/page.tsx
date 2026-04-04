import type { ProgrammeNode } from "@/components/programme/types";
import type { EngineerPoolEntry } from "@/types/engineer-pool";
import type { Project } from "@/types/project";
import { getBankHolidays } from "@/lib/bank-holidays/bankHolidays";
import { loadProjectById } from "@/lib/projects/projectDb";
import { createSupabaseProgrammeRepository } from "@/lib/programme/supabaseProgrammeRepository";
import { listProjectEngineersForProjectFromDb } from "@/lib/projectEngineers/projectEngineersDb";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import ProjectPageClient from "./project-page-client";

type Props = { params: Promise<{ id: string }> };

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  let programmeLoadError: string | null = null;
  let projectLoadError: string | null = null;
  let project: Project | null = null;
  let initialProgrammeTree: ProgrammeNode[] = [];
  let initialEngineerPool: EngineerPoolEntry[] = [];

  let bankHolidays: string[] = [];

  try {
    const client = await createServerSupabaseClient();
    const [projectRes, programmeResult, holidays, projectEngineersRes] = await Promise.all([
      loadProjectById(client, id),
      createSupabaseProgrammeRepository(client, id).load(),
      getBankHolidays(),
      listProjectEngineersForProjectFromDb(client, id),
    ]);
    bankHolidays = holidays;

    if ("project" in projectRes) {
      project = projectRes.project;
    } else {
      projectLoadError = projectRes.error;
    }

    if (programmeResult.ok) {
      initialProgrammeTree = programmeResult.tree;
      // Merge rate_a from project_engineers into each pool entry
      const rateAByEngineerId = new Map<string, number | null>();
      if ("rows" in projectEngineersRes) {
        for (const pe of projectEngineersRes.rows) {
          rateAByEngineerId.set(pe.engineerId, pe.rates[0]);
        }
      }
      initialEngineerPool = programmeResult.engineerPool.map((e) => ({
        ...e,
        rateA: rateAByEngineerId.get(e.id) ?? null,
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
    />
  );
}
