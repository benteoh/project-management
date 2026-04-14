import type { SupabaseClient } from "@supabase/supabase-js";

import type { Project, ProjectDbRow, ProjectUpsertRow } from "@/types/project";

const PROJECT_SELECT = "*, offices(name, location)" as const;

type ProjectRow = ProjectDbRow & { offices?: { name: string; location: string } | null };

function rowToProject(r: ProjectRow): Project {
  return {
    id: r.id,
    projectCode: r.project_code ?? null,
    name: r.name,
    client: r.client,
    officeId: r.office_id,
    officeName: r.offices?.name ?? "",
    status: r.status,
    fixedFee: Number(r.fixed_fee),
    startDate: r.start_date,
    endDate: r.end_date,
  };
}

export async function listProjectsFromDb(
  client: SupabaseClient
): Promise<{ projects: Project[] } | { error: string }> {
  const { data, error } = await client
    .from("projects")
    .select(PROJECT_SELECT)
    .order("name", { ascending: true });
  if (error) return { error: error.message };
  return { projects: (data as ProjectRow[]).map(rowToProject) };
}

export async function loadProjectById(
  client: SupabaseClient,
  id: string
): Promise<{ project: Project } | { error: string; notFound?: boolean }> {
  const { data, error } = await client
    .from("projects")
    .select(PROJECT_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Project not found", notFound: true };
  return { project: rowToProject(data as ProjectRow) };
}

export async function createProjectInDb(
  client: SupabaseClient,
  payload: ProjectUpsertRow
): Promise<{ project: Project } | { error: string }> {
  const { data, error } = await client
    .from("projects")
    .insert(payload)
    .select(PROJECT_SELECT)
    .single();
  if (error) return { error: error.message };
  return { project: rowToProject(data as ProjectRow) };
}

export async function updateProjectInDb(
  client: SupabaseClient,
  id: string,
  payload: Omit<ProjectUpsertRow, "id">
): Promise<{ project: Project } | { error: string }> {
  const { data, error } = await client
    .from("projects")
    .update(payload)
    .eq("id", id)
    .select(PROJECT_SELECT)
    .single();
  if (error) return { error: error.message };
  return { project: rowToProject(data as ProjectRow) };
}

export async function deleteProjectInDb(
  client: SupabaseClient,
  id: string
): Promise<{ ok: true } | { error: string }> {
  const { error } = await client.from("projects").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}
