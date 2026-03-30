import type { ProgrammeNode } from "@/components/programme/types";
import type { EngineerPoolEntry } from "@/types/engineer-pool";
import type { Project } from "@/types/project";
import { loadProjectById } from "@/lib/projects/projectDb";
import { createSupabaseProgrammeRepository } from "@/lib/programme/supabaseProgrammeRepository";
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

  try {
    const client = createServerSupabaseClient();
    const [projectRes, programmeResult] = await Promise.all([
      loadProjectById(client, id),
      createSupabaseProgrammeRepository(client, id).load(),
    ]);

    if ("project" in projectRes) {
      project = projectRes.project;
    } else {
      projectLoadError = projectRes.error;
    }

    if (programmeResult.ok) {
      initialProgrammeTree = programmeResult.tree;
      initialEngineerPool = programmeResult.engineerPool;
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
    />
  );
}
