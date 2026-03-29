import type { SupabaseClient } from "@supabase/supabase-js";

import type { Project, ProjectDbRow } from "@/types/project";

function rowToProject(r: ProjectDbRow): Project {
  return {
    id: r.id,
    name: r.name,
    client: r.client,
    office: r.office,
    status: r.status,
    fixedFee: Number(r.fixed_fee),
    startDate: r.start_date,
    endDate: r.end_date,
  };
}

export async function loadProjectById(
  client: SupabaseClient,
  id: string
): Promise<{ project: Project } | { error: string; notFound?: boolean }> {
  const { data, error } = await client.from("projects").select("*").eq("id", id).maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Project not found", notFound: true };
  return { project: rowToProject(data as ProjectDbRow) };
}
