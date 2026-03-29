import "server-only";

import { createClient } from "@supabase/supabase-js";

import { resolveSupabaseEnvConfig } from "./resolve-config";

export function createServerSupabaseClient() {
  const { url, anonKey } = resolveSupabaseEnvConfig();
  return createClient(url, anonKey);
}
