"use server";

import {
  addAllActiveEngineersToProjectInDb,
  deleteProjectEngineerInDb,
  insertProjectEngineerInDb,
  listProjectEngineersForProjectFromDb,
  updateProjectEngineerRateSlotInDb,
} from "@/lib/projectEngineers/projectEngineersDb";
import { listEngineersFromDb } from "@/lib/engineers/engineerDb";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Engineer } from "@/types/engineer-pool";
import {
  PROJECT_ENGINEER_RATE_SLOT_COUNT,
  type ProjectEngineerAssignment,
} from "@/types/project-engineer";

export type ProjectEngineersView = {
  assignments: ProjectEngineerAssignment[];
  poolForAdd: Pick<Engineer, "id" | "code" | "firstName" | "lastName">[];
};

type ViewResult = { ok: true; view: ProjectEngineersView } | { ok: false; error: string };

async function loadView(client: ReturnType<typeof createServerSupabaseClient>, projectId: string) {
  const [listed, pool] = await Promise.all([
    listProjectEngineersForProjectFromDb(client, projectId),
    listEngineersFromDb(client),
  ]);

  if ("error" in listed) return { ok: false as const, error: listed.error };
  if ("error" in pool) return { ok: false as const, error: pool.error };

  const onProject = new Set(listed.rows.map((r) => r.engineerId));
  const poolForAdd = pool.engineers
    .filter((e) => e.isActive && !onProject.has(e.id))
    .map((e) => ({
      id: e.id,
      code: e.code,
      firstName: e.firstName,
      lastName: e.lastName,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  return {
    ok: true as const,
    view: {
      assignments: listed.rows,
      poolForAdd,
    },
  };
}

export async function loadProjectEngineersAction(projectId: string): Promise<ViewResult> {
  if (!projectId) return { ok: false, error: "Project id is required." };
  const client = createServerSupabaseClient();
  return loadView(client, projectId);
}

export async function setProjectEngineerRateSlotAction(
  projectId: string,
  assignmentId: string,
  slotIndex: number,
  rate: number | null
): Promise<ViewResult> {
  if (!projectId || !assignmentId) {
    return { ok: false, error: "Project and assignment are required." };
  }

  if (
    !Number.isInteger(slotIndex) ||
    slotIndex < 0 ||
    slotIndex >= PROJECT_ENGINEER_RATE_SLOT_COUNT
  ) {
    return { ok: false, error: "Rate slot must be A through E." };
  }

  const client = createServerSupabaseClient();
  const up = await updateProjectEngineerRateSlotInDb(
    client,
    projectId,
    assignmentId,
    slotIndex,
    rate
  );
  if ("error" in up) return { ok: false, error: up.error };

  return loadView(client, projectId);
}

export async function addProjectEngineerAction(
  projectId: string,
  engineerId: string
): Promise<ViewResult> {
  if (!projectId || !engineerId) {
    return { ok: false, error: "Project and engineer are required." };
  }

  const client = createServerSupabaseClient();
  const add = await insertProjectEngineerInDb(client, projectId, engineerId);
  if ("error" in add) {
    if (add.error.includes("duplicate") || add.error.includes("unique")) {
      return { ok: false, error: "That engineer is already on this project." };
    }
    return { ok: false, error: add.error };
  }

  return loadView(client, projectId);
}

export async function removeProjectEngineerAction(
  projectId: string,
  assignmentId: string
): Promise<ViewResult> {
  if (!projectId || !assignmentId) {
    return { ok: false, error: "Project and assignment are required." };
  }

  const client = createServerSupabaseClient();
  const del = await deleteProjectEngineerInDb(client, projectId, assignmentId);
  if ("error" in del) return { ok: false, error: del.error };

  return loadView(client, projectId);
}

export async function addAllEngineersToProjectAction(projectId: string): Promise<ViewResult> {
  if (!projectId) return { ok: false, error: "Project id is required." };

  const client = createServerSupabaseClient();
  const add = await addAllActiveEngineersToProjectInDb(client, projectId);
  if ("error" in add) return { ok: false, error: add.error };

  return loadView(client, projectId);
}
