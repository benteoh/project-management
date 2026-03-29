import { createClient } from "@supabase/supabase-js";

import { resolveSupabaseEnvConfig } from "./resolve-config";

const { url, anonKey } = resolveSupabaseEnvConfig();

export const supabase = createClient(url, anonKey);
