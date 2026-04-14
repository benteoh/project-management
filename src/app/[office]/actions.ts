"use server";

import { revalidatePath } from "next/cache";

import { insertEustonDemoProject } from "@/lib/seed/eustonDemoProjectSeed";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function addEustonDemoProjectAction(): Promise<
  { ok: true; projectId: string; officeUrlSegment: string } | { ok: false; error: string }
> {
  const client = await createServerSupabaseClient();
  const result = await insertEustonDemoProject(client);
  if (result.ok) {
    revalidatePath("/");
    revalidatePath(`/${result.officeUrlSegment}`);
  }
  return result;
}
