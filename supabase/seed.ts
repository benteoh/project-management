/**
 * Seeds Supabase with programme nodes and engineer pool.
 * npm run seed  (loads .env.local then .env)
 */
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

import { flattenTree } from "../src/lib/programme/programmeTree";
import {
  SEED_ENGINEER_CODES,
  SEED_PROJECT_ID,
  seedProgrammeData,
  seedProjectRow,
} from "../src/lib/programme/seedConfig";
import { resolveSupabaseEnvConfig } from "../src/lib/supabase/resolve-config";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local"), quiet: true });
config({ path: resolve(__dirname, "..", ".env"), quiet: true, override: true });

const { url, anonKey } = resolveSupabaseEnvConfig();
const supabase = createClient(url, anonKey);

async function seed() {
  console.log("Seeding Supabase...");

  const { error: projectErr } = await supabase
    .from("projects")
    .upsert(seedProjectRow, { onConflict: "id" });
  if (projectErr) throw new Error(`projects: ${projectErr.message}`);
  console.log("✓ project");

  const { error: poolErr } = await supabase.from("engineer_pool").upsert(
    [...SEED_ENGINEER_CODES].map((code) => ({ code })),
    { onConflict: "code" }
  );
  if (poolErr) throw new Error(`engineer_pool: ${poolErr.message}`);
  console.log(`✓ ${SEED_ENGINEER_CODES.length} engineers`);

  const { nodeRows, engineerRows } = flattenTree(seedProgrammeData, SEED_PROJECT_ID);
  const { error: nodesErr } = await supabase
    .from("programme_nodes")
    .upsert(nodeRows, { onConflict: "id" });
  if (nodesErr) throw new Error(`programme_nodes: ${nodesErr.message}`);
  console.log(`✓ ${nodeRows.length} nodes`);

  if (engineerRows.length > 0) {
    const { error: engErr } = await supabase
      .from("scope_engineers")
      .upsert(engineerRows, { onConflict: "scope_id,engineer_code" });
    if (engErr) throw new Error(`scope_engineers: ${engErr.message}`);
    console.log(`✓ ${engineerRows.length} scope-engineer rows`);
  }

  console.log("Done.");
}

seed().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
