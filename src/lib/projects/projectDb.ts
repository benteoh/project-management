import type { SupabaseClient } from "@supabase/supabase-js";

import type { Project } from "@/types/project";

type ProjectRow = {
  id: string;
  name: string;
  client: string;
  office: string;
  status: Project["status"];
  fixed_fee: number | string;
  start_date: string;
  end_date: string;
};

function rowToProject(r: ProjectRow): Project {
  return {
    id: r.id,
    name: r.name,
    client: r.client,
    office: r.office,
    status: r.status,
    fixedFee: typeof r.fixed_fee === "number" ? r.fixed_fee : Number(r.fixed_fee),
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
  return { project: rowToProject(data as ProjectRow) };
}
