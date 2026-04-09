import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { resolveSupabaseEnvConfig } from "./resolve-config";

export async function createServerSupabaseClient() {
  const { url, anonKey } = resolveSupabaseEnvConfig();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component — cookie writes are only allowed
          // in Server Actions and Route Handlers. Safe to ignore here.
        }
      },
    },
  });
}
