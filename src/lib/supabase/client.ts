import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveSupabaseEnvConfig } from "./resolve-config";

const { url, anonKey } = resolveSupabaseEnvConfig();

let browserClient: SupabaseClient | null = null;

export function createBrowserSupabaseClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(url, anonKey);
  }
  return browserClient;
}

export const supabase = createBrowserSupabaseClient();
